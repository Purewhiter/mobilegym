"""Live scripted-plan verification for the Map suite."""

from __future__ import annotations

from typing import Any, Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.map import tasks as map_tasks
from bench_env.task.map.app import Map
from bench_env.task.registry import TaskRegistry
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "map"


def _fmt(value: float) -> str:
    return f"{float(value):.2f}"


def _task(name: str, **params: Any) -> BaseTask:
    return TaskRegistry().create_task(f"{SUITE}.{name}", **params)


def _best_rated(category: str, radius: int) -> dict[str, Any]:
    return Map.best_rated_from_results(Map.geo_search(category, limit=0), max_distance_meters=radius)


def _nearest(category: str) -> dict[str, Any]:
    return Map.nearest_from_results(Map.geo_search(category, limit=0))


def _nearest_rated(category: str) -> dict[str, Any]:
    return Map.nearest_rated_from_results(Map.geo_search(category, limit=0))


def _route_current(place_or_id: str, mode: str = "DRIVING") -> dict[str, Any]:
    if place_or_id.startswith("places/"):
        return Map.geo_route_from_current(place_or_id, mode)
    return Map.resolve_routes_from_current(place_or_id, mode)[0][1]


def _route_pair_steps(origin: str, destination: str) -> str:
    _origin, _destination, route = Map.resolve_route_pairs(origin, destination, "DRIVING")[0]
    return "；".join(Map.route_step_texts_from_api_route(route)[:3])


def _compare_duration_answer(place: str) -> dict[str, str]:
    walking = _route_current(place, "WALKING")
    driving = _route_current(place, "DRIVING")
    walk_seconds = float(walking["duration_seconds"])
    drive_seconds = float(driving["duration_seconds"])
    if walk_seconds < drive_seconds:
        fastest = "步行更快"
    elif drive_seconds < walk_seconds:
        fastest = "开车更快"
    else:
        fastest = "一样快"
    return {
        "answer_fastest": fastest,
        "answer_walk_duration": str(walking["duration"]),
        "answer_drive_duration": str(driving["duration"]),
    }


def _find_best_route_params(category: str = "咖啡馆", radius: int = 2000) -> dict[str, Any]:
    best = _best_rated(category, radius)
    route = Map.geo_route_from_current(str(best["place_id"]), "DRIVING")
    return {
        "category": category,
        "radius": radius,
        "target_place": str(best["name"]),
        "answer_name": str(best["name"]),
        "answer_distance": str(route["distance"]),
    }


def _best_walk_params(category: str = "咖啡馆", radius: int = 2000) -> dict[str, Any]:
    best = _best_rated(category, radius)
    route = Map.geo_route_from_current(str(best["place_id"]), "WALKING")
    return {
        "category": category,
        "radius": radius,
        "target_place": str(best["name"]),
        "answer_name": str(best["name"]),
        "answer_distance": str(route["distance"]),
    }


def _nearest_detail_walk_params(category: str = "咖啡馆") -> dict[str, Any]:
    nearest = _nearest_rated(category)
    route = Map.geo_route_from_current(str(nearest["place_id"]), "WALKING")
    return {
        "category": category,
        "target_place": str(nearest["name"]),
        "answer_name": str(nearest["name"]),
        "answer_rating": str(Map.extract_rating(nearest)),
        "answer_duration": str(route["duration"]),
    }


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("CheckDriveRoute", lambda: map_tasks.CheckDriveRoute(place="故宫")),
    (
        "CheckHighestRatedPlace",
        lambda: map_tasks.CheckHighestRatedPlace(
            category="咖啡馆",
            radius=2000,
            answer=str(_best_rated("咖啡馆", 2000)["name"]),
        ),
    ),
    (
        "CheckNearestPlaceAddress",
        lambda: map_tasks.CheckNearestPlaceAddress(
            category="咖啡馆",
            answer=Map.extract_address(_nearest("咖啡馆")),
        ),
    ),
    ("SetMapNorthUp", lambda: map_tasks.SetMapNorthUp()),
    (
        "QueryDrivingDistance",
        lambda: map_tasks.QueryDrivingDistance(place="故宫", answer=str(_route_current("故宫")["distance"])),
    ),
    (
        "CheckRouteSuccess",
        lambda: map_tasks.CheckRouteSuccess(
            origin="故宫",
            destination="天安门广场",
            answer=_route_pair_steps("故宫", "天安门广场"),
        ),
    ),
    ("FindBestRatedAndRoute", lambda: map_tasks.FindBestRatedAndRoute(**_find_best_route_params())),
    (
        "ModifyMultiSettings",
        lambda: map_tasks.ModifyMultiSettings(parking_pref="仅限应用", save_recent_searches=False),
    ),
    (
        "DarkModeSettings",
        lambda: map_tasks.DarkModeSettings(theme="始终采用深色主题", theme_label="始终采用深色主题"),
    ),
    (
        "FindNearestWithRating",
        lambda: map_tasks.FindNearestWithRating(
            category="咖啡馆",
            answer_name=str(_nearest_rated("咖啡馆")["name"]),
            answer_rating=str(Map.extract_rating(_nearest_rated("咖啡馆"))),
        ),
    ),
    (
        "CompareRouteDuration",
        lambda: map_tasks.CompareRouteDuration(place="故宫", **_compare_duration_answer("故宫")),
    ),
    (
        "FindNearestAndRoute",
        lambda: map_tasks.FindNearestAndRoute(
            category="咖啡馆",
            target_place=str(_nearest("咖啡馆")["name"]),
        ),
    ),
    (
        "EstimateDrivingCost",
        lambda: map_tasks.EstimateDrivingCost(
            place="故宫",
            rate=0.8,
            answer=_fmt((float(_route_current("故宫")["distance_meters"]) / 1000.0) * 0.8),
        ),
    ),
    (
        "NearestInRadiusRatingRank",
        lambda: map_tasks.NearestInRadiusRatingRank(
            category="咖啡馆",
            radius=2000,
            answer=str(
                Map.rating_rank_from_results(
                    Map.filter_results(Map.geo_search("咖啡馆", limit=0), max_distance_meters=2000),
                    str(_nearest_rated("咖啡馆")["name"]),
                    min_results=2,
                    place_id=str(_nearest_rated("咖啡馆")["place_id"]),
                )
            ),
        ),
    ),
    ("BestRatedWithWalkRoute", lambda: map_tasks.BestRatedWithWalkRoute(**_best_walk_params())),
    (
        "NearestDetailAndWalkRoute",
        lambda: map_tasks.NearestDetailAndWalkRoute(**_nearest_detail_walk_params()),
    ),
    (
        "NorthResearchInstituteAnswer",
        lambda: _task("NorthResearchInstituteAnswer", answer="中国科学院物理研究所"),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(map_tasks)
    missing = declared - covered
    assert not missing, f"map tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_map_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
