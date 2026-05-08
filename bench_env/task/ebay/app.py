"""
eBay app state accessor.
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from bench_env.task.base import BaseApp
from bench_env.task.common_tasks import match_value, normalize_text

BuyingFormat = Literal["buyItNow", "auction", "offer"]
SortId = Literal["bestMatch", "priceLow", "priceHigh", "endingSoon", "newlyListed", "distance"]

EBAY_THEME_PARAM = {
    "type": "enum",
    "values": {
        "浅色": "light",
        "深色": "dark",
        "节电模式": "battery",
    },
    "default": "dark",
    "description": "eBay 主题",
}

EBAY_SEARCH_QUERY_PARAM = {
    "type": "enum",
    "values": [
        "电风扇",
        "耳机",
        "运动鞋",
        "吸尘器",
        "电脑",
        "电视",
        "戒指",
        "腕表",
        "行李箱",
        "发动机零件",
    ],
    "default": "电风扇",
    "description": "eBay 搜索关键词",
}

EBAY_SORT_PARAM = {
    "type": "enum",
    "values": {
        "最低价 + 运费优先": "priceLow",
        "最高价 + 运费优先": "priceHigh",
        "新刊登优先": "newlyListed",
        "距离：最近优先": "distance",
    },
    "default": "priceLow",
    "description": "eBay 搜索排序方式",
}

EBAY_CATEGORY_VALUES = {
    "电子产品": "electronics",
    "服装、鞋子和配饰": "fashion",
    "家庭和花园": "home-garden",
    "珠宝和手表": "jewelry",
    "eBay 汽车": "motors",
    "机票及旅游": "travel",
}

EBAY_QUERY_CATEGORY_PAIRS = [
    {"query": "电脑", "category": "electronics"},
    {"query": "运动鞋", "category": "fashion"},
    {"query": "吸尘器", "category": "home-garden"},
    {"query": "戒指", "category": "jewelry"},
    {"query": "发动机零件", "category": "motors"},
    {"query": "行李箱", "category": "travel"},
]

EBAY_SEARCH_CHANGES = ["ebay.search", "ebay.recentSearches"]


@dataclass(frozen=True)
class Product:
    id: str
    title: str
    categoryId: str
    categoryLabel: str
    typeId: str
    typeLabel: str
    brand: str
    condition: str
    price: float
    originalPrice: float | None
    shipping: float
    freeShipping: bool
    buyingFormat: BuyingFormat
    dateListed: int
    endingSoon: int
    distanceKm: int
    location: str
    sales: str | None
    isSponsored: bool | None
    image: str

    @property
    def total_cost(self) -> float:
        return float(self.price) + float(self.shipping)


ROOT = Path(__file__).resolve().parents[3]
PRODUCTS_PATH = ROOT / "apps" / "Ebay" / "data" / "products.json"


def load_products() -> list[Product]:
    raw = json.loads(PRODUCTS_PATH.read_text(encoding="utf-8"))
    products: list[Product] = []
    for item in raw:
        products.append(
            Product(
                id=str(item["id"]),
                title=str(item["title"]),
                categoryId=str(item["categoryId"]),
                categoryLabel=str(item.get("categoryLabel") or ""),
                typeId=str(item["typeId"]),
                typeLabel=str(item.get("typeLabel") or ""),
                brand=str(item["brand"]),
                condition=str(item["condition"]),
                price=float(item["price"]),
                originalPrice=float(item["originalPrice"]) if item.get("originalPrice") is not None else None,
                shipping=float(item["shipping"]),
                freeShipping=bool(item["freeShipping"]),
                buyingFormat=str(item["buyingFormat"]),  # type: ignore[assignment]
                dateListed=int(item["dateListed"]),
                endingSoon=int(item["endingSoon"]),
                distanceKm=int(item["distanceKm"]),
                location=str(item["location"]),
                sales=str(item["sales"]) if item.get("sales") else None,
                isSponsored=bool(item["isSponsored"]) if item.get("isSponsored") is not None else None,
                image=str(item["image"]),
            )
        )
    return products


PRODUCTS: list[Product] = load_products()

# Mirrors apps/Ebay/pages/SearchPage.tsx COUNTRY_TO_CONTINENT
COUNTRY_TO_CONTINENT: dict[str, str] = {
    "中国": "亚洲",
    "日本": "亚洲",
    "韩国": "亚洲",
    "印度": "亚洲",
    "美国": "北美洲",
    "加拿大": "北美洲",
    "墨西哥": "北美洲",
    "英国": "欧洲",
    "德国": "欧洲",
    "法国": "欧洲",
    "意大利": "欧洲",
    "西班牙": "欧洲",
    "澳大利亚": "大洋洲",
    "新西兰": "大洋洲",
    "巴西": "南美洲",
}


def _matches_location(product_location: str, selected_location: str) -> bool:
    """Match location the same way the frontend does (exact or continent)."""
    if selected_location == product_location:
        return True
    return COUNTRY_TO_CONTINENT.get(product_location) == selected_location


def _normalize_search_text(text: str) -> str:
    return re.sub(r"\s+", "", text.lower())


def filter_products(
    *,
    query: str | None = None,
    category_id: str | None = None,
    brand: str | None = None,
    buying_format: BuyingFormat | None = None,
    condition: str | None = None,
    location: str | None = None,
    free_shipping_only: bool = False,
    min_total: float | None = None,
    max_total: float | None = None,
) -> list[Product]:
    query = _normalize_search_text((query or "").strip())
    result: list[Product] = []
    for product in PRODUCTS:
        if category_id and product.categoryId != category_id:
            continue
        if brand and product.brand != brand:
            continue
        if buying_format and product.buyingFormat != buying_format:
            continue
        if condition and product.condition != condition:
            continue
        if location and not _matches_location(product.location, location):
            continue
        if free_shipping_only and not product.freeShipping:
            continue
        if min_total is not None and product.total_cost < min_total:
            continue
        if max_total is not None and product.total_cost > max_total:
            continue
        if query:
            haystack = _normalize_search_text(
                f"{product.title} {product.brand} {product.typeLabel} {product.categoryLabel}"
            )
            if query not in haystack:
                continue
        result.append(product)
    return result


def sort_products(products: list[Product], sort_id: SortId) -> list[Product]:
    if sort_id == "priceLow":
        return sorted(products, key=lambda product: product.total_cost)
    if sort_id == "priceHigh":
        return sorted(products, key=lambda product: product.total_cost, reverse=True)
    if sort_id == "newlyListed":
        return sorted(products, key=lambda product: product.dateListed, reverse=True)
    if sort_id == "endingSoon":
        return sorted(products, key=lambda product: product.endingSoon)
    if sort_id == "distance":
        return sorted(products, key=lambda product: product.distanceKm)
    return list(products)


def expect_top(
    *,
    query: str,
    category_id: str | None = None,
    sort_id: SortId,
    brand: str | None = None,
    buying_format: BuyingFormat | None = None,
    condition: str | None = None,
    location: str | None = None,
    free_shipping_only: bool = False,
    min_total: float | None = None,
    max_total: float | None = None,
    n: int = 1,
) -> list[Product]:
    filtered = filter_products(
        query=query,
        category_id=category_id,
        brand=brand,
        buying_format=buying_format,
        condition=condition,
        location=location,
        free_shipping_only=free_shipping_only,
        min_total=min_total,
        max_total=max_total,
    )
    sorted_list = sort_products(filtered, sort_id)
    if len(sorted_list) < n:
        raise ValueError(
            f"Task design error: expected at least {n} results but got {len(sorted_list)} "
            f"(query={query}, category={category_id or 'ANY'}, sort={sort_id})"
        )
    return sorted_list[:n]


def _snapshot_query_matches_intent(snap_query: str, canonical_query: str) -> bool:
    """Snapshot `query` is the full search box text; tasks use a canonical keyword (e.g. 耳机)."""
    s = (snap_query or "").strip().lower()
    c = (canonical_query or "").strip().lower()
    if not c:
        return True
    if not s:
        return False
    if s == c:
        return True
    return c in s


def _snapshot_brand_matches(snapshot: dict[str, Any], expected_brand: str | None) -> bool:
    """Brand may be only in filters, only in combined query (e.g. Sony 耳机), or both."""
    if expected_brand is None:
        return True
    eb = str(expected_brand).strip()
    snap_brand_raw = str(snapshot.get("brand") or "").strip()
    snap_query = str(snapshot.get("query") or "")
    parts = [p.strip() for p in snap_brand_raw.split(",") if p.strip()]
    if parts:
        return eb in parts
    return eb.lower() in snap_query.lower()


def _price_field_matches(actual: Any, expected: str | None) -> bool:
    if expected is None:
        return True
    a = str(actual or "").strip()
    b = str(expected).strip()
    if a == b:
        return True
    try:
        return float(a) == float(b)
    except ValueError:
        return False


def snapshot_matches_search_criteria(
    snapshot: dict[str, Any] | None,
    *,
    query: str,
    sort_option: str | None = None,
    category_id: str | None = None,
    brand: str | None = None,
    buying_format: str | None = None,
    condition: str | None = None,
    location: str | None = None,
    free_shipping_only: bool | None = None,
    price_min: str | None = None,
    price_max: str | None = None,
) -> bool:
    """Whether *snapshot* (a history entry or ``search.current``) matches the task filters."""
    if not isinstance(snapshot, dict):
        return False
    if not _snapshot_query_matches_intent(str(snapshot.get("query") or ""), query):
        return False
    if sort_option is not None and str(snapshot.get("sortOption") or "") != sort_option:
        return False
    if category_id is not None and str(snapshot.get("categoryId") or "") != category_id:
        return False
    if brand is not None and not _snapshot_brand_matches(snapshot, brand):
        return False
    if buying_format is not None and str(snapshot.get("buyingFormat") or "") != buying_format:
        return False
    if condition is not None:
        actual_conditions = sorted(str(item) for item in (snapshot.get("conditions") or []))
        if actual_conditions != [condition]:
            return False
    if location is not None and str(snapshot.get("location") or "") != location:
        return False
    if free_shipping_only is not None and bool(snapshot.get("freeShippingOnly")) != free_shipping_only:
        return False
    if not _price_field_matches(snapshot.get("priceMin"), price_min):
        return False
    if not _price_field_matches(snapshot.get("priceMax"), price_max):
        return False
    return True


def expect_count(
    *,
    query: str,
    category_id: str | None = None,
    brand: str | None = None,
    buying_format: BuyingFormat | None = None,
    condition: str | None = None,
    location: str | None = None,
    free_shipping_only: bool = False,
    min_total: float | None = None,
    max_total: float | None = None,
) -> int:
    return len(
        filter_products(
            query=query,
            category_id=category_id,
            brand=brand,
            buying_format=buying_format,
            condition=condition,
            location=location,
            free_shipping_only=free_shipping_only,
            min_total=min_total,
            max_total=max_total,
        )
    )


# =============================================================================
# Shared answer parsing helpers (for eBay tasks)
# =============================================================================

# Match the "count unit" in natural-language answers, e.g.:
# - "有 11 个结果"
# - "有 5 双"
_EBAY_COUNT_UNIT_RE = re.compile(r"(\d{1,5})\s*(?:个|条|双|件)(?:结果|条(?:记录)?)?")


def extract_two_counts_from_natural_answer(text: Any) -> tuple[int, int] | None:
    """
    Extract the first two integer counts from an agent free-form answer.

    Tight by design: only matches numbers followed by count units (个/条/双/件),
    so it won't confuse price range bounds like 620/690 as counts.
    """
    if text is None:
        return None
    s = normalize_text(str(text))
    matches = [int(m.group(1)) for m in _EBAY_COUNT_UNIT_RE.finditer(s)]
    if len(matches) >= 2:
        return matches[0], matches[1]
    return None


def infer_winner_label(first_count: int, second_count: int, first_label: str, second_label: str, tie_label: str = "相同") -> str:
    if first_count > second_count:
        return first_label
    if second_count > first_count:
        return second_label
    return tie_label



# =============================================================================
# Answer matching helpers (moved from tasks.py per §1.1)
# =============================================================================


def _case_field_suffix(*parts: Any) -> str:
    raw = "_".join(str(p) for p in parts if p is not None and str(p).strip())
    return re.sub(r"[^\w\u4e00-\u9fff]+", "_", raw).strip("_") or "case"


_EBAY_STANDALONE_NUM_RE = re.compile(
    r"(?<!\d)-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?!\d)"
)


def _ebay_parse_floats_in_order(text: str) -> list[float]:
    s = normalize_text(text)
    out: list[float] = []
    for m in _EBAY_STANDALONE_NUM_RE.finditer(s):
        try:
            out.append(float(m.group().replace(",", "").replace("，", "")))
        except ValueError:
            continue
    return out


def _ebay_match_price(expected: float, actual_fragment: Any) -> bool:
    """Match an expected price (yuan) against an actual value or text fragment."""
    if actual_fragment is None:
        return False
    if isinstance(actual_fragment, bool):
        return False
    if isinstance(actual_fragment, (int, float)):
        return math.isclose(float(actual_fragment), expected, rel_tol=1e-6, abs_tol=0.02)
    for n in _ebay_parse_floats_in_order(str(actual_fragment)):
        if math.isclose(n, expected, rel_tol=1e-6, abs_tol=0.02):
            return True
    return False


def _ebay_winner_label_matches_in_text(
    label_expected: str,
    full: str | None,
    winner_marker_words: list[str] | None,
) -> bool:
    """Check winner label near the marker word."""
    if full is None:
        return False
    full_norm = normalize_text(full)
    low = label_expected.lower()
    if label_expected == "相同" or low in ("same", "tied", "equal"):
        return any(w in full_norm for w in ("相同", "一样", "same", "tied", "equal"))
    if not winner_marker_words:
        return match_value(label_expected, full_norm)
    for marker in winner_marker_words:
        marker_norm = normalize_text(marker)
        if not marker_norm:
            continue
        if re.search(
            rf"{re.escape(marker_norm)}[^。；，,]{{0,20}}{re.escape(label_expected)}",
            full_norm,
        ):
            return True
        if re.search(
            rf"{re.escape(label_expected)}[^。；，,]{{0,20}}{re.escape(marker_norm)}",
            full_norm,
        ):
            return True
    return False



def build_compare_two_totals_checks(
    *,
    label_expected: str,
    label_key: str,
    first_total: float,
    first_key: str,
    second_total: float,
    second_key: str,
    winner_marker_words: list[str] | None = None,
    answer: Any,
) -> list[dict[str, Any]]:
    """Two price slots + one label; plain string answers list prices in order."""
    if isinstance(answer, dict):
        return [
            {"field": f"answer.{label_key}", "expected": label_expected,
             "actual": answer.get(label_key),
             "passed": match_value(label_expected, answer.get(label_key))},
            {"field": f"answer.{first_key}", "expected": first_total,
             "actual": answer.get(first_key),
             "passed": _ebay_match_price(first_total, answer.get(first_key))},
            {"field": f"answer.{second_key}", "expected": second_total,
             "actual": answer.get(second_key),
             "passed": _ebay_match_price(second_total, answer.get(second_key))},
        ]
    full = None if answer is None else str(answer)
    nums = _ebay_parse_floats_in_order(full) if full else []
    first_actual = str(nums[0]) if len(nums) > 0 else None
    second_actual = str(nums[1]) if len(nums) > 1 else None
    return [
        {"field": f"answer.{label_key}", "expected": label_expected,
         "actual": full,
         "passed": _ebay_winner_label_matches_in_text(label_expected, full, winner_marker_words)},
        {"field": f"answer.{first_key}", "expected": first_total,
         "actual": first_actual,
         "passed": _ebay_match_price(first_total, first_actual)},
        {"field": f"answer.{second_key}", "expected": second_total,
         "actual": second_actual,
         "passed": _ebay_match_price(second_total, second_actual)},
    ]


def build_compare_counts_checks(
    *,
    more_expected: str,
    label1: str,
    count1: int,
    label2: str,
    count2: int,
    answer: Any,
) -> list[dict[str, Any]]:
    """Count-based comparison between two filtered groups."""
    if isinstance(answer, dict):
        return [
            {"field": "answer.more", "expected": more_expected,
             "actual": answer.get("more"),
             "passed": match_value(more_expected, answer.get("more"))},
            {"field": f"answer.{label1}Count", "expected": count1,
             "actual": answer.get(f"{label1}Count"),
             "passed": match_value(count1, answer.get(f"{label1}Count"))},
            {"field": f"answer.{label2}Count", "expected": count2,
             "actual": answer.get(f"{label2}Count"),
             "passed": match_value(count2, answer.get(f"{label2}Count"))},
        ]
    full = None if answer is None else str(answer)
    # String-based: extract winner label and two counts
    more_passed = False
    if full:
        pair = extract_two_counts_from_natural_answer(full)
        if pair is not None:
            inferred = infer_winner_label(pair[0], pair[1], first_label=label1, second_label=label2)
            more_passed = inferred == more_expected
        elif more_expected in full:
            more_passed = True
    return [
        {"field": "answer.more", "expected": more_expected,
         "actual": full, "passed": more_passed},
        {"field": f"answer.{label1}Count", "expected": count1,
         "actual": full, "passed": match_value(count1, full)},
        {"field": f"answer.{label2}Count", "expected": count2,
         "actual": full, "passed": match_value(count2, full)},
    ]


class Ebay(BaseApp):
    """
    eBay state accessor.

    Usage:
        ebay = Ebay(input.apps["ebay"])
        ebay.recent_searches
        ebay.current_search
    """

    @property
    def recent_searches(self) -> list[dict[str, Any]]:
        return self.get_list("recentSearches")

    @property
    def current_search(self) -> dict[str, Any]:
        return self.get("search", {}).get("current", {})

    @property
    def search_history(self) -> list[dict[str, Any]]:
        history = self.get("search", {}).get("history", [])
        return history if isinstance(history, list) else []

    @property
    def last_compare(self) -> dict[str, Any] | None:
        last_compare = self.get("search", {}).get("lastCompare")
        return last_compare if isinstance(last_compare, dict) else None

    @staticmethod
    def sample_query_category_pair(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        picked = rng.choice(EBAY_QUERY_CATEGORY_PAIRS)
        return {"query": str(picked["query"]), "category": str(picked["category"])}

    @staticmethod
    def sample_two_items(env_state: dict[str, Any], rng: Any) -> dict[str, str]:
        """从搜索关键词候选列表中随机采样两个不同的商品关键词。"""
        pool = list(EBAY_SEARCH_QUERY_PARAM["values"])
        picked = rng.sample(pool, 2)
        return {"item1": picked[0], "item2": picked[1]}

    def find_latest_snapshot(
        self,
        *,
        query: str,
        sort_option: str | None = None,
        category_id: str | None = None,
        brand: str | None = None,
        buying_format: str | None = None,
        condition: str | None = None,
        location: str | None = None,
        free_shipping_only: bool | None = None,
        price_min: str | None = None,
        price_max: str | None = None,
    ) -> dict[str, Any] | None:
        kw: dict[str, Any] = {
            "query": query,
            "sort_option": sort_option,
            "category_id": category_id,
            "brand": brand,
            "buying_format": buying_format,
            "condition": condition,
            "location": location,
            "free_shipping_only": free_shipping_only,
            "price_min": price_min,
            "price_max": price_max,
        }
        for snapshot in reversed(self.search_history):
            if snapshot_matches_search_criteria(snapshot, **kw):
                return snapshot
        # Filter-only updates sync into ``search.current`` on every change; history is only
        # appended on search/sort/apply. Accept the live current state when it matches.
        cur = self.current_search
        if snapshot_matches_search_criteria(cur, **kw):
            return cur
        return None

    def cheapest_product(
        self,
        *,
        query: str,
        condition: str | None = None,
        location: str | None = None,
        brand: str | None = None,
    ) -> Product:
        """返回满足筛选条件的最低总价商品。"""
        return expect_top(
            query=query,
            condition=condition,
            location=location,
            brand=brand,
            sort_id="priceLow",
            n=1,
        )[0]

    def check_search_snapshot(
        self,
        query: str,
        *,
        condition: str | None = None,
        sort_option: str | None = None,
        first_total_cents: int | None = None,
        field: str | None = None,
    ) -> dict[str, Any]:
        if field is None:
            field = f"ebay.search.{query}"
        snapshot = self.find_latest_snapshot(
            query=query,
            condition=condition,
            sort_option=sort_option,
        )
        actual = None
        passed = snapshot is not None
        if snapshot is not None:
            actual = {
                "query": snapshot.get("query"),
                "conditions": snapshot.get("conditions"),
                "sortOption": snapshot.get("sortOption"),
                "firstTotalCents": snapshot.get("firstTotalCents"),
            }
            if first_total_cents is not None:
                try:
                    passed = passed and int(snapshot.get("firstTotalCents")) == int(first_total_cents)
                except (TypeError, ValueError):
                    passed = False
        expected: dict[str, Any] = {"query": query}
        if condition is not None:
            expected["condition"] = condition
        if sort_option is not None:
            expected["sortOption"] = sort_option
        if first_total_cents is not None:
            expected["firstTotalCents"] = int(first_total_cents)
        return {
            "field": field,
            "expected": expected,
            "actual": actual,
            "passed": passed,
        }

    def check_current_search(
        self,
        query: str,
        *,
        sort_option: str | None = None,
        first_total_cents: int | None = None,
        field: str | None = None,
    ) -> dict[str, Any]:
        """仅校验 search.current（当前搜索页），不扫描历史记录。

        用于需要验证"当前仍停留在目标搜索结果页"的任务判定。
        """
        from bench_env.task.utils import norm as _norm
        if field is None:
            field = f"ebay.current.{query}"
        cur = self.current_search
        q = str(cur.get("query") or "")
        sort_id = cur.get("sortOption")
        cents = cur.get("firstTotalCents")
        query_ok = bool(q) and _norm(query) in _norm(q)
        sort_ok = sort_option is None or sort_id == sort_option
        price_ok = True
        if first_total_cents is not None:
            try:
                price_ok = int(cents) == int(first_total_cents)
            except (TypeError, ValueError):
                price_ok = False
        passed = query_ok and sort_ok and price_ok
        expected: dict[str, Any] = {"query": query}
        if sort_option is not None:
            expected["sortOption"] = sort_option
        if first_total_cents is not None:
            expected["firstTotalCents"] = int(first_total_cents)
        return {
            "field": field,
            "expected": expected,
            "actual": {"query": q, "sortOption": sort_id, "firstTotalCents": cents},
            "passed": passed,
        }

    def compare_cheapest_products(
        self,
        *,
        query1: str,
        query2: str,
        condition: str | None = None,
        location: str | None = None,
    ) -> tuple[str, Product, Product, float]:
        """比较两次搜索的最低总价商品，返回更便宜的一方与差价。"""
        first = self.cheapest_product(query=query1, condition=condition, location=location)
        second = self.cheapest_product(query=query2, condition=condition, location=location)
        first_total = round(first.total_cost, 2)
        second_total = round(second.total_cost, 2)
        if first_total < second_total:
            return query1, first, second, round(second_total - first_total, 2)
        if second_total < first_total:
            return query2, first, second, round(first_total - second_total, 2)
        return "相同", first, second, 0.0

    # -- check methods --

    def check_has_snapshot(
        self,
        *,
        query: str,
        brand: str | None = None,
        condition: str | None = None,
        location: str | None = None,
        sort_option: str | None = None,
        price_min: str | None = None,
        price_max: str | None = None,
        field: str | None = None,
    ) -> dict[str, Any]:
        """Check that a matching search snapshot exists."""
        if field is None:
            field = f"snapshot.{_case_field_suffix(brand, query, location)}"
        snapshot = self.find_latest_snapshot(
            query=query, brand=brand, condition=condition,
            location=location, sort_option=sort_option,
            price_min=price_min, price_max=price_max,
        )
        parts = [p for p in [brand, query, f"@ {location}" if location else None] if p]
        if price_min or price_max:
            parts.append(f"[{price_min or ''}, {price_max or ''}]")
        return {
            "field": field,
            "expected": f"matching snapshot for {' '.join(parts)}",
            "actual": snapshot,
            "passed": snapshot is not None,
        }

    # -- answer methods --

    def cheapest_product_answer(
        self, *, query: str, brand: str | None = None,
        condition: str | None = None, location: str | None = None,
    ) -> dict[str, Any]:
        """Answer method: {title, price} of cheapest matching product."""
        p = self.cheapest_product(
            query=query, condition=condition, location=location, brand=brand,
        )
        return {"title": p.title, "price": round(p.total_cost, 2)}

    @staticmethod
    def compare_top_totals(
        q1: str, q2: str, *,
        condition: str | None = None,
        location: str | None = None,
        sort_id: SortId = "priceLow",
    ) -> tuple[float, float]:
        """Return (first_total, second_total) in yuan for two queries."""
        first = expect_top(
            query=q1, condition=condition, location=location,
            sort_id=sort_id, n=1,
        )[0]
        second = expect_top(
            query=q2, condition=condition, location=location,
            sort_id=sort_id, n=1,
        )[0]
        return (
            round(first.total_cost, 2),
            round(second.total_cost, 2),
        )

    # -- sampler staticmethods (moved from tasks.py per §1.1) --

    @staticmethod
    def sample_brand_location_case(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        """Shared sampler for brand+location filtered searches (count / cheapest tasks)."""
        candidates = [
            {"query": "耳机", "brand": "Sony", "location": "欧洲", "condition": "全新"},
            {"query": "运动鞋", "brand": "Nike", "location": "欧洲", "condition": "全新"},
            {"query": "吸尘器", "brand": "Dyson", "location": "亚洲", "condition": "全新"},
            {"query": "发动机零件", "brand": "Bosch", "location": "欧洲", "condition": "全新"},
        ]
        valid = [
            c for c in candidates
            if expect_count(query=c["query"], brand=c["brand"],
                            condition=c["condition"], location=c["location"]) > 0
        ]
        return rng.choice(valid or candidates)

    @staticmethod
    def sample_compare_pair(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        """Sampler for L4 two-product price comparison tasks."""
        pool = list(EBAY_SEARCH_QUERY_PARAM["values"])
        pair = rng.sample(pool, 2)
        modes = [
            {"sort_id": "priceLow", "sort_label": "最低价", "extreme": "最便宜", "comparison": "更便宜"},
            {"sort_id": "priceHigh", "sort_label": "最高价", "extreme": "最贵", "comparison": "更贵"},
        ]
        mode = rng.choice(modes)
        return {"item1": pair[0], "item2": pair[1], **mode}

    @staticmethod
    def sample_range_case(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        base_candidates = [
            {"query": "运动鞋", "brand": "Nike", "location": "欧洲", "condition": "全新"},
            {"query": "耳机", "brand": "Sony", "location": "欧洲", "condition": "全新"},
            {"query": "吸尘器", "brand": "Dyson", "location": "亚洲", "condition": "全新"},
        ]
        valid_cases: list[dict[str, Any]] = []
        for c in base_candidates:
            products = filter_products(
                query=c["query"], brand=c["brand"],
                condition=c["condition"], location=c["location"],
            )
            if not products:
                continue
            totals = sorted(int(round(p.total_cost)) for p in products)
            pick = totals[min(len(totals) - 1, max(0, len(totals) // 3))]
            for span in (20, 30, 40, 60):
                lo = max(0, pick - span)
                hi = pick + span
                cnt = expect_count(
                    query=c["query"], brand=c["brand"],
                    condition=c["condition"], location=c["location"],
                    min_total=lo, max_total=hi,
                )
                if cnt > 0:
                    valid_cases.append({**c, "price_min": str(lo), "price_max": str(hi)})
                    break
        if valid_cases:
            return rng.choice(valid_cases)
        return {
            "query": "运动鞋", "brand": "Nike", "location": "欧洲",
            "condition": "全新", "price_min": "510", "price_max": "540",
        }

    @staticmethod
    def sample_compare_counts_groups(env_state: dict[str, Any], rng: Any) -> dict[str, Any]:
        """Sampler for L4 two-group count comparison tasks."""
        candidates = [
            {"query": "耳机", "brand": "Sony", "location": "欧洲", "condition": "全新"},
            {"query": "运动鞋", "brand": "Nike", "location": "欧洲", "condition": "全新"},
            {"query": "吸尘器", "brand": "Dyson", "location": "亚洲", "condition": "全新"},
            {"query": "发动机零件", "brand": "Bosch", "location": "欧洲", "condition": "全新"},
        ]
        def _with_range(c: dict[str, Any]) -> dict[str, Any] | None:
            products = filter_products(
                query=c["query"], brand=c["brand"],
                condition=c["condition"], location=c["location"],
            )
            if not products:
                return None
            totals = sorted(int(round(p.total_cost)) for p in products)
            pick = totals[min(len(totals) - 1, max(0, len(totals) // 3))]
            for span in (20, 30, 40, 60):
                lo, hi = max(0, pick - span), pick + span
                if expect_count(query=c["query"], brand=c["brand"],
                                condition=c["condition"], location=c["location"],
                                min_total=lo, max_total=hi) > 0:
                    return {**c, "price_min": str(lo), "price_max": str(hi)}
            return None

        valid = [r for c in candidates if (r := _with_range(c)) is not None]
        if len(valid) >= 2:
            g1, g2 = rng.sample(valid, 2)
        else:
            g1 = {"query": "耳机", "brand": "Sony", "location": "欧洲",
                  "condition": "全新", "price_min": "620", "price_max": "690"}
            g2 = {"query": "运动鞋", "brand": "Nike", "location": "欧洲",
                  "condition": "全新", "price_min": "510", "price_max": "540"}
        return {f"{k}1": v for k, v in g1.items()} | {f"{k}2": v for k, v in g2.items()}
