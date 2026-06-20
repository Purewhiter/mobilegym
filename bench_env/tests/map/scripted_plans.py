"""Scripted replay plans for Map tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
    awake,
    back,
    complete,
    enter,
    grounded_answer,
    home,
    open_answer_sheet,
    submit_answer_sheet,
    swipe,
    tap_action,
    tap_trigger,
    type_text,
    wait,
)

SEARCH_INPUT_SELECTOR = 'input[placeholder="在此处搜索"]:visible, input[placeholder="Search here"]:visible'
ROUTE_ORIGIN_INPUT_SELECTOR = (
    'input[placeholder="选择出发地"]:visible, input[placeholder="Choose starting point"]:visible'
)
ROUTE_DEST_INPUT_SELECTOR = 'input[placeholder="选择目的地"]:visible, input[placeholder="Choose destination"]:visible'
ROUTE_RESULT_BUTTON_SELECTOR = (
    '.place-results-sheet-container button.bg-cyan-50:has-text("路线"):visible, '
    '.place-results-sheet-container button.bg-cyan-50:has-text("Directions"):visible'
)


def click_selector(selector: str, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def row_with_text(*labels: str) -> str:
    clauses = " or ".join(f'normalize-space()="{label}"' for label in labels)
    return (
        f'xpath=(//*[self::div or self::span or self::button][{clauses}]'
        f'/ancestor::*[contains(@class,"active:bg-gray-50") or contains(@class,"cursor-pointer") or self::button][1])[last()]'
    )


def toggle_for_text(*labels: str) -> str:
    clauses = " or ".join(f'normalize-space()="{label}"' for label in labels)
    return f'xpath=(//*[self::div or self::span][{clauses}]/ancestor::div[contains(@class,"justify-between")][1]//button)[1]'


def radio_option(label: str) -> str:
    return (
        f'xpath=(//div[contains(@class,"space-y-6")]'
        f'//div[contains(@class,"cursor-pointer") and .//*[normalize-space()="{label}"]])[1]'
    )


def option_with_text(label: str) -> str:
    return f'xpath=(//*[normalize-space()="{label}"]/ancestor::div[contains(@class,"cursor-pointer")][1])'


def result_route_button(place_name: str) -> str:
    return (
        'xpath=(//div[contains(@class,"place-results-sheet-container")]'
        f'//div[contains(@class,"py-4") and .//h3[normalize-space()="{place_name}"]]'
        '//button[.//*[normalize-space()="路线" or normalize-space()="Directions"]])[1]'
    )


def result_sort_button(*labels: str) -> str:
    clauses = " or ".join(f'normalize-space()="{label}"' for label in labels)
    return (
        'xpath=(//div[contains(@class,"place-results-sheet-container")]'
        f'//button[.//*[{clauses}]])[1]'
    )


def route_prediction(place_name: str, *, subtitle: str | None = None) -> str:
    subtitle_clause = f' and .//*[contains(normalize-space(),"{subtitle}")]' if subtitle else ""
    return (
        f'xpath=(//*[@data-action="routePicker.prediction.select" '
        f'and .//*[normalize-space()="{place_name}"]{subtitle_clause}])[1]'
    )


def route_detail_transport_button(index: int) -> str:
    return (
        'xpath=(//div[contains(@class,"rounded-t-2xl") and contains(@class,"shadow-up") '
        'and (.//*[normalize-space()="推荐路线" or normalize-space()="Recommended route"] '
        'or .//*[normalize-space()="驾车" or normalize-space()="Driving"])]'
        f'//button[contains(@class,"border-b-2")])[{index}]'
    )


def answer_sheet_input(index: int) -> str:
    return f'[data-scroll-container="sheet-form"] div.space-y-5 > div:nth-child({index + 1}) input'


def grounded_choice_then_text(choice: str, *values: str, summary: str | None = None) -> list[Step]:
    steps = open_answer_sheet()
    steps.append(click_selector(f'button:has-text("{choice}"):visible', f"choose answer {choice}"))
    for offset, value in enumerate(values, start=1):
        if offset > 1:
            steps.extend(
                [
                    back(summary="dismiss keyboard before next answer field"),
                    swipe([500, 720], [500, 360], summary="scroll answer sheet to next field"),
                    wait(0.2, summary="wait after answer sheet scroll"),
                ]
            )
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


def open_map() -> list[Step]:
    return [
        home(summary="return to launcher"),
        awake("地图", summary="launch Map"),
        wait(1.0, summary="wait for Map foreground"),
    ]


def return_to_map() -> list[Step]:
    return [
        home(summary="return to launcher after answer sheet"),
        awake("地图", summary="return to Map foreground"),
        wait(0.8, summary="wait for Map foreground"),
    ]


def open_search() -> list[Step]:
    return [
        click_selector(
            (
                f'{SEARCH_INPUT_SELECTOR}, '
                'div.pointer-events-auto.shadow-md div.text-app-text-muted.truncate:has-text("在此处搜索"):visible, '
                'div.pointer-events-auto.shadow-md div.text-app-text-muted.truncate:has-text("Search here"):visible'
            ),
            "open Map search",
        ),
        wait(0.4, summary="wait for Map search page"),
    ]


def search_map(query: str) -> list[Step]:
    return [
        *open_map(),
        *open_search(),
        type_text(query, selector=SEARCH_INPUT_SELECTOR, clear=True, summary=f"type Map search {query}"),
        wait(0.5, summary="wait for Map search suggestions"),
        enter(summary="submit Map search"),
        wait(1.2, summary="wait for Map search results"),
    ]


def route_to_place(query: str, *, mode: str = "driving") -> list[Step]:
    steps: list[Step] = [
        *open_map(),
        click_selector("button.bg-teal-700:visible", "open route setup"),
        wait(0.5, summary="wait for route setup"),
        tap_action("routeSetup.open.destinationPicker", summary="open destination picker"),
        wait(0.4, summary="wait for destination picker"),
        type_text(query, selector=ROUTE_DEST_INPUT_SELECTOR, clear=True, summary="type route destination"),
        wait(0.6, summary="wait for destination predictions"),
        click_selector(route_prediction(query), "select destination prediction"),
        wait(1.5, summary="wait for route calculation"),
    ]
    if mode == "walking":
        steps.extend(
            [
                click_selector(route_detail_transport_button(3), "switch route mode to walking"),
                wait(1.0, summary="wait for walking route"),
            ]
        )
    return steps


def route_visible_result(place_name: str, *, mode: str = "driving", result_scrolls: int = 0) -> list[Step]:
    steps: list[Step] = [
        click_selector(result_sort_button("相关性", "相关度", "Relevance"), "open result sort menu"),
        wait(0.2, summary="wait for result sort menu"),
        click_selector(
            'xpath=(//div[contains(@class,"fixed") and contains(@class,"items-end")]'
            '//button[normalize-space()="距离" or normalize-space()="Distance" '
            'or .//*[normalize-space()="距离" or normalize-space()="Distance"]])[1]',
            "sort search results by distance",
        ),
        wait(0.5, summary="wait for distance-sorted results"),
    ]
    for index in range(result_scrolls):
        steps.extend(
            [
                swipe(
                    [500, 735],
                    [500, 430],
                    summary=f"scroll result sheet to target result {index + 1}/{result_scrolls}",
                ),
                wait(0.2, summary="wait after result sheet scroll"),
            ]
        )
    steps.extend(
        [
            click_selector(result_route_button(place_name), f"open route to result {place_name}"),
            wait(1.5, summary="wait for route calculation"),
        ]
    )
    if mode == "walking":
        steps.extend(
            [
                click_selector(route_detail_transport_button(3), "switch route mode to walking"),
                wait(1.0, summary="wait for walking route"),
            ]
        )
    return steps


def route_between(
    origin: str,
    destination: str,
    *,
    mode: str = "driving",
    origin_subtitle: str | None = None,
    destination_subtitle: str | None = None,
) -> list[Step]:
    steps: list[Step] = [
        *open_map(),
        click_selector("button.bg-teal-700:visible", "open route setup"),
        wait(0.5, summary="wait for route setup"),
        tap_action("routeSetup.open.originPicker", summary="open origin picker"),
        wait(0.4, summary="wait for origin picker"),
        type_text(origin, selector=ROUTE_ORIGIN_INPUT_SELECTOR, clear=True, summary="type route origin"),
        wait(0.6, summary="wait for origin predictions"),
        click_selector(route_prediction(origin, subtitle=origin_subtitle), "select origin prediction"),
        wait(1.0, summary="wait for origin selection"),
        tap_action("routeSetup.open.destinationPicker", summary="open destination picker"),
        wait(0.4, summary="wait for destination picker"),
        type_text(destination, selector=ROUTE_DEST_INPUT_SELECTOR, clear=True, summary="type route destination"),
        wait(0.6, summary="wait for destination predictions"),
        click_selector(route_prediction(destination, subtitle=destination_subtitle), "select destination prediction"),
        wait(1.5, summary="wait for route calculation"),
    ]
    if mode == "walking":
        steps.extend(
            [
                click_selector(route_detail_transport_button(3), "switch route setup to walking"),
                wait(1.0, summary="wait for walking route"),
            ]
        )
    return steps


def open_settings() -> list[Step]:
    return [
        *open_map(),
        tap_trigger("profile.open", summary="open Map profile"),
        wait(0.4, summary="wait for profile"),
        click_selector('button:has-text("设置"):visible, button:has-text("Settings"):visible', "open Map settings"),
        wait(0.5, summary="wait for settings"),
    ]


def set_theme() -> list[Step]:
    return [
        *open_settings(),
        click_selector(row_with_text("应用和显示", "App & display"), "open app display settings"),
        wait(0.2, summary="wait for app display"),
        click_selector(row_with_text("主题", "Theme"), "open theme modal"),
        wait(0.2, summary="wait for theme modal"),
        click_selector(radio_option("{theme_label}"), "select theme option"),
        click_selector('button:has-text("保存"):visible, button:has-text("Save"):visible', "save theme option"),
    ]


def set_north_up() -> list[Step]:
    return [
        *open_settings(),
        click_selector(row_with_text("导航", "Navigation"), "open navigation settings"),
        wait(0.4, summary="wait for navigation settings"),
        swipe([500, 760], [500, 180], summary="scroll navigation settings toward map display"),
        wait(0.2, summary="wait after navigation settings scroll"),
        swipe([500, 760], [500, 180], summary="scroll navigation settings to north-up toggle"),
        wait(0.2, summary="wait after navigation settings scroll"),
        click_selector(row_with_text("地图始终保持上北下南", "Keep map north up"), "toggle north-up map setting"),
        wait(0.4, summary="wait for north-up setting"),
    ]


def set_multi_settings() -> list[Step]:
    return [
        *open_settings(),
        click_selector(row_with_text("通知", "Notifications"), "open notification settings"),
        wait(0.4, summary="wait for notification settings"),
        click_selector(row_with_text("交通信息", "Traffic info"), "open traffic notification settings"),
        wait(0.4, summary="wait for traffic notification settings"),
        click_selector(row_with_text("停车位置", "Parking location"), "open parking notification setting"),
        wait(0.3, summary="wait for parking notification setting"),
        click_selector(option_with_text("{parking_pref}"), "select parking notification preference"),
        wait(0.3, summary="wait for parking preference save"),
        back(summary="return to traffic notification settings"),
        wait(0.3, summary="wait for traffic notification settings"),
        back(summary="return to notification settings"),
        wait(0.3, summary="wait for notification settings"),
        back(summary="return to Map settings"),
        wait(0.3, summary="wait for settings"),
        click_selector(row_with_text("位置信息和隐私", "Location & privacy"), "open location privacy settings"),
        wait(0.4, summary="wait for location privacy"),
        click_selector(
            toggle_for_text("在此设备上保存近期搜索", "Save recent searches on this device"),
            "toggle save recent searches",
        ),
        wait(0.4, summary="wait for location privacy setting"),
    ]


PLANS: dict[str, list[Step]] = {
    "map.CheckDriveRoute": [
        *route_to_place("{place}", mode="driving"),
        complete(),
    ],
    "map.CheckHighestRatedPlace": [
        *search_map("{category}"),
        *grounded_answer("{answer}", summary="submit highest rated place answer"),
        complete(),
    ],
    "map.CheckNearestPlaceAddress": [
        *search_map("{category}"),
        *grounded_answer("{answer}", summary="submit nearest place address"),
        complete(),
    ],
    "map.SetMapNorthUp": [
        *set_north_up(),
        complete(),
    ],
    "map.QueryDrivingDistance": [
        *route_to_place("{place}", mode="driving"),
        *grounded_answer("{answer}", summary="submit driving distance"),
        complete(),
    ],
    "map.CheckRouteSuccess": [
        *route_between("{origin}", "{destination}", mode="driving", origin_subtitle="景山前街"),
        *grounded_answer("{answer}", summary="submit route steps"),
        *return_to_map(),
        complete(),
    ],
    "map.FindBestRatedAndRoute": [
        *search_map("{category}"),
        *route_visible_result("{target_place}", mode="driving", result_scrolls=2),
        *grounded_answer("{answer_name}", "{answer_distance}", summary="submit best rated route answer"),
        *return_to_map(),
        complete(),
    ],
    "map.ModifyMultiSettings": [
        *set_multi_settings(),
        complete(),
    ],
    "map.DarkModeSettings": [
        *set_theme(),
        complete(),
    ],
    "map.FindNearestWithRating": [
        *search_map("{category}"),
        *grounded_answer("{answer_name}", "{answer_rating}", summary="submit nearest rating answer"),
        complete(),
    ],
    "map.CompareRouteDuration": [
        *route_to_place("{place}", mode="driving"),
        *grounded_choice_then_text(
            "{answer_fastest}",
            "{answer_walk_duration}",
            "{answer_drive_duration}",
            summary="submit route duration comparison",
        ),
        complete(),
    ],
    "map.FindNearestAndRoute": [
        *search_map("{category}"),
        *route_visible_result("{target_place}", mode="driving"),
        complete(),
    ],
    "map.EstimateDrivingCost": [
        *route_to_place("{place}", mode="driving"),
        *grounded_answer("{answer}", summary="submit driving cost"),
        complete(),
    ],
    "map.NearestInRadiusRatingRank": [
        *search_map("{category}"),
        *grounded_answer("{answer}", summary="submit rating rank"),
        complete(),
    ],
    "map.BestRatedWithWalkRoute": [
        *search_map("{category}"),
        *route_visible_result("{target_place}", mode="walking", result_scrolls=2),
        *grounded_answer("{answer_name}", "{answer_distance}", summary="submit best rated walk answer"),
        *return_to_map(),
        complete(),
    ],
    "map.NearestDetailAndWalkRoute": [
        *search_map("{category}"),
        *route_visible_result("{target_place}", mode="walking", result_scrolls=1),
        *grounded_answer("{answer_name}", "{answer_rating}", "{answer_duration}", summary="submit nearest detail walk answer"),
        complete(),
    ],
    "map.NorthResearchInstituteAnswer": [
        *search_map("研究所"),
        *grounded_answer("{answer}", summary="submit north research institute answer"),
        complete(),
    ],
}
