import datetime
import re
from typing import Any, Iterable, Optional

import requests


_CITY_ALIASES: dict[str, list[str]] = {
    "北京": ["北京", "北京市", "beijing"],
    "上海": ["上海", "上海市", "shanghai"],
    "广州": ["广州", "广州市", "guangzhou"],
    "深圳": ["深圳", "深圳市", "shenzhen"],
    "杭州": ["杭州", "杭州市", "hangzhou"],
    "成都": ["成都", "成都市", "chengdu"],
    "三亚": ["三亚", "三亚市", "sanya"],
    "京都": ["京都", "kyoto"],
}


def clean_text(text: str) -> str:
    """统一自 crossapp/tasks.py、crossapp2/tasks.py。"""
    if not text:
        return ""
    # 去掉非单词字符、非中文（包括空格）
    # \u4fdd\u7559 \w + CJK + \u5e38\u7528 emoji \u5757\uff1b\u5220\u9664\u6807\u70b9/\u5168\u534a\u89d2\u7b26\u53f7/\u7a7a\u683c\u3002
    # \u4fdd\u7559 emoji \u662f\u4e3a\u4e86\u8ba9"\u590d\u5236 title"\u7c7b\u4efb\u52a1\u80fd\u5224\u5b9a Agent \u662f\u5426\u5b8c\u6574\u590d\u5236\u5e26 emoji \u7684\u6807\u9898
    # (emoji \u662f\u6570\u636e\u8bed\u4e49\u7684\u4e00\u90e8\u5206\uff0c\u4e0d\u5e94\u88ab norm \u541e\u6389)\u3002
    #   U+1F300-1FAFF: \u4e3b emoji \u533a (Pictographs / Emoticons / Symbols Extended-A/B)
    #   U+2600-27BF:   Misc Symbols + Dingbats (\u2600 \u2728 \u2713 \u2b50 etc.)
    text = re.sub(
        r"[^\w\u4e00-\u9fff\U0001F300-\U0001FAFF\u2600-\u27bf]",
        "",
        text,
    ).replace("_", "").strip()
    return text


def norm(s: str) -> str:
    """统一自 crossapp/tasks.py、crossapp2/tasks.py、spotify/tasks.py。"""
    return clean_text(str(s or "")).lower()


# ── Traditional → Simplified Chinese mapping (opencc) ─────────────────
_t2s_converter = None

def _get_t2s():
    global _t2s_converter
    if _t2s_converter is None:
        try:
            import opencc
        except ModuleNotFoundError as e:
            raise ModuleNotFoundError(
                "Missing dependency 'opencc-python-reimplemented'. Install:\n"
                "  pip install opencc-python-reimplemented"
            ) from e
        _t2s_converter = opencc.OpenCC('t2s')
    return _t2s_converter


def to_simplified(s: str) -> str:
    """Convert traditional Chinese to simplified via opencc t2s."""
    if not s:
        return s
    return _get_t2s().convert(s)


def to_float(v: Any) -> Optional[float]:
    """统一自 weather/tasks.py、crossapp/tasks.py、crossapp2/tasks.py。"""
    try:
        return float(str(v).strip())
    except Exception:
        return None


def extract_numbers(text: str) -> list[float]:
    """统一自 crossapp3/tasks.py、spe_tasks/tasks.py、ebay/tasks.py。"""
    # 仅把 ASCII 单词字符视作数字边界，允许“余额是100.23元”这类中文包裹的数值被识别。
    nums = re.findall(
        r"(?<![0-9A-Za-z_.])(-?(?:\d{1,3}(?:[，,]\d{3})+|\d+)(?:\.\d+)?)(?![0-9A-Za-z_.])",
        text or "",
    )
    out: list[float] = []
    for n in nums:
        try:
            out.append(float(n.replace(",", "").replace("，", "")))
        except Exception:
            continue
    return out


def city_aliases(city_name: str) -> list[str]:
    """返回城市名的多种匹配变体（包含本身）。"""
    key = city_name.strip()
    if key in _CITY_ALIASES:
        return _CITY_ALIASES[key]
    lowered = key.lower()
    for canonical, aliases in _CITY_ALIASES.items():
        if lowered in aliases or lowered == canonical.lower():
            return aliases
    return [key]


def amount_labels(value: float) -> list[str]:
    """生成金额的多种文本表示，用于子串匹配。"""
    rounded = round(float(value), 2)
    labels = {
        f"{rounded:.2f}",
        f"{rounded:.1f}",
        f"{rounded:g}",
        str(int(rounded)) if float(rounded).is_integer() else f"{rounded:g}",
    }
    return [label for label in labels if label]


_CN_DIGITS = "零一二三四五六七八九"
_CN_SMALL_UNITS = ["", "十", "百", "千"]
_CN_GROUP_UNITS = ["", "万", "亿", "兆"]


def _int_to_chinese_group(value: int) -> str:
    if value == 0:
        return "零"

    parts: list[str] = []
    zero_pending = False
    digits = f"{value:04d}"
    for index, ch in enumerate(digits):
        digit = int(ch)
        unit_index = 3 - index
        if digit == 0:
            if parts:
                zero_pending = True
            continue
        if zero_pending:
            parts.append("零")
            zero_pending = False
        parts.append(_CN_DIGITS[digit])
        parts.append(_CN_SMALL_UNITS[unit_index])
    return "".join(parts) or "零"


def int_to_chinese(value: int) -> str:
    """把整数转换为中文数字，如 33 -> 三十三，36650 -> 三万六千六百五十。"""
    number = int(value)
    if number == 0:
        return "零"
    if number < 0:
        return f"负{int_to_chinese(-number)}"

    groups: list[int] = []
    while number > 0:
        groups.append(number % 10000)
        number //= 10000

    parts: list[str] = []
    zero_between = False
    for group_index in range(len(groups) - 1, -1, -1):
        group = groups[group_index]
        if group == 0:
            zero_between = bool(parts)
            continue
        if parts and (zero_between or group < 1000):
            parts.append("零")
        parts.append(_int_to_chinese_group(group))
        parts.append(_CN_GROUP_UNITS[group_index])
        zero_between = False

    result = "".join(parts)
    if result.startswith("一十"):
        return result[1:]
    return result


def integer_labels(value: int) -> list[str]:
    """生成整数的多种文本表示，用于 judge 匹配。"""
    number = int(value)
    labels = {
        str(number),
        f"{number:,}",
        f"{number:,}".replace(",", "，"),
        int_to_chinese(number),
    }
    return [label for label in labels if label]


def count_titles_in_text(text: str, titles: Iterable[str]) -> int:
    """统计 titles 中有多少个标题出现在 text 中。"""
    return sum(1 for title in titles if title and title in text)


def parse_distance_to_meters(distance_text: Any) -> Optional[float]:
    """统一自 crossapp/tasks.py、crossapp3/tasks.py。"""
    s = str(distance_text or "").strip().lower()
    if not s:
        return None
    m = re.search(r"(\d+(?:\.\d+)?)", s)
    if not m:
        return None
    try:
        v = float(m.group(1))
    except Exception:
        return None
    if "mi" in s or "mile" in s:
        return v * 1609.344
    if "km" in s or "公里" in s:
        return v * 1000.0
    if "m" in s or "米" in s:
        return v
    return v


def parse_duration_to_minutes(duration_text: Any) -> Optional[float]:
    """统一自 crossapp/tasks.py。"""
    s = str(duration_text or "").strip().lower()
    if not s:
        return None
    nums = re.findall(r"(\d+(?:\.\d+)?)", s)
    if not nums:
        return None
    vals: list[float] = []
    for x in nums:
        try:
            vals.append(float(x))
        except Exception:
            continue
    if not vals:
        return None
    if "小时" in s or "hr" in s or "hour" in s:
        if len(vals) >= 2 and ("分钟" in s or "min" in s):
            return vals[0] * 60.0 + vals[1]
        return vals[0] * 60.0
    return vals[0]


def parse_duration_to_seconds(duration_text: Any) -> Optional[int]:
    """Parse a human-readable duration string to total seconds.

    Recognises Chinese (小时/分钟/秒) and English (h/hr/min/sec/…) units.
    Returns None when the text is empty or contains no recognisable units.
    """
    text = str(duration_text or "").strip()
    if not text:
        return None
    total = 0
    for pattern, multiplier in (
        (r"(\d+(?:\.\d+)?)\s*(?:小时|hr|hours?|h)", 3600),
        (r"(\d+(?:\.\d+)?)\s*(?:分钟|mins?|minutes?|m)", 60),
        (r"(\d+(?:\.\d+)?)\s*(?:秒|secs?|seconds?|s)", 1),
    ):
        m = re.search(pattern, text, re.I)
        if m:
            total += int(float(m.group(1)) * multiplier)
    return total or None


def now_ms(os_state: dict) -> int:
    """从 os_state 中提取模拟时间戳（毫秒）。禁止 fallback 到本地时间。"""
    t = (os_state or {}).get("time")
    if isinstance(t, (int, float)):
        return int(t)
    if isinstance(t, dict):
        ts = t.get("timestamp")
        if isinstance(ts, (int, float)):
            return int(ts)
    raise ValueError(
        "os_state 中缺少 time 或 time.timestamp 字段，无法获取模拟时间。"
        " 请确保 bench_env 正确读取了 __SIM__.getState() 的 os.time。"
    )


def sim_today(os_state: dict) -> datetime.date:
    """从 os_state 中提取模拟日期。禁止 fallback 到本地时间。"""
    return datetime.date.fromtimestamp(now_ms(os_state) / 1000.0)


def sim_datetime(os_state: dict) -> datetime.datetime:
    """从 os_state 中提取模拟 datetime。禁止 fallback 到本地时间。"""
    return datetime.datetime.fromtimestamp(now_ms(os_state) / 1000.0)


def today_ymd(os_state: dict) -> str:
    """统一自 spe_tasks/tasks.py。"""
    d = sim_today(os_state)
    return f"{d.year:04d}-{d.month:02d}-{d.day:02d}"


def tomorrow_ymd(os_state: dict) -> str:
    """统一自 spe_tasks/tasks.py。"""
    d = sim_today(os_state) + datetime.timedelta(days=1)
    return f"{d.year:04d}-{d.month:02d}-{d.day:02d}"


def default_tomorrow() -> str:
    """Callable default: 基于真实时间的明天 ISO 日期，用于 parameters default。"""
    return (datetime.date.today() + datetime.timedelta(days=1)).isoformat()


def sample_future_date(env_state: dict, rng) -> str:
    """Callable sampler: 基于模拟时间采样未来 1-13 天的 ISO 日期。"""
    base = sim_today((env_state.get("os") or {}))
    offset = rng.choice(range(1, 14))
    return (base + datetime.timedelta(days=offset)).isoformat()


_WEEKDAY_ZH = ["一", "二", "三", "四", "五", "六", "日"]


def format_date_natural(value: str, env_state: dict) -> str:
    """Display formatter: 明天/后天/这周X/下周X/X月X号（基于模拟时间）。"""
    parts = str(value).split("-")
    if len(parts) != 3:
        return str(value)
    target = datetime.date(int(parts[0]), int(parts[1]), int(parts[2]))
    today = sim_today(env_state.get("os") or {})
    delta = (target - today).days
    if delta == 1:
        return "明天"
    if delta == 2:
        return "后天"
    target_wd = target.weekday()
    today_wd = today.weekday()
    days_to_next_monday = 7 - today_wd
    if 0 < delta <= (6 - today_wd):
        return f"这周{_WEEKDAY_ZH[target_wd]}"
    if days_to_next_monday <= delta <= days_to_next_monday + 6:
        return f"下周{_WEEKDAY_ZH[target_wd]}"
    return f"{target.month}月{target.day}号"


def normalize_price(value: float) -> int | float:
    """统一金额显示：保留两位小数，整数则返回 int。"""
    rounded = round(float(value), 2)
    return int(rounded) if rounded == int(rounded) else rounded


def day_bounds_ms(d: datetime.date) -> tuple[int, int]:
    """统一自 crossapp3/tasks.py。"""
    start = datetime.datetime(d.year, d.month, d.day, 0, 0, 0)
    end = start + datetime.timedelta(days=1)
    return int(start.timestamp() * 1000), int(end.timestamp() * 1000)


def day_time_ms(d: datetime.date, time_text: str = "00:00") -> int:
    """返回指定模拟本地日期和 HH:MM 时间对应的毫秒时间戳。"""
    hour, minute = [int(part) for part in time_text.split(":")]
    dt = datetime.datetime(d.year, d.month, d.day, hour, minute)
    return int(dt.timestamp() * 1000)


def opened_app_since_init(os_state: dict, os_init_state: dict, app_id: str) -> bool:
    """Check whether *app_id* was opened after task start."""
    current_running = os_state["runningApps"]
    initial_running = os_init_state["runningApps"]
    return app_id in current_running and app_id not in initial_running


def norm_city_key(s: Any) -> str:
    """统一自 weather/tasks.py、crossapp/tasks.py、crossapp2/tasks.py。"""
    s = str(s or "").strip().lower()
    s = re.sub(r"\s+", "", s)
    if s.endswith("市"):
        s = s[:-1]
    return s


def parse_date(value: str) -> datetime.date | None:
    """统一自 crossapp3/tasks.py。"""
    text = str(value or "").strip()
    if not text:
        return None
    try:
        return datetime.date.fromisoformat(text)
    except Exception:
        pass
    matched = re.search(r"(\d{4})\D+(\d{1,2})\D+(\d{1,2})", text)
    if not matched:
        return None
    try:
        return datetime.date(
            int(matched.group(1)),
            int(matched.group(2)),
            int(matched.group(3)),
        )
    except Exception:
        return None


_RELATIVE_DAY_NAMES = {0: "今天", 1: "明天", 2: "后天", 3: "大后天"}


def date_match_labels(
    date_value: str,
    os_state: dict | None = None,
) -> list[str]:
    """Generate all plausible textual representations of a date for fuzzy matching.

    Returns labels in order: ISO, M月D日, M月D号, D日, D号, 周X, 星期X,
    plus relative labels (今天/明天/后天/大后天/这周X/下周X) when *os_state* is provided.
    """
    parsed = parse_date(date_value)
    if parsed is None:
        return [str(date_value)]

    wd_zh = _WEEKDAY_ZH[parsed.weekday()]
    labels = [
        parsed.isoformat(),
        f"{parsed.month}月{parsed.day}日",
        f"{parsed.month}月{parsed.day}号",
        f"{parsed.day}日",
        f"{parsed.day}号",
        f"周{wd_zh}",
        f"星期{wd_zh}",
    ]

    if os_state is not None:
        try:
            today = sim_today(os_state)
            delta = (parsed - today).days
            rel = _RELATIVE_DAY_NAMES.get(delta)
            if rel is not None:
                labels.append(rel)
            # 这周X / 下周X（与 format_date_natural 逻辑对齐）
            if delta > 0:
                today_wd = today.weekday()
                if delta <= (6 - today_wd):
                    labels.append(f"这周{wd_zh}")
                else:
                    days_to_next_monday = 7 - today_wd
                    if days_to_next_monday <= delta <= days_to_next_monday + 6:
                        labels.append(f"下周{wd_zh}")
        except ValueError:
            pass

    return labels


def format_fixed(value: float, decimal_places: int) -> str:
    """统一自 crossapp3/tasks.py。"""
    decimal_places = max(0, min(10, int(decimal_places)))
    return f"{value:.{decimal_places}f}"


def extract_urls(text: str) -> list[str]:
    """统一自 crossapp3/tasks.py。"""
    return [
        url.strip().rstrip(").,，。")
        for url in re.findall(r"https?://\S+", text or "")
    ]


def basename(path: Any) -> str:
    """统一自 crossapp3/tasks.py。"""
    text = str(path or "").strip()
    if not text:
        return ""
    text = text.split("?", 1)[0].split("#", 1)[0].replace("\\", "/")
    return text.rsplit("/", 1)[-1]


def strip_postal_suffix(text: str) -> str:
    """统一自 crossapp/tasks.py、crossapp2/tasks.py。"""
    raw = str(text or "").strip()
    matched = re.search(r"(邮政编码|邮编)\s*[:：]?", raw)
    if matched:
        raw = raw[: matched.start()].strip()
    # Strip Plus Code suffix (e.g. "275X+67P", "W9CW+7PQ")
    raw = re.sub(r"\s*[A-Z0-9]{2,6}\+[A-Z0-9]{2,4}\s*$", "", raw)
    return raw


def parse_hhmm(value: str) -> int | None:
    """统一自 spe_tasks/tasks.py。"""
    matched = re.fullmatch(r"(\d{1,2}):(\d{2})", str(value or "").strip())
    if not matched:
        return None
    hour = int(matched.group(1))
    minute = int(matched.group(2))
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None
    return hour * 60 + minute


def format_hhmm(hour: int, minute: int) -> str:
    """格式化小时和分钟为 HH:MM 字符串。"""
    return f"{int(hour):02d}:{int(minute):02d}"


def new_items_by_id(
    current: list[dict[str, Any]], initial: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    """统一自 spe_tasks/tasks.py。"""
    initial_ids = {str((item or {}).get("id", "")) for item in (initial or [])}
    result: list[dict[str, Any]] = []
    for item in current or []:
        item_id = str((item or {}).get("id", ""))
        if item_id and item_id not in initial_ids:
            result.append(item)
    result.sort(key=lambda item: int((item or {}).get("timestamp", 0) or 0))
    return result


def numbers_contain_all(
    haystack: list[float], expected: list[float], tol: float = 0.02
) -> bool:
    """统一自 spe_tasks/tasks.py。"""
    for value in expected:
        if not any(abs(float(item) - float(value)) <= tol for item in haystack):
            return False
    return True


def subsequence_contains_numbers(
    numbers: list[float], expected: list[float], tol: float = 0.02
) -> bool:
    """统一自 spe_tasks/tasks.py。"""
    if not expected:
        return True
    index = 0
    for number in numbers:
        if abs(float(number) - float(expected[index])) <= tol:
            index += 1
            if index >= len(expected):
                return True
    return False


def has_close_number(text: str, expected: float, tol: float = 0.01) -> bool:
    """统一自 ebay/tasks.py。"""
    for number in extract_numbers(text):
        if abs(number - expected) <= tol:
            return True
    return False


def has_int(text: str, expected: int) -> bool:
    """统一自 ebay/tasks.py。"""
    ints = re.findall(r"(?<!\d)(\d+)(?!\d)", text)
    return any(int(value) == expected for value in ints)


def url_content_contains(url: str, keyword: str) -> bool:
    """统一自 crossapp3/tasks.py。"""
    url = str(url or "").strip()
    keyword = str(keyword or "").strip()
    if not url or not keyword:
        return False
    try:
        response = requests.get(
            url,
            timeout=10,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/91.0.4472.124 Safari/537.36"
                ),
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
        )
        if not getattr(response, "ok", False):
            return False
        if response.encoding == "ISO-8859-1":
            response.encoding = response.apparent_encoding
        body = str(getattr(response, "text", "") or "")
        return keyword in body or norm(keyword) in norm(body)
    except Exception:
        return False


def check_alternatives(
    *check_arrays: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """多组按位置对应的 check 结果，返回第一组全通过的；都不过返回第一组。

    每个数组长度相同，同一下标的元素属于同一个候选。
    示例::

        places = Map.resolve_places("故宫")
        return check_alternatives(
            [wechat.check_sent(addr(p), ...) for p in places],
            [wechat.check_sent(weather(p), ...) for p in places],
        )
    """
    if not check_arrays:
        return []
    lengths = [len(arr) for arr in check_arrays]
    if any(length == 0 for length in lengths):
        raise ValueError("check_alternatives got empty candidate list")
    if len(set(lengths)) != 1:
        raise ValueError(f"check_alternatives got mismatched lengths: {lengths}")
    n = lengths[0]
    for i in range(n):
        group = [arr[i] for arr in check_arrays]
        if all(c.get("passed") for c in group):
            return group
    return [arr[0] for arr in check_arrays]
