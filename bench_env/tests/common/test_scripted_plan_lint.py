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
  dicts at import time, so no extra compilation is needed here). A ``Branch``
  entry is linted **per arm** — every arm must independently satisfy R1–R4
  (findings carry a ``[branch=<key>]`` suffix on the task id);
- the suite's optional ``DERIVED_PARAMS`` table: its inner keys count as
  *declared* params for R1 — they are computed from the episode's initial
  state at materialization time, not test-injected;
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
- **R1** — *answer-class params* (plan placeholders NOT declared in
  ``task.parameters`` — i.e. test-injected or ``DERIVED_PARAMS``-derived, so
  their values are never part of the instruction) that flow into answer-phase
  type/click steps need **per-param** assert endorsement — one endorsing
  assert per param, so asserting field A never covers direct-filling field B.
  A pre-answer assert endorses param ``p`` when:

  a) its *payload* (selector / value — ``summary`` never counts) references
     ``{p}`` — covers ``assert_answer("{p}", field_index=…)`` field binding
     and selector-embedded references alike;
  b) the payload references ``{p_screen}`` — the ``*_screen`` naming
     convention for screen-form variants of judge-form answers (e.g. weather
     asserts the canonicalized on-screen bucket label ``{answer_screen}``
     while typing the judge-aligned ``{answer}``);
  c) the step carries an explicit ``endorses=["p", …]`` annotation (DSL
     kwarg on ``assert_visible`` / ``assert_text`` / ``assert_answer``) —
     the escape hatch for B-class *evidence* asserts whose payload has no
     literal tie to the param (e.g. proving a count answer by showing the
     list's last row). Only annotate asserts that genuinely prove how the
     named param's value was obtained on screen.

  Same-source ``DERIVED_PARAMS`` calculators (a derived assert key computed
  from the same accessor as the answer param) are deliberately NOT inferred —
  plans in that shape must use the ``*_screen`` convention or ``endorses``.
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
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Iterable

from bench_env.agent.scripted import Branch
from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.registry import TaskRegistry

# Flipped to True on 2026-08-12 (backlog cleared) — every R1/R2/R3/R4
# violation is now a hard test failure (R4 value warnings stay warnings).
# 2026-08-13: R1 tightened from "any pre-answer assert endorses everything"
# to per-param endorsement (endorsement backlog cleared the same day — the
# transient R1_STRICT warn gate is gone, tightened R1 fails under STRICT).
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


def _plan_variants(task_id: str, entry: Any) -> list[tuple[str, list[dict]]]:
    """Expand a PLANS entry into lintable ``(label, steps)`` variants.

    A plain step list yields one variant; a ``Branch`` yields one per arm so a
    single arm without asserts cannot hide behind a compliant sibling.
    """
    if isinstance(entry, Branch):
        return [
            (f"{task_id}[branch={key}]", [s for s in (steps or []) if isinstance(s, dict)])
            for key, steps in sorted(entry.branches.items())
        ]
    return [(task_id, [s for s in (entry or []) if isinstance(s, dict)])]


def _derived_param_names(module: Any, task_id: str) -> set[str]:
    """Inner keys of the suite's ``DERIVED_PARAMS`` entry for ``task_id``."""
    table = getattr(module, "DERIVED_PARAMS", None)
    if not isinstance(table, dict):
        return set()
    entry = table.get(task_id)
    return {str(k) for k in entry} if isinstance(entry, dict) else set()


def _assert_endorsements(step: dict) -> set[str]:
    """Param names an assert step endorses (see the R1 rule in the module doc).

    Channel a/b — payload references: every ``{name}`` placeholder outside
    ``summary`` fields endorses ``name``; a ``{name_screen}`` reference
    additionally endorses ``name`` (the ``*_screen`` screen-form convention).
    Channel c — the explicit ``endorses`` annotation compiled by the DSL
    assert constructors (plain param names, no braces).
    """
    names: set[str] = set()
    for name in _placeholders(step, skip_summary=True):
        names.add(name)
        if name.endswith("_screen"):
            names.add(name[: -len("_screen")])
    raw = step.get("endorses")
    if isinstance(raw, str):
        raw = [raw]
    if isinstance(raw, (list, tuple)):
        names.update(str(n).strip().strip("{}") for n in raw if str(n).strip())
    return names


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
    # Inner keys of the suite's DERIVED_PARAMS entry — computed from the
    # episode's initial state, not part of the instruction, so they are
    # answer-class for R1 (unlike declared_params, which the instruction
    # carries and the agent may legitimately type without reading the screen).
    derived_params: set[str] = field(default_factory=set)


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

    # ── R1: answer-class params flowing into the answer phase need per-param
    # assert endorsement (asserting field A must not cover direct-filling B) ──
    referenced = _placeholders(steps)
    answer_class = referenced - meta.declared_params  # injected ∪ derived
    flowing: dict[str, int] = {}
    for idx in range(answer_start, len(steps)):
        step = steps[idx]
        if str(step.get("op") or "") not in ANSWER_FLOW_OPS:
            continue
        for name in _placeholders(step, skip_summary=True) & answer_class:
            flowing.setdefault(name, idx)
    endorsed: set[str] = set()
    for step in steps[:answer_start]:
        if _is_assert(step):
            endorsed |= _assert_endorsements(step)
    unendorsed = {name: idx for name, idx in flowing.items() if name not in endorsed}
    if unendorsed:
        details = ", ".join(
            f"{{{name}}}（{'派生' if name in meta.derived_params else '注入'}，step {idx}）"
            for name, idx in sorted(unendorsed.items())
        )
        violations.append(
            _Finding(
                "R1",
                suite,
                task_id,
                f"答案类参数 {details} 流入答题阶段的 type/click 步，但没有任何前置 assert "
                f"逐参数背书；背书方式：断言载荷（selector/value，summary 不算）引用 "
                f"{{参数名}} 或 {{参数名_screen}}，或对确证该参数获取过程的证据断言标注 "
                f"endorses=[\"参数名\"]（DSL 断言构造函数的可选参数）",
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


def _lint_entry(
    suite: str, task_id: str, entry: Any, meta: _TaskMeta, derived_params: set[str]
) -> tuple[list[_Finding], list[_Finding]]:
    """Lint one PLANS entry (plain step list or ``Branch``) against task metadata.

    ``derived_params`` (the task's ``DERIVED_PARAMS`` inner keys) are recorded
    on the meta as answer-class origins for R1 (derived values come from the
    initial state, not the instruction, so flowing into the answer phase they
    need endorsement just like injected ones); each ``Branch`` arm runs R1–R4
    independently.
    """
    if derived_params:
        meta = replace(meta, derived_params=derived_params)
    violations: list[_Finding] = []
    warnings: list[_Finding] = []
    for label, steps in _plan_variants(task_id, entry):
        arm_violations, arm_warnings = _lint_plan(suite, label, steps, meta)
        violations.extend(arm_violations)
        warnings.extend(arm_warnings)
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
            if task_id in exempt:
                result.exemptions.append((suite, task_id, exempt[task_id]))
                continue
            meta = _task_meta(registry, task_id)
            if meta is None:
                result.unknown_tasks.append((suite, task_id))
                continue
            violations, warnings = _lint_entry(
                suite, task_id, plans[task_id], meta, _derived_param_names(module, task_id)
            )
            result.violations.extend(violations)
            result.warnings.extend(warnings)
            result.plans_checked += 1

    return result


# ---------------------------------------------------------------------------
# Report rendering
# ---------------------------------------------------------------------------

_RULE_TITLES = {
    "R1": "R1 答案类参数须逐参数断言背书",
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


def test_lint_branch_arms_are_checked_independently() -> None:
    from bench_env.agent.scripted import assert_text, complete, grounded_answer, tap_trigger

    with_assert = [
        tap_trigger("detail.open"),
        assert_text("{answer}"),
        *grounded_answer("{answer}"),
        complete(),
    ]
    without_assert = [tap_trigger("detail.open"), *grounded_answer("{answer}"), complete()]
    entry = Branch(
        pick=lambda task, state: "with_assert",
        branches={"with_assert": with_assert, "without_assert": without_assert},
    )
    meta = _TaskMeta(
        apps=["clock"], objective="query", has_answer_fields=True, declared_params=set()
    )

    # The assert-less arm fails R2 (no evidence assert) *and* R1 ({answer} is
    # derived — answer-class — and flows unendorsed), even though its sibling
    # arm carries the endorsing assert.
    violations, warnings = _lint_entry("clock", "clock.Fake", entry, meta, {"answer"})
    assert [(f.rule, f.task_id) for f in violations] == [
        ("R2", "clock.Fake[branch=without_assert]"),
        ("R1", "clock.Fake[branch=without_assert]"),
    ]
    assert warnings == []


def test_lint_r1_per_param_endorsement() -> None:
    from bench_env.agent.scripted import (
        assert_answer,
        assert_text,
        assert_visible,
        complete,
        grounded_answer,
        tap_trigger,
    )

    meta = _TaskMeta(
        apps=["clock"], objective="query", has_answer_fields=True, declared_params={"city"}
    )

    def lint(steps: list[dict], derived: set[str]) -> list[str]:
        violations, _ = _lint_entry("clock", "clock.Fake", steps, meta, derived)
        return [f.rule for f in violations]

    # Derived params are answer-class: flowing unendorsed → R1 (R2 is satisfied
    # by the unrelated structural assert, which endorses nothing).
    structural = assert_visible("[data-trigger='x']", summary="structural check")
    steps = [tap_trigger("detail.open"), structural, *grounded_answer("{code}"), complete()]
    assert lint(steps, {"code"}) == ["R1"]

    # (a) same-name payload reference endorses the param…
    steps = [
        tap_trigger("detail.open"),
        assert_answer("{code}", field_index=0),
        *grounded_answer("{code}"),
        complete(),
    ]
    assert lint(steps, {"code"}) == []

    # …but asserting field A does not cover direct-filling field B.
    steps = [
        tap_trigger("detail.open"),
        assert_answer("{code}", field_index=0),
        *grounded_answer("{code}", "{other}"),
        complete(),
    ]
    assert lint(steps, {"code", "other"}) == ["R1"]

    # (b) the *_screen convention: asserting {code_screen} endorses {code}.
    steps = [
        tap_trigger("detail.open"),
        assert_answer("{code_screen}", field_index=0),
        *grounded_answer("{code}"),
        complete(),
    ]
    assert lint(steps, {"code", "code_screen"}) == []

    # (c) explicit endorses annotation on a B-class evidence assert.
    steps = [
        tap_trigger("detail.open"),
        assert_visible("li:last-child", summary="list end", endorses=["code"]),
        *grounded_answer("{code}"),
        complete(),
    ]
    assert lint(steps, {"code"}) == []

    # A {param} reference in the assert *summary* endorses nothing.
    steps = [
        tap_trigger("detail.open"),
        assert_text("静态文案", summary="near {code}"),
        *grounded_answer("{code}"),
        complete(),
    ]
    assert lint(steps, {"code"}) == ["R1"]

    # Instruction-declared params typed into the sheet are exempt.
    steps = [
        tap_trigger("detail.open"),
        assert_answer("{code}", field_index=0),
        *grounded_answer("{code}", "{city}"),
        complete(),
    ]
    assert lint(steps, {"code"}) == []
