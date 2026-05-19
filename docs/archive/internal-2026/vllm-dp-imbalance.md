# vLLM `--data-parallel-size` 在长 stream 工作负载下严重失衡

## 一句话问题

vLLM 0.17 用 `--data-parallel-size 2`(默认 `--api-server-count 2`)对外暴露**单个**端口,内部期望 DPLB 把请求均分到 N 个 engine。**实际上长 stream 工作负载下 e0:e1 比例可能稳定在 1:13**,一张 GPU 满载到 KV 99%+ preempt,另一张闲在 KV 10%。整体吞吐相当于只有 1 张卡。

## 症状

```bash
curl -s http://127.0.0.1:8003/metrics | grep -E "num_requests_running|kv_cache_usage_perc" | grep engine
```

输出长这样(stable 持续观察 30s+ 不变):
```
vllm:num_requests_running{engine="0"} 9.0
vllm:num_requests_running{engine="1"} 108.0
vllm:kv_cache_usage_perc{engine="0"}  0.116
vllm:kv_cache_usage_perc{engine="1"}  0.995
```

bench 侧表现:
- 加并发不再线性提速(256 envs 比 128 envs 没快多少)
- `infer` 中位数随并发线性恶化(64 → 256 envs 时 +50%)
- `infer` p95/median 比 ≥ 3,长尾远高于中位
- nvidia-smi 看 vLLM 占的 2 张卡 GPU util 都接近 100%(并不能从这看出失衡,要看 KV)

## 根因

vLLM 0.17 的 `DPLBAsyncMPClient`([core_client.py:1328](https://github.com/vllm-project/vllm/blob/main/vllm/v1/engine/core_client.py)):
- `--data-parallel-size N` 默认会同时把 `--api-server-count` 也设成 N
- N 个 API server 进程都监听同一端口(SO_REUSEPORT)
- **每个 API server 独立维护一份本地 lb 状态**,通过 zmq 100ms 间隔同步
- 选 engine 的算法 `score = waiting * 4 + running`,选最低
- 每个 API server 有 `eng_start_index`(API-A 偏 e0,API-B 偏 e1)

理想情况各 API server 把对应偏好 engine 的流量倾向自己关心的 engine,合起来均衡。**但**:
1. 内核 SO_REUSEPORT 把 TCP 连接按 4-tuple hash 分给某个 listener,不均衡(实测 35:65 偏向)
2. 每个 API server 看自己的本地状态做决策,**看不到对方刚刚路出去多少请求**
3. 长 stream 请求一旦进了某个 engine,会占住 KV 5-15s 不释放
4. 100ms 同步周期对 5-15s 长请求来说是几乎"看不到"对方在干啥

结果:大约 35% 流量进 API-A → 全去 e0;65% 流量进 API-B → 全去 e1。**API server 之间完全无视对方的存在**,只在本地 lb 状态里看到自己路了多少请求,选择"自己负责的 engine"。

## 修法

### 方案 A:`--api-server-count 1`(最小改动,未实验证)

```bash
vllm serve <model> --data-parallel-size 2 --api-server-count 1 ...
```

理论上 1 个 API server 就有完整 lb 视图。**风险**:1 个 Python event loop 处理所有连接,可能在 250+ 并发 stream 下 CPU-bound。回退成本 0,值得先试。

### 方案 B:N 个独立 vLLM 实例 + nginx least_conn(已验证 ✓)

```bash
# 1) 起 N 个独立 vLLM,DP=1,各占一卡
for i in 0 1 2 3; do
  PORT=$((8003 + i))
  CUDA_VISIBLE_DEVICES=$i \
    nohup vllm serve <model> \
      --max-model-len 32768 --port "$PORT" \
      --served-model-name <name> --gpu-memory-utilization 0.9 \
      > /tmp/vllm_gpu${i}.log 2>&1 &
done

# 2) nginx 在 8002 做 least_conn 反代(关键 SSE 设置:proxy_buffering off)
# 见 docs/runbooks/bench-256-envs-slow.md 完整 nginx 配置
```

bench 客户端 `--model-base-url http://127.0.0.1:8002/v1`。

**实测**:4 张卡 256 envs 完美均衡,4 端口 run 各 ~50,kv 各 ~25%,e2e 4-9s 稳定。

### 方案 C:`--data-parallel-external-lb` + 客户端轮询

vLLM 起 1 个 API server 但走"外部 LB"模式,client 自己轮询多个 dp_rank-specific endpoint。需要改 [bench_env/llm/openai_chat.py](../../bench_env/llm/openai_chat.py) 加 N 个 base_url。**不推荐**:污染 client,且 client 轮询不如 nginx least_conn 智能。

## 诊断命令

```bash
# 跑期间多次采样 vLLM /metrics,看是否稳定失衡
for i in 1 2 3 4 5; do
  curl -s http://127.0.0.1:8003/metrics | awk '
    /^vllm:num_requests_running\{engine="0"/ {gsub(/[^0-9.]/,"",$NF); r0=$NF}
    /^vllm:num_requests_running\{engine="1"/ {gsub(/[^0-9.]/,"",$NF); r1=$NF}
    /^vllm:kv_cache_usage_perc\{engine="0"/ {gsub(/[^0-9.]/,"",$NF); k0=$NF*100}
    /^vllm:kv_cache_usage_perc\{engine="1"/ {gsub(/[^0-9.]/,"",$NF); k1=$NF*100}
    END {printf "  e0 run=%s kv=%.1f%% | e1 run=%s kv=%.1f%%\n", r0, k0, r1, k1}'
  sleep 5
done
```

判读:
- 两个 engine `run` 在 ±20% 内 → 健康
- 一个 engine `kv` ≥ 95% 持续 30s+ + 另一个 < 30% → 严重失衡,DPLB 失效

## 已尝试无效的方法

| 尝试 | 结果 |
|---|---|
| 客户端关 keepalive(`max_keepalive_connections=0`) | 不解决:Apache server 端连接和 engine 路由是两回事;TCP 连接 hash 分到 API server,DPLB 决策再分到 engine,失衡发生在 DPLB 层 |
| 客户端 stream + 短连接 | 同上 |
| 增加 vLLM `--max-num-seqs` 限流 | 不影响路由,只是改单 engine 容量 |
| 重启 vLLM | 失衡是 routing 算法问题,不是状态问题 |

## 验证均衡修复后效果

切到方案 B 后 256 envs bench:

| 指标 | 失衡(2 GPU 实际等于 1 卡) | 均衡(4 GPU + LB) |
|---|---|---|
| infer median | 23.39s | **9.16s** |
| infer p95 | 64.73s | **15.44s** |
| 各 GPU KV | 一张 99% / 另一张 10% | 4 张都 25% |
| 总耗时(256 ep) | 17 min | **9 min** |
