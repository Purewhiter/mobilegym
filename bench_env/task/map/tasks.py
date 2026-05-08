"""
Map task definitions.
"""
# -- Task Index (auto-generated, do not edit) --
# 22 tasks | L1×3  L2×7  L3×8  L4×4
#
# [L1] SearchPlaceAddress               帮我查一下{place}的具体地址
# [L1] CheckFavoritePlaceCount          我在地图里收藏了几个地方
# [L2] CheckDriveRoute                  帮我查一下到{place}的驾车路线
# [L2] CheckHighestRatedPlace           附近{radius}内评分最高的{category}是哪家，优先告诉我离我最近的
# [L2] CheckNearestPlaceAddress         离我最近的{category}在什么地址
# [L2] SetMapNorthUp                    把地图设置成始终上北下南
# [L2] SetOfflineMapDownloadPreference  把离线地图下载偏好改成{download_preference}
# [L2] QueryWalkingTime                 走路去{place}大概要多久
# [L2] QueryDrivingDistance             {place}离这儿开车有多远
# [L3] CheckRouteSuccess                从{origin}开车去{destination}怎么走，前几步告诉我
# [L3] FindBestRatedAndRoute            附近{radius}内评分最高且最近的{category}是哪家，开车过去大概多远
# [L3] ModifyMultiSettings              把地图停车位置通知设为{parking_pref}，并将保存近期搜索设为{save_recent_searches}
# [L1] DarkModeSettings                 把地图主题设为{theme}
# [L3] FindNearestWithRating            最近的{category}叫什么、评分多少
# [L3] CompareRouteDuration             查一下去{place}步行和开车哪个更快，各要多久
# [L3] CheckPlaceDetailFull             帮我查一下{place}的评分、地址和电话
# [L3] FindNearestAndRoute              帮我找最近的{category}，看看开车过去怎么走
# [L3] EstimateDrivingCost              帮我算一下开车去{place}的油费，按每公里{rate}元算
# [L4] NearestInRadiusRatingRank        最近的有评分的{category}在附近{radius}内同类评分里排第几
# [L4] BestRatedWithWalkRoute           帮我找附近{radius}内的{category}里评分最高且最近的，看看走过去多远
# [L4] PlaceDetailAndDriveRoute         我想去{place}，查查评分和地址，再看看开车要多久
# [L4] NearestDetailAndWalkRoute        最近的有评分的{category}叫什么、评分多少，走过去要多久
# -- End Task Index --


from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask, CriteriaTask
from bench_env.task.judge import JudgeInput
from bench_env.task.map.app import (
    CATEGORY_PARAM,
    DRIVING_OD_PAIRS,
    MAP_SEARCH_CHANGES,
    PLACE_PARAM,
    RADIUS_PARAM,
    Map,
)
from bench_env.task.utils import check_alternatives


# =============================================================================
# L1 — Atomic queries
# =============================================================================

class SearchPlaceAddress(AnswerTask):
    templates = ["帮我查一下{place}的具体地址"]
    apps = ["map"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["search", "query"]
    parameters = {"place": PLACE_PARAM}
    expected_changes = MAP_SEARCH_CHANGES
    answer_fields = [{"type": "text", "label": "具体地址", "hint": "如：北京市海淀区中关村大街1号"}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        answer = input.answer
        places = Map.resolve_places(self.p.place)
        return check_alternatives(
            [Map.check_answer_match(answer, Map.extract_address(p), field="answer.address") for p in places],
        )


class CheckFavoritePlaceCount(AnswerTask):
    templates = ["我在地图里收藏了几个地方"]
    apps = ["map"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["query"]
    answer = ".user.lists.favorites.count"
    answer_fields = [{"type": "number", "label": "收藏地点数"}]


# =============================================================================
# L2 — Core search and route tasks
# =============================================================================

class CheckDriveRoute(BaseTask):
    templates = ["帮我查一下到{place}的驾车路线"]
    apps = ["map"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["search", "nav"]
    parameters = {"place": PLACE_PARAM}
    expected_changes = MAP_SEARCH_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        return [
            Map(input.apps["map"]).check_route(
                mode="DRIVING",
                destination_hint=self.p.place,
            )
        ]


class CheckHighestRatedPlace(AnswerTask):
    templates = ["附近{radius}内评分最高的{category}是哪家，优先告诉我离我最近的"]
    apps = ["map"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["search", "query"]
    parameters = {"category": CATEGORY_PARAM, "radius": RADIUS_PARAM}
    expected_changes = MAP_SEARCH_CHANGES
    answer_fields = [{"type": "text", "label": "地点名称", "hint": "如：海底捞"}]

    async def _post_sample(self, env: Any) -> None:
        Map.require_rated_in_radius(self.p.category, self.p.radius)

    def get_answer(self, input: JudgeInput) -> str:
        results = Map.geo_search(self.p.category, limit=0)
        best = Map.best_rated_from_results(results, max_distance_meters=self.p.radius)
        return str(best["name"])

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        m = Map(input.apps["map"], init=input.apps_init["map"])
        sc = m.check_searched(category=self.p.category)
        if not sc["passed"]:
            return [sc, {"field": "answer.name", "passed": False, "expected": "最高评分地点名称", "actual": "前置搜索未完成"}]
        return [sc, Map.check_answer_match(input.answer, self.get_answer(input), field="answer.name")]


class CheckNearestPlaceAddress(AnswerTask):
    templates = ["离我最近的{category}在什么地址"]
    apps = ["map"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["search", "query"]
    parameters = {"category": CATEGORY_PARAM}
    expected_changes = MAP_SEARCH_CHANGES
    answer_fields = [{"type": "text", "label": "地址", "hint": "如：北京市海淀区学院路28号"}]

    def get_answer(self, input: JudgeInput) -> str:
        results = Map.geo_search(self.p.category, limit=0)
        nearest = Map.nearest_from_results(results)
        return Map.extract_address(nearest)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        m = Map(input.apps["map"], init=input.apps_init["map"])
        sc = m.check_searched(category=self.p.category)
        if not sc["passed"]:
            return [sc, {"field": "answer.address", "passed": False, "expected": "最近地点地址", "actual": "前置搜索未完成"}]
        return [sc, Map.check_answer_match(input.answer, self.get_answer(input), field="answer.address")]


class SetMapNorthUp(CriteriaTask):
    templates = [
        "把地图设置成始终上北下南",
        "Set the map to always show north at the top",
    ]
    apps = ["map"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["settings"]
    criteria = {
        "settings.navigation.keepMapNorthUp": True,
    }

    async def _post_sample(self, env: Any) -> None:
        await self._invert_criteria(env)


class SetOfflineMapDownloadPreference(CriteriaTask):
    templates = ["把离线地图下载偏好改成{download_preference}"]
    apps = ["map"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings"]
    parameters = {
        "download_preference": {
            "type": "enum",
            "values": {
                "仅通过 WLAN 网络": "仅通过 WLAN 网络",
                "通过 WLAN 或移动网络": "通过 WLAN 或移动网络",
            },
            "default": "通过 WLAN 或移动网络",
            "description": "离线地图下载偏好",
        },
    }
    criteria = {
        "settings.offlineMaps.downloadPreference": "{download_preference}",
    }

    async def _post_sample(self, env: Any) -> None:
        await self._invert_criteria(env)


class QueryWalkingTime(AnswerTask):
    templates = ["走路去{place}大概要多久"]
    apps = ["map"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["nav", "query"]
    parameters = {"place": PLACE_PARAM}
    expected_changes = MAP_SEARCH_CHANGES
    answer_fields = [{"type": "text", "label": "步行时长", "hint": "如：22分钟"}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        routes = Map.resolve_routes_from_current(self.p.place, "WALKING")
        return check_alternatives(
            [Map.check_geo_duration(input.answer, str(r["duration"]), field="answer.walk_duration") for _, r in routes],
        )


class QueryDrivingDistance(AnswerTask):
    templates = ["{place}离这儿开车有多远"]
    apps = ["map"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["nav", "query"]
    parameters = {"place": PLACE_PARAM}
    expected_changes = MAP_SEARCH_CHANGES
    answer_fields = [{"type": "text", "label": "驾车距离", "hint": "如：3.7公里"}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        routes = Map.resolve_routes_from_current(self.p.place, "DRIVING")
        return check_alternatives(
            [Map.check_geo_distance(input.answer, str(r["distance"]), field="answer.drive_distance") for _, r in routes],
        )


# =============================================================================
# L3 — Complex single-app tasks
# =============================================================================

class CheckRouteSuccess(BaseTask):
    templates = [
        "从{origin}开车去{destination}怎么走，前几步告诉我",
        "帮我看下从{origin}开车到{destination}怎么走，把前几步路线说一下",
    ]
    apps = ["map"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["nav", "query"]
    parameters = {
        "origin": {
            "type": "string",
            "default": "故宫",
            "description": "出发地（须与离线 routes.json 中已存在的驾车段一致）",
        },
        "destination": {
            "type": "string",
            "default": "天安门广场",
            "description": "目的地（须与离线 routes.json 中已存在的驾车段一致）",
        },
        "_check_route_od": {
            "sampler": Map.sample_driving_od,
            "fields": {"origin": "origin", "destination": "destination"},
        },
    }
    expected_changes = MAP_SEARCH_CHANGES
    answer_fields = [{"type": "text", "label": "前几步路线", "hint": "如：向北走200米，左转进入平安大道"}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        m = Map(input.apps["map"])
        oh, dh = self.p.origin, self.p.destination
        if (oh, dh) not in DRIVING_OD_PAIRS:
            raise ValueError(
                "CheckRouteSuccess: unknown origin/destination pair for offline route: "
                f"{oh!r} -> {dh!r}"
            )
        # 从离线 routes.json 读取期望步骤作为 ground truth，
        # 避免从 active_route（Agent 行为结果）读取导致自引用。
        triples = Map.resolve_route_pairs(oh, dh, "DRIVING")
        return check_alternatives(
            [m.check_route(mode="DRIVING", origin_hint=oh, destination_hint=dh, field="route_generated") for _ in triples],
            [Map.check_geo_steps(input.answer, Map.route_step_texts_from_api_route(route), max_steps=3) for _, _, route in triples],
        )


class FindBestRatedAndRoute(BaseTask):
    templates = [
        "附近{radius}内评分最高且最近的{category}是哪家，开车过去大概多远",
        "帮我找一下{radius}内评分最高且最近的{category}，再看看开车过去有多远",
    ]
    apps = ["map"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["search", "nav", "query"]
    parameters = {"category": CATEGORY_PARAM, "radius": RADIUS_PARAM}
    expected_changes = MAP_SEARCH_CHANGES
    answer_fields = [
        {"type": "text", "label": "地点名称", "hint": "如：便利店"},
        {"type": "text", "label": "驾车距离", "hint": "如：2.8公里"},
    ]

    async def _post_sample(self, env: Any) -> None:
        Map.require_rated_in_radius(self.p.category, self.p.radius)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        m = Map(input.apps["map"], init=input.apps_init["map"])
        sc = m.check_searched(category=self.p.category)
        if not sc["passed"]:
            _skip = "前置搜索未完成"
            return [
                sc,
                {"field": "route_to_best_rated", "passed": False, "expected": "驾车路线", "actual": _skip},
                {"field": "answer.name", "passed": False, "expected": "最高评分地点名称", "actual": _skip},
                {"field": "answer.distance", "passed": False, "expected": "驾车距离", "actual": _skip},
            ]
        results = Map.geo_search(self.p.category, limit=0)
        best = Map.best_rated_from_results(results, max_distance_meters=self.p.radius)
        best_name = str(best["name"])
        route = Map.geo_route_from_current(str(best["place_id"]), "DRIVING")
        answer = str(input.answer or "")
        return [
            sc,
            m.check_route(
                mode="DRIVING",
                destination_hint=best_name,
                field="route_to_best_rated",
            ),
            Map.check_answer_match(answer, best_name, field="answer.name"),
            Map.check_geo_distance(answer, str(route["distance"]), field="answer.distance"),
        ]


class ModifyMultiSettings(CriteriaTask):
    templates = ["把地图停车位置通知设为{parking_pref}，并将保存近期搜索设为{save_recent_searches}"]
    apps = ["map"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings"]
    parameters = {
        "parking_pref": {
            "type": "enum",
            "values": {"开启": "开启", "关闭": "关闭", "仅限应用": "仅限应用"},
            "default": "仅限应用",
            "description": "停车位置通知偏好",
        },
        "save_recent_searches": {
            "type": "bool",
            "values": {"开启": True, "关闭": False},
            "default": False,
            "description": "是否保存近期搜索",
        },
    }
    criteria = {
        "settings.notifications.traffic.parkingLocation": "{parking_pref}",
        "settings.locationPrivacy.saveRecentSearches": "{save_recent_searches}",
    }

    async def _post_sample(self, env: Any) -> None:
        await self._invert_criteria(env)


class DarkModeSettings(CriteriaTask):
    templates = ["把地图主题设为{theme}"]
    apps = ["map"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings"]
    parameters = {
        "theme": {
            "type": "enum",
            "values": {
                "浅色主题": "始终采用浅色主题",
                "深色主题": "始终采用深色主题",
                "跟随设备": "与设备主题背景一致",
            },
            "default": "始终采用深色主题",
            "description": "地图主题",
        },
    }
    criteria = {
        "settings.appDisplay.theme": "{theme}",
    }

    async def _post_sample(self, env: Any) -> None:
        await self._invert_criteria(env)


class FindNearestWithRating(AnswerTask):
    templates = [
        "最近的{category}叫什么、评分多少",
        "帮我看一下最近的{category}名字和评分",
    ]
    apps = ["map"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["search", "query"]
    parameters = {"category": CATEGORY_PARAM}
    expected_changes = MAP_SEARCH_CHANGES
    answer_fields = [
        {"type": "text", "label": "地点名称", "hint": "如：全聚德"},
        {"type": "text", "label": "评分", "hint": "如：4.2"},
    ]

    async def _post_sample(self, env: Any) -> None:
        Map.require_nearest_has_rating(self.p.category)

    def get_answer(self, input: JudgeInput) -> dict[str, Any]:
        results = Map.geo_search(self.p.category, limit=0)
        nearest = Map.nearest_rated_from_results(results)
        return {"name": str(nearest["name"]), "rating": Map.extract_rating(nearest)}

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        m = Map(input.apps["map"], init=input.apps_init["map"])
        sc = m.check_searched(category=self.p.category)
        if not sc["passed"]:
            _skip = "前置搜索未完成"
            return [
                sc,
                {"field": "answer.name", "passed": False, "expected": "最近地点名称", "actual": _skip},
                {"field": "answer.rating", "passed": False, "expected": "最近地点评分", "actual": _skip},
            ]
        expected = self.get_answer(input)
        answer = str(input.answer or "")
        return [
            sc,
            Map.check_answer_match(answer, expected["name"], field="answer.name"),
            Map.check_rating_by_name(answer, expected["name"], expected["rating"]),
        ]


class CompareRouteDuration(AnswerTask):
    templates = [
        "查一下去{place}步行和开车哪个更快，各要多久",
        "去{place}的话，步行和开车哪个花的时间更短，两种时间分别多少",
    ]
    apps = ["map"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["query", "reasoning"]
    parameters = {"place": PLACE_PARAM}
    expected_changes = MAP_SEARCH_CHANGES
    answer_fields = [
        {"type": "choice", "label": "更快的方式", "options": ["步行更快", "开车更快", "一样快"]},
        {"type": "text", "label": "步行时长", "hint": "如：18分钟"},
        {"type": "text", "label": "驾车时长", "hint": "如：12分钟"},
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        answer = str(input.answer or "")
        places = Map.resolve_places(self.p.place)
        routes = [(Map.geo_route_from_current(str(p["place_id"]), "WALKING"), Map.geo_route_from_current(str(p["place_id"]), "DRIVING")) for p in places]
        return check_alternatives(
            [Map.check_route_faster_mode_answer(answer, walking_seconds=float(w["duration_seconds"]), driving_seconds=float(d["duration_seconds"])) for w, d in routes],
            [Map.check_geo_duration(answer, str(w["duration"]), field="answer.walk_duration") for w, _ in routes],
            [Map.check_geo_duration(answer, str(d["duration"]), field="answer.drive_duration") for _, d in routes],
        )


class CheckPlaceDetailFull(AnswerTask):
    templates = [
        "帮我查一下{place}的评分、地址和电话",
        "查下{place}，把评分、地址和联系电话都告诉我",
    ]
    apps = ["map"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["search", "query"] 
    parameters = {"place": PLACE_PARAM}
    expected_changes = MAP_SEARCH_CHANGES
    answer_fields = [
        {"type": "text", "label": "评分", "hint": "如：3.8"},
        {"type": "text", "label": "地址", "hint": "如：上海市黄浦区南京东路100号"},
        {"type": "text", "label": "电话", "hint": "如：021-62345678"},
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        m = Map(input.apps["map"], init=input.apps_init["map"])
        sc = m.check_searched(category=None)
        if not sc["passed"]:
            _skip = "前置搜索未完成"
            return [
                sc,
                {"field": "answer.rating", "passed": False, "expected": "地点评分", "actual": _skip},
                {"field": "answer.address", "passed": False, "expected": "地点地址", "actual": _skip},
                {"field": "answer.phone", "passed": False, "expected": "地点电话", "actual": _skip},
            ]

        answer_text = str(input.answer or "")
        candidates = [
            p for p in Map.resolve_places(self.p.place)
            if p.get("rating") is not None
            and (p.get("formatted_address") or p.get("address"))
            and p.get("formatted_phone_number")
        ]
        if not candidates:
            raise RuntimeError(
                f"任务设计错误：'{self.p.place}' 的所有候选均缺少 rating/address/phone，"
                "无法判定，请检查数据或参数采样范围"
            )
        return check_alternatives(
            [sc] * len(candidates),
            [Map.check_place_rating_answer(answer_text, Map.extract_rating(p)) for p in candidates],
            [Map.check_place_address_answer(answer_text, Map.extract_address(p)) for p in candidates],
            [Map.check_place_phone_answer(answer_text, Map.extract_phone(p)) for p in candidates],
        )


class FindNearestAndRoute(BaseTask):
    templates = ["帮我找最近的{category}，看看开车过去怎么走"]
    apps = ["map"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["search", "nav"]
    parameters = {"category": CATEGORY_PARAM}
    expected_changes = MAP_SEARCH_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        m = Map(input.apps["map"], init=input.apps_init["map"])
        sc = m.check_searched(category=self.p.category)
        if not sc["passed"]:
            return [sc, {"field": "route_to_nearest", "passed": False, "expected": "驾车路线", "actual": "前置搜索未完成"}]
        results = Map.geo_search(self.p.category, limit=0)
        nearest_name = str(Map.nearest_from_results(results)["name"])
        return [
            sc,
            m.check_route(
                mode="DRIVING",
                destination_hint=nearest_name,
                field="route_to_nearest",
            ),
        ]


class EstimateDrivingCost(AnswerTask):
    """估算开车去目标地点的油费（查路线距离 × 费率）。

    判定：使用 Map.check_driving_cost_answer 验证 Agent 回答中
    包含正确的费用数值（距离来自离线路线数据，容忍 10% 相对误差）。
    """

    templates = [
        "帮我算一下开车去{place}的油费，按每公里{rate}元算",
        "开车去{place}大概多少油钱，按每公里{rate}元估算一下",
    ]
    apps = ["map"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["nav", "query", "reasoning"]
    parameters = {
        "place": PLACE_PARAM,
        "rate": {
            "type": "enum",
            "values": {"0.5元": 0.5, "0.8元": 0.8, "1元": 1.0},
            "default": 0.8,
            "description": "每公里油费（元）",
        },
    }
    expected_changes = MAP_SEARCH_CHANGES
    answer_fields = [{"type": "number", "label": "油费（元）"}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        return [Map.check_driving_cost_answer(
            input.answer, self.p.place, float(self.p.rate),
        )]


# =============================================================================
# L4 — Deep dive tasks
# =============================================================================

class NearestInRadiusRatingRank(AnswerTask):
    templates = [
        "最近的有评分的{category}在附近{radius}内同类评分里排第几",
        "帮我查一下最近的有评分的{category}在附近{radius}范围内同类评分排名第几位",
    ]
    apps = ["map"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L2"
    capabilities = ["search", "query", "reasoning"]
    parameters = {
        "category": CATEGORY_PARAM,
        "radius": {
            "type": "enum",
            "values": {"2公里": 2000, "3公里": 3000},
            "default": 2000,
            "description": "搜索半径（米）",
        },
    }
    expected_changes = MAP_SEARCH_CHANGES
    answer_fields = [{"type": "number", "label": "评分排名"}]

    async def _post_sample(self, env: Any) -> None:
        Map.require_rated_in_radius(self.p.category, self.p.radius, min_results=2)

    def get_answer(self, input: JudgeInput) -> int:
        results = Map.geo_search(self.p.category, limit=0)
        in_radius = Map.filter_results(
            results,
            max_distance_meters=self.p.radius,
        )
        nearest = Map.nearest_rated_from_results(in_radius)
        return Map.rating_rank_from_results(
            in_radius,
            str(nearest["name"]),
            min_results=2,
            place_id=str(nearest["place_id"]),
        )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        m = Map(input.apps["map"], init=input.apps_init["map"])
        sc = m.check_searched(category=self.p.category)
        if not sc["passed"]:
            return [sc, {"field": "answer.rank", "passed": False, "expected": "评分排名", "actual": "前置搜索未完成"}]
        return [sc, Map.check_answer_match(input.answer, self.get_answer(input), field="answer.rank")]



class BestRatedWithWalkRoute(BaseTask):
    templates = [
        "帮我找附近{radius}内的{category}里评分最高且最近的，看看走过去多远",
        "附近{radius}内{category}里评分最高且最近的是哪家，步行过去大概多远",
    ]
    apps = ["map"]
    scope = "S1"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["search", "nav", "query"]
    parameters = {"category": CATEGORY_PARAM, "radius": RADIUS_PARAM}
    expected_changes = MAP_SEARCH_CHANGES
    answer_fields = [
        {"type": "text", "label": "地点名称", "hint": "如：麦当劳"},
        {"type": "text", "label": "步行距离", "hint": "如：800米"},
    ]

    async def _post_sample(self, env: Any) -> None:
        Map.require_rated_in_radius(self.p.category, self.p.radius)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        m = Map(input.apps["map"], init=input.apps_init["map"])
        sc = m.check_searched(category=self.p.category)
        if not sc["passed"]:
            _skip = "前置搜索未完成"
            return [
                sc,
                {"field": "walk_route_to_best_rated", "passed": False, "expected": "步行路线", "actual": _skip},
                {"field": "answer.name", "passed": False, "expected": "最高评分地点名称", "actual": _skip},
                {"field": "answer.walk_distance", "passed": False, "expected": "步行距离", "actual": _skip},
            ]
        results = Map.geo_search(self.p.category, limit=0)
        best = Map.best_rated_from_results(results, max_distance_meters=self.p.radius)
        best_name = str(best["name"])
        route = Map.geo_route_from_current(str(best["place_id"]), "WALKING")
        answer = str(input.answer or "")
        return [
            sc,
            m.check_route(
                mode="WALKING",
                destination_hint=best_name,
                field="walk_route_to_best_rated",
            ),
            Map.check_answer_match(answer, best_name, field="answer.name"),
            Map.check_geo_distance(answer, str(route["distance"]), field="answer.walk_distance"),
        ]


class PlaceDetailAndDriveRoute(BaseTask):
    templates = [
        "我想去{place}，查查评分和地址，再看看开车要多久",
        "帮我看看{place}的评分和地址，再说下开车过去要多久",
    ]
    apps = ["map"]
    scope = "S1"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["search", "nav", "query"]
    parameters = {"place": PLACE_PARAM}
    expected_changes = MAP_SEARCH_CHANGES
    answer_fields = [
        {"type": "text", "label": "评分", "hint": "如：4.2"},
        {"type": "text", "label": "地址", "hint": "如：北京市海淀区中关村大街1号"},
        {"type": "text", "label": "驾车时长", "hint": "如：20分钟", "matcher": "duration"},
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        m = Map(input.apps["map"])
        # 与 crossapp_life.MapWeatherToTripNotes / MapRouteEstimateCostToWechat 相同：只取 [0]，不遍历多 POI。
        place, route = Map.resolve_routes_from_current(self.p.place, "DRIVING")[0]
        rating = Map.extract_rating(place)
        full_addr = Map.extract_address(place)
        addr_hint = full_addr.split("，")[0].split(",")[0].strip() or full_addr
        return [
            m.check_route(
                mode="DRIVING",
                destination_hint=str(place["name"]),
                field="drive_route",
            ),
            Map.check_place_rating_answer(
                input.answer,
                rating,
                field="answer.rating",
            ),
            Map.check_place_address_answer(
                input.answer,
                addr_hint,
                field="answer.address",
            ),
            Map.check_geo_duration(
                input.answer,
                str(route["duration"]),
                field="answer.drive_duration",
            ),
        ]


class NearestDetailAndWalkRoute(BaseTask):
    templates = [
        "最近的有评分的{category}叫什么、评分多少，走过去要多久",
        "帮我看下最近的有评分的{category}名字和评分，再看看步行多久能到",
    ]
    apps = ["map"]
    scope = "S1"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["search", "nav", "query"]
    parameters = {"category": CATEGORY_PARAM}
    expected_changes = MAP_SEARCH_CHANGES
    answer_fields = [
        {"type": "text", "label": "地点名称", "hint": "如：海底捞"},
        {"type": "text", "label": "评分", "hint": "如：4.5"},
        {"type": "text", "label": "步行时长", "hint": "如：9分钟", "matcher": "duration"},
    ]

    async def _post_sample(self, env: Any) -> None:
        Map.require_nearest_has_rating(self.p.category)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        m = Map(input.apps["map"], init=input.apps_init["map"])
        sc = m.check_searched(category=self.p.category)
        if not sc["passed"]:
            _skip = "前置搜索未完成"
            return [
                sc,
                {"field": "answer.name", "passed": False, "expected": "最近有评分地点名称", "actual": _skip},
                {"field": "answer.rating", "passed": False, "expected": "最近有评分地点评分", "actual": _skip},
                {"field": "answer.walk_duration", "passed": False, "expected": "步行时长", "actual": _skip},
            ]
        results = Map.geo_search(self.p.category, limit=0)
        nearest = Map.nearest_rated_from_results(results)
        nearest_name = str(nearest["name"])
        nearest_rating = Map.extract_rating(nearest)
        route = Map.geo_route_from_current(str(nearest["place_id"]), "WALKING")
        answer = str(input.answer or "")
        return [
            sc,
            Map.check_answer_match(answer, nearest_name, field="answer.name"),
            Map.check_rating_by_name(answer, nearest_name, nearest_rating),
            Map.check_geo_duration(answer, str(route["duration"]), field="answer.walk_duration"),
        ]
