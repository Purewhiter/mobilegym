"""
Common task patterns.

Hierarchy:
    BaseTask (abstract)
        ├── AnswerTask     - 问答类任务
        ├── CriteriaTask   - 检查多个条件（支持可选 answer）
        └── (Custom tasks) - 直接继承 BaseTask

All tasks use the same evaluation flow:
    evaluate() -> check_goals() -> JudgeResult

Tasks should override check_goals() to provide detailed failure info.
"""

from __future__ import annotations

from typing import Any, ClassVar, TYPE_CHECKING, Pattern, Callable

from bench_env.task.base import BaseTask, BaseApp

if TYPE_CHECKING:
    from bench_env.task.judge import JudgeInput, JudgeResult


import re
import math
import difflib

# Threshold for fuzzy string matching (inspired by android_world's fuzzy_match_lib).
_MIN_DIFF_SIMILARITY = 0.9

__all__ = [
    "resolve_app_state",
    "resolve_answer",
    "check_answer",
    "build_best_match_answer_checks",
    "match_value",
    "match_duration",
    "match_track_duration",
    "match_time",
    "normalize_text",
    "build_grounded_checks",
    "AnswerTask",
    "CriteriaTask",
]

# Matches integers/decimals that are NOT part of a longer digit sequence.
#
# Supports thousands separators like "36,646" / "36，646" as well as plain numbers like "36646".
_NUM_PATTERN = re.compile(
    r'(?<!\d)-?(?:\d{1,3}(?:[，,]\d{3})+|\d+)(?:\.\d+)?(?!\d)'
)
_FIELD_FILTER_SEGMENT_RE = re.compile(r'\[([^\[\]=]+)=([^\]]+)\]')

# Chinese numeral → digit mapping
_CN_DIGIT = {
    "零": 0, "〇": 0,
    "一": 1, "壹": 1,
    "二": 2, "贰": 2, "两": 2,
    "三": 3, "叁": 3,
    "四": 4, "肆": 4,
    "五": 5, "伍": 5,
    "六": 6, "陆": 6,
    "七": 7, "柒": 7,
    "八": 8, "捌": 8,
    "九": 9, "玖": 9,
}

_CN_UNIT = {
    "十": 10, "拾": 10,
    "百": 100, "佰": 100,
    "千": 1000, "仟": 1000,
    "万": 10000,
    "亿": 100000000,
}

# Pattern for a Chinese numeral sequence (e.g. 三百七十二, 七, 二十)
_CN_NUM_CHARS = "".join(_CN_DIGIT.keys()) + "".join(_CN_UNIT.keys())
_CN_NUM_PATTERN = re.compile(f"[{re.escape(_CN_NUM_CHARS)}]+")


def _cn_to_number(s: str) -> int | None:
    """Convert a Chinese numeral string to an integer.

    Handles simple cases like 七→7, 二十三→23, 三百七十二→372.
    Returns None if the string is not a valid Chinese numeral.
    """
    if not s:
        return None

    total = 0
    current = 0
    last_unit = 1

    for ch in s:
        if ch in _CN_DIGIT:
            current = _CN_DIGIT[ch]
        elif ch in _CN_UNIT:
            unit = _CN_UNIT[ch]
            if unit >= 10000:
                # 万/亿 are "big units" that multiply everything accumulated
                total = (total + max(current, 1)) * unit
                current = 0
                last_unit = unit
            else:
                if current == 0 and unit == 10:
                    current = 1  # 十 at start means 10
                total += current * unit
                current = 0
                last_unit = unit
        else:
            return None

    total += current
    return total if total > 0 or s in ("零", "〇") else None


def normalize_text(text: str) -> str:
    """Normalize text for comparison: replace Chinese numerals with digits."""
    def _replace_cn(m: re.Match) -> str:
        n = _cn_to_number(m.group())
        return str(n) if n is not None else m.group()
    return _CN_NUM_PATTERN.sub(_replace_cn, text)


def _fuzzy_match(text1: str, text2: str) -> bool:
    """Approximate string equality via SequenceMatcher (android_world style).

    Returns True when similarity ratio >= _MIN_DIFF_SIMILARITY (0.9).
    Handles the common case where expected is a *substring* of actual
    by sliding a window of len(expected) across actual and checking each.
    """
    if not text1 or not text2:
        return False
    t1 = text1.lower()
    t2 = text2.lower()
    # Whole-string comparison
    if difflib.SequenceMatcher(None, t1, t2).ratio() >= _MIN_DIFF_SIMILARITY:
        return True
    # Sliding window: expected may be a substring-like portion of a longer answer
    if len(t1) < len(t2):
        window = len(t1)
        for i in range(len(t2) - window + 1):
            if difflib.SequenceMatcher(None, t1, t2[i:i + window]).ratio() >= _MIN_DIFF_SIMILARITY:
                return True
    return False


def _match_numeric(expected: float | int, actual_text: str) -> bool:
    """Check if *expected* appears as a standalone number in *actual_text*.

    Supports Chinese numerals via normalize_text.
    """
    actual_text = normalize_text(actual_text)
    nums = _NUM_PATTERN.findall(actual_text)
    if not nums:
        return False
    for n_str in nums:
        try:
            # Normalize thousands separators: "36,646" -> "36646"
            # Support both "," and full-width "，" as separators.
            n = float(str(n_str).replace(",", "").replace("，", ""))
        except ValueError:
            continue
        if math.isclose(n, float(expected), rel_tol=1e-6, abs_tol=1e-9):
            return True
    return False


def resolve_app_state(apps: list[str], input_apps: dict, path: str) -> tuple[dict, str]:
    """解析 'appName:field.path' → (app_state, field_path)

    Args:
        apps: Task's app list (self.apps)
        input_apps: input.apps dict (app_name → state)
        path: Path string, optionally prefixed with "appName:"

    Returns:
        (app_state_dict, field_path)
    """
    if ":" in path:
        app_name, field_path = path.split(":", 1)
        return input_apps.get(app_name, {}), field_path
    return input_apps.get(apps[0], {}) if apps else {}, path


# =============================================================================
# Answer evaluation — module-level functions (no mixin needed)
# =============================================================================


def _resolve_path_template(path: str, params: dict[str, Any]) -> str:
    """Expand ``{param}`` placeholders in a path string using task params.

    Only expands segments inside ``[field={param}]`` brackets and bare
    ``{param}`` references.  Regular dotted segments are left intact.
    """
    import re as _re
    def _repl(m: _re.Match) -> str:
        key = m.group(1)
        return str(params[key]) if key in params else m.group(0)
    return _re.sub(r'\{(\w+)\}', _repl, path)


def _resolve_path(path: str, task: BaseTask, input: "JudgeInput") -> Any:
    """解析单个 answer 路径字符串，返回初始 state 中的对应值。"""
    resolved = _resolve_path_template(path, task.params)
    app_state, field_path = resolve_app_state(task.apps, input.apps_init, resolved)
    return BaseApp.get_by_path(app_state, field_path.lstrip("."))


def _append_path_segment(path: str, segment: str) -> str:
    if not path:
        return segment
    if segment.startswith("["):
        return f"{path}{segment}"
    return f"{path}.{segment}"


def _split_state_path(path: str) -> list[str]:
    import re as _re

    tokens: list[str] = []
    for raw in _re.split(r'\.(?![^[]*\])', path):
        bracket_parts = _re.split(r'\[', raw)
        head = bracket_parts[0]
        if head:
            tokens.append(head)
        for bp in bracket_parts[1:]:
            tokens.append("[" + bp)
    return tokens


def _descend_state_value(current: Any, token: str) -> Any:
    index_match = re.fullmatch(r'\[(\d+)\]', token)
    if index_match:
        if not isinstance(current, list):
            return None
        idx = int(index_match.group(1))
        return current[idx] if 0 <= idx < len(current) else None

    if isinstance(current, dict):
        return current.get(token)

    if isinstance(current, list) and token.isdigit():
        idx = int(token)
        return current[idx] if 0 <= idx < len(current) else None

    return None


def _get_nested_field(item: Any, field: str) -> Any:
    """Resolve a dotted field path on a dict (``user.name`` → ``item['user']['name']``).

    Flat names (no dot) degenerate to a single ``.get`` lookup. Any non-dict link
    in the path short-circuits to ``None``, matching the semantics of "field
    not present" used by the flat lookup.
    """
    value = item
    for part in field.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


def _find_list_item_by_field(items: list, field: str, expected: str) -> tuple[int | None, Any]:
    """Find a list item whose nested ``field`` equals ``expected``.

    Exact string match wins; falls back to first substring match only when no
    exact match exists (prevents ``id=p1`` from being stolen by ``retweet_p1``).
    """
    fallback: tuple[int | None, Any] = (None, None)
    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            continue
        item_val = _get_nested_field(item, field)
        if item_val is None:
            continue
        if str(item_val) == expected:
            return idx, item
        if fallback[0] is None and isinstance(item_val, str) and expected in item_val:
            fallback = (idx, item)
    return fallback


def _find_filtered_list_match(current: Any, field: str, expected: str) -> tuple[int | None, Any, str | None]:
    from bench_env.task.judge import StateComparator

    if not isinstance(current, list):
        return None, None, None

    id_field = StateComparator._find_id_field(current)
    idx, item = _find_list_item_by_field(current, field, expected)
    return idx, item, id_field


def _to_absolute_expected_path(path: str, apps: list[str]) -> str:
    if path.startswith("apps.") or path.startswith("os."):
        return path
    if ":" in path:
        app_name, field_path = path.split(":", 1)
        return f"apps.{app_name}.{field_path}"
    if len(apps) == 1:
        return f"apps.{apps[0]}.{path}"
    return f"apps.{path}"


def _expand_expected_change_paths(
    path: str,
    raw_value: Any,
    apps: list[str],
    input: "JudgeInput",
) -> list[str]:
    """Expand criteria path into precise diff paths aligned with diff semantics."""
    absolute = _to_absolute_expected_path(path, apps)
    tokens = _split_state_path(absolute)
    if not any(_FIELD_FILTER_SEGMENT_RE.fullmatch(token) for token in tokens):
        return [absolute]

    init_root = {"apps": input.apps_init or {}, "os": input.os_init or {}}
    curr_root = {"apps": input.apps or {}, "os": input.os or {}}
    current_init: Any = init_root
    current_curr: Any = curr_root
    concrete = ""

    for idx, token in enumerate(tokens):
        filter_match = _FIELD_FILTER_SEGMENT_RE.fullmatch(token)
        if filter_match:
            field, expected = filter_match.group(1), filter_match.group(2)
            is_terminal = idx == len(tokens) - 1
            is_delete_target = is_terminal and raw_value is None

            if is_delete_target:
                init_idx, init_item, init_id_field = _find_filtered_list_match(current_init, field, expected)
                if init_idx is None:
                    return []
                if init_id_field and isinstance(init_item, dict) and init_id_field in init_item:
                    concrete = _append_path_segment(concrete, f"[{init_id_field}={init_item[init_id_field]}]")
                else:
                    concrete = _append_path_segment(concrete, f"[{init_idx}]")
                return [concrete]

            curr_idx, curr_item, curr_id_field = _find_filtered_list_match(current_curr, field, expected)
            if curr_idx is None:
                return []
            if curr_id_field and isinstance(curr_item, dict) and curr_id_field in curr_item:
                concrete = _append_path_segment(concrete, f"[{curr_id_field}={curr_item[curr_id_field]}]")
            else:
                concrete = _append_path_segment(concrete, f"[{curr_idx}]")
            current_curr = curr_item

            init_idx, init_item, _ = _find_filtered_list_match(current_init, field, expected)
            current_init = init_item if init_idx is not None else None
            continue

        concrete = _append_path_segment(concrete, token)
        current_init = _descend_state_value(current_init, token)
        current_curr = _descend_state_value(current_curr, token)

    return [concrete] if concrete else []


def _is_path(value: Any) -> bool:
    return isinstance(value, str) and (value.startswith(".") or ":" in value)


def resolve_answer(task: BaseTask, input: "JudgeInput") -> Any:
    """根据 task.answer 定义解析出 ground truth（默认读初始态）。

    All declarative forms below resolve against ``input.apps_init`` (the
    initial state captured at task setup), matching pure-query semantics.
    For post-action / final-state answers, override ``get_answer()`` and
    read ``input.apps`` / ``input.os`` explicitly.

    Supports:
    - ``(".path", fn)`` — initial-state path + transform
    - ``".path"`` / ``"appName:.path"`` — initial-state lookup (supports
      ``{param}`` templates and ``[field={param}]`` list-find syntax)
    - ``{"slot": ".path", ...}`` — dict of slot → initial-state path,
      each resolved independently
    - ``callable`` — ``callable(task, apps_init)``; receives the full
      ``input.apps_init`` dict (all apps), so cross-app access works the
      same way as ``"app:.path"`` does for string forms. If you also need
      ``os_init``, override ``get_answer()`` and read ``input`` directly.
    - literal — returned as-is

    Path template examples::

        answer = ".contacts[name={name}].phone"   # find by param, get field
        answer = ".history[{index}].title"         # param as index
        answer = {"from": ".studentVerify.from", "to": ".studentVerify.to"}

    Args:
        task: Task instance (reads ``task.answer`` and ``task.apps``)
        input: JudgeInput with both initial and current state.
    """
    ans = task.answer
    if ans is None:
        raise NotImplementedError("Define 'answer' or override 'get_answer()'")

    # Tuple: (path, fn) → fn(resolve(path))
    if isinstance(ans, tuple) and len(ans) == 2:
        path, fn = ans
        value = _resolve_path(path, task, input)
        return fn(value) if value is not None else None

    # String path (with "." prefix or ":" app prefix)
    if _is_path(ans):
        return _resolve_path(ans, task, input)

    # Dict: resolve each value independently (slot-based answer)
    if isinstance(ans, dict):
        return {
            key: _resolve_path(val, task, input) if _is_path(val) else val
            for key, val in ans.items()
        }

    # Callable: custom logic → callable(task, full apps_init dict)
    if callable(ans):
        return ans(task, input.apps_init)

    # Literal value
    return ans


def check_answer(task: BaseTask, input: "JudgeInput") -> list[dict[str, Any]]:
    """生成 answer 相关的 check list。

    Calls ``resolve_answer`` to get expected value, then matches against
    ``input.answer`` using ``match_value``.

    Args:
        task: Task instance
        input: JudgeInput with agent answer
    """
    expected = resolve_answer(task, input)
    return build_answer_checks(expected, input.answer)


def build_best_match_answer_checks(
    candidates: list[dict[str, Any]],
    fields: list[tuple[str, str, Callable[..., bool]]],
    answer_text: str,
) -> list[dict[str, Any]]:
    """Multi-candidate multi-slot answer matching with per-field matchers.

    When multiple candidates are equally valid (e.g. tied fastest trains),
    returns checks for the first candidate where ALL fields pass.
    Falls back to the first candidate if none fully match.

    Args:
        candidates: Non-empty list of candidate dicts.
        fields: (display_name, dict_key, matcher) tuples.
            matcher signature: (expected_value, answer_text) -> bool.
        answer_text: Agent's answer text.
    """
    all_checks = [
        [{"field": f"answer.{name}", "expected": c[key],
          "actual": answer_text, "passed": matcher(c[key], answer_text)}
         for name, key, matcher in fields]
        for c in candidates
    ]
    return next(
        (cs for cs in all_checks if all(c["passed"] for c in cs)),
        all_checks[0],
    )


def build_answer_checks(expected: Any, actual: Any) -> list[dict[str, Any]]:
    """Build answer checks from an expected value and actual answer."""
    
    # Slot-based: answer is a dict → evaluate each slot independently
    if isinstance(expected, dict):
        checks = []
        for slot_name, slot_expected in expected.items():
            slot_actual = None
            if isinstance(actual, dict):
                slot_actual = actual.get(slot_name)
            elif isinstance(actual, str):
                slot_actual = actual
            passed = match_value(slot_expected, slot_actual)
            checks.append({
                "field": f"answer.{slot_name}",
                "expected": slot_expected,
                "actual": slot_actual,
                "passed": passed,
            })
        return checks

    # Canonical / Free-form: single expected value
    passed = match_value(expected, actual)
    return [{
        "field": "answer",
        "expected": expected,
        "actual": actual,
        "passed": passed,
    }]


def match_value(expected: Any, actual: Any) -> bool:
    """Match a single expected value against an actual value.

    - **regex** (``re.Pattern``): searches the raw text first, then the
      normalized text (Chinese numerals → digits).  Two-pass ensures that
      patterns containing literal Chinese characters (e.g. ``一样``) hit
      the original text, while patterns with Arabic digits (e.g. ``3小时``)
      still match after normalization.
    - **numeric** (``int | float``): extracts numbers from the text
      (with Chinese numeral normalization) and compares with tolerance.
    - **string**: containment check after Chinese numeral normalization.

    Note: bool 类型不做自动匹配——是非判断需结合具体问题语境，
    由任务在 check_goals() 中自行处理。
    """
    if actual is None:
        return False

    if isinstance(expected, Pattern):
        text = str(actual)
        return bool(expected.search(text) or expected.search(normalize_text(text)))

    if isinstance(expected, (int, float)):
        return _match_numeric(expected, str(actual))

    # String comparison with normalization
    exp_str = normalize_text(str(expected))
    act_str = normalize_text(str(actual))
    if exp_str in act_str:
        return True
    # Fallback 1: strip all whitespace then check containment
    exp_nows = re.sub(r'\s+', '', exp_str)
    act_nows = re.sub(r'\s+', '', act_str)
    if exp_nows and exp_nows in act_nows:
        return True
    return False


def match_duration(expected: str, actual: Any) -> bool:
    """Match duration values flexibly by normalizing to total minutes.

    Handles equivalent representations:
      "0小时59分" ↔ "59分钟" ↔ "59分"
      "1小时30分" ↔ "90分钟"
    """
    if actual is None:
        return False

    def _to_minutes(s: str) -> int | None:
        s = normalize_text(s)
        h = re.search(r'(\d+)\s*小时', s)
        m = re.search(r'(\d+)\s*分', s)
        if h or m:
            return (int(h.group(1)) if h else 0) * 60 + (int(m.group(1)) if m else 0)
        hm = re.search(r'(\d+):(\d{2})', s)
        if hm:
            return int(hm.group(1)) * 60 + int(hm.group(2))
        return None

    exp_min = _to_minutes(expected)
    if exp_min is None:
        return False

    actual_norm = normalize_text(str(actual))

    for m in re.finditer(r'(\d+)\s*小时\s*(\d+)\s*分', actual_norm):
        if int(m.group(1)) * 60 + int(m.group(2)) == exp_min:
            return True

    for m in re.finditer(r'(\d+)\s*分(?:钟)?', actual_norm):
        pre = actual_norm[:m.start()]
        if re.search(r'\d+\s*小时\s*$', pre):
            continue
        if int(m.group(1)) == exp_min:
            return True

    for m in re.finditer(r'(\d+)\s*小时', actual_norm):
        post = actual_norm[m.end():]
        if not re.match(r'\s*\d+\s*分', post):
            if int(m.group(1)) * 60 == exp_min:
                return True

    if normalize_text(expected) in actual_norm:
        return True

    # 纯数字（如 "249"）匹配总分钟数
    for m in re.finditer(r'(?<!\d)(\d+)(?!\d)', actual_norm):
        val = int(m.group(1))
        if val == exp_min:
            return True

    return False


def match_track_duration(expected: str, actual: Any) -> bool:
    """Match media track durations by normalizing to total seconds.

    Handles equivalent representations:
      "3:50" ↔ "3分50秒" ↔ "3分钟50秒" ↔ "230秒"
    """
    if actual is None:
        return False

    def _to_seconds(s: str) -> int | None:
        s = normalize_text(s.strip())
        mmss = re.search(r'(?<!\d)(\d+):(\d{2})(?!\d)', s)
        if mmss:
            return int(mmss.group(1)) * 60 + int(mmss.group(2))
        minute_second = re.search(r'(\d+)\s*分(?:钟)?\s*(\d+)\s*秒', s)
        if minute_second:
            return int(minute_second.group(1)) * 60 + int(minute_second.group(2))
        seconds = re.search(r'(?<![:\d])(\d+)\s*秒(?!\d)', s)
        if seconds:
            return int(seconds.group(1))
        return None

    exp_seconds = _to_seconds(expected)
    if exp_seconds is None:
        return False

    actual_norm = normalize_text(str(actual))

    for m in re.finditer(r'(?<!\d)(\d+):(\d{2})(?!\d)', actual_norm):
        if int(m.group(1)) * 60 + int(m.group(2)) == exp_seconds:
            return True

    for m in re.finditer(r'(\d+)\s*分(?:钟)?\s*(\d+)\s*秒', actual_norm):
        if int(m.group(1)) * 60 + int(m.group(2)) == exp_seconds:
            return True

    for m in re.finditer(r'(?<![:\d])(\d+)\s*秒(?!\d)', actual_norm):
        if int(m.group(1)) == exp_seconds:
            return True

    return False


def match_time(expected: str, actual: Any, tolerance_minutes: int = 5) -> bool:
    """Match time values flexibly by normalizing to (hour, minute).

    Handles equivalent representations:
      "09:54" ↔ "9点54分" ↔ "上午9点54分"
      "13:10" ↔ "下午1点10分"

    Args:
        tolerance_minutes: Maximum allowed difference in minutes (default 5).
            Accounts for time drift between when the agent reads the clock
            and when the final state is captured for evaluation.
    """
    if actual is None:
        return False

    def _to_hm(s: str) -> tuple[int, int] | None:
        s = normalize_text(s.strip())
        m = re.search(r'(\d{1,2}):(\d{2})', s)
        if m:
            return (int(m.group(1)), int(m.group(2)))
        m = re.search(r'(\d{1,2})\s*点\s*(\d{1,2})\s*分?', s)
        if m:
            return (int(m.group(1)), int(m.group(2)))
        return None

    def _hm_to_minutes(hm: tuple[int, int]) -> int:
        return hm[0] * 60 + hm[1]

    def _minutes_close(a: int, b: int) -> bool:
        diff = abs(a - b)
        # Handle wrap-around midnight (e.g. 23:58 vs 00:02)
        return min(diff, 1440 - diff) <= tolerance_minutes

    exp_hm = _to_hm(expected)
    if exp_hm is None:
        return False
    exp_min = _hm_to_minutes(exp_hm)

    actual_norm = normalize_text(str(actual))

    _prefix = r'(?:上午|下午|早上|晚上|中午|凌晨)?'
    patterns = [
        (_prefix + r'\s*(\d{1,2}):(\d{2})'),
        (_prefix + r'\s*(\d{1,2})\s*点\s*(\d{1,2})\s*分?'),
    ]

    for pat in patterns:
        for m in re.finditer(pat, actual_norm):
            full = m.group(0)
            hour, minute = int(m.group(1)), int(m.group(2))
            if any(kw in full for kw in ('下午', '晚上')):
                if hour < 12:
                    hour += 12
            elif any(kw in full for kw in ('上午', '早上', '凌晨')):
                if hour == 12:
                    hour = 0
            if _minutes_close(_hm_to_minutes((hour, minute)), exp_min):
                return True

    if normalize_text(expected) in actual_norm:
        return True

    return False


# =============================================================================
# AnswerTask
# =============================================================================


class AnswerTask(BaseTask):
    """
    Task that requires the agent to answer a question.

    The answer can be checked by:
    1. Exact match (string)
    2. Fuzzy match (contains string)
    3. Numeric match (if expected is number)

    Define expected answer via ``answer`` class variable:
    - ``(".path", fn)``: initial-state path + transform → ``fn(state[path])``
    - ``".path"``: initial-state path only → ``state[path]``
    - ``{"slot": ".path", ...}``: dict of slot → initial-state path
    - ``"literal"`` / ``42``: literal value
    - ``callable``: custom logic → ``callable(self, apps_init)`` (full
      initial apps dict — index by app name for cross-app access)

    For answers that depend on final state after an operation, override
    ``get_answer()`` and read ``input.apps`` explicitly.

    Path strings support ``{param}`` templates and ``[field={param}]``
    list-find syntax (resolved against ``self.params``)::

        answer = ".contacts[name={name}].phone"   # find by param, get field
        answer = {"from": ".studentVerify.from", "to": ".studentVerify.to"}

    Path strings support an app prefix for multi-app tasks::

        answer = "redbook:.posts[0].likes"     # → redbook.posts[0].likes
        answer = ("redbook:.posts", len)        # → len(redbook.posts)

    Grounded evaluation (optional):
        answer_fields = [{"type": "choice", "label": "城市", "options": ["{city1}", "{city2}"]}]
        answer_hint = "请在答题卡中填写答案"
    """

    answer: ClassVar[Any] = None

    def get_answer(self, input: "JudgeInput") -> Any:
        """Get the ground truth answer."""
        return resolve_answer(self, input)

    def get_expected_response(self, input: "JudgeInput") -> list:
        """期望的表单答案（grounded 模式）。默认从 get_answer() 推导。

        返回列表，下标对应 answer_fields 中各字段。
        子类可覆写——例如 get_answer() 返回 re.Pattern 时需要精确值。
        """
        answer = self.get_answer(input)
        if isinstance(answer, dict):
            return [str(v) for v in answer.values()]
        return [answer]

    def check_goals(self, input: "JudgeInput") -> list[dict[str, Any]]:
        return build_answer_checks(self.get_answer(input), input.answer)


# =============================================================================
# CriteriaTask
# =============================================================================


class CriteriaTask(BaseTask):
    """
    Task that checks multiple criteria, with optional answer checking.

    Criteria is a dict where:
    - ``"route"``: Expected route path (str or list[str]), always refers to foreground app
    - Other keys: Dotted paths in app state, optionally prefixed with ``"appName:"``

    Supports parameter templates in criteria keys and string values::

        criteria = {"route": "/chat/{contact_wxid}"}
        criteria = {"contacts[name={name}].muted": True}

    Multi-app criteria::

        criteria = {
            "route": "/search",
            "redbook:user.followingIds": ["user1"],
            "wechat:chats[0].lastMessage": "xxx",
        }

    Optional ``answer`` (hybrid task)::

        answer = ".search.totalResults"  # criteria + answer
    """

    criteria: ClassVar[dict[str, Any]] = {}
    answer: ClassVar[Any] = None

    def get_answer(self, input: "JudgeInput") -> Any:
        """Get the ground truth answer. Override for dynamic answers."""
        return resolve_answer(self, input)

    def _format_value(self, value: Any) -> Any:
        """Format string values with self.params, preserving non-str types."""
        if isinstance(value, str) and "{" in value:
            # Pure reference like "{param}" — return the raw param value directly
            stripped = value.strip()
            if stripped.startswith("{") and stripped.endswith("}") and stripped.count("{") == 1:
                key = stripped[1:-1]
                if key in self.params:
                    return self.params[key]
            try:
                return value.format(**self.params)
            except KeyError:
                return value
        if isinstance(value, list):
            return [self._format_value(v) for v in value]
        return value

    def _check_criteria(self, input: "JudgeInput") -> list[dict[str, Any]]:
        """Check each criterion with detailed info."""
        checks = []

        for key, expected in self.criteria.items():
            key = _resolve_path_template(key, self.params)
            expected = self._format_value(expected)

            if key == "route":
                current_path = input.route.get("path", "")
                if isinstance(expected, list):
                    passed = current_path in expected
                    expected_str = f"one of {expected}"
                else:
                    passed = current_path == expected
                    expected_str = expected

                checks.append({
                    "field": "route",
                    "expected": expected_str,
                    "actual": current_path,
                    "passed": passed,
                })
            else:
                if key.startswith("os."):
                    actual = BaseApp.get_by_path(input.os, key[3:])
                elif key.startswith("apps."):
                    actual = BaseApp.get_by_path({"apps": input.apps}, key)
                else:
                    app_state, field_path = resolve_app_state(self.apps, input.apps, key)
                    actual = BaseApp.get_by_path(app_state, field_path)

                if isinstance(expected, Callable):
                    try:
                        passed = expected(actual)
                        expected_val = "custom_check"
                    except Exception:
                        passed = False
                        expected_val = "error_in_check"
                else:
                    passed = actual == expected
                    expected_val = expected

                checks.append({
                    "field": key,
                    "expected": expected_val,
                    "actual": actual,
                    "passed": passed,
                })

        return checks

    def check_goals(self, input: "JudgeInput") -> list[dict[str, Any]]:
        checks = self._check_criteria(input)
        if self.answer is not None or type(self).get_answer is not CriteriaTask.get_answer:
            checks.extend(build_answer_checks(self.get_answer(input), input.answer))
        return checks

    def get_expected_changes(self, input: "JudgeInput") -> list[str]:
        result: list[str] = []
        seen: set[str] = set()
        for path in self.expected_changes:
            resolved = path.format(**self.params) if self.params and "{" in path else path
            if resolved not in seen:
                result.append(resolved)
                seen.add(resolved)
        for key, raw_value in self.criteria.items():
            key = _resolve_path_template(key, self.params)
            if key == "route":
                continue
            for concrete in _expand_expected_change_paths(key, raw_value, self.apps, input):
                if concrete not in seen:
                    result.append(concrete)
                    seen.add(concrete)
        return result

    # ----- criteria inversion utility -----

    async def _invert_criteria(self, env: Any) -> None:
        """Set each criterion's initial state to the opposite of its target.

        Call this from ``_post_sample`` when the task needs the environment
        to start in a state that differs from the goal::

            async def _post_sample(self, env):
                await self._invert_criteria(env)

        Skips ``route``, callables, and array-indexed paths.
        Inverts ``bool`` (negated) and ``enum`` (rotated via ``values``).
        """
        if not self.criteria:
            return

        patch_by_app: dict[str, dict] = {}

        for raw_key, raw_value in self.criteria.items():
            if raw_key == "route" or callable(raw_value):
                continue

            resolved_key = _resolve_path_template(raw_key, self.params)

            if "[" in resolved_key:
                continue

            if ":" in resolved_key:
                app_id, field_path = resolved_key.split(":", 1)
            else:
                if not self.apps:
                    continue
                app_id = self.apps[0]
                field_path = resolved_key

            target = self._format_value(raw_value)
            inverted = _invert_value(raw_value, target,
                                     self.parameters or {})
            if inverted is None:
                continue

            if app_id not in patch_by_app:
                patch_by_app[app_id] = {}
            _set_nested(patch_by_app[app_id], field_path, inverted)

        if patch_by_app:
            # strict=True: a silently dropped inversion patch would leave the
            # env already in the goal state, making the judge trivially pass.
            await env.set_state(
                {"apps": patch_by_app}, deep=True, reload=False, strict=True,
            )


# ----- helpers for criteria inversion -----

def _invert_value(raw_value: Any, target: Any,
                  parameters: dict[str, Any]) -> Any | None:
    """Return an inverted value for *target*, or ``None`` if not invertible."""
    if isinstance(target, bool):
        return not target

    param_name = _extract_param_name(raw_value)
    if param_name:
        spec = parameters.get(param_name)
        if isinstance(spec, dict):
            values = spec.get("values")
            if values is not None:
                return _pick_different_value(values, target)

    return None


def _extract_param_name(raw_value: Any) -> str | None:
    """Return the param name from a pure ``'{param}'`` template, else None."""
    if not isinstance(raw_value, str):
        return None
    s = raw_value.strip()
    if s.startswith("{") and s.endswith("}") and s.count("{") == 1:
        return s[1:-1]
    return None


def _pick_different_value(values: "list | dict", target: Any) -> Any | None:
    """Pick the first enum value that differs from *target*."""
    items = values.values() if isinstance(values, dict) else values
    for v in items:
        if v != target:
            return v
    return None


def _set_nested(d: dict, dotted_path: str, value: Any) -> None:
    """Set *value* at a dotted path inside nested dict *d*."""
    parts = dotted_path.split(".")
    for part in parts[:-1]:
        d = d.setdefault(part, {})
    d[parts[-1]] = value


# =============================================================================
# Grounded evaluation helpers
# =============================================================================


def _default_matcher_for_field(field: dict) -> str:
    """Return the default matcher type for a grounded field."""
    ft = field.get("type", "text")
    if ft == "choice":
        return "exact"
    if ft == "number":
        return "number"
    return "exact"


def _match_grounded_field(
    matcher: str,
    expected: Any,
    actual: Any,
    os_state: dict | None = None,
) -> bool:
    """Match a single grounded field value."""
    if actual is None:
        return False
    if matcher == "number":
        try:
            return math.isclose(
                float(actual), float(expected), rel_tol=1e-6, abs_tol=1e-9
            )
        except (ValueError, TypeError):
            return False
    if matcher == "date":
        from bench_env.task.utils import date_match_labels
        labels = date_match_labels(str(expected), os_state)
        return normalize_text(str(actual).strip()) in {
            normalize_text(label) for label in labels
        }
    if matcher == "time":
        return match_time(str(expected), str(actual))
    if matcher == "duration":
        return match_duration(str(expected), str(actual))
    if matcher == "exact_tc":
        from bench_env.task.utils import to_simplified
        return normalize_text(to_simplified(str(actual).strip())) == normalize_text(to_simplified(str(expected).strip()))
    # exact
    return normalize_text(str(actual).strip()) == normalize_text(str(expected).strip())


def _match_repeatable_field(
    matcher: str,
    compare: str,
    expected: list,
    actual: list,
    os_state: dict | None = None,
) -> bool:
    """Match a repeatable grounded field (list of values)."""
    if compare == "set":
        if len(actual) != len(expected):
            return False
        remaining = list(actual)
        for exp in expected:
            idx = next(
                (i for i, act in enumerate(remaining)
                 if _match_grounded_field(matcher, exp, act, os_state)),
                None,
            )
            if idx is None:
                return False
            remaining.pop(idx)
        return not remaining

    # sequence (default)
    if len(actual) != len(expected):
        return False
    return all(
        _match_grounded_field(matcher, exp, act, os_state)
        for exp, act in zip(expected, actual)
    )


def build_grounded_checks(
    task: "BaseTask",
    input: "JudgeInput",
    sheet_state: dict,
) -> list[dict[str, Any]]:
    """Build check list for grounded evaluation mode.

    Reads fields/answers/submitted from the answer_sheet state,
    compares against task.get_expected_response().
    """
    fields = sheet_state.get("fields", [])
    answers = sheet_state.get("answers", {})
    expected_list = task.get_expected_response(input)

    # Validate expected_list type/length
    if not isinstance(expected_list, (list, tuple)):
        expected_list = [expected_list]
    if len(expected_list) != len(fields):
        raise ValueError(
            f"get_expected_response returned {len(expected_list)} values "
            f"but answer_fields has {len(fields)} fields"
        )

    checks: list[dict[str, Any]] = []
    for i, (field, expected) in enumerate(zip(fields, expected_list)):
        actual = answers.get(str(i))
        matcher = field.get("matcher") or _default_matcher_for_field(field)
        compare = field.get("compare", "sequence")

        if field.get("repeatable"):
            actual_list = actual if isinstance(actual, list) else []
            expected_as_list = expected if isinstance(expected, list) else [expected]
            passed = _match_repeatable_field(
                matcher=matcher,
                compare=compare,
                expected=expected_as_list,
                actual=actual_list,
                os_state=input.os,
            )
        else:
            passed = _match_grounded_field(
                matcher=matcher,
                expected=expected,
                actual=actual,
                os_state=input.os,
            )
        checks.append({
            "field": f"answer_sheet.{field.get('label', i)}",
            "expected": expected,
            "actual": actual,
            "passed": passed,
        })

    # submitted 检查
    submitted = sheet_state.get("submitted", False)
    checks.append({
        "field": "answer_sheet.submitted",
        "expected": True,
        "actual": submitted,
        "passed": submitted is True,
    })
    return checks
