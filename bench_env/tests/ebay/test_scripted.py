"""Live scripted-plan verification for the eBay suite."""

from __future__ import annotations

from typing import Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.ebay import tasks as ebay_tasks
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "ebay"

SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("SwitchTheme", lambda: ebay_tasks.SwitchTheme(theme="dark")),
    ("SortSearchResults", lambda: ebay_tasks.SortSearchResults(query="电风扇", sort="priceLow")),
    ("SearchFirstResult", lambda: ebay_tasks.SearchFirstResult(query="电风扇", metric="title")),
    (
        "CountSonyHeadphonesEurope",
        lambda: ebay_tasks.CountSonyHeadphonesEurope(
            query="耳机", brand="Sony", location="欧洲", condition="全新"
        ),
    ),
    (
        "CountNikeSneakersInRange",
        lambda: ebay_tasks.CountNikeSneakersInRange(
            query="运动鞋",
            brand="Nike",
            location="欧洲",
            condition="全新",
            price_min="510",
            price_max="540",
        ),
    ),
    (
        "FindCheapestProduct",
        lambda: ebay_tasks.FindCheapestProduct(
            query="吸尘器", brand="Dyson", location="亚洲", condition="全新"
        ),
    ),
    (
        "CompareTwoProductPrices",
        lambda: ebay_tasks.CompareTwoProductPrices(
            item1="电脑",
            item2="电视",
            sort_id="priceLow",
            extreme="最便宜",
            comparison="更便宜",
        ),
    ),
    (
        "CompareTwoGroupCounts",
        lambda: ebay_tasks.CompareTwoGroupCounts(
            query1="耳机",
            brand1="Sony",
            location1="欧洲",
            condition1="全新",
            price_min1="620",
            price_max1="690",
            query2="运动鞋",
            brand2="Nike",
            location2="欧洲",
            condition2="全新",
            price_min2="510",
            price_max2="540",
        ),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(ebay_tasks)
    missing = declared - covered
    assert not missing, f"eBay tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_ebay_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE)
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
