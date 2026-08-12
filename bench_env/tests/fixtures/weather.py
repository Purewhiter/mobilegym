"""Shared Weather base-state fixtures (extracted from tests/weather/test_tasks.py)."""

from __future__ import annotations

import copy
import datetime
import json
from pathlib import Path
from typing import Any

TEST_OS_STATE = {"time": {"timestamp": 1742025600000}}
BASE_DATE = datetime.date.fromtimestamp(TEST_OS_STATE["time"]["timestamp"] / 1000.0)


def _load_defaults() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[3] / "apps" / "Weather" / "data" / "defaults.json"
    return json.loads(path.read_text(encoding="utf-8"))


DEFAULTS = _load_defaults()

CITY_CATALOG = {
    "北京": {"id": "beijing", "name": "北京市", "lon": 116.4074, "lat": 39.9042},
    "上海": {"id": "shanghai", "name": "上海市", "lon": 121.4737, "lat": 31.2304},
    "广州": {"id": "guangzhou", "name": "广州市", "lon": 113.2644, "lat": 23.1291},
    "深圳": {"id": "shenzhen", "name": "深圳市", "lon": 114.0579, "lat": 22.5431},
    "杭州": {"id": "hangzhou", "name": "杭州市", "lon": 120.1551, "lat": 30.2741},
    "成都": {"id": "chengdu", "name": "成都市", "lon": 104.0665, "lat": 30.5728},
    "南京": {"id": "nanjing", "name": "南京市", "lon": 118.7969, "lat": 32.0603},
    "武汉": {"id": "wuhan", "name": "武汉市", "lon": 114.3055, "lat": 30.5928},
    "三亚": {"id": "sanya", "name": "三亚市", "lon": 109.5119, "lat": 18.2528},
}

CITY_FIXTURES = {
    "beijing": {
        "short": "北京",
        "temp": 20,
        "feels": 18,
        "humidity": 40,
        "text": "晴",
        "wind_dir": "北风",
        "wind_scale": "3",
        "wind_speed": 12,
        "aqi": 82,
        "wash": "适宜",
        "dress": "舒适",
        "base_high": 20,
        "night_low": 11,
        "rainy": {3, 10},
        "cloudy": {1, 5, 8},
    },
    "shanghai": {
        "short": "上海",
        "temp": 28,
        "feels": 30,
        "humidity": 70,
        "text": "多云",
        "wind_dir": "东风",
        "wind_scale": "4",
        "wind_speed": 18,
        "aqi": 96,
        "wash": "较适宜",
        "dress": "较舒适",
        "base_high": 28,
        "night_low": 20,
        "rainy": {2, 4, 11},
        "cloudy": {0, 6, 7},
    },
    "guangzhou": {
        "short": "广州",
        "temp": 32,
        "feels": 35,
        "humidity": 80,
        "text": "小雨",
        "wind_dir": "南风",
        "wind_scale": "3",
        "wind_speed": 16,
        "aqi": 68,
        "wash": "不宜",
        "dress": "炎热",
        "base_high": 32,
        "night_low": 24,
        "rainy": {0, 1, 2, 5, 6, 7},
        "cloudy": {3, 4},
    },
    "shenzhen": {
        "short": "深圳",
        "temp": 30,
        "feels": 32,
        "humidity": 85,
        "text": "阴",
        "wind_dir": "东南风",
        "wind_scale": "2",
        "wind_speed": 10,
        "aqi": 55,
        "wash": "较适宜",
        "dress": "炎热",
        "base_high": 30,
        "night_low": 23,
        "rainy": {4, 9},
        "cloudy": {1, 2, 5},
    },
    "hangzhou": {
        "short": "杭州",
        "temp": 24,
        "feels": 23,
        "humidity": 55,
        "text": "晴",
        "wind_dir": "西风",
        "wind_scale": "2",
        "wind_speed": 9,
        "aqi": 72,
        "wash": "适宜",
        "dress": "舒适",
        "base_high": 24,
        "night_low": 15,
        "rainy": {6, 12},
        "cloudy": {0, 3, 4},
    },
    "chengdu": {
        "short": "成都",
        "temp": 18,
        "feels": 16,
        "humidity": 65,
        "text": "小雨",
        "wind_dir": "东北风",
        "wind_scale": "2",
        "wind_speed": 8,
        "aqi": 88,
        "wash": "不宜",
        "dress": "偏凉",
        "base_high": 18,
        "night_low": 8,
        "rainy": {0, 1, 8, 9, 10, 11},
        "cloudy": {2, 3, 4, 5},
    },
    "nanjing": {
        "short": "南京",
        "temp": 27,
        "feels": 29,
        "humidity": 60,
        "text": "多云",
        "wind_dir": "西南风",
        "wind_scale": "3",
        "wind_speed": 14,
        "aqi": 77,
        "wash": "较适宜",
        "dress": "舒适",
        "base_high": 27,
        "night_low": 18,
        "rainy": {5, 13},
        "cloudy": {2, 6, 7},
    },
    "wuhan": {
        "short": "武汉",
        "temp": 29,
        "feels": 31,
        "humidity": 75,
        "text": "晴",
        "wind_dir": "东南风",
        "wind_scale": "3",
        "wind_speed": 15,
        "aqi": 91,
        "wash": "较适宜",
        "dress": "较热",
        "base_high": 29,
        "night_low": 21,
        "rainy": {1, 8},
        "cloudy": {3, 4, 5},
    },
    "sanya": {
        "short": "三亚",
        "temp": 33,
        "feels": 36,
        "humidity": 78,
        "text": "晴",
        "wind_dir": "东风",
        "wind_scale": "4",
        "wind_speed": 22,
        "aqi": 42,
        "wash": "适宜",
        "dress": "炎热",
        "base_high": 33,
        "night_low": 25,
        "rainy": {14},
        "cloudy": {1},
    },
}


def _daily_entries(city_id: str) -> list[dict[str, Any]]:
    cfg = CITY_FIXTURES[city_id]
    pattern = [0, 2, 4, 5, 3, 2, 1, 0, -1, -2, -3, -4, -5, -6, -7]
    result = []
    for idx, delta in enumerate(pattern):
        date_value = BASE_DATE + datetime.timedelta(days=idx)
        text = "小雨" if idx in cfg["rainy"] else "多云" if idx in cfg["cloudy"] else "晴"
        high = cfg["base_high"] + delta
        low = high - 10
        precip = 6 if text == "小雨" else 1 if text == "多云" else 0
        result.append({
            "fxDate": date_value.isoformat(),
            "sunrise": "06:12",
            "sunset": "18:21",
            "moonrise": "19:00",
            "moonset": "06:00",
            "moonPhase": "盈凸月",
            "moonPhaseIcon": "801",
            "tempMax": str(high),
            "tempMin": str(low),
            "iconDay": "100",
            "textDay": text,
            "iconNight": "150",
            "textNight": text,
            "wind360Day": "90",
            "windDirDay": cfg["wind_dir"],
            "windScaleDay": cfg["wind_scale"],
            "windSpeedDay": str(cfg["wind_speed"]),
            "wind360Night": "90",
            "windDirNight": cfg["wind_dir"],
            "windScaleNight": cfg["wind_scale"],
            "windSpeedNight": str(max(cfg["wind_speed"] - 2, 1)),
            "humidity": str(cfg["humidity"]),
            "precip": str(precip),
            "pressure": "1012",
            "vis": "18",
            "cloud": "30",
            "uvIndex": "7" if text == "晴" else "4" if text == "多云" else "2",
        })
    return result


def _hourly_entries(city_id: str) -> list[dict[str, Any]]:
    cfg = CITY_FIXTURES[city_id]
    result = []
    for hour in range(24):
        if hour < 6:
            temp = cfg["night_low"] + max(0, hour - 2)
        elif hour < 12:
            temp = cfg["temp"] - 2 + (hour - 6)
        elif hour < 18:
            temp = cfg["temp"] + 4 - (hour - 12)
        else:
            temp = cfg["night_low"] + max(0, 23 - hour)
        text = "小雨" if hour in (19, 20) and city_id in {"guangzhou", "chengdu"} else cfg["text"]
        result.append({
            "fxTime": f"{BASE_DATE.isoformat()}T{hour:02d}:00+08:00",
            "temp": str(temp),
            "icon": "100",
            "text": text,
            "wind360": "90",
            "windDir": cfg["wind_dir"],
            "windScale": cfg["wind_scale"],
            "windSpeed": str(cfg["wind_speed"]),
            "humidity": str(cfg["humidity"]),
            "pop": "30" if text == "小雨" else "0",
            "precip": "2" if text == "小雨" else "0",
            "pressure": "1012",
            "cloud": "30",
            "dew": "10",
        })
    return result


def _indices_entries(city_id: str) -> list[dict[str, Any]]:
    cfg = CITY_FIXTURES[city_id]
    date_value = BASE_DATE.isoformat()
    return [
        {"date": date_value, "type": "1", "name": "运动", "level": "3", "category": "较适宜", "text": "适合轻度运动"},
        {"date": date_value, "type": "2", "name": "洗车", "level": "2", "category": cfg["wash"], "text": f"洗车指数{cfg['wash']}"},
        {"date": date_value, "type": "3", "name": "穿衣", "level": "2", "category": cfg["dress"], "text": f"穿衣指数{cfg['dress']}"},
        {"date": date_value, "type": "5", "name": "紫外线", "level": "3", "category": "中等", "text": "注意防晒"},
        {"date": date_value, "type": "9", "name": "感冒", "level": "1", "category": "少发", "text": "感冒风险低"},
    ]


def _air_quality_entry(city_id: str) -> dict[str, Any]:
    cfg = CITY_FIXTURES[city_id]
    aqi = cfg["aqi"]
    return {
        "pubTime": f"{BASE_DATE.isoformat()}T08:00+08:00",
        "aqi": str(aqi),
        "level": "2",
        "category": "良" if aqi <= 100 else "轻度",
        "primaryPollutant": "PM2.5",
        "pm10": str(aqi + 10),
        "pm2p5": str(aqi - 10),
        "no2": str(aqi - 20),
        "so2": str(aqi - 30),
        "co": "0.8",
        "o3": str(aqi - 15),
    }


def _bundle_entry(city_id: str) -> dict[str, Any]:
    catalog = next(item for item in CITY_CATALOG.values() if item["id"] == city_id)
    cfg = CITY_FIXTURES[city_id]
    return {
        "updatedAt": TEST_OS_STATE["time"]["timestamp"] - 60_000,
        "lonLat": f"{catalog['lon']},{catalog['lat']}",
        "locationName": cfg["short"],
        "bundle": {
            "now": {
                "obsTime": f"{BASE_DATE.isoformat()}T09:00+08:00",
                "temp": str(cfg["temp"]),
                "feelsLike": str(cfg["feels"]),
                "icon": "100",
                "text": cfg["text"],
                "wind360": "90",
                "windDir": cfg["wind_dir"],
                "windScale": cfg["wind_scale"],
                "windSpeed": str(cfg["wind_speed"]),
                "humidity": str(cfg["humidity"]),
                "precip": "0",
                "pressure": "1012",
                "vis": "18",
                "cloud": "30",
                "dew": "10",
            },
            "daily": _daily_entries(city_id),
            "hourly": _hourly_entries(city_id),
            "indices": _indices_entries(city_id),
            "warnings": [],
            "airQuality": _air_quality_entry(city_id),
            "minutely": None,
        },
    }


ALL_BUNDLES = {city_id: _bundle_entry(city_id) for city_id in CITY_FIXTURES}


def _build_base_state() -> dict[str, Any]:
    state = copy.deepcopy(DEFAULTS)
    state["version"] = 1
    state["selectedCityId"] = "beijing"
    state["bundlesByCityId"] = copy.deepcopy(ALL_BUNDLES)
    state["searchHistory"] = []
    return state


BASE_STATE = _build_base_state()
