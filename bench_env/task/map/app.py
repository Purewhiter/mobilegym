"""
Map app state accessor.
"""

from __future__ import annotations

import json
import math
import random
import re
from pathlib import Path
from typing import Any, ClassVar

from bench_env.task.base import BaseApp
from bench_env.task.common_tasks import build_answer_checks, match_duration, normalize_text
from bench_env.task.utils import (
    city_aliases,
    norm,
    parse_distance_to_meters,
    strip_postal_suffix,
)

CATEGORY_PARAM = {
    "type": "enum",
    "values": {
        "餐馆": "餐馆",
        "咖啡馆": "咖啡馆",
        "购物中心": "购物中心",
        "加油站": "加油站",
        "超市": "超市",
        "酒店": "酒店",
        "麦当劳": "麦当劳",
        "肯德基": "肯德基",
        "必胜客": "必胜客",
    },
    "default": "咖啡馆",
    "description": "分类名称",
}

RADIUS_PARAM = {
    "type": "enum",
    "values": {
        "2公里": 2000,
        "3公里": 3000,
    },
    "default": 2000,
    "description": "搜索半径（米）",
}

PLACE_PARAM = {
    "type": "enum",
    "values": {
        "故宫": "故宫",
        "圆明园": "圆明园",
        "颐和园": "颐和园",
        "国家图书馆": "国家图书馆",
        "中国国家博物馆": "中国国家博物馆",
        "万柳的北京华联": "北京华联",
    },
    "default": "故宫",
    "description": "地点名称",
}

RESTAURANT_PARAM = {
    "type": "enum",
    "values": {
        "湘临天下酒楼": "湘临天下酒楼",
        "最近的眉州东坡酒楼": "眉州东坡酒楼",
        "沸腾鱼乡西直门分店": "沸腾鱼乡西直门分店",
    },
    "default": "沸腾鱼乡西直门分店",
    "description": "餐馆名称",
}

# 注册表：搜索词 → 要从结果 name 中剔除的关键词。
# places.json.search_index 的品牌词（肯德基/麦当劳等）会命中副品牌 POI（甜品站、宅急送、Select 等）。
# Map App UI 保留这些结果是合理的（用户搜品牌看到副品牌符合直觉），但判题语义下
# 「评分最高的肯德基」默认应指主营门店。geo_search 在未显式指定 excludes 时查此表。
SEARCH_EXCLUDES: dict[str, tuple[str, ...]] = {
    "肯德基": ("甜品站", "宅急送", "Select"),
    "麦当劳": ("甜品站",),
    "必胜客": ("宅急送",),
}

# Sentinel：区分"不传 excludes"（查注册表）与"传 None"（显式关闭过滤）。
_USE_REGISTERED_EXCLUDES: Any = object()


PLACE_QUERY_ALIASES: dict[str, tuple[str, ...]] = {
    "故宫": ("故宫博物院", "故宫"),
    # 搜索「天安门」时首条常为「天安门广场」；离线 routes 中驾车段多挂在此 POI 上
    "天安门": ("天安门广场", "天安门"),
    "圆明园": ("圆明园遗址公园", "圆明园"),
    "颐和园": ("颐和园",),
    "国家图书馆": ("中国国家图书馆", "国家图书馆"),
    "中国国家博物馆": ("中国国家博物馆",),
    "国家博物馆": ("中国国家博物馆", "国家博物馆"),
    "北京华联": ("北京华联（万柳购物中心）",),
    "湘临天下酒楼": ("湘临天下酒楼",),
    "眉州东坡酒楼": ("眉州东坡酒楼（中关村店）",),
    "沸腾鱼乡西直门分店": ("沸腾鱼乡西直门分店",),
}

# OD 对白名单：routes.json 中存在对应 origin>dest>DRIVING 段的地名组合。
# CheckRouteSuccess 采样和判题均从此列表取值，确保任务参数一定有离线路段。
DRIVING_OD_PAIRS: list[tuple[str, str]] = [
    ("故宫", "天安门广场"),
    ("颐和园", "圆明园"),
    ("故宫", "国家图书馆"),
    ("国家图书馆", "颐和园"),
]


_MAP_DATA_DIR = Path(__file__).resolve().parents[3] / "apps" / "Map" / "data"
_MAP_PLACES_PATH = _MAP_DATA_DIR / "places.json"
_MAP_ROUTES_PATH = _MAP_DATA_DIR / "routes.json"

# 模拟器默认设备位置（与 os/data/simulatorConfig.ts 一致）
DEFAULT_DEVICE_LOCATION: tuple[float, float] = (39.9794688, 116.3323982)


def _haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine 公式计算两点球面距离（米），与前端 haversineDistance 一致。"""
    R = 6_371_000
    to_rad = math.radians
    d_lat = to_rad(lat2 - lat1)
    d_lng = to_rad(lng2 - lng1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)) * math.sin(d_lng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

#
# Map tasks: generic robustness helpers
# (Used by bench_env/task/map/tasks.py; kept here per convention.)
#
_MAP_NUM_RE = re.compile(r"(-?\d+(?:\.\d+)?)")
_MAP_NO_RATING_KEYWORDS = ("无评分", "暂无评分", "没有评分", "不详", "未知")

MAP_SEARCH_CHANGES = ["map.searchHistory", "map.currentView"]



def digits_only(s: Any) -> str:
    return "".join(re.findall(r"\d+", str(s or "")))


def normalize_address_for_cmp(s: Any) -> str:
    text = str(s or "").strip()
    text = text.replace("前门", "")
    text = text.replace(" ", "")
    text = re.sub(r"[，,、。.;；:：…\[\]（）(){}<>《》“”\"'`~!@#$%^&*_+=?|\\/-]+", "", text)
    return text


def _normalize_loose_match_text(s: Any) -> str:
    """名称/地址子串匹配：中文数字归一化后去空格与常见中英文标点、括号（与 check_answer_match 一致）。"""
    t = normalize_text(str(s or ""))
    t = t.strip().replace(" ", "").replace("\u3000", "")
    t = re.sub(r"[，,、。.;；:：…\[\]（）(){}<>《》""\"'`~!@#$%^&*_+=?|\\/-]+", "", t)
    return t

_ANSWER_NORMALIZE_RE = re.compile(
    r"[\s,，。.;；、:：()\[\]{}<>《》“”\"'`~!@#$%^&*_+=?|\\/-]+",
)
_DISTANCE_TOKEN_RE = re.compile(r"(\d+(?:\.\d+)?)\s*(公里|km|米|m|mi|mile)", re.I)


def _normalize_answer_text(text: Any) -> str:
    return _ANSWER_NORMALIZE_RE.sub("", str(text))


def _extract_distance_candidates(text: Any) -> list[float]:
    candidates: list[float] = []
    for matched in _DISTANCE_TOKEN_RE.finditer(str(text or "")):
        meters = parse_distance_to_meters(matched.group(0))
        if meters is not None:
            candidates.append(meters)
    return candidates


# CompareRouteDuration：显式「更快/更省/更短」结论，避免「开车约18分钟」等纯时长子串误命中
_FASTER_DRIVE_CLAIM_RE = re.compile(
    r"(?:驾车|开车|自驾|驾驶)\s*(?:比(?:步行|走路))?\s*(?:更快|较快|省时|省时间|更省|时间更短|较短|更短|少些)"
    r"|(?:更快|更短|省时|省时间)(?:的)?(?:是|为)?\s*(?:驾车|开车|自驾|驾驶)"
)
_FASTER_WALK_CLAIM_RE = re.compile(
    r"(?:步行|走路)\s*(?:比(?:驾车|开车|自驾|驾驶))?\s*(?:更快|较快|省时|省时间|更省|时间更短|较短|更短|少些)"
    r"|(?:更快|更短|省时|省时间)(?:的)?(?:是|为)?\s*(?:步行|走路)"
)
_EQUAL_DURATION_ANSWER_RE = re.compile(r"一样|相同|差不多|相当|同等")


class Map(BaseApp):
    """
    Map app state accessor.
    
    Wraps the raw state dictionary from the Map app context.
    Note: POI and Route data are mostly transient in this app.
    Tasks relying on POI details must assume the 'currentView' or similar
    mechanism exposes the necessary info if the agent has navigated there.
    """

    _places_cache: ClassVar[dict[str, Any] | None] = None
    _routes_cache: ClassVar[dict[str, Any] | None] = None

    @staticmethod
    def sample_driving_od(env_state: dict, rng: random.Random) -> dict[str, str]:
        oh, dh = rng.choice(DRIVING_OD_PAIRS)
        return {"origin": oh, "destination": dh}

    @classmethod
    def _load_places(cls) -> dict[str, Any]:
        if cls._places_cache is None:
            cls._places_cache = json.loads(_MAP_PLACES_PATH.read_text(encoding="utf-8"))
        return cls._places_cache

    @classmethod
    def _load_routes(cls) -> dict[str, Any]:
        if cls._routes_cache is None:
            cls._routes_cache = json.loads(_MAP_ROUTES_PATH.read_text(encoding="utf-8"))
        return cls._routes_cache

    @staticmethod
    def _pick_zh_text(value: Any) -> str:
        if isinstance(value, dict):
            for key in ("zh", "text", "name"):
                text = value.get(key)
                if text:
                    return str(text)
            for text in value.values():
                if text:
                    return str(text)
            return ""
        return str(value or "")

    @staticmethod
    def _normalize_place(raw: dict[str, Any]) -> dict[str, Any]:
        details = raw.get("details")
        details_dict = details if isinstance(details, dict) else {}
        location = raw.get("location")
        if not isinstance(location, dict):
            location = details_dict.get("location")
        latitude = raw.get("lat")
        longitude = raw.get("lng")
        if latitude is None and isinstance(location, dict):
            latitude = location.get("latitude")
        if longitude is None and isinstance(location, dict):
            longitude = location.get("longitude")

        formatted_address = Map._pick_zh_text(
            raw.get("formattedAddress")
            or raw.get("formatted_address")
            or details_dict.get("formattedAddress")
        )
        phone = (
            # 任务 judge 这里对齐前端详情页口径：优先详情中的国内号码。
            details_dict.get("nationalPhoneNumber")
            or raw.get("nationalPhoneNumber")
            or details_dict.get("internationalPhoneNumber")
            or raw.get("internationalPhoneNumber")
            or raw.get("formatted_phone_number")
        )
        return {
            "place_id": raw.get("placeId") or raw.get("place_id") or raw.get("id"),
            "name": Map._pick_zh_text(raw.get("name") or details_dict.get("displayName")),
            "lat": latitude,
            "lng": longitude,
            "rating": raw.get("rating", details_dict.get("rating")),
            "user_ratings_total": raw.get("userRatingCount", details_dict.get("userRatingCount")),
            "types": raw.get("types") or details_dict.get("types") or [],
            "primary_type": raw.get("primaryType") or details_dict.get("primaryType"),
            "formatted_address": formatted_address,
            "address": formatted_address,
            "formatted_phone_number": str(phone).strip() if phone else None,
            "distance_meters": raw.get("distanceMeters", raw.get("distance_meters")),
        }

    @staticmethod
    def _normalize_route(raw: dict[str, Any]) -> dict[str, Any]:
        steps: list[dict[str, Any]] = []
        for step in raw.get("steps") or []:
            if not isinstance(step, dict):
                continue
            steps.append(
                {
                    "instruction": Map._pick_zh_text(step.get("instruction")),
                    "distance": Map._pick_zh_text(step.get("distance")),
                    "distance_meters": step.get("distanceMeters", step.get("distance_meters")),
                    "maneuver": step.get("maneuver"),
                }
            )
        return {
            "mode": raw.get("mode"),
            "duration": Map._pick_zh_text(raw.get("duration")),
            "distance": Map._pick_zh_text(raw.get("distance")),
            "distance_meters": raw.get("distance_meters", raw.get("distanceMeters")),
            "duration_seconds": raw.get("duration_seconds", raw.get("durationSeconds")),
            "steps": steps,
        }

    # 前端默认每页条数，与 offlinePlaceStore.ts pageSize 一致
    SEARCH_PAGE_SIZE: ClassVar[int] = 20

    @classmethod
    def geo_search(
        cls,
        query: str,
        *,
        limit: int | None = None,
        origin: tuple[float, float] | None = DEFAULT_DEVICE_LOCATION,
        excludes: Any = _USE_REGISTERED_EXCLUDES,
    ) -> list[dict[str, Any]]:
        """搜索 POI，保持 search_index 原始顺序（与前端一致）。

        *limit* 默认为 ``SEARCH_PAGE_SIZE``（20），与前端首页条数一致；
        传 ``0`` 返回全部结果。
        *origin* 为设备位置 (lat, lng)，用于计算 distance_meters（与前端 haversine 一致），
        默认使用模拟器配置的北京海淀位置。

        *excludes* — 名字含任一关键词的 POI 会被剔除：
        * 默认（不传）：查 :data:`SEARCH_EXCLUDES` 注册表
        * ``None``：不过滤，返回原始结果
        * ``tuple[str, ...]`` 等 iterable：使用指定关键词（不支持裸字符串，
          会被视为字符序列，请用 ``("甜品站",)`` 而非 ``"甜品站"``）
        """
        if limit is None:
            limit = cls.SEARCH_PAGE_SIZE
        places_data = cls._load_places()
        index = places_data.get("search_index") or {}
        place_ids = index.get(query)
        if not isinstance(place_ids, list) or not place_ids:
            return []
        if limit > 0:
            place_ids = place_ids[:limit]
        place_ids = [str(pid) for pid in place_ids]
        places = places_data.get("places") or {}
        results: list[dict[str, Any]] = []
        for place_id in place_ids:
            raw = places.get(place_id)
            if not isinstance(raw, dict):
                continue
            result = cls._normalize_place(raw)
            # 如果原始数据没有 distance 但有坐标和 origin，haversine 补算
            if result.get("distance_meters") is None and origin is not None:
                lat, lng = result.get("lat"), result.get("lng")
                if lat is not None and lng is not None:
                    result["distance_meters"] = round(
                        _haversine_meters(origin[0], origin[1], float(lat), float(lng))
                    )
            results.append(result)
        if excludes is _USE_REGISTERED_EXCLUDES:
            excludes = SEARCH_EXCLUDES.get(query)
        if isinstance(excludes, str):
            raise TypeError(
                "excludes must be None or an iterable of strings, not a bare str; "
                "use a tuple like ('甜品站',) instead"
            )
        if excludes:
            keywords = tuple(excludes)
            results = [
                r for r in results
                if not any(kw in (r.get("name") or "") for kw in keywords)
            ]
        return results

    @classmethod
    def resolve_places(cls, query: str) -> list[dict[str, Any]]:
        """按固定地点 alias 语义解析 query，返回所有可接受候选。"""
        results = cls.geo_search(query, limit=0)
        if not results:
            raise ValueError(f"no geo results for query {query!r}")
        aliases = PLACE_QUERY_ALIASES.get(query)
        if aliases:
            matched: list[dict[str, Any]] = []
            for alias in aliases:
                alias_norm = norm(alias)
                matched.extend(
                    result
                    for result in results
                    if isinstance(result, dict)
                    and norm(result.get("name") or "") == alias_norm
                )
            if not matched:
                raise ValueError(f"no alias-matched place for query {query!r}")
            return matched

        target = norm(query)
        exact = [
            result
            for result in results
            if isinstance(result, dict) and norm(result.get("name") or "") == target
        ]
        if exact:
            return exact

        fuzzy = [
            result
            for result in results
            if isinstance(result, dict)
            and target
            and (
                target in norm(result.get("name") or "")
                or norm(result.get("name") or "") in target
            )
        ]
        if fuzzy:
            return [fuzzy[0]]
        raise ValueError(f"place not found for query {query!r}")

    @classmethod
    def geo_resolve(cls, query: str) -> tuple[str, float, float, str]:
        place = cls.resolve_places(query)[0]
        place_id = place.get("place_id")
        lat = place.get("lat")
        lng = place.get("lng")
        name = place.get("name")
        if place_id is None or lat is None or lng is None or not name:
            raise ValueError(f"incomplete geo data for query {query!r}")
        return str(place_id), float(lat), float(lng), str(name)

    @classmethod
    def resolve_routes_from_current(
        cls,
        query: str,
        mode: str,
    ) -> list[tuple[dict[str, Any], dict[str, Any]]]:
        out: list[tuple[dict[str, Any], dict[str, Any]]] = []
        for place in cls.resolve_places(query):
            place_id = place.get("place_id")
            if place_id is None:
                raise ValueError(f"resolved place missing place_id for query {query!r}")
            out.append((place, cls.geo_route_from_current(str(place_id), mode)))
        return out

    @classmethod
    def resolve_route_pairs(
        cls,
        origin_query: str,
        destination_query: str,
        mode: str,
    ) -> list[tuple[dict[str, Any], dict[str, Any], dict[str, Any]]]:
        """枚举起终点解析候选，仅保留 ``routes.json`` 中存在的 ``origin>dest>mode`` 段。

        同一地名常有多 POI；离线数据未必为每一对都提供路段，缺失则跳过，避免
        ``CheckRouteSuccess`` 等任务在首个缺失组合上抛错。
        """
        out: list[tuple[dict[str, Any], dict[str, Any], dict[str, Any]]] = []
        for origin in cls.resolve_places(origin_query):
            origin_id = origin.get("place_id")
            if origin_id is None:
                raise ValueError(f"resolved origin missing place_id for query {origin_query!r}")
            for destination in cls.resolve_places(destination_query):
                destination_id = destination.get("place_id")
                if destination_id is None:
                    raise ValueError(
                        f"resolved destination missing place_id for query {destination_query!r}"
                    )
                try:
                    route = cls.geo_route_between(str(origin_id), str(destination_id), mode)
                except ValueError:
                    continue
                out.append((origin, destination, route))
        if not out:
            raise ValueError(
                f"no offline {mode} route for any resolved pair: "
                f"{origin_query!r} -> {destination_query!r}"
            )
        return out

    @classmethod
    def geo_route_from_current(cls, place_id: str, mode: str) -> dict[str, Any]:
        routes = cls._load_routes().get("routes") or {}
        raw = routes.get(f"current>{place_id}>{mode}")
        if not isinstance(raw, dict):
            raise ValueError(f"offline {mode} route missing for place_id={place_id!r}")
        return cls._normalize_route(raw)

    @classmethod
    def geo_route_between(
        cls,
        origin_id: str,
        dest_id: str,
        mode: str,
    ) -> dict[str, Any]:
        routes = cls._load_routes().get("routes") or {}
        raw = routes.get(f"{origin_id}>{dest_id}>{mode}")
        if not isinstance(raw, dict):
            raise ValueError(f"offline {mode} route missing for {origin_id!r} -> {dest_id!r}")
        return cls._normalize_route(raw)

    @classmethod
    def geo_route_to(cls, place_query: str, mode: str) -> dict[str, Any]:
        resolved = cls.geo_resolve(place_query)
        return cls.geo_route_from_current(resolved[0], mode)

    # =========================================================================
    # POI field extraction (raise on missing)
    # =========================================================================

    @staticmethod
    def extract_rating(place: dict[str, Any]) -> float:
        """从 POI dict 中提取评分，缺失则 raise。"""
        rating = place.get("rating")
        if rating is None:
            raise ValueError(f"rating missing for place {place.get('name')!r}")
        return float(rating)

    @staticmethod
    def extract_address(place: dict[str, Any]) -> str:
        """从 POI dict 中提取地址（去邮编后缀、去开头"中国"前缀），缺失则 raise。"""
        addr = place.get("formatted_address") or place.get("address")
        if not addr:
            raise ValueError(f"address missing for place {place.get('name')!r}")
        raw = strip_postal_suffix(str(addr).strip())
        # 中国境内地址常以"中国"开头，Agent 通常省略该前缀，统一去掉以兼容两种写法
        if raw.startswith("中国"):
            raw = raw[2:].lstrip()
        return raw

    @staticmethod
    def extract_phone(place: dict[str, Any]) -> str | None:
        """从 POI dict 中提取电话，缺失则返回 None。"""
        phone = place.get("formatted_phone_number")
        return str(phone).strip() if phone else None

    # =========================================================================
    # User properties
    # =========================================================================

    @property
    def user(self) -> dict[str, Any]:
        """Current user object."""
        return self.get("user", {})

    @property
    def user_name(self) -> str:
        return self.user.get("name", "")

    @property
    def favorite_place_count(self) -> int:
        return int(self.get("user.lists.favorites.count"))

    # =========================================================================
    # Search History
    # =========================================================================

    @property
    def search_history(self) -> list[dict[str, Any]]:
        """Search history list."""
        return self.get_list("searchHistory")

    def _new_search_entries(self) -> list[dict[str, Any]]:
        """返回本次任务中新增的 searchHistory 条目。

        对比 init 与 current searchHistory，返回 current 中 id 不在 init 里的条目。
        """
        init_ids = {
            item.get("id") for item in self.init.search_history
        }
        return [
            item for item in self.search_history
            if item.get("id") not in init_ids
        ]

    def has_new_search(self) -> bool:
        """Agent 是否在本次任务中执行了新搜索。"""
        return len(self._new_search_entries()) > 0

    def check_searched(
        self,
        *,
        category: str | None = None,
        field: str = "search.performed",
    ) -> dict[str, Any]:
        """验证 Agent 是否执行了相关搜索。

        不传 category 时只检查是否有新搜索。
        传 *category*（如 ``"restaurant"``）时，要求新搜索记录里包含对应的
        中文关键词（``"餐馆"``），来自 ``CATEGORY_PARAM`` 的反转。
        """
        new_entries = self._new_search_entries()
        if not new_entries:
            return {
                "field": field,
                "expected": "Agent 执行了新的搜索操作",
                "actual": "未执行新的搜索",
                "passed": False,
            }

        new_texts = [e.get("text", "") for e in new_entries]

        if category is None:
            return {
                "field": field,
                "expected": "Agent 执行了新的搜索操作",
                "actual": f"搜索记录: {new_texts}",
                "passed": True,
            }

        matched = any(category in text for text in new_texts)
        return {
            "field": field,
            "expected": f"搜索了「{category}」",
            "actual": f"搜索记录: {new_texts}",
            "passed": matched,
        }

    def check_searched_for_place(
        self, place: str, *, field: str = "map_search"
    ) -> dict[str, Any]:
        """验证 Agent 是否搜索了指定地点（结果或活跃 POI 包含地点名）。"""
        searched = self.has_new_search()
        results = self.search_results
        active = self.active_poi
        place_in_results = any(place in str(r["name"]) for r in results)
        place_in_active = isinstance(active, dict) and place in str(active["name"])
        active_name = active["name"] if isinstance(active, dict) else None
        return {
            "field": field,
            "expected": f"searched for {place!r}",
            "actual": (
                f"searched={searched}, results={len(results)}, active={active_name}"
            ),
            "passed": searched and (place_in_results or place_in_active),
        }

    def route_info(self, mode: str, info: str) -> str:
        """获取路线模式（DRIVING/TRANSIT）的距离或时间值。"""
        modes = self.route_modes["modes"]
        mode_key = mode.upper()
        mode_data = modes[mode_key]
        return str(mode_data[info])

    # =========================================================================
    # Transient View State
    # =========================================================================
    # The current Map app exports a runtime-only `currentView` snapshot via
    # app state. It is not persisted, and tasks that rely on it should fail
    # closed when the relevant sub-state is missing instead of fabricating a
    # placeholder answer.
    
    @property
    def current_view(self) -> dict[str, Any]:
        """
        Represents the current page's local state.
        This is populated if the environment captures page-level state.
        """
        return self.get("currentView", {})

    @property
    def active_poi(self) -> dict[str, Any] | None:
        """Currently selected POI (if on detail page)."""
        # Assuming detail page writes to this key or similar
        return self.current_view.get("poi", None)

    @property
    def active_route(self) -> dict[str, Any] | None:
        """Currently active route (if navigating)."""
        return self.current_view.get("route", None)
        
    @property
    def search_results(self) -> list[dict[str, Any]]:
        """Current search results list."""
        return self.current_view.get("searchResults", [])

    @property
    def route_modes(self) -> dict[str, Any]:
        value = self.current_view.get("routeModes")
        return value if isinstance(value, dict) else {}

    # =========================================================================
    # Settings
    # =========================================================================
    # Nested under state.settings with structure:
    #   appDisplay, navigation, locationPrivacy, offlineMaps,
    #   notifications.traffic, notifications.recommendations
    
    @property
    def settings(self) -> dict[str, Any]:
        return self.get("settings", {})

    def get_setting(self, key: str, default: Any = None) -> Any:
        # Support dot notation for nested settings
        keys = key.split('.')
        val = self.settings
        for k in keys:
            if isinstance(val, dict):
                val = val.get(k)
            else:
                return default
        return val if val is not None else default

    @staticmethod
    def _parse_distance_value(item: dict[str, Any]) -> float:
        """Extract distance in meters from a place dict."""
        dist = item.get("distance_meters")
        if dist is not None:
            return float(dist)
        # distance 字段可能是格式化文本如 "1.4km"
        dist_text = item.get("distance")
        if dist_text is not None:
            parsed = parse_distance_to_meters(dist_text)
            if parsed is not None:
                return parsed
        raise ValueError(f"place {item.get('name')!r} has no distance data")

    @staticmethod
    def best_rated_from_results(
        results: list[dict[str, Any]],
        max_distance_meters: float | None = None,
    ) -> dict[str, Any]:
        """评分最高的地点；同分时取距离最近的。"""
        rated = Map.filter_results(
            results,
            max_distance_meters=max_distance_meters,
            rated_only=True,
        )
        if not rated:
            raise ValueError("no rated place found in search results")
        rated = sorted(rated, key=lambda r: (-float(r["rating"]), Map._parse_distance_value(r)))
        best = rated[0]
        if not best.get("name"):
            raise ValueError("no rated place found in search results")
        return best

    @staticmethod
    def nearest_from_results(
        results: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """距离最近的 POI。"""
        valid = [r for r in results if isinstance(r, dict) and r.get("name")]
        if not valid:
            raise ValueError("no nearest place found in search results")
        return min(valid, key=Map._parse_distance_value)

    @staticmethod
    def nearest_rated_from_results(
        results: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """距离最近且有评分的 POI。"""
        rated = Map.filter_results(results, rated_only=True)
        valid = [r for r in rated if r.get("name")]
        if not valid:
            raise ValueError("no nearest rated place found in search results")
        return min(valid, key=Map._parse_distance_value)

    @staticmethod
    def rating_rank_from_results(
        results: list[dict[str, Any]],
        name_hint: str,
        max_distance_meters: float | None = None,
        min_results: int = 1,
        *,
        place_id: str | None = None,
    ) -> int:
        """Competition ranking：严格超过的数量 + 1（允许并列）。

        *place_id* 指定时精确查找目标评分；否则按 name_hint 子串匹配。
        """
        rated = Map.filter_results(
            results,
            max_distance_meters=max_distance_meters,
            rated_only=True,
        )
        if not rated:
            raise ValueError("no rated search results")
        if len(rated) < min_results:
            raise ValueError(
                f"insufficient rated results for ranking: got {len(rated)}, need >= {min_results}"
            )
        # Find target rating
        target_rating: float | None = None
        if place_id:
            for item in rated:
                if item.get("place_id") == place_id:
                    target_rating = float(item["rating"])
                    break
        if target_rating is None:
            target = norm(name_hint)
            for item in rated:
                name = norm(item.get("name") or "")
                if target and (target in name or name in target):
                    target_rating = float(item["rating"])
                    break
        if target_rating is None:
            raise ValueError(f"rank not found for place {name_hint!r}")
        # Competition ranking: count strictly higher + 1
        higher = sum(1 for item in rated if float(item["rating"]) > target_rating)
        return higher + 1


    @staticmethod
    def _route_name_matches(hint: str, actual_name: Any) -> bool:
        target = norm(hint)
        actual = norm(actual_name)
        return bool(target and actual and (target in actual or actual in target))

    def _route_summary(self) -> dict[str, Any]:
        route = self.active_route
        if not isinstance(route, dict):
            return {"mode": None, "origin": None, "destination": None, "distance": None}
        origin = route.get("origin")
        destination = route.get("destination")
        return {
            "mode": route.get("mode"),
            "origin": origin.get("name") if isinstance(origin, dict) else None,
            "destination": destination.get("name") if isinstance(destination, dict) else None,
            "distance": route.get("distance"),
        }

    @classmethod
    def require_nearest_has_rating(cls, category: str) -> None:
        """验证该 category 的搜索结果里至少有一个带评分的 POI。

        不要求「全结果中距离最近」与「有评分结果中距离最近」为同一地点：离线数据里
        常出现更近的 POI 无 rating、最近有评分的更远。相关 task 的标答以
        ``nearest_rated_from_results`` 为准，此处只保证该语义可计算。
        """
        results = cls.geo_search(category)
        cls.nearest_rated_from_results(results)

    @classmethod
    def require_rated_in_radius(
        cls,
        category: str,
        radius: float,
        min_results: int = 1,
    ) -> None:
        """验证 (category, radius) 组合在离线数据中有足够的带评分结果，否则 raise。"""
        results = cls.geo_search(category)
        rated = cls.filter_results(results, max_distance_meters=radius, rated_only=True)
        if len(rated) < min_results:
            raise ValueError(
                f"invalid sample: '{category}' within {radius}m has "
                f"{len(rated)} rated results, need >= {min_results}"
            )

    @staticmethod
    def filter_results(
        results: list[dict[str, Any]],
        *,
        max_distance_meters: float | None = None,
        rated_only: bool = False,
    ) -> list[dict[str, Any]]:
        """过滤管道：radius + rated_only，保持距离排序。"""
        out = results
        if max_distance_meters is not None:
            out = Map._filter_by_radius(list(out), max_distance_meters)
        if rated_only:
            out = [r for r in out if isinstance(r, dict) and r.get("rating") is not None]
        return out

    @staticmethod
    def _filter_by_radius(results: list[dict[str, Any]], max_meters: float) -> list[dict[str, Any]]:
        """Keep results whose frontend-displayed distance is within *max_meters*."""
        filtered: list[dict[str, Any]] = []
        for r in results:
            if not isinstance(r, dict):
                continue
            dist = r.get("distance_meters")
            if dist is None:
                raw = r.get("distance")
                if isinstance(raw, str):
                    dist = parse_distance_to_meters(raw)
            try:
                if Map._display_distance_meters_for_radius(float(dist)) <= max_meters:
                    filtered.append(r)
            except (TypeError, ValueError):
                continue
        return filtered

    @staticmethod
    def _display_distance_meters_for_radius(distance_meters: float) -> float:
        """Mirror Map frontend distance labels as comparable meters for radius checks."""
        if not math.isfinite(distance_meters) or distance_meters <= 0:
            raise ValueError("invalid distance")
        if distance_meters >= 1000:
            return math.floor(distance_meters / 100 + 0.5) * 100
        rounded = math.floor(distance_meters / 50 + 0.5) * 50
        rounded = max(50, rounded)
        if rounded >= 1000:
            return 1000
        return float(rounded)


    @staticmethod
    def city_from_address(address: str, *, default: str | None = None) -> str:
        text = str(address or "").strip()
        if not text:
            if default is not None:
                return default
            raise ValueError("Address is empty")
        for candidate in ("北京", "上海", "广州", "深圳", "杭州", "成都", "南京", "武汉", "三亚"):
            if any(alias in text for alias in city_aliases(candidate)):
                return candidate
        matched = re.search(r"(?:中国)?([^中国省]{2,4})市", text)
        if matched:
            return matched.group(1)
        if default is not None:
            return default
        return text



    def route_distance_meters(self, destination_hint: str = "") -> float | None:
        route = self.active_route
        if not isinstance(route, dict):
            return None
        if destination_hint:
            destination = route.get("destination") or {}
            destination_name = str(
                (destination if isinstance(destination, dict) else {}).get("name") or ""
            )
            if destination_name and norm(destination_hint) not in norm(destination_name):
                return None
        distance = route.get("distance_meters")
        if isinstance(distance, (int, float)) and float(distance) > 0:
            return float(distance)
        return parse_distance_to_meters(route.get("distance"))


    @staticmethod
    def check_geo_duration(
        answer: Any,
        expected: str,
        *,
        field: str = "answer.duration",
    ) -> dict[str, Any]:
        return {
            "field": field,
            "expected": expected,
            "actual": answer,
            "passed": match_duration(expected, answer),
        }

    @staticmethod
    def check_geo_distance(
        answer: Any,
        expected: str,
        *,
        field: str = "answer.distance",
    ) -> dict[str, Any]:
        expected_meters = parse_distance_to_meters(expected)
        candidates = _extract_distance_candidates(answer)
        passed = False
        if expected_meters is not None:
            passed = any(math.isclose(candidate, expected_meters, rel_tol=0.05, abs_tol=50) for candidate in candidates)
        if not passed:
            passed = bool(build_answer_checks(expected, answer)[0]["passed"])
        return {
            "field": field,
            "expected": expected,
            "actual": answer,
            "passed": passed,
        }

    @staticmethod
    def check_geo_steps(
        answer: Any,
        expected_steps: list[str],
        *,
        field: str = "route_steps",
        max_steps: int = 5,
    ) -> dict[str, Any]:
        required = expected_steps[:max_steps]
        actual_text = str(answer or "")
        actual_norm = _normalize_answer_text(actual_text)
        cursor = 0
        matched = 0
        for step_text in required:
            step_norm = _normalize_answer_text(step_text)
            pos = actual_norm.find(step_norm, cursor)
            if pos < 0:
                break
            matched += 1
            cursor = pos + len(step_norm)
        return {
            "field": field,
            "expected": required,
            "actual": actual_text,
            "passed": bool(actual_text.strip()) and matched == len(required),
        }

    # ------------------------------------------------------------------
    # Check methods — answer matching
    # ------------------------------------------------------------------

    @staticmethod
    def check_answer_match(
        answer: Any,
        expected: Any,
        *,
        field: str = "answer",
    ) -> dict[str, Any]:
        """验证 Agent 回答是否包含期望值（名称/排名/地址等通用匹配）。

        对 *str* 期望值：在双方文本上做宽松归一化（去空格、中英文括号与逗号等常见符号）
        后再做子串判断，便于「超市发（北航店）」与「超市发北航店」等变体对齐。
        非字符串期望值仍走 ``build_answer_checks`` / ``match_value``（数字、正则等）。
        """
        if isinstance(expected, str):
            exp = _normalize_loose_match_text(expected)
            act = _normalize_loose_match_text(answer)
            passed = bool(exp) and exp in act
            return {
                "field": field,
                "expected": expected,
                "actual": answer,
                "passed": passed,
            }
        check = build_answer_checks(expected, answer)[0]
        check["field"] = field
        return check

    @staticmethod
    def _name_positions(text: str, name: str) -> list[int]:
        if not text or not name:
            return []
        positions: list[int] = []
        start = 0
        while True:
            idx = text.find(name, start)
            if idx < 0:
                break
            positions.append(idx)
            start = idx + max(1, len(name))
        return positions

    @staticmethod
    def _ratings_with_positions(text: str) -> list[tuple[float, int]]:
        out: list[tuple[float, int]] = []
        for m in _MAP_NUM_RE.finditer(text or ""):
            try:
                v = float(m.group(1))
                if v < 0.0 or v > 5.0:
                    continue
                out.append((v, m.start(1)))
            except (TypeError, ValueError):
                continue
        return out

    @staticmethod
    def _rating_passed_by_name(
        answer_text: str,
        name: str,
        expected_rating: float,
    ) -> tuple[bool, float | None]:
        """Bind a rating number to the nearest occurrence of *name* in the answer text."""
        if any(kw in (answer_text or "") for kw in _MAP_NO_RATING_KEYWORDS):
            return False, None
        name_pos = Map._name_positions(answer_text, name)
        if not name_pos:
            return False, None
        ratings = Map._ratings_with_positions(answer_text)
        if not ratings:
            return False, None
        best: tuple[float, float] | None = None
        for rating, rpos in ratings:
            dist = min(abs(rpos - npos) for npos in name_pos)
            if best is None or dist < best[1]:
                best = (rating, dist)
        if best is None:
            return False, None
        actual = best[0]
        passed = math.isclose(actual, expected_rating, rel_tol=1e-3, abs_tol=1e-6)
        return passed, actual

    @staticmethod
    def check_rating_by_name(
        answer: Any,
        name: str,
        expected_rating: float,
        *,
        field: str | None = None,
    ) -> dict[str, Any]:
        """验证 Agent 回答中与 name 邻近的评分是否匹配（多实体场景的近邻绑定）。"""
        if field is None:
            field = "answer.rating"
        passed, actual = Map._rating_passed_by_name(
            str(answer or ""), name, expected_rating,
        )
        return {
            "field": field,
            "expected": expected_rating,
            "actual": actual,
            "passed": passed,
        }

    # ------------------------------------------------------------------
    # Check methods — route & state
    # ------------------------------------------------------------------

    def check_route(
        self,
        *,
        mode: str,
        destination_hint: str,
        origin_hint: str | None = None,
        field: str | None = None,
    ) -> dict[str, Any]:
        actual = self._route_summary()
        passed = (
            actual["mode"] == mode
            and self._route_name_matches(destination_hint, actual["destination"])
            and (
                origin_hint is None
                or self._route_name_matches(origin_hint, actual["origin"])
            )
        )
        expected: dict[str, Any] = {"mode": mode, "destination~": destination_hint}
        if origin_hint is not None:
            expected["origin~"] = origin_hint
        default_field = "route_generated" if origin_hint is not None else "route"
        return {
            "field": field or default_field,
            "expected": expected,
            "actual": {
                "mode": actual["mode"],
                "origin": actual["origin"],
                "destination": actual["destination"],
            },
            "passed": passed,
        }

    @staticmethod
    def _first_clause_for_faster_mode(text: str) -> str:
        """首句或首个逗号分句，用于缺少全文显式结论时的兜底。"""
        t = str(text).strip()
        if not t:
            return ""
        for sep in ["。", "！", "？", "；", "\n"]:
            if sep in t:
                t = t.split(sep)[0]
                break
        for sep in [",", "，"]:
            if sep in t:
                t = t.split(sep)[0]
                break
        return t.strip()

    @staticmethod
    def _score_faster_travel_mode_claims(
        candidate: str,
        *,
        expect_driving_faster: bool,
    ) -> bool | None:
        """若存在显式「更快」类结论则返回 True/False；否则返回 None。"""
        dm = _FASTER_DRIVE_CLAIM_RE.search(candidate)
        wm = _FASTER_WALK_CLAIM_RE.search(candidate)
        if dm and wm:
            if dm.start() < wm.start():
                return expect_driving_faster
            if wm.start() < dm.start():
                return not expect_driving_faster
            return expect_driving_faster
        if dm and not wm:
            return expect_driving_faster
        if wm and not dm:
            return not expect_driving_faster
        return None

    @staticmethod
    def _match_faster_travel_mode_answer(
        answer: str | None,
        *,
        walking_seconds: float,
        driving_seconds: float,
    ) -> bool:
        """步行/驾车谁更快；依赖显式结论句式，避免纯子串误判。"""
        if answer is None:
            return False
        text = str(answer)
        if abs(walking_seconds - driving_seconds) < 1e-6:
            return bool(_EQUAL_DURATION_ANSWER_RE.search(text))
        expect_driving_faster = driving_seconds < walking_seconds
        scored = Map._score_faster_travel_mode_claims(text, expect_driving_faster=expect_driving_faster)
        if scored is not None:
            return scored
        scored = Map._score_faster_travel_mode_claims(
            Map._first_clause_for_faster_mode(text),
            expect_driving_faster=expect_driving_faster,
        )
        return scored if scored is not None else False

    @staticmethod
    def check_route_faster_mode_answer(
        answer: str | None,
        *,
        walking_seconds: float,
        driving_seconds: float,
        field: str | None = None,
    ) -> dict[str, Any]:
        w, d = float(walking_seconds), float(driving_seconds)
        if abs(w - d) < 1e-6:
            expected_label = "equal_duration"
        elif d < w:
            expected_label = "driving_faster"
        else:
            expected_label = "walking_faster"
        passed = Map._match_faster_travel_mode_answer(
            answer, walking_seconds=w, driving_seconds=d,
        )
        return {
            "field": field or "answer.faster_mode",
            "expected": expected_label,
            "actual": answer,
            "passed": passed,
        }

    @staticmethod
    def check_place_rating_answer(
        answer: str | None,
        expected_rating: float,
        *,
        field: str | None = None,
    ) -> dict[str, Any]:
        answer_text = str(answer or "")
        if any(kw in answer_text for kw in _MAP_NO_RATING_KEYWORDS):
            passed = False
        else:
            passed = bool(build_answer_checks(expected_rating, answer)[0]["passed"])
        return {
            "field": field or "answer.rating",
            "expected": expected_rating,
            "actual": answer,
            "passed": passed,
        }

    @staticmethod
    def check_place_address_answer(
        answer: str | None,
        expected_address: str,
        *,
        field: str | None = None,
    ) -> dict[str, Any]:
        """去空格与中英文括号、逗号等后做子串匹配，fallback 到更激进的归一化做双向子串。"""
        exp = _normalize_loose_match_text(expected_address)
        act = _normalize_loose_match_text(answer)
        passed = bool(exp) and exp in act
        if not passed:
            exp_addr = normalize_address_for_cmp(expected_address)
            act_addr = normalize_address_for_cmp(answer)
            passed = bool(exp_addr) and (exp_addr in act_addr or act_addr in exp_addr)
        return {
            "field": field or "answer.address",
            "expected": expected_address,
            "actual": answer,
            "passed": passed,
        }

    @staticmethod
    def check_place_phone_answer(
        answer: str | None,
        expected_phone: str,
        *,
        field: str | None = None,
    ) -> dict[str, Any]:
        """提取纯数字后做子串匹配，兼容去国家码 86 前缀。"""
        exp_digits = digits_only(expected_phone)
        exp_no_cc = exp_digits.removeprefix("86")
        act_digits = digits_only(answer)
        passed = bool(exp_no_cc) and (
            exp_digits in act_digits or exp_no_cc in act_digits
        )
        return {
            "field": field or "answer.phone",
            "expected": expected_phone,
            "actual": answer,
            "passed": passed,
        }

    @staticmethod
    def check_driving_cost_answer(
        answer: Any,
        place_query: str,
        rate: float,
        *,
        field: str = "answer.cost",
    ) -> dict[str, Any]:
        """验证 Agent 回答中是否包含正确的油费估算（距离 × 费率）。"""
        check_sets: list[dict[str, Any]] = []
        for _, route in Map.resolve_routes_from_current(place_query, "DRIVING"):
            dist_m = route.get("distance_meters")
            if dist_m is None:
                continue
            dist_km = float(dist_m) / 1000.0
            expected_cost = dist_km * rate
            cost_variants = {
                f"{expected_cost:.1f}",
                f"{expected_cost:.2f}",
                str(int(round(expected_cost))),
                f"{expected_cost:g}",
            }
            answer_text = str(answer or "")
            nums_in_answer = [
                float(m.group())
                for m in re.finditer(r"\d+(?:\.\d+)?", answer_text)
            ]
            cost_ok = (
                any(
                    math.isclose(n, expected_cost, rel_tol=0.1, abs_tol=1.0)
                    for n in nums_in_answer
                )
                or any(s in answer_text for s in cost_variants)
            )
            check_sets.append({
                "field": field,
                "expected": f"{dist_km:.1f}km × {rate} = {expected_cost:.1f}元",
                "actual": answer_text or "(none)",
                "passed": bool(answer_text) and cost_ok,
            })
        if not check_sets:
            raise RuntimeError(
                f"任务设计错误：'{place_query}' 的所有候选路线均缺少 distance_meters，"
                "无法计算油费，请检查离线路线数据"
            )
        return next((c for c in check_sets if c["passed"]), check_sets[0])

    @staticmethod
    def route_step_texts_from_api_route(route: dict[str, Any]) -> list[str]:
        """将归一化路线的 steps 转为与 route_step_texts 可比的拼接串列表。"""
        steps = route.get("steps") or []
        out: list[str] = []
        for s in steps:
            if not isinstance(s, dict):
                continue
            ins = str(s.get("instruction") or "").strip()
            dist = str(s.get("distance") or "").strip()
            merged = f"{ins}{dist}".strip()
            if merged:
                out.append(merged)
        return out
