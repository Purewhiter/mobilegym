"""
Map task correctness tests.
"""

from __future__ import annotations

import copy
import inspect
import json
from pathlib import Path
from typing import Any

import pytest

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask, CriteriaTask
from bench_env.task.judge import JudgeInput
from bench_env.task.map import tasks as _tasks_module
from bench_env.task.map.app import Map
from bench_env.tests.conftest import make_judge_input

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]
ANSWER_TASK_CLASSES = [cls for cls in ALL_TASK_CLASSES if issubclass(cls, AnswerTask)]

TEST_OS_STATE = {"time": {"timestamp": 1742025600000}}
DEFAULT_ROUTE = {"app": "map", "path": "/"}


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[2] / "apps" / "Map" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


def _base_state() -> dict[str, Any]:
    state = copy.deepcopy(_load_defaults())
    state["currentLocation"] = {"latitude": 39.9042, "longitude": 116.4074}
    state["currentView"] = {
        "searchResults": [],
        "poi": None,
        "route": None,
        "routeModes": {},
        "autocomplete": None,
    }
    return state


DEFAULTS = _load_defaults()
BASE_STATE = _base_state()


def _make_task_input(
    init_state: dict[str, Any],
    curr_state: dict[str, Any],
    *,
    route: dict[str, Any] | None = None,
    init_route: dict[str, Any] | None = None,
    answer: str | None = None,
) -> JudgeInput:
    return make_judge_input(
        {"apps": {"map": init_state}, "os": TEST_OS_STATE},
        {"apps": {"map": curr_state}, "os": TEST_OS_STATE},
        route=route or DEFAULT_ROUTE,
        init_route=init_route,
        answer=answer,
    )


def _deep_update(target: dict[str, Any], patch: dict[str, Any]) -> None:
    for key, value in patch.items():
        if isinstance(value, dict) and isinstance(target.get(key), dict):
            _deep_update(target[key], value)
        else:
            target[key] = value


def _state(
    *,
    search_results: list[dict[str, Any]] | None = None,
    active_poi: dict[str, Any] | None = None,
    route: dict[str, Any] | None = None,
    route_modes: dict[str, Any] | None = None,
    autocomplete: dict[str, Any] | None = None,
    settings_patch: dict[str, Any] | None = None,
    user_patch: dict[str, Any] | None = None,
) -> dict[str, Any]:
    state = copy.deepcopy(BASE_STATE)
    if search_results is not None:
        state["currentView"]["searchResults"] = copy.deepcopy(search_results)
    if active_poi is not None:
        state["currentView"]["poi"] = copy.deepcopy(active_poi)
    if route is not None:
        state["currentView"]["route"] = copy.deepcopy(route)
    if route_modes is not None:
        state["currentView"]["routeModes"] = copy.deepcopy(route_modes)
    if autocomplete is not None:
        state["currentView"]["autocomplete"] = copy.deepcopy(autocomplete)
    if settings_patch is not None:
        _deep_update(state["settings"], copy.deepcopy(settings_patch))
    if user_patch is not None:
        _deep_update(state["user"], copy.deepcopy(user_patch))
    return state


def _place(
    name: str,
    *,
    address: str,
    rating: float | None = None,
    review_count: int | None = None,
    phone: str | None = None,
    distance: str | None = None,
    distance_meters: int | None = None,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "name": name,
        "address": address,
        "formatted_address": address,
    }
    if rating is not None:
        result["rating"] = rating
    if review_count is not None:
        result["user_ratings_total"] = review_count
    if phone is not None:
        result["formatted_phone_number"] = phone
    if distance is not None:
        result["distance"] = distance
    if distance_meters is not None:
        result["distance_meters"] = distance_meters
    return result


def _route(
    *,
    mode: str,
    destination: str,
    origin: str = "当前位置",
    distance: str = "2.4公里",
    steps: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    return {
        "mode": mode,
        "origin": {"name": origin},
        "destination": {"name": destination},
        "distance": distance,
        "steps": copy.deepcopy(steps or []),
    }


def _route_modes() -> dict[str, Any]:
    return {
        "modes": {
            "WALKING": {
                "distance": "3.2公里",
                "distance_meters": 3200,
                "duration": "45分钟",
                "duration_seconds": 2700,
            },
            "DRIVING": {
                "distance": "4.8公里",
                "distance_meters": 4800,
                "duration": "18分钟",
                "duration_seconds": 1080,
            },
        }
    }


NATIONAL_MUSEUM = _place(
    "中国国家博物馆",
    address="北京市东城区东长安街16号",
    rating=4.8,
    review_count=1280,
    phone="010-65116400",
    distance="1.2公里",
    distance_meters=1200,
)
FORBIDDEN_CITY = _place(
    "故宫",
    address="北京市东城区景山前街4号",
    rating=4.8,
    review_count=5621,
    phone="400-950-1925",
    distance="2.6公里",
    distance_meters=2600,
)
PIZZA_HUT = _place(
    "必胜客(西单店)",
    address="北京市西城区西单北大街131号",
    rating=4.5,
    review_count=256,
    phone="010-66012345",
    distance="500米",
    distance_meters=500,
)
HAIDILAO = _place(
    "海底捞(西单店)",
    address="北京市西城区西单北大街133号",
    rating=4.9,
    review_count=1600,
    phone="010-66056789",
    distance="900米",
    distance_meters=900,
)
BURGER_KING = _place(
    "汉堡王(西单店)",
    address="北京市西城区西单北大街129号",
    rating=4.2,
    review_count=380,
    phone="010-66011111",
    distance="300米",
    distance_meters=300,
)
MANNER = _place(
    "Manner Coffee(王府井店)",
    address="北京市东城区王府井大街138号",
    rating=4.9,
    review_count=420,
    phone="010-67010001",
    distance="260米",
    distance_meters=260,
)
LUCKIN = _place(
    "瑞幸咖啡(东华门店)",
    address="北京市东城区东华门大街20号",
    rating=4.7,
    review_count=320,
    phone="010-67010002",
    distance="180米",
    distance_meters=180,
)
STARBUCKS = _place(
    "星巴克(王府井店)",
    address="北京市东城区王府井大街88号",
    rating=4.6,
    review_count=510,
    phone="010-67010003",
    distance="320米",
    distance_meters=320,
)
APM = _place(
    "apm购物中心",
    address="北京市东城区王府井大街138号",
    rating=4.6,
    review_count=980,
    phone="010-85186688",
    distance="300米",
    distance_meters=300,
)
JOY_CITY = _place(
    "大悦城",
    address="北京市西城区西单北大街131号",
    rating=4.7,
    review_count=2100,
    phone="010-66018888",
    distance="500米",
    distance_meters=500,
)
SKP = _place(
    "SKP",
    address="北京市朝阳区建国路87号",
    rating=4.8,
    review_count=3200,
    phone="010-65307788",
    distance="1.8公里",
    distance_meters=1800,
)

def _with_new_search(state: dict[str, Any], keyword: str = "测试搜索") -> dict[str, Any]:
    """Add a new searchHistory entry so check_searched passes."""
    state = copy.deepcopy(state)
    history = state.setdefault("searchHistory", [])
    history.append({"id": "test_new_search", "kind": "query", "text": keyword})
    return state


RESTAURANT_RESULTS = [BURGER_KING, PIZZA_HUT, HAIDILAO]
CAFE_RESULTS = [LUCKIN, MANNER, STARBUCKS]
SHOPPING_RESULTS = [APM, JOY_CITY, SKP]
MUSEUM_RESULTS = [NATIONAL_MUSEUM]
FORBIDDEN_CITY_RESULTS = [FORBIDDEN_CITY]
AUTOCOMPLETE_RESULTS = {
    "query": "银行",
    "suggestions": [
        {"main_text": "中国银行(王府井支行)", "description": "中国银行(王府井支行)"},
        {"main_text": "工商银行(东长安街支行)", "description": "工商银行(东长安街支行)"},
        {"main_text": "建设银行(天安门支行)", "description": "建设银行(天安门支行)"},
    ],
}
ROUTE_STEPS = [
    {"instruction": "向东出发", "distance": "120米"},
    {"instruction": "右转进入东华门大街", "distance": "300米"},
    {"instruction": "继续直行到达目的地", "distance": "500米"},
]


def _parse_path(path: str) -> list[str]:
    return [part for part in path.split(".") if part]


def _set_by_path(state: dict[str, Any], path: str, value: Any) -> None:
    current: Any = state
    parts = _parse_path(path)
    for part in parts[:-1]:
        current = current[part]
    current[parts[-1]] = value


def _resolve_criteria_value(value: Any, params: dict[str, Any]) -> Any:
    if isinstance(value, str):
        match = __import__("re").fullmatch(r"\{(\w+)\}", value)
        if match:
            return params[match.group(1)]
    return value


SLOT_LABELS = {
    "name": "名称",
    "rating": "评分",
    "address": "地址",
    "phone": "电话",
}


def _natural_answer(expected: Any) -> str:
    if isinstance(expected, dict):
        parts = []
        for key, value in expected.items():
            label = SLOT_LABELS.get(key, key)
            parts.append(f"{label}是{value}")
        return "，".join(parts)
    if isinstance(expected, float) and expected.is_integer():
        expected = int(expected)
    return f"我看到的是{expected}"


def _wrong_answer(expected: Any) -> str:
    if isinstance(expected, dict):
        return "名称是别的地方，评分是1，地址是错误地址，电话是0000"
    if isinstance(expected, int):
        return f"我看到的是{expected + 1}"
    if isinstance(expected, float):
        return f"我看到的是{expected + 0.5:g}"
    return "我看到的是另一个结果"


def _search_place_address_expected(place: str) -> str:
    return Map.extract_address(Map.resolve_places(place)[0])


def _place_detail_full_expected(place: str) -> dict[str, Any]:
    resolved = Map.resolve_places(place)[0]
    return {
        "rating": Map.extract_rating(resolved),
        "address": Map.extract_address(resolved),
        "phone": Map.extract_phone(resolved),
    }


def _positive_answer_case(
    task: BaseTask,
    curr_state: dict[str, Any],
    *,
    route: dict[str, Any] | None = None,
) -> tuple[BaseTask, JudgeInput]:
    curr = copy.deepcopy(curr_state)
    inp = _make_task_input(copy.deepcopy(BASE_STATE), curr, route=route)
    expected = task.get_answer(inp)  # type: ignore[attr-defined]
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, route=route, answer=_natural_answer(expected))


def _negative_answer_case(
    task: BaseTask,
    curr_state: dict[str, Any],
    *,
    route: dict[str, Any] | None = None,
) -> tuple[BaseTask, JudgeInput]:
    curr = copy.deepcopy(curr_state)
    inp = _make_task_input(copy.deepcopy(BASE_STATE), curr, route=route)
    expected = task.get_answer(inp)  # type: ignore[attr-defined]
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, route=route, answer=_wrong_answer(expected))


def _positive_criteria_case(task: CriteriaTask) -> tuple[BaseTask, JudgeInput]:
    curr = copy.deepcopy(BASE_STATE)
    route = DEFAULT_ROUTE
    for path, raw_value in task.criteria.items():
        value = _resolve_criteria_value(raw_value, task.params)
        if path == "route":
            route = {"app": "map", "path": str(value)}
            continue
        _set_by_path(curr, path, value)
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr, route=route)


def _negative_criteria_case(task: CriteriaTask) -> tuple[BaseTask, JudgeInput]:
    return task, _make_task_input(copy.deepcopy(BASE_STATE), copy.deepcopy(BASE_STATE))


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert "map" in task.apps

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
        assert cls.objective in ("operate", "query", "hybrid", "vague", "safety")
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
        has_check_goals_override = cls.check_goals is not AnswerTask.check_goals
        assert has_answer_attr or has_get_answer_override or has_check_goals_override


class TestMapAccessor:
    @pytest.fixture
    def map_app(self) -> Map:
        return Map(
            _state(
                search_results=RESTAURANT_RESULTS,
                active_poi=NATIONAL_MUSEUM,
                route=_route(mode="DRIVING", origin="故宫", destination="中国国家博物馆", distance="1.2公里", steps=ROUTE_STEPS),
                route_modes=_route_modes(),
                autocomplete=AUTOCOMPLETE_RESULTS,
            )
        )

    def test_user_properties(self, map_app: Map):
        assert map_app.user_name == "pure"
        assert map_app.favorite_place_count == 0

    def test_search_and_settings_access(self, map_app: Map):
        assert len(map_app.search_history) == 2
        assert map_app.get_setting("navigation.keepMapNorthUp") is False

    def test_runtime_view_access(self, map_app: Map):
        assert map_app.active_poi["name"] == "中国国家博物馆"
        assert map_app.active_route["mode"] == "DRIVING"
        assert len(map_app.search_results) == 3
        assert "WALKING" in map_app.route_modes["modes"]

    def test_place_queries(self, map_app: Map):
        poi = map_app.active_poi
        assert isinstance(poi, dict)
        assert Map.extract_address(poi) == "北京市东城区东长安街16号"
        assert Map.extract_phone(poi) == "010-65116400"
        assert Map.extract_rating(poi) == 4.8

    def test_normalize_place_prefers_details_national_phone(self):
        place = Map._normalize_place(
            {
                "placeId": "test-place",
                "name": "测试地点",
                "formattedAddress": "北京市海淀区测试路1号",
                "nationalPhoneNumber": "010-11112222",
                "internationalPhoneNumber": "+86 10 1111 2222",
                "details": {
                    "displayName": "测试地点",
                    "formattedAddress": "北京市海淀区测试路1号",
                    "nationalPhoneNumber": "010-33334444",
                    "internationalPhoneNumber": "+86 10 3333 4444",
                },
            }
        )
        assert Map.extract_phone(place) == "010-33334444"

    def test_search_result_helpers(self, map_app: Map):
        pizza_candidates = [
            r for r in map_app.search_results
            if isinstance(r, dict) and "必胜客" in str(r.get("name") or "")
        ]
        assert pizza_candidates and pizza_candidates[0]["name"] == "必胜客(西单店)"
        assert Map.best_rated_from_results(RESTAURANT_RESULTS)["name"] == "海底捞(西单店)"
        assert Map.nearest_from_results(RESTAURANT_RESULTS)["name"] == "汉堡王(西单店)"
        assert Map.rating_rank_from_results(RESTAURANT_RESULTS, "必胜客") == 2

    def test_radius_filter_uses_frontend_display_distance(self):
        results = [
            {"name": "1995m", "distance_meters": 1995},
            {"name": "2010m", "distance_meters": 2010},
            {"name": "2048m", "distance_meters": 2048},
            {"name": "2059m", "distance_meters": 2059},
        ]

        filtered = Map.filter_results(results, max_distance_meters=2000)

        assert [item["name"] for item in filtered] == ["1995m", "2010m", "2048m"]

    def test_alias_resolution_helpers(self):
        forbidden_city_names = [place["name"] for place in Map.resolve_places("故宫")]
        assert forbidden_city_names[:2] == ["故宫博物院", "故宫"]
        assert "故宫角楼" not in forbidden_city_names

        library_names = [place["name"] for place in Map.resolve_places("国家图书馆")]
        assert "中国国家图书馆" in library_names
        assert "国家图书馆" in library_names
        assert library_names.count("国家图书馆") >= 2
        assert "国家图书馆古籍馆" not in library_names

        assert Map.geo_resolve("圆明园")[3] == "圆明园遗址公园"

    def test_route_helpers(self, map_app: Map):
        assert map_app.route_distance_meters("中国国家博物馆") == 1200

    def test_check_helpers(self, map_app: Map):
        assert map_app.check_route(
            mode="DRIVING",
            origin_hint="故宫",
            destination_hint="中国国家博物馆",
        )["passed"]
        assert Map.check_place_rating_answer(
            "评分是4.8分。",
            4.8,
        )["passed"]
        assert Map.check_place_address_answer(
            "地址是北京市东城区东长安街16号。",
            "北京市东城区东长安街16号",
        )["passed"]

    def test_accessor_raise_on_missing_data(self, map_app: Map):
        with pytest.raises(ValueError):
            Map.extract_address({})
        with pytest.raises(ValueError):
            Map.extract_rating({})
        assert Map.extract_phone({}) is None

    def test_geo_search_filters_registered_subbrand_pois_by_default(self):
        expected_filtered_keywords = {
            "肯德基": ("甜品站", "宅急送", "Select"),
            "麦当劳": ("甜品站",),
            "必胜客": ("宅急送",),
        }
        for query, keywords in expected_filtered_keywords.items():
            raw_names = [str(place["name"]) for place in Map.geo_search(query, limit=0, excludes=None)]
            filtered_names = [str(place["name"]) for place in Map.geo_search(query, limit=0)]
            assert any(any(keyword in name for keyword in keywords) for name in raw_names), query
            assert all(not any(keyword in name for keyword in keywords) for name in filtered_names), query
            assert len(filtered_names) < len(raw_names), query


def _check_drive_route_positive_case():
    task = _tasks_module.CheckDriveRoute()
    curr = _state(route=_route(mode="DRIVING", destination="故宫", distance="2.6公里"))
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _check_drive_route_negative_case():
    task = _tasks_module.CheckDriveRoute()
    curr = _state(route=_route(mode="WALKING", destination="故宫", distance="2.6公里"))
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr)


def _query_driving_distance_alias_positive_case():
    task = _tasks_module.QueryDrivingDistance(place="国家图书馆")
    place = next(
        place for place in Map.resolve_places("国家图书馆")
        if place["name"] == "国家图书馆"
    )
    route = Map.geo_route_from_current(str(place["place_id"]), "DRIVING")
    return task, _make_task_input(
        copy.deepcopy(BASE_STATE),
        copy.deepcopy(BASE_STATE),
        answer=f"我看到的是{route['distance']}",
    )


def _query_driving_distance_same_name_duplicate_positive_case():
    task = _tasks_module.QueryDrivingDistance(place="国家图书馆")
    places = [
        place for place in Map.resolve_places("国家图书馆")
        if place["name"] == "国家图书馆"
    ]
    place = places[-1]
    route = Map.geo_route_from_current(str(place["place_id"]), "DRIVING")
    return task, _make_task_input(
        copy.deepcopy(BASE_STATE),
        copy.deepcopy(BASE_STATE),
        answer=f"我看到的是{route['distance']}",
    )
def _best_rated_route_case_state(
    task: BaseTask,
    *,
    mode: str,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    results = Map.geo_search(task.p.category, limit=0)
    best = Map.best_rated_from_results(results, max_distance_meters=float(task.p.radius))
    route = Map.geo_route_from_current(str(best["place_id"]), mode)
    curr_state = _with_new_search(
        _state(
            route=_route(
                mode=mode,
                destination=str(best["name"]),
                distance=str(route["distance"]),
            )
        ),
        str(task.p.category),
    )
    return best, route, curr_state


def _filtered_subbrand_with_route(
    query: str,
    *,
    mode: str,
    max_distance_meters: float | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    filtered_ids = {
        str(place.get("place_id"))
        for place in Map.geo_search(query, limit=0)
        if place.get("place_id") is not None
    }
    for place in Map.geo_search(query, limit=0, excludes=None):
        place_id = place.get("place_id")
        if place_id is None or str(place_id) in filtered_ids:
            continue
        if max_distance_meters is not None and float(place.get("distance_meters") or 0) > max_distance_meters:
            continue
        try:
            route = Map.geo_route_from_current(str(place_id), mode)
        except ValueError:
            continue
        return place, route
    raise AssertionError(f"no filtered sub-brand result with {mode} route for {query!r}")


def _find_best_rated_and_route_mcdonalds_positive_case():
    task = _tasks_module.FindBestRatedAndRoute(category="麦当劳", radius=3000)
    best, route, curr_state = _best_rated_route_case_state(task, mode="DRIVING")
    answer = f"我看评分最高且最近的是{best['name']}，开车大概{route['distance']}"
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr_state, answer=answer)


def _find_best_rated_and_route_filtered_subbrand_negative_case():
    task = _tasks_module.FindBestRatedAndRoute(category="麦当劳", radius=3000)
    _, _, curr_state = _best_rated_route_case_state(task, mode="DRIVING")
    removed_place, removed_route = _filtered_subbrand_with_route(
        task.p.category,
        mode="DRIVING",
        max_distance_meters=float(task.p.radius),
    )
    answer = f"我看评分最高且最近的是{removed_place['name']}，开车大概{removed_route['distance']}"
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr_state, answer=answer)


def _best_rated_with_walk_route_kfc_positive_case():
    task = _tasks_module.BestRatedWithWalkRoute(category="肯德基", radius=3000)
    best, route, curr_state = _best_rated_route_case_state(task, mode="WALKING")
    answer = f"我看到的是{best['name']}，走过去大概{route['distance']}"
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr_state, answer=answer)


def _best_rated_with_walk_route_filtered_subbrand_negative_case():
    task = _tasks_module.BestRatedWithWalkRoute(category="肯德基", radius=3000)
    _, _, curr_state = _best_rated_route_case_state(task, mode="WALKING")
    removed_place, removed_route = _filtered_subbrand_with_route(
        task.p.category,
        mode="WALKING",
        max_distance_meters=float(task.p.radius),
    )
    answer = f"我看到的是{removed_place['name']}，走过去大概{removed_route['distance']}"
    return task, _make_task_input(copy.deepcopy(BASE_STATE), curr_state, answer=answer)


PRIMARY_POSITIVE_CASES = [
    ("CheckDriveRoute", _check_drive_route_positive_case),
    ("CheckHighestRatedPlace", lambda: _positive_answer_case(_tasks_module.CheckHighestRatedPlace(category="咖啡馆"), _with_new_search(_state(search_results=CAFE_RESULTS), "咖啡馆"))),
    ("CheckNearestPlaceAddress", lambda: _positive_answer_case(_tasks_module.CheckNearestPlaceAddress(category="咖啡馆"), _with_new_search(_state(search_results=CAFE_RESULTS), "咖啡馆"))),
    ("SetMapNorthUp", lambda: _positive_criteria_case(_tasks_module.SetMapNorthUp())),
    ("ModifyMultiSettings", lambda: _positive_criteria_case(_tasks_module.ModifyMultiSettings())),
    ("DarkModeSettings", lambda: _positive_criteria_case(_tasks_module.DarkModeSettings())),
    ("FindNearestWithRating", lambda: _positive_answer_case(_tasks_module.FindNearestWithRating(category="咖啡馆"), _with_new_search(_state(search_results=CAFE_RESULTS), "咖啡馆"))),
]

PRIMARY_NEGATIVE_CASES = [
    ("CheckDriveRoute", _check_drive_route_negative_case),
    ("CheckHighestRatedPlace", lambda: _negative_answer_case(_tasks_module.CheckHighestRatedPlace(category="咖啡馆"), _with_new_search(_state(search_results=CAFE_RESULTS), "咖啡馆"))),
    ("CheckNearestPlaceAddress", lambda: _negative_answer_case(_tasks_module.CheckNearestPlaceAddress(category="咖啡馆"), _with_new_search(_state(search_results=CAFE_RESULTS), "咖啡馆"))),
    ("SetMapNorthUp", lambda: _negative_criteria_case(_tasks_module.SetMapNorthUp())),
    ("ModifyMultiSettings", lambda: _negative_criteria_case(_tasks_module.ModifyMultiSettings())),
    ("DarkModeSettings", lambda: _negative_criteria_case(_tasks_module.DarkModeSettings())),
    ("FindNearestWithRating", lambda: _negative_answer_case(_tasks_module.FindNearestWithRating(category="咖啡馆"), _with_new_search(_state(search_results=CAFE_RESULTS), "咖啡馆"))),
]

EXTRA_POSITIVE_CASES: list[tuple[str, Any]] = [
    ("QueryDrivingDistance_alias_name", _query_driving_distance_alias_positive_case),
    ("QueryDrivingDistance_same_name_duplicate", _query_driving_distance_same_name_duplicate_positive_case),
    ("FindBestRatedAndRoute_mcdonalds_filtered_brand", _find_best_rated_and_route_mcdonalds_positive_case),
    ("BestRatedWithWalkRoute_kfc_filtered_brand", _best_rated_with_walk_route_kfc_positive_case),
]

EXTRA_NEGATIVE_CASES: list[tuple[str, Any]] = [
    ("FindBestRatedAndRoute_filtered_subbrand_answer", _find_best_rated_and_route_filtered_subbrand_negative_case),
    ("BestRatedWithWalkRoute_filtered_subbrand_answer", _best_rated_with_walk_route_filtered_subbrand_negative_case),
]

PRIMARY_TASK_NAMES = {name for name, _ in PRIMARY_POSITIVE_CASES}


class TestTaskJudgeMatrixOffline:
    def test_offline_judge_matrix_complete(self):
        positive = {name for name, _ in PRIMARY_POSITIVE_CASES}
        negative = {name for name, _ in PRIMARY_NEGATIVE_CASES}
        assert positive == negative, "positive/negative case sets must match"
        all_names = {cls.__name__ for cls in ALL_TASK_CLASSES}
        assert positive <= all_names, f"test references unknown tasks: {positive - all_names}"

    @pytest.mark.parametrize(
        "task_name,builder",
        PRIMARY_POSITIVE_CASES + EXTRA_POSITIVE_CASES,
        ids=[name for name, _ in PRIMARY_POSITIVE_CASES + EXTRA_POSITIVE_CASES],
    )
    def test_positive_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert result.success, f"{task_name} positive failed: issues={result.issues}, warnings={result.warnings}"

    @pytest.mark.parametrize(
        "task_name,builder",
        PRIMARY_NEGATIVE_CASES + EXTRA_NEGATIVE_CASES,
        ids=[name for name, _ in PRIMARY_NEGATIVE_CASES + EXTRA_NEGATIVE_CASES],
    )
    def test_negative_case(self, task_name, builder):
        task, inp = builder()
        result = task.evaluate(inp)
        assert not result.success, f"{task_name} negative unexpectedly passed"
