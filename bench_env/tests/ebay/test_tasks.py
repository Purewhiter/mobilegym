"""
eBay task correctness tests (offline judge matrix).

Ground-truth constants below are pinned against apps/Ebay/data/products.json
by TestEbayAccessor.test_dataset_ground_truths — if the dataset drifts, that
test fails first and points at the data, not at the judge cases.
"""

from __future__ import annotations

import copy
import inspect
import json
import random
from pathlib import Path
from typing import Any

import pytest

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask
from bench_env.task.ebay import tasks as _tasks_module
from bench_env.task.ebay.app import (
    EBAY_QUERY_CATEGORY_PAIRS,
    EBAY_SEARCH_QUERY_PARAM,
    Ebay,
    expect_count,
    expect_top,
    extract_two_counts_from_natural_answer,
    infer_winner_label,
)
from bench_env.tests.conftest import make_judge_input


def _load_base_state() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[3] / "apps" / "Ebay" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


BASE_STATE = _load_base_state()
TEST_OS_STATE = {"time": {"timestamp": 1742025600000}}
DEFAULT_ROUTE = {"app": "ebay", "path": "/"}

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]
ANSWER_TASK_CLASSES = [cls for cls in ALL_TASK_CLASSES if issubclass(cls, AnswerTask)]


# ── Dataset ground truths (defaults-parameter tasks; pinned by accessor tests) ──

FAN_COUNT = 300                                    # 电风扇（无筛选）
FAN_FIRST_TITLE = "Dyson 电风扇 电子产品 1"          # 电风扇 bestMatch 第 1 名
FAN_FIRST_TOTAL = 93.03
FAN_SECOND_TITLE = "Midea 电风扇 电子产品 2"         # 电风扇 bestMatch 第 2 名（邻行负例）
SONY_EU_COUNT = 10                                 # 耳机/Sony/全新/欧洲
NIKE_EU_RANGE_COUNT = 5                            # 运动鞋/Nike/全新/欧洲，总价 510-540
DYSON_ASIA_COUNT = 25                              # 吸尘器/Dyson/全新/亚洲
DYSON_ASIA_CHEAPEST_TITLE = "Dyson 吸尘器 家庭和花园 61"
DYSON_ASIA_CHEAPEST_TOTAL = 1141.7
DYSON_ASIA_SECOND_TITLE = "Dyson 吸尘器 家庭和花园 181"   # 次便宜（查错对象负例）
DYSON_ASIA_SECOND_TOTAL = 1156.59
COMPUTER_ASIA_CHEAPEST_TOTAL = 3756.76             # 电脑/全新/亚洲 priceLow 第 1 名总价
TV_ASIA_CHEAPEST_TOTAL = 2653.23                   # 电视/全新/亚洲 priceLow 第 1 名总价
HEADPHONE_GROUP_COUNT = 6                          # 耳机/Sony/全新/欧洲，总价 620-690
SNEAKER_GROUP_COUNT = 5                            # 运动鞋/Nike/全新/欧洲，总价 510-540


# ── State builders ──────────────────────────────────────────────────


def _make_task_input(
    init_state: dict[str, Any],
    curr_state: dict[str, Any],
    *,
    route: dict[str, Any] | None = None,
    answer: str | None = None,
):
    return make_judge_input(
        {"apps": {"ebay": init_state}, "os": TEST_OS_STATE},
        {"apps": {"ebay": curr_state}, "os": TEST_OS_STATE},
        route=route or DEFAULT_ROUTE,
        answer=answer,
    )


def _search_snapshot(
    *,
    query: str,
    sort_option: str = "bestMatch",
    buying_format: str = "all",
    category_id: str | None = None,
    brand: str | None = None,
    location: str | None = None,
    free_shipping_only: bool = False,
    conditions: list[str] | None = None,
    price_min: str = "",
    price_max: str = "",
    results_count: int = 0,
    first_title: str | None = None,
    first_total_cents: int | None = None,
) -> dict[str, Any]:
    """Build a search snapshot shaped like apps/Ebay/state.ts EbaySearchSnapshot (sans id)."""
    return {
        "query": query,
        "sortOption": sort_option,
        "buyingFormat": buying_format,
        "categoryId": category_id,
        "brand": brand,
        "location": location,
        "freeShippingOnly": free_shipping_only,
        "conditions": list(conditions or []),
        "priceMin": price_min,
        "priceMax": price_max,
        "resultsCount": results_count,
        "firstTitle": first_title,
        "firstTotalCents": first_total_cents,
    }


def _with_search(*snapshots: dict[str, Any]) -> dict[str, Any]:
    """Base state after the agent ran the given searches, mirroring the app store:

    - each search appends an id-stamped snapshot to search.history;
    - search.current reflects the last search;
    - the query is prepended to recentSearches (deduplicated);
    - lastCompare is recomputed once history has >= 2 entries (state.ts logic).
    """
    state = copy.deepcopy(BASE_STATE)
    history = state["search"]["history"]
    for snap in snapshots:
        history.append({"id": str(len(history) + 1), **copy.deepcopy(snap)})
        query = snap["query"]
        state["recentSearches"] = [
            {"id": str(len(state["recentSearches"]) + 1), "query": query},
            *[item for item in state["recentSearches"] if item["query"] != query],
        ]
    state["search"]["current"] = copy.deepcopy(snapshots[-1])
    if len(history) >= 2:
        a, b = history[-2], history[-1]
        at, bt = a["firstTotalCents"], b["firstTotalCents"]
        cheaper = "same" if at is None or bt is None else ("A" if at < bt else "B" if bt < at else "same")
        state["search"]["lastCompare"] = {"a": a, "b": b, "cheaper": cheaper}
    return state


# Snapshots matching each defaults-parameter task's filters.

SONY_EU_SNAPSHOT = _search_snapshot(
    query="耳机", brand="Sony", conditions=["全新"], location="欧洲",
    results_count=SONY_EU_COUNT,
)
NIKE_EU_RANGE_SNAPSHOT = _search_snapshot(
    query="运动鞋", brand="Nike", conditions=["全新"], location="欧洲",
    price_min="510", price_max="540", results_count=NIKE_EU_RANGE_COUNT,
)
DYSON_ASIA_SNAPSHOT = _search_snapshot(
    query="吸尘器", brand="Dyson", conditions=["全新"], location="亚洲",
    sort_option="priceLow", results_count=DYSON_ASIA_COUNT,
    first_title=DYSON_ASIA_CHEAPEST_TITLE, first_total_cents=114170,
)
COMPUTER_ASIA_SNAPSHOT = _search_snapshot(
    query="电脑", conditions=["全新"], location="亚洲",
    sort_option="priceLow", results_count=50, first_total_cents=375676,
)
TV_ASIA_SNAPSHOT = _search_snapshot(
    query="电视", conditions=["全新"], location="亚洲",
    sort_option="priceLow", results_count=50, first_total_cents=265323,
)
HEADPHONE_GROUP_SNAPSHOT = _search_snapshot(
    query="耳机", brand="Sony", conditions=["全新"], location="欧洲",
    price_min="620", price_max="690", results_count=HEADPHONE_GROUP_COUNT,
)
SNEAKER_GROUP_SNAPSHOT = _search_snapshot(
    query="运动鞋", brand="Nike", conditions=["全新"], location="欧洲",
    price_min="510", price_max="540", results_count=SNEAKER_GROUP_COUNT,
)


# ── Task definition validation ──────────────────────────────────────


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert "ebay" in task.apps

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_description_renders(self, cls):
        task = cls()
        task._env_state = {"os": TEST_OS_STATE}
        desc = task.description
        assert desc
        assert "{" not in desc

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_required_class_attrs(self, cls):
        assert cls.scope in ("S1", "S2", "S3")
        assert cls.objective in ("operate", "query", "hybrid")
        assert cls.composition in ("atomic", "sequential", "transfer", "deep_dive")
        assert cls.difficulty in ("L1", "L2", "L3", "L4")

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_parameter_defaults_present(self, cls):
        for key, schema in cls.parameters.items():
            if key.startswith("_"):
                continue
            assert "default" in schema

    @pytest.mark.parametrize("cls", ANSWER_TASK_CLASSES, ids=[c.__name__ for c in ANSWER_TASK_CLASSES])
    def test_answer_task_has_answer_or_get_answer(self, cls):
        has_answer_attr = cls.answer is not None
        has_get_answer_override = cls.get_answer is not AnswerTask.get_answer
        assert has_answer_attr or has_get_answer_override


# ── Accessor & helper tests (pin the dataset + snapshot-matching semantics) ──


class TestEbayAccessor:
    def test_base_state_shape(self):
        ebay = Ebay(copy.deepcopy(BASE_STATE))
        assert ebay.recent_searches == [{"id": "1", "query": "电风扇"}]
        assert ebay.current_search["query"] == ""
        assert ebay.search_history == []
        assert ebay.last_compare is None

    def test_dataset_ground_truths(self):
        assert expect_count(query="电风扇") == FAN_COUNT
        first = expect_top(query="电风扇", sort_id="bestMatch", n=2)
        assert first[0].title == FAN_FIRST_TITLE
        assert round(first[0].total_cost, 2) == pytest.approx(FAN_FIRST_TOTAL)
        assert first[1].title == FAN_SECOND_TITLE

        assert expect_count(query="耳机", brand="Sony", condition="全新", location="欧洲") == SONY_EU_COUNT
        assert expect_count(
            query="运动鞋", brand="Nike", condition="全新", location="欧洲",
            min_total=510.0, max_total=540.0,
        ) == NIKE_EU_RANGE_COUNT
        assert expect_count(query="吸尘器", brand="Dyson", condition="全新", location="亚洲") == DYSON_ASIA_COUNT
        assert expect_count(
            query="耳机", brand="Sony", condition="全新", location="欧洲",
            min_total=620, max_total=690,
        ) == HEADPHONE_GROUP_COUNT

        ebay = Ebay(copy.deepcopy(BASE_STATE))
        answer = ebay.cheapest_product_answer(
            query="吸尘器", brand="Dyson", condition="全新", location="亚洲",
        )
        assert answer == {"title": DYSON_ASIA_CHEAPEST_TITLE, "price": pytest.approx(DYSON_ASIA_CHEAPEST_TOTAL)}

        dyson_sorted = expect_top(
            query="吸尘器", brand="Dyson", condition="全新", location="亚洲",
            sort_id="priceLow", n=2,
        )
        assert dyson_sorted[1].title == DYSON_ASIA_SECOND_TITLE
        assert round(dyson_sorted[1].total_cost, 2) == pytest.approx(DYSON_ASIA_SECOND_TOTAL)

        t1, t2 = Ebay.compare_top_totals("电脑", "电视", condition="全新", location="亚洲", sort_id="priceLow")
        assert t1 == pytest.approx(COMPUTER_ASIA_CHEAPEST_TOTAL)
        assert t2 == pytest.approx(TV_ASIA_CHEAPEST_TOTAL)

    def test_find_latest_snapshot_in_history(self):
        state = _with_search(SONY_EU_SNAPSHOT)
        ebay = Ebay(state)
        snap = ebay.find_latest_snapshot(query="耳机", brand="Sony", condition="全新", location="欧洲")
        assert snap is not None
        assert snap["resultsCount"] == SONY_EU_COUNT

    def test_find_latest_snapshot_current_fallback(self):
        # Filter-only updates only sync search.current; history stays empty.
        state = copy.deepcopy(BASE_STATE)
        state["search"]["current"] = copy.deepcopy(SONY_EU_SNAPSHOT)
        ebay = Ebay(state)
        assert ebay.search_history == []
        assert ebay.find_latest_snapshot(query="耳机", brand="Sony", condition="全新", location="欧洲") is not None

    def test_find_latest_snapshot_requires_exact_single_condition(self):
        # conditions=["全新"] is matched as the exact single-element list;
        # a snapshot with extra conditions selected must NOT match.
        snap = dict(SONY_EU_SNAPSHOT, conditions=["全新", "翻新"])
        ebay = Ebay(_with_search(snap))
        assert ebay.find_latest_snapshot(query="耳机", brand="Sony", condition="全新", location="欧洲") is None

    def test_snapshot_brand_matches_via_query_text(self):
        # Brand typed into the search box (no brand filter) still matches.
        snap = _search_snapshot(query="Sony 耳机", conditions=["全新"], location="欧洲")
        ebay = Ebay(_with_search(snap))
        assert ebay.find_latest_snapshot(query="耳机", brand="Sony", condition="全新", location="欧洲") is not None

    def test_check_has_snapshot_shape(self):
        ebay = Ebay(_with_search(SONY_EU_SNAPSHOT))
        check = ebay.check_has_snapshot(query="耳机", brand="Sony", condition="全新", location="欧洲")
        assert check["passed"] is True
        assert check["field"].startswith("snapshot.")

        untouched = Ebay(copy.deepcopy(BASE_STATE))
        check = untouched.check_has_snapshot(query="耳机", brand="Sony", condition="全新", location="欧洲")
        assert check["passed"] is False

    def test_extract_two_counts_ignores_price_bounds(self):
        text = "620 到 690 块的有 6 个；510 到 540 的有 5 双"
        assert extract_two_counts_from_natural_answer(text) == (6, 5)
        # Bare price bounds carry no count unit → fewer than two counts → None.
        assert extract_two_counts_from_natural_answer("总价区间 620 到 690 块") is None
        assert extract_two_counts_from_natural_answer(None) is None

    def test_infer_winner_label(self):
        assert infer_winner_label(6, 5, "耳机", "运动鞋") == "耳机"
        assert infer_winner_label(5, 6, "耳机", "运动鞋") == "运动鞋"
        assert infer_winner_label(5, 5, "耳机", "运动鞋") == "相同"

    def test_expect_top_raises_on_insufficient_results(self):
        with pytest.raises(ValueError):
            expect_top(query="不存在的商品词", sort_id="bestMatch", n=1)


# ── Sampler tests (offline; env_state is unused by eBay samplers) ──


class TestSamplers:
    RNG_SEEDS = [0, 1, 2]

    @pytest.mark.parametrize("seed", RNG_SEEDS)
    def test_sample_brand_location_case(self, seed):
        case = Ebay.sample_brand_location_case({}, random.Random(seed))
        assert set(case) == {"query", "brand", "location", "condition"}
        assert expect_count(
            query=case["query"], brand=case["brand"],
            condition=case["condition"], location=case["location"],
        ) > 0

    @pytest.mark.parametrize("seed", RNG_SEEDS)
    def test_sample_range_case(self, seed):
        case = Ebay.sample_range_case({}, random.Random(seed))
        lo, hi = float(case["price_min"]), float(case["price_max"])
        assert lo < hi
        assert expect_count(
            query=case["query"], brand=case["brand"],
            condition=case["condition"], location=case["location"],
            min_total=lo, max_total=hi,
        ) > 0

    @pytest.mark.parametrize("seed", RNG_SEEDS)
    def test_sample_compare_pair(self, seed):
        case = Ebay.sample_compare_pair({}, random.Random(seed))
        pool = list(EBAY_SEARCH_QUERY_PARAM["values"])
        assert case["item1"] in pool and case["item2"] in pool
        assert case["item1"] != case["item2"]
        expected_mode = {
            "priceLow": ("最便宜", "更便宜"),
            "priceHigh": ("最贵", "更贵"),
        }[case["sort_id"]]
        assert (case["extreme"], case["comparison"]) == expected_mode

    @pytest.mark.parametrize("seed", RNG_SEEDS)
    def test_sample_compare_counts_groups(self, seed):
        case = Ebay.sample_compare_counts_groups({}, random.Random(seed))
        for suffix in ("1", "2"):
            assert expect_count(
                query=case[f"query{suffix}"], brand=case[f"brand{suffix}"],
                condition=case[f"condition{suffix}"], location=case[f"location{suffix}"],
                min_total=float(case[f"price_min{suffix}"]),
                max_total=float(case[f"price_max{suffix}"]),
            ) > 0

    def test_sample_two_items_distinct(self):
        case = Ebay.sample_two_items({}, random.Random(0))
        pool = list(EBAY_SEARCH_QUERY_PARAM["values"])
        assert case["item1"] in pool and case["item2"] in pool
        assert case["item1"] != case["item2"]

    def test_sample_query_category_pair(self):
        case = Ebay.sample_query_category_pair({}, random.Random(0))
        assert {"query": case["query"], "category": case["category"]} in [
            {"query": p["query"], "category": p["category"]} for p in EBAY_QUERY_CATEGORY_PAIRS
        ]


# ── Offline judge matrix ────────────────────────────────────────────
#
# Main matrix: exactly one positive + one negative per task (completeness-checked).
# Extra axes / §4.3.4 edge cases live in the *_EXTRA_* lists with suffixed names.
# Every negative names its §4.3.3 pattern in a comment.

OFFLINE_JUDGE_POSITIVE_CASES = [
    # 操作正确：themeId 从 system 切到目标值 dark
    ("SwitchTheme", lambda: (
        _tasks_module.SwitchTheme(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            {**copy.deepcopy(BASE_STATE), "settings": {"themeId": "dark"}},
        ),
    )),
    # 搜索「电风扇」并把排序切到 priceLow
    ("SortSearchResults", lambda: (
        _tasks_module.SortSearchResults(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(_search_snapshot(
                query="电风扇", sort_option="priceLow", results_count=FAN_COUNT,
            )),
        ),
    )),
    # 搜索到位 + 自然语言答出第一个商品标题
    ("SearchFirstResult", lambda: (
        _tasks_module.SearchFirstResult(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(_search_snapshot(
                query="电风扇", results_count=FAN_COUNT,
                first_title=FAN_FIRST_TITLE, first_total_cents=9303,
            )),
            answer=f"搜了一下，排在最前面的商品是 {FAN_FIRST_TITLE}。",
        ),
    )),
    # 快照筛选完整 + 答出正确数量
    ("CountSonyHeadphonesEurope", lambda: (
        _tasks_module.CountSonyHeadphonesEurope(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(SONY_EU_SNAPSHOT),
            answer=f"欧洲发货的全新 Sony 耳机一共有 {SONY_EU_COUNT} 个。",
        ),
    )),
    # 快照含价格区间 + 答案带 510/540 干扰数字且含真值 5（§4.3.4 多数字干扰正例）
    ("CountNikeSneakersInRange", lambda: (
        _tasks_module.CountNikeSneakersInRange(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(NIKE_EU_RANGE_SNAPSHOT),
            answer=(
                f"欧洲发货的全新 Nike 运动鞋里，总价 510 到 540 块之间的有 "
                f"{NIKE_EU_RANGE_COUNT} 双。"
            ),
        ),
    )),
    # 快照到位 + 标题和总价（title/price 双槽位）都答对
    ("FindCheapestProduct", lambda: (
        _tasks_module.FindCheapestProduct(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(DYSON_ASIA_SNAPSHOT),
            answer=(
                f"最便宜的是 {DYSON_ASIA_CHEAPEST_TITLE}，"
                f"算上运费一共 {DYSON_ASIA_CHEAPEST_TOTAL} 元。"
            ),
        ),
    )),
    # 两次搜索都有快照 + 两个总价按 item1/item2 顺序给出 + 赢家标签贴着比较词
    ("CompareTwoProductPrices", lambda: (
        _tasks_module.CompareTwoProductPrices(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(COMPUTER_ASIA_SNAPSHOT, TV_ASIA_SNAPSHOT),
            answer=(
                f"亚洲发货全新的电脑，最便宜的算上运费 {COMPUTER_ASIA_CHEAPEST_TOTAL} 元；"
                f"电视最便宜的是 {TV_ASIA_CHEAPEST_TOTAL} 元，电视更便宜。"
            ),
        ),
    )),
    # 两组快照（含价格区间）都有 + 两个数量带量词 + 结论正确
    ("CompareTwoGroupCounts", lambda: (
        _tasks_module.CompareTwoGroupCounts(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(HEADPHONE_GROUP_SNAPSHOT, SNEAKER_GROUP_SNAPSHOT),
            answer=(
                f"第一组欧洲发货的全新 Sony 耳机总价 620 到 690 的有 {HEADPHONE_GROUP_COUNT} 个；"
                f"第二组 Nike 运动鞋 510 到 540 的有 {SNEAKER_GROUP_COUNT} 双，耳机选择更多。"
            ),
        ),
    )),
]

OFFLINE_JUDGE_NEGATIVE_CASES = [
    # 操作错误目标：要 dark，却切成了 light
    ("SwitchTheme", lambda: (
        _tasks_module.SwitchTheme(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            {**copy.deepcopy(BASE_STATE), "settings": {"themeId": "light"}},
        ),
    )),
    # 部分完成：搜了「电风扇」但没把排序从 bestMatch 切到 priceLow
    ("SortSearchResults", lambda: (
        _tasks_module.SortSearchResults(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(_search_snapshot(
                query="电风扇", sort_option="bestMatch", results_count=FAN_COUNT,
            )),
        ),
    )),
    # 查错对象：搜索到位，但答成了第 2 名商品的标题
    ("SearchFirstResult", lambda: (
        _tasks_module.SearchFirstResult(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(_search_snapshot(
                query="电风扇", results_count=FAN_COUNT,
                first_title=FAN_FIRST_TITLE, first_total_cents=9303,
            )),
            answer=f"搜索电风扇后，第一个商品是 {FAN_SECOND_TITLE}。",
        ),
    )),
    # 值接近但不对：筛选到位，数量报成 11（真值 10）
    ("CountSonyHeadphonesEurope", lambda: (
        _tasks_module.CountSonyHeadphonesEurope(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(SONY_EU_SNAPSHOT),
            answer=f"欧洲发货的全新 Sony 耳机一共有 {SONY_EU_COUNT + 1} 个。",
        ),
    )),
    # 过度回答含干扰数字：只复述了 510/540 价格边界，从头到尾没给出数量 5
    ("CountNikeSneakersInRange", lambda: (
        _tasks_module.CountNikeSneakersInRange(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(NIKE_EU_RANGE_SNAPSHOT),
            answer="eBay 上 510 到 540 块的 Nike 运动鞋挺多的，具体数量没数清。",
        ),
    )),
    # 查错对象：把次便宜的商品（标题、总价）当成了最便宜
    ("FindCheapestProduct", lambda: (
        _tasks_module.FindCheapestProduct(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(DYSON_ASIA_SNAPSHOT),
            answer=(
                f"最便宜的是 {DYSON_ASIA_SECOND_TITLE}，"
                f"算上运费 {DYSON_ASIA_SECOND_TOTAL} 元。"
            ),
        ),
    )),
    # 布尔翻转：两个总价都抄对了，结论却说电脑更便宜（真值：电视更便宜）
    ("CompareTwoProductPrices", lambda: (
        _tasks_module.CompareTwoProductPrices(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(COMPUTER_ASIA_SNAPSHOT, TV_ASIA_SNAPSHOT),
            answer=(
                f"亚洲发货全新的电脑最便宜 {COMPUTER_ASIA_CHEAPEST_TOTAL} 元；"
                f"电视 {TV_ASIA_CHEAPEST_TOTAL} 元。我觉得电脑更便宜。"
            ),
        ),
    )),
    # 信息传递错误：两组数量互换（5 个耳机 / 6 双运动鞋），结论随之答反
    ("CompareTwoGroupCounts", lambda: (
        _tasks_module.CompareTwoGroupCounts(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(HEADPHONE_GROUP_SNAPSHOT, SNEAKER_GROUP_SNAPSHOT),
            answer=(
                f"第一组有 {SNEAKER_GROUP_COUNT} 个，第二组有 {HEADPHONE_GROUP_COUNT} 个，"
                f"运动鞋选择更多。"
            ),
        ),
    )),
]

# §4.3.4 edge-case positives (suffixed names; outside the completeness matrix).
OFFLINE_JUDGE_EXTRA_POSITIVE_CASES = [
    # 中文数字：数量以「十个」作答
    ("CountSonyHeadphonesEurope_chinese_numeral", lambda: (
        _tasks_module.CountSonyHeadphonesEurope(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(SONY_EU_SNAPSHOT),
            answer="欧洲发货的全新 Sony 耳机一共有十个。",
        ),
    )),
    # 尾零格式：1141.7 写成 1141.70
    ("FindCheapestProduct_trailing_zero", lambda: (
        _tasks_module.FindCheapestProduct(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(DYSON_ASIA_SNAPSHOT),
            answer=f"最便宜的是 {DYSON_ASIA_CHEAPEST_TITLE}，算上运费一共 1141.70 元。",
        ),
    )),
    # metric 参数的另一分支：问总价而非标题
    ("SearchFirstResult_total_cost_metric", lambda: (
        _tasks_module.SearchFirstResult(metric="total_cost"),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(_search_snapshot(
                query="电风扇", results_count=FAN_COUNT,
                first_title=FAN_FIRST_TITLE, first_total_cents=9303,
            )),
            answer=f"第一个商品算上运费一共 {FAN_FIRST_TOTAL} 元。",
        ),
    )),
]

# Hybrid second-axis negatives + §4.3.4 edge-case negatives (suffixed names).
OFFLINE_JUDGE_EXTRA_NEGATIVE_CASES = [
    # 未操作（状态轴）：标题答对了，但压根没搜索，search.current 还是初始态
    ("SearchFirstResult_answer_right_no_search", lambda: (
        _tasks_module.SearchFirstResult(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            copy.deepcopy(BASE_STATE),
            answer=f"第一个商品是 {FAN_FIRST_TITLE}。",
        ),
    )),
    # 部分完成（状态轴）：数量答对，但快照少了发货地筛选
    ("CountSonyHeadphonesEurope_missing_location_filter", lambda: (
        _tasks_module.CountSonyHeadphonesEurope(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(_search_snapshot(
                query="耳机", brand="Sony", conditions=["全新"], results_count=20,
            )),
            answer=f"全新 Sony 耳机有 {SONY_EU_COUNT} 个。",
        ),
    )),
    # 部分完成（状态轴）：数量答对，但快照没有设置价格区间
    ("CountNikeSneakersInRange_missing_price_filter", lambda: (
        _tasks_module.CountNikeSneakersInRange(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(_search_snapshot(
                query="运动鞋", brand="Nike", conditions=["全新"], location="欧洲",
                results_count=10,
            )),
            answer=f"510 到 540 块之间的有 {NIKE_EU_RANGE_COUNT} 双。",
        ),
    )),
    # 未操作（状态轴）：标题、总价全对，但没有任何搜索快照
    ("FindCheapestProduct_answer_right_no_search", lambda: (
        _tasks_module.FindCheapestProduct(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            copy.deepcopy(BASE_STATE),
            answer=(
                f"最便宜的是 {DYSON_ASIA_CHEAPEST_TITLE}，"
                f"算上运费一共 {DYSON_ASIA_CHEAPEST_TOTAL} 元。"
            ),
        ),
    )),
    # 空回答：快照到位但一个字没答
    ("FindCheapestProduct_empty_answer", lambda: (
        _tasks_module.FindCheapestProduct(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(DYSON_ASIA_SNAPSHOT),
            answer=None,
        ),
    )),
    # 源完成部分（状态轴）：只搜了电脑没搜电视，答案却全对
    ("CompareTwoProductPrices_partial_search", lambda: (
        _tasks_module.CompareTwoProductPrices(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(COMPUTER_ASIA_SNAPSHOT),
            answer=(
                f"电脑最便宜的算上运费 {COMPUTER_ASIA_CHEAPEST_TOTAL} 元；"
                f"电视 {TV_ASIA_CHEAPEST_TOTAL} 元，电视更便宜。"
            ),
        ),
    )),
    # 部分完成（状态轴）：第二组筛选没做，答案却全对
    ("CompareTwoGroupCounts_missing_second_group", lambda: (
        _tasks_module.CompareTwoGroupCounts(),
        _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(HEADPHONE_GROUP_SNAPSHOT),
            answer=(
                f"第一组有 {HEADPHONE_GROUP_COUNT} 个，第二组有 {SNEAKER_GROUP_COUNT} 双，"
                f"耳机选择更多。"
            ),
        ),
    )),
]

OFFLINE_JUDGE_TASK_NAMES = {cls.__name__ for cls in ALL_TASK_CLASSES}


class TestTaskJudgeMatrixOffline:
    def test_offline_judge_matrix_complete(self):
        positive = {name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES}
        negative = {name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES}
        assert positive == OFFLINE_JUDGE_TASK_NAMES
        assert negative == OFFLINE_JUDGE_TASK_NAMES
        # Extra cases must reference a real task via "TaskName_suffix" naming.
        for name, _ in OFFLINE_JUDGE_EXTRA_POSITIVE_CASES + OFFLINE_JUDGE_EXTRA_NEGATIVE_CASES:
            assert any(
                name.startswith(f"{task_name}_") for task_name in OFFLINE_JUDGE_TASK_NAMES
            ), f"extra case {name!r} does not map to a known task"

    @pytest.mark.parametrize(
        "task_name,builder",
        OFFLINE_JUDGE_POSITIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_POSITIVE_CASES],
    )
    def test_positive_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert result.success, f"{task_name} positive failed: issues={result.issues}, warnings={result.warnings}"

    @pytest.mark.parametrize(
        "task_name,builder",
        OFFLINE_JUDGE_NEGATIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_NEGATIVE_CASES],
    )
    def test_negative_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert not result.success, f"{task_name} negative unexpectedly passed"

    @pytest.mark.parametrize(
        "task_name,builder",
        OFFLINE_JUDGE_EXTRA_POSITIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_EXTRA_POSITIVE_CASES],
    )
    def test_extra_positive_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert result.success, f"{task_name} positive failed: issues={result.issues}, warnings={result.warnings}"

    @pytest.mark.parametrize(
        "task_name,builder",
        OFFLINE_JUDGE_EXTRA_NEGATIVE_CASES,
        ids=[name for name, _ in OFFLINE_JUDGE_EXTRA_NEGATIVE_CASES],
    )
    def test_extra_negative_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert not result.success, f"{task_name} negative unexpectedly passed"


# ── Side-effect (expected_changes) wiring ───────────────────────────


class TestSideEffectDetection:
    def test_search_positive_is_clean(self):
        """expected_changes of search tasks covers current/history/lastCompare/recentSearches."""
        task = _tasks_module.CompareTwoGroupCounts()
        inp = _make_task_input(
            copy.deepcopy(BASE_STATE),
            _with_search(HEADPHONE_GROUP_SNAPSHOT, SNEAKER_GROUP_SNAPSHOT),
            answer=(
                f"第一组有 {HEADPHONE_GROUP_COUNT} 个，第二组有 {SNEAKER_GROUP_COUNT} 双，"
                f"耳机选择更多。"
            ),
        )
        result = task.evaluate(inp)
        assert result.success
        assert result.clean, f"unexpected warnings: {result.warnings}"

    def test_unrelated_state_pollution_flagged_as_warning(self):
        """污染无关状态：主题切对了但顺手清空了 recentSearches —— success 仍为 True，
        但必须体现在 clean=False + warnings（SwitchTheme 未声明 recentSearches 变更）。"""
        task = _tasks_module.SwitchTheme()
        curr = {**copy.deepcopy(BASE_STATE), "settings": {"themeId": "dark"}}
        curr["recentSearches"] = []
        result = task.evaluate(_make_task_input(copy.deepcopy(BASE_STATE), curr))
        assert result.success
        assert not result.clean
        assert any("recentSearches" in w["field"] for w in result.warnings)

    def test_theme_positive_is_clean(self):
        task = _tasks_module.SwitchTheme()
        curr = {**copy.deepcopy(BASE_STATE), "settings": {"themeId": "dark"}}
        result = task.evaluate(_make_task_input(copy.deepcopy(BASE_STATE), curr))
        assert result.success
        assert result.clean, f"unexpected warnings: {result.warnings}"
