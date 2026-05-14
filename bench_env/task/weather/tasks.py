"""
Weather app task definitions.
"""
# -- Task Index (auto-generated, do not edit) --
# 22 tasks | L1×4  L2×9  L3×5  L4×4
#
# [L1] CheckCurrentTemp          帮我看看{city}现在多少度
# [L1] CheckCurrentWeather       {city}当前天气怎么样
# [L1] EnableNightDnd            打开天气的夜间免打扰
# [L2] SwitchTempUnit            把天气的温度单位改成{unit}
# [L2] SwitchWindUnit            把天气的风速单位改成{unit}
# [L2] CompareCityTemp           帮我看看{city1}和{city2}哪个城市现在更热
# [L2] CheckDetailCard           帮我看看{city}的{metric}
# [L2] OpenDailyForecast         看看{city}{date}的天气怎么样
# [L2] CheckAQIPollutant         查看{city}当前{pollutant}是多少
# [L2] CheckLifeIndex            {city}今天{index_type}
# [L3] WarmestDayInWeek          {city}未来五天里哪天的最高温是最高的，这天天气怎么样
# [L1] SwitchUnitAndReport       把温度单位切到华氏度，然后告诉我{city}现在华氏多少度
# [L3] FeelsLikeDiff             {city}现在体感温度和实际温度差几度
# [L3] CompareTempRange          {city1}和{city2}哪个城市明天温差更大
# [L3] CompareHumidity           {city1}和{city2}哪个城市现在更潮湿
# [L3] ColdestDayIn14            {city}未来两周最冷的是哪天（当日最低温最低的一天），最低温是多少
# [L4] NightLowTemp              帮我看看{city}今晚18点到次日4点的最低气温是多少
# [L2] AddCityAndFindWarmestDay  把{city}加到天气里，然后看看那边未来一周哪天最暖和
# [L4] ThreeCityRainCheck        {city1}、{city2}和{city3}未来一周哪个城市最不容易下雨
# [L4] ConditionalAction         如果{city}现在超过{temp}度就把天气预警提醒打开，没超过就关掉
# [L2] AddCityFullReport         把{city}加到天气里，告诉我那边现在的温度、湿度和空气质量
# [L4] WeekendTempRange3City     周末想出去玩，帮我看看{city1}、{city2}、{city3}周末哪个城市温差小
# -- End Task Index --

from __future__ import annotations

import re
from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import (
    AnswerTask,
    CriteriaTask,
    build_answer_checks,
    match_value,
)
from bench_env.task.judge import JudgeInput
from bench_env.task.utils import format_date_natural, now_ms
from bench_env.task.weather.app import (
    WEATHER_DETAIL_CARD_VALUES,
    WEATHER_LIFE_INDEX_VALUES,
    WEATHER_NEW_CITIES,
    WEATHER_POLLUTANT_VALUES,
    WEATHER_SAVED_CITIES,
    Weather,
)


class CheckCurrentTemp(AnswerTask):
    templates = ["帮我看看{city}现在多少度"]
    apps = ["weather"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["extract"]
    answer_fields = [{"type": "number", "label": "当前温度（°C）"}]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_SAVED_CITIES, "default": "北京"},
    }
    expected_changes = ["selectedCityId", "bundlesByCityId", "searchHistory", "lastAccess"]

    def get_answer(self, input: JudgeInput) -> Any:
        return Weather(input.apps_init["weather"]).current_temp(self.p.city)


class CheckCurrentWeather(AnswerTask):
    templates = ["{city}当前天气怎么样"]
    apps = ["weather"]
    scope = "S1"
    objective = "query"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["extract"]
    answer_fields = [{"type": "text", "label": "天气状况", "hint": "如：阴"}]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_SAVED_CITIES, "default": "上海"},
    }
    expected_changes = ["selectedCityId", "bundlesByCityId", "searchHistory", "lastAccess"]

    def get_answer(self, input: JudgeInput) -> Any:
        return Weather(input.apps_init["weather"]).current_weather_text(self.p.city)
class EnableNightDnd(CriteriaTask):
    templates = [
        "打开天气的夜间免打扰",
        "Turn on the night Do Not Disturb mode in the Weather app",
    ]
    apps = ["weather"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L1"
    capabilities = ["settings"]
    criteria = {"settings.nightDnd": True}

    async def _post_sample(self, env: Any) -> None:
        await self._invert_criteria(env)


class SwitchTempUnit(CriteriaTask):
    templates = ["把天气的温度单位改成{unit}"]
    apps = ["weather"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings"]
    parameters = {
        "unit": {
            "type": "enum",
            "values": {"摄氏度": "celsius", "华氏度": "fahrenheit"},
            "default": "fahrenheit",
        },
    }
    criteria = {"settings.tempUnit": "{unit}"}

    async def _post_sample(self, env: Any) -> None:
        await self._invert_criteria(env)


class SwitchWindUnit(CriteriaTask):
    templates = ["把天气的风速单位改成{unit}"]
    apps = ["weather"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings"]
    parameters = {
        "unit": {
            "type": "enum",
            "values": {
                "蒲福": "beaufort",
                "公里/小时": "kmh",
                "米/秒": "ms",
                "英里/小时": "mph",
                "节": "kn",
            },
            "default": "ms",
        },
    }
    criteria = {"settings.windUnit": "{unit}"}

    async def _post_sample(self, env: Any) -> None:
        await self._invert_criteria(env)
class CompareCityTemp(AnswerTask):
    templates = ["帮我看看{city1}和{city2}哪个城市现在更热"]
    apps = ["weather"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["extract", "reasoning"]
    parameters = {
        "city1": {"type": "string", "default": "北京", "description": "城市1"},
        "city2": {"type": "string", "default": "上海", "description": "城市2"},
        "_cities": {
            "sampler": Weather.sample_two_saved_cities,
            "fields": {"city1": "city1", "city2": "city2"},
        },
    }
    expected_changes = ["selectedCityId", "bundlesByCityId", "searchHistory", "lastAccess"]
    answer_fields = [
        {"type": "choice", "label": "更热的城市",
         "options": ["{city1}", "{city2}", "一样热"]}
    ]

    def get_answer(self, input: JudgeInput) -> Any:
        return Weather(input.apps_init["weather"]).hotter_city_answer(self.p.city1, self.p.city2)

    def get_expected_response(self, input: JudgeInput) -> list:
        winner, _, _ = Weather(input.apps_init["weather"]).hotter_city(self.p.city1, self.p.city2)
        return ["一样热"] if winner == "一样" else [winner]


class CheckDetailCard(AnswerTask):
    templates = ["帮我看看{city}的{metric}"]
    apps = ["weather"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["extract"]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_SAVED_CITIES, "default": "北京"},
        "metric": {
            "type": "enum",
            "values": WEATHER_DETAIL_CARD_VALUES,
            "default": "humidity",
        },
    }
    @property
    def answer_fields(self):  # type: ignore[override]
        fields = {
            "humidity":  {"type": "number", "label": "湿度多少"},
            "uvIndex":   {"type": "number", "label": "紫外线指数"},
            "feelsLike": {"type": "number", "label": "体感多少度"},
            "sunrise":   {"type": "text",   "label": "日出几点",   "hint": "如：05:48", "matcher": "time"},
            "wind":      {"type": "text",   "label": "刮什么风",   "hint": "如：西北风4级"},
        }
        metric_val = getattr(self.p, "metric", None) or ""
        return [fields.get(metric_val, {"type": "text", "label": "查询结果"})]
    
    expected_changes = ["selectedCityId", "bundlesByCityId", "searchHistory", "lastAccess"]

    def get_answer(self, input: JudgeInput) -> Any:
        weather = Weather(input.apps_init["weather"])
        if self.p.metric == "humidity":
            return weather.current_humidity(self.p.city)
        if self.p.metric == "uvIndex":
            return weather.today_uv_index(self.p.city)
        if self.p.metric == "sunrise":
            return weather.today_sunrise(self.p.city)
        if self.p.metric == "feelsLike":
            return weather.current_feels_like(self.p.city)
        wind = weather.current_wind_info(self.p.city)
        return {"dir": wind["dir"], "scale": wind["scale"]}

    def get_expected_response(self, input: JudgeInput) -> list:
        answer = self.get_answer(input)
        if isinstance(answer, dict):
            return [f"{answer['dir']}{answer['scale']}级"]
        return [str(answer)]


class OpenDailyForecast(CriteriaTask):
    templates = ["看看{city}{date}的天气怎么样"]
    apps = ["weather"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["extract"]
    answer_fields = [{"type": "text", "label": "天气状况", "hint": "如：小雨"}]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_SAVED_CITIES, "default": "北京"},
        "date": {
            "type": "string",
            "sampler": Weather.sample_forecast_date_7_to_14,
            "default": "2026-03-23",
            "display": format_date_natural,
        },
    }
    expected_changes = ["selectedCityId", "bundlesByCityId", "searchHistory", "lastAccess"]

    def get_answer(self, input: JudgeInput) -> Any:
        weather = Weather(input.apps_init["weather"])
        day = weather.daily_by_date(self.p.city, self.p.date)
        return Weather.day_text(day)

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        weather = Weather(input.apps_init["weather"])
        day = weather.daily_by_date(self.p.city, self.p.date)
        actual = str(input.answer or "")
        td = str(day.get("textDay") or "").strip()
        tn = str(day.get("textNight") or "").strip()
        return [
            {
                "field": "answer",
                "expected": f"{td}/{tn}",
                "actual": input.answer,
                "passed": Weather.forecast_text_matches(day, actual)
                or any(match_value(c, actual) for c in [td, tn] if c),
            }
        ]


class CheckAQIPollutant(AnswerTask):
    templates = ["查看{city}当前{pollutant}是多少"]
    apps = ["weather"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["extract"]
    answer_fields = [{"type": "number", "label": "污染物浓度"}]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_SAVED_CITIES, "default": "上海"},
        "pollutant": {
            "type": "enum",
            "values": WEATHER_POLLUTANT_VALUES,
            "default": "pm2p5",
        },
    }
    expected_changes = ["selectedCityId", "bundlesByCityId", "searchHistory", "lastAccess"]

    def get_answer(self, input: JudgeInput) -> Any:
        raw = Weather(input.apps_init["weather"]).pollutant_value(self.p.city, self.p.pollutant)
        value = float(raw)
        # Align with app display: CO shown with toFixed(1), others with Math.round.
        if self.p.pollutant == "co":
            return round(value, 1)
        return int(value + 0.5)


class CheckLifeIndex(AnswerTask):
    templates = ["{city}今天{index_type}"]
    apps = ["weather"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["extract"]
    answer_fields = [{"type": "text", "label": "指数等级", "hint": "如：一般"}]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_SAVED_CITIES, "default": "杭州"},
        "index_type": {
            "type": "enum",
            "values": WEATHER_LIFE_INDEX_VALUES,
            "default": "洗车",
        },
    }
    expected_changes = ["selectedCityId", "bundlesByCityId", "searchHistory", "lastAccess"]

    def get_answer(self, input: JudgeInput) -> Any:
        index = Weather(input.apps_init["weather"]).life_index_by_name(self.p.city, self.p.index_type)
        return str(index["category"]).strip()


class WarmestDayInWeek(AnswerTask):
    templates = ["{city}未来五天里哪天的最高温是最高的，这天天气怎么样"]
    apps = ["weather"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["extract", "reasoning"]
    answer_fields = [
        {"type": "text", "label": "日期", "hint": "如：3月15日", "matcher": "date"},
        {"type": "number", "label": "最高温（°C）"},
        {"type": "text", "label": "天气状况", "hint": "如：小雨"},
    ]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_SAVED_CITIES, "default": "深圳"},
    }
    expected_changes = ["selectedCityId", "bundlesByCityId", "searchHistory", "lastAccess"]

    def get_answer(self, input: JudgeInput) -> Any:
        days = Weather(input.apps_init["weather"]).daily_range(self.p.city, 1, 5)
        # Use daily forecast: tempMax = that day highest temperature.
        best_temp = max(float(day["tempMax"]) for day in days)
        eps = 1e-6
        picked_days = [day for day in days if abs(float(day["tempMax"]) - best_temp) <= eps]
        return {
            # When multiple days share the same max tempMax, any one is acceptable.
            "dates": [str(day["fxDate"]) for day in picked_days],
            "temp": best_temp,
            "weather": [Weather.day_text(day) for day in picked_days],
            "_forecasts": picked_days,
        }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        answer = self.get_answer(input)
        answer_text = str(input.answer or "")
        labels = []
        for d in answer.get("dates", []):
            labels.extend(Weather.date_labels(d, input.os_init))
        forecs = answer.get("_forecasts", [])
        return [
            {
                "field": "answer.date",
                "expected": labels,
                "actual": input.answer,
                "passed": any(label in answer_text for label in labels),
            },
            {
                "field": "answer.temp",
                "expected": answer["temp"],
                "actual": input.answer,
                "passed": match_value(answer["temp"], input.answer),
            },
            {
                "field": "answer.weather",
                # Weather description may differ across equally-warm days,
                # so we validate against all tied candidates.
                "expected": "tied max-temp days' weather text",
                "actual": input.answer,
                "passed": any(
                    Weather.forecast_text_matches(fc, answer_text)
                    or any(
                        (c and (c in answer_text or match_value(c, input.answer)))
                        for c in [str(fc.get("textDay") or "").strip(), str(fc.get("textNight") or "").strip()]
                    )
                    for fc in forecs
                ),
            },
        ]


class SwitchUnitAndReport(CriteriaTask):
    templates = ["把温度单位切到华氏度，然后告诉我{city}现在华氏多少度"]
    apps = ["weather"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings", "extract"]
    criteria = {"settings.tempUnit": "fahrenheit"}
    answer_fields = [{"type": "number", "label": "华氏温度（°F）"}]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_SAVED_CITIES, "default": "上海"},
    }
    expected_changes = ["settings", "selectedCityId", "bundlesByCityId", "searchHistory", "lastAccess"]

    async def _post_sample(self, env: Any) -> None:
        await env.set_state(
            {"apps": {"weather": {"settings": {"tempUnit": "celsius"}}}},
            deep=True,
            reload=False,
        )

    def get_answer(self, input: JudgeInput) -> Any:
        temp_c = Weather(input.apps_init["weather"]).current_temp(self.p.city)
        return round(temp_c * 9 / 5 + 32)


class FeelsLikeDiff(AnswerTask):
    templates = ["{city}现在体感温度和实际温度差几度"]
    apps = ["weather"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["extract", "reasoning"]
    answer_fields = [{"type": "number", "label": "温差（°C）"}]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_SAVED_CITIES, "default": "北京"},
    }
    expected_changes = ["selectedCityId", "bundlesByCityId", "searchHistory", "lastAccess"]

    def get_answer(self, input: JudgeInput) -> Any:
        weather = Weather(input.apps_init["weather"])
        return abs(weather.current_feels_like(self.p.city) - weather.current_temp(self.p.city))


class CompareTempRange(AnswerTask):
    templates = ["{city1}和{city2}哪个城市明天温差更大"]
    apps = ["weather"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["extract", "reasoning"]
    parameters = {
        "city1": {"type": "string", "default": "北京", "description": "城市1"},
        "city2": {"type": "string", "default": "上海", "description": "城市2"},
        "_cities": {
            "sampler": Weather.sample_two_saved_cities,
            "fields": {"city1": "city1", "city2": "city2"},
        },
    }
    expected_changes = ["selectedCityId", "bundlesByCityId", "searchHistory", "lastAccess"]
    answer_fields = [
        {"type": "choice", "label": "温差更大的城市",
         "options": ["{city1}", "{city2}", "一样大"]}
    ]

    def get_answer(self, input: JudgeInput) -> Any:
        weather = Weather(input.apps_init["weather"])
        current_ms = now_ms(input.os_init)
        city1 = weather.city_tomorrow_high_low(self.p.city1, current_ms)
        city2 = weather.city_tomorrow_high_low(self.p.city2, current_ms)
        range1 = float(city1["high"]) - float(city1["low"])
        range2 = float(city2["high"]) - float(city2["low"])
        if range1 > range2:
            return self.p.city1
        if range2 > range1:
            return self.p.city2
        return re.compile(r"一样|相同|差不多")

    def get_expected_response(self, input: JudgeInput) -> list:
        weather = Weather(input.apps_init["weather"])
        current_ms = now_ms(input.os_init)
        city1 = weather.city_tomorrow_high_low(self.p.city1, current_ms)
        city2 = weather.city_tomorrow_high_low(self.p.city2, current_ms)
        range1 = float(city1["high"]) - float(city1["low"])
        range2 = float(city2["high"]) - float(city2["low"])
        if range1 > range2:
            return [self.p.city1]
        if range2 > range1:
            return [self.p.city2]
        return ["一样大"]


class CompareHumidity(AnswerTask):
    templates = ["{city1}和{city2}哪个城市现在更潮湿"]
    apps = ["weather"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["extract", "reasoning"]
    parameters = {
        "city1": {"type": "string", "default": "北京", "description": "城市1"},
        "city2": {"type": "string", "default": "上海", "description": "城市2"},
        "_cities": {
            "sampler": Weather.sample_two_saved_cities,
            "fields": {"city1": "city1", "city2": "city2"},
        },
    }
    expected_changes = ["selectedCityId", "bundlesByCityId", "searchHistory", "lastAccess"]
    answer_fields = [
        {"type": "choice", "label": "更潮湿的城市",
         "options": ["{city1}", "{city2}", "一样"]}
    ]

    def get_answer(self, input: JudgeInput) -> Any:
        weather = Weather(input.apps_init["weather"])
        city1_humidity = weather.current_humidity(self.p.city1)
        city2_humidity = weather.current_humidity(self.p.city2)
        if city1_humidity > city2_humidity:
            return self.p.city1
        if city2_humidity > city1_humidity:
            return self.p.city2
        return re.compile(r"一样|相同|差不多")

    def get_expected_response(self, input: JudgeInput) -> list:
        weather = Weather(input.apps_init["weather"])
        h1 = weather.current_humidity(self.p.city1)
        h2 = weather.current_humidity(self.p.city2)
        if h1 > h2:
            return [self.p.city1]
        if h2 > h1:
            return [self.p.city2]
        return ["一样"]


class ColdestDayIn14(CriteriaTask):
    templates = ["{city}未来两周最冷的是哪天（当日最低温最低的一天），最低温是多少"]
    apps = ["weather"]
    scope = "S1"
    objective = "hybrid"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["extract", "reasoning"]
    answer_fields = [
        {"type": "text", "label": "日期", "hint": "如：3月15日", "matcher": "date"},
        {"type": "number", "label": "最低温（°C）"},
    ]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_SAVED_CITIES, "default": "成都"},
    }
    expected_changes = ["selectedCityId", "bundlesByCityId", "searchHistory", "lastAccess"]

    def get_answer(self, input: JudgeInput) -> Any:
        days = Weather(input.apps_init["weather"]).daily_range(self.p.city, 1, 14)
        # Use daily forecast: tempMin = that day lowest temperature.
        best_temp = min(float(day["tempMin"]) for day in days)
        eps = 1e-6
        picked_days = [day for day in days if abs(float(day["tempMin"]) - best_temp) <= eps]
        return {
            # When multiple days share the same min tempMin, any one is acceptable.
            "dates": [str(day["fxDate"]) for day in picked_days],
            "temp": best_temp,
        }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        answer = self.get_answer(input)
        answer_text = str(input.answer or "")
        labels = []
        for d in answer.get("dates", []):
            labels.extend(Weather.date_labels(d, input.os_init))
        checks = self._check_criteria(input)
        checks.extend([
            {
                "field": "answer.date",
                "expected": labels,
                "actual": input.answer,
                "passed": any(label in answer_text for label in labels),
            },
            {
                "field": "answer.temp",
                "expected": answer["temp"],
                "actual": input.answer,
                "passed": match_value(answer["temp"], input.answer),
            },
        ])
        return checks


class NightLowTemp(AnswerTask):
    templates = ["帮我看看{city}今晚18点到次日4点的最低气温是多少"]
    apps = ["weather"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["extract", "reasoning"]
    answer_fields = [{"type": "number", "label": "最低气温（°C）"}]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_SAVED_CITIES, "default": "广州"},
    }
    expected_changes = ["selectedCityId", "bundlesByCityId", "searchHistory", "lastAccess"]

    def get_answer(self, input: JudgeInput) -> Any:
        hourly = Weather(input.apps_init["weather"]).weather_hourly(self.p.city)
        night_hours: list[float] = []
        for item in hourly:
            hour = Weather.hour_from_fx_time(item["fxTime"])
            if hour is None:
                raise ValueError(f"Invalid hourly fxTime for city '{self.p.city}': {item['fxTime']}")
            # Night window: 18:00-23:59 and 00:00-05:59 (inclusive of matching hours).
            if hour >= 18 or hour < 4:
                night_hours.append(float(item["temp"]))
        if not night_hours:
            raise ValueError(f"No night hourly data for city '{self.p.city}'")
        return min(night_hours)
class AddCityAndFindWarmestDay(BaseTask):
    templates = ["把{city}加到天气里，然后看看那边未来一周哪天最暖和"]
    apps = ["weather"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["search", "extract", "reasoning"]
    answer_fields = [{"type": "text", "label": "最暖和的日期", "hint": "如：4月10日", "matcher": "date"}]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_NEW_CITIES, "default": "南京"},
    }
    expected_changes = [
        "savedCities",
        "selectedCityId",
        "bundlesByCityId",
        "searchHistory",
        "lastAccess",
        "weatherLibrary",
    ]

    def get_answer(self, input: JudgeInput) -> dict[str, Any]:
        days = Weather(input.apps_init["weather"]).daily_range(self.p.city, 1, 7)
        picked = max(days, key=lambda day: float(day["tempMax"]))
        return {"date": str(picked["fxDate"])}

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        weather = Weather(input.apps["weather"])
        answer = self.get_answer(input)
        answer_text = str(input.answer or "")
        labels = Weather.date_labels(answer["date"], input.os_init)
        return [
            {
                "field": "savedCities",
                "expected": f"contains {self.p.city}",
                "actual": [str(city["name"]) for city in weather.saved_cities],
                "passed": weather.saved_city_matches(self.p.city),
            },
            {
                "field": "answer.date",
                "expected": labels,
                "actual": input.answer,
                "passed": any(label in answer_text for label in labels),
            },
        ]


class ThreeCityRainCheck(AnswerTask):
    templates = ["{city1}、{city2}和{city3}未来一周哪个城市最不容易下雨"]
    apps = ["weather"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["extract", "reasoning"]
    parameters = {
        "city1": {"type": "string", "default": "北京", "description": "城市1"},
        "city2": {"type": "string", "default": "上海", "description": "城市2"},
        "city3": {"type": "string", "default": "广州", "description": "城市3"},
        "_cities": {
            "sampler": Weather.sample_three_saved_cities,
            "fields": {"city1": "city1", "city2": "city2", "city3": "city3"},
        },
    }
    expected_changes = ["selectedCityId", "bundlesByCityId", "searchHistory", "lastAccess"]
    answer_fields = [
        {"type": "choice", "label": "最不容易下雨的城市",
         "options": ["{city1}", "{city2}", "{city3}", "差不多"]}
    ]

    def get_answer(self, input: JudgeInput) -> Any:
        weather = Weather(input.apps_init["weather"])
        counts = {
            city: Weather.count_rainy_days(weather.daily_range(city, 1, 7))
            for city in (self.p.city1, self.p.city2, self.p.city3)
        }
        min_days = min(counts.values())
        winners = [city for city, d in counts.items() if d == min_days]
        if len(winners) >= 2:
            return re.compile(r"一样|相同|差不多|都|随便|任意")
        return winners[0]

    def get_expected_response(self, input: JudgeInput) -> list:
        weather = Weather(input.apps_init["weather"])
        counts = {
            city: Weather.count_rainy_days(weather.daily_range(city, 1, 7))
            for city in (self.p.city1, self.p.city2, self.p.city3)
        }
        min_days = min(counts.values())
        winners = [city for city, d in counts.items() if d == min_days]
        if len(winners) >= 2:
            return ["差不多"]
        return [winners[0]]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        weather = Weather(input.apps_init["weather"])
        counts = {
            city: Weather.count_rainy_days(weather.daily_range(city, 1, 7))
            for city in (self.p.city1, self.p.city2, self.p.city3)
        }
        min_days = min(counts.values())
        winners = [city for city, d in counts.items() if d == min_days]
        answer_text = str(input.answer or "")
        passed = any(city in answer_text for city in winners)
        if len(winners) >= 2:
            passed = passed or bool(re.search(r"一样|相同|差不多|都|随便|任意", answer_text))

        return [
            {
                "field": "answer",
                "expected": {"rain_days_next_week": counts, "acceptable": winners},
                "actual": input.answer,
                "passed": passed,
            }
        ]


class ConditionalAction(BaseTask):
    templates = ["如果{city}现在超过{temp}度就把天气预警提醒打开，没超过就关掉"]
    apps = ["weather"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["extract", "settings", "reasoning"]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_SAVED_CITIES, "default": "深圳"},
        "temp": {"type": "enum", "values": [20, 25, 30, 35], "default": 30},
    }
    expected_changes = ["settings", "selectedCityId", "bundlesByCityId", "searchHistory", "lastAccess"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        weather = Weather(input.apps["weather"], init=input.apps_init["weather"])
        expected = weather.init.current_temp(self.p.city) > self.p.temp
        actual = bool(weather.get("settings.warningAlert"))
        return [{
            "field": "settings.warningAlert",
            "expected": expected,
            "actual": actual,
            "passed": actual == expected,
        }]


class AddCityFullReport(BaseTask):
    templates = ["把{city}加到天气里，告诉我那边现在的温度、湿度和空气质量"]
    apps = ["weather"]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["search", "extract"]
    answer_fields = [
        {"type": "number", "label": "温度（°C）"},
        {"type": "number", "label": "湿度（%）"},
        {"type": "number", "label": "空气质量指数（AQI）"},
    ]
    parameters = {
        "city": {"type": "enum", "values": WEATHER_NEW_CITIES, "default": "武汉"},
    }
    expected_changes = [
        "savedCities",
        "selectedCityId",
        "bundlesByCityId",
        "searchHistory",
        "lastAccess",
        "weatherLibrary",
    ]

    def get_answer(self, input: JudgeInput) -> dict[str, Any]:
        weather = Weather(input.apps_init["weather"])
        air_quality = weather.air_quality(self.p.city)
        return {
            "temp": weather.current_temp(self.p.city),
            "humidity": weather.current_humidity(self.p.city),
            "aqi": float(air_quality["aqi"]),
        }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        weather = Weather(input.apps["weather"])
        checks = [{
            "field": "savedCities",
            "expected": f"contains {self.p.city}",
            "actual": [str(city["name"]) for city in weather.saved_cities],
            "passed": weather.saved_city_matches(self.p.city),
        }]
        expected = self.get_answer(input)
        # grounded 模式：按索引逐字段匹配，避免同值数字交叉污染
        sheet = (input.apps or {}).get("answer_sheet", {})
        answers = sheet.get("answers", {})
        if answers:
            for i, (key, val) in enumerate(expected.items()):
                cell = answers.get(str(i), "")
                checks.append({
                    "field": f"answer.{key}",
                    "expected": val,
                    "actual": cell,
                    "passed": match_value(val, cell),
                })
        else:
            checks.extend(build_answer_checks(expected, input.answer))
        return checks


class WeekendTempRange3City(AnswerTask):
    templates = ["周末想出去玩，帮我看看{city1}、{city2}、{city3}周末哪个城市温差小"]
    apps = ["weather"]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["extract", "reasoning"]
    parameters = {
        "city1": {"type": "string", "default": "北京", "description": "城市1"},
        "city2": {"type": "string", "default": "上海", "description": "城市2"},
        "city3": {"type": "string", "default": "广州", "description": "城市3"},
        "_cities": {
            "sampler": Weather.sample_three_saved_cities,
            "fields": {"city1": "city1", "city2": "city2", "city3": "city3"},
        },
    }
    expected_changes = ["selectedCityId", "bundlesByCityId", "searchHistory", "lastAccess"]
    answer_fields = [
        {"type": "choice", "label": "周末温差最小的城市",
         "options": ["{city1}", "{city2}", "{city3}", "差不多"]}
    ]

    def get_answer(self, input: JudgeInput) -> Any:
        weather = Weather(input.apps_init["weather"])
        ranges = {
            city: Weather.temp_range_of_days(weather.weekend_daily(city)[:2])
            for city in (self.p.city1, self.p.city2, self.p.city3)
        }
        best = min(ranges.values())
        winners = [city for city, v in ranges.items() if v == best]
        if len(winners) >= 2:
            return re.compile(r"一样|相同|差不多|都|随便|任意")
        return winners[0]

    def get_expected_response(self, input: JudgeInput) -> list:
        weather = Weather(input.apps_init["weather"])
        ranges = {
            city: Weather.temp_range_of_days(weather.weekend_daily(city)[:2])
            for city in (self.p.city1, self.p.city2, self.p.city3)
        }
        best = min(ranges.values())
        winners = [city for city, v in ranges.items() if v == best]
        if len(winners) >= 2:
            return ["差不多"]
        return [winners[0]]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        weather = Weather(input.apps_init["weather"])
        ranges = {
            city: Weather.temp_range_of_days(weather.weekend_daily(city)[:2])
            for city in (self.p.city1, self.p.city2, self.p.city3)
        }
        best = min(ranges.values())
        winners = [city for city, v in ranges.items() if v == best]
        answer_text = str(input.answer or "")
        passed = any(city in answer_text for city in winners)
        if len(winners) >= 2:
            passed = passed or bool(re.search(r"一样|相同|差不多|都|随便|任意", answer_text))

        return [
            {
                "field": "answer",
                "expected": {"weekend_temp_range": ranges, "acceptable": winners},
                "actual": input.answer,
                "passed": passed,
            }
        ]
