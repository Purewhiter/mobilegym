# Bench 启动失败:inotify max_user_instances 限制

**适用场景**:`bench_env` 用 `--parallel ≥ 192`(单 bench)或多 bench 紧密同时启动时,大量 episode 报 `_wait_ready phase=__SIM__ timeout`,但 CPU、GPU、网络、磁盘看起来都不饱和。

## 症状

错误日志(出现在 `errors.jsonl`):

```
RuntimeError: [WN][page#1] _wait_ready phase=__SIM__ timeout:
  TimeoutError: Page.wait_for_function: Timeout 60000ms exceeded.
```

诊断特征(共同满足):

- **CPU 利用率 ~10%**(`load1` 远低于核数)
- **Playwright Node 主进程 CPU < 20%**
- **每个 chromium 子进程 CPU ~10%**(都在等什么,不是被 CPU 卡住)
- **上游服务(nginx / vLLM / 任何代理)各自 CPU 都 < 10%**
- **关掉 `--proxy` 直连 nginx 仍然炸**
- **`fast-reset` 过的 envs 不够 60s mount 完成**
- **`_wait_ready` 卡在第一阶段**(等 `window.__SIM__` 和 `__SIM__.getState`)

整体观感:**系统资源全都空闲,但页面就是 mount 不出来**。

## 根因

Linux kernel 限制每个 user(uid)同时持有的 inotify instance 总数:

```bash
cat /proc/sys/fs/inotify/max_user_instances
# 老内核默认 128,部分发行版 1024
```

每个 headless chromium browser 在启动时会**至少创建 1 个 inotify instance**(用于 file watcher / extension reload / DNS resolver config 监听等)。当一个用户名下并发的 chromium 数 > 此 limit 时,后续 `inotify_init()` 返回 `EMFILE`,chromium 内部相关子系统进入**静默 retry 路径**,不抛错只阻塞,导致 `__SIM__` 暴露被推迟数十秒。

### 为什么"看起来什么都没忙"

- `EMFILE` 不是 CPU bound,chromium 在等 inotify 释放 → 进程 sleep → load average 不涨
- 错误隐式重试,console 没输出,只能从 60s 后 timeout 看出问题
- nginx/vLLM 等下游服务因为请求根本没发出来,自然空闲

### 为什么时间分布有方差

实测一次 256-env 失败中:

| Worker | Seed import 完成耗时 | 结果 |
|---|---|---|
| W3 | 22 秒 | ✅ 成功 |
| W7 | 66 秒 | ❌ 超 60s timeout |

成功的 worker 是早期"抢到"inotify instance 的;失败的 worker 是触发 EMFILE 后多次 retry 才走通。

## 诊断命令

**bench 跑炸的瞬间**(或 ramp 期),另开 shell 运行:

```bash
find /proc/*/fd -lname 'anon_inode:inotify' 2>/dev/null | wc -l
```

- 数字 ≈ `max_user_instances`(如 128) → **就是这个问题**
- 数字 << limit → **不是 inotify**,看其他 runbook 或加 `console.time` 排查

闲时此命令应该是 < 50。

## 跨主机验证

同样代码、同 `--parallel 256`:

| host | `max_user_instances` | 结果 |
|---|---|---|
| host A(低默认值) | 128 | 大量 timeout 失败 |
| host B(已 bump) | 8192 | 跑通 |

确认是 sysctl 差异导致。

## 修复

按代价排序。

### 治本:管理员 bump sysctl(推荐,有 sudo 时)

```bash
# 临时(重启失效)
sudo sysctl -w fs.inotify.max_user_instances=8192

# 持久化
echo "fs.inotify.max_user_instances = 8192" | sudo tee /etc/sysctl.d/99-mobile-gym.conf
sudo sysctl --system
```

**理由**:128 是 1990s 桌面年代默认。Ubuntu 22.04+ 默认 1024,大多数 ML/CI prod 调到 8192-524288。仅是 kernel hash table 预分配上限,**无安全顾虑**。

### Workaround 1:错峰启动多 bench

把一个大 bench 拆成几个小 bench,每段 ≤ 80 envs,启动间隔 ≥ 60s。前一个 bench 已过 ramp 后,inotify 占用稳定不再增长,新 bench 不会撞上限。

```bash
#!/bin/bash
# 总 240 envs,但同时 ramp 的 ≤ 80
python -m bench_env.run --parallel 80 --runs-dir runs/part1 ... &
sleep 60
python -m bench_env.run --parallel 80 --runs-dir runs/part2 ... &
sleep 60
python -m bench_env.run --parallel 80 --runs-dir runs/part3 ... &
wait
```

完成后合并三份 `results.jsonl` / `summary.json`。

### Workaround 2:多账号并行

inotify limit 是 **per-uid**,uidA 和 uidB 各自独立 128。两个用户分别跑两个 bench,容量翻倍。需要机器上有可登的额外账号。

### ❌ user namespace 不能绕

**早期错以为可以,实际不行**:

```bash
unshare --user --map-root-user --fork bash
sysctl -w fs.inotify.max_user_instances=8192
# permission denied
```

`fs.inotify.max_user_instances` 修改需要 `CAP_SYS_RESOURCE` **在 init namespace** 里,user NS 只给子 NS 内的 capability。新 NS 继承父 NS 的 limit,只能往下不能往上。

## 已尝试无效的修复(代码里仍保留,中性)

debug 这个 case 的过程中先后试过下面这些,**都不解决问题但保留为中性改动**(下次别再重复测):

- **TMPDIR 重定向到用户 cache 目录**(`bench_env/env/pool.py`)— 怀疑 `/tmp` 空间不足导致 IDB 写慢,实测无效。chromium user-data-dir 现在在用户 cache 下的 `mobile-gym/playwright_tmp/`
- **Worker 错峰启动**(`bench_env/runner/parallel.py`)— `await asyncio.sleep(wid * 0.05)`,把首次 reset 摊到 12.8s 窗口。无效但保留以防真有 asyncio 同步 fan-out 问题
- 其他打过脸的猜测(都不是因):Playwright Node 单进程瓶颈、nginx accept queue、上游代理拥塞、per-browser network process serialize、孤儿 chromium 累积

诊断这条 case 花了大半个工作流。下次遇到完全一样的症状直接来这里。

## 相关

- [bench_env/docs/performance.md](../../bench_env/docs/performance.md) — bench 整体性能基准与已知瓶颈
- [bench_env/env/pool.py](../../bench_env/env/pool.py) — chromium 启动 + TMPDIR 设置
- [bench_env/runner/parallel.py](../../bench_env/runner/parallel.py) — worker 错峰逻辑
- [bench_env/env/mobile_gym.py:1255](../../bench_env/env/mobile_gym.py#L1255) — `_wait_ready` 的 60s timeout
