"""Task listing collection and rendering helpers."""

from __future__ import annotations

from dataclasses import dataclass
import inspect
from pathlib import Path
from typing import Any

from bench_env.task import TaskRegistry


_MAX_DEFAULT_LEN = 24


@dataclass(frozen=True)
class ParamInfo:
    name: str
    type: str
    default: str
    in_template: bool
    source: str


@dataclass(frozen=True)
class TaskSummary:
    task_id: str
    description: str
    templates: list[str]
    difficulty: str
    scope: str
    objective: str
    composition: str
    capabilities: list[str]
    optimal_paths: int
    apps: list[str]
    param_list: list[ParamInfo]
    sampled_count: int | None = None


@dataclass(frozen=True)
class TaskGroup:
    suite: str
    tasks: list[TaskSummary]


# ── helpers ──────────────────────────────────────────────────────────────


def _extract_templates(task_cls: type) -> list[str]:
    """Collect instruction templates from a task class."""
    raw = getattr(task_cls, "templates", [])
    if isinstance(raw, str):
        raw = [raw]
    templates: list[str] = []
    if isinstance(raw, (list, tuple)):
        for t in raw:
            text = str(t or "").strip()
            if text and text not in templates:
                templates.append(text)
    return templates


def _evaluate_default_value(raw_default: Any) -> Any:
    """Evaluate zero-arg callable defaults for listing purposes."""
    if not callable(raw_default):
        return raw_default
    try:
        sig = inspect.signature(raw_default)
    except (TypeError, ValueError):
        return raw_default
    required = [
        p for p in sig.parameters.values()
        if p.default is inspect._empty
        and p.kind in (inspect.Parameter.POSITIONAL_ONLY, inspect.Parameter.POSITIONAL_OR_KEYWORD)
    ]
    if required:
        return raw_default
    try:
        return raw_default()
    except Exception:
        return raw_default


def _resolve_display_default(
    raw_default: Any,
    pschema: dict,
    env_state: dict[str, Any] | None = None,
) -> str:
    """Apply display mapping to a default value for listing purposes."""
    raw_default = _evaluate_default_value(raw_default)
    if raw_default is None:
        return ""
    display = pschema.get("display")
    if display is None:
        values = pschema.get("values")
        if isinstance(values, dict):
            display = {iv: dv for dv, iv in values.items()}
    if display is not None:
        if isinstance(display, dict) and raw_default in display:
            return str(display[raw_default])
        if isinstance(display, str):
            from bench_env.task.base import _BUILTIN_DISPLAY
            builtin = _BUILTIN_DISPLAY.get(display)
            if builtin is not None:
                return builtin(raw_default)
        if callable(display):
            try:
                n = len(inspect.signature(display).parameters)
            except (TypeError, ValueError):
                n = 1
            try:
                if n >= 2 and env_state is not None:
                    return str(display(raw_default, env_state))
                if n < 2:
                    return str(display(raw_default))
            except Exception:
                pass
    if isinstance(raw_default, bool):
        return "开启" if raw_default else "关闭"
    return str(raw_default)


def _fallback_task_description(task: Any, templates: list[str]) -> str:
    """Fallback formatter for listing when env-aware display cannot run."""
    if getattr(task, "task_name", ""):
        return str(task.task_name)
    if not templates:
        return ""
    tpl = templates[0]
    render_params: dict[str, Any] = {}
    for k, v in getattr(task, "params", {}).items():
        schema = getattr(task, "parameters", {}).get(k, {})
        display = schema.get("display")
        if display is None:
            values = schema.get("values")
            if isinstance(values, dict):
                display = {iv: dv for dv, iv in values.items()}
        if display is not None and hasattr(task, "_apply_display"):
            try:
                render_params[k] = task._apply_display(k, v, display)
                continue
            except Exception:
                pass
        render_params[k] = "开启" if isinstance(v, bool) and v else "关闭" if isinstance(v, bool) else v
    try:
        return tpl.format(**render_params)
    except Exception:
        return tpl


def _render_task_description(task: Any, templates: list[str]) -> str:
    """Render description for listing without letting one formatter break all tasks."""
    try:
        rendered = task.description
    except Exception:
        rendered = _fallback_task_description(task, templates)
    return rendered or "(no description)"


def _collect_params(
    task_cls: type,
    templates: list[str],
    *,
    env_state: dict[str, Any] | None = None,
) -> list[ParamInfo]:
    """Collect parameter metadata from a task class."""
    parameters = getattr(task_cls, "parameters", {}) or {}
    if not parameters:
        return []

    tpl_text = "\n".join(templates)
    result: list[ParamInfo] = []
    for pname, pschema in parameters.items():
        ptype = str(pschema.get("type", "")).strip() or "?"
        raw_default = pschema.get("default")
        pdefault = _resolve_display_default(raw_default, pschema, env_state=env_state)
        psource = str(pschema.get("source", "") or "").strip()
        in_tpl = ("{" + pname + "}") in tpl_text
        result.append(ParamInfo(
            name=pname, type=ptype, default=pdefault,
            in_template=in_tpl, source=psource,
        ))
    return result


def _truncate(s: str, maxlen: int = _MAX_DEFAULT_LEN) -> str:
    return s if len(s) <= maxlen else s[: maxlen - 1] + "…"


def _has_params(task: TaskSummary) -> bool:
    return len(task.param_list) > 0


def _count_parameterized(groups: list[TaskGroup]) -> int:
    return sum(1 for g in groups for t in g.tasks if _has_params(t))


def _count_tpl_used(groups: list[TaskGroup]) -> int:
    """Tasks where at least one param appears as {param} in template."""
    return sum(
        1 for g in groups for t in g.tasks
        if any(p.in_template for p in t.param_list)
    )


def _has_sampled(groups: list[TaskGroup]) -> bool:
    return any(t.sampled_count is not None for g in groups for t in g.tasks)


def _total_sampled(groups: list[TaskGroup]) -> int:
    return sum(t.sampled_count or 1 for g in groups for t in g.tasks)


def _group_sampled(tasks: list[TaskSummary]) -> int:
    return sum(t.sampled_count or 1 for t in tasks)


# ── collect ──────────────────────────────────────────────────────────────


def _task_cls_matches_filters(
    task_cls: type,
    filter_difficulty: list[str] | None,
    filter_objective: list[str] | None,
    filter_composition: list[str] | None,
    filter_scope: list[str] | None,
    filter_capabilities: list[str] | None,
    filter_mode: str = "and",
) -> bool:
    """Return True if task_cls passes active filters.

    AND mode: all active filters must match.
    OR mode: at least one active filter must match.
    """
    checks: list[bool] = []
    if filter_difficulty:
        checks.append(getattr(task_cls, "difficulty", None) in filter_difficulty)
    if filter_objective:
        checks.append(getattr(task_cls, "objective", None) in filter_objective)
    if filter_composition:
        checks.append(getattr(task_cls, "composition", None) in filter_composition)
    if filter_scope:
        checks.append(getattr(task_cls, "scope", None) in filter_scope)
    if filter_capabilities:
        task_caps = set(getattr(task_cls, "capabilities", []) or [])
        checks.append(bool(task_caps.intersection(filter_capabilities)))
    if not checks:
        return True
    return any(checks) if filter_mode == "or" else all(checks)


def collect_task_groups(
    suite: list[str] | None = None,
    *,
    include_generated: bool = False,
    env_state: dict[str, Any] | None = None,
    sample_n: int | None = None,
    filter_difficulty: list[str] | None = None,
    filter_objective: list[str] | None = None,
    filter_composition: list[str] | None = None,
    filter_scope: list[str] | None = None,
    filter_capabilities: list[str] | None = None,
    filter_mode: str = "and",
    filter_has_answer_fields: bool | None = None,
    split_task_ids: frozenset[str] | set[str] | None = None,
) -> tuple[list[TaskGroup], int]:
    """Collect task metadata for rendering.

    Args:
        suite: Suite name(s) to filter. If None, shows all suites.
        include_generated: Include generated task suites (from
            ``bench_env/generated_task/``). Default False.
        env_state: Optional simulator state for env-aware display rendering.
        sample_n: If set, compute sampled instance count per task.
        filter_difficulty/objective/composition/scope/capabilities: Field-level
            filters (AND between fields, OR within each field; capabilities=ANY).
    """
    from bench_env.task.registry import _max_instances

    registry = TaskRegistry()
    selected = suite or registry.list_suites(include_generated=include_generated)

    groups: list[TaskGroup] = []
    total = 0
    for suite_name in selected:
        task_names = registry.list_tasks(suite_name)
        if not task_names:
            continue

        tasks: list[TaskSummary] = []
        for name in task_names:
            if split_task_ids is not None and f"{suite_name}.{name}" not in split_task_ids:
                continue
            task_cls = registry.get(suite_name, name)
            if not _task_cls_matches_filters(
                task_cls,
                filter_difficulty, filter_objective,
                filter_composition, filter_scope, filter_capabilities,
                filter_mode,
            ):
                continue
            if filter_has_answer_fields is not None:
                has_af = bool(getattr(task_cls, "answer_fields", None))
                if has_af != filter_has_answer_fields:
                    continue
            task = task_cls()
            if env_state is not None:
                task._env_state = env_state
            templates = _extract_templates(task_cls)
            sampled = _max_instances(task_cls, sample_n) if sample_n is not None else None
            tasks.append(
                TaskSummary(
                    task_id=f"{suite_name}.{name}",
                    description=_render_task_description(task, templates),
                    templates=templates,
                    difficulty=task_cls.difficulty,
                    scope=task_cls.scope,
                    objective=task_cls.objective,
                    composition=task_cls.composition,
                    capabilities=list(task_cls.capabilities),
                    optimal_paths=len(task_cls.optimal_paths),
                    apps=list(task_cls.apps),
                    param_list=_collect_params(task_cls, templates, env_state=env_state),
                    sampled_count=sampled,
                )
            )
            total += 1

        if tasks:
            groups.append(TaskGroup(suite=suite_name, tasks=tasks))

    return groups, total


# ── text output ──────────────────────────────────────────────────────────


def _format_param_text(p: ParamInfo) -> str:
    """Format a single param for terminal: {name}(type ="val") or [name](type ="val")."""
    wrap_l, wrap_r = ("{", "}") if p.in_template else ("[", "]")
    default_part = f' ="{_truncate(p.default)}"' if p.default else ""
    source_part = f" ←{p.source}" if p.source else ""
    return f"{wrap_l}{p.name}{wrap_r}({p.type}{default_part}{source_part})"


def render_task_list_text(groups: list[TaskGroup], total: int) -> str:
    """Render task list as terminal-friendly plain text."""
    param_total = _count_parameterized(groups)
    tpl_used_total = _count_tpl_used(groups)
    show_sampled = _has_sampled(groups)
    lines: list[str] = []
    for group in groups:
        group_param = sum(1 for t in group.tasks if _has_params(t))
        header = f"\n[{group.suite}] ({len(group.tasks)} tasks, {group_param} parameterized"
        if show_sampled:
            header += f", {_group_sampled(group.tasks)} instances"
        header += ")"
        lines.append(header)
        lines.append("-" * 60)

        for task in group.tasks:
            task_label = f"  {task.task_id}"
            if show_sampled and task.sampled_count is not None and task.sampled_count > 1:
                task_label += f"  ×{task.sampled_count}"
            lines.append(task_label)
            lines.append(f"    {task.description}")
            if task.param_list:
                lines.append(f"    params: {' | '.join(_format_param_text(p) for p in task.param_list)}")
            lines.append(
                f"    {task.difficulty} | {task.scope} | "
                f"{task.objective} | {task.composition}"
            )
            if task.capabilities:
                lines.append(f"    caps: {', '.join(task.capabilities)}")
            if task.optimal_paths:
                lines.append(f"    optimal_paths: {task.optimal_paths} path(s)")
            lines.append("")

    summary = (
        f"\nTotal: {total} tasks"
        f" · {param_total} parameterized"
        f" ({tpl_used_total} in-template, {param_total - tpl_used_total} internal-only)"
    )
    if show_sampled:
        sampled_total = _total_sampled(groups)
        summary += f"\nSampled: {sampled_total} instances (sample_n applied)"
    return "\n".join(lines) + summary


# ── markdown helpers ─────────────────────────────────────────────────────


_DIFFICULTY_META: dict[str, tuple[str, str, int]] = {
    "L1": ("🟢", "Easy", 1),
    "L2": ("🔵", "Medium", 2),
    "L3": ("🟡", "Hard", 3),
    "L4": ("🔴", "Expert", 4),
}

_SUITE_ICONS: dict[str, str] = {
    "account": "🔐",
    "alipay": "💰",
    "bilibili": "📺",
    "crossapp_commerce": "🛍️",
    "crossapp_content": "📰",
    "crossapp_life": "🌤️",
    "crossapp_work": "💼",
    "device": "📱",
    "ebay": "🛒",
    "map": "🗺️",
    "payment": "💳",
    "railway12306": "🚄",
    "redbook": "📕",
    "spotify": "🎵",
    "tencent_meeting": "📹",
    "weather": "🌤️",
    "wechat": "💬",
    "wechat_reading": "📖",
    "x": "🐦",
}


def _html_escape(value: object) -> str:
    text = str(value)
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def _difficulty_sort_key(level: str) -> tuple[int, str]:
    return _DIFFICULTY_META.get(level, ("", "", 999))[2], level


def _difficulty_badge(level: str) -> str:
    icon, label, _ = _DIFFICULTY_META.get(level, ("⚪", level, 999))
    return f"{icon} **{level}** {label}"


def _bar_chart(counts: dict[str, int], total: int) -> list[str]:
    if not total:
        return []
    bar_width = 20
    lines: list[str] = []
    for level in sorted(counts, key=_difficulty_sort_key):
        icon, label, _ = _DIFFICULTY_META.get(level, ("⚪", level, 999))
        count = counts[level]
        filled = round(count / total * bar_width)
        bar = "█" * filled + "░" * (bar_width - filled)
        pct = count / total * 100
        lines.append(f"| {icon} **{level}** {label} | `{bar}` | **{count}** | {pct:.0f}% |")
    return lines


def _render_param_html(p: ParamInfo) -> str:
    """Render one param as HTML snippet.

    - in-template params → bold name
    - internal-only params → italic name
    """
    name_escaped = _html_escape(p.name)
    if p.in_template:
        name_html = f"<b>{name_escaped}</b>"
    else:
        name_html = f"<i>{name_escaped}</i>"
    type_html = f"<sub>{_html_escape(p.type)}</sub>"
    default_html = ""
    if p.default:
        default_html = f" <code>{_html_escape(_truncate(p.default))}</code>"
    source_html = ""
    if p.source:
        source_html = f' <sub title="sampled from">←{_html_escape(p.source)}</sub>'
    return f"{name_html} {type_html}{default_html}{source_html}"


def _render_params_cell(param_list: list[ParamInfo]) -> str:
    if not param_list:
        return "—"
    return "<br>".join(_render_param_html(p) for p in param_list)


# ── markdown output ──────────────────────────────────────────────────────


def render_task_list_markdown(groups: list[TaskGroup], total: int) -> str:
    """Render task list as categorized Markdown tables with visual styling."""

    global_difficulty: dict[str, int] = {}
    for g in groups:
        for t in g.tasks:
            global_difficulty[t.difficulty] = global_difficulty.get(t.difficulty, 0) + 1

    param_total = _count_parameterized(groups)
    tpl_used = _count_tpl_used(groups)
    internal_only = param_total - tpl_used
    show_sampled = _has_sampled(groups)

    summary_line = (
        f"> **总任务数 {total}** · **{len(groups)} 个应用套件** · "
        f"**带参数 {param_total}**（模板参数 {tpl_used} · 仅内部 {internal_only}）"
    )
    if show_sampled:
        summary_line += f" · **采样后实例 {_total_sampled(groups)}**"

    lines = [
        "# 📋 bench_env 任务列表",
        "",
        summary_line,
        "",
        "---",
        "",
        "## 📊 总览",
        "",
    ]

    # difficulty distribution
    lines.extend([
        "### 难度分布",
        "",
        "| 难度 | 分布 | 数量 | 占比 |",
        "| :--- | :--- | ---: | ---: |",
    ])
    lines.extend(_bar_chart(global_difficulty, total))
    lines.append("")

    # per-suite stats
    diff_keys = sorted(global_difficulty, key=_difficulty_sort_key)
    sampled_col = " | 采样实例" if show_sampled else ""
    sampled_align = " | ---:" if show_sampled else ""
    lines.extend([
        "### 应用任务统计",
        "",
        "| 应用 | 任务数 | 带参数" + sampled_col + " | " + " | ".join(
            f"{_DIFFICULTY_META.get(d, ('⚪', d, 999))[0]} {d}" for d in diff_keys
        ) + " |",
        "| :--- | ---: | ---:" + sampled_align + " | " + " | ".join("---:" for _ in diff_keys) + " |",
    ])
    for group in groups:
        icon = _SUITE_ICONS.get(group.suite, "📦")
        diff_counts: dict[str, int] = {}
        for t in group.tasks:
            diff_counts[t.difficulty] = diff_counts.get(t.difficulty, 0) + 1
        p_count = sum(1 for t in group.tasks if _has_params(t))
        cells = [f"{icon} **{group.suite}**", str(len(group.tasks)), str(p_count)]
        if show_sampled:
            cells.append(str(_group_sampled(group.tasks)))
        for d in diff_keys:
            c = diff_counts.get(d, 0)
            cells.append(str(c) if c else "·")
        lines.append("| " + " | ".join(cells) + " |")
    lines.append("")

    # param legend
    lines.extend([
        "### 参数标记说明",
        "",
        "| 样式 | 含义 |",
        "| :--- | :--- |",
        "| **粗体** 参数名 | 出现在任务模板 `{param}` 占位符中，Agent 可见 |",
        "| *斜体* 参数名 | 仅用于环境准备 / 判题 / 采样，不出现在指令中 |",
        "| `默认值` | 列举时使用的默认值（运行时可能被采样覆盖） |",
        "| ←source | 从环境状态采样的路径 |",
        "",
    ])

    lines.extend(["---", ""])

    # per-suite task tables
    for group in groups:
        icon = _SUITE_ICONS.get(group.suite, "📦")

        difficulty_counts: dict[str, int] = {}
        tasks_by_difficulty: dict[str, list[TaskSummary]] = {}
        for task in group.tasks:
            difficulty_counts[task.difficulty] = difficulty_counts.get(task.difficulty, 0) + 1
            tasks_by_difficulty.setdefault(task.difficulty, []).append(task)

        suite_param_count = sum(1 for t in group.tasks if _has_params(t))
        suite_header = (
            f"> **{len(group.tasks)}** 个任务 · **带参数 {suite_param_count}** · "
            + " ".join(
                f"{_DIFFICULTY_META.get(d, ('⚪', d, 999))[0]} {d}×{difficulty_counts[d]}"
                for d in sorted(difficulty_counts, key=_difficulty_sort_key)
            )
        )
        if show_sampled:
            suite_header += f" · **采样实例 {_group_sampled(group.tasks)}**"
        lines.extend([
            f"## {icon} {group.suite}",
            "",
            suite_header,
            "",
        ])

        for difficulty in sorted(tasks_by_difficulty, key=_difficulty_sort_key):
            difficulty_tasks = tasks_by_difficulty[difficulty]
            badge = _difficulty_badge(difficulty)
            lines.extend([
                f"### {badge} ({len(difficulty_tasks)})",
                "",
                "<table>",
                "<tr>"
                '<th align="right">#</th>'
                "<th>Task ID</th>"
                "<th>Params</th>"
                "<th>App</th>"
                '<th align="center">Scope</th>'
                '<th align="center">Objective</th>'
                '<th align="center">Composition</th>'
                "</tr>",
            ])
            for idx, task in enumerate(difficulty_tasks, 1):
                apps_text = ", ".join(task.apps) if task.apps else "—"
                desc = _html_escape(task.description)
                if task.description == "(no description)":
                    desc = "<em>（无描述）</em>"
                tid = _html_escape(task.task_id)
                sampled_html = ""
                if show_sampled and task.sampled_count is not None and task.sampled_count > 1:
                    sampled_html = f" <sup>×{task.sampled_count}</sup>"
                caps_html = ""
                if task.capabilities:
                    caps_html = "<br>" + " ".join(
                        f"<code>{_html_escape(c)}</code>" for c in task.capabilities
                    )
                params_html = _render_params_cell(task.param_list)
                lines.append(
                    f"<tr>"
                    f'<td align="right">{idx}</td>'
                    f"<td><b><code>{tid}</code></b>{sampled_html}<br>"
                    f"<sub>{desc}</sub>{caps_html}</td>"
                    f"<td>{params_html}</td>"
                    f"<td>{_html_escape(apps_text)}</td>"
                    f'<td align="center"><code>{_html_escape(task.scope)}</code></td>'
                    f'<td align="center"><code>{_html_escape(task.objective)}</code></td>'
                    f'<td align="center"><code>{_html_escape(task.composition)}</code></td>'
                    f"</tr>"
                )
            lines.extend(["</table>", ""])

        lines.extend(["---", ""])

    footer = (
        f"*共 **{total}** 个任务，"
        f"其中 **{param_total}** 个带参数"
        f"（模板参数 {tpl_used}，仅内部 {internal_only}）"
    )
    if show_sampled:
        footer += f"，采样后共 **{_total_sampled(groups)}** 个实例"
    footer += f" · 由 `bench_env/task_listing.py` 自动生成*"
    lines.append(footer)
    lines.append("")
    return "\n".join(lines)


# ── entry point ──────────────────────────────────────────────────────────


def _collect_listing_app_ids(
    suite: list[str] | None = None,
    *,
    include_generated: bool = False,
) -> list[str]:
    """Collect app ids referenced by the selected task suites."""
    registry = TaskRegistry()
    selected = suite or registry.list_suites(include_generated=include_generated)
    app_ids: list[str] = []
    seen: set[str] = set()
    for suite_name in selected:
        for name in registry.list_tasks(suite_name):
            task_cls = registry.get(suite_name, name)
            for app_id in getattr(task_cls, "apps", []) or []:
                app_text = str(app_id or "").strip()
                if not app_text or app_text in seen:
                    continue
                seen.add(app_text)
                app_ids.append(app_text)
    return app_ids


async def _load_listing_env_state(
    suite: list[str] | None = None,
    *,
    include_generated: bool = False,
    online: bool = False,
    env_url: str | None = None,
    proxy: str | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """Best-effort simulator state loading for env-aware task listing."""
    if not online:
        return None, None
    if not env_url:
        return None, None

    from bench_env.env import MobileGymEnv

    app_ids = _collect_listing_app_ids(suite, include_generated=include_generated)
    env = MobileGymEnv(
        url=env_url,
        headless=True,
        proxy=proxy,
        coord_space="norm_0_1000",
        delay_after_action=0.0,
        verbose=False,
        viewport_size=(360, 800),
        physical_size=(1080, 2400),
        device_scale_factor=3,
    )
    try:
        await env.start()
        await env.wait_ready(app_ids=app_ids or None)
        state = await env.get_state()
        if state:
            return state, f"[INFO] 使用模拟器状态在线渲染任务文案: {env_url}"
        return None, f"[WARN] 模拟器已连接，但未读取到有效 state，改为离线渲染: {env_url}"
    except Exception as e:
        return None, f"[WARN] 无法读取模拟器 state，改为离线渲染: {type(e).__name__}: {e}"
    finally:
        await env.close()


async def list_tasks(
    suite: list[str] | None = None,
    *,
    include_generated: bool = False,
    markdown_path: str | None = None,
    online: bool = False,
    env_url: str | None = None,
    proxy: str | None = None,
    sample_n: int | None = None,
    filter_difficulty: list[str] | None = None,
    filter_objective: list[str] | None = None,
    filter_composition: list[str] | None = None,
    filter_scope: list[str] | None = None,
    filter_capabilities: list[str] | None = None,
    filter_mode: str = "and",
    filter_has_answer_fields: bool | None = None,
    split_task_ids: frozenset[str] | set[str] | None = None,
) -> None:
    """List all available tasks and optionally export Markdown."""
    env_state, notice = await _load_listing_env_state(
        suite,
        include_generated=include_generated,
        online=online,
        env_url=env_url,
        proxy=proxy,
    )
    if notice:
        print(notice)

    groups, total = collect_task_groups(
        suite,
        include_generated=include_generated,
        env_state=env_state,
        sample_n=sample_n,
        filter_difficulty=filter_difficulty,
        filter_objective=filter_objective,
        filter_composition=filter_composition,
        filter_scope=filter_scope,
        filter_capabilities=filter_capabilities,
        filter_mode=filter_mode,
        filter_has_answer_fields=filter_has_answer_fields,
        split_task_ids=split_task_ids,
    )
    print(render_task_list_text(groups, total))

    if markdown_path:
        output_path = Path(markdown_path).expanduser()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(render_task_list_markdown(groups, total), encoding="utf-8")
        print(f"[INFO] Markdown written to {output_path}")
