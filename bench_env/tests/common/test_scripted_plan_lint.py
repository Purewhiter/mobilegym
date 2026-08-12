"""Static lint for scripted plans — the anti "direct-fill" regression gate.

Phase 4 of the ScriptedAgent plan hardening effort: after the direct-fill /
semi-direct-fill plans were given real navigation paths (some with on-screen
evidence asserts, some without), this offline test locks the invariants in a
machine-checkable form so query plans cannot silently regress back to typing
answers into the AnswerSheet without ever *reading* them from the screen.

Zero per-task declarations — every signal is inferred from existing artifacts:

- task classes (``TaskRegistry``): ``apps`` / ``objective`` / ``answer_fields``
  / ``parameters``;
- plan step dicts (``bench_env.tests.<suite>.scripted_plans.PLANS`` — the DSL
  helpers in ``bench_env.agent.scripted`` materialize plans into plain step
  dicts at import time, so no extra compilation is needed here);
- the display-name → appId map (``MobileGymEnv.APP_NAME_MAP``).

The *answer phase* of a plan starts at the first ``awake`` step whose app name
resolves to the AnswerSheet (``答题卡``); plans without such a step have their
answer phase at the plan end.

Rules (implemented in ``_lint_plan``):

- **R2 (main)** — query tasks (``objective`` in {query, hybrid}, or non-empty
  ``answer_fields``) must carry ≥1 assert step (``assert_visible`` /
  ``assert_answer`` — ``assert_text`` compiles to the former) *before* the
  answer phase starts. Navigation step count is deliberately NOT checked: a
  task whose initial screen already shows the answer is legal with 0
  navigation steps + 1 assert.
- **R1** — *injected params* (plan placeholders neither declared in
  ``task.parameters`` nor produced by ``_with_derived_params`` — currently
  only the calendar label aliases) that flow into answer-phase type/click
  steps need assert endorsement. This first version is deliberately loose to
  avoid drowning the report in duplicates: any pre-answer assert (i.e. R2
  satisfied) endorses all injected params.
  TODO(tighten): per-param endorsement — require that some assert step's
  rendered string references ``{name}`` or ``{name_screen}`` for each
  injected param that flows into the answer phase.
- **R3** — multi-app tasks (``len(task.apps) > 1``) must ``awake`` every
  declared appId at least once (display names normalized via
  ``APP_NAME_MAP``; the AnswerSheet awake does not count). Single-app tasks
  are exempt: ``BaseTask.setup`` auto-opens the app.
- **R4** — assert hygiene: no assert steps at/after the answer-phase start
  (violation); assert values that are pure digits shorter than 4 chars
  without ``exact`` matching / a narrowed scope are reported as warnings
  only (never fail, even in STRICT mode).

Mode: runs in **STRICT mode** (backlog cleared 2026-08-12) — every violation
(not R4 value warnings) fails the test. A structured report grouped by suite
is always printed and written to ``/tmp/scripted_lint_report.md``.

Exemptions: a suite's ``scripted_plans.py`` may declare
``LINT_EXEMPT: dict[str, str]`` (task_id → mandatory reason). Exempted plans
are skipped entirely and listed in the report; an entry with a blank reason
does NOT exempt (the plan is still linted) and is flagged in the report.
"""

from __future__ import annotations

import importlib
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.registry import TaskRegistry

# Flipped to True on 2026-08-12 (backlog cleared) — every R1/R2/R3/R4
# violation is now a hard test failure (R4 value warnings stay warnings).
STRICT = True

REPORT_PATH = Path("/tmp/scripted_lint_report.md")

_TESTS_ROOT = Path(__file__).resolve().parents[1]

ASSERT_OPS = frozenset({"assert_visible", "assert_answer"})

# Ops through which an injected answer value can "flow" inside the answer
# phase: typing it into the sheet, or clicking a choice/keypad control whose
# selector embeds the rendered value.
ANSWER_FLOW_OPS = frozenset(
    {"type", "click", "tap", "tap_trigger", "tap_action", "keypad_text"}
)

# Derived-param aliases produced by bench_env.agent.scripted._with_derived_params
# (calendar-only UI-label lookups). They are derived from *declared* params, so
# they are not "injected" in the R1 sense.
CALENDAR_ALIAS_PARAMS = frozenset(
    {"reminderLabel", "reminderChoice", "r1Label", "r2Label", "r3Label"}
)

ANSWER_SHEET_APP_ID = "answer_sheet"
DEFAULT_ASSERT_SCOPE = "[data-adjust-resize]"

_KNOWN_APP_IDS = frozenset(MobileGymEnv.APP_NAME_MAP.values())

# str.format named field: leading identifier, optionally followed by an
# index / attribute / conversion / format-spec tail (e.g. {payPassword[0]}).
_PLACEHOLDER_RE = re.compile(r"\{([A-Za-z_][A-Za-z0-9_]*)(?:[.\[:!][^{}]*)?\}")

# The :text("...") / :text-is("...") pseudo produced by assert_text().
_ASSERT_TEXT_RE = re.compile(r':text(-is)?\("((?:[^"\\]|\\.)*)"\)')


# ---------------------------------------------------------------------------
# Plan-structure helpers
# ---------------------------------------------------------------------------

def _plan_suites() -> list[str]:
    """Suites that ship a scripted_plans.py module."""
    return sorted(p.parent.name for p in _TESTS_ROOT.glob("*/scripted_plans.py"))


def _iter_strings(value: Any, *, skip_summary: bool) -> Iterable[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, list):
        for item in value:
            yield from _iter_strings(item, skip_summary=skip_summary)
    elif isinstance(value, dict):
        for key, item in value.items():
            if skip_summary and key == "summary":
                continue
            yield from _iter_strings(item, skip_summary=skip_summary)


def _placeholders(value: Any, *, skip_summary: bool = False) -> set[str]:
    """Names of ``{param}`` placeholders referenced anywhere inside ``value``.

    ``skip_summary=True`` ignores ``summary`` fields — a placeholder that only
    appears in a human-readable summary never carries answer data.
    """
    names: set[str] = set()
    for text in _iter_strings(value, skip_summary=skip_summary):
        cleaned = text.replace("{{", "").replace("}}", "")
        names.update(m.group(1) for m in _PLACEHOLDER_RE.finditer(cleaned))
    return names


def _normalize_app(name: str) -> str:
    """Display name → appId, mirroring ``MobileGymEnv._open_app`` resolution."""
    name = name.strip()
    if name in MobileGymEnv.APP_NAME_MAP:
        return MobileGymEnv.APP_NAME_MAP[name]
    if name.lower() in _KNOWN_APP_IDS:
        return name.lower()
    return name


def _is_assert(step: dict) -> bool:
    return str(step.get("op") or "") in ASSERT_OPS


def _answer_phase_start(steps: list[dict]) -> int:
    """Index of the first AnswerSheet ``awake``; ``len(steps)`` if none."""
    for idx, step in enumerate(steps):
        if str(step.get("op") or "") != "awake":
            continue
        app = str(step.get("app", ""))
        if "答题" in app or _normalize_app(app) == ANSWER_SHEET_APP_ID:
            return idx
    return len(steps)


def _assert_value_facets(step: dict) -> tuple[str | None, bool, bool]:
    """Return ``(value_text, exactish, scope_narrowed)`` for an assert step.

    ``value_text`` is None for structural asserts (plain selector visibility
    checks with no text payload). ``exactish`` means assert_text(exact=True)
    (the ``:text-is`` pseudo). ``scope_narrowed`` means the author scoped the
    assert tighter than the default foreground-Activity container.
    """
    op = str(step.get("op") or "")
    if op == "assert_answer":
        scope = str(step.get("scope") or DEFAULT_ASSERT_SCOPE)
        return str(step.get("value", "")), False, scope != DEFAULT_ASSERT_SCOPE
    if op == "assert_visible":
        selector = str(step.get("selector", ""))
        match = _ASSERT_TEXT_RE.search(selector)
        if not match:
            return None, False, False
        return match.group(2), bool(match.group(1)), not selector.startswith(f"{DEFAULT_ASSERT_SCOPE} ")
    return None, False, False


# ---------------------------------------------------------------------------
# Task metadata
# ---------------------------------------------------------------------------

@dataclass
class _TaskMeta:
    apps: list[str]
    objective: str
    has_answer_fields: bool
    declared_params: set[str]


def _answer_fields_truthy(cls: type) -> bool:
    attr = getattr(cls, "answer_fields", None)
    if isinstance(attr, property):
        # Some tasks compute answer_fields from params; resolve with the
        # schema defaults set by BaseTask.__init__. A raising property still
        # means the task declares grounded-answer machinery.
        try:
            return bool(cls().answer_fields)
        except Exception:
            return True
    return bool(attr)


def _task_meta(registry: TaskRegistry, task_id: str) -> _TaskMeta | None:
    try:
        cls = registry.get_by_id(task_id)
    except Exception:
        return None

    declared: set[str] = set()
    for key, schema in (getattr(cls, "parameters", None) or {}).items():
        declared.add(key)
        # Multi-field expansion ("_route"-style entries): the `fields` keys
        # are the real param names landing in task.params.
        fields = schema.get("fields") if isinstance(schema, dict) else None
        if isinstance(fields, dict):
            declared.update(str(k) for k in fields)

    return _TaskMeta(
        apps=[str(a) for a in (getattr(cls, "apps", None) or [])],
        objective=str(getattr(cls, "objective", "") or ""),
        has_answer_fields=_answer_fields_truthy(cls),
        declared_params=declared,
    )


# ---------------------------------------------------------------------------
# Lint core
# ---------------------------------------------------------------------------

@dataclass
class _Finding:
    rule: str  # "R1" | "R2" | "R3" | "R4"
    suite: str
    task_id: str
    message: str


@dataclass
class _LintResult:
    violations: list[_Finding] = field(default_factory=list)
    warnings: list[_Finding] = field(default_factory=list)
    exemptions: list[tuple[str, str, str]] = field(default_factory=list)  # suite, task_id, reason
    invalid_exemptions: list[tuple[str, str, str]] = field(default_factory=list)  # suite, task_id, problem
    unknown_tasks: list[tuple[str, str]] = field(default_factory=list)  # suite, task_id
    plans_checked: int = 0
    suites: list[str] = field(default_factory=list)


def _lint_plan(
    suite: str, task_id: str, steps: list[dict], meta: _TaskMeta
) -> tuple[list[_Finding], list[_Finding]]:
    violations: list[_Finding] = []
    warnings: list[_Finding] = []

    answer_start = _answer_phase_start(steps)
    answer_start_desc = (
        f"step {answer_start}" if answer_start < len(steps) else "plan 末尾（无答题卡阶段）"
    )
    has_pre_answer_assert = any(_is_assert(s) for s in steps[:answer_start])

    # ── R2: query plans must show on-screen evidence before answering ──
    is_query = meta.objective in {"query", "hybrid"} or meta.has_answer_fields
    if is_query and not has_pre_answer_assert:
        af_note = "，声明了 answer_fields" if meta.has_answer_fields else ""
        violations.append(
            _Finding(
                "R2",
                suite,
                task_id,
                f"查询类任务（objective={meta.objective}{af_note}）在答题阶段起点"
                f"（{answer_start_desc}）之前没有任何 assert 步；"
                f"请在导航到信息页、答案可见处插入 assert_text/assert_answer，"
                f"证明答案读自屏幕而非直填",
            )
        )

    # ── R1: injected params flowing into the answer phase need endorsement ──
    referenced = _placeholders(steps)
    aliases = CALENDAR_ALIAS_PARAMS if task_id.startswith("calendar.") else frozenset()
    injected = referenced - meta.declared_params - aliases
    flowing: dict[str, int] = {}
    for idx in range(answer_start, len(steps)):
        step = steps[idx]
        if str(step.get("op") or "") not in ANSWER_FLOW_OPS:
            continue
        for name in _placeholders(step, skip_summary=True) & injected:
            flowing.setdefault(name, idx)
    # Loose endorsement (v1): any pre-answer assert endorses all injected
    # params — same criterion as R2, so R1 adds signal mainly for tasks
    # outside R2's scope. TODO(tighten): require a per-param endorsement — an
    # assert step whose rendered string references {name} or {name}_screen.
    if flowing and not has_pre_answer_assert:
        details = ", ".join(f"{{{name}}}(step {idx})" for name, idx in sorted(flowing.items()))
        violations.append(
            _Finding(
                "R1",
                suite,
                task_id,
                f"注入参数 {details} 未在 task.parameters 声明（也非内置派生别名），"
                f"且流入答题阶段的 type/click 步，plan 又无任何前置 assert 背书；"
                f"请先在信息页对该值加 assert_text/assert_answer",
            )
        )

    # ── R3: multi-app coverage via awake steps ──
    if len(meta.apps) > 1:
        awakened = {
            _normalize_app(str(s.get("app", "")))
            for s in steps
            if str(s.get("op") or "") == "awake"
        } - {ANSWER_SHEET_APP_ID}
        missing = [app for app in meta.apps if app not in awakened]
        if missing:
            violations.append(
                _Finding(
                    "R3",
                    suite,
                    task_id,
                    f"多 App 任务 apps={meta.apps}，未被任何 awake 步覆盖：{missing}"
                    f"（答题卡不计）；请为缺失的 App 添加 awake(\"<显示名>\") 步",
                )
            )

    # ── R4: assert hygiene ──
    for idx, step in enumerate(steps):
        if not _is_assert(step):
            continue
        if idx >= answer_start:
            violations.append(
                _Finding(
                    "R4",
                    suite,
                    task_id,
                    f"assert 步（step {idx}: {step.get('summary', '')!r}）出现在答题"
                    f"阶段起点（step {answer_start}）之后；证据断言应在打开答题卡前完成，请上移",
                )
            )
        value, exactish, scope_narrowed = _assert_value_facets(step)
        if value and value.isdigit() and len(value) < 4 and not exactish and not scope_narrowed:
            warnings.append(
                _Finding(
                    "R4",
                    suite,
                    task_id,
                    f"assert 值 {value!r}（step {idx}）为纯数字且长度<4，误匹配风险高；"
                    f"建议 assert_text(..., exact=True) 或收窄 scope",
                )
            )

    return violations, warnings


def run_lint() -> _LintResult:
    registry = TaskRegistry()
    result = _LintResult(suites=_plan_suites())

    for suite in result.suites:
        module = importlib.import_module(f"bench_env.tests.{suite}.scripted_plans")
        plans = getattr(module, "PLANS", None)
        if not isinstance(plans, dict):
            continue

        raw_exempt = getattr(module, "LINT_EXEMPT", None)
        exempt: dict[str, str] = {}
        if raw_exempt is not None and not isinstance(raw_exempt, dict):
            result.invalid_exemptions.append(
                (suite, "<module>", "LINT_EXEMPT 必须是 dict[task_id, 理由]")
            )
        elif isinstance(raw_exempt, dict):
            for task_id, reason in raw_exempt.items():
                if isinstance(reason, str) and reason.strip():
                    exempt[str(task_id)] = reason.strip()
                else:
                    result.invalid_exemptions.append(
                        (suite, str(task_id), "豁免理由必填（为空则不生效，照常 lint）")
                    )

        for task_id in sorted(plans):
            steps = [s for s in (plans[task_id] or []) if isinstance(s, dict)]
            if task_id in exempt:
                result.exemptions.append((suite, task_id, exempt[task_id]))
                continue
            meta = _task_meta(registry, task_id)
            if meta is None:
                result.unknown_tasks.append((suite, task_id))
                continue
            violations, warnings = _lint_plan(suite, task_id, steps, meta)
            result.violations.extend(violations)
            result.warnings.extend(warnings)
            result.plans_checked += 1

    return result


# ---------------------------------------------------------------------------
# Report rendering
# ---------------------------------------------------------------------------

_RULE_TITLES = {
    "R1": "R1 注入参数须有断言背书",
    "R2": "R2 查询 plan 须有证据断言",
    "R3": "R3 多 App awake 覆盖",
    "R4": "R4 断言卫生（答题阶段后不得有 assert）",
}
_RULE_ORDER = ["R2", "R1", "R3", "R4"]


def render_report(result: _LintResult) -> str:
    rule_counts = Counter(f.rule for f in result.violations)
    suite_rule: dict[str, Counter] = {}
    for f in result.violations:
        suite_rule.setdefault(f.suite, Counter())[f.rule] += 1
    warn_by_suite = Counter(f.suite for f in result.warnings)

    lines: list[str] = []
    lines.append("# Scripted plan lint report")
    lines.append("")
    mode = "STRICT（违规即失败）" if STRICT else "WARN（仅报告，测试恒通过）"
    lines.append(f"- 模式: {mode}")
    lines.append(
        f"- 扫描: {len(result.suites)} 个套件 / {result.plans_checked} 个 plan"
        f"（豁免 {len(result.exemptions)}，未知 task_id {len(result.unknown_tasks)}）"
    )
    lines.append(
        "- 违规: "
        + "，".join(f"{rule} {rule_counts.get(rule, 0)}" for rule in _RULE_ORDER)
        + f"，合计 {len(result.violations)}；R4 值警告 {len(result.warnings)}"
    )
    lines.append("")

    lines.append("## 按套件统计")
    lines.append("")
    lines.append("| 套件 | R2 | R1 | R3 | R4 | R4警告 | 小计 |")
    lines.append("| --- | ---: | ---: | ---: | ---: | ---: | ---: |")
    for suite in result.suites:
        counts = suite_rule.get(suite, Counter())
        total = sum(counts.values())
        if total == 0 and warn_by_suite.get(suite, 0) == 0:
            continue
        lines.append(
            f"| {suite} | {counts.get('R2', 0)} | {counts.get('R1', 0)} "
            f"| {counts.get('R3', 0)} | {counts.get('R4', 0)} "
            f"| {warn_by_suite.get(suite, 0)} | {total} |"
        )
    lines.append(
        f"| **合计** | **{rule_counts.get('R2', 0)}** | **{rule_counts.get('R1', 0)}** "
        f"| **{rule_counts.get('R3', 0)}** | **{rule_counts.get('R4', 0)}** "
        f"| **{len(result.warnings)}** | **{len(result.violations)}** |"
    )
    lines.append("")

    for rule in _RULE_ORDER:
        findings = [f for f in result.violations if f.rule == rule]
        lines.append(f"## {_RULE_TITLES[rule]} — {len(findings)} 项")
        lines.append("")
        if not findings:
            lines.append("（无）")
            lines.append("")
            continue
        by_suite: dict[str, list[_Finding]] = {}
        for f in findings:
            by_suite.setdefault(f.suite, []).append(f)
        for suite in sorted(by_suite):
            lines.append(f"### {suite}（{len(by_suite[suite])}）")
            lines.append("")
            for f in sorted(by_suite[suite], key=lambda x: x.task_id):
                lines.append(f"- `{f.task_id}` — {f.message}")
            lines.append("")

    lines.append(f"## R4 值警告（仅提示，不计违规）— {len(result.warnings)} 项")
    lines.append("")
    if result.warnings:
        for f in sorted(result.warnings, key=lambda x: (x.suite, x.task_id)):
            lines.append(f"- `{f.task_id}` — {f.message}")
    else:
        lines.append("（无）")
    lines.append("")

    lines.append(f"## 豁免清单（LINT_EXEMPT）— {len(result.exemptions)} 项")
    lines.append("")
    if result.exemptions:
        for suite, task_id, reason in sorted(result.exemptions):
            lines.append(f"- `{task_id}` — {reason}")
    else:
        lines.append("（无）")
    lines.append("")

    if result.invalid_exemptions:
        lines.append(f"## 无效豁免声明 — {len(result.invalid_exemptions)} 项")
        lines.append("")
        for suite, task_id, problem in sorted(result.invalid_exemptions):
            lines.append(f"- `{suite}` / `{task_id}` — {problem}")
        lines.append("")

    if result.unknown_tasks:
        lines.append(
            f"## 未知 task_id（plan 存在但注册表中无任务类）— {len(result.unknown_tasks)} 项"
        )
        lines.append("")
        for suite, task_id in sorted(result.unknown_tasks):
            lines.append(f"- `{task_id}`（{suite}/scripted_plans.py）")
        lines.append("")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_scripted_plan_lint(capsys) -> None:
    result = run_lint()
    report = render_report(result)
    REPORT_PATH.write_text(report, encoding="utf-8")
    with capsys.disabled():
        print("\n" + report)
        print(f"[scripted-plan-lint] report written to {REPORT_PATH}")

    assert result.plans_checked > 0, "no scripted plans discovered — lint wiring broken"
    if STRICT:
        assert not result.violations, (
            f"{len(result.violations)} scripted-plan lint violation(s); "
            f"see {REPORT_PATH} for the grouped report"
        )


def test_lint_helpers_answer_phase_and_placeholders() -> None:
    from bench_env.agent.scripted import assert_text, complete, grounded_answer, tap_trigger

    steps = [
        tap_trigger("detail.open"),
        assert_text("{answer}个内容"),
        *grounded_answer("{answer}"),
        complete(),
    ]
    start = _answer_phase_start(steps)
    assert steps[start]["op"] == "awake"
    assert _is_assert(steps[1])
    assert any(_is_assert(s) for s in steps[:start])
    assert not any(_is_assert(s) for s in steps[start:])
    assert "answer" in _placeholders(steps)

    # summary-only placeholders don't count as answer flow; format-spec tails
    # like {name[0]} still resolve to the leading identifier.
    step = {"op": "type", "value": "{pin[0]}", "summary": "note {label}"}
    assert _placeholders(step, skip_summary=True) == {"pin"}
    assert _placeholders(step) == {"pin", "label"}


def test_lint_helpers_app_normalization_and_assert_facets() -> None:
    from bench_env.agent.scripted import assert_answer, assert_text, assert_visible

    assert _normalize_app("微信") == "wechat"
    assert _normalize_app("答题卡") == ANSWER_SHEET_APP_ID
    assert _normalize_app("WeChat") == "wechat"
    assert _normalize_app("Spotify") == "spotify"

    value, exactish, narrowed = _assert_value_facets(assert_text("42"))
    assert (value, exactish, narrowed) == ("42", False, False)
    value, exactish, narrowed = _assert_value_facets(assert_text("42", exact=True))
    assert (value, exactish, narrowed) == ("42", True, False)
    value, exactish, narrowed = _assert_value_facets(assert_answer("42", scope=".hero"))
    assert (value, exactish, narrowed) == ("42", False, True)
    # Structural visibility assert carries no text payload.
    value, _, _ = _assert_value_facets(assert_visible("[data-trigger='x']", summary="s"))
    assert value is None
