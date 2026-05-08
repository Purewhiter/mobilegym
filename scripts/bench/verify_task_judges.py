#!/usr/bin/env python3
"""
bench_env 任务判别函数自动验证脚本 v2。

通过 Playwright 连接运行中的模拟器 (localhost:3000)，获取真实运行时状态，
而非从 defaults.json 推断 — 彻底消除因数据加载管道差异导致的误报。

层次 1：静态分析（无需模拟器）
  - 重复类名检测
  - expected_changes 一致性检查

层次 2：基于真实状态的运行时验证（需要模拟器）
  - CriteriaTask 路径存在性验证（对照 live state）
  - CriteriaTask 反向测试：用默认状态 evaluate() → 期望 success=False
  - CriteriaTask 正向测试：构造满足 criteria 的状态 → 期望 success=True
  - AnswerTask get_answer() 返回值合理性
  - 参数 source 路径验证
  - 参数采样测试
  - 自定义 check_goals 崩溃测试

前提：
  - npm run dev 已在 localhost:3000 运行
  - pip install playwright && playwright install chromium

用法:
    python scripts/bench/verify_task_judges.py                # 全部检查
    python scripts/bench/verify_task_judges.py --app wechat   # 只检查 wechat
    python scripts/bench/verify_task_judges.py --verbose       # 显示详细信息
    python scripts/bench/verify_task_judges.py --offline       # 离线模式（退回 defaults.json）
"""

from __future__ import annotations

import argparse
import asyncio
import copy
import inspect
import json
import sys
import traceback
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from bench_env.task.base import BaseTask, BaseApp
from bench_env.task.common_tasks import CriteriaTask, AnswerTask
from bench_env.task.judge import JudgeInput, JudgeResult
from bench_env.task.registry import TaskRegistry, _APP_MODULES
from bench_env.env.base import Observation


# ============================================================================
# Report data structures
# ============================================================================

@dataclass
class Issue:
    level: str  # ERROR, WARN, INFO
    task_id: str
    check: str
    message: str
    detail: str = ""


@dataclass
class Report:
    total_tasks: int = 0
    total_checks: int = 0
    issues: list[Issue] = field(default_factory=list)

    def add(self, level: str, task_id: str, check: str, message: str, detail: str = ""):
        self.issues.append(Issue(level, task_id, check, message, detail))

    @property
    def errors(self) -> list[Issue]:
        return [i for i in self.issues if i.level == "ERROR"]

    @property
    def warnings(self) -> list[Issue]:
        return [i for i in self.issues if i.level == "WARN"]


# ============================================================================
# Live state provider — connects to running simulator
# ============================================================================

class LiveStateProvider:
    """通过 Playwright 连接模拟器获取真实运行时状态。"""

    def __init__(self, url: str = "http://localhost:3000"):
        self.url = url
        self._state_cache: dict[str, Any] | None = None
        self._all_apps_state: dict[str, Any] | None = None

    async def fetch_all_states(self) -> dict[str, Any]:
        """
        Reset + warmup + waitForData + getState。
        返回 {"os": {...}, "apps": {"wechat": {...}, "redbook": {...}, ...}}
        """
        if self._state_cache is not None:
            return self._state_cache

        from playwright.async_api import async_playwright

        print(f"  连接模拟器 {self.url} ...")
        pw = await async_playwright().start()
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 360, "height": 800},
            device_scale_factor=3,
            is_mobile=True,
            has_touch=True,
        )
        page = await context.new_page()

        try:
            await page.goto(self.url, wait_until="domcontentloaded")

            # 1. 等待 __SIM__ 就绪
            print("  等待 __SIM__ 就绪 ...")
            await page.wait_for_function(
                "() => Boolean(window.__SIM__ && typeof window.__SIM__.getState === 'function')",
                timeout=20000,
            )

            # 2. Reset 到干净状态
            print("  Reset 模拟器 ...")
            await page.evaluate("async () => { await window.__SIM__.reset(); }")
            await page.wait_for_load_state("domcontentloaded")
            await page.wait_for_function(
                "() => Boolean(window.__SIM__ && typeof window.__SIM__.getState === 'function')",
                timeout=20000,
            )
            await page.wait_for_function(
                "() => Boolean(window.__SIM_FS__)",
                timeout=20000,
            )

            # 3. 预加载所有 App 的异步数据（loader.ts 的 preload）
            print("  预加载所有 App 数据 (waitForData) ...")
            await page.evaluate(
                "async () => { if (window.__SIM__?.waitForData) await window.__SIM__.waitForData(); }"
            )

            # 4. Warm up: 启动所有 App（触发 mount → _setEntities 等）
            print("  Warm up 所有 App ...")
            await page.evaluate("() => { window.__SIM__.warmUpAllApps(); }")
            # 给 App mount + useEffect 异步操作时间
            await page.wait_for_timeout(3000)

            # 5. 再次 waitForData 确保所有异步数据都到位
            await page.evaluate(
                "async () => { if (window.__SIM__?.waitForData) await window.__SIM__.waitForData(); }"
            )
            await page.wait_for_timeout(1000)

            # 6. 获取完整状态
            print("  获取 getState() ...")
            state = await page.evaluate("() => window.__SIM__?.getState?.() || null")

            if not state:
                raise RuntimeError("__SIM__.getState() 返回 null")

            self._state_cache = state
            apps = state.get("apps", {})
            print(f"  获取到 {len(apps)} 个 App 的状态: {', '.join(sorted(apps.keys()))}")
            return state

        finally:
            await context.close()
            await browser.close()
            await pw.stop()

    def get_app_state(self, app_id: str) -> dict | None:
        """从缓存中获取单个 App 的状态。"""
        if self._state_cache is None:
            return None
        return self._state_cache.get("apps", {}).get(app_id)

    def get_all_app_states(self) -> dict[str, Any]:
        """返回所有 App 状态的 dict。"""
        if self._state_cache is None:
            return {}
        return self._state_cache.get("apps", {})


# ============================================================================
# Offline fallback — load from defaults.json
# ============================================================================

def load_defaults_json(app_id: str) -> dict | None:
    """Load defaults.json for an app. Returns None if not found."""
    import re
    apps_dir = ROOT / "apps"
    for d in apps_dir.iterdir():
        if not d.is_dir():
            continue
        manifest_path = d / "manifest.ts"
        if not manifest_path.exists():
            continue
        text = manifest_path.read_text(encoding="utf-8")
        m = re.search(r"""id:\s*['"]([^'"]+)['"]""", text)
        if m and m.group(1) == app_id:
            defaults_path = d / "data" / "defaults.json"
            if defaults_path.exists():
                return json.loads(defaults_path.read_text(encoding="utf-8"))
    return None


_defaults_cache: dict[str, dict | None] = {}

def get_defaults(app_id: str) -> dict | None:
    if app_id not in _defaults_cache:
        _defaults_cache[app_id] = load_defaults_json(app_id)
    return _defaults_cache[app_id]


# ============================================================================
# Helpers
# ============================================================================

_SENTINEL = object()


def path_exists_in(obj: Any, path: str) -> tuple[bool, Any]:
    """Check if a dotted path structurally exists (even if value is None/null).

    Unlike BaseApp.get_by_path which returns None for both "missing" and "null",
    this uses `key in dict` checks to distinguish the two cases.
    """
    path = path.replace("[", ".").replace("]", "")
    parts = path.split(".")
    current = obj
    for part in parts:
        if current is None:
            return False, None
        if isinstance(current, dict):
            if part not in current:
                return False, None
            current = current[part]
        elif isinstance(current, list) and part.isdigit():
            idx = int(part)
            if idx >= len(current):
                return False, None
            current = current[idx]
        else:
            return False, None
    return True, current


def set_by_path(obj: dict, path: str, value: Any) -> dict:
    """Set a value in a nested dict by dotted path."""
    path = path.replace("[", ".").replace("]", "")
    parts = path.split(".")
    current = obj
    for part in parts[:-1]:
        if part.isdigit():
            idx = int(part)
            while len(current) <= idx:
                current.append({})
            if not isinstance(current[idx], (dict, list)):
                current[idx] = {}
            current = current[idx]
        else:
            if part not in current or not isinstance(current.get(part), (dict, list)):
                current[part] = {}
            current = current[part]
    last = parts[-1]
    if isinstance(current, dict):
        current[last] = value
    elif isinstance(current, list) and last.isdigit():
        idx = int(last)
        while len(current) <= idx:
            current.append(None)
        current[idx] = value
    return obj


def make_observation(state: dict, route: dict | None = None) -> Observation:
    """Create a minimal Observation for testing."""
    return Observation(
        screenshot_base64="",
        route=route or {"path": "/", "appId": ""},
        state=state,
    )


def get_task_classes_raw(app: str) -> list[type]:
    """Get task classes without instantiation, for static analysis."""
    import importlib
    try:
        module = importlib.import_module(f"bench_env.task.{app}.tasks")
    except ImportError:
        return []

    classes = []
    for name in dir(module):
        obj = getattr(module, name)
        if (
            isinstance(obj, type)
            and issubclass(obj, BaseTask)
            and obj is not BaseTask
            and not name.startswith("_")
        ):
            classes.append(obj)
    return classes


# ============================================================================
# Check 1: Duplicate class names within same module
# ============================================================================

def check_duplicate_classes(report: Report, apps: list[str]):
    import ast
    for app in apps:
        tasks_path = ROOT / "bench_env" / "task" / app / "tasks.py"
        if not tasks_path.exists():
            continue
        source = tasks_path.read_text(encoding="utf-8")
        try:
            tree = ast.parse(source)
        except SyntaxError:
            report.add("ERROR", f"{app}.*", "duplicate_class",
                        f"无法解析 {tasks_path.name}")
            continue
        class_names: dict[str, list[int]] = {}
        for node in ast.walk(tree):
            if isinstance(node, ast.ClassDef):
                class_names.setdefault(node.name, []).append(node.lineno)
        report.total_checks += 1
        for name, lines in class_names.items():
            if len(lines) > 1:
                report.add("ERROR", f"{app}.{name}", "duplicate_class",
                            f"类名 '{name}' 在 tasks.py 中重复定义于行 {lines}",
                            "后定义的类会覆盖前定义的类，导致前者的任务丢失")


# ============================================================================
# Check 2: CriteriaTask path existence against live state
# ============================================================================

def check_criteria_paths(report: Report, task_cls: type, state: dict):
    task_id = f"{task_cls.app}.{task_cls.__name__}"
    criteria = getattr(task_cls, "criteria", {})
    if isinstance(criteria, property):
        return
    if not criteria or not isinstance(criteria, dict):
        return

    for key, expected in criteria.items():
        report.total_checks += 1
        if key == "route":
            continue
        exists, actual = path_exists_in(state, key)
        if not exists:
            report.add("WARN", task_id, "path_exists",
                        f"路径 '{key}' 在运行时状态中不存在",
                        f"期望值: {expected!r}")
        elif actual is not None and not callable(expected):
            if isinstance(expected, str) and "{" in expected:
                continue
            if type(actual) != type(expected) and not (
                isinstance(actual, (int, float)) and isinstance(expected, (int, float))
            ):
                report.add("WARN", task_id, "type_mismatch",
                            f"路径 '{key}' 类型不匹配: state={type(actual).__name__}({actual!r}), "
                            f"criteria={type(expected).__name__}({expected!r})")


# ============================================================================
# Check 3: Parameter source paths
# ============================================================================

def check_param_sources(report: Report, task_cls: type, all_app_states: dict) -> set[str]:
    """Returns set of param names that had source warnings (to deduplicate sampler)."""
    task_id = f"{task_cls.app}.{task_cls.__name__}"
    parameters = getattr(task_cls, "parameters", {})
    warned_params: set[str] = set()
    if not parameters:
        return warned_params

    env_state = {"apps": all_app_states}

    for pname, spec in parameters.items():
        source = spec.get("source")
        if not source:
            continue
        report.total_checks += 1
        base_path = source.split("[")[0] if "[" in source else source
        value = BaseApp.get_by_path(env_state, base_path)
        if value is None:
            report.add("WARN", task_id, "param_source",
                        f"参数 '{pname}' 的 source '{source}' 在运行时状态中解析为 None")
            warned_params.add(pname)
    return warned_params


# ============================================================================
# Check 4: CriteriaTask evaluate — negative test
# ============================================================================

def check_criteria_negative(report: Report, task: BaseTask, state: dict):
    task_id = task.id
    report.total_checks += 1
    try:
        env_state = {"apps": {task.app: copy.deepcopy(state)}, "os": {}}
        init_obs = make_observation(copy.deepcopy(env_state), {"path": "/", "appId": task.app})
        last_obs = make_observation(env_state, {"path": "/", "appId": task.app})
        judge_input = JudgeInput(init_obs=init_obs, last_obs=last_obs)
        result = task.evaluate(judge_input)
        if result.success:
            report.add("WARN", task_id, "negative_test",
                        "默认状态下 evaluate() 返回 success=True，说明 criteria 初始状态已满足",
                        f"issues: {result.issues}")
    except Exception as e:
        report.add("ERROR", task_id, "negative_test",
                    f"evaluate() 异常: {e}",
                    traceback.format_exc())


# ============================================================================
# Check 5: CriteriaTask evaluate — positive test
# ============================================================================

def check_criteria_positive(report: Report, task: BaseTask, state: dict):
    task_id = task.id
    criteria = task.criteria if not isinstance(task.criteria, property) else None
    if criteria is None:
        try:
            criteria = task.criteria
        except Exception:
            return
    if not criteria or not isinstance(criteria, dict):
        return

    report.total_checks += 1
    try:
        modified = copy.deepcopy(state)
        route_path = "/"
        for key, expected in criteria.items():
            if callable(expected):
                continue
            if isinstance(expected, str) and "{" in expected:
                try:
                    expected = expected.format(**task.params)
                except KeyError:
                    pass
            if key == "route":
                route_path = expected if isinstance(expected, str) else (expected[0] if expected else "/")
            else:
                set_by_path(modified, key, expected)

        env_state = {"apps": {task.app: modified}, "os": {}}
        init_obs = make_observation(
            {"apps": {task.app: copy.deepcopy(state)}, "os": {}},
            {"path": "/", "appId": task.app}
        )
        last_obs = make_observation(env_state, {"path": route_path, "appId": task.app})
        judge_input = JudgeInput(init_obs=init_obs, last_obs=last_obs)
        result = task.evaluate(judge_input)
        if not result.success:
            report.add("ERROR", task_id, "positive_test",
                        "手动设置 criteria 对应状态后 evaluate() 仍返回 success=False",
                        f"issues: {result.issues}")
    except Exception as e:
        report.add("ERROR", task_id, "positive_test",
                    f"evaluate() 异常: {e}",
                    traceback.format_exc())


# ============================================================================
# Check 6: AnswerTask get_answer sanity
# ============================================================================

def check_answer_task(report: Report, task: BaseTask, state: dict, all_app_states: dict):
    """
    Check get_answer() with live runtime state.
    For cross-app tasks, include all involved app states.
    """
    task_id = task.id
    report.total_checks += 1

    try:
        apps_state = {task.app: copy.deepcopy(state)}
        for warm_app in getattr(task, "warm_apps", []) or []:
            if warm_app in all_app_states:
                apps_state[warm_app] = copy.deepcopy(all_app_states[warm_app])

        env_state = {"apps": apps_state, "os": {"time": 1700000000000}}
        init_obs = make_observation(copy.deepcopy(env_state), {"path": "/", "appId": task.app})
        last_obs = make_observation(env_state, {"path": "/", "appId": task.app})
        judge_input = JudgeInput(init_obs=init_obs, last_obs=last_obs)

        answer = task.get_answer(judge_input)
        if answer is None:
            report.add("WARN", task_id, "answer_sanity",
                        "get_answer() 返回 None（运行时数据下无法计算答案）")
    except Exception as e:
        report.add("ERROR", task_id, "answer_sanity",
                    f"get_answer() 异常: {e}",
                    traceback.format_exc())


# ============================================================================
# Check 7: Sampler test
# ============================================================================

def check_sampler(report: Report, task: BaseTask, all_app_states: dict,
                   warned_params: set[str] | None = None):
    task_id = task.id
    if not task.sampler:
        return
    report.total_checks += 1

    warned_params = warned_params or set()
    env_state = {"apps": all_app_states, "os": {"time": 1700000000000}}
    try:
        result = task.sampler.sample(env_state, task=task)
        for warning in result.warnings:
            # Skip "source returned empty" if param_source already flagged it
            if warned_params:
                is_dup = any(f"'{p}':" in warning for p in warned_params)
                if is_dup and "source returned empty" in warning:
                    continue
            report.add("WARN", task_id, "sampler",
                        f"采样警告: {warning}")
    except Exception as e:
        report.add("ERROR", task_id, "sampler",
                    f"采样异常: {e}",
                    traceback.format_exc())


# ============================================================================
# Check 8: expected_changes covers criteria keys
# ============================================================================

def check_expected_changes_coverage(report: Report, task_cls: type):
    task_id = f"{task_cls.app}.{task_cls.__name__}"
    criteria = getattr(task_cls, "criteria", {})
    if isinstance(criteria, property):
        return
    if not criteria or not isinstance(criteria, dict):
        return

    if not issubclass(task_cls, CriteriaTask):
        report.total_checks += 1
        static_expected = list(getattr(task_cls, "expected_changes", []))
        for key in criteria:
            if key == "route":
                continue
            covered = any(
                key == exp or key.startswith(exp + ".") or key.startswith(exp + "[")
                for exp in static_expected
            )
            if not covered:
                report.add("WARN", task_id, "expected_changes",
                            f"criteria 路径 '{key}' 未被 expected_changes 覆盖，"
                            "可能导致 clean=False（副作用误报）")


# ============================================================================
# Check 9: custom check_goals crash test
# ============================================================================

def check_custom_goals_crash(report: Report, task: BaseTask, state: dict, all_app_states: dict):
    task_id = task.id
    if isinstance(task, CriteriaTask) or isinstance(task, AnswerTask):
        return
    report.total_checks += 1

    try:
        apps_state = {task.app: copy.deepcopy(state)}
        for warm_app in getattr(task, "warm_apps", []) or []:
            if warm_app in all_app_states:
                apps_state[warm_app] = copy.deepcopy(all_app_states[warm_app])

        env_state = {"apps": apps_state, "os": {"time": 1700000000000}}
        init_obs = make_observation(copy.deepcopy(env_state), {"path": "/", "appId": task.app})
        last_obs = make_observation(env_state, {"path": "/", "appId": task.app})
        judge_input = JudgeInput(init_obs=init_obs, last_obs=last_obs)

        result = task.evaluate(judge_input)
        if result.issues:
            for issue in result.issues:
                if "error" in issue:
                    report.add("ERROR", task_id, "custom_goals_crash",
                                f"evaluate() 内部异常: {issue['error']}")
                elif issue.get("raised") or "raised" in str(issue.get("reason", "")):
                    report.add("ERROR", task_id, "custom_goals_crash",
                                f"evaluate() 内部异常: {issue}")
    except Exception as e:
        report.add("ERROR", task_id, "custom_goals_crash",
                    f"evaluate() 异常: {e}",
                    traceback.format_exc())


# ============================================================================
# Main orchestration
# ============================================================================

def run_checks(
    apps: list[str],
    all_app_states: dict[str, Any],
    verbose: bool = False,
) -> Report:
    report = Report()

    for app in apps:
        task_classes = get_task_classes_raw(app)
        if not task_classes:
            continue

        check_duplicate_classes(report, [app])

        for cls in task_classes:
            cls_app = getattr(cls, "app", "")
            if cls_app.replace("_", "") != app.replace("_", ""):
                continue

            task_id = f"{cls.app}.{cls.__name__}"
            report.total_tasks += 1

            # Resolve state for this task's app
            state = all_app_states.get(cls_app)

            # Static checks
            if state:
                check_criteria_paths(report, cls, state)
            warned_params = check_param_sources(report, cls, all_app_states)
            check_expected_changes_coverage(report, cls)

            # Instantiation
            try:
                task = cls()
            except Exception as e:
                report.add("ERROR", task_id, "instantiation",
                            f"无法实例化: {e}")
                continue

            # Sampler test (pass warned_params to suppress duplicates)
            check_sampler(report, task, all_app_states, warned_params)

            # Judge tests
            if state:
                if isinstance(task, CriteriaTask):
                    check_criteria_negative(report, task, state)
                    check_criteria_positive(report, task, state)
                elif isinstance(task, AnswerTask):
                    check_answer_task(report, task, state, all_app_states)
                else:
                    check_custom_goals_crash(report, task, state, all_app_states)

    return report


def print_report(report: Report, verbose: bool = False):
    print("\n" + "=" * 80)
    print(f"  bench_env 判别函数验证报告 (v2 — live state)")
    print(f"  任务总数: {report.total_tasks}  |  检查总数: {report.total_checks}")
    print(f"  ERROR: {len(report.errors)}  |  WARN: {len(report.warnings)}  |  "
          f"INFO: {len([i for i in report.issues if i.level == 'INFO'])}")
    print("=" * 80)

    app_errors: Counter = Counter()
    app_warns: Counter = Counter()
    check_counts: Counter = Counter()
    for issue in report.issues:
        app = issue.task_id.split(".")[0] if "." in issue.task_id else issue.task_id
        if issue.level == "ERROR":
            app_errors[app] += 1
        elif issue.level == "WARN":
            app_warns[app] += 1
        check_counts[issue.check] += 1

    print("\n┌─ 按 App 汇总 ─────────────────────────────────────────┐")
    all_apps = sorted(set(list(app_errors.keys()) + list(app_warns.keys())))
    for app in all_apps:
        e = app_errors.get(app, 0)
        w = app_warns.get(app, 0)
        bar = f"\033[91m{'█' * e}\033[93m{'▒' * min(w, 40)}\033[0m"
        print(f"  {app:30s}  E:{e:<3d} W:{w:<4d} {bar}")
    print("└───────────────────────────────────────────────────────┘")

    print("\n┌─ 按检查类型汇总 ───────────────────────────────────────┐")
    for check, count in check_counts.most_common():
        errs = len([i for i in report.issues if i.check == check and i.level == "ERROR"])
        warns = len([i for i in report.issues if i.check == check and i.level == "WARN"])
        print(f"  {check:30s}  E:{errs:<3d} W:{warns:<4d} (共 {count})")
    print("└───────────────────────────────────────────────────────┘")

    errors = report.errors
    if errors:
        print(f"\n\033[91m{'─' * 60}")
        print(f"  [ERROR] 详情 ({len(errors)} 项)")
        print(f"{'─' * 60}\033[0m")
        for issue in errors:
            print(f"\n  \033[91m[ERROR]\033[0m {issue.task_id}")
            print(f"    检查: {issue.check}")
            print(f"    {issue.message}")
            if issue.detail:
                for line in issue.detail.strip().split("\n")[:5]:
                    print(f"    {line}")

    warnings = report.warnings
    if warnings:
        print(f"\n\033[93m{'─' * 60}")
        print(f"  [WARN] 去重后详情")
        print(f"{'─' * 60}\033[0m")

        warn_groups: dict[tuple[str, str], list[Issue]] = defaultdict(list)
        for w in warnings:
            key = (w.check, w.message)
            warn_groups[key].append(w)

        shown_patterns: dict[str, int] = {}
        for (check, msg), group in sorted(warn_groups.items(), key=lambda x: -len(x[1])):
            pattern_key = f"{check}|{msg[:80]}"
            if pattern_key in shown_patterns:
                continue
            count = len(group)
            if count > 3 and not verbose:
                sample = group[0]
                print(f"\n  \033[93m[WARN x{count}]\033[0m {sample.task_id} (及其他 {count-1} 个)")
                print(f"    检查: {check}")
                print(f"    {msg}")
                shown_patterns[pattern_key] = count
            else:
                for issue in group:
                    print(f"\n  \033[93m[WARN]\033[0m {issue.task_id}")
                    print(f"    检查: {issue.check}")
                    print(f"    {issue.message}")
                    if issue.detail and verbose:
                        for line in issue.detail.strip().split("\n")[:5]:
                            print(f"    {line}")
                shown_patterns[pattern_key] = count

    print()


async def async_main():
    parser = argparse.ArgumentParser(description="验证 bench_env 任务判别函数 (v2)")
    parser.add_argument("--app", help="只检查指定 app")
    parser.add_argument("--verbose", "-v", action="store_true", help="显示详细信息")
    parser.add_argument("--offline", action="store_true",
                        help="离线模式：用 defaults.json 替代 live state（会有误报）")
    parser.add_argument("--url", default="http://localhost:3000", help="模拟器地址")
    args = parser.parse_args()

    if args.app:
        apps = [args.app]
    else:
        apps = list(_APP_MODULES)

    print(f"正在验证 {len(apps)} 个 app 的任务判别函数...")
    print(f"Apps: {', '.join(apps)}")

    if args.offline:
        print("\n[离线模式] 从 defaults.json 加载状态（可能有误报）")
        all_app_states: dict[str, Any] = {}
        for app in apps:
            # Collect all app_ids from task classes
            task_classes = get_task_classes_raw(app)
            for cls in task_classes:
                app_id = getattr(cls, "app", "")
                if app_id and app_id not in all_app_states:
                    d = get_defaults(app_id)
                    if d is not None:
                        all_app_states[app_id] = d
                for warm_app in getattr(cls, "warm_apps", []) or []:
                    if warm_app not in all_app_states:
                        d = get_defaults(warm_app)
                        if d is not None:
                            all_app_states[warm_app] = d
    else:
        print(f"\n[在线模式] 连接模拟器 {args.url}")
        provider = LiveStateProvider(args.url)
        try:
            full_state = await provider.fetch_all_states()
            all_app_states = full_state.get("apps", {})
        except Exception as e:
            print(f"\n  连接模拟器失败: {e}")
            print("  提示: 确保 npm run dev 在运行，或使用 --offline 模式")
            sys.exit(1)

    print()
    report = run_checks(apps, all_app_states, args.verbose)
    print_report(report, args.verbose)

    if report.errors:
        sys.exit(1)
    sys.exit(0)


def main():
    asyncio.run(async_main())


if __name__ == "__main__":
    main()
