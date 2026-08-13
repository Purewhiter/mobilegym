"""Live scripted-plan verification for the Map suite.

Single-source policy: answers, ``target_place`` and the route-picker triples
are **not** injected here — they come from ``scripted_plans.DERIVED_PARAMS``,
computed at materialization time through the judge-homologous ``Map``
static-data accessors (Map judges compute expectations from
``apps/Map/data/{places,routes}.json``, never from the terminal app state).
That is exactly the official ``--agent scripted`` sampling path, so these
live cases regression-test the derivation itself.

Only *declared* task parameters stay pinned below, for deterministic
coverage. The scroll-coupled plans (``FindBestRatedAndRoute`` /
``BestRatedWithWalkRoute`` / ``FindNearestWithRating`` /
``NearestDetailAndWalkRoute``) pin the default ``category="咖啡馆"`` their
scroll counts were calibrated against — see the 【采样豁免·滚动行位耦合】
notes in ``scripted_plans.py``.
"""

from __future__ import annotations

from typing import Any, Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.map import tasks as map_tasks
from bench_env.task.registry import TaskRegistry
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "map"


def _task(name: str, **params: Any) -> BaseTask:
    return TaskRegistry().create_task(f"{SUITE}.{name}", **params)


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("CheckDriveRoute", lambda: map_tasks.CheckDriveRoute(place="故宫")),
    ("CheckHighestRatedPlace", lambda: map_tasks.CheckHighestRatedPlace(category="咖啡馆", radius=2000)),
    ("CheckNearestPlaceAddress", lambda: map_tasks.CheckNearestPlaceAddress(category="咖啡馆")),
    ("SetMapNorthUp", lambda: map_tasks.SetMapNorthUp()),
    ("QueryDrivingDistance", lambda: map_tasks.QueryDrivingDistance(place="故宫")),
    ("CheckRouteSuccess", lambda: map_tasks.CheckRouteSuccess(origin="故宫", destination="天安门广场")),
    ("FindBestRatedAndRoute", lambda: map_tasks.FindBestRatedAndRoute(category="咖啡馆", radius=2000)),
    (
        "ModifyMultiSettings",
        lambda: map_tasks.ModifyMultiSettings(parking_pref="仅限应用", save_recent_searches=False),
    ),
    ("DarkModeSettings", lambda: map_tasks.DarkModeSettings(theme="始终采用深色主题")),
    ("FindNearestWithRating", lambda: map_tasks.FindNearestWithRating(category="咖啡馆")),
    ("CompareRouteDuration", lambda: map_tasks.CompareRouteDuration(place="故宫")),
    ("FindNearestAndRoute", lambda: map_tasks.FindNearestAndRoute(category="咖啡馆")),
    ("EstimateDrivingCost", lambda: map_tasks.EstimateDrivingCost(place="故宫", rate=0.8)),
    (
        "NearestInRadiusRatingRank",
        lambda: map_tasks.NearestInRadiusRatingRank(category="咖啡馆", radius=2000),
    ),
    ("BestRatedWithWalkRoute", lambda: map_tasks.BestRatedWithWalkRoute(category="咖啡馆", radius=2000)),
    ("NearestDetailAndWalkRoute", lambda: map_tasks.NearestDetailAndWalkRoute(category="咖啡馆")),
    ("NorthResearchInstituteAnswer", lambda: _task("NorthResearchInstituteAnswer")),
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
