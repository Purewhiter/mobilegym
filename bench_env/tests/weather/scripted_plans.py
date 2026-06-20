"""Scripted validation plans for Weather tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
    complete,
    grounded_answer,
    open_answer_sheet,
    submit_answer_sheet,
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


PLANS: dict[str, list[Step]] = {
    "weather.CheckCurrentTemp": [
        *grounded_answer("{answer}", summary="answer current temperature"),
        complete(),
    ],
    "weather.CheckCurrentWeather": [
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
    "weather.CompareCityTemp": [
        *grounded_choice_answer("{answer}", summary="answer hotter city"),
        complete(),
    ],
    "weather.CheckDetailCard": [
        *grounded_answer("{answer}", summary="answer weather detail metric"),
        complete(),
    ],
    "weather.OpenDailyForecast": [
        *grounded_answer("{answer}", summary="answer daily forecast condition"),
        complete(),
    ],
    "weather.CheckAQIPollutant": [
        *grounded_answer("{answer}", summary="answer pollutant value"),
        complete(),
    ],
    "weather.CheckLifeIndex": [
        *grounded_answer("{answer}", summary="answer life index"),
        complete(),
    ],
    "weather.WarmestDayInWeek": [
        *grounded_answer("{answer_date}", "{answer_temp}", "{answer_weather}", summary="answer warmest day"),
        complete(),
    ],
    "weather.SwitchUnitAndReport": [
        *set_temp_unit(),
        *grounded_answer("{answer}", summary="answer Fahrenheit temperature"),
        complete(),
    ],
    "weather.FeelsLikeDiff": [
        *grounded_answer("{answer}", summary="answer feels-like difference"),
        complete(),
    ],
    "weather.CompareTempRange": [
        *grounded_choice_answer("{answer}", summary="answer larger temperature range"),
        complete(),
    ],
    "weather.CompareHumidity": [
        *grounded_choice_answer("{answer}", summary="answer more humid city"),
        complete(),
    ],
    "weather.ColdestDayIn14": [
        *grounded_answer("{answer_date}", "{answer_temp}", summary="answer coldest day in 14 days"),
        complete(),
    ],
    "weather.NightLowTemp": [
        *grounded_answer("{answer}", summary="answer night low temperature"),
        complete(),
    ],
    "weather.AddCityAndFindWarmestDay": [
        *add_city(),
        *grounded_answer("{answer_date}", summary="answer new city warmest day"),
        complete(),
    ],
    "weather.ThreeCityRainCheck": [
        *grounded_choice_answer("{answer}", summary="answer least rainy city"),
        complete(),
    ],
    "weather.ConditionalAction": [
        *toggle_setting("天气预警提醒"),
        complete(),
    ],
    "weather.AddCityFullReport": [
        *add_city(),
        *grounded_answer("{answer_temp}", "{answer_humidity}", "{answer_aqi}", summary="answer new city full report"),
        complete(),
    ],
    "weather.WeekendTempRange3City": [
        *grounded_choice_answer("{answer}", summary="answer weekend smallest range city"),
        complete(),
    ],
}
