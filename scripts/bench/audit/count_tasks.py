#!/usr/bin/env python3
"""
统计每个任务模板的可展开数量：
  - 离散组合数（enum/bool/source/pattern 等有限参数的组合）
  - 是否含有真正的连续变量（int/float 数值范围、自定义 sampler）

source 参数（从 app 状态采样）视为有限离散：
  - 运行时可用条目数 = defaults.json 对应字段的长度
  - 同一 source 被多个参数引用时，用排列数 P(n, k) 而非乘积

用法：
  python scripts/bench/audit/count_tasks.py [--suite SUITE] [--csv] [--verbose]
"""

import sys
import math
import json
import re
import argparse
from pathlib import Path
from typing import Type, Any
from collections import Counter, defaultdict

# ── 路径设置 ────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

# 绕过 bench_env/__init__.py 的重型依赖（openai 等）
import types as _types
if "bench_env" not in sys.modules:
    _pkg = _types.ModuleType("bench_env")
    _pkg.__path__ = [str(ROOT / "bench_env")]  # type: ignore[attr-defined]
    sys.modules["bench_env"] = _pkg

from bench_env.task.registry import TaskRegistry
from bench_env.task.base import BaseTask


# ── Sampler callable 变体数（子 Agent 人工分析结果） ─────────────────────────────
# 格式：sampler 函数的 qualname → 该 sampler 能产生的最大不重复变体数
# None = 真正连续（含 rng.uniform 等无限采样空间）
SAMPLER_SIZES: dict[str, int | None] = {
    # ── wechat ────────────────────────────────────────────────────────────────
    "bench_env.task.wechat.app.Wechat.sample_friend_name":         11,   # P(11,1)
    "bench_env.task.wechat.app.Wechat.sample_two_friend_names":   110,   # P(11,2)
    "bench_env.task.wechat.app.Wechat.sample_diff_steps_pair":    108,   # P(11,2)-2 步数相同的对

    # ── wechat_reading ────────────────────────────────────────────────────────
    "bench_env.task.wechat_reading.app.WechatReading.sample_book_title_not_on_shelf":          61,   # store 67 - shelf 6
    "bench_env.task.wechat_reading.app.WechatReading.sample_public_shelf_title":                5,   # shelf 6 中公开 5
    "bench_env.task.wechat_reading.app.WechatReading.sample_shelf_title":                       6,   # shelf 6 本
    "bench_env.task.wechat_reading.app.WechatReading.sample_progress_target":                  23,   # 6本×可选进度之积
    "bench_env.task.wechat_reading.app.WechatReading.sample_year_month_with_records":          13,   # distinct (year,month) 对
    "bench_env.task.wechat_reading.app.WechatReading.sample_two_books_unequal_word_counts":  2134,   # C(67,2)-77 字数相同对
    "bench_env.task.wechat_reading.app.WechatReading.sample_two_books_unequal_ratings":     2007,   # C(67,2)-204 评分相同对
    "bench_env.task.wechat_reading.app.WechatReading.sample_add_book_and_read":              427,   # 61本×7个进度
    "bench_env.task.wechat_reading.app.WechatReading.sample_percentage_for_lowest_progress_read": 6,  # 6个候选进度
    "bench_env.task.wechat_reading.app.WechatReading.sample_conditional_follow_decision":   None,   # rng.uniform → 连续
    "bench_env.task.wechat_reading.app.WechatReading.sample_following_user":                   1,   # 仅 1 个关注用户
    "bench_env.task.wechat_reading.app.WechatReading.sample_privacy_setting_bundle":           7,   # 7个隐私选项
    "bench_env.task.wechat_reading.app.WechatReading.sample_category_with_multiple_books":    11,   # ≥2本的分类

    # ── clock ────────────────────────────────────────────────────────────────
    "bench_env.task.clock.app.Clock.sample_existing_alarm":                  7,   # 7条闹钟
    "bench_env.task.clock.app.Clock.sample_noted_alarm":                     5,   # 有备注的 5 条
    "bench_env.task.clock.app.Clock.sample_new_alarm_time":                 12,   # 12个候选新时间
    "bench_env.task.clock.app.Clock.sample_existing_alarm_and_new_time":    84,   # 7×12
    "bench_env.task.clock.app.Clock.sample_two_new_alarm_times":            66,   # C(12,2)
    "bench_env.task.clock.app.Clock.sample_selected_city":                   4,   # 已选 4 城市
    "bench_env.task.clock.app.Clock.sample_selected_city_pair":             10,   # 满足整小时差的有序对
    "bench_env.task.clock.app.Clock.sample_addable_city":                   11,   # 15-4=11 未选城市
    "bench_env.task.clock.app.Clock.sample_latest_addable_city":             3,   # 北京/东京/悉尼
    "bench_env.task.clock.app.Clock.sample_remove_add_city":                44,   # 4×11
    "bench_env.task.clock.app.Clock.sample_compare_city_pair_with_new":     24,   # (new,existing) 有效有序对
    "bench_env.task.clock.app.Clock.sample_city_not_local_offset":           4,   # 中国环境下已选城市全4个

    # ── calendar ────────────────────────────────────────────────────────────
    "bench_env.task.calendar.app.Calendar.sample_future_date":          12,   # range(3,15)=12天
    "bench_env.task.calendar.app.Calendar.sample_seed_date":             4,   # SEED_DAY_OFFSETS 4个
    "bench_env.task.calendar.app.Calendar.sample_seed_date_with_birthday": 5, # 4+1生日日期
    "bench_env.task.calendar.app.Calendar.sample_seed_date_pair":        8,   # 4×2
    "bench_env.task.calendar.app.Calendar.sample_interval_pair":      2130,   # 30×71
    "bench_env.task.calendar.app.Calendar.sample_calc_forward":       2130,   # 30×71
    "bench_env.task.calendar.app.Calendar.sample_time_range":            3,   # 3个固定时段

    # ── railway12306 ─────────────────────────────────────────────────────────
    "bench_env.task.railway12306.app.Railway12306.sample_route_pair":          5,   # HOT_ROUTE_CHOICES
    "bench_env.task.railway12306.app.Railway12306.sample_my_ticket_date":      1,   # 默认数据仅1个单票日期
    "bench_env.task.railway12306.app.Railway12306.sample_passenger_pair":     72,   # P(9,2)
    "bench_env.task.railway12306.app.Railway12306.sample_new_passenger_profile": 3, # NEW_PASSENGER_PROFILES

    # ── notes ────────────────────────────────────────────────────────────────
    "bench_env.task.notes.app.Notes._sample_visible_note":              5,   # 可见笔记 5 条
    "bench_env.task.notes.app.Notes._sample_note_with_content_target":  5,   # 同上
    "bench_env.task.notes.app.Notes._sample_search_target":             5,   # 同上
    "bench_env.task.notes.app.Notes._sample_incomplete_todo":           3,   # 未完成 todo 3 条

    # ── redbook ──────────────────────────────────────────────────────────────
    "bench_env.task.redbook.app.Redbook.sample_followed_user_name":          4,   # preferred 关注用户 4
    "bench_env.task.redbook.app.Redbook.sample_unfollowed_user_name":      459,   # preferred 未关注用户
    "bench_env.task.redbook.app.Redbook.sample_user_name":                 463,   # preferred 全量用户
    "bench_env.task.redbook.app.Redbook.sample_feed_title_keyword":         31,   # feed title 关键词池
    "bench_env.task.redbook.app.Redbook.sample_replyable_feed_title_keyword": 31, # 同上（全20条均可回复）

    # ── weather ──────────────────────────────────────────────────────────────
    "bench_env.task.weather.app.Weather.sample_forecast_date_7_to_14":    8,   # range(7,15)=8天
    "bench_env.task.weather.app.Weather.sample_two_saved_cities":        30,   # P(6,2)
    "bench_env.task.weather.app.Weather.sample_three_saved_cities":     120,   # P(6,3)

    # ── spotify ──────────────────────────────────────────────────────────────
    "bench_env.task.spotify.app.Spotify.sample_liked_artist":              4,   # liked 中≥2首的艺人
    "bench_env.task.spotify.app.Spotify.sample_artist_with_search_results": 11, # 11个有搜索结果的艺人

    # ── ebay ─────────────────────────────────────────────────────────────────
    "bench_env.task.ebay.app.Ebay.sample_two_items":             90,   # P(10,2)
    "bench_env.task.ebay.app.Ebay.sample_brand_location_case":   4,   # 4个固定候选
    "bench_env.task.ebay.app.Ebay.sample_compare_pair":         180,   # P(10,2)×2种排序方向
    "bench_env.task.ebay.app.Ebay.sample_range_case":             3,   # 3个 base candidate
    "bench_env.task.ebay.app.Ebay.sample_compare_counts_groups": 12,   # P(4,2)

    # ── alipay ───────────────────────────────────────────────────────────────
    "bench_env.task.alipay.app.Alipay.sample_income_month_and_name": 3, # distinct (month,name) 对

    # ── sms ──────────────────────────────────────────────────────────────────
    "bench_env.task.sms.app.Sms.sample_compare_pair": 3,   # SMS_COMPARE_MESSAGE_COUNT_PAIRS

    # ── reddit ───────────────────────────────────────────────────────────────
    "bench_env.task.reddit.app.Reddit.sample_deletable_chat_pair": 3,   # from=me 的消息对

    # ── map ──────────────────────────────────────────────────────────────────
    "bench_env.task.map.app.Map.sample_driving_od": 4,   # DRIVING_OD_PAIRS

    # ── tencent_meeting ───────────────────────────────────────────────────────
    "bench_env.task.tencent_meeting.app.TencentMeeting.sample_two_participation_topics": 6,  # C(4,2)

    # ── device ───────────────────────────────────────────────────────────────
    "bench_env.task.device.app.Device.sample_secure_wifi_ssid": 4,   # 5条中4条非OPEN

    # ── utils（全局共享）──────────────────────────────────────────────────────
    "bench_env.task.utils.sample_future_date": 13,   # range(1,14)=13天

    # ── crossapp_work lambda ──────────────────────────────────────────────────
    "bench_env.task.crossapp_work.tasks.MeetingCreateWithPasswordNotify.<lambda>": 34,  # range(15,181,5)
}


# ── Source 条目数缓存 ─────────────────────────────────────────────────────────

def _build_source_size_map() -> dict[str, int]:
    """
    扫描所有 apps/*/data/defaults.json，构建
      "apps.<appId>.<field>" → 条目数
    的查找表。同时处理 Bilibili constants.ts 中的 recommendedUp。
    """
    size_map: dict[str, int] = {}

    # ── 1. 读 defaults.json ────────────────────────────────────────────────
    for defaults_path in ROOT.glob("apps/*/data/defaults.json"):
        try:
            data = json.loads(defaults_path.read_text())
        except Exception:
            continue

        # 推断 appId：从 manifest.ts 读 id 字段，fallback 到目录名小写
        app_dir = defaults_path.parent.parent
        app_id = _infer_app_id(app_dir)

        def _walk(obj: Any, prefix: str):
            if isinstance(obj, list):
                # prefix 是一个 list 字段 → 记录长度
                size_map[f"apps.{app_id}.{prefix}"] = len(obj)
            elif isinstance(obj, dict):
                for k, v in obj.items():
                    _walk(v, f"{prefix}.{k}" if prefix else k)

        _walk(data, "")

    # ── 2. Bilibili recommendedUp 在 constants.ts 中 ───────────────────────
    bilibili_constants = ROOT / "apps" / "Bilibili" / "constants.ts"
    if bilibili_constants.exists():
        text = bilibili_constants.read_text()
        m = re.search(r"recommendedUp\s*:\s*\[(.*?)\]", text, re.DOTALL)
        if m:
            names = re.findall(r"name\s*:\s*['\"](.+?)['\"]", m.group(1))
            if names:
                size_map["apps.bilibili.recommendedUp"] = len(names)

    # ── 3. os.providers 系统 Provider（数据文件在 defaults/ 子目录）───────
    for f in ROOT.glob("os/providers/defaults/*.json"):
        try:
            data = json.loads(f.read_text())
            for k, v in data.items():
                if isinstance(v, list):
                    size_map[f"os.providers.{f.stem.lower()}.{k}"] = len(v)
        except Exception:
            pass

    # ── 4. 运行时合并字段的特殊处理 ──────────────────────────────────────
    # apps.reddit.posts = samplePosts + userPosts（运行时在 state.ts 合并）
    try:
        reddit_data = json.loads((ROOT / "apps/Reddit/data/defaults.json").read_text())
        reddit_posts = len(reddit_data.get("samplePosts", [])) + len(reddit_data.get("userPosts", []))
        size_map["apps.reddit.posts"] = reddit_posts
    except Exception:
        pass

    return size_map


def _infer_app_id(app_dir: Path) -> str:
    """从 manifest.ts 读取 id，失败则退回目录名小写。"""
    manifest = app_dir / "manifest.ts"
    if manifest.exists():
        text = manifest.read_text()
        m = re.search(r"id\s*:\s*['\"](\w+)['\"]", text)
        if m:
            return m.group(1)
    return app_dir.name.lower()


def _resolve_source_size(source_expr: str, size_map: dict[str, int]) -> int | None:
    """
    将 source 表达式转换为条目数。
    支持两种格式：
      "apps.wechat.contacts[name]"  → strip [field] → lookup "apps.wechat.contacts"
      "os.providers.contacts.contacts[displayName]"
    """
    # strip [field] 后缀
    key = re.sub(r"\[.*?\]$", "", source_expr).rstrip(".")
    return size_map.get(key)


# ── 参数分析 ─────────────────────────────────────────────────────────────────

def _classify_param(key: str, schema: dict, size_map: dict[str, int]) -> tuple[str, int | None]:
    """
    返回 (category, count_or_None)：
      discrete   → (count 已知)     enum / bool / source（有限）
      continuous → (None)           int/float 数值范围（真正无限）
      pattern    → (None)           string pattern（生成空间极大但有限）
      sampler    → (None)           自定义 sampler（未知）
      fixed      → (1)              仅有 default，无法变化
    """
    # group sampler key（以 _ 开头）—— 同样查 SAMPLER_SIZES
    if key.startswith("_"):
        src = schema.get("source")
        smp = schema.get("sampler")
        if src:
            n = _resolve_source_size(src, size_map)
            return ("discrete", n) if n is not None else ("sampler", None)
        if smp and callable(smp):
            qname = f"{smp.__module__}.{smp.__qualname__}"
            if qname in SAMPLER_SIZES:
                n = SAMPLER_SIZES[qname]
                if n is None:
                    return ("continuous", None)
                return ("discrete", n)
            return ("sampler", None)
        return ("fixed", 1)

    src = schema.get("source")
    smp = schema.get("sampler")

    if src:
        n = _resolve_source_size(src, size_map)
        return ("discrete", n) if n is not None else ("sampler", None)

    if smp and callable(smp):
        # 查 SAMPLER_SIZES 人工分析表
        qname = f"{smp.__module__}.{smp.__qualname__}"
        if qname in SAMPLER_SIZES:
            n = SAMPLER_SIZES[qname]
            if n is None:
                return ("continuous", None)   # 明确标记为真·连续
            return ("discrete", n)
        return ("sampler", None)   # 未登记的 callable → 保守处理为无限

    t = str(schema.get("type", "")).strip().lower()

    if t == "enum":
        values = schema.get("values", [])
        n = len(values)
        return ("discrete", n) if n > 1 else ("fixed", 1)

    if t == "bool":
        return ("discrete", 2)

    if t in ("int", "float"):
        mn, mx = schema.get("min"), schema.get("max")
        if mn is not None and mx is not None and float(mx) > float(mn):
            return ("continuous", None)
        return ("fixed", 1)

    if t == "string":
        if schema.get("pattern"):
            return ("pattern", None)
        return ("fixed", 1)

    return ("fixed", 1)


def _perm(n: int, k: int) -> int:
    """P(n, k) = n! / (n-k)!"""
    if k > n:
        return 0
    result = 1
    for i in range(k):
        result *= (n - i)
    return result


def analyze_task_class(cls: Type[BaseTask], size_map: dict[str, int]) -> dict:
    """
    分析一个任务类，计算可展开的任务数量。

    关键逻辑：
    1. 将每个参数分类为 discrete / continuous / pattern / sampler / fixed
    2. 对 discrete 参数：
       - 来自同一 source 的多个参数 → 排列数 P(n, k)（假设采样时去重）
       - 不同 source 或 enum/bool → 直接相乘
    3. 有 continuous / sampler 参数 → 无限（但受 sample_max 约束）
    4. pattern 参数 → 标记为 pattern_infinite（逻辑上可无限但生成空间可预估）
    5. effective_max = sample_max 覆盖，否则 discrete_combos 或 None
    """
    params: dict[str, dict] = getattr(cls, "parameters", {}) or {}
    sample_max: int | None = getattr(cls, "sample_max", None)

    param_summary: dict[str, tuple[str, int | None]] = {}
    has_continuous = False
    has_pattern = False
    has_sampler = False

    # source → 用了几次（用于排列计算）
    source_usage: dict[str, list[str]] = defaultdict(list)  # source_key → [param_names]

    for key, schema in params.items():
        src = re.sub(r"\[.*?\]$", "", schema.get("source", "")).rstrip(".")
        cat, cnt = _classify_param(key, schema, size_map)
        param_summary[key] = (cat, cnt)

        if cat == "discrete" and schema.get("source"):
            source_usage[src].append(key)
        elif cat == "continuous":
            has_continuous = True
        elif cat == "pattern":
            has_pattern = True
        elif cat == "sampler":
            has_sampler = True

    # ── 计算离散组合数 ───────────────────────────────────────────────────────
    discrete_combos = 1
    already_counted: set[str] = set()  # 已用排列计算的 source key

    for key, (cat, cnt) in param_summary.items():
        if cat != "discrete":
            continue
        schema = params[key]
        src = re.sub(r"\[.*?\]$", "", schema.get("source", "")).rstrip(".")

        if src and src in source_usage:
            # 同一 source 的所有参数一起用排列计算
            if src not in already_counted:
                already_counted.add(src)
                n = cnt or 1
                k = len(source_usage[src])
                discrete_combos *= _perm(n, k)
        else:
            # enum / bool / 无 source 的 discrete
            discrete_combos *= (cnt or 1)

    # ── 有效上界 ─────────────────────────────────────────────────────────────
    is_infinite = has_continuous or has_sampler
    if is_infinite:
        effective_max = sample_max  # None = 真正无限
    else:
        # 纯离散（可含 pattern，pattern 也视为有限上界未知）
        if has_pattern:
            effective_max = sample_max  # pattern 无法精确计数
        else:
            effective_max = min(discrete_combos, sample_max) if sample_max else discrete_combos

    return {
        "template_count": len(getattr(cls, "templates", [])),
        "param_summary": param_summary,
        "discrete_combos": discrete_combos,
        "has_continuous": has_continuous,
        "has_pattern": has_pattern,
        "has_sampler": has_sampler,
        "sample_max": sample_max,
        "effective_max": effective_max,
        "source_usage": dict(source_usage),
    }


# ── 显示辅助 ──────────────────────────────────────────────────────────────────

def _fmt_max(info: dict) -> str:
    em = info["effective_max"]
    return "∞" if em is None else str(em)


def _infinite_tags(info: dict) -> list[str]:
    tags = []
    if info["has_continuous"]:
        tags.append("连续数值")
    if info["has_pattern"]:
        tags.append("字符串模式")
    if info["has_sampler"]:
        tags.append("自定义采样")
    return tags


def _param_detail(param_summary: dict[str, tuple[str, int | None]]) -> str:
    parts = []
    for k, (cat, cnt) in param_summary.items():
        label = k if not k.startswith("_") else f"_{cat}"
        if cnt is not None and cat == "discrete":
            parts.append(f"{label}:{cnt}")
        else:
            parts.append(f"{label}:{cat}")
    return ", ".join(parts) if parts else "（无参数）"


# ── 主逻辑 ────────────────────────────────────────────────────────────────────

def run(suites_filter: list[str] | None, csv_mode: bool, verbose: bool):
    registry = TaskRegistry()

    suites = suites_filter if suites_filter else registry.list_suites(include_generated=False)
    size_map = _build_source_size_map()

    # ── 收集数据 ───────────────────────────────────────────────────────────────
    suite_data: dict[str, list[dict]] = {}
    for suite in suites:
        rows = []
        for name in registry.list_tasks(suite):
            cls = registry.get(suite, name)
            info = analyze_task_class(cls, size_map)
            info["name"] = name
            info["suite"] = suite
            rows.append(info)
        suite_data[suite] = rows

    if csv_mode:
        _print_csv(suite_data)
    else:
        _print_table(suite_data, verbose)


def _print_table(suite_data: dict[str, list[dict]], verbose: bool):
    total_classes = 0
    total_fixed = 0         # 无参数
    total_discrete_sum = 0  # 纯离散有界任务的有效实例数之和
    total_discrete_cls = 0  # 纯离散有界任务类数
    total_infinite = 0      # 真正无限（continuous/sampler）

    for suite, rows in suite_data.items():
        print(f"\n{'═'*90}")
        print(f"  Suite: {suite}  （{len(rows)} 个任务类）")
        print(f"{'═'*90}")
        print(f"  {'任务类':<48} {'上界':>8}  {'离散乘积':>10}  说明")
        print(f"  {'-'*48} {'--------':>8}  {'----------':>10}  ----")

        for r in rows:
            em_str = _fmt_max(r)
            tags = _infinite_tags(r)
            tag_str = "  [" + ", ".join(tags) + "]" if tags else ""
            detail = _param_detail(r["param_summary"]) if verbose else ""
            note = tag_str + ("  " + detail if detail else "")

            # 标注排列计算
            perm_note = ""
            if r["source_usage"]:
                parts = []
                for src, keys in r["source_usage"].items():
                    src_short = src.split(".")[-1]
                    n_match = re.sub(r"\[.*?\]$", "", src)
                    # 从 param_summary 找 cnt
                    for k in keys:
                        cat, cnt = r["param_summary"].get(k, ("?", None))
                        if cnt:
                            parts.append(f"P({cnt},{len(keys)})" if len(keys) > 1 else f"{cnt}")
                            break
                perm_note = "  " + "×".join(parts)

            print(f"  {r['name']:<48} {em_str:>8}  {r['discrete_combos']:>10}{perm_note}{note}")

        # Suite 小计
        s_fixed = sum(1 for r in rows if not r["param_summary"])
        s_discrete_cls = sum(1 for r in rows if r["effective_max"] is not None and r["param_summary"])
        s_discrete_sum = sum(r["effective_max"] for r in rows if r["effective_max"] is not None and r["param_summary"])
        s_infinite = sum(1 for r in rows if r["effective_max"] is None)

        print(f"\n  ┌─ Suite 小计 ──────────────────────────────────────────────────────────────┐")
        print(f"  │  无参数固定: {s_fixed:<4d}  │  有界离散: {s_discrete_cls:<4d} 类 = {s_discrete_sum} 实例  │  无限采样: {s_infinite:<4d} 类")
        print(f"  └───────────────────────────────────────────────────────────────────────────┘")

        total_classes += len(rows)
        total_fixed += s_fixed
        total_discrete_cls += s_discrete_cls
        total_discrete_sum += s_discrete_sum
        total_infinite += s_infinite

    print(f"\n{'━'*90}")
    print(f"  全局汇总  （共 {total_classes} 个任务类，不含 generated_task/）")
    print(f"{'━'*90}")
    print(f"  无参数（固定）任务类:         {total_fixed:>5d}  每类 1 实例")
    print(f"  有界离散任务类:               {total_discrete_cls:>5d}  离散实例总数 = {total_discrete_sum:,}")
    print(f"  含无限采样变量任务类:         {total_infinite:>5d}  受 sample_max 控制（无 sample_max = 真·无限）")
    print(f"")
    print(f"  注：'离散实例总数' = 枚举/布尔/source(排列) 的有界笛卡尔积之和")
    print(f"      source 参数按 P(n,k) 排列（同一数据集取 k 个不重复值）")
    print()


def _print_csv(suite_data: dict[str, list[dict]]):
    import csv, io
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([
        "suite", "task_class",
        "template_count",
        "discrete_combos", "effective_max",
        "has_continuous", "has_pattern", "has_sampler",
        "sample_max",
    ])
    for suite, rows in suite_data.items():
        for r in rows:
            em = r["effective_max"] if r["effective_max"] is not None else "∞"
            w.writerow([
                suite, r["name"],
                r["template_count"],
                r["discrete_combos"], em,
                int(r["has_continuous"]), int(r["has_pattern"]), int(r["has_sampler"]),
                r["sample_max"] if r["sample_max"] is not None else "",
            ])
    print(buf.getvalue(), end="")


# ── CLI ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--suite", nargs="+", metavar="SUITE")
    parser.add_argument("--csv", action="store_true")
    parser.add_argument("--verbose", "-v", action="store_true", help="显示每个参数的详细分类")
    args = parser.parse_args()
    run(args.suite, args.csv, args.verbose)


if __name__ == "__main__":
    main()
