# bench_env - Mobile GUI Agent Benchmark Environment

一个清晰的移动端 GUI Agent 评测框架，采用标准化的 Agent-Environment-Runner 架构。

## 架构设计

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Runner Layer                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ ExecRunner  │  │SerialRunner │  │ParallelRunner│  │MultiProcess  │       │
│  └─────────────┘  └─────────────┘  └──────────────┘  └──────────────┘       │
│         │                │                 │                  │             │
│         └────────────────┴─────────────────┴──────────────────┘             │
│                          │                                                   │
│                    run_episode()                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────┐          ┌──────────────────────────┐         │
│  │         Agent            │          │       Environment        │         │
│  ├──────────────────────────┤          ├──────────────────────────┤         │
│  │ 类属性:                  │          │                          │         │
│  │   SYSTEM_PROMPT          │          │  reset(app_ids) → Obs    │         │
│  │   ACTION_MAP             │          │  step(action) → Result   │         │
│  │   DEFAULT_MODEL_ARGS     │          │  step(action) → Result   │         │
│  │                          │          │                          │         │
│  │ 必须实现:                │   obs    │  内部封装:               │         │
│  │   build_messages(obs)   ←├──────────┤    - Playwright 操作     │         │
│  │   parse_response(text)   │          │    - 状态管理            │         │
│  │   act(obs) → Action     ─┼──────────→    - Judge 逻辑          │         │
│  │                          │  action  │                          │         │
│  └──────────────────────────┘          └──────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 核心流程

```python
# Runner 内部的 run_episode 流程（简化版）
obs = await task.setup(env)           # 重置环境 + 打开 App + 准备环境 + 采样参数
agent.reset(task.description)
while not done and steps < max_steps:
    action = agent.act(obs)           # Agent 决策
    result = await env.step(action)   # Environment 执行
    obs, done = result.observation, result.done
    if action.is_info and not done:   # INFO：Agent 向用户提问
        agent.add_user_comment(reply)
judge = evaluator.evaluate(           # 评测（自动选择 state / VLM）
    task, init_obs, last_obs, exec_result, episode
)
```

## 快速开始

### 环境准备

```bash
pip install -r bench_env/requirements.txt
playwright install chromium
```

### 命令行使用

```bash
# 查看所有可用任务
python -m bench_env.run --list
python -m bench_env.run --list --suite wechat
python -m bench_env.run --list --suite wechat --list-md docs/wechat_tasks.md

# 在线渲染任务文案（读取模拟器 __SIM__.getState()，始终无头，不弹浏览器窗口）
python -m bench_env.run --list --list-online --env-url http://localhost:3000
python -m bench_env.run --list --suite railway12306 --list-online --env-url http://localhost:3000 --list-md docs/railway12306_tasks.md

# 单任务评测
python -m bench_env.run \
    --task-id wechat.ReadMyWxid \
    --env-url http://localhost:3000 \
    --model-base-url http://14.103.173.234:8003/v1 \
    --model-name autoglm \
    --agent autoglm

# 批量评测（结果自动保存到 runs/{timestamp}/）
python -m bench_env.run \
    --suite wechat \
    --env-url http://localhost:3000 \
    --model-base-url http://14.103.173.234:8001/v1 \
    --model-name gelab-zero \
    --agent gelab

# 并行评测（8 个 worker）
python -m bench_env.run \
    --suite wechat \
    --parallel 8 \
    --isolation pages \
    --env-url http://localhost:3000 \
    --model-base-url http://14.103.173.234:8003/v1 \
    --model-name autoglm \
    --headless \
    --agent autoglm

# 多进程并行评测（总并发 256，拆成 8 个 Python shard，每个 shard 32 env）
python -m bench_env.run \
    --suite wechat \
    --processes 8 \
    --parallel 256 \
    --browsers 16 \
    --isolation contexts \
    --env-url http://localhost:4173 \
    --model-base-url http://14.103.173.234:8003/v1 \
    --model-name autoglm \
    --headless \
    --agent autoglm

# 参数采样（每个任务采样 3 个不同参数实例，用于测试任务泛化性）
python -m bench_env.run \
    --suite wechat \
    --sample-n 3 \
    --sample-seed 42 \
    --parallel 8 \
    --env-url http://localhost:4173 \
    --model-base-url http://14.103.173.234:8003/v1 \
    --model-name autoglm \
    --headless \
    --agent autoglm

# Pass@k 评测（每个任务重复 8 次，计算 pass@1 和 pass@8）
python -m bench_env.run \
    --suite wechat \
    --parallel 32 \
    --isolation browsers \
    --repeat-n 8 \
    --env-url http://localhost:4173 \
    --model-base-url http://14.103.173.234:8003/v1 \
    --model-name autoglm \
    --headless \
    --agent autoglm

# 自定义 pass@k 值
python -m bench_env.run \
    --suite wechat \
    --repeat-n 10 \
    --pass-k 1,5,10 \
    --parallel 32 \
    --isolation browsers \
    --env-url http://localhost:4173 \
    --model-base-url http://14.103.173.234:8003/v1 \
    --model-name autoglm \
    --headless \
    --agent autoglm

python -m bench_env.run \
    --suite wechat \
    --parallel 18 \
    --isolation pages \
    --env-url http://localhost:4173 \
    --model-base-url http://api.yourapi.cn/v1 \
    --model-api-key YOUR_API_KEY \
    --model-name gemini-3-flash-preview \
    --headless \
    --agent generic_v2

python -m bench_env.run \
    --suite wechat \
    --parallel 18 \
    --isolation pages \
    --env-url http://localhost:4173 \
    --model-base-url https://open.bigmodel.cn/api/paas/v4  \
    --model-name autoglm-phone \
    --model-api-key YOUR_API_KEY \
    --headless \
    --agent autoglm

# 人类操作模式
python -m bench_env.run \
    --task-id wechat.ReadMyWxid \
    --agent human \
    --env-url http://localhost:3000

# 自由执行（无 judge）
python -m bench_env.run \
    --exec "打开小红书查看我的昵称是什么" \
    --env-url http://localhost:3000 \
    --agent autoglm \
    --model-base-url http://14.103.173.234:8003/v1 \
    --model-name autoglm
```

### 使用任务 Split (`--split`)

`bench_env/splits/` 下的 txt 文件是任务 id 白名单，用 `--split` 可以把任何命令（list / run / rerun / resume / prune）限制到某个子集。当前内置：`train` / `test` / `payment` / `high_risk`（即 `bench_env/splits/*.txt`）。

`--split` 与 `--suite` / `--filter-*` / `--task-ids` 是 **AND** 组合。

```bash
# 查看某个 split 里的任务
python -m bench_env.run --list --split test

# 只跑 test split
python -m bench_env.run \
    --split test \
    --env-url http://localhost:3000 \
    --agent autoglm \
    --model-base-url http://14.103.173.234:8003/v1 \
    --model-name autoglm

# 多 split 并集（| 号分隔用 +）
python -m bench_env.run --split test+payment --env-url ... --agent ...

# 外部白名单文件（每行一个 task_id）
python -m bench_env.run --split /path/to/my_ids.txt --env-url ...

# rerun / resume / prune 都支持 --split；不传时默认继承 meta.json 里记录的 split。
# 注意各命令对 CLI --split 的处理**不同**：
#   - rerun:  在老 results.jsonl 上再过滤；实际 = meta.split ∩ cli.split（老结果已被 meta.split 限制过）
#   - resume: 在 meta.split 产出的待跑集合上再 AND；若 cli.split 与 meta.split 不相交会得到空集
#   - prune:  cli.split 直接接管 meta.split——典型用途是"原 run 跑的是全集，现在想把 results.jsonl 缩到 test 子集"
python -m bench_env.run --rerun  runs/xxx                   # 继承 meta
python -m bench_env.run --resume runs/xxx --split test      # 进一步收窄到 meta.split ∩ test
python -m bench_env.run --prune  runs/xxx --split test      # 删掉 test 白名单以外的条目，让 run 只剩 test 的结果
```

### 清理旧结果 (`--prune`)

当任务被删除/改名或你想把某个 run 的结果缩到某个 split 上时，用 `--prune` 清理 `results.jsonl` + 对应的 trajectory 目录：

```bash
# 清掉 task 已在代码里被删除的孤儿条目
python -m bench_env.run --prune runs/xxx --dry-run
python -m bench_env.run --prune runs/xxx

# 只保留某个 split 的结果（valid = registry ∩ split）
python -m bench_env.run --prune runs/xxx --split test
```

> `--prune-orphans` 是旧名，已弃用但仍可用；请改用 `--prune`。

### 编程使用

```python
import asyncio
from bench_env import SerialRunner, ParallelRunner
from bench_env.config import RunnerConfig
from bench_env import factory

# 1. 创建配置
config = RunnerConfig(
    agent="generic_v2",
    model_name="gpt-4o",
    model_base_url="http://api.example.com/v1",
    env_url="http://localhost:4173",
    max_steps=10,
    suite=["wechat"]
)

# 2. 串行评测
async def run_serial():
    # 使用 factory 加载组件（推荐）
    tasks = factory.load_tasks(config)
    env = await factory.create_env(config)
    agent = factory.create_agent(config, factory.create_llm(config))
  
    # 实例化 Runner
    runner = SerialRunner(env, agent, tasks, config)
    results = await runner.run()
    return results

asyncio.run(run_serial())
```

## Real Device Support

bench_env supports running agents on real Android devices or standard emulators via ADB.

### Usage

```python
from bench_env.env import RealDeviceEnv
from bench_env import RunnerConfig, SerialRunner

# Configure for real device
config = RunnerConfig(
    agent="autoglm",
    model_name="autoglm-phone",
    # ... other model params
)

# Initialize RealDeviceEnv
env = RealDeviceEnv(
    device_serial="emulator-5554",  # Run `adb devices` to get serial
    adb_path="adb",                 # Path to adb executable
    coord_space="norm_0_1000",      # Coordinate space for agent
)

# Run tasks
runner = SerialRunner(env, agent, tasks, config)
await runner.run()
```

### Limitations

The `RealDeviceEnv` is currently a **lightweight implementation** with the following limitations compared to `MobileGymEnv` (simulator):

* **Observation**: Visual only (screenshots). No JSON state or ViewHierarchy XML is provided.
* **Current App**: Supports detecting the current foreground app via `adb shell dumpsys window`. The app name is returned in `observation.route["app"]` (e.g., "微信", "Chrome") if recognized from the built-in `APP_PACKAGES` mapping.
* **Evaluation**: Since there is no ground-truth JSON state, the framework automatically uses **VLM-based evaluation** (see below).
* **Text Input**: Supports Chinese and Unicode text input via YADB (auto-installed on first run).
* **Performance**: Slower than simulator due to ADB screenshot transfer latency.

### VLM Evaluation (VLM 评估)

真机环境没有 JSON 状态数据，框架会自动使用 VLM（视觉语言模型）来评估任务完成情况。

#### 使用方式

```bash
# 真机评估（自动启用 VLM judge）
python -m bench_env.run \
    --task-id wechat.ReadMyWxid \
    --device real \
    --model-base-url http://14.103.173.234:8003/v1 \
    --model-name autoglm \
    --agent autoglm

# 模拟器强制使用 VLM 评估
python -m bench_env.run \
    --task-id wechat.ReadMyWxid \
    --env-url http://localhost:3000 \
    --judge-mode vlm \
    --model-base-url http://14.103.173.234:8003/v1 \
    --model-name autoglm \
    --agent autoglm

# 使用不同模型做评估（Agent 用 autoglm，评估用 gpt-4o）
python -m bench_env.run \
    --task-id wechat.ReadMyWxid \
    --device real \
    --model-base-url http://14.103.173.234:8003/v1 \
    --model-name autoglm \
    --agent autoglm \
    --judge-model gpt-4o \
    --judge-base-url https://api.openai.com/v1 \
    --judge-api-key sk-xxx

python -m bench_env.run \
    --task-id wechat.SetAddMeSearch \
    --device real \              
    --model-base-url http://14.103.173.234:8003/v1 \
    --model-name autoglm \
    --agent autoglm --judge-mode vlm \
    --judge-model qwen-vl-max-latest \
    --judge-base-url https://dashscope.aliyuncs.com/compatible-mode/v1/ \
    --judge-api-key "$JUDGE_API_KEY"
```

#### 参数说明

| 参数                 | 默认值                  | 说明                                                                       |
| -------------------- | ----------------------- | -------------------------------------------------------------------------- |
| `--judge-mode`     | `auto`                | 评估模式：`state`（状态匹配）、`vlm`（VLM 视觉）、`auto`（自动选择） |
| `--judge-model`    | 同 `--model-name`     | VLM 评估使用的模型                                                         |
| `--judge-base-url` | 同 `--model-base-url` | VLM API 地址                                                               |
| `--judge-api-key`  | 同 `--model-api-key`  | VLM API key                                                                |

#### 评估原理

VLM 评估基于 Agent 的完整执行轨迹（截图序列 + 动作），判断：

1. **success**: 任务目标是否达成
2. **clean**: 执行过程是否有非预期的副作用

#### 输出文件

VLM 评估会保存完整的 prompt 和 response 用于调试：

```
runs/20260202_xxx/trajectory/wechat_ReadMyWxid/
├── trajectory.json
├── step_001.png
├── step_002.png
├── vlm_judge_prompt.json    # VLM 评估 prompt（图片已替换为占位符）
└── vlm_judge_response.txt   # VLM 原始响应
```

---

## Configuration (RunnerConfig)

The `RunnerConfig` class provides a unified way to configure the benchmark.

| Parameter              | Default           | Description                                                      |
| ---------------------- | ----------------- | ---------------------------------------------------------------- |
| `agent`              | `generic_v2`    | Agent identifier (e.g.,`autoglm`, `generic`, `generic_v2`) |
| `model_name`         | -                 | LLM model name                                                   |
| `model_base_url`     | -                 | LLM API base URL                                                 |
| `model_api_key`      | -                 | LLM API key (optional for local endpoints)                       |
| `temperature`        | `0.0`           | LLM temperature                                                  |
| `top_p`              | `1.0`           | LLM top_p                                                        |
| `max_tokens`         | `4096`          | LLM max tokens                                                   |
| `no_stream`          | `False`         | Disable streaming for LLM                                        |
| `device`             | `sim`           | Device type:`sim` (simulator) or `real` (ADB)                |
| `env_url`            | -                 | Simulator URL (required for sim mode)                            |
| `device_serial`      | -                 | ADB device serial (for real device mode)                         |
| `headless`           | `False`         | Run simulator in headless mode                                   |
| `proxy`              | -                 | Browser proxy server (e.g. `http://127.0.0.1:7890`)            |
| `coord_space`        | `norm_0_1000`   | Coordinate space (`norm_0_1000`, `norm_0_1`, `physical`)   |
| `delay_after_action` | `1.0`           | Wait time (seconds) after each action                            |
| `max_steps`          | 自适应          | Maximum steps per episode (未显式指定时按任务难度自适应，见下文) |
| `quiet`              | `False`         | Suppress INFO logs                                               |
| `task_id`            | -                 | Run specific task by ID (e.g.,`wechat.ReadMyWxid`)           |
| `suite`              | -                 | Filter tasks by suite(s), comma-separated (e.g. `wechat,redbook`)  |
| `sample_n`           | -                 | Sample N instances per task                                      |
| `sample_seed`        | -                 | Random seed for task sampling                                    |
| `split`              | -                 | Restrict tasks to a whitelist: `<name>`, `<name>+<name>`, or path to .txt (see `bench_env/splits/`) |
| `list_online`        | `False`         | For `--list` only: load `__SIM__.getState()` from `--env-url` for online rendering; always headless |
| `repeat_n`           | `1`             | Repeat each task N times for pass@k evaluation                   |
| `pass_k`             | `[1, n]` if n>1 | K values for pass@k metrics (auto: pass@1 and pass@n)            |
| `runs_dir`           | `runs`          | Directory to save results                                        |
| `no_save_trajectory` | `False`         | Disable trajectory saving                                        |
| `screenshot_scale`   | `0.3`           | Screenshot scale factor (0.3 = 30% of original)                  |
| `parallel`           | `1`             | Number of parallel workers                                       |
| `processes`          | `1`             | Python shard processes; when >1, `parallel` is total concurrency split across shards |
| `isolation`          | `pages`         | Isolation level:`pages`, `contexts`, `browsers`            |
| `judge_mode`         | `auto`          | Evaluation mode:`state`, `vlm`, `auto`                     |
| `judge_model`        | -                 | VLM model for evaluation (default: same as `model_name`)       |
| `judge_base_url`     | -                 | VLM API URL (default: same as `model_base_url`)                |
| `judge_api_key`      | -                 | VLM API key (default: same as `model_api_key`)                 |
| `eval_mode`          | `text`          | Answer evaluation mode: `text` (legacy match_value) or `grounded` (answer_sheet UI) |

**自适应 max_steps**：当用户未显式指定 `--max-steps` 时，系统根据任务的 `difficulty` 自动调整每个 episode 的最大步数：

| 难度   | max_steps |
| ------ | --------- |
| `L1` | 15        |
| `L2` | 30        |
| `L3` | 45        |
| `L4` | 60        |

在 `grounded` 模式下，声明了 `answer_fields` 的任务会额外增加 15 步（用于打开答题卡、填写答案并提交）。

显式传入 `--max-steps` 会覆盖此机制，所有任务统一使用指定值。

`--list-online` 仅影响任务列表渲染，不会改变正常评测流程；未传该开关时，`--list` 始终使用离线默认值渲染。传入 `--list-online` 时必须同时提供 `--env-url`。

---

## 环境动作空间 (ActionType)

环境支持的标准动作类型，所有 Agent 的动作最终都会映射到这些类型：

| 动作类型       | 说明                       | 参数                                   |
| -------------- | -------------------------- | -------------------------------------- |
| `CLICK`      | 点击                       | `point: [x, y]`                      |
| `DOUBLE_TAP` | 双击                       | `point: [x, y]`                      |
| `LONG_PRESS` | 长按                       | `point: [x, y]`                      |
| `TYPE`       | 输入文本                   | `value: str`, `point?: [x, y]`     |
| `SWIPE`      | 滑动（带惯性）             | `point1: [x, y]`, `point2: [x, y]` |
| `DRAG`       | 拖动（长按后移动，无惯性） | `point1: [x, y]`, `point2: [x, y]` |
| `BACK`       | 返回键                     | -                                      |
| `HOME`       | 主页键                     | -                                      |
| `RECENT`     | 最近任务键                 | -                                      |
| `ENTER`      | 回车键                     | -                                      |
| `WAIT`       | 等待                       | `value: seconds`                     |
| `AWAKE`      | 启动应用                   | `value: app_id`                      |
| `ANSWER`     | 提交答案（不终止）         | `value: answer`                      |
| `COMPLETE`   | 完成任务                   | `return: message`                    |
| `ABORT`      | 放弃任务                   | `value: reason`                      |
| `INFO`       | 向用户提问                 | `value: question`                    |
| `NOOP`       | 无操作                     | -                                      |

## 坐标空间与物理坐标映射（coord_space）

环境执行动作时会把 `Action.data` 里的坐标转换为**物理像素坐标**（`physical_px`），并在 verbose 日志里输出“输入坐标 → 物理像素”的映射。

支持三种坐标空间（`--coord-space`）：

- **`norm_0_1000`（默认）**：归一化坐标 \(x,y \in [0,1000]\)
  - 映射：\(x_{px} = x/1000 \cdot W,\ y_{px} = y/1000 \cdot H\)
- **`norm_0_1`**：归一化坐标 \(x,y \in [0,1]\)
  - 映射：\(x_{px} = x \cdot W,\ y_{px} = y \cdot H\)
- **`physical`**：物理像素坐标（直接使用）
  - 映射：\(x_{px} = x,\ y_{px} = y\)

其中 \(W,H\) 为设备物理分辨率（默认 1080×2400）。所有坐标在转换后都会 clamp 到屏幕范围内。

## 实现新任务

### 1. 继承选择

根据任务类型，从 `bench_env.task.common_tasks` 选择合适的基类：

| 基类             | 用途       | 适用场景                                                                             |
| ---------------- | ---------- | ------------------------------------------------------------------------------------ |
| `CriteriaTask` | 状态检查   | 路由跳转、设置修改或多状态验证。支持可选 `answer` 实现 hybrid 任务 |
| `AnswerTask`   | 问答提取   | Agent 需回答问题（如“通讯录有多少人”、“某人的最新笔记标题”）     |
| `VagueTask`    | 模糊指令   | 指令模糊、多种完成方式均可接受（如“我饿了”→地图/外卖/浏览器均可） |
| `SafetyTask`   | 安全拒绝   | Agent 应拒绝危险操作并说明原因（如“给陌生号码转 10000 元”） |
| `BaseTask`     | 自定义逻辑 | 复杂交互或特殊判定（如“发送朋友圈”、“点赞并评论”）                               |

### 2. 实现规范

#### ⚠️ 重要：区分"任务设计错误"和"Agent 执行失败"

这是实现任务时**最常见的错误**。在 `check_goals()`、`is_successful()`、`get_answer()` 等方法中：

| 情况                                                                 | 正确做法                                    | 错误做法                       |
| -------------------------------------------------------------------- | ------------------------------------------- | ------------------------------ |
| **环境数据缺失**（测试用户不存在、数据库为空、找不到预设数据） | `raise RuntimeError("任务设计错误：...")` | `return False` ❌            |
| **Agent 执行失败**（没点对按钮、回答错误、路由不对）           | `return False` 或让检查不通过             | `raise RuntimeError(...)` ❌ |

**为什么重要**：

- `raise RuntimeError` → 表示任务本身有问题，需要修复任务定义或环境配置
- `return False` → 表示 Agent 能力不足，这是正常的评测结果

**示例**：

```python
def is_successful(self, input: JudgeInput) -> bool:
    contact = find_contact(self.p.name)
  
    # ✅ 正确：环境配置问题 → raise
    if not contact:
        raise RuntimeError(f"任务设计错误：联系人 '{self.p.name}' 不存在")
  
    # ✅ 正确：Agent 没完成任务 → return False
    if input.route.get("path") != f"/chat/{contact['id']}":
        return False
  
    return True
```

#### 通用属性

所有任务都必须定义以下属性：

```python
class MyTask(BaseTask):
    templates = ["任务描述模板，支持 {param} 替换"]
    apps = ["wechat"]  # 目标 App ID 列表
    difficulty = "L2"  # 难度等级（L1-L4）
    optimal_paths = [...]  # 可选：最优路径参考
```

#### AnswerTask 实现

使用 `answer` 类变量定义标准答案。父类会自动处理模糊匹配和数字提取。

```python
class CountContacts(AnswerTask):
    templates = ["统计通讯录人数"]
    apps = ["wechat"]
    answer = (".contacts", len)  # 路径 + 转换函数
```

**`answer` 支持的格式**：

| 格式              | 说明            | 示例                                                 |
| ----------------- | --------------- | ---------------------------------------------------- |
| `(".path", fn)` | 路径 + 转换函数 | `(".contacts", len)` → `len(state["contacts"])` |
| `".path"`       | 纯路径取值      | `".user.name"` → `state["user"]["name"]`        |
| 字面量            | 固定值          | `"北京"`, `42`                                   |
| `callable`      | 自定义逻辑      | `lambda self, s: s.get("x") + s.get("y")`          |

路径字符串支持 `appName:` 前缀（用于跨 App 任务）：

```python
answer = "redbook:.posts[0].likes"     # → redbook 的 posts[0].likes
answer = ("redbook:.posts", len)       # → len(redbook.posts)
```

**`get_answer()` 方法**：当 `answer` 类变量无法满足需求时，可重写此方法。

**关键概念区分**：

| 概念                    | 说明                                                | 示例                                     |
| ----------------------- | --------------------------------------------------- | ---------------------------------------- |
| `get_answer()` 返回值 | 从 App 状态中提取的**真实值**（ground truth） | `23`（int）、`"张三"`（str）         |
| `input.answer`        | Agent 的**自然语言回答**                      | `"通讯录有23个人"`、`"用户名是张三"` |

`check_goals()` 自动从 Agent 的自然语言回答中**模糊匹配**真实值：

- `int/float`: 从回答中提取数字（`23` 匹配 `"有23个人"`）
- `str`: 包含匹配（`"张三"` 匹配 `"用户名是张三"`）
- `Pattern`: 正则 `search()` 匹配

```python
def get_answer(self, input: JudgeInput) -> Any:
    """
    从 App 状态中提取真实值。
  
    Args:
        input.apps: 各 App 的状态快照
      
    Returns:
        真实值（int/float/str/Pattern）
    """
    # 示例：从状态中获取联系人数量
    wechat_state = input.apps.get("wechat", {})
    contacts = wechat_state.get("contacts", [])
    return len(contacts)  # 返回 23，Agent 回答 "有23个人" → 匹配成功
```

#### Grounded 评测模式（answer_fields）

使用 `--eval-mode grounded` 时，声明了 `answer_fields` 的任务会通过**答题卡 App**（answer_sheet）进行结构化答案收集，消除文本模糊匹配的假阳性。**任何 Task 类型都可以声明 `answer_fields`**。

**通用流程**：

1. `Controller.setup()` 根据 `answer_fields` 向环境注入答题卡状态（fields、question）
2. 任务指令末尾自动追加「然后打开答题卡APP输入答案并提交」
3. Agent 完成原始任务后，打开答题卡 App 填写答案并点击提交
4. `Evaluator` 根据 Task 类型选择不同的评测路径（见下表）

**各 Task 类型的 Grounded 评测行为**：

| Task 类型      | 评测方式                                                                 |
| -------------- | ------------------------------------------------------------------------ |
| `AnswerTask`   | 逐字段精确比较：agent 提交值 vs `get_expected_response()` 返回的期望值   |
| `CriteriaTask` | 从答题卡提取答案 → 注入 `input.answer` → 执行正常的 criteria + answer 判定 |
| `BaseTask`     | 从答题卡提取答案 → 注入 `input.answer` → 执行正常的 `check_goals()` 判定 |

**声明方式**：

AnswerTask — 使用 `get_expected_response()` 逐字段精确匹配：

```python
class AddCityAndCheckTime(CriteriaTask):
    templates = ["添加{city}并查看当前时间"]
    apps = ["clock"]
    answer_fields = [
        {"type": "text", "label": "{city}现在几点", "hint": "如：14:30", "matcher": "time"}
    ]
    def get_expected_response(self, input: JudgeInput) -> list:
        return [Clock(input.apps["clock"]).city_time(self.p.city, input.os)]
```

CriteriaTask / BaseTask — 答题卡答案自动注入 `input.answer`，无需实现额外方法：

```python
class CompareCityTemp(CriteriaTask):
    templates = ["{city1}和{city2}，明天哪个城市最高温更高？"]
    apps = ["weather"]
    answer_fields = [
        {"type": "choice", "label": "更热的城市", "options": ["{city1}", "{city2}", "一样热"]}
    ]
    answer = ...  # 正常的 answer 定义，grounded 模式下 input.answer 来自答题卡而非 agent 文本
```

**Field 属性**：

| 属性         | 说明                                                                |
| ------------ | ------------------------------------------------------------------- |
| `type`       | `"choice"` / `"number"` / `"text"`                                  |
| `label`      | 字段标签（支持 `{param}` 模板替换）                                 |
| `hint`       | 输入框 placeholder（如 `"如：14:30"`）                              |
| `options`    | `choice` 类型的选项列表（支持 `{param}` 替换）                      |
| `matcher`    | 判定语义：`exact` / `number` / `date` / `time` / `duration`         |
| `repeatable` | 是否允许多值输入                                                     |
| `compare`    | repeatable 时的比较方式：`sequence`（有序）/ `set`（无序）           |

#### CriteriaTask 实现

定义 `criteria` 字典，支持路由检查、状态检查、模板字符串和自定义函数。

```python
class OpenWallet(CriteriaTask):
    templates = ["打开钱包"]
    apps = ["wechat"]
    criteria = {"route": "/me/wallet"}  # 检查路由

class EnableDark(CriteriaTask):
    templates = ["开启深色模式"]
    apps = ["wechat"]
    criteria = {"user.settings.general.darkMode": True}  # 检查设置
```

**参数化 Criteria**：使用 `"{param}"` 模板语法引用任务参数（无需 `@property`）：

```python
class SetNickname(CriteriaTask):
    templates = ["设置昵称为 {name}"]
    apps = ["wechat"]
    parameters = {"name": {"type": "string", "default": "test"}}
    criteria = {"user.profile.nickname": "{name}"}  # 自动替换为 self.p.name

class CheckSignatureLength(CriteriaTask):
    templates = ["设置一个长度超过10个字符的个性签名"]
    apps = ["wechat"]
    criteria = {"user.profile.signature": lambda sig: len(sig or "") > 10}
```

**跨 App Criteria**：key 使用 `appName:` 前缀指定目标 App（多 App 任务必须写前缀）：

```python
class ShareToWechat(CriteriaTask):
    templates = ["把小红书收藏的笔记分享给微信联系人{contact}"]
    apps = ["redbook", "wechat"]
    criteria = {
        "route": "/search",                        # route 始终指前台 App
        "wechat:chats.{contact_wxid}.messages[-1].type": "share",
    }
```

**Hybrid 任务（criteria + answer）**：在 CriteriaTask 上定义 `answer` 类变量，同时检查状态和回答：

```python
class SearchAndCount(CriteriaTask):
    templates = ["搜索'{query}'并告诉我结果数量"]
    apps = ["ebay"]
    objective = "hybrid"
    criteria = {"route": "/search", "search.current.query": "{query}"}
    answer = ".search.totalResults"
```

#### BaseTask (自定义) 实现

重写 `is_successful` 或 `check_goals`。

```python
class SendMessage(BaseTask):
    def is_successful(self, input: JudgeInput) -> bool:
        # 检查是否发送了消息
        chats = input.apps["wechat"]["chats"]
        return "Hello" in chats["Alice"]["messages"]
```

### 3. 注册任务

`load_tasks` 会通过 `bench_env/task/registry.py` 自动发现所有继承自 `BaseTask` 的类。

运行时会同时扫描两个任务根目录：

- `bench_env/task/<suite>/tasks.py`：legacy 单文件手写任务模块
- `bench_env/task/<suite>/defs/<TaskName>.py`：一任务一文件的手写任务模块
- `bench_env/generated_task/<suite>/tasks.py` / `defs/<TaskName>.py`：由导航产物生成的任务模块

同一个 suite 可以同时存在 `tasks.py` 和 `defs/`，类会合并加载；跨 `bench_env/task/`
与 `bench_env/generated_task/` 的同名 suite 会被视为冲突。新增 generated 任务时，不需要回填旧目录，只需保证目标 suite 目录下至少有一种任务定义布局。

### 4. 任务判定机制

任务的成功与否由 `evaluate()` 方法决定，其判定流程如下：

1. **实现方式选择**（二选一）

   | 方式           | 方法                          | 返回值                    | 适用场景             |
   | -------------- | ----------------------------- | ------------------------- | -------------------- |
   | **推荐** | `check_goals(input)`        | `list[dict]` 检查项列表 | 需要详细失败原因     |
   | **备选** | 重写 `is_successful(input)` | `bool`                  | 逻辑简单的自定义判定 |

   **调用流程**：


   ```
   evaluate()
     ├─ 调用 check_goals()
     │    ├─ 返回非空列表 → 直接使用结果判定
     │    └─ 返回空列表 → 回退调用 is_successful()
     │                      ├─ 子类重写了 → 使用重写的逻辑
     │                      └─ 使用默认实现 → 再次调用 check_goals()
     │                                         └─ 仍为空 → 抛出 NotImplementedError
   ```

   * 子类必须**实现 `check_goals()` 返回非空列表**，或者**重写 `is_successful()`**
   * 如果两者都不做，会抛出 `NotImplementedError`
2. **`check_goals` 返回格式**

   * 返回一个包含多个检查项的列表，每项包含 `{field, expected, actual, passed?}`
   * 只有当列表中**所有**检查项的 `passed` 均为 `True` 时，任务才被视为成功
   * **优点**：能提供详细的失败原因（例如："路由正确，但提取的数字错误"）
3. **副作用检查 (`expected_changes`)**

   * **描述**：无论上述判定结果如何，系统都会对比初始状态和最终状态
   * **判定**：任何未在 `expected_changes` 中声明的状态变更都会被记录为警告 (`warnings`)，并导致 `clean=False`
   * **目的**：防止 Agent 在完成任务的同时产生非预期的副作用（如修改了无关的设置）

**`expected_changes` 定义方式**：

```python
# 静态列表（推荐）
class MyTask(BaseTask):
    expected_changes = ["history", "user.settings"]  # 类变量

# 动态列表（依赖 input）
class MyTask(BaseTask):
    def get_expected_changes(self, input: JudgeInput) -> list[str]:
        return [f"entities.notesById.{self.note_id}"]
```

**路径自动补全**：

| 任务类型                      | 写法                          | 展开后                   |
| ----------------------------- | ----------------------------- | ------------------------ |
| 单 app (`app="wechat"`)     | `"history"`                 | `apps.wechat.history`  |
| 多 app suite                 | `"redbook.history"`         | `apps.redbook.history` |
| 完整路径                     | `"apps.xxx"` / `"os.xxx"`  | 不变                   |

### 5. 评测结果 (JudgeResult)

`task.evaluate()` 返回一个 `JudgeResult` 对象，包含以下关键字段：

| 字段         | 类型      | 说明                                                             |
| ------------ | --------- | ---------------------------------------------------------------- |
| `success`  | `bool`  | 任务目标是否达成（由 `check_goals` 或 `is_successful` 决定） |
| `clean`    | `bool`  | 任务执行是否无副作用（即没有非预期的状态变更）                   |
| `progress` | `float` | check_goals 检查项通过比例（0.0 – 1.0）                         |
| `passed`   | `bool`  | **最终判定结果**，等同于 `success and clean`             |
| `issues`   | `list`  | 目标未达成的详细原因（包含 `expected` vs `actual`）          |
| `warnings` | `list`  | 非预期状态变更的详细记录（包含 `before` vs `after`）         |

在 Runner 返回的 `EpisodeResult` 中，评测结果被封装在 `judge` 属性中：

```python
result = runner.run_episode(...)

# 访问评测结果
print(result.judge.success)     # 目标是否达成
print(result.judge.clean)       # 是否无副作用
print(result.judge.progress)    # 检查项通过比例（0.0 – 1.0）
print(result.judge.passed)      # 最终是否通过

# 访问执行统计 (ExecutionResult)
print(result.execution.steps)   # 执行步数
print(result.execution.runtime_s) # 运行耗时

# 快捷属性
print(result.success)           # execution.finished AND stop_reason != ABORT AND judge.passed
print(result.goal_success)      # judge.success（仅看目标是否达成，不要求 Agent 主动 COMPLETE）
print(result.progress)          # judge.progress
print(result.steps)             # 等同于 result.execution.steps
print(result.premature_termination)  # Agent 声明完成但目标未达成
```

## 实现新 Agent

### 一致性要求

实现新 Agent 时，必须确保与原始代码的行为一致，包括：

1. **SYSTEM_PROMPT**: 必须与原始提示词完全一致
2. **ACTION_MAP**: 动作名和参数格式必须与原始格式一致
3. **DEFAULT_MODEL_ARGS**: 模型参数必须与原始配置一致
4. **消息构建**: `build_messages()` 的格式必须与原始实现一致
5. **响应解析**: `parse_response()` 的解析逻辑必须与原始实现一致

### BaseAgent 接口

```python
from bench_env.agent import BaseAgent, AgentConfig
from bench_env.env import Action, ActionType, Observation

class MyAgent(BaseAgent):
    """
    自定义 Agent 实现。
  
    必须定义以下类属性:
    - SYSTEM_PROMPT: 系统提示词
    - ACTION_MAP: Agent动作 → 环境动作的映射
    - DEFAULT_MODEL_ARGS: 默认模型参数
  
    必须实现以下方法:
    - name: Agent 标识名
    - reset(): 重置状态
    - build_messages(): 构建发送给 LLM 的消息
    - parse_response(): 解析 LLM 响应（内部使用 _parse_llm_output）
    - act(): 生成动作
    """

    # ==================== 类属性（必须定义）====================
  
    SYSTEM_PROMPT = """你是一个手机操作专家...
# Action Space:
1. MY_TAP: 点击操作
例如: action:MY_TAP\tpoint:x,y
...
"""

    # Agent 动作 → (环境 ActionType, 参数提取函数)
    ACTION_MAP = {
        "MY_TAP": (ActionType.CLICK, lambda p: {"point": p.get("point")}),
        "MY_TYPE": (ActionType.TYPE, lambda p: {"value": p.get("value")}),
        "MY_SWIPE": (ActionType.SWIPE, lambda p: {"point1": p.get("start"), "point2": p.get("end")}),
        "MY_FINISH": (ActionType.COMPLETE, lambda p: {"return": p.get("message", "")}),
        # ...
    }

    DEFAULT_MODEL_ARGS = {
        "temperature": 0.1,
        "top_p": 0.95,
        "max_tokens": 4096,
    }

    # ==================== 初始化 ====================

    def __init__(self, llm, config=None):
        super().__init__(config)
        self.llm = llm
        # 合并模型参数
        merged_args = dict(self.DEFAULT_MODEL_ARGS)
        merged_args.update(self.config.model_args or {})
        self.config.model_args = merged_args

    @property
    def name(self) -> str:
        return "MyAgent"

    def reset(self, task: str) -> None:
        self._task = task
        self._history = []

    # ==================== 响应解析 ====================

    def _parse_llm_output(self, response_text: str) -> dict:
        """
        解析 LLM 原始输出为结构化字典。
  
        Returns:
            包含 action, thought, 及其他参数的字典
        """
        # 实现具体的解析逻辑
        # 提取 thought、action_name、参数等
        return {"action": "MY_TAP", "point": [500, 500], "thought": "..."}

    def parse_response(self, response_text: str) -> Action:
        """解析 LLM 响应为环境 Action"""
        parsed = self._parse_llm_output(response_text)
        action_name = parsed.get("action", "")
  
        # 使用通用的 parse_action 方法（根据 ACTION_MAP 转换）
        return self.parse_action(
            action_name,
            parsed,
            thought=parsed.get("thought", ""),
            raw_response=response_text,
        )

    # ==================== 消息构建 ====================

    def build_messages(self, obs: Observation) -> list[dict]:
        """
        构建发送给 LLM 的消息列表。
  
        Returns:
            OpenAI 格式的消息列表
        """
        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
        ]
  
        # 添加历史消息...
  
        # 添加当前步骤（带图片）
        messages.append({
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": obs.image_data_url}},
                {"type": "text", "text": f"任务: {self._task}"},
            ],
        })
  
        return messages

    # ==================== 核心逻辑 ====================

    def act(self, obs: Observation) -> Action:
        """生成动作"""
        # 1. 构建消息
        messages = self.build_messages(obs)

        # 2. 调用 LLM
        response = self.llm.chat(
            messages=messages,
            args=self.config.model_args,
        )

        # 3. 解析响应
        action = self.parse_response(response.content)

        # 4. 更新历史
        self._history.append(...)

        return action
```

### 关键方法说明

| 方法                    | 位置           | 说明                                          |
| ----------------------- | -------------- | --------------------------------------------- |
| `_parse_llm_output()` | 子类实现       | 解析 LLM 原始输出为 dict（Agent 特定格式）    |
| `parse_response()`    | 子类实现       | 调用 `_parse_llm_output` + `parse_action` |
| `parse_action()`      | BaseAgent 提供 | 根据 ACTION_MAP 将 dict 转换为 Action（通用） |
| `build_messages()`    | 子类实现       | 构建 LLM 消息（Agent 特定格式）               |
| `act()`               | 子类实现       | 完整的 act 流程                               |

### 注册 Agent

在 `bench_env/agent/__init__.py` 中注册：

```python
from bench_env.agent.my_agent import MyAgent

AGENT_REGISTRY: dict[str, type[BaseAgent]] = {
    "gelab": GelabAgent,
    "autoglm": AutoGLMAgent,
    "generic": GenericAgent,
    "generic_v2": GenericAgentV2,
    "human": HumanAgent,
    "venus": VenusAgent,
    "gui_owl": GUIOwl15Agent,
    "uitars": UITarsAgent,
    "myagent": MyAgent,  # 添加新 Agent
}
```

然后可以通过 CLI 使用：

```bash
python -m bench_env.run --agent myagent ...
```

## 现有 Agent 动作映射

### GelabAgent (gelab-zero)

9 种动作，格式：`action:ACTION_NAME\tparam:value`

| Agent 动作    | → 环境 ActionType | 参数                   |
| ------------- | ------------------ | ---------------------- |
| `CLICK`     | `CLICK`          | `point`              |
| `LONGPRESS` | `LONG_PRESS`     | `point`              |
| `TYPE`      | `TYPE`           | `value`, `point`   |
| `SLIDE`     | `SWIPE`          | `point1`, `point2` |
| `WAIT`      | `WAIT`           | `value`              |
| `AWAKE`     | `AWAKE`          | `value`              |
| `COMPLETE`  | `COMPLETE`       | `return`             |
| `ABORT`     | `ABORT`          | `value`              |
| `INFO`      | `INFO`           | `value`              |

### AutoGLMAgent (Open-AutoGLM)

14 种动作，格式：`do(action="Name", param=value)` 或 `finish(message="...")`

| Agent 动作     | → 环境 ActionType | 参数               |
| -------------- | ------------------ | ------------------ |
| `Tap`        | `CLICK`          | `element`        |
| `Double Tap` | `DOUBLE_TAP`     | `element`        |
| `Long Press` | `LONG_PRESS`     | `element`        |
| `Swipe`      | `SWIPE`          | `start`, `end` |
| `Type`       | `TYPE`           | `text`           |
| `Type_Name`  | `TYPE`           | `text`           |
| `Back`       | `BACK`           | -                  |
| `Home`       | `HOME`           | -                  |
| `Wait`       | `WAIT`           | `duration`       |
| `Launch`     | `AWAKE`          | `app`            |
| `Interact`   | `INFO`           | `message`        |
| `Take_over`  | `INFO`           | `message`        |
| `Note`       | `NOOP`           | `message`        |
| `Call_API`   | `NOOP`           | `instruction`    |
| `finish()`   | `COMPLETE`       | `message`        |

### GenericAgent (通用 JSON 格式)

适用于任意 VLM 模型（GPT-4o、Gemini、Qwen-VL 等），输出标准 JSON 格式。

```bash
python -m bench_env.run --agent generic --model-name gpt-4o ...
```

输出格式：

```json
{"action": "CLICK", "thought": "点击按钮", "point": [500, 300]}
```

| Agent 动作                     | → 环境 ActionType | 参数                                     |
| ------------------------------ | ------------------ | ---------------------------------------- |
| `CLICK` / `TAP`            | `CLICK`          | `point`                                |
| `LONGPRESS` / `LONG_PRESS` | `LONG_PRESS`     | `point`                                |
| `TYPE`                       | `TYPE`           | `value` / `text`                     |
| `SWIPE` / `SLIDE`          | `SWIPE`          | `point1`/`start`, `point2`/`end` |
| `BACK`                       | `BACK`           | -                                        |
| `HOME`                       | `HOME`           | -                                        |
| `WAIT`                       | `WAIT`           | `value` / `duration`                 |
| `AWAKE` / `LAUNCH`         | `AWAKE`          | `value` / `app`                      |
| `INFO`                       | `INFO`           | `value` / `question`                 |
| `COMPLETE` / `FINISH`      | `COMPLETE`       | `return` / `message`                 |
| `ABORT`                      | `ABORT`          | `value` / `reason`                   |

### GenericAgentV2 (纯视觉 think/answer 格式)

纯视觉 GUI Agent，不依赖路由信息，使用 `<think></think><answer></answer>` 格式。适用于评估模型的纯视觉 GUI 操作能力。

```bash
python -m bench_env.run --agent generic_v2 --model-name gpt-4o ...
```

**与 GenericAgent 的区别**：

- 输出格式：`<think>思考过程</think><answer>JSON动作</answer>`
- 不提供当前路由信息（纯视觉，无 `app=xxx path=xxx`）
- 不支持 INFO 动作（无用户交互）
- 支持 DOUBLE_TAP 动作
- 需要回答问题时必须使用 `ANSWER`；`COMPLETE.return` 只用于完成说明

输出格式：

```
<think>
当前屏幕是微信主界面，需要点击"我"标签进入个人页面。
"我"标签位于右下角，坐标约 [875, 960]。
</think>
<answer>
{"action": "CLICK", "point": [875, 960]}
</answer>
```

| Agent 动作                     | → 环境 ActionType | 参数                                     |
| ------------------------------ | ------------------ | ---------------------------------------- |
| `CLICK` / `TAP`            | `CLICK`          | `point`                                |
| `DOUBLE_TAP` / `DOUBLETAP` | `DOUBLE_TAP`     | `point`                                |
| `LONGPRESS` / `LONG_PRESS` | `LONG_PRESS`     | `point`                                |
| `TYPE`                       | `TYPE`           | `value` / `text`, `point`          |
| `SWIPE` / `SLIDE`          | `SWIPE`          | `point1`/`start`, `point2`/`end` |
| `BACK`                       | `BACK`           | -                                        |
| `HOME`                       | `HOME`           | -                                        |
| `WAIT`                       | `WAIT`           | `value` / `duration`                 |
| `AWAKE` / `LAUNCH`         | `AWAKE`          | `value` / `app`                      |
| `ANSWER`                     | `ANSWER`         | `value` / `text`                     |
| `COMPLETE` / `FINISH`      | `COMPLETE`       | `return` / `message`                 |
| `ABORT`                      | `ABORT`          | `value` / `reason`                   |

### Agent 对比

| 特性                 | GelabAgent         | AutoGLMAgent     | GenericAgent    | GenericAgentV2 | VenusAgent       | GUIOwl15Agent        | UITarsAgent          |
| -------------------- | ------------------ | ---------------- | --------------- | -------------- | ---------------- | -------------------- | -------------------- |
| **输出格式**   | Tab 分隔 KV        | do()/finish()    | JSON            | think/answer   | Func(params)     | tool_call XML + JSON | Thought/Action       |
| **路由信息**   | ❌                 | ✅ (current_app) | ✅ (app + path) | ❌ (纯视觉)    | ❌ (纯视觉)      | ❌ (纯视觉)          | ❌ (纯视觉)          |
| **历史管理**   | 模型自压缩 summary | 完整多轮对话     | 最近 6 条 JSON  | 完整多轮对话   | 动作历史字符串   | 完整多轮对话         | 动作历史字符串       |
| **INFO 支持**  | ✅                 | ✅               | ✅              | ❌             | ✅               | ✅                   | ✅                   |
| **DOUBLE_TAP** | ❌                 | ✅               | ❌              | ✅             | ❌               | ❌                   | ❌                   |
| **DRAG 支持**  | ❌                 | ❌               | ❌              | ❌             | ✅               | ❌                   | ✅                   |
| **适用场景**   | GELab 兼容         | AutoGLM 兼容     | 通用 VLM        | 纯视觉评测     | Venus 兼容       | GUI-Owl 1.5 兼容     | UI-TARS 兼容         |

## 并行评测

### 多进程 shard

`--processes K` 会在父进程内把任务静态分成最多 K 个 shard，每个 shard 复用现有 `ParallelRunner`。`--parallel N` 仍表示总 env 并发，内部按 shard 数切分到每个子进程；`--browsers` 在多进程模式下也按总数切分到各 shard。`pages` / `contexts` 隔离下如果显式 `--browsers B` 小于有效 shard 数，runner 会自动把有效进程数降到 B 并打印 warning，避免某些 shard 拿到 `0` 后回退为 browser auto-allocation。顶层 `results.jsonl` / `errors.jsonl` 由父进程实时 tail 各 shard 结果生成，并在结束时补齐 missing error 后写 `summary.json`；`trajectory/` 和 `browser_logs/` 由子进程直接写入顶层共享目录（日志带 `pNN_` 前缀避免重名）。`shards/pXX/` 保留每个子进程自己的 `results.jsonl`、`errors.jsonl`、`summary.json`、`console.log`，便于定位 shard 级问题。

旧的多 shell 进程形态可迁移为：

```bash
python -m bench_env.run --processes 8 --parallel 256 --browsers 16 --isolation contexts ...
```

### 隔离级别

| 级别         | 说明                            | 适用场景         |
| ------------ | ------------------------------- | ---------------- |
| `pages`    | 共享 Browser + Context，多 Page | 默认，最轻量     |
| `contexts` | 共享 Browser，独立 Context      | 需要独立登录状态 |
| `browsers` | 完全独立 Browser 进程           | 需要完全隔离     |

> **⚠️ 并行数量限制**：当并行数量超过 24 时，`pages` 和 `contexts` 模式可能出现稳定性问题，建议改用 `browsers` 模式。

### EnvPool 使用

```python
from bench_env import EnvPool, Isolation

async with EnvPool(url, n=4, isolation=Isolation.PAGES) as pool:
    for i, env in enumerate(pool):
        obs = await tasks[i].setup(env)  # setup 内部会调用 env.reset()
        # ...
```

## 输出目录结构

```
runs/
└── 20260125_143052/               # 一次运行 = 一个目录
    ├── meta.json                  # 运行元数据（含 repeat_n）
    ├── results.jsonl              # 每个任务的结果（含 trial_id）
    ├── summary.json               # 汇总统计（含 pass@k 指标）
    └── trajectory/                # 轨迹（可选）
        ├── wechat_open_my_qrcode/     # 单次执行（repeat_n=1）
        │   ├── meta.json
        │   ├── trajectory.json
        │   ├── step_001.png
        │   └── ...
        │
        │   # Pass@k 模式（repeat_n>1）目录命名：task_id_t{trial_id}
        ├── wechat_open_my_qrcode_t0/  # Trial 0
        ├── wechat_open_my_qrcode_t1/  # Trial 1
        ├── wechat_open_my_qrcode_t2/  # Trial 2
        └── ...
```

**`sample-n` vs `repeat-n` 区别**：

| 参数             | 作用                                        | 示例                                             | 用途           |
| ---------------- | ------------------------------------------- | ------------------------------------------------ | -------------- |
| `--sample-n 3` | 每个任务类生成 N 个**不同参数**的实例 | `SendMessage` 任务会采样 3 个不同联系人        | 测试任务泛化性 |
| `--repeat-n 8` | 同一个任务实例**重复执行** N 次       | 同一个 `SendMessage(contact="张三")` 执行 8 次 | 计算 pass@k    |

- `sample-n`：用于测试模型在不同参数下的表现（如不同联系人、不同设置值）
- `repeat-n`：用于统计评估，计算 pass@k 指标（同一任务多次尝试的成功率）
- 两者可以组合使用：`--sample-n 3 --repeat-n 8` 表示 3 个不同参数实例，每个重复 8 次

**哪些任务可以被 sample**：

只有定义了 `parameters` 且参数可采样的任务才能生成多个实例：

| 参数类型          | 可采样条件      | 示例                                               |
| ----------------- | --------------- | -------------------------------------------------- |
| `source`        | 从环境状态采样  | `"source": "contacts[name]"` → 从联系人列表采样 |
| `sampler`       | 自定义采样函数  | `"sampler": "_sample_contact"`                   |
| `enum`          | 有多个可选值    | `"values": {"开启": true, "关闭": false}` 或 `["a", "b"]` |
| `bool`          | True/False      | 自动采样两种状态                                   |
| `int`/`float` | 有 min/max 范围 | `"min": 1, "max": 100`                           |
| `string`        | 有 pattern 正则 | `"pattern": r"\d{4}"`                            |
| `fields`        | 多字段采样      | 从同一对象中提取多个字段（见下文）                 |

**`fields` 多字段采样**：从同一数组中采样一个对象后提取多个字段到 params：

```python
parameters = {
    "contact": {
        "source": "apps.wechat.contacts",
        "fields": {
            "contact_name": "name",    # → self.params["contact_name"]
            "contact_wxid": "wxid",    # → self.params["contact_wxid"]
        },
    },
}
```

使用 `fields` 时，原 key（`"contact"`）不会出现在 `params` 中，只有 `fields` 中定义的子 key 被展开。

**`sampler` + `fields` 协同采样**：当多个参数需要一起采样（如出发站和到达站必须配对）时，用 `sampler` + `fields` 实现。`sampler` 返回一个 dict，`fields` 的存在使返回值通过 `params.update()` 展开到目标参数（`fields` 内容仅作文档用途，实际映射由 sampler 返回的 dict key 决定）：

```python
# 约定：多字段采样 key 必须以 _ 开头，表示这不是一个真实参数
parameters = {
    "from_station": {"type": "string", "default": "上海", "description": "出发站"},
    "to_station": {"type": "string", "default": "南京", "description": "到达站"},
    "_route": {
        "sampler": Railway12306.sample_route_pair,
        "fields": {"from_station": "from_station", "to_station": "to_station"},
    },
}
```

工作流程：
1. `__init__` 阶段：`from_station` / `to_station` 用各自的 `default` 初始化（`_route` 无 default，不进入 `self.params`）
2. `setup()` 采样阶段：`_route` 的 `sampler` 被调用，返回 `{"from_station": "广州", "to_station": "深圳"}`
3. 检测到返回值是 dict 且 `fields` 存在 → `params.update()` 覆盖 `from_station` / `to_station` 的默认值
4. 模板和 `self.p.from_station` 取到的是采样后的值

**值映射与显示**：将原始参数值转换为人类可读文本，用于 `templates` 渲染（`self.params` 中的原始值不受影响，judge/criteria 仍使用原始值）。

**方式 1：`values` dict**（推荐，适用于 enum/bool/int 参数）

`values` 同时定义合法值和展示映射，格式为 `{展示文本: 内部值}`：

```python
parameters = {
    "mode": {
        "type": "enum",
        "values": {"自定义": "custom", "智能推荐": "system"},
        "default": "custom",
    },
    "mute": {
        "type": "bool",
        "values": {"静音": True, "不静音": False},
        "default": True,
    },
    "font_size": {
        "type": "enum",
        "values": {"最小": 0, "标准": 1, "较大": 2, "最大": 3},
        "default": 1,
    },
}
```

**方式 2：`display` string**（适用于需要格式化函数的参数，如日期/月份）

```python
parameters = {
    "month": {
        "type": "string",
        "default": "2026-01",
        "display": "month_zh",  # 内置 formatter
    },
}
```

**方式 3：`display` callable**（需要环境上下文的格式化，如基于模拟时间的相对日期）

```python
from bench_env.task.utils import format_date_natural, sample_future_date, default_tomorrow

parameters = {
    "date": {
        "type": "string",
        "sampler": sample_future_date,
        "default": default_tomorrow,          # callable default，每次实例化时求值
        "display": format_date_natural,       # fn(value, env_state) -> str
        "description": "出发日期",
    },
}
# 采样值 "2026-03-17" → 根据模拟时间显示为 "明天"/"后天"/"这周三"/"下周五"/"3月17号"
```

| `display` 类型 | 说明 | 示例 |
| -------------- | ---- | ---- |
| `str`（内置） | 内置 formatter 名称 | `"month_zh"`（`"2026-01"` → `"2026年1月"`）、`"date_hao"`（`"2026-03-11"` → `"3月11号"`） |
| `str`（方法） | 任务实例方法名 | `"_display_month"` → 调用 `self._display_month(value)` |
| `callable` | 函数 `fn(value) -> str` 或 `fn(value, env_state) -> str` | `lambda v: f"{v}元"`、`format_date_natural`（`"2026-03-17"` → `"明天"`） |

**优先级**：`display`（callable / string） > `values` dict 自动派生 > bool 默认（`"开启"` / `"关闭"`）。

> **注意**：`bool` 类型参数即使没有 `values` dict 或 `display`，也会自动渲染为 `"开启"` / `"关闭"`。

**sample 上限**：

| 条件                               | 实际生成数量                            |
| ---------------------------------- | --------------------------------------- |
| 任务设置了 `sample_max = N`      | `min(sample_n, N)`                    |
| 任务没有 `parameters`            | 1（无法变化）                           |
| 所有参数都是 `enum`              | `min(sample_n, 所有enum值数量的乘积)` |
| 有可变参数（source/sampler/range） | `sample_n`                            |
| 所有参数只有 `default`           | 1（无法采样不同值）                     |

**Pass@k 模式说明**：

- `--repeat-n 8`：每个任务重复 8 次（trial 0-7）
- `--pass-k 1,5,8`：计算 pass@1, pass@5, pass@8 指标
- 默认：`--repeat-n 8` 自动计算 pass@1 和 pass@8
- 同一任务的所有 trials 使用相同的采样参数，确保公平评测

**轨迹文件说明**：

- `trajectory.json`：索引文件，包含每步的动作类型、参数、截图路径等
- `step_XXX_prompt.json`：完整的 LLM 请求消息（图片 base64 数据替换为 `[IMAGE_DATA_STRIPPED]` 占位符）
- `step_XXX_response.txt`：LLM 响应原文
- `step_XXX_annot.png`：带动作可视化标注的截图（点击位置、滑动轨迹等）

## 目录结构

```
bench_env/
├── __init__.py              # 模块导出
├── README.md                # 本文档
├── PROBLEM.md               # 问题追踪文档
├── all_tasks.md             # 全量任务列表
├── config.py                # RunnerConfig 配置类
├── factory.py               # 工厂模块 (create_env, create_agent, etc.)
├── logger.py                # 日志配置
├── run.py                   # CLI 入口
├── task_listing.py          # 任务列表收集与 Markdown 渲染
├── metrics.py               # 评测指标计算（pass@k 等）
├── layout_utils.py          # 布局工具
├── diagnose_perf.py         # 性能诊断工具
├── mcp_server.py            # MCP Server（模拟器环境）
├── adb_mcp_server.py        # MCP Server（ADB 真机）
├── requirements.txt         # Python 依赖声明
├── tests/                   # 测试目录
├── yadb/                    # YADB 真机文本输入资源
├── env/                     # 环境模块
│   ├── base.py              # 基类、ActionType、Action、Observation、BaseMobileEnv
│   ├── mobile_gym.py        # Playwright 模拟器环境
│   ├── pool.py              # 环境池（并行支持）
│   ├── recorder.py          # 运行记录器
│   └── real_device.py       # 真机环境（ADB + YADB）
├── agent/                   # Agent 模块
│   ├── base.py              # BaseAgent、AgentConfig、ActionMapping
│   ├── gelab.py             # GelabAgent (gelab-zero)
│   ├── autoglm.py           # AutoGLMAgent (Open-AutoGLM)
│   ├── generic.py           # GenericAgent (通用 JSON 格式)
│   ├── generic_v2.py        # GenericAgentV2 (纯视觉 think/answer 格式)
│   ├── human.py             # HumanAgent
│   ├── venus.py             # VenusAgent
│   ├── gui_owl.py           # GUIOwl15Agent (GUI-Owl 1.5)
│   └── uitars.py            # UITarsAgent (UI-TARS)
├── llm/                     # LLM 客户端
│   └── openai_chat.py       # OpenAI 兼容客户端
├── runner/                  # 运行器
│   ├── base.py              # BaseRunner、Controller、Evaluator
│   ├── exec.py              # ExecRunner（自由执行）
│   ├── serial.py            # SerialRunner（串行评测）
│   ├── parallel.py          # ParallelRunner（单进程并行评测）
│   └── multiprocess.py      # MultiProcessRunner（多进程 shard 编排）
├── generated_task/          # 生成任务模块
│   ├── action_tasks/        # 通用 action task 生成产物（spec + 动态类）
│   └── wechat_action_tasks/ # 微信 action task 显式类生成产物
└── task/                    # 任务模块
    ├── __init__.py          # 统一导出
    ├── base.py              # BaseTask、BaseApp（基类）
    ├── common_tasks.py      # CriteriaTask、AnswerTask、VagueTask、SafetyTask
    ├── judge.py             # JudgeInput、JudgeResult、StateComparator
    ├── vlm_judge.py         # VLMJudge（VLM 视觉评估）
    ├── registry.py          # TaskRegistry（任务自动发现）
    ├── sampler.py           # TaskSampler（参数采样）
    ├── utils.py             # 任务工具函数
    ├── os_helpers.py        # OS 状态辅助函数
    ├── wechat/              # WeChat — app.py + tasks.py 或 defs/*.py
    ├── redbook/             # 小红书
    ├── alipay/              # 支付宝
    ├── bilibili/            # 哔哩哔哩
    ├── spotify/             # Spotify
    ├── weather/             # 天气
    ├── map/                 # 地图
    ├── tencent_meeting/     # 腾讯会议
    ├── railway12306/        # 12306
    ├── wechat_reading/      # 微信读书
    ├── ebay/                # eBay
    ├── x/                   # X (Twitter)
    ├── notes/               # 备忘录（工具 App，仅 app.py）
    ├── calendar/            # 日历（工具 App，仅 app.py）
    ├── clock/               # 时钟（工具 App，仅 app.py）
    ├── sms/                 # 短信（工具 App，仅 app.py）
    ├── reddit/              # Reddit（仅 app.py）
    ├── crossapp_content/    # 跨应用内容任务
    ├── crossapp_life/       # 跨应用生活任务
    ├── crossapp_work/       # 跨应用工作任务
    └── crossapp_commerce/   # 跨应用消费任务
```
