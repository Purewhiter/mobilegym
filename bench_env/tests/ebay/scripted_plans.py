"""Scripted validation plans for eBay tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
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
) -> list[Step]:
    return [
        *submit_search(query, from_home=from_home),
        *set_common_filters(
            brand=brand,
            condition=condition,
            location=location,
            price_min=price_min,
            price_max=price_max,
        ),
    ]


PLANS: dict[str, list[Step]] = {
    "ebay.SwitchTheme": [
        tap_trigger("tab.me", summary="open Me tab"),
        swipe([500, 820], [500, 260], summary="scroll Me page to account settings"),
        wait(0.3, summary="wait after scrolling Me page"),
        tap_trigger("me.settings.open", summary="open settings"),
        click_selector('div.px-4.py-4:has-text("主题"):visible', summary="open theme chooser"),
        click_selector('div.flex.items-start.cursor-pointer:has-text("深色"):visible', summary="choose dark theme"),
        complete(),
    ],
    "ebay.SortSearchResults": [
        *submit_search("{query}", from_home=True),
        *set_sort("最低价 + 运费优先"),
        complete(),
    ],
    "ebay.SearchFirstResult": [
        *submit_search("{query}", from_home=True),
        *grounded_answer("Dyson 电风扇 电子产品 1", summary="answer first result title"),
        complete(),
    ],
    "ebay.CountSonyHeadphonesEurope": [
        *filtered_search("Sony {query}", from_home=True, condition="{condition}", location="{location}"),
        *grounded_answer("10", summary="answer filtered Sony headphones count"),
        complete(),
    ],
    "ebay.CountNikeSneakersInRange": [
        *filtered_search(
            "Nike {query}",
            from_home=True,
            condition="{condition}",
            location="{location}",
            price_min="{price_min}",
            price_max="{price_max}",
        ),
        *grounded_answer("5", summary="answer filtered Nike sneakers count"),
        complete(),
    ],
    "ebay.FindCheapestProduct": [
        *filtered_search("Dyson {query}", from_home=True, condition="{condition}", location="{location}"),
        *grounded_answer("Dyson 吸尘器 家庭和花园 61", "1141.7", summary="answer cheapest Dyson vacuum"),
        complete(),
    ],
    "ebay.CompareTwoProductPrices": [
        *filtered_search("{item1}", from_home=True, condition="全新", location="亚洲"),
        *submit_search("{item2}"),
        *set_common_filters(condition="全新", location="亚洲"),
        *grounded_choice_answer("电视更便宜", "3756.76", "2653.23", summary="answer two product price comparison"),
        complete(),
    ],
    "ebay.CompareTwoGroupCounts": [
        *filtered_search(
            "Sony {query1}",
            from_home=True,
            condition="{condition1}",
            location="{location1}",
            price_min="{price_min1}",
            price_max="{price_max1}",
        ),
        *submit_search("Nike {query2}"),
        *set_common_filters(
            condition="{condition2}",
            location="{location2}",
            price_min="{price_min2}",
            price_max="{price_max2}",
        ),
        *grounded_choice_answer("耳机更多", "6", "5", summary="answer two group count comparison"),
        complete(),
    ],
}
