# bench_env 多进程改造设计

> 状态：待实施
> 日期：2026-05-07
> 范围：`bench_env/runner/`、`bench_env/run.py`、`bench_env/config.py`

## 1. 背景

当前 `bench_env` 单进程 asyncio 并发：入口 `bench_env/run.py`，核心 `bench_env/runner/parallel.py`，进程内用 `EnvPool` 管 N 个 Playwright env。

实测扩展瓶颈出现在 single-process 高 N 场景：
- chromium init burst 撞 `fs.inotify.max_user_instances=128`（host 级别，无 sudo 不能调）
- 单 Node Playwright server 的 CDP dispatch 在 256 env 时 p95 变差
- TMPDIR 共享、单点 GC、单 asyncio loop 调度

当前 workaround 是 `run_multibench.sh` 在 shell 层拉 8 个独立 `bench_env.run` 进程，每进程 32 env。已实证拓扑稳定（参见 `docs/runbooks/bench-256-envs-slow.md`、`bench-inotify-limit.md`），但 shell 拉起的多进程方案有以下问题：
- 没有统一 run 目录、统一 summary、统一进度
- pass@k / rerun / resume 不支持跨 shard
- 错峰启动、分片切片、汇总解析全部硬编码在 shell

## 2. 目标

1. **把 shell 层的多进程编排内化成 Python**：一条 `python -m bench_env.run --processes K --parallel N ...` 完成，无需 `run_multibench.sh`。
2. **绕过单进程扩展瓶颈**：用 `--processes` 在 Python 层切多进程，每子进程独立持有 Playwright server + chromium 池，自然规避 single-process 共享资源（inotify / CDP / TMPDIR）。

## 3. 非目标

以下显式排除，不在本次改造范围：

- **跨进程 LLM 限流**。`infer_limiter` 是上限旋钮不是必需品；总在飞 LLM 请求 ≤ 总 env 数 = `--parallel N`，跟切几个进程无关。多进程下 vLLM 看到的并发不会被放大，需要 cap 时调 `--parallel` 或 per-proc limiter 即可。
- **per-env 进程粒度**。256 个 Python 解释器内存/IPC 成本不值得；本设计采用 per-shard 粒度（K 个进程，每进程 M env）。
- **动态任务队列**（父进程派发、子进程拉取）。MVP 用静态分片；如出现长尾再迭代。
- **Worker 崩溃重启**。MVP 选 fail-fast：shard 进程崩 → 该 shard 剩余 task 标记 ERROR，其他 shard 继续。restart 与 resume 的语义重合度高，YAGNI。
- **小规模 repeat_n>1 的 worker 利用率优化**。`repeat_n` 罕用且常见值 4/8，MVP 接受 task 粒度静态分片在 `task 数 < processes` 时的 worker 闲置。

## 4. 架构

```
父进程 (bench_env.run)
├── 加载 tasks（factory.load_tasks）
├── 静态分片：tasks → K 个 shard
├── 创建总 run 目录 runs/<run>/
├── spawn K 个子进程，每个跑现有 ParallelRunner
├── 通过 mp.Queue 接收子进程进度事件，驱动总 tqdm
├── wait + 监控 child.is_alive()
├── 实时 tail shards/pXX/results.jsonl → 顶层 results.jsonl / errors.jsonl
└── 计算总 summary.json（含 pass@k）

子进程 N (asyncio.run)
├── 收到 RunnerConfig + shard task ids + rank
├── 走现有 ParallelRunner.from_config 路径
├── results/errors/summary/console 写到 runs/<run>/shards/pXX/
├── trajectory/browser logs 直接写顶层共享目录
└── 每完成一个 episode → mp.Queue.put((rank, success/fail, task_id))
```

**关键约束**：

- 用 `multiprocessing.get_context("spawn")`，**不要 fork**。fork 已初始化的 Playwright/asyncio 状态会死锁。
- Browser/Page/Context **绝不**跨进程传递，只传 `RunnerConfig`、shard task ids、rank、`mp.Queue`。
- 父子进程**不共享 results/errors 文件句柄**：`RunRecorder` 当前只有 `threading.Lock`，多进程共享会写坏 jsonl。每个子进程的 recorder 独立写到 `shards/pXX/`，父进程按 offset 实时 tail 到顶层。`trajectory/` 和 `browser_logs/` 是按 task / shard 前缀命名的独立文件，可直接写顶层共享目录。

## 5. CLI 语义

```bash
python -m bench_env.run \
  --processes 8 \      # K=8 子进程，默认 1（退化为现有 ParallelRunner）
  --parallel 256 \     # N=总 env 并发，沿用旧语义
  --suite wechat \
  ...
```

- `--processes 1`（默认）：完全走当前 `ParallelRunner`，零行为变化。
- `--processes K > 1`：路由到 `MultiProcessRunner`；内部 `per_proc = ceil(N/K)`。
- 不引入 `--parallel-per-process`。`per_proc` 不暴露给用户，向下兼容性最好。
- `run_multibench.sh` 在改造完成后退役。

## 6. 输出布局

```
runs/<run>/
├── summary.json              ← 父进程合并写
├── results.jsonl             ← 父进程合并写
├── errors.jsonl              ← 父进程合并写
├── console.log               ← 父进程进度 + 子进程 fatal
├── meta.json                 ← 父进程写
├── trajectory/               ← 子进程直接写顶层共享目录
│   └── <task_id>/...
├── browser_logs/             ← 子进程直接写顶层共享目录（文件名带 pNN_ 前缀）
│   └── p00_browser_W0.log
└── shards/
    ├── p00/
    │   ├── results.jsonl
    │   ├── errors.jsonl
    │   ├── console.log
    │   ├── meta.json
    │   └── summary.json
    ├── p01/
    └── ...
```

**合并策略**：

- `results.jsonl` / `errors.jsonl`：父进程按 shard byte offset 实时 tail 完整 JSONL 行到顶层；结束时再补 missing-result ERROR。
- `summary.json`：父进程读所有 `shards/pXX/results.jsonl` 重新算（含 pass@k）；pass@k 计算逻辑从 `RunRecorder.finish_run` 抽出公共函数，避免与 `rerun.py` 继续复制。
- `trajectory/`：子进程通过 recorder 的 trajectory override 直接写顶层目录。task_id 在分片时已保证唯一（同 task 不跨 shard），不会冲突。
- `browser_logs/`：子进程通过共享 log dir + `pNN_` 文件名前缀直接写顶层目录，避免不同 shard 的 `browser_W0.log` 冲突。

## 7. IPC / 进度聚合

子进程 → 父进程通过 `mp.Queue` 推事件（轻量，每 episode 一条）：

```python
@dataclass
class ProgressEvent:
    rank: int
    task_id: str
    trial_id: int
    success: bool
    error: str | None
    kind: str = "episode"
```

父进程开一个后台线程消费 queue，更新单个总 tqdm（`✓N ✗M`）。子进程内部仍各自有 ParallelRunner 的 tqdm，落到各自 `shards/pXX/console.log` 不输出到终端（`disable=True` when MP mode）。

## 8. 失败处理

父进程主循环：

```python
while not all_done:
    for child in children:
        if not child.is_alive() and child.exitcode != 0:
            mark_remaining_tasks_as_error(child.rank)
    drain_progress_queue()
```

- shard 子进程异常退出（含 chromium 卡死把 asyncio loop 拖死的情况）→ 该 shard 已完成的 task 已经写入 jsonl，剩余 task 在父进程 `_finalize` 时按 shard 分配表标记为 `ERROR`。
- 父进程自己崩了 → 子进程 detect parent death（`os.getppid() == 1`）后清理 chromium 退出。MVP 不实现，依赖外层 `nohup` / shell trap。

## 9. repeat_n 行为

- 静态分片单元 = task。同一个 task 的所有 trial 落在同一个 shard。
- 子进程内部沿用现有 `_run_with_repeat`：trial 0 worker 采样 params 后 dispatch trial 1..N-1 到 shard 内部 queue，无跨进程协调。
- **已知 limitation**：当 `len(tasks) < processes` 且 `repeat_n > 1` 时，部分 shard 没活干。`repeat_n` 罕用且这种小规模 case 不在意 wallclock；接受。

## 10. 实施顺序

1. **抽公共函数**：把 `RunRecorder.finish_run` 里 summary/pass@k 计算逻辑抽到 `bench_env/metrics.py`（或现有位置），让 `rerun.py` 和未来的 `MultiProcessRunner._finalize` 复用。先做这步是为了避免合并阶段出现第三份 pass@k 实现。
2. **核对 `rerun.py`**：决定是 (a) 父进程合 results.jsonl 后 rerun 走老路径（推荐，假设 rerun 只读顶层 jsonl），还是 (b) rerun 学会读 shards/。本步只看代码、不改。
3. **新增 `bench_env/runner/multiprocess.py`**：`MultiProcessRunner` 类，spawn 子进程、维护 mp.Queue 进度、is_alive 监控、`_finalize` 合并。子进程入口是一个 module-level 函数 `_shard_main(config, task_ids, rank, progress_queue, run_dir)`，内部 `asyncio.run(ParallelRunner.from_config(config_with_shard_tasks).run())`。
4. **`RunnerConfig` 加 `processes: int = 1`**，从 args 解析。
5. **`run.py` 路由**：`args.processes > 1` 走 MultiProcessRunner，否则现有路径不变。
6. **Smoke test**：`--task-ids A,B,C,D --processes 2 --parallel 4 --no-save-trajectory`，验证 (a) 总 results 数 = 4，(b) summary.json 正确，(c) shard 1 kill -9 后 shard 0 仍正常完成、shard 1 的 task 标记 ERROR。
7. **退役 `run_multibench.sh`**：在 README 加迁移说明，原命令等价于 `--processes 8 --parallel 256`。

## 11. 验收

- `--processes 1` 行为与现在 100% 一致（regression 守门）。
- `--processes 8 --parallel 256` 跑 wechat suite，wallclock ≤ `run_multibench.sh` 同等配置（不要求严格更快，但不能更慢）。
- 父进程 SIGINT 能干净停所有子进程（trap → `child.terminate()`）。
- 一个子进程 OOM kill 不影响其他 shard 完成。

## 12. 风险

- **`spawn` 启动慢**：每个子进程要重新 import 整个 `bench_env`（含 numpy/playwright 等大依赖）。8 进程 × ~3s import = 24s 总启动延迟（并行启，实际墙钟 ~3s）。可接受。
- **共享 artifact 目录命名冲突**：trajectory 依赖 task id/trial id 唯一；browser logs 依赖 shard 前缀（`pNN_`）避免 worker id 重名。
- **mp.Queue 在子进程崩溃时遗留消息**：父进程 drain 时用 `get(timeout=0.1)`，跳过空。
- **monitor (`config.monitor`) 在 MP 模式下**：父进程统一跑 monitor（监控总进度 + 资源），子进程在 MP mode 下 `_start_monitor` no-op。子进程 ParallelRunner 已经写各自 console.log，monitor 重复跑无收益。

## 13. 未来扩展（不在本次范围）

- 动态任务队列：父进程持有 work queue，shard worker 完成 task 后拉新的，解决长尾。
- 跨主机分布式：把 mp.Queue 换成 Redis/ZeroMQ。
- per-env 子进程：`--processes auto` 配合 `--parallel 1` 自动等价。
