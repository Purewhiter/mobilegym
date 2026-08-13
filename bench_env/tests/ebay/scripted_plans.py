"""Scripted validation plans for eBay tasks.

Sampling compatibility (``DERIVED_PARAMS``): every non-declared plan
placeholder (``answer`` / ``count*`` / ``cheapest_*`` / ``*_total`` /
``winner_choice`` / ``theme_label`` / ``sort_label``) is computed at
materialization time via the *judge-homologous* helpers — calculators import
``expect_top`` / ``expect_count`` / ``Ebay.cheapest_product_answer`` /
``Ebay.compare_top_totals`` from ``bench_env.task.ebay.app``, the exact
functions the judges call in ``bench_env/task/ebay/tasks.py``, over the same
static ``apps/Ebay/data/products.json`` dataset. Derived values therefore
cannot drift from the judge under parameter sampling. Explicit test
injections would still win over these calculators; ``test_scripted.py``
deliberately injects declared parameters only, exercising this derivation
path end to end.

Enum params land in ``task.params`` as internal values (``dark`` /
``priceLow``); the UI renders display labels (深色 / 最低价 + 运费优先), so
``theme_label`` / ``sort_label`` are reverse lookups over the same
``EBAY_THEME_PARAM`` / ``EBAY_SORT_PARAM`` tables the tasks declare.

Search strategy note: filtered plans type "{brand} {query}" into the search
box instead of opening the brand filter. Product titles follow the
"{brand} {typeLabel} {categoryLabel} {n}" convention, so the combined query
matches exactly the judge's ``brand AND query`` filter set (verified for
every sampler candidate), and ``check_has_snapshot`` accepts the brand via
its combined-query fallback. The filter-drawer footer renders the live
result count ("显示 N 个结果"), which equals the judge's ``expect_count``
over the same dataset — asserted before applying.

Screen-evidence note (asserted vs typed values): result cards render the
bare item price ("¥600.09") and the shipping fee ("+ ¥25.00 运费") on two
separate lines — the shipping-inclusive total the judges expect is **never
rendered on screen**. Total-cost asserts therefore certify the on-screen
*item price* of the judge-selected product (``*_screen_price`` /
``answer_screen`` derived params), while the AnswerSheet is filled with the
judge-homologous total. (The original hardcoded plans only passed because
the default cheapest Dyson vacuum happened to ship free, price == total.)

Task-level constants that stay literal on purpose (not parameters):
``CompareTwoProductPrices`` pins condition=全新 / location=亚洲 (its judge
and templates hardcode both), and ``FindCheapestProduct`` /
``CompareTwoProductPrices`` sort by 最低价/最高价 as a *navigation* device
(bring the extreme item onto the first card) — the cheapest-task judge
requires no particular sort.
"""

from __future__ import annotations

from typing import Any, Callable

from bench_env.agent.scripted import (
    Step,
    assert_answer,
    assert_text,
    back,
    complete,
    grounded_answer,
    open_answer_sheet,
    submit_answer_sheet,
    swipe,
    tap,
    tap_trigger,
    type_text,
    wait,
)
from bench_env.task.ebay.app import (
    EBAY_SORT_PARAM,
    EBAY_THEME_PARAM,
    Ebay,
    expect_count,
    expect_top,
)


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def tap_keyboard_search() -> Step:
    return tap([900, 930], summary="tap keyboard search key")


def show_results(*, summary: str = "show filter results") -> Step:
    # Right-side drawer footer button. Coordinate avoids matching the covered
    # main-drawer button while a filter subpage overlay is visible.
    return tap([750, 940], summary=summary)


def answer_sheet_input(index: int) -> str:
    return f'[data-scroll-container="sheet-form"] div.space-y-5 > div:nth-child({index + 1}) input'


def grounded_choice_answer(choice: str, *values: str, summary: str | None = None) -> list[Step]:
    steps = open_answer_sheet()
    steps.append(click_selector(f'button:has-text("{choice}"):visible', summary=f"choose answer {choice}"))
    for offset, value in enumerate(values, start=1):
        if offset >= 2:
            steps.append(swipe([500, 760], [500, 420], summary="scroll answer sheet to next field"))
            steps.append(wait(0.2, summary="wait after scrolling answer sheet"))
        steps.append(
            type_text(
                value,
                selector=answer_sheet_input(offset),
                clear=True,
                summary=f"fill answer field {offset}: {value!r}",
            )
        )
    steps.append(back(summary="dismiss keyboard to show submit bar"))
    steps.append(submit_answer_sheet(summary=summary))
    return steps


def open_search() -> Step:
    return tap_trigger("tab.search", summary="open Search tab")


def submit_search(query: str, *, from_home: bool = False) -> list[Step]:
    steps: list[Step] = []
    if from_home:
        steps.append(open_search())
    else:
        steps.append(click_selector("div.cursor-text:visible", summary="focus current search box"))
    steps.extend(
        [
            type_text(query, selector="input:visible", clear=True, summary=f"enter eBay search query {query}"),
            tap_keyboard_search(),
            wait(0.8, summary="wait for search results"),
        ]
    )
    return steps


def set_sort(label: str) -> list[Step]:
    return [
        click_selector('button:has-text("排序"):visible', summary="open sort sheet"),
        click_selector(
            f'div.flex.items-center.px-4.py-4:has-text("{label}"):visible',
            summary=f"select sort {label}",
        ),
        wait(0.8, summary="wait for sorted snapshot"),
    ]


def open_filters() -> Step:
    return click_selector('button:has-text("筛选"):visible', summary="open filters drawer")


def open_filter_item(label: str) -> Step:
    return click_selector(
        f'div.flex.justify-between.items-center:has-text("{label}"):visible',
        summary=f"open filter item {label}",
    )


def choose_brand(text: str) -> Step:
    return click_selector(f'label:has-text("{text}"):visible, button:has-text("{text}"):visible', summary=f"choose brand {text}")


def choose_condition(text: str) -> Step:
    return click_selector(
        f'div.flex.items-center.px-4.py-4.border-b.border-gray-100.cursor-pointer:has-text("{text}"):visible',
        summary=f"choose condition {text}",
    )


def choose_location(text: str) -> Step:
    return click_selector(
        f'div.flex.items-center.px-4.py-4.border-b.border-gray-200.cursor-pointer:has-text("{text}"):visible',
        summary=f"choose location {text}",
    )


def set_common_filters(
    *,
    brand: str | None = None,
    condition: str | None = None,
    location: str | None = None,
    price_min: str | None = None,
    price_max: str | None = None,
    expect_count: str | None = None,
    expect_count_endorses: list[str] | None = None,
) -> list[Step]:
    steps: list[Step] = [open_filters()]
    if brand:
        steps.extend(
            [
                open_filter_item("品牌"),
                choose_brand(brand),
                show_results(summary="return from brand filter"),
            ]
        )
    if condition:
        steps.extend(
            [
                open_filter_item("物品状况"),
                choose_condition(condition),
                show_results(summary="return from condition filter"),
            ]
        )
    if location:
        steps.extend(
            [
                open_filter_item("物品所在地"),
                choose_location(location),
                show_results(summary="return from location filter"),
            ]
        )
    if price_min is not None or price_max is not None:
        steps.extend(
            [
                open_filter_item("价格"),
                type_text(price_min or "", selector="input:visible >> nth=0", clear=True, summary="enter min price"),
                type_text(price_max or "", selector="input:visible >> nth=1", clear=True, summary="enter max price"),
                tap([500, 500], summary="dismiss price keyboard focus"),
                show_results(summary="return from price filter"),
            ]
        )
    if expect_count is not None:
        # Evidence probe: the filter drawer footer button renders the live
        # result count ("显示 N 个结果") — assert it before applying.
        steps.append(
            assert_text(
                f"显示 {expect_count} 个结果",
                summary=f"assert filter drawer shows {expect_count} results",
                endorses=expect_count_endorses,
            )
        )
    steps.extend(
        [
            show_results(summary="apply filters"),
            wait(1.0, summary="wait for filtered snapshot"),
        ]
    )
    return steps


def filtered_search(
    query: str,
    *,
    from_home: bool = False,
    brand: str | None = None,
    condition: str | None = None,
    location: str | None = None,
    price_min: str | None = None,
    price_max: str | None = None,
    expect_count: str | None = None,
) -> list[Step]:
    return [
        *submit_search(query, from_home=from_home),
        *set_common_filters(
            brand=brand,
            condition=condition,
            location=location,
            price_min=price_min,
            price_max=price_max,
            expect_count=expect_count,
        ),
    ]


# ---------------------------------------------------------------------------
# Derived params — sampling-path compatibility
# ---------------------------------------------------------------------------
# Each calculator mirrors its task's judge (get_answer / check_goals in
# bench_env/task/ebay/tasks.py) by calling the same bench_env.task.ebay.app
# helpers over the same static products.json dataset, so the typed/asserted
# values are judge-homologous by construction. The eBay catalog is static —
# no calculator needs the episode's initial state.

_THEME_LABELS = {value: label for label, value in EBAY_THEME_PARAM["values"].items()}
_SORT_LABELS = {value: label for label, value in EBAY_SORT_PARAM["values"].items()}


def _first_result_answer(task: Any, state: dict[str, Any]) -> Any:
    """Mirror SearchFirstResult.get_answer: bestMatch top-1 title or total cost."""
    product = expect_top(query=task.p.query, sort_id="bestMatch", n=1)[0]
    if task.p.metric == "title":
        return product.title
    return round(product.total_cost, 2)


def _first_result_screen(task: Any, state: dict[str, Any]) -> Any:
    """On-screen evidence for the same top-1 product: the title renders
    verbatim, but for total_cost only the bare item price is on the card."""
    product = expect_top(query=task.p.query, sort_id="bestMatch", n=1)[0]
    if task.p.metric == "title":
        return product.title
    return product.price


def _brand_filtered_count(task: Any, state: dict[str, Any]) -> int:
    """Mirror CountSonyHeadphonesEurope.get_answer."""
    return expect_count(
        query=task.p.query, brand=task.p.brand,
        condition=task.p.condition, location=task.p.location,
    )


def _range_filtered_count(task: Any, state: dict[str, Any]) -> int:
    """Mirror CountNikeSneakersInRange.get_answer (float price bounds)."""
    return expect_count(
        query=task.p.query, brand=task.p.brand,
        condition=task.p.condition, location=task.p.location,
        min_total=float(task.p.price_min), max_total=float(task.p.price_max),
    )


def _cheapest_answer(task: Any) -> dict[str, Any]:
    """Mirror FindCheapestProduct.get_answer via the same Ebay answer method
    (it reads only the static catalog, never app state)."""
    return Ebay({}).cheapest_product_answer(
        query=task.p.query, brand=task.p.brand,
        condition=task.p.condition, location=task.p.location,
    )


def _cheapest_screen_price(task: Any, state: dict[str, Any]) -> float:
    """Bare item price of the judge-selected cheapest product (the card's
    only rendered price line — the shipping-inclusive total never is)."""
    return expect_top(
        query=task.p.query, brand=task.p.brand,
        condition=task.p.condition, location=task.p.location,
        sort_id="priceLow", n=1,
    )[0].price


def _pair_totals(task: Any) -> tuple[float, float]:
    """Mirror CompareTwoProductPrices.check_goals (condition/location are
    task-level constants, hardcoded identically in judge and templates)."""
    return Ebay.compare_top_totals(
        task.p.item1, task.p.item2,
        condition="全新", location="亚洲", sort_id=task.p.sort_id,
    )


def _pair_screen_price(task: Any, item: str) -> float:
    """Bare item price of the judge-selected extreme product for ``item`` —
    the same expect_top pick compare_top_totals makes, read off the card."""
    return expect_top(
        query=item, condition="全新", location="亚洲",
        sort_id=task.p.sort_id, n=1,
    )[0].price


def _price_winner_choice(task: Any, state: dict[str, Any]) -> str:
    """AnswerSheet choice-button text for the price comparison verdict.

    Winner logic mirrors CompareTwoProductPrices.check_goals; the button text
    is the rendered answer_fields option ("{item}{comparison}", tie → 相同).
    """
    t1, t2 = _pair_totals(task)
    if task.p.sort_id == "priceLow":
        winner = task.p.item1 if t1 < t2 else (task.p.item2 if t2 < t1 else "相同")
    else:
        winner = task.p.item1 if t1 > t2 else (task.p.item2 if t2 > t1 else "相同")
    return winner if winner == "相同" else f"{winner}{task.p.comparison}"


def _group_count(task: Any, index: int) -> int:
    """Mirror CompareTwoGroupCounts.check_goals (int price bounds there)."""
    p = task.p
    return expect_count(
        query=getattr(p, f"query{index}"), brand=getattr(p, f"brand{index}"),
        condition=getattr(p, f"condition{index}"), location=getattr(p, f"location{index}"),
        min_total=int(getattr(p, f"price_min{index}")), max_total=int(getattr(p, f"price_max{index}")),
    )


def _count_winner_choice(task: Any, state: dict[str, Any]) -> str:
    """AnswerSheet choice-button text ("{query}更多", tie → 数量相同) whose
    winner mirrors CompareTwoGroupCounts.check_goals."""
    c1, c2 = _group_count(task, 1), _group_count(task, 2)
    if c1 > c2:
        return f"{task.p.query1}更多"
    if c2 > c1:
        return f"{task.p.query2}更多"
    return "数量相同"


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict[str, Any]], Any]]] = {
    "ebay.SwitchTheme": {
        "theme_label": lambda task, state: _THEME_LABELS[task.p.theme],
    },
    "ebay.SortSearchResults": {
        "sort_label": lambda task, state: _SORT_LABELS[task.p.sort],
    },
    "ebay.SearchFirstResult": {
        "answer": _first_result_answer,
        "answer_screen": _first_result_screen,
    },
    "ebay.CountSonyHeadphonesEurope": {"count": _brand_filtered_count},
    "ebay.CountNikeSneakersInRange": {"count": _range_filtered_count},
    "ebay.FindCheapestProduct": {
        "cheapest_title": lambda task, state: _cheapest_answer(task)["title"],
        "cheapest_total": lambda task, state: _cheapest_answer(task)["price"],
        "cheapest_screen_price": _cheapest_screen_price,
    },
    "ebay.CompareTwoProductPrices": {
        "sort_label": lambda task, state: _SORT_LABELS[task.p.sort_id],
        "item1_total": lambda task, state: _pair_totals(task)[0],
        "item2_total": lambda task, state: _pair_totals(task)[1],
        "item1_screen_price": lambda task, state: _pair_screen_price(task, task.p.item1),
        "item2_screen_price": lambda task, state: _pair_screen_price(task, task.p.item2),
        "winner_choice": _price_winner_choice,
    },
    "ebay.CompareTwoGroupCounts": {
        "count1": lambda task, state: _group_count(task, 1),
        "count2": lambda task, state: _group_count(task, 2),
        "count_winner_choice": _count_winner_choice,
    },
}


PLANS: dict[str, list[Step]] = {
    "ebay.SwitchTheme": [
        tap_trigger("tab.me", summary="open Me tab"),
        swipe([500, 820], [500, 260], summary="scroll Me page to account settings"),
        wait(0.3, summary="wait after scrolling Me page"),
        tap_trigger("me.settings.open", summary="open settings"),
        click_selector('div.px-4.py-4:has-text("主题"):visible', summary="open theme chooser"),
        click_selector(
            'div.flex.items-start.cursor-pointer:has-text("{theme_label}"):visible',
            summary="choose {theme_label} theme",
        ),
        complete(),
    ],
    "ebay.SortSearchResults": [
        *submit_search("{query}", from_home=True),
        *set_sort("{sort_label}"),
        complete(),
    ],
    "ebay.SearchFirstResult": [
        *submit_search("{query}", from_home=True),
        assert_answer("{answer_screen}", summary="assert first result metric evidence on screen"),
        *grounded_answer("{answer}", summary="answer first result metric"),
        complete(),
    ],
    "ebay.CountSonyHeadphonesEurope": [
        *filtered_search(
            "{brand} {query}",
            from_home=True,
            condition="{condition}",
            location="{location}",
            expect_count="{count}",
        ),
        *grounded_answer("{count}", summary="answer filtered {brand} {query} count"),
        complete(),
    ],
    "ebay.CountNikeSneakersInRange": [
        *filtered_search(
            "{brand} {query}",
            from_home=True,
            condition="{condition}",
            location="{location}",
            price_min="{price_min}",
            price_max="{price_max}",
            expect_count="{count}",
        ),
        *grounded_answer("{count}", summary="answer filtered {brand} {query} count in range"),
        complete(),
    ],
    "ebay.FindCheapestProduct": [
        *filtered_search("{brand} {query}", from_home=True, condition="{condition}", location="{location}"),
        # Cheapest item is not on the first screen under bestMatch; sort so the
        # answer is read off the first card (navigation device, not a param).
        *set_sort("最低价 + 运费优先"),
        assert_answer("{cheapest_title}", field_index=0, summary="assert cheapest title visible after sort"),
        # The card renders the bare item price only; the shipping-inclusive
        # {cheapest_total} is computed off the same judge-picked card, so the
        # screen-price assert endorses it.
        assert_answer(
            "{cheapest_screen_price}",
            field_index=1,
            summary="assert cheapest item price visible after sort",
            endorses=["cheapest_total"],
        ),
        *grounded_answer("{cheapest_title}", "{cheapest_total}", summary="answer cheapest {brand} {query}"),
        complete(),
    ],
    "ebay.CompareTwoProductPrices": [
        *filtered_search("{item1}", from_home=True, condition="全新", location="亚洲"),
        *set_sort("{sort_label}"),
        # Cards render bare item prices; the shipping-inclusive totals and the
        # verdict derive from the same judge-picked cards — each screen-price
        # assert endorses its total, the closing one also the verdict.
        assert_answer(
            "{item1_screen_price}",
            field_index=1,
            summary="assert {item1} extreme item price visible after sort",
            endorses=["item1_total"],
        ),
        # Submitting a new query resets sort back to bestMatch — re-sort after
        # the second search + filters.
        *submit_search("{item2}"),
        *set_common_filters(condition="全新", location="亚洲"),
        *set_sort("{sort_label}"),
        assert_answer(
            "{item2_screen_price}",
            field_index=2,
            summary="assert {item2} extreme item price visible after sort",
            endorses=["item2_total", "winner_choice"],
        ),
        *grounded_choice_answer(
            "{winner_choice}", "{item1_total}", "{item2_total}",
            summary="answer two product price comparison",
        ),
        complete(),
    ],
    "ebay.CompareTwoGroupCounts": [
        *filtered_search(
            "{brand1} {query1}",
            from_home=True,
            condition="{condition1}",
            location="{location1}",
            price_min="{price_min1}",
            price_max="{price_max1}",
            expect_count="{count1}",
        ),
        *submit_search("{brand2} {query2}"),
        # The two drawer count asserts jointly prove the comparison basis; the
        # closing one carries the verdict endorsement.
        *set_common_filters(
            condition="{condition2}",
            location="{location2}",
            price_min="{price_min2}",
            price_max="{price_max2}",
            expect_count="{count2}",
            expect_count_endorses=["count_winner_choice"],
        ),
        *grounded_choice_answer(
            "{count_winner_choice}", "{count1}", "{count2}",
            summary="answer two group count comparison",
        ),
        complete(),
    ],
}
