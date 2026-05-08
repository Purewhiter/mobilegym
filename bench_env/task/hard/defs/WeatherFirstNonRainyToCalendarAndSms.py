from __future__ import annotations
from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.calendar.app import CALENDAR_EVENT_CHANGES, Calendar
from bench_env.task.judge import JudgeInput
from bench_env.task.sms.app import SMS_RECIPIENT_PARAM, SMS_SEND_CHANGES, sms_from_input
from bench_env.task.utils import date_match_labels
from bench_env.task.weather.app import WEATHER_QUERY_CHANGES, WEATHER_SAVED_CITIES, Weather


class WeatherFirstNonRainyToCalendarAndSms(BaseTask):
    """判定：日历新增"户外跑步"事件日期 == 未来一周第一个不下雨日期；短信含日期标签 + 天气描述。"""

    templates = [
        "在“{city}”未来一周里找第一个不下雨的日期，在日历上新建“户外跑步”事件，并短信告知“{contact}”这一天的日期和天气，约他一起跑步。",
    ]
    apps = ["weather", "calendar", "sms"]
    scope = "S3"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["query", "reasoning", "create", "transfer"]
    parameters = {
        "city": {
            "type": "enum",
            "values": {city: city for city in WEATHER_SAVED_CITIES},
            "default": "北京",
            "description": "天气查询城市",
        },
        "contact": SMS_RECIPIENT_PARAM,
    }
    expected_changes = (
        WEATHER_QUERY_CHANGES + CALENDAR_EVENT_CHANGES + SMS_SEND_CHANGES
    )

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        weather = Weather(input.apps["weather"])
        calendar = Calendar(input.apps["calendar"], init=input.apps_init["calendar"])
        sms = sms_from_input(input)
        target_date = weather.first_non_rainy_date(self.p.city, 1, 7)
        forecast = weather.daily_by_date(self.p.city, target_date)
        text_day = str(forecast.get("textDay") or "").strip()
        text_night = str(forecast.get("textNight") or "").strip()
        weather_labels = [label for label in (text_day, text_night) if label]
        date_labels = date_match_labels(target_date, input.os)
        return [
            calendar.check_event_created("户外跑步", field="event_created", fuzzy=True),
            calendar.check_event_on_date("户外跑步", target_date, field="event_date", fuzzy=True),
            sms.check_new_sent_any_of(
                self.p.contact,
                date_labels,
                field="sms_date",
            ),
            sms.check_new_sent_any_of(
                self.p.contact,
                weather_labels,
                field="sms_weather",
            ),
        ]
