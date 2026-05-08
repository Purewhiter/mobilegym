# P3 — Benchmark 增强

> 优先级：**P3（生态建设）**
> 预计工作量：2 人 × 持续迭代
> 目标：标准化、可复现、可对比的 benchmark 体系

---

## 1. Benchmark 标准化

### 1.1 现状

- 当前有 12+ App 的 task 目录，每个 App 有 5-30 个 task
- Action tasks 通过 JSONL spec 自动生成
- 评估方式有两种：state-based 和 VLM-based
- 缺少统一的 benchmark suite 定义

### 1.2 标准化 Benchmark Suite

定义三个难度梯度的标准测试集：

```python
# bench_env/suites/__init__.py

SUITES = {
    "mini": {
        "description": "Quick validation (30 tasks, ~5 min with parallel=8)",
        "tasks": [
            # 每个 App 1-2 个代表性 task
            "wechat:open_chat_001",
            "wechat:send_message_001",
            "settings:toggle_wifi_001",
            "alipay:check_balance_001",
            # ...
        ],
        "expected_time_minutes": 5,
    },

    "standard": {
        "description": "Standard benchmark (200 tasks, ~30 min with parallel=16)",
        "tasks": "auto",  # 自动选取：每个 App 按复杂度均匀采样
        "per_app_count": 10,
        "complexity_distribution": {
            1: 0.3,  # 30% 简单
            2: 0.4,  # 40% 中等
            3: 0.2,  # 20% 复杂
            4: 0.1,  # 10% 很复杂
        },
        "expected_time_minutes": 30,
    },

    "full": {
        "description": "Complete benchmark (all tasks)",
        "tasks": "all",
    },
}
```

CLI 支持：

```bash
# 运行标准 suite
python -m bench_env.run --suite standard --agent generic_v2

# 运行 mini suite（快速验证）
python -m bench_env.run --suite mini --agent generic_v2

# 自定义 suite 文件
python -m bench_env.run --suite-file my_suite.json --agent generic_v2
```

### 1.3 任务元数据标准化

每个 task 应包含标准化元数据：

```python
class TaskMetadata:
    task_id: str              # 唯一标识
    app: str                  # 目标 App
    category: str             # 分类：navigation | data_entry | state_change | information_retrieval | cross_app
    complexity: int           # 1-5
    requires_typing: bool     # 是否需要文字输入
    requires_scroll: bool     # 是否需要滚动
    optimal_steps: int        # 最优步数
    description_zh: str       # 中文描述
    description_en: str       # 英文描述
    tags: list[str]           # 标签
```

---

## 2. Leaderboard 系统

### 2.1 架构

```
Leaderboard System

Submit Results → Validate → Store → Display
     │                               │
     └── JSON 格式提交               └── 文档站内嵌
```

### 2.2 结果提交格式

```json
{
  "version": "1.0",
  "submission": {
    "agent_name": "GPT-4o + Generic V2",
    "model": "gpt-4o-2024-11-20",
    "agent_type": "generic_v2",
    "date": "2026-03-02",
    "submitter": "Organization Name",
    "paper_url": "https://arxiv.org/abs/...",
    "code_url": "https://github.com/..."
  },
  "config": {
    "suite": "standard",
    "repeat_n": 8,
    "pass_k": [1, 5],
    "sample_seed": 42,
    "max_steps": 30,
    "observation_mode": "screenshot_only"
  },
  "results": {
    "overall": {
      "pass@1": 0.45,
      "pass@5": 0.72,
      "avg_steps": 8.3,
      "avg_time_seconds": 15.2,
      "total_tasks": 200,
      "completed_tasks": 200
    },
    "by_app": {
      "wechat": { "pass@1": 0.52, "pass@5": 0.78, "tasks": 20 },
      "settings": { "pass@1": 0.68, "pass@5": 0.90, "tasks": 15 },
      "alipay": { "pass@1": 0.38, "pass@5": 0.65, "tasks": 18 }
    },
    "by_complexity": {
      "1": { "pass@1": 0.72, "count": 60 },
      "2": { "pass@1": 0.48, "count": 80 },
      "3": { "pass@1": 0.25, "count": 40 },
      "4": { "pass@1": 0.10, "count": 20 }
    },
    "by_category": {
      "navigation": { "pass@1": 0.55, "count": 80 },
      "data_entry": { "pass@1": 0.35, "count": 50 },
      "state_change": { "pass@1": 0.42, "count": 40 },
      "information_retrieval": { "pass@1": 0.50, "count": 30 }
    }
  }
}
```

### 2.3 Leaderboard 页面

在文档站中嵌入 Leaderboard 表格：

```markdown
<!-- docs/benchmark/leaderboard.md -->

# Leaderboard

## Standard Suite (pass@1)

| Rank | Agent | Model | Overall | Navigation | Data Entry | State Change | Info Retrieval | Date |
|------|-------|-------|---------|------------|------------|--------------|----------------|------|
| 1 | Agent-X | GPT-4o | **0.52** | 0.63 | 0.41 | 0.48 | 0.55 | 2026-03 |
| 2 | AutoGLM | GLM-4V | 0.48 | 0.58 | 0.38 | 0.45 | 0.51 | 2026-02 |
| 3 | Generic V2 | Claude 3.5 | 0.45 | 0.55 | 0.35 | 0.42 | 0.50 | 2026-02 |

## Standard Suite (pass@5)

| ... |
```

### 2.4 自动化验证

提交结果前的自动验证脚本：

```python
# scripts/validate_submission.py

def validate_submission(result_file: str) -> bool:
    """验证提交结果的格式和合理性"""
    with open(result_file) as f:
        data = json.load(f)

    # 格式检查
    assert "version" in data
    assert "submission" in data
    assert "config" in data
    assert "results" in data

    # 合理性检查
    results = data["results"]["overall"]
    assert 0 <= results["pass@1"] <= 1
    assert results["pass@1"] <= results.get("pass@5", 1)
    assert results["avg_steps"] > 0
    assert results["total_tasks"] == results["completed_tasks"]

    # Suite 匹配检查
    suite = data["config"]["suite"]
    expected_count = SUITE_TASK_COUNTS[suite]
    assert results["total_tasks"] == expected_count

    return True
```

---

## 3. 评估增强

### 3.1 更细粒度的评估维度

```python
class DetailedJudgeResult:
    # 基本结果
    success: bool          # 目标是否完成
    clean: bool            # 无意外副作用

    # 新增维度
    efficiency: float      # steps_used / optimal_steps（越低越好）
    precision: float       # 目标完成精确度（0-1）
    side_effects: list[str]  # 意外副作用列表
    recovery_count: int    # 错误恢复次数（走错后回退）

    # 轨迹分析
    total_steps: int
    optimal_steps: int
    backtrack_steps: int   # 回退步数
    redundant_steps: int   # 无效步数（在同一状态循环）
    typing_accuracy: float # 文字输入准确率
```

### 3.2 Cross-App Task 增强

当前有 `crossapp/`、`crossapp2/`、`crossapp3/` 三个目录，需要标准化：

```python
class CrossAppTask(BaseTask):
    """跨应用任务基类"""
    template = "从{app1}复制{content}到{app2}"
    apps = ["wechat", "notes"]  # 多个 App
    warm_apps = ["wechat", "notes"]

    def setup(self, env):
        """确保所有相关 App 的初始状态正确"""
        for app in self.apps:
            env.sim.waitForData([app])

    def evaluate(self, judge_input):
        """检查所有相关 App 的状态变化"""
        # ...
```

### 3.3 动态难度调整

```python
class AdaptiveSampler:
    """根据 Agent 历史表现动态调整任务难度"""

    def sample_next_batch(
        self,
        agent_history: list[EpisodeResult],
        batch_size: int = 10,
    ) -> list[BaseTask]:
        # 统计各复杂度通过率
        pass_rates = self._compute_pass_rates_by_complexity(agent_history)

        # 重点采样通过率在 30%-70% 区间的难度
        target_complexities = [
            c for c, r in pass_rates.items()
            if 0.3 <= r <= 0.7
        ]
        # ...
```

---

## 4. 性能与可扩展性

### 4.1 并行执行优化

```python
# bench_env/env/pool.py 增强

class EnhancedEnvPool:
    """增强的环境池，支持自动重试和健康检查"""

    def __init__(self, size: int, env_url: str):
        self.size = size
        self.envs: list[BaseMobileEnv] = []
        self.health: list[bool] = []
        self.retry_count: dict[int, int] = {}
        self.max_retries = 3

    async def execute_with_retry(
        self,
        task: BaseTask,
        agent: BaseAgent,
        env_index: int,
    ) -> EpisodeResult:
        """带自动重试的执行"""
        for attempt in range(self.max_retries):
            try:
                return await self._execute(task, agent, env_index)
            except PlaywrightError:
                if attempt < self.max_retries - 1:
                    await self._restart_env(env_index)
                else:
                    raise

    async def health_check(self):
        """周期性健康检查"""
        for i, env in enumerate(self.envs):
            try:
                await env.ping()
                self.health[i] = True
            except:
                self.health[i] = False
                await self._restart_env(i)
```

### 4.2 结果缓存与增量评估

```python
class IncrementalRunner:
    """只重新运行失败/变更的 task"""

    def __init__(self, previous_results_path: str):
        self.cache = self._load_cache(previous_results_path)

    def should_rerun(self, task: BaseTask) -> bool:
        if task.task_id not in self.cache:
            return True  # 新 task
        cached = self.cache[task.task_id]
        if cached.task_hash != task.compute_hash():
            return True  # task 定义变更
        if cached.success:
            return False  # 已通过，跳过
        return True  # 失败的，重试
```

### 4.3 资源监控

```python
# bench_env/monitor.py

class BenchmarkMonitor:
    """实时监控 benchmark 运行状态"""

    def __init__(self):
        self.start_time = time.time()
        self.completed = 0
        self.total = 0
        self.successes = 0
        self.failures = 0

    def on_episode_complete(self, result: EpisodeResult):
        self.completed += 1
        if result.success:
            self.successes += 1
        else:
            self.failures += 1
        self._print_progress()

    def _print_progress(self):
        elapsed = time.time() - self.start_time
        rate = self.completed / elapsed if elapsed > 0 else 0
        eta = (self.total - self.completed) / rate if rate > 0 else float('inf')
        print(
            f"\r[{self.completed}/{self.total}] "
            f"Pass: {self.successes}/{self.completed} "
            f"({self.successes/max(1,self.completed)*100:.1f}%) "
            f"ETA: {eta:.0f}s",
            end="", flush=True,
        )
```

---

## 5. 与其他 Benchmark 的对比

### 5.1 对比维度

| 维度 | Mobile-Gym | AndroidWorld | AppAgent | MobileAgent |
|------|-----------|--------------|----------|-------------|
| 环境 | Web 模拟 | Android 模拟器 | 真机/模拟器 | 真机 |
| App 数量 | 26 | ~20 | 10+ | 10+ |
| 任务类型 | Nav + State + CrossApp | 状态验证 | 指令跟随 | 指令跟随 |
| 评估方式 | State + VLM | State | VLM | VLM |
| 可复现性 | 高（确定性状态） | 中 | 低 | 低 |
| 速度 | 快（无 UI 渲染延迟） | 慢（Android 启动） | 慢 | 慢 |
| 扩展性 | 高（Web 技术） | 中 | 低 | 低 |

### 5.2 结果转换工具

提供将 Mobile-Gym 结果转换为其他 benchmark 格式的工具：

```python
# scripts/convert_results.py

def convert_to_androidworld_format(mobile_gym_results):
    """转换为 AndroidWorld 格式，方便论文对比"""
    # ...

def convert_to_swebench_format(mobile_gym_results):
    """转换为类 SWE-bench 格式"""
    # ...
```

---

## 6. Dry-Run 模式

### 6.1 需求

在不调用 LLM 的情况下验证 task 设置和评估逻辑。

### 6.2 实现

```python
class DryRunAgent(BaseAgent):
    """执行预定义的动作序列，不调用 LLM"""

    def __init__(self, actions: list[Action]):
        self.actions = actions
        self.step = 0

    def act(self, observation: Observation) -> Action:
        if self.step >= len(self.actions):
            return Action(type=ActionType.COMPLETE)
        action = self.actions[self.step]
        self.step += 1
        return action
```

CLI：

```bash
# 验证 task 定义是否正确（不调用 LLM）
python -m bench_env.run --task-id wechat:open_chat_001 --dry-run

# 使用预定义动作序列
python -m bench_env.run --task-id wechat:open_chat_001 \
  --dry-run --actions-file actions.json
```

---

## 7. CI Smoke Test

### 7.1 Benchmark 层的 CI 验证

```yaml
# .github/workflows/ci.yml 中添加
  bench-smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      - run: npm ci
      - run: pip install -r bench_env/requirements.txt
      - run: playwright install chromium

      # 启动 dev server
      - run: npm run dev &
      - run: sleep 10  # 等待 server 就绪

      # 验证 task 列表可正常加载
      - run: python -m bench_env.run --list | head -20

      # 运行 dry-run（一个简单 task）
      - run: python -m bench_env.run --suite mini --dry-run --max-tasks 3
```

---

## 检查清单

### 近期
- [ ] 定义 mini / standard / full 三个 benchmark suite
- [ ] 为所有 task 补充 `description_en` 和 `complexity` 元数据
- [ ] 实现 `--dry-run` 模式
- [ ] 实现 benchmark 进度监控（ETA 显示）
- [ ] 添加 CI smoke test

### 中期
- [ ] 定义 Leaderboard 提交格式 JSON Schema
- [ ] 实现 `validate_submission.py`
- [ ] 创建 Leaderboard 页面（文档站内嵌）
- [ ] 增强评估维度（efficiency, precision, side_effects）
- [ ] Cross-App Task 标准化
- [ ] 并行执行自动重试机制

### 长期
- [ ] 提供 baseline 结果（GPT-4o, Claude 3.5 等主流模型）
- [ ] 结果格式转换工具（对比其他 benchmark）
- [ ] 动态难度调整 sampler
- [ ] 增量评估（只重跑失败/变更的 task）
- [ ] 年度 benchmark 版本冻结（v2026 等）
