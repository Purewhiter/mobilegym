"""Scripted validation plans for Weather tasks.

Layout facts the navigation steps below rely on (viewport 360x800 css px,
norm_0_1000 coordinates):

- The episode starts on the Weather home page showing the *located* city;
  querying any task city first requires switching via the city manager.
- City manager cards are ``<button aria-label="北京市">`` (stored name keeps
  the 市 suffix) while task params carry the short name, hence prefix match.
  The list viewport shows ~5 cards; one clamped swipe (max scroll ≈ 215px)
  brings every saved city onto one screen.
- Home page vertical order: hero temp + AQI pill → 3-day card (with the
  15-day forecast button) → hourly chart → precipitation card → DetailsGrid
  (humidity / feels-like / wind / sunrise) → life-index cards. One full-screen
  swipe (~700px with inertia) reaches the DetailsGrid, two reach the life
  indices.
- Every city page renders its own ``forecast.daily.open`` button; the env
  skips selector matches outside the viewport, so the untagged trigger tap
  hits the current city's button.

Self-verification asserts (R2): every query plan proves its answer was read
from the screen before opening the AnswerSheet. Values that render verbatim
(hero temp, humidity, AQI, forecast dates/temps) use ``assert_answer`` — it
scans every rendered text inside the foreground Activity, so entries inside
horizontal scrollers (15-day columns, hourly chart) match regardless of the
current scroll offset. Weather-condition texts are the exception: the app
canonicalizes them into bucket labels (getLocalizedWeatherText — 雷阵雨→暴雨,
阵雨→小雨), so condition asserts go through ``_screen_weather_label`` while
the typed answer keeps the raw judge-aligned textDay. Comparison verdicts
(hotter/more-humid/least-rainy city, "一样…" ties) are never rendered
verbatim, so those plans assert *evidence* instead via ``assert_text``
(each compared city page / card on screen, which is viewport-strict).

Sampling compatibility (``DERIVED_PARAMS``): every non-declared plan
placeholder (``answer*``, ``unit_action``, ``city_id``, ``cur_temp``) is
computed at materialization time from the episode's post-setup initial state
via the *judge-homologous* domain class — calculators build
``Weather(init_state["apps"]["weather"])`` exactly like judges build
``Weather(input.apps_init["weather"])``, and both read the same runner
observation, so derived values cannot drift from the judge. The
``weatherLibrary`` dates are shifted to sim-today once at store creation and
stay static within an episode (apps/Weather/state.ts + weatherStore.ts), so
mid-episode renders/asserts see the same data. Explicit test injections would
still win over these calculators; ``test_scripted.py`` deliberately injects
declared parameters only, exercising this derivation path end to end.

``weather.ConditionalAction`` is the restricted-``Branch`` showcase: the
Weather switch rows carry no ``data-action`` tagging (plain onClick *flip*
in WeatherSettingsPage.tsx — there is no ``to:true/false`` action variant),
so branches encode "flip the switch" vs "leave it"; the pure ``pick`` reads
the {city} temperature and the current ``settings.warningAlert`` from the
initial state to select among turn_on / turn_off / keep_on / keep_off.

``weather.CheckDetailCard`` is the second ``Branch`` (picked from a declared
param, no state): the wind card renders direction and scale as two separate
spans (DetailsGrid.tsx), so the judge's concatenated "北风1级" answer never
appears in one on-screen text run — the wind arm asserts both source
readings separately while every other metric keeps the verbatim
``assert_answer``.
"""

from __future__ import annotations

import datetime as dt
import math
from typing import Any, Callable

from bench_env.agent.scripted import (
    Branch,
    Step,
    assert_answer,
    assert_text,
    assert_visible,
    back,
    complete,
    grounded_answer,
    open_answer_sheet,
    submit_answer_sheet,
    swipe,
    tap_action,
    tap_trigger,
    type_text,
    wait,
)
from bench_env.task.utils import now_ms
from bench_env.task.weather.app import Weather


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def trigger_param(trigger_id: str, key: str, value: str) -> str:
    return f'[data-trigger="{trigger_id}"][data-trigger-params*=\'"{key}":"{value}"\']:visible'


def setting_row(label: str) -> str:
    return f'xpath=//div[contains(@class,"min-h-[52px]") and .//div[normalize-space()="{label}"]]'


def answer_sheet_input(index: int) -> str:
    return f'[data-scroll-container="sheet-form"] div.space-y-5 > div:nth-child({index + 1}) input'


def grounded_choice_answer(choice: str, *values: str, summary: str | None = None) -> list[Step]:
    steps = open_answer_sheet()
    steps.append(click_selector(f'button:has-text("{choice}"):visible', summary=f"choose answer {choice}"))
    for offset, value in enumerate(values, start=1):
        steps.append(
            type_text(
                value,
                selector=answer_sheet_input(offset),
                clear=True,
                summary=f"fill answer field {offset}: {value!r}",
            )
        )
    if values:
        steps.append({"op": "back", "summary": "dismiss keyboard to show submit bar"})
    steps.append(submit_answer_sheet(summary=summary))
    return steps


def open_settings() -> list[Step]:
    return [
        tap_trigger("menu.open", summary="open Weather overflow menu"),
        tap_trigger("settings.open", summary="open Weather settings"),
        wait(0.3, summary="wait for settings page"),
    ]


def set_temp_unit() -> list[Step]:
    return [
        *open_settings(),
        tap_trigger("settings.picker.temp.open", summary="open temperature unit picker"),
        tap_action("{unit_action}", summary="choose target temperature unit"),
        wait(0.3, summary="wait for unit picker to close"),
    ]


def set_wind_unit() -> list[Step]:
    return [
        *open_settings(),
        tap_trigger("settings.picker.wind.open", summary="open wind unit picker"),
        tap_action("{unit_action}", summary="choose target wind unit"),
        wait(0.3, summary="wait for unit picker to close"),
    ]


def toggle_setting(label: str) -> list[Step]:
    return [
        *open_settings(),
        click_selector(setting_row(label), summary=f"toggle setting {label}"),
        wait(0.2, summary="wait for setting toggle"),
    ]


def add_city() -> list[Step]:
    return [
        tap_trigger("cities.open", summary="open city manager"),
        tap_trigger("city.search.open", summary="open city search"),
        type_text("{city}", selector="#act_find_city_key", clear=True, summary="search city"),
        wait(0.5, summary="wait for city search results"),
        click_selector(
            trigger_param("city.preview.open", "cityId", "{city_id}"),
            summary="open city preview",
        ),
        wait(1.2, summary="wait for city preview weather"),
        click_selector('button[data-trigger="home.open"]:not([disabled]):visible', summary="add city"),
        wait(0.6, summary="wait after adding city"),
    ]


# ---------------------------------------------------------------------------
# Information-gathering navigation helpers
# ---------------------------------------------------------------------------

def open_city_manager() -> list[Step]:
    return [
        tap_trigger("cities.open", summary="open city manager"),
        wait(0.4, summary="wait for city manager page"),
    ]


def scroll_city_manager_list() -> Step:
    """Clamped swipe on the manager list so every saved-city card is on screen
    (成都/上海 start below the fold; max scroll of the list is ~215px)."""
    return swipe([500, 850], [500, 400], summary="scroll city list to show all cities")


def select_city(city_placeholder: str) -> list[Step]:
    """Switch the Weather home page to a saved city via the city manager.

    Tapping a card selects the city and returns to the home page, which then
    loads that city's weather bundle (library-cached, fast).
    """
    return [
        *open_city_manager(),
        scroll_city_manager_list(),
        click_selector(
            f'button[aria-label^="{city_placeholder}"]',
            summary=f"select city {city_placeholder} in manager",
        ),
        wait(0.8, summary=f"wait for {city_placeholder} weather to load"),
    ]


def scroll_home_down(times: int, target: str) -> list[Step]:
    """Full-screen vertical swipes on the home page (~700px each with inertia):
    one reaches the DetailsGrid, two reach the life-index cards."""
    return [
        swipe([500, 750], [500, 250], summary=f"scroll home to {target} {i + 1}/{times}")
        for i in range(times)
    ]


def open_daily_forecast(*, city_id: str | None = None) -> list[Step]:
    """Tap 查看15日天气预报 on the current city page.

    The add-city tasks pin cityId (they have a {city_id} param) to guard the
    brief pager-sync window right after the city is added.
    """
    selector = (
        trigger_param("forecast.daily.open", "cityId", city_id)
        if city_id
        else '[data-trigger="forecast.daily.open"]'
    )
    return [
        click_selector(selector, summary="open 15-day forecast"),
        wait(0.6, summary="wait for 15-day forecast page"),
    ]


def swipe_forecast_days(*, span: str, gentle: bool = False) -> Step:
    """Horizontal swipe across the 15-day forecast columns (72px each):
    a strong swipe advances ~5-6 columns, a gentle one ~3."""
    start, end = (0.7, 0.3) if gentle else (0.85, 0.15)
    return {
        "op": "swipe",
        "selector": '[data-scroll-container="forecast"]',
        "start_fraction": start,
        "end_fraction": end,
        "summary": f"browse forecast days ({span})",
    }


def check_city_forecast(city_placeholder: str, *, span: str, gentle: bool = False) -> list[Step]:
    """Switch to a city, open its 15-day forecast, browse, and return home.

    The forecast page header carries no city name, so the per-city evidence
    assert (right city actually visited) lands on the home page hero before
    the forecast is opened.
    """
    return [
        *select_city(city_placeholder),
        assert_text(city_placeholder, summary=f"assert {city_placeholder} page on screen"),
        *open_daily_forecast(),
        swipe_forecast_days(span=span, gentle=gentle),
        back(summary=f"back to home from {city_placeholder} forecast"),
        wait(0.3, summary="wait for home page"),
    ]


def scroll_home_to_hourly_chart() -> Step:
    """Partial vertical scroll (~430px) that parks the hourly chart mid-screen."""
    return swipe([500, 750], [500, 450], summary="scroll home to hourly chart")


def swipe_hourly_chart(step: int, total: int) -> Step:
    """Small horizontal swipe (<half page width) on the hourly chart: the chart
    scrolls ~4 hour slots while the city pager snaps back to the current city."""
    return swipe([700, 430], [300, 430], summary=f"browse hourly temps {step}/{total}")


# ---------------------------------------------------------------------------
# Derived params — sampling-path compatibility
# ---------------------------------------------------------------------------
# Each calculator mirrors its task's judge (get_answer / get_expected_response
# / check_goals in bench_env/task/weather/tasks.py) through the same Weather
# domain class over the same initial state, so the typed/asserted values are
# judge-homologous by construction.

def _weather(state: dict[str, Any]) -> Weather:
    """Judge-homologous accessor: ``Weather(init_state["apps"]["weather"])``."""
    return Weather(state["apps"]["weather"])


def _num(value: Any) -> str:
    """Numeric string as a human would type it (whole floats lose the .0)."""
    value = float(value)
    return str(int(value)) if value.is_integer() else str(value)


def _date_label(fx_date: Any) -> str:
    """Absolute "M月D日" label — matched by the judge's date matcher and by
    ``assert_answer``'s os-state-free ``date_match_labels``."""
    day = dt.date.fromisoformat(str(fx_date)[:10])
    return f"{day.month}月{day.day}日"


def _screen_weather_label(raw: Any) -> str:
    """Mirror getLocalizedWeatherText's zh canonicalization chain
    (apps/Weather/utils/localizedText.ts + res/strings.ts): forecast/hero
    pages render bucket labels, never the raw textDay/textNight — 雷阵雨→暴雨,
    阵雨→小雨, 霾→轻度雾霾, …. Assert-only helper: typed answers must keep the
    raw judge-aligned value (the judge matches raw text, not screen labels)."""
    text = str(raw or "").strip()
    if not text:
        return text
    rules: list[tuple[Callable[[str], bool], str]] = [
        (lambda t: "雷" in t and "雨" in t, "暴雨"),
        (lambda t: "暴雨" in t or "大雨" in t, "大雨"),
        (lambda t: "中雨" in t, "中雨"),
        (lambda t: "阵雨" in t or "小雨" in t or "毛毛雨" in t, "小雨"),
        (lambda t: "暴雪" in t or "大雪" in t, "大雪"),
        (lambda t: "中雪" in t, "中雪"),
        (lambda t: "阵雪" in t or "小雪" in t, "小雪"),
        # TS checks 雾 before the 霾 buckets, so "雾霾" canonicalizes to 雾.
        (lambda t: "雾" in t, "雾"),
        (lambda t: "重度" in t and "霾" in t, "重度雾霾"),
        (lambda t: "中度" in t and "霾" in t, "中度雾霾"),
        (lambda t: "霾" in t, "轻度雾霾"),
        (lambda t: "浮尘" in t or "扬尘" in t, "浮尘"),
        (lambda t: "沙尘" in t, "沙尘"),
        (lambda t: "大风" in t, "大风"),
        (lambda t: "阴" in t, "阴"),
        (lambda t: "多云" in t or "少云" in t, "多云"),
        (lambda t: "晴" in t, "晴"),
    ]
    for test, label in rules:
        if test(text):
            return label
    return text


def _warmest_day(state: dict[str, Any], city: str, days: int) -> dict[str, Any]:
    """First day with the max tempMax — mirrors WarmestDayInWeek (any tied day
    passes its judge) and AddCityAndFindWarmestDay (judge uses the same max)."""
    forecast = _weather(state).daily_range(city, 1, days)
    return max(forecast, key=lambda day: float(day["tempMax"]))


def _coldest_day(state: dict[str, Any], city: str, days: int) -> dict[str, Any]:
    """First day with the min tempMin — mirrors ColdestDayIn14 (ties all pass)."""
    forecast = _weather(state).daily_range(city, 1, days)
    return min(forecast, key=lambda day: float(day["tempMin"]))


def _hotter_city_choice(task: Any, state: dict[str, Any]) -> str:
    """Mirror CompareCityTemp.get_expected_response (tie → "一样热")."""
    winner, _, _ = _weather(state).hotter_city(task.p.city1, task.p.city2)
    return "一样热" if winner == "一样" else winner


def _detail_card_answer(task: Any, state: dict[str, Any]) -> str:
    """Mirror CheckDetailCard.get_answer + get_expected_response per metric."""
    weather = _weather(state)
    city, metric = task.p.city, task.p.metric
    if metric == "humidity":
        return _num(weather.current_humidity(city))
    if metric == "uvIndex":
        return str(weather.today_uv_index(city))
    if metric == "sunrise":
        return str(weather.today_sunrise(city))
    if metric == "feelsLike":
        return _num(weather.current_feels_like(city))
    wind = weather.current_wind_info(city)
    return f"{wind['dir']}{wind['scale']}级"


def _pollutant_answer(task: Any, state: dict[str, Any]) -> str:
    """Mirror CheckAQIPollutant.get_answer: CO uses toFixed(1), others round."""
    value = float(_weather(state).pollutant_value(task.p.city, task.p.pollutant))
    if task.p.pollutant == "co":
        return str(round(value, 1))
    return str(int(value + 0.5))


def _fahrenheit_answer(task: Any, state: dict[str, Any]) -> str:
    """Mirror SwitchUnitAndReport.get_answer: round(C * 9/5 + 32)."""
    return _num(round(_weather(state).current_temp(task.p.city) * 9 / 5 + 32))


def _feels_like_diff_answer(task: Any, state: dict[str, Any]) -> str:
    weather = _weather(state)
    return _num(abs(weather.current_feels_like(task.p.city) - weather.current_temp(task.p.city)))


def _larger_tomorrow_range_choice(task: Any, state: dict[str, Any]) -> str:
    """Mirror CompareTempRange.get_expected_response (tie → "一样大")."""
    weather = _weather(state)
    current_ms = now_ms(state["os"])
    city1 = weather.city_tomorrow_high_low(task.p.city1, current_ms)
    city2 = weather.city_tomorrow_high_low(task.p.city2, current_ms)
    range1 = float(city1["high"]) - float(city1["low"])
    range2 = float(city2["high"]) - float(city2["low"])
    if range1 > range2:
        return task.p.city1
    if range2 > range1:
        return task.p.city2
    return "一样大"


def _more_humid_choice(task: Any, state: dict[str, Any]) -> str:
    """Mirror CompareHumidity.get_expected_response (tie → "一样")."""
    weather = _weather(state)
    h1 = weather.current_humidity(task.p.city1)
    h2 = weather.current_humidity(task.p.city2)
    if h1 > h2:
        return task.p.city1
    if h2 > h1:
        return task.p.city2
    return "一样"


def _night_low_answer(task: Any, state: dict[str, Any]) -> str:
    """Mirror NightLowTemp.get_answer: min hourly temp in the 18:00–03:59 window."""
    night_temps: list[float] = []
    for item in _weather(state).weather_hourly(task.p.city):
        hour = Weather.hour_from_fx_time(item["fxTime"])
        if hour is not None and (hour >= 18 or hour < 4):
            night_temps.append(float(item["temp"]))
    return _num(min(night_temps))


def _least_rainy_choice(task: Any, state: dict[str, Any]) -> str:
    """Mirror ThreeCityRainCheck.get_expected_response (tie → "差不多")."""
    weather = _weather(state)
    counts = {
        city: Weather.count_rainy_days(weather.daily_range(city, 1, 7))
        for city in (task.p.city1, task.p.city2, task.p.city3)
    }
    min_days = min(counts.values())
    winners = [city for city, days in counts.items() if days == min_days]
    return "差不多" if len(winners) >= 2 else winners[0]


def _smallest_weekend_range_choice(task: Any, state: dict[str, Any]) -> str:
    """Mirror WeekendTempRange3City.get_expected_response (tie → "差不多")."""
    weather = _weather(state)
    ranges = {
        city: Weather.temp_range_of_days(weather.weekend_daily(city)[:2])
        for city in (task.p.city1, task.p.city2, task.p.city3)
    }
    best = min(ranges.values())
    winners = [city for city, value in ranges.items() if value == best]
    return "差不多" if len(winners) >= 2 else winners[0]


def _wind_dir(task: Any, state: dict[str, Any]) -> str:
    """Wind-card direction span as rendered (stored windDir, zh locale)."""
    return str(_weather(state).current_wind_info(task.p.city)["dir"])


def _wind_scale_label(task: Any, state: dict[str, Any]) -> str:
    """Wind-card value span as rendered: "N级". formatWind (beaufort default)
    recomputes N via beaufortScaleFromKmh(windSpeed); every library city's
    stored windScale equals that recomputation, so the judge-homologous
    stored value is also the on-screen value."""
    return f"{_weather(state).current_wind_info(task.p.city)['scale']}级"


def _city_id(task: Any, state: dict[str, Any]) -> str:
    """Library city id for the add-city tasks (e.g. 南京 → nanjing) — the same
    Weather.city_id_for_name lookup judges rely on, over the merged
    bundlesByCityId + weatherLibrary view."""
    return _weather(state).city_id_for_name(task.p.city)


def _current_temp_rounded(task: Any, state: dict[str, Any]) -> str:
    """The {city} hero temperature as rendered: Math.round(now.temp) (celsius
    default — convertTemp in apps/Weather/utils/unitConversion.ts)."""
    return str(math.floor(_weather(state).current_temp(task.p.city) + 0.5))


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict[str, Any]], Any]]] = {
    "weather.CheckCurrentTemp": {
        "answer": lambda task, state: _num(_weather(state).current_temp(task.p.city)),
    },
    "weather.CheckCurrentWeather": {
        "answer": lambda task, state: _weather(state).current_weather_text(task.p.city),
    },
    "weather.SwitchTempUnit": {
        "unit_action": lambda task, state: f"settings.tempUnit.select.{task.p.unit}",
    },
    "weather.SwitchWindUnit": {
        "unit_action": lambda task, state: f"settings.windUnit.select.{task.p.unit}",
    },
    "weather.CompareCityTemp": {"answer": _hotter_city_choice},
    "weather.CheckDetailCard": {
        "answer": _detail_card_answer,
        # wind-arm evidence values (computed for every metric — cheap and
        # total — but only rendered by the wind branch).
        "answer_dir": _wind_dir,
        "answer_scale": _wind_scale_label,
    },
    "weather.OpenDailyForecast": {
        "answer": lambda task, state: Weather.day_text(
            _weather(state).daily_by_date(task.p.city, task.p.date)
        ),
        # Assert-only screen form: the 15-day page renders canonicalized
        # bucket labels (雷阵雨→暴雨 …), never the raw textDay the judge wants.
        "answer_screen": lambda task, state: _screen_weather_label(
            Weather.day_text(_weather(state).daily_by_date(task.p.city, task.p.date))
        ),
    },
    "weather.CheckAQIPollutant": {"answer": _pollutant_answer},
    "weather.CheckLifeIndex": {
        "answer": lambda task, state: str(
            _weather(state).life_index_by_name(task.p.city, task.p.index_type)["category"]
        ).strip(),
    },
    "weather.WarmestDayInWeek": {
        "answer_date": lambda task, state: _date_label(_warmest_day(state, task.p.city, 5)["fxDate"]),
        "answer_temp": lambda task, state: _num(_warmest_day(state, task.p.city, 5)["tempMax"]),
        "answer_weather": lambda task, state: Weather.day_text(_warmest_day(state, task.p.city, 5)),
        # Assert-only screen form (e.g. 广州's warmest day: 雷阵雨 renders 暴雨).
        "answer_weather_screen": lambda task, state: _screen_weather_label(
            Weather.day_text(_warmest_day(state, task.p.city, 5))
        ),
    },
    "weather.SwitchUnitAndReport": {
        # criteria pins fahrenheit (not parameterized), so the action id is fixed.
        "unit_action": lambda task, state: "settings.tempUnit.select.fahrenheit",
        "answer": _fahrenheit_answer,
    },
    "weather.FeelsLikeDiff": {"answer": _feels_like_diff_answer},
    "weather.CompareTempRange": {"answer": _larger_tomorrow_range_choice},
    "weather.CompareHumidity": {"answer": _more_humid_choice},
    "weather.ColdestDayIn14": {
        "answer_date": lambda task, state: _date_label(_coldest_day(state, task.p.city, 14)["fxDate"]),
        "answer_temp": lambda task, state: _num(_coldest_day(state, task.p.city, 14)["tempMin"]),
    },
    "weather.NightLowTemp": {"answer": _night_low_answer},
    "weather.AddCityAndFindWarmestDay": {
        "city_id": _city_id,
        "answer_date": lambda task, state: _date_label(_warmest_day(state, task.p.city, 7)["fxDate"]),
    },
    "weather.ThreeCityRainCheck": {"answer": _least_rainy_choice},
    "weather.ConditionalAction": {"cur_temp": _current_temp_rounded},
    "weather.AddCityFullReport": {
        "city_id": _city_id,
        "answer_temp": lambda task, state: _num(_weather(state).current_temp(task.p.city)),
        "answer_humidity": lambda task, state: _num(_weather(state).current_humidity(task.p.city)),
        "answer_aqi": lambda task, state: _num(float(_weather(state).air_quality(task.p.city)["aqi"])),
    },
    "weather.WeekendTempRange3City": {"answer": _smallest_weekend_range_choice},
}


# ---------------------------------------------------------------------------
# weather.ConditionalAction — restricted Branch (two behaviors × two reasons)
# ---------------------------------------------------------------------------

def _conditional_pick(task: Any, state: dict[str, Any]) -> str:
    """Mirror ConditionalAction.check_goals: expected = current_temp > {temp};
    combined with the initial switch value this selects flip vs keep."""
    weather = _weather(state)
    should_enable = weather.current_temp(task.p.city) > task.p.temp
    currently_on = bool(weather.get("settings.warningAlert"))
    if should_enable:
        return "keep_on" if currently_on else "turn_on"
    return "turn_off" if currently_on else "keep_off"


def _conditional_action_branch(*, flip: bool) -> list[Step]:
    """Read {city}'s live temperature (with on-screen evidence asserts), then
    either flip the 天气预警提醒 row (plain onClick toggle — the app tags no
    direction-specific action) or just visit settings and leave it."""
    steps: list[Step] = [
        *select_city("{city}"),
        assert_text("{city}", summary="assert {city} hero on screen"),
        assert_text("{cur_temp}°", summary="assert current temperature {cur_temp}° on hero"),
        *open_settings(),
        assert_text("天气预警提醒", summary="assert warning-alert row on settings page"),
    ]
    if flip:
        steps += [
            click_selector(setting_row("天气预警提醒"), summary="toggle setting 天气预警提醒"),
            wait(0.2, summary="wait for setting toggle"),
        ]
    steps.append(complete())
    return steps


# ---------------------------------------------------------------------------
# weather.CheckDetailCard — restricted Branch (verbatim value vs split wind)
# ---------------------------------------------------------------------------

def _check_detail_card_arm(*asserts: Step) -> list[Step]:
    """Shared navigation + answer steps; arms differ only in evidence asserts."""
    return [
        *select_city("{city}"),
        *scroll_home_down(1, "{city} details grid"),
        *asserts,
        *grounded_answer("{answer}", summary="answer weather detail metric"),
        complete(),
    ]


PLANS: dict[str, list[Step] | Branch] = {
    "weather.CheckCurrentTemp": [
        *select_city("{city}"),
        assert_answer("{answer}", summary="assert current temperature on hero"),
        *grounded_answer("{answer}", summary="answer current temperature"),
        complete(),
    ],
    "weather.CheckCurrentWeather": [
        *select_city("{city}"),
        assert_answer("{answer}", summary="assert current weather text on hero"),
        *grounded_answer("{answer}", summary="answer current weather"),
        complete(),
    ],
    "weather.EnableNightDnd": [
        *toggle_setting("夜间免打扰"),
        complete(),
    ],
    "weather.SwitchTempUnit": [
        *set_temp_unit(),
        complete(),
    ],
    "weather.SwitchWindUnit": [
        *set_wind_unit(),
        complete(),
    ],
    # Visit both cities so their bundles load, then the manager list shows the
    # two current temperatures side by side on one screen.
    "weather.CompareCityTemp": [
        *select_city("{city1}"),
        *select_city("{city2}"),
        *open_city_manager(),
        scroll_city_manager_list(),
        wait(0.4, summary="compare {city1}/{city2} temperatures on one screen"),
        # Evidence asserts: the verdict may be "一样热" (never rendered), so
        # certify both compared city cards are on screen. assert_text cannot
        # work here — every manager-card text layer is pointer-events-none, so
        # its hit-test always lands on the transparent card button instead;
        # assert the aria-labeled button (the layer select_city itself taps).
        assert_visible('button[aria-label^="{city1}"]:visible', summary="assert {city1} card on compare screen"),
        assert_visible('button[aria-label^="{city2}"]:visible', summary="assert {city2} card on compare screen"),
        *grounded_choice_answer("{answer}", summary="answer hotter city"),
        complete(),
    ],
    # Restricted Branch picked from the declared metric param: the wind card
    # renders direction and scale as two separate spans, so the judge's
    # concatenated "北风1级" never appears in one on-screen text run — the
    # wind arm asserts both source readings; other metrics stay verbatim.
    "weather.CheckDetailCard": Branch(
        pick=lambda task, state: "wind" if task.p.metric == "wind" else "value",
        branches={
            "value": _check_detail_card_arm(
                assert_answer("{answer}", summary="assert detail metric value on details grid"),
            ),
            "wind": _check_detail_card_arm(
                assert_text("{answer_dir}", summary="assert wind direction on details grid"),
                assert_text("{answer_scale}", summary="assert wind scale on details grid"),
            ),
        },
    ),
    "weather.OpenDailyForecast": [
        *select_city("{city}"),
        *open_daily_forecast(),
        swipe_forecast_days(span="days 5-10"),
        swipe_forecast_days(span="days 8-14", gentle=True),
        # Screen shows the canonicalized bucket label (identity for every
        # currently sampleable date, but keep the honest screen form).
        assert_answer("{answer_screen}", summary="assert forecast condition (screen label) on 15-day page"),
        *grounded_answer("{answer}", summary="answer daily forecast condition"),
        complete(),
    ],
    "weather.CheckAQIPollutant": [
        *select_city("{city}"),
        tap_trigger("airquality.open", summary="open air quality details"),
        wait(0.5, summary="wait for AQI details page"),
        assert_answer("{answer}", summary="assert pollutant value on AQI page"),
        *grounded_answer("{answer}", summary="answer pollutant value"),
        complete(),
    ],
    "weather.CheckLifeIndex": [
        *select_city("{city}"),
        *scroll_home_down(2, "{city} life index cards"),
        assert_answer("{answer}", summary="assert life index level on screen"),
        *grounded_answer("{answer}", summary="answer life index"),
        complete(),
    ],
    "weather.WarmestDayInWeek": [
        *select_city("{city}"),
        *open_daily_forecast(),
        swipe_forecast_days(span="next 5 days", gentle=True),
        assert_answer("{answer_date}", field_index=0, summary="assert warmest day date on forecast"),
        assert_answer("{answer_temp}", field_index=1, summary="assert warmest day high temp on forecast"),
        # Screen shows the canonicalized bucket label; the typed answer below
        # stays the raw judge-aligned textDay.
        assert_answer("{answer_weather_screen}", field_index=2, summary="assert warmest day condition (screen label) on forecast"),
        *grounded_answer("{answer_date}", "{answer_temp}", "{answer_weather}", summary="answer warmest day"),
        complete(),
    ],
    # settings.open replaces the ?menu=more entry, so one back after switching
    # units lands on the plain home page.
    "weather.SwitchUnitAndReport": [
        *set_temp_unit(),
        back(summary="back to weather home"),
        wait(0.3, summary="wait for home page"),
        *select_city("{city}"),
        assert_answer("{answer}", summary="assert Fahrenheit temperature on hero"),
        *grounded_answer("{answer}", summary="answer Fahrenheit temperature"),
        complete(),
    ],
    "weather.FeelsLikeDiff": [
        *select_city("{city}"),
        wait(0.3, summary="read {city} actual temperature on hero"),
        # Evidence asserts: the answer is the computed |feels-like − actual|
        # difference, never rendered verbatim — certify both source readings
        # instead ({city} hero with the actual temp, then the feels-like card).
        assert_text("{city}", summary="assert {city} hero with actual temp on screen"),
        *scroll_home_down(1, "{city} feels-like card"),
        assert_text("体感", summary="assert feels-like card on screen"),
        *grounded_answer("{answer}", summary="answer feels-like difference"),
        complete(),
    ],
    # The manager list only shows today's data, so tomorrow's high/low must be
    # read from each city's 3-day card on the home page.
    "weather.CompareTempRange": [
        *select_city("{city1}"),
        wait(0.4, summary="read {city1} tomorrow high/low on 3-day card"),
        # Evidence asserts: the verdict may be "一样大" (never rendered), so
        # certify each compared city page (3-day card in view) was visited.
        assert_text("{city1}", summary="assert {city1} page with 3-day card on screen"),
        *select_city("{city2}"),
        wait(0.4, summary="read {city2} tomorrow high/low on 3-day card"),
        assert_text("{city2}", summary="assert {city2} page with 3-day card on screen"),
        *grounded_choice_answer("{answer}", summary="answer larger temperature range"),
        complete(),
    ],
    "weather.CompareHumidity": [
        *select_city("{city1}"),
        # Evidence asserts: the verdict may be "一样" (it literally is with the
        # live-test params — 北京/上海 humidity tie), so certify each compared
        # city page was visited before reading its humidity card.
        assert_text("{city1}", summary="assert {city1} page on screen"),
        *scroll_home_down(1, "{city1} humidity card"),
        *select_city("{city2}"),
        assert_text("{city2}", summary="assert {city2} page on screen"),
        *scroll_home_down(1, "{city2} humidity card"),
        *grounded_choice_answer("{answer}", summary="answer more humid city"),
        complete(),
    ],
    "weather.ColdestDayIn14": [
        *select_city("{city}"),
        *open_daily_forecast(),
        swipe_forecast_days(span="week 2"),
        swipe_forecast_days(span="days 10-14"),
        assert_answer("{answer_date}", field_index=0, summary="assert coldest day date on forecast"),
        assert_answer("{answer_temp}", field_index=1, summary="assert coldest day low temp on forecast"),
        *grounded_answer("{answer_date}", "{answer_temp}", summary="answer coldest day in 14 days"),
        complete(),
    ],
    "weather.NightLowTemp": [
        *select_city("{city}"),
        scroll_home_to_hourly_chart(),
        swipe_hourly_chart(1, 3),
        swipe_hourly_chart(2, 3),
        swipe_hourly_chart(3, 3),
        assert_answer("{answer}", summary="assert night low temperature on hourly chart"),
        *grounded_answer("{answer}", summary="answer night low temperature"),
        complete(),
    ],
    "weather.AddCityAndFindWarmestDay": [
        *add_city(),
        *open_daily_forecast(city_id="{city_id}"),
        swipe_forecast_days(span="next 7 days"),
        assert_answer("{answer_date}", field_index=0, summary="assert warmest day date on forecast"),
        *grounded_answer("{answer_date}", summary="answer new city warmest day"),
        complete(),
    ],
    "weather.ThreeCityRainCheck": [
        *check_city_forecast("{city1}", span="next 7 days"),
        *check_city_forecast("{city2}", span="next 7 days"),
        *check_city_forecast("{city3}", span="next 7 days"),
        *grounded_choice_answer("{answer}", summary="answer least rainy city"),
        complete(),
    ],
    # Restricted Branch: pick compares {city}'s initial temperature with the
    # {temp} threshold and the current warningAlert value; the four keys keep
    # the audit trail readable ([branch=turn_off] etc.) while collapsing into
    # two static behaviors — flip the row or leave it untouched.
    "weather.ConditionalAction": Branch(
        pick=_conditional_pick,
        branches={
            "turn_on": _conditional_action_branch(flip=True),
            "turn_off": _conditional_action_branch(flip=True),
            "keep_on": _conditional_action_branch(flip=False),
            "keep_off": _conditional_action_branch(flip=False),
        },
    ),
    "weather.AddCityFullReport": [
        *add_city(),
        assert_answer("{answer_temp}", field_index=0, summary="assert new city temperature on hero"),
        assert_answer("{answer_aqi}", field_index=2, summary="assert new city AQI on hero pill"),
        *scroll_home_down(1, "{city} humidity card"),
        assert_answer("{answer_humidity}", field_index=1, summary="assert new city humidity on details grid"),
        *grounded_answer("{answer_temp}", "{answer_humidity}", "{answer_aqi}", summary="answer new city full report"),
        complete(),
    ],
    "weather.WeekendTempRange3City": [
        *check_city_forecast("{city1}", span="weekend", gentle=True),
        *check_city_forecast("{city2}", span="weekend", gentle=True),
        *check_city_forecast("{city3}", span="weekend", gentle=True),
        *grounded_choice_answer("{answer}", summary="answer weekend smallest range city"),
        complete(),
    ],
}
