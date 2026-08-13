"""Live scripted-plan verification for the cross-app life suite.

Single-source policy: answers, wxids, train/alarm parameters and message
texts are **not** injected here — they come from
``scripted_plans.DERIVED_PARAMS``, computed at materialization time from the
episode's post-setup initial state through the judge-homologous domain
classes (Weather / Railway12306 / Map / Calendar / Wechat / Alipay) and the
shared static catalogs. That is exactly the official ``--agent scripted``
sampling path, so these live cases regression-test the derivation itself
(the previous ``_railway_dest_weather_params`` RNG replica, the disk-based
weather-library rebuild and the ``_with_dynamic_params`` post-sample hook
are all gone).

Only *declared* task parameters stay pinned below, for deterministic
coverage (fixed cities/routes keep selector geometry stable; ``date`` is
pinned near tomorrow so the 12306 date picker stays on the visible grid).
Conditional tasks are ``Branch`` plans — the branch actually taken follows
the same initial-state condition the judge checks; extra ``*Branch`` cases
pin parameters that steer specific arms (e.g. 成都 is rainy tomorrow in the
static weather library, 肯德基's best store is ≥2km away by car).
"""

from __future__ import annotations

import datetime as dt
from typing import Any, Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.registry import TaskRegistry
from bench_env.tests.crossapp_life.scripted_plans import PLANS
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "crossapp_life"
# 不再放宽步数：全部 plan 均须在任务自身预算（难度默认 / task.max_steps）内
# 完成，与官方 --agent scripted 采样路径的预算完全一致（重分支任务的预算已
# 由任务声明 max_steps=80 承担，见 tasks.py / defs/）。
SCRIPTED_MAX_STEPS: dict[str, int] = {}


def _task(name: str, **params: Any) -> BaseTask:
    return TaskRegistry().create_task(f"{SUITE}.{name}", **params)


def _date_after(days: int) -> str:
    """Sim time equals wall-clock in live runs (no scenario overrides)."""
    return (dt.date.today() + dt.timedelta(days=days)).isoformat()


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    ("CalendarEventToWechat", lambda: _task("CalendarEventToWechat", contact="张伟")),
    ("CalendarFreeWeatherInvite", lambda: _task("CalendarFreeWeatherInvite", city="北京", contact="张伟")),
    ("FullTripPlanWeatherDriven", lambda: _task("FullTripPlanWeatherDriven", city="上海", from_station="北京")),
    ("MapNearbyBestToWechat", lambda: _task("MapNearbyBestToWechat", radius=3000, category="咖啡馆", contact="张伟")),
    ("MapPlaceToWechat", lambda: _task("MapPlaceToWechat", place="中国国家博物馆", contact="张伟")),
    ("MapRatingConditionBuyTicket", lambda: _task("MapRatingConditionBuyTicket", place="中国国家博物馆", from_station="上海")),
    ("OpenedFridgeFoodsToMom", lambda: _task("OpenedFridgeFoodsToMom")),
    (
        "RailwayBalanceConditionalBuyNotify",
        lambda: _task(
            "RailwayBalanceConditionalBuyNotify",
            city="上海",
            from_station="北京",
            date=_date_after(2),
            contact="张伟",
        ),
    ),
    ("RailwayDestWeatherQuery", lambda: _task("RailwayDestWeatherQuery", city="上海")),
    (
        "RailwayEarliestGTrainToWechat",
        lambda: _task(
            "RailwayEarliestGTrainToWechat",
            from_city="上海",
            to_city="南京",
            date=_date_after(1),
            contact="张伟",
        ),
    ),
    ("RailwayMyAccountToWechat", lambda: _task("RailwayMyAccountToWechat", contact="张伟")),
    (
        "RailwayPriceVsBalance",
        lambda: _task("RailwayPriceVsBalance", from_station="上海", to_station="南京", date=_date_after(1)),
    ),
    (
        "RailwayTomorrowMomBookingToWechat",
        lambda: _task("RailwayTomorrowMomBookingToWechat", from_city="上海", to_city="南京"),
    ),
    (
        "RailwayTrainInfoToWechat",
        lambda: _task(
            "RailwayTrainInfoToWechat",
            from_station="上海",
            to_station="南京",
            date=_date_after(1),
            contact="张伟",
        ),
    ),
    (
        "RailwayWeatherToWechat",
        lambda: _task(
            "RailwayWeatherToWechat",
            city="上海",
            from_station="北京",
            date=_date_after(2),
            contact="张伟",
        ),
    ),
    ("RealisticTrip001", lambda: _task("RealisticTrip001", contact="张伟")),
    ("RecommendMenuDishesToXiaozhou", lambda: _task("RecommendMenuDishesToXiaozhou")),
    (
        "RestaurantRatingInviteCalendar",
        lambda: _task("RestaurantRatingInviteCalendar", restaurant="湘临天下酒楼", rating=4.0, contact="张伟"),
    ),
    # 评分 4.0 不超过 4.0 阈值 → skip_low_rating 分支（默认采样参数即此组合）。
    (
        "RestaurantRatingInviteCalendar__skipBranch",
        lambda: _task("RestaurantRatingInviteCalendar", restaurant="沸腾鱼乡西直门分店", rating=4.0, contact="张伟"),
    ),
    (
        "TopRatedNearbyPlaceConditionalWechatOrSmsInvite",
        lambda: _task(
            "TopRatedNearbyPlaceConditionalWechatOrSmsInvite",
            radius=3000,
            category="湘临天下酒楼",
            target="张伟",
            notify_to="王芳",
            sms_contact="张三",
        ),
    ),
    # 肯德基最高分店驾车 ≥2km → sms_address 分支。
    (
        "TopRatedNearbyPlaceConditionalWechatOrSmsInvite__smsBranch",
        lambda: _task(
            "TopRatedNearbyPlaceConditionalWechatOrSmsInvite",
            radius=3000,
            category="肯德基",
            target="张伟",
            notify_to="王芳",
            sms_contact="张三",
        ),
    ),
    ("TravelPlanToWechat", lambda: _task("TravelPlanToWechat", dest="中国国家博物馆", contact="张伟")),
    (
        "TripClosedLoopNotify",
        lambda: _task(
            "TripClosedLoopNotify",
            from_station="上海",
            to_station="南京",
            date=_date_after(1),
            contact="张伟",
        ),
    ),
    (
        "TripMemoAndNotify",
        lambda: _task(
            "TripMemoAndNotify",
            city="上海",
            from_station="北京",
            date=_date_after(2),
            contact="张伟",
        ),
    ),
    (
        "WeatherCalendar_CreateEventIfNotSunny",
        lambda: _task("WeatherCalendar_CreateEventIfNotSunny", city="成都", event_title="带伞"),
    ),
    ("WeatherFilterNonRainyDays", lambda: _task("WeatherFilterNonRainyDays", city="北京")),
    (
        "WeatherFirstNonRainyDayBuyTicket",
        lambda: _task("WeatherFirstNonRainyDayBuyTicket", city="上海", from_station="北京"),
    ),
    (
        "WeatherFirstNonRainyToCalendarAndSms",
        lambda: _task("WeatherFirstNonRainyToCalendarAndSms", city="北京", contact="张三"),
    ),
    ("WeatherFirstSunnyDayCalendarAlarm", lambda: _task("WeatherFirstSunnyDayCalendarAlarm", city="北京")),
    ("WeatherRainBranchNotify", lambda: _task("WeatherRainBranchNotify", city="北京", contact="张伟")),
    # 静态天气库里成都明天（库第 2 天）恒为雨 → rain_umbrella 分支。
    (
        "WeatherRainBranchNotify__rainBranch",
        lambda: _task("WeatherRainBranchNotify", city="成都", contact="张伟"),
    ),
    ("WeatherReportToNotes", lambda: _task("WeatherReportToNotes", city="北京")),
    (
        "WeatherShareMetric",
        lambda: _task("WeatherShareMetric", city="北京", metric="temp_feels", contact="张伟"),
    ),
    (
        "WechatFoodExtractMapSms",
        lambda: _task("WechatFoodExtractMapSms", contact="李娜", brand="麦当劳", sms_contact="张三"),
    ),
    ("WeekendShanghaiTripIfClearAndFree", lambda: _task("WeekendShanghaiTripIfClearAndFree", contact="张伟")),
    (
        "WeekendTripFullPlan",
        lambda: _task("WeekendTripFullPlan", city="北京", destination="颐和园", contact="张伟"),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name.split("__", 1)[0] for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(__import__("bench_env.task.crossapp_life.tasks", fromlist=["*"]))
    missing = declared - covered
    planned = {key.split(".", 1)[1] for key in PLANS if key.startswith(f"{SUITE}.")}
    unplanned = declared - planned
    assert not missing, f"crossapp_life tasks without a scripted case: {sorted(missing)}"
    assert not unplanned, f"crossapp_life tasks without a scripted plan: {sorted(unplanned)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_crossapp_life_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    base_name = name.split("__", 1)[0]
    res = await run_scripted(env, make_task(), suite=SUITE, max_steps=SCRIPTED_MAX_STEPS.get(base_name))
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
