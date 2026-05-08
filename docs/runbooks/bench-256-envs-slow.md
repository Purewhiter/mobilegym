# 256 envs bench 慢、wait_ready/warm 随并发恶化(已解决)

## 一句话问题

`bench_env` 用 `--parallel 256` 跑时,总耗时不仅没有线性加速,反而比 `--parallel 128` 还慢(17 min vs 19 min,几乎一样);`reset.wait_ready`、`warm`、`init_obs` 三个 boundary 阶段比 128 envs 大 5-10×,但 CPU/GPU/网络看不出饱和。

**最终解决后:256 envs 9 min 跑完(≈ 单条最长任务时长),vLLM 4 卡完美均衡,boundary cost 回到 64 envs baseline。**

## 根因(按影响从大到小)

整套症状是 **5 个独立瓶颈叠加**,缺哪个修哪个都不够:

1. **vLLM `--data-parallel-size 2 --api-server-count 2` 内部 DPLB 在长 stream 工作负载下严重失衡** —— 实测 e0:e1 ≈ 1:13。这是真正吃掉 ~50% 吞吐的根因,但藏得最深(SO_REUSEPORT + 双 DPLB 各管各的本地 lb 状态,通过 100ms zmq 同步)。
2. **bench 单进程 256-env asyncio.gather burst** —— 256 个 env 在 `_wait_ready` / `warm` 同一个 frame 集中发 CDP eval,Playwright Node 串行处理把 wallclock 拉成 13s。
3. **asyncio thread pool 默认 `min(32, cpu+4)`** —— `await asyncio.to_thread(agent.act, obs)` 在 256 envs 下排队 17s。
4. **host `fs.inotify.max_user_instances=128`(无 sudo 改不了)** —— `--isolation browsers` 高并发时 chromium init burst 撞上限,大批 env timeout 退出。详见 [bench-inotify-limit.md](./bench-inotify-limit.md)。
5. **`pages` 隔离下 8 page 共享 BrowserContext = 共享 IndexedDB origin** —— 8 个 page 同时 init 时 `__SIM_FS__` 的 IDB seed import 在 chromium storage worker 串行,SIM_FS 阶段慢 1.5-2.5s。

## 解决方案

### bench 侧(已合入 dev 分支)

| 改动 | 位置 | 作用 |
|---|---|---|
| asyncio thread pool 1024 | [bench_env/run.py](../../bench_env/run.py) `async_main` | to_thread 不再排队 |
| `MOBILE_GYM_POOL_BATCH_SLEEP_S` 自适应默认值(`browsers iso ≥ 192 → 3.0s`) | [bench_env/env/pool.py](../../bench_env/env/pool.py) `_setup` | 防 inotify burst |
| `_wait_ready` 拆成 SIM/SIM_FS/OS/waitForData 4 个 sw 子阶段 | [bench_env/env/mobile_gym.py](../../bench_env/env/mobile_gym.py) | 定位是哪段慢 |
| StopWatch 加 `record(name, elapsed)` + 线程本地 sw helper | [bench_env/env/stopwatch.py](../../bench_env/env/stopwatch.py) | 跨 thread / async 边界量 queue/exec/ttft |
| 多进程 runner(`--processes N`) | `bench_env/runner/multiprocess.py` | 拆 in-process burst |

### 部署侧

**vLLM 启动改为 N 个独立 DP=1 实例 + nginx least_conn 反代**(替代 `--data-parallel-size N`):

```bash
# 1) 4 个独立 vLLM,各占一卡
MODEL=/path/to/qwen3-vl-4b/hf_merged
NAME=qwen3-vl-4b-10s
for i in 0 1 2 3; do
  PORT=$((8003 + i))
  CUDA_VISIBLE_DEVICES=$i \
    nohup vllm serve "$MODEL" \
      --max-model-len 32768 --port "$PORT" \
      --served-model-name "$NAME" --gpu-memory-utilization 0.9 \
      > /tmp/vllm_gpu${i}.log 2>&1 &
done
# 等 /v1/models 都返回 200

# 2) nginx 反代,在 8002 做 least_conn
cat > /tmp/vllm_lb.conf <<'NGINX'
worker_processes 1;
events { worker_connections 4096; }
http {
    upstream vllm_pool {
        least_conn;
        server 127.0.0.1:8003 max_fails=3 fail_timeout=30s;
        server 127.0.0.1:8004 max_fails=3 fail_timeout=30s;
        server 127.0.0.1:8005 max_fails=3 fail_timeout=30s;
        server 127.0.0.1:8006 max_fails=3 fail_timeout=30s;
        keepalive 64;
    }
    server {
        listen 8002;
        proxy_buffering off;          # SSE 必须
        proxy_request_buffering off;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_connect_timeout 30s;
        proxy_send_timeout    600s;
        proxy_read_timeout    600s;
        client_max_body_size 100M;
        location / {
            proxy_pass http://vllm_pool;
            proxy_set_header Host $host;
        }
    }
}
NGINX
nginx -t -c /tmp/vllm_lb.conf
nohup nginx -c /tmp/vllm_lb.conf -g 'daemon off;' &
```

bench 客户端改用 `--model-base-url http://127.0.0.1:8002/v1`,其他不变。

### 推荐运行命令(参考)

```bash
python -m bench_env.run \
  --env-url https://localhost:4180 \
  --model-base-url http://127.0.0.1:8002/v1 \
  --model-name qwen3-vl-4b-10s \
  --agent generic_v2 --eval-mode grounded --loop-detect 8 \
  --split test \
  --parallel 256 --processes 32 \
  --isolation contexts --browsers 32 \
  --headless --monitor \
  --runs-dir runs/<your_label>
```

要点:
- `--processes 32 --parallel 256`:每进程 8 envs,boundary cost 完全消除
- `--isolation contexts --browsers 32`:每进程 1 chromium × 8 contexts × 1 page,**chromium 总数 32(inotify 安全),context 各自独立 IDB(无 SIM_FS 争用)**
- 无需手动设 `MOBILE_GYM_POOL_BATCH_SLEEP_S`(contexts iso 默认 0.3s 够)

## 实测对比

| 配置 | 总耗时 | infer median | wait_ready median | warm median |
|---|---|---|---|---|
| 64 envs(2 GPU,DP 失衡 → 实际 1 卡) | 28 min | 15.76s | 0.05s | 0.81s |
| 128 envs(同上) | 19 min | 18.60s | 4.58s | 0.95s |
| 256 envs 单进程(同上) | 17 min | 23.39s | 12.82s | 6.62s |
| 256 envs 多进程,2 GPU(失衡) | 18 min | 13.53s | 3.38s | 1.47s |
| **256 envs 多进程,4 GPU + nginx LB** | **9 min** | **9.16s** | **2.74s** | **0.71s** |
| 256 envs 多进程,4 GPU + LB,contexts iso | 类似 9 min | ~4s(早期) | ~1.4s | ~0.65s |

## 诊断命令

### 验证 vLLM 是否均衡

```bash
# nginx 反代多实例:每个 backend 直接采样
for p in 8003 8004 8005 8006; do
  curl -s "http://127.0.0.1:$p/metrics" | awk -v port=$p '
    /^vllm:num_requests_running/ {gsub(/[^0-9.]/,"",$NF); r=$NF}
    /^vllm:kv_cache_usage_perc/ {gsub(/[^0-9.]/,"",$NF); k=$NF*100}
    END {printf "  port=%s: run=%-5s kv=%4.1f%%\n", port, r, k}'
done
# 健康:4 个端口 run 接近,kv 都 < 80%
# 失衡:某端口 kv ~99% + 其他 ~10%

# 单 vLLM `--data-parallel-size N`:看 per-engine 标签
curl -s http://127.0.0.1:8003/metrics | grep -E "num_requests_running|kv_cache_usage_perc" | grep engine
```

### bench 侧每步耗时分解

```bash
grep "profile:" runs/.../shards/*/console.log | head -1
# 输出形如:
# [task.id] profile: reset=4.16s { wait_ready=4.16s { SIM=0.05s SIM_FS=0.10s OS=0.20s waitForData=3.81s } }
#   | warm=3.16s | init_obs=12.66s { screenshot=... route=... state=... }
#   | infer=21.5s { queue=0.0s exec=21.5s ttft=... decode=... }
```

`infer` 子阶段:
- `queue` 高(>1s) → asyncio thread pool 排队,调 `MOBILE_GYM_TO_THREAD_WORKERS`
- `exec` 高 + p95 远大于 median → vLLM 失衡或 KV 满
- `ttft` 高 → vLLM prefill 慢(prompt 太长或 batch 太大)
- `decode` 高 → 真在生成 token,模型瓶颈

`wait_ready` 子阶段:
- `SIM_FS` 高(>1s) → IDB 争用,换 contexts iso
- `waitForData` 高 → app 数据 fetch 慢,看 `__SIM__.waitForData` 实现
- `OS`/`SIM` 高 → React mount 慢,看渲染器是否被 CDP 流量打挤

## 已尝试无效的方法(避免下次重蹈)

| 尝试 | 结果 |
|---|---|
| 拆多个 Playwright Node(`MOBILE_GYM_BROWSERS_PER_NODE`) | p95 反而恶化,不解决任何瓶颈 |
| TMPDIR 重定向到非 /tmp | 磁盘不是瓶颈,改了无影响 |
| openai client 关掉 keepalive(`max_keepalive_connections=0`) | 不解决 vLLM DPLB 失衡(失衡在 vLLM 内部 lb 算法,不是 TCP 连接 stickying) |
| 客户端 infer 限流(semaphore) | 客户端排队不解决服务端失衡 |
| worker stagger `asyncio.sleep(wid * 0.05)` | 治标:256 envs 时 stagger 总 12.8s,纯浪费;真解决要拆进程 |
| 跨进程 stagger 2s | chromium 高并发下 init 60s+,2s 不够;contexts iso 之后 stagger 0 也行 |
| 砍 `--parallel 128` 当甜点 | 这是 "1 个 effective GPU" 状态下的最优;加 GPU 后 256 envs 才是真甜点 |

## 调优收益拆解

| 改动 | 单独贡献 |
|---|---|
| asyncio thread pool 1024 | 修 to_thread queue 17s 排队 |
| inotify 自适应 batch_sleep | 修 `--isolation browsers` 高并发崩溃 |
| 多进程 runner | warm/wait_ready 13s → 1s(消除 in-process burst) |
| **4× 独立 vLLM + nginx LB** | **infer 23s → 9s,真正破局**(消除 DPLB 失衡) |
| contexts iso (vs pages iso) | SIM_FS 2.6s → 1.5s |
| **总效果** | **17 min → 9 min,接近"= 最长任务时长"的理论下限** |

剩余 9 min ≈ 单条最长任务的 wallclock(60 步 × ~9s/步 ≈ 540s + 30s ramp/收尾),不是 bench 框架瓶颈。要再快只能砍 `max_steps` 或加 GPU 加快 per-step infer。
