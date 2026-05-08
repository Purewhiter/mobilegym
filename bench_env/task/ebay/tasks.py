"""
eBay app task definitions.
"""
# -- Task Index (auto-generated, do not edit) --
# 8 tasks | L1×1  L2×2  L3×4  L4×1
#
# [L1] SwitchTheme                把 eBay 的主题切换成{theme}。
# [L2] SortSearchResults          在 eBay 搜索「{query}」，按{sort}排序。
# [L2] SearchFirstResult          在 eBay 搜索「{query}」，告诉我第一个商品{metric}。
# [L3] CountSonyHeadphonesEurope  帮我看看 eBay 上{location}发货的{condition}{brand}{query}，有多少个。
# [L3] CountNikeSneakersInRange   eBay 上{location}发货的{brand}{query}，要{condition}的，{price_min} 到 {price_max} 块之间的有多少个？
# [L4] FindCheapestProduct        我想买个{location}发货的{brand}{query}，要{condition}的，最便宜的是哪一个，算上运费多少钱？
# [L3] CompareTwoProductPrices    帮我在 eBay 上分别搜亚洲发货的{item1}和{item2}，要全新的，看看各自{extreme}的算上运费多少钱，哪个{comparison}？
# [L3] CompareTwoGroupCounts      帮我比较两组筛选结果：{location1}发货的{condition1} {brand1} {query1}里，{price_min1} 到 {price_max1} 块的；以及{location2}发货的{condition2} {brand2} {query2}里，{price_min2} 到 {price_max2} 块的。哪个选择更多，各有多少个？
# -- End Task Index --

from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask, CriteriaTask, build_answer_checks
from bench_env.task.ebay.app import (
    EBAY_CATEGORY_VALUES,
    EBAY_SEARCH_QUERY_PARAM,
    EBAY_SORT_PARAM,
    EBAY_THEME_PARAM,
    Ebay,
    build_compare_counts_checks,
    build_compare_two_totals_checks,
    expect_count,
    expect_top,
)
from bench_env.task.judge import JudgeInput


# =============================================================================
# L1 — Atomic navigation & simple settings
# =============================================================================
class SwitchTheme(CriteriaTask):
    templates = [
        "把 eBay 的主题切换成{theme}。",
        "帮我把 eBay 设成{theme}主题。",
    ]
    apps = ["ebay"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["settings"]
    parameters = {"theme": EBAY_THEME_PARAM}
    criteria = {"settings.themeId": "{theme}"}
    optimal_paths = [["tab.me", "me.settings.open"]]

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class SortSearchResults(CriteriaTask):
    templates = [
        "在 eBay 搜索「{query}」，按{sort}排序。",
        "帮我搜一下 eBay 上的「{query}」，结果按{sort}排列。",
    ]
    apps = ["ebay"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["search"]
    parameters = {"query": EBAY_SEARCH_QUERY_PARAM, "sort": EBAY_SORT_PARAM}
    criteria = {
        "search.current.query": "{query}",
        "search.current.sortOption": "{sort}",
    }
    optimal_paths = [["tab.search"]]
    expected_changes = ["search.current", "search.history", "search.lastCompare", "recentSearches"]


class SearchFirstResult(CriteriaTask):
    templates = [
        "在 eBay 搜索「{query}」，告诉我第一个商品{metric}。",
        "帮我看一下 eBay 搜「{query}」时排在最前面的商品{metric}。",
    ]
    apps = ["ebay"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["search", "query"]
    parameters = {
        "query": EBAY_SEARCH_QUERY_PARAM,
        "metric": {
            "type": "enum",
            "values": {"叫什么": "title", "算上运费一共多少钱": "total_cost"},
            "default": "title",
            "description": "查询指标",
        },
    }
    criteria = {"search.current.query": "{query}"}
    optimal_paths = [["tab.search"]]
    expected_changes = ["search.current", "search.history", "search.lastCompare", "recentSearches"]
    @property
    def answer_fields(self):  # type: ignore[override]
        metric = getattr(self.p, "metric", None)
        label = next(
            (k for k, v in self.parameters["metric"]["values"].items() if v == metric),
            "商品信息",
        )
        t = "number" if metric == "total_cost" else "text"
        field: dict = {"type": t, "label": label}
        if metric == "title":
            field["hint"] = "请填写商品完整标题"
        elif metric == "total_cost":
            field["hint"] = "填写¥金额数字"
        return [field]

    def get_answer(self, input: JudgeInput) -> Any:
        product = expect_top(query=self.p.query, sort_id="bestMatch", n=1)[0]
        if self.p.metric == "title":
            return product.title
        return round(product.total_cost, 2)


# =============================================================================
# L3 — Multi-filter search tasks
# =============================================================================


class CountSonyHeadphonesEurope(BaseTask):
    templates = [
        "帮我看看 eBay 上{location}发货的{condition}{brand}{query}，有多少个。",
        "eBay 里{location}发货的{condition}{brand}{query}有几个？",
    ]
    apps = ["ebay"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["search", "query"]
    parameters = {
        "query": {"type": "string", "default": "耳机", "description": "搜索词"},
        "brand": {"type": "string", "default": "Sony", "description": "品牌"},
        "location": {"type": "string", "default": "欧洲", "description": "发货地"},
        "condition": {"type": "string", "default": "全新", "description": "成色"},
        "_case": {
            "sampler": Ebay.sample_brand_location_case,
            "fields": {"query": "query", "brand": "brand", "location": "location", "condition": "condition"},
        },

    }

    expected_changes = ["search.current", "search.history", "search.lastCompare", "recentSearches"]
    optimal_paths = [["tab.search"]]
    answer_fields = [{"type": "number", "label": "商品数量"}]

    def get_answer(self, input: JudgeInput) -> Any:
        return expect_count(
            query=self.p.query, brand=self.p.brand,
            condition=self.p.condition, location=self.p.location,
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ebay = Ebay(input.apps["ebay"])
        checks: list[dict[str, Any]] = []
        checks.append(ebay.check_has_snapshot(
            query=self.p.query, brand=self.p.brand,
            condition=self.p.condition, location=self.p.location,
        ))
        checks.extend(build_answer_checks(self.get_answer(input), input.answer))
        return checks



class CountNikeSneakersInRange(BaseTask):
    templates = [
        "eBay 上{location}发货的{brand}{query}，要{condition}的，{price_min} 到 {price_max} 块之间的有多少个？",
        "帮我看看{location}发货的{condition}的{brand}{query}里，{price_min} 到 {price_max} 这个价位有多少个。",
    ]
    apps = ["ebay"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["search", "query"]
    parameters = {
        "query": {"type": "string", "default": "运动鞋", "description": "搜索词"},
        "brand": {"type": "string", "default": "Nike", "description": "品牌"},
        "location": {"type": "string", "default": "欧洲", "description": "发货地"},
        "condition": {"type": "string", "default": "全新", "description": "成色"},
        "price_min": {"type": "string", "default": "510", "description": "总价下限"},
        "price_max": {"type": "string", "default": "540", "description": "总价上限"},
        "_case": {
            "sampler": Ebay.sample_range_case,
            "fields": {
                "query": "query", "brand": "brand", "location": "location",
                "condition": "condition", "price_min": "price_min", "price_max": "price_max",
            },
        },
    }

    expected_changes = ["search.current", "search.history", "search.lastCompare", "recentSearches"]
    optimal_paths = [["tab.search"]]
    answer_fields = [{"type": "number", "label": "商品数量"}]

    def get_answer(self, input: JudgeInput) -> Any:
        return expect_count(
            query=self.p.query, brand=self.p.brand,
            condition=self.p.condition, location=self.p.location,
            min_total=float(self.p.price_min), max_total=float(self.p.price_max),
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ebay = Ebay(input.apps["ebay"])
        checks: list[dict[str, Any]] = []
        checks.append(ebay.check_has_snapshot(
            query=self.p.query, brand=self.p.brand,
            condition=self.p.condition, location=self.p.location,
            price_min=self.p.price_min, price_max=self.p.price_max,
        ))
        checks.extend(build_answer_checks(self.get_answer(input), input.answer))
        return checks


class FindCheapestProduct(AnswerTask):
    templates = [
        "我想买个{location}发货的{brand}{query}，要{condition}的，最便宜的是哪一个，算上运费多少钱？",
        "帮我找一下 eBay 上{location}发货、{condition}的{brand}{query}里最便宜的那个，告诉我算上运费多少钱。",
    ]
    apps = ["ebay"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["search", "query"]
    parameters = {
        "query": {"type": "string", "default": "吸尘器", "description": "搜索词"},
        "brand": {"type": "string", "default": "Dyson", "description": "品牌"},
        "location": {"type": "string", "default": "亚洲", "description": "发货地"},
        "condition": {"type": "string", "default": "全新", "description": "成色"},
        "_case": {
            "sampler": Ebay.sample_brand_location_case,
            "fields": {"query": "query", "brand": "brand", "location": "location", "condition": "condition"},
        },
    }
    expected_changes = ["search.current", "search.history", "search.lastCompare", "recentSearches"]
    optimal_paths = [["tab.search"]]
    answer_fields = [
        {"type": "text", "label": "最便宜商品的标题", "hint": "如：Dyson V15 Detect"},
        {"type": "number", "label": "总价(¥)"},
    ]

    def get_answer(self, input: JudgeInput) -> Any:
        ebay = Ebay(input.apps["ebay"])
        return ebay.cheapest_product_answer(
            query=self.p.query, brand=self.p.brand,
            condition=self.p.condition, location=self.p.location,
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ebay = Ebay(input.apps["ebay"])
        checks = [ebay.check_has_snapshot(
            query=self.p.query, brand=self.p.brand,
            condition=self.p.condition, location=self.p.location,
        )]
        checks.extend(build_answer_checks(self.get_answer(input), input.answer))
        return checks


# =============================================================================
# L4 — Deep-dive comparisons
# =============================================================================


class CompareTwoProductPrices(BaseTask):
    templates = [
        "帮我在 eBay 上分别搜亚洲发货的{item1}和{item2}，要全新的，看看各自{extreme}的算上运费多少钱，哪个{comparison}？",
        "帮我比较一下 eBay 上亚洲发货的全新的{item1}和{item2}，各自{extreme}的算上运费各是多少？哪个{comparison}？",
    ]
    apps = ["ebay"]
    scope = "S1"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["search", "query", "reasoning"]
    parameters = {
        "item1": {"type": "string", "default": "电脑", "description": "第一个商品"},
        "item2": {"type": "string", "default": "电视", "description": "第二个商品"},
        "sort_id": {"type": "string", "default": "priceLow", "description": "排序方式"},
        "extreme": {"type": "string", "default": "最便宜", "description": "极值描述"},
        "comparison": {"type": "string", "default": "更便宜", "description": "比较词"},
        "_pair": {
            "sampler": Ebay.sample_compare_pair,
            "fields": {
                "item1": "item1", "item2": "item2",
                "sort_id": "sort_id",
                "extreme": "extreme", "comparison": "comparison",
            },
        },
    }
    optimal_paths = [["tab.search"]]
    expected_changes = ["search.current", "search.history", "search.lastCompare", "recentSearches"]
    answer_fields = [
        {"type": "choice", "label": "价格{comparison}的", "options": ["{item1}{comparison}", "{item2}{comparison}", "相同"]},
        {"type": "number", "label": "{item1}总价(¥)"},
        {"type": "number", "label": "{item2}总价(¥)"},
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ebay = Ebay(input.apps["ebay"])
        t1, t2 = Ebay.compare_top_totals(
            self.p.item1, self.p.item2,
            condition="全新", location="亚洲", sort_id=self.p.sort_id,
        )
        if self.p.sort_id == "priceLow":
            winner = self.p.item1 if t1 < t2 else (self.p.item2 if t2 < t1 else "相同")
        else:
            winner = self.p.item1 if t1 > t2 else (self.p.item2 if t2 > t1 else "相同")
        checks = [
            ebay.check_has_snapshot(
                query=self.p.item1, condition="全新",
                location="亚洲", field=f"history.{self.p.item1}_search",
            ),
            ebay.check_has_snapshot(
                query=self.p.item2, condition="全新",
                location="亚洲", field=f"history.{self.p.item2}_search",
            ),
        ]
        checks.extend(build_compare_two_totals_checks(
            label_expected=winner, label_key="winner",
            first_total=t1, first_key=f"{self.p.item1}Total",
            second_total=t2, second_key=f"{self.p.item2}Total",
            winner_marker_words=[self.p.comparison], answer=input.answer,
        ))
        return checks


class CompareTwoGroupCounts(BaseTask):
    templates = [
        "帮我比较两组筛选结果：{location1}发货的{condition1} {brand1} {query1}里，{price_min1} 到 {price_max1} 块的；以及{location2}发货的{condition2} {brand2} {query2}里，{price_min2} 到 {price_max2} 块的。哪个选择更多，各有多少个？",
        "我想对比两个范围：{location1}发货的{condition1} {brand1} {query1}（{price_min1} 到 {price_max1}）和{location2}发货的{condition2} {brand2} {query2}（{price_min2} 到 {price_max2}）。哪个结果更多，把两个数量都告诉我。",
    ]
    apps = ["ebay"]
    scope = "S1"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["search", "query", "reasoning"]
    parameters = {
        "query1": {"type": "string", "default": "耳机"},
        "brand1": {"type": "string", "default": "Sony"},
        "location1": {"type": "string", "default": "欧洲"},
        "condition1": {"type": "string", "default": "全新"},
        "price_min1": {"type": "string", "default": "620"},
        "price_max1": {"type": "string", "default": "690"},
        "query2": {"type": "string", "default": "运动鞋"},
        "brand2": {"type": "string", "default": "Nike"},
        "location2": {"type": "string", "default": "欧洲"},
        "condition2": {"type": "string", "default": "全新"},
        "price_min2": {"type": "string", "default": "510"},
        "price_max2": {"type": "string", "default": "540"},
        "_groups": {
            "sampler": Ebay.sample_compare_counts_groups,
            "fields": {
                "query1": "query1", "brand1": "brand1", "location1": "location1",
                "condition1": "condition1", "price_min1": "price_min1", "price_max1": "price_max1",
                "query2": "query2", "brand2": "brand2", "location2": "location2",
                "condition2": "condition2", "price_min2": "price_min2", "price_max2": "price_max2",
            },
        },
    }
    optimal_paths = [["tab.search"]]
    expected_changes = ["search.current", "search.history", "search.lastCompare", "recentSearches"]
    answer_fields = [
        {"type": "choice", "label": "选择更多的", "options": ["{query1}更多", "{query2}更多", "数量相同"]},
        {"type": "number", "label": "{query1}数量"},
        {"type": "number", "label": "{query2}数量"},
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        ebay = Ebay(input.apps["ebay"])
        snap1 = ebay.find_latest_snapshot(
            query=self.p.query1, brand=self.p.brand1, condition=self.p.condition1,
            location=self.p.location1, price_min=self.p.price_min1, price_max=self.p.price_max1,
        )
        snap2 = ebay.find_latest_snapshot(
            query=self.p.query2, brand=self.p.brand2, condition=self.p.condition2,
            location=self.p.location2, price_min=self.p.price_min2, price_max=self.p.price_max2,
        )
        c1 = expect_count(
            query=self.p.query1, brand=self.p.brand1, condition=self.p.condition1,
            location=self.p.location1, min_total=int(self.p.price_min1), max_total=int(self.p.price_max1),
        )
        c2 = expect_count(
            query=self.p.query2, brand=self.p.brand2, condition=self.p.condition2,
            location=self.p.location2, min_total=int(self.p.price_min2), max_total=int(self.p.price_max2),
        )
        if snap1 and isinstance(snap1.get("resultsCount"), (int, float)):
            c1 = int(snap1["resultsCount"])
        if snap2 and isinstance(snap2.get("resultsCount"), (int, float)):
            c2 = int(snap2["resultsCount"])
        more = self.p.query1 if c1 > c2 else (self.p.query2 if c2 > c1 else "相同")
        checks = [
            ebay.check_has_snapshot(
                query=self.p.query1, brand=self.p.brand1, condition=self.p.condition1,
                location=self.p.location1, price_min=self.p.price_min1, price_max=self.p.price_max1,
                field=f"history.{self.p.query1}_search",
            ),
            ebay.check_has_snapshot(
                query=self.p.query2, brand=self.p.brand2, condition=self.p.condition2,
                location=self.p.location2, price_min=self.p.price_min2, price_max=self.p.price_max2,
                field=f"history.{self.p.query2}_search",
            ),
        ]
        checks.extend(build_compare_counts_checks(
            more_expected=more,
            label1=self.p.query1, count1=c1,
            label2=self.p.query2, count2=c2,
            answer=input.answer,
        ))
        return checks
