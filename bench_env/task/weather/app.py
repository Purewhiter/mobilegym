"""
Weather app state accessor.
"""

from __future__ import annotations

import datetime
import re
from typing import Any

from bench_env.task.base import BaseApp
from bench_env.task.utils import date_match_labels, norm_city_key, parse_date, sim_today, to_float

WEATHER_SAVED_CITIES = ["北京", "上海", "广州", "深圳", "杭州", "成都"]
WEATHER_NEW_CITIES = ["南京", "武汉", "三亚"]

WEATHER_DETAIL_CARD_VALUES = {
    "湿度多少": "humidity",
    "紫外线指数": "uvIndex",
    "日出几点": "sunrise",
    "体感多少度": "feelsLike",
    "刮什么风": "wind",
}

WEATHER_POLLUTANT_VALUES = {
    "PM2.5": "pm2p5",
    "PM10": "pm10",
    "二氧化硫": "so2",
    "二氧化氮": "no2",
    "臭氧": "o3",
    "一氧化碳": "co",
}

WEATHER_LIFE_INDEX_VALUES = {
    "洗车指数怎么样": "洗车",
    "穿衣指数怎么样": "穿衣",
}

CITY_ALIAS_MAP: dict[str, list[str]] = {
    "beijing": ["beijing", "北京", "Beijing"],
    "shanghai": ["shanghai", "上海", "Shanghai"],
    "guangzhou": ["guangzhou", "广州", "Guangzhou"],
    "shenzhen": ["shenzhen", "深圳", "Shenzhen"],
    "hangzhou": ["hangzhou", "杭州", "Hangzhou"],
    "chengdu": ["chengdu", "成都", "Chengdu"],
    "nanjing": ["nanjing", "南京", "Nanjing"],
    "wuhan": ["wuhan", "武汉", "Wuhan"],
    "sanya": ["sanya", "三亚", "Sanya"],
}

WEATHER_QUERY_CHANGES = [
    "weather.selectedCityId",
    "weather.bundlesByCityId",
    "weather.searchHistory",
    "weather.lastAccess",
]

class Weather(BaseApp):
    """Weather state accessor based on bundlesByCityId."""

    @staticmethod
    def sample_forecast_date_7_to_14(env_state: dict[str, Any], rng: Any) -> str:
        base = sim_today(env_state["os"])
        return (base + datetime.timedelta(days=rng.choice(range(7, 15)))).isoformat()

    @staticmethod
    def sample_two_saved_cities(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        city1, city2 = rng.sample(WEATHER_SAVED_CITIES, 2)
        return {"city1": city1, "city2": city2}

    @staticmethod
    def sample_three_saved_cities(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        city1, city2, city3 = rng.sample(WEATHER_SAVED_CITIES, 3)
        return {"city1": city1, "city2": city2, "city3": city3}

    @staticmethod
    def date_labels(date_value: str, os_state: dict | None = None) -> list[str]:
        return date_match_labels(date_value, os_state)

    @property
    def bundles_by_city_id(self) -> dict[str, dict[str, Any]]:
        # 运行时缓存（用户实际查看过的城市）
        runtime = self.get("bundlesByCityId", {})
        if not isinstance(runtime, dict):
            raise ValueError("weather.bundlesByCityId is not a dict")
        # 预置数据库（weatherBundles.json → weatherLibrary）
        library = self.get("weatherLibrary", {})
        if not isinstance(library, dict):
            library = {}
        # 合并：runtime 优先，library 作为 fallback
        if not library:
            return runtime
        merged = {**library, **runtime}
        return merged

    @property
    def saved_cities(self) -> list[dict[str, Any]]:
        cities = self.get("savedCities", [])
        if not isinstance(cities, list):
            raise ValueError("weather.savedCities is not a list")
        return cities

    @property
    def selected_city_id(self) -> str:
        selected = str(self.get("selectedCityId", "") or "").strip()
        if not selected:
            raise ValueError("weather.selectedCityId is empty")
        return selected

    def _candidate_city_ids(self, city_name: str | None) -> list[str]:
        candidates: list[str] = []
        if city_name is None:
            if "located" in self.bundles_by_city_id:
                candidates.append("located")
            candidates.append(self.selected_city_id)
            return candidates

        city_key = norm_city_key(city_name)
        for city_id, aliases in CITY_ALIAS_MAP.items():
            if any(
                norm_city_key(alias) == city_key
                or norm_city_key(alias) in city_key
                or city_key in norm_city_key(alias)
                for alias in aliases
            ):
                candidates.append(city_id)

        for city in self.saved_cities:
            city_id = str(city.get("id") or "").strip()
            saved_name = str(city.get("name") or "").strip()
            if city_id and city_key and (
                norm_city_key(saved_name) in city_key
                or city_key in norm_city_key(saved_name)
            ):
                candidates.append(city_id)

        for city_id, entry in self.bundles_by_city_id.items():
            if not isinstance(entry, dict):
                continue
            location_name = str(entry.get("locationName") or "").strip()
            if location_name and city_key and (
                norm_city_key(location_name) in city_key
                or city_key in norm_city_key(location_name)
            ):
                candidates.append(str(city_id))

        candidates.append(self.selected_city_id)
        return candidates

    def saved_city_matches(self, city_name: str) -> bool:
        target = norm_city_key(city_name)
        if not target:
            raise ValueError("city_name is empty")
        return any(
            target in norm_city_key(str(city.get("name") or ""))
            for city in self.saved_cities
        )

    def selected_city_matches(self, city_name: str) -> bool:
        target = norm_city_key(city_name)
        selected = self.selected_city_id
        for city in self.saved_cities:
            if str(city.get("id") or "").strip() == selected:
                return target in norm_city_key(str(city.get("name") or ""))

        entry = self.bundles_by_city_id.get(selected)
        if not isinstance(entry, dict):
            return False
        location_name = norm_city_key(str(entry.get("locationName") or ""))
        return bool(location_name and (target in location_name or location_name in target))

    def pick_city_entry(
        self, city_name: str | None, *, fallback_any: bool = True
    ) -> dict[str, Any]:
        seen: set[str] = set()
        for city_id in self._candidate_city_ids(city_name):
            city_id = str(city_id or "").strip()
            if not city_id or city_id in seen:
                continue
            seen.add(city_id)
            entry = self.bundles_by_city_id.get(city_id)
            if isinstance(entry, dict) and isinstance(entry.get("bundle"), dict):
                return entry

        if fallback_any:
            for entry in self.bundles_by_city_id.values():
                if isinstance(entry, dict) and isinstance(entry.get("bundle"), dict):
                    return entry

        raise ValueError(f"Weather bundle for city '{city_name}' not found in state")

    def city_id_for_name(self, city_name: str | None) -> str:
        entry = self.pick_city_entry(city_name)
        for city_id, candidate in self.bundles_by_city_id.items():
            if candidate is entry:
                return str(city_id)
        raise ValueError(f"Weather city id for '{city_name}' not found in state")

    def city_name_for(self, city_name: str | None) -> str:
        entry = self.pick_city_entry(city_name)
        location_name = str(entry.get("locationName") or "").strip()
        if location_name:
            return location_name
        city_id = self.city_id_for_name(city_name)
        for city in self.saved_cities:
            if str(city.get("id") or "").strip() == city_id:
                name = str(city.get("name") or "").strip()
                if name:
                    return name
        raise ValueError(f"Weather city display name for '{city_name}' not found in state")

    def weather_bundle(self, city_name: str | None) -> dict[str, Any]:
        bundle = self.pick_city_entry(city_name).get("bundle")
        if not isinstance(bundle, dict):
            raise ValueError(f"Weather bundle for city '{city_name}' is invalid")
        return bundle

    def weather_now(self, city_name: str | None) -> dict[str, Any]:
        now = self.weather_bundle(city_name).get("now")
        if not isinstance(now, dict):
            raise ValueError(f"Weather now data for city '{city_name}' is missing")
        return now

    def weather_daily(self, city_name: str | None) -> list[dict[str, Any]]:
        daily = self.weather_bundle(city_name).get("daily")
        if not isinstance(daily, list) or not daily:
            raise ValueError(f"Weather daily data for city '{city_name}' is missing")
        return daily

    def weather_hourly(self, city_name: str | None) -> list[dict[str, Any]]:
        hourly = self.weather_bundle(city_name).get("hourly")
        if not isinstance(hourly, list) or not hourly:
            raise ValueError(f"Weather hourly data for city '{city_name}' is missing")
        return hourly

    def weather_indices(self, city_name: str | None) -> list[dict[str, Any]]:
        indices = self.weather_bundle(city_name).get("indices")
        if not isinstance(indices, list) or not indices:
            raise ValueError(f"Weather indices for city '{city_name}' are missing")
        return indices

    def current_temp(self, city_name: str | None) -> float:
        temp = to_float(self.weather_now(city_name)["temp"])
        if temp is None:
            raise ValueError(f"Current temp for city '{city_name}' is missing")
        return temp

    def hotter_city(self, city1: str, city2: str) -> tuple[str, float, float]:
        """比较两城市当前温度，返回 (winner, temp1, temp2)。

        winner: city1 / city2 / "一样"
        """
        t1 = self.current_temp(city1)
        t2 = self.current_temp(city2)
        if t1 == t2:
            return "一样", t1, t2
        return (city1 if t1 > t2 else city2), t1, t2

    def hotter_city_answer(self, city1: str, city2: str) -> Any:
        """返回可直接用于 judge 的「哪个城市更热」答案。

        平局时返回匹配"一样/相同/差不多"的正则。
        """
        winner, _, _ = self.hotter_city(city1, city2)
        if winner == "一样":
            return re.compile(r"一样|相同|差不多")
        return winner

    def current_temp_str(self, city_name: str | None) -> str:
        """当前温度的整数字符串（四舍五入）。"""
        return str(int(round(self.current_temp(city_name))))

    def current_feels_like_str(self, city_name: str | None) -> str:
        """当前体感温度的整数字符串。"""
        return str(int(round(self.current_feels_like(city_name))))

    def current_humidity_str(self, city_name: str | None) -> str:
        """当前湿度的整数字符串。"""
        return str(int(round(self.current_humidity(city_name))))

    def tomorrow_high_low_str(self, city_name: str | None) -> tuple[str, str]:
        """明天高温/低温的整数字符串 (high, low)。"""
        daily = self.weather_daily(city_name)
        tomorrow = daily[1]
        return (
            str(int(round(float(tomorrow["tempMax"])))),
            str(int(round(float(tomorrow["tempMin"])))),
        )

    def tomorrow_text_day(self, city_name: str | None) -> str:
        """明天白天天气描述文字。"""
        daily = self.weather_daily(city_name)
        return str(daily[1].get("textDay", ""))

    def current_weather_text(self, city_name: str | None) -> str:
        text = str(self.weather_now(city_name)["text"] or "").strip()
        if not text:
            raise ValueError(f"Current weather text for city '{city_name}' is missing")
        return text

    def current_feels_like(self, city_name: str | None) -> float:
        feels_like = to_float(self.weather_now(city_name)["feelsLike"])
        if feels_like is None:
            raise ValueError(f"Current feelsLike for city '{city_name}' is missing")
        return feels_like

    def current_humidity(self, city_name: str | None) -> float:
        humidity = to_float(self.weather_now(city_name)["humidity"])
        if humidity is None:
            raise ValueError(f"Current humidity for city '{city_name}' is missing")
        return humidity

    def current_wind_info(self, city_name: str | None) -> dict[str, Any]:
        now = self.weather_now(city_name)
        wind_speed = to_float(now["windSpeed"])
        wind_dir = str(now["windDir"] or "").strip()
        wind_scale = str(now["windScale"] or "").strip()
        if wind_speed is None or not wind_dir or not wind_scale:
            raise ValueError(f"Current wind info for city '{city_name}' is incomplete")
        return {"dir": wind_dir, "scale": wind_scale, "speed": wind_speed}

    def today_forecast(self, city_name: str | None) -> dict[str, Any]:
        today = self.weather_daily(city_name)[0]
        if not isinstance(today, dict):
            raise ValueError(f"Today's forecast for city '{city_name}' is invalid")
        return today

    def today_sunrise(self, city_name: str | None) -> str:
        sunrise = str(self.today_forecast(city_name)["sunrise"] or "").strip()
        if not sunrise:
            raise ValueError(f"Today's sunrise for city '{city_name}' is missing")
        return sunrise

    def today_uv_index(self, city_name: str | None) -> str:
        uv_index = str(self.today_forecast(city_name)["uvIndex"] or "").strip()
        if not uv_index:
            raise ValueError(f"Today's uvIndex for city '{city_name}' is missing")
        return uv_index

    @staticmethod
    def day_text(day: dict[str, Any]) -> str:
        text = str(day["textDay"]).strip()
        if text:
            return text
        text = str(day["textNight"]).strip()
        if text:
            return text
        raise ValueError(
            f"Daily forecast has no textDay/textNight: {day['fxDate']}"
        )

    def daily_range(self, city_name: str | None, start: int, count: int) -> list[dict[str, Any]]:
        daily = self.weather_daily(city_name)
        picked = daily[start:start + count]
        if len(picked) != count:
            raise ValueError(
                f"Weather daily range for city '{city_name}' is too short: "
                f"start={start}, count={count}, actual={len(picked)}"
            )
        return picked

    def daily_by_date(self, city_name: str | None, target_date: str) -> dict[str, Any]:
        for day in self.weather_daily(city_name):
            if str(day.get("fxDate") or "").startswith(target_date):
                return day
        raise ValueError(f"Daily forecast for city '{city_name}' on '{target_date}' not found")

    def air_quality(self, city_name: str | None) -> dict[str, Any]:
        air_quality = self.weather_bundle(city_name).get("airQuality")
        if not isinstance(air_quality, dict):
            raise ValueError(f"Air quality for city '{city_name}' is missing")
        return air_quality

    def pollutant_value(self, city_name: str | None, code: str) -> str:
        air_quality = self.air_quality(city_name)
        value = str(air_quality[code] or "").strip()
        if not value:
            raise ValueError(f"Pollutant '{code}' for city '{city_name}' is missing")
        return value

    def life_index_by_name(self, city_name: str | None, name: str) -> dict[str, Any]:
        target = norm_city_key(name)
        for index in self.weather_indices(city_name):
            cand = norm_city_key(str(index.get("name") or ""))
            # Real data may contain suffixes like “洗车指数/穿衣指数”.
            if cand and target and (cand == target or target in cand or cand in target):
                return index
        raise ValueError(f"Life index '{name}' for city '{city_name}' not found")

    def city_bundle_now(self, city_name: str | None) -> dict[str, Any]:
        return {
            "cityId": self.city_id_for_name(city_name),
            "city": self.city_name_for(city_name),
            "temp": self.current_temp(city_name),
            "text": self.current_weather_text(city_name),
        }

    def city_tomorrow_high_low(
        self, city_name: str | None, current_ms: int
    ) -> dict[str, Any]:
        daily = self.weather_daily(city_name)
        tomorrow = (
            datetime.date(1970, 1, 1) + datetime.timedelta(milliseconds=current_ms)
            + datetime.timedelta(days=1)
        ).isoformat()
        first_date = parse_date(str(daily[0].get("fxDate") or ""))
        if first_date is not None:
            tomorrow = (first_date + datetime.timedelta(days=1)).isoformat()

        picked = next(
            (day for day in daily if str(day.get("fxDate") or "").startswith(tomorrow)),
            daily[1] if len(daily) >= 2 else daily[0],
        )
        high = to_float(picked["tempMax"])
        low = to_float(picked["tempMin"])
        if high is None or low is None:
            raise ValueError(f"Tomorrow high/low for city '{city_name}' is missing")
        return {
            "cityId": self.city_id_for_name(city_name),
            "city": self.city_name_for(city_name),
            "high": high,
            "low": low,
            "tomorrow": tomorrow,
        }

    @staticmethod
    def is_raining_text(text: str) -> bool:
        raw = str(text or "").strip()
        lowered = norm_city_key(raw)
        return (
            "雨" in raw
            or "rain" in lowered
            or "drizzle" in lowered
            or "thunder" in lowered
        )

    @staticmethod
    def is_cloudy_text(text: str) -> bool:
        raw = str(text or "").strip()
        lowered = norm_city_key(raw)
        return (
            "阴" in raw
            or "多云" in raw
            or "cloud" in lowered
            or "overcast" in lowered
        )

    @staticmethod
    def is_sunny_text(text: str) -> bool:
        raw = str(text or "").strip()
        lowered = norm_city_key(raw)
        return "晴" in raw or "sunny" in lowered or "clear" in lowered

    @staticmethod
    def is_known_weather_text(text: str) -> bool:
        """是否为可识别的天气描述（雨/雪/雾霾/雾/沙尘/风/多云/阴/晴）。"""
        raw = str(text or "").strip()
        if not raw:
            return False
        lowered = norm_city_key(raw)
        return (
            Weather.is_raining_text(raw)
            or Weather.is_cloudy_text(raw)
            or Weather.is_sunny_text(raw)
            or "雪" in raw
            or "snow" in lowered
            or "雾" in raw
            or "fog" in lowered
            or "haze" in lowered
            or "沙尘" in raw
            or "dust" in lowered
            or "sand" in lowered
            or "风" in raw
            or "wind" in lowered
        )

    @staticmethod
    def is_non_sunny_text(text: str) -> bool:
        """已知天气类型且不是晴天。未知/空/脏数据返回 False。"""
        return Weather.is_known_weather_text(text) and not Weather.is_sunny_text(text)

    def weather_type_english(self, city_name: str | None) -> str:
        """Return weather condition in English."""
        text = self.current_weather_text(city_name)
        lowered = norm_city_key(text)
        if self.is_raining_text(text):
            return "Rain"
        if "雪" in text or "snow" in lowered:
            return "Snow"
        if "雾霾" in text or "haze" in lowered:
            return "Haze"
        if "雾" in text or "fog" in lowered:
            return "Fog"
        if "沙尘" in text or "dust" in lowered or "sand" in lowered:
            return "Dust"
        if "风" in text or "wind" in lowered:
            return "Windy"
        if "多云" in text or "partlycloudy" in lowered:
            return "Partly Cloudy"
        if "阴" in text or "cloudy" in lowered or "overcast" in lowered:
            return "Overcast"
        if "晴" in text or "clear" in lowered or "sunny" in lowered:
            return "Clear"
        return text

    def weather_type_chinese(self, city_name: str | None) -> str:
        text = self.current_weather_text(city_name)
        lowered = norm_city_key(text)
        if self.is_raining_text(text):
            return "雨"
        if "雪" in text or "snow" in lowered:
            return "雪"
        if "雾霾" in text or "haze" in lowered:
            return "雾霾"
        if "雾" in text or "fog" in lowered:
            return "雾"
        if "沙尘" in text or "dust" in lowered or "sand" in lowered:
            return "沙尘"
        if "风" in text or "wind" in lowered:
            return "风"
        if "多云" in text or "partlycloudy" in lowered:
            return "多云"
        if "阴" in text or "cloudy" in lowered or "overcast" in lowered:
            return "阴"
        if "晴" in text or "clear" in lowered or "sunny" in lowered:
            return "晴"
        return text

    @staticmethod
    def count_rainy_days(days: list[dict[str, Any]]) -> int:
        """Count days where either textDay or textNight indicates rain."""
        count = 0
        for day in days:
            text_day = str(day.get("textDay") or "").strip()
            text_night = str(day.get("textNight") or "").strip()
            if (text_day and Weather.is_raining_text(text_day)) or (
                text_night and Weather.is_raining_text(text_night)
            ):
                count += 1
        return count

    def non_rainy_dates(
        self,
        city_name: str | None,
        start: int,
        count: int,
    ) -> list[str]:
        """Return ISO dates within the picked daily range whose forecast is not rainy."""
        dates: list[str] = []
        for day in self.daily_range(city_name, start, count):
            text_day = str(day.get("textDay") or "").strip()
            text_night = str(day.get("textNight") or "").strip()
            if (text_day and self.is_raining_text(text_day)) or (
                text_night and self.is_raining_text(text_night)
            ):
                continue
            fx_date = str(day.get("fxDate") or "").strip()
            if not fx_date:
                raise ValueError(f"Daily forecast for city '{city_name}' is missing fxDate")
            dates.append(fx_date)
        return dates

    def first_non_rainy_date(
        self,
        city_name: str | None,
        start: int,
        count: int,
    ) -> str:
        """Return the first ISO date within the picked daily range that is not rainy."""
        dates = self.non_rainy_dates(city_name, start, count)
        if not dates:
            raise ValueError(
                f"No non-rainy day found for city '{city_name}' in range start={start}, count={count}"
            )
        return dates[0]

    def weekend_daily(self, city_name: str | None) -> list[dict[str, Any]]:
        """Return daily forecast entries that fall on Saturday or Sunday."""
        result: list[dict[str, Any]] = []
        for day in self.weather_daily(city_name):
            date_value = parse_date(str(day.get("fxDate") or ""))
            if date_value is not None and date_value.weekday() in (5, 6):
                result.append(day)
        return result

    @staticmethod
    def is_rainy_forecast(day_forecast: dict[str, Any]) -> bool:
        """判断某天 forecast 是否为雨天（白天或夜间任一命中即算）。"""
        td = str(day_forecast.get("textDay") or "").strip()
        tn = str(day_forecast.get("textNight") or "").strip()
        return (bool(td) and Weather.is_raining_text(td)) or (
            bool(tn) and Weather.is_raining_text(tn)
        )

    @staticmethod
    def forecast_text_matches(day_forecast: dict[str, Any], text: str) -> bool:
        """检查 text 中是否包含当天天气描述（textDay 或 textNight 任一命中即可）。"""
        td = str(day_forecast.get("textDay") or "").strip()
        tn = str(day_forecast.get("textNight") or "").strip()
        candidates = [c for c in (td, tn) if c]
        return any(c in text for c in candidates)

    def tomorrow_forecast(self, city_name: str | None) -> dict[str, Any]:
        """按 fxDate 取"明天"的 forecast，不依赖 daily[1] 是明天的假设。"""
        daily = self.weather_daily(city_name)
        if not daily:
            raise ValueError("Weather daily forecast is empty")
        today_str = str(daily[0].get("fxDate") or "").strip()
        if not today_str:
            raise ValueError("Weather daily[0] has no fxDate")
        tomorrow_str = (
            datetime.date.fromisoformat(today_str) + datetime.timedelta(days=1)
        ).isoformat()
        return self.daily_by_date(city_name, tomorrow_str)

    def tomorrow_is_rainy(self, city_name: str | None) -> bool:
        """明天是否下雨（白天或夜间任一命中即算）。"""
        return self.is_rainy_forecast(self.tomorrow_forecast(city_name))

    def is_rainy_on_date(
        self,
        city_name: str | None,
        date_value: str | datetime.date,
        today: datetime.date,
    ) -> bool:
        """指定日期是否下雨（按偏移量索引 daily 数组，today 应来自 sim_today）。"""
        target = date_value if isinstance(date_value, datetime.date) else datetime.date.fromisoformat(str(date_value))
        offset = (target - today).days
        return self.is_rainy_forecast(self.daily_range(city_name, offset, 1)[0])

    @staticmethod
    def temp_range_of_days(days: list[dict[str, Any]]) -> float:
        """Calculate max(tempMax) - min(tempMin) across given days."""
        if not days:
            raise ValueError("No days provided for temp range calculation")
        highs = [float(day["tempMax"]) for day in days]
        lows = [float(day["tempMin"]) for day in days]
        return max(highs) - min(lows)

    @staticmethod
    def hour_from_fx_time(value: Any) -> int | None:
        text = str(value or "")
        matched = re.search(r"T(\d{1,2}):", text)
        if matched:
            try:
                return int(matched.group(1))
            except Exception:
                return None
        matched = re.search(r"\b(\d{1,2}):\d{2}\b", text)
        if matched:
            try:
                return int(matched.group(1))
            except Exception:
                return None
        return None
