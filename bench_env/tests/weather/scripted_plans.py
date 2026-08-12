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
(hero temp, weather text, humidity, AQI, forecast dates/temps) use
``assert_answer`` — it scans every rendered text inside the foreground
Activity, so entries inside horizontal scrollers (15-day columns, hourly
chart) match regardless of the current scroll offset. Comparison verdicts
(hotter/more-humid/least-rainy city, "一样…" ties) are never rendered
verbatim, so those plans assert *evidence* instead via ``assert_text``
(each compared city page / card on screen, which is viewport-strict).
"""

from __future__ import annotations

from bench_env.agent.scripted import (
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


PLANS: dict[str, list[Step]] = {
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
    "weather.CheckDetailCard": [
        *select_city("{city}"),
        *scroll_home_down(1, "{city} details grid"),
        assert_answer("{answer}", summary="assert detail metric value on details grid"),
        *grounded_answer("{answer}", summary="answer weather detail metric"),
        complete(),
    ],
    "weather.OpenDailyForecast": [
        *select_city("{city}"),
        *open_daily_forecast(),
        swipe_forecast_days(span="days 5-10"),
        swipe_forecast_days(span="days 8-14", gentle=True),
        assert_answer("{answer}", summary="assert forecast condition on 15-day page"),
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
        assert_answer("{answer_weather}", field_index=2, summary="assert warmest day condition on forecast"),
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
    # Read {city}'s current temperature first (select it so the home hero shows
    # the live reading), then apply the toggle. A static plan covers a single
    # branch: with the test params (深圳 28°C, threshold 30, warningAlert
    # defaults to on) the correct action is to turn the alert OFF, which the
    # one toggle below performs.
    "weather.ConditionalAction": [
        *select_city("{city}"),
        *toggle_setting("天气预警提醒"),
        complete(),
    ],
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
