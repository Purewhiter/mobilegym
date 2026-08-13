"""Scripted replay plans for Map tasks.

Sampling compatibility (``DERIVED_PARAMS``): every non-declared plan
placeholder (``answer*`` / ``target_place`` / the route-picker triples) is
computed at materialization time through the *judge-homologous* ``Map``
domain class. Map judges never read expected values from the terminal app
state — search results, ratings, route distances/durations/steps all come
from the static offline datasets ``apps/Map/data/places.json`` /
``routes.json`` (``Map.geo_search`` / ``Map.geo_route_from_current`` /
``Map.resolve_route_pairs``), while the terminal state only carries
behavioral evidence (``searchHistory`` diff, ``active_route``
mode/destination). So the calculators import the same static-data accessors
the judges call — static data is orthogonal to sampling, and derived values
cannot drift from the judge. Explicit test injections would still win over
these calculators; ``test_scripted.py`` deliberately injects declared
parameters only, exercising this derivation path end to end.

Route-picker parameterization (``_ROUTE_PICKS``): typing a place param into
the route origin/destination picker and clicking "the prediction whose text
equals the param" does NOT generalize across the sampled place values — the
autocomplete rows (``places.json.autocomplete_index``) surface each POI with
its own main text and need subtitle disambiguation, e.g. 国家图书馆's
predictions are all titled 中国国家图书馆, and 圆明园's only routable POI
(圆明园遗址公园) never appears under the query 圆明园. Each place value
therefore maps to a verified ``(query, prediction main text, subtitle
substring)`` triple targeting the POI that (a) has the offline
current>/OD route segments and (b) renders the same distance/duration texts
as ``Map.resolve_places(place)[0]`` — the candidate the answer calculators
(and the judges' first ``check_alternatives`` branch) use.
"""

from __future__ import annotations

from typing import Any, Callable

from bench_env.agent.scripted import (
    Step,
    assert_answer,
    assert_visible,
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
from bench_env.task.map.app import Map

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


def rated_result_row(name_param: str, rating_param: str) -> str:
    """结果行内"名称 + 评分"同行可见的行级 xpath（证据断言用）。

    评分是纯短数字（如 3 / 4.4）：默认 scope 下 assert_answer 的文本包含既有
    假阳性（"3"可命中"311米"等），又有格式错配——整型评分屏上渲染为"3"、注入
    参数为 str(float)="3.0"，文本无法直接绑定。改用 XPath number() 数值比较，
    把评分值绑定在目标名称所在的结果行内。
    """
    return (
        'xpath=(//div[contains(@class,"place-results-sheet-container")]'
        f'//div[contains(@class,"py-4") and .//h3[normalize-space()="{name_param}"]'
        ' and .//span[contains(@class,"text-gray-900")]'
        f'[number(normalize-space())=number("{rating_param}")]])[1]'
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


def route_to_place(*, mode: str = "driving") -> list[Step]:
    """去 {place} 的路线：输入词/预测行由 _ROUTE_PICKS 查表派生（见 DERIVED_PARAMS）。

    ``{place_query}``（打进目的地选点框的词）、``{place_main}``（预测行主文
    本，精确匹配）、``{place_sub}``（副标题消歧子串）三个占位符按任务的
    ``place`` 参数查表渲染——目标 POI 与答案派生所用的
    ``Map.resolve_places(place)[0]`` 距离/时长文本一致。
    """
    steps: list[Step] = [
        *open_map(),
        click_selector("button.bg-teal-700:visible", "open route setup"),
        wait(0.5, summary="wait for route setup"),
        tap_action("routeSetup.open.destinationPicker", summary="open destination picker"),
        wait(0.4, summary="wait for destination picker"),
        type_text("{place_query}", selector=ROUTE_DEST_INPUT_SELECTOR, clear=True, summary="type route destination"),
        wait(0.6, summary="wait for destination predictions"),
        click_selector(
            route_prediction("{place_main}", subtitle="{place_sub}"),
            "select destination prediction",
        ),
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


def sort_results_by_distance() -> list[Step]:
    """Switch the place-results sheet from the default relevance order to distance order."""
    return [
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


def scroll_results(times: int, *, summary_prefix: str = "scroll result sheet") -> list[Step]:
    """Scroll the result sheet list (~2.5 rows per swipe at the half snap)."""
    steps: list[Step] = []
    for index in range(times):
        steps.extend(
            [
                swipe([500, 735], [500, 430], summary=f"{summary_prefix} {index + 1}/{times}"),
                wait(0.2, summary="wait after result sheet scroll"),
            ]
        )
    return steps


def browse_results(swipes: int) -> list[Step]:
    """Page through the result sheet top-to-bottom (virtual paging loads 20 rows/page).

    Deeper stroke than ``scroll_results`` (~3 rows per swipe) and no interleaved
    waits — the env's post-action delay already covers load-more settling.
    Best-effort browsing: overshooting the list end is harmless.
    """
    steps: list[Step] = [
        swipe([500, 750], [500, 390], summary=f"browse result list {index + 1}/{swipes}")
        for index in range(swipes)
    ]
    steps.append(wait(0.5, summary="wait after browsing result list"))
    return steps


def open_nearest_result_detail() -> list[Step]:
    """Tap the top row of the (distance-sorted) result sheet to open PlaceDetailSheet.

    The address only exists on the detail sheet (AddressCard); result rows show
    name/rating/category/distance only.
    """
    return [
        click_selector(
            '[data-action="placeResults.result.select.item"]',
            "open nearest result detail",
        ),
        wait(1.0, summary="wait for place detail sheet"),
    ]


def expand_route_sheet(*, endorses: list[str] | None = None) -> list[Step]:
    """Drag the route sheet from the MEDIUM snap to the near-fullscreen EXPANDED snap.

    After route calculation the sheet rests at MEDIUM (300 app px; only
    "duration (distance)" is shown). Step-by-step navigation text renders only
    in the expanded state (RouteDetailSheet ``isExpanded`` branch), so drag the
    sheet handle (norm y≈683 at MEDIUM under the 412-design-width zoom) up
    before reading directions; the trailing assert hard-fails if the sheet did
    not actually expand (``endorses`` — params whose values are read off the
    expanded directions).
    """
    return [
        {
            "op": "drag",
            "point1": [500, 683],
            "point2": [500, 130],
            "summary": "drag route sheet up to expanded",
        },
        wait(0.8, summary="wait for expanded route sheet"),
        assert_visible(
            '[data-adjust-resize] :text("具体路线"):visible, '
            '[data-adjust-resize] :text("Detailed steps"):visible',
            summary="assert step-by-step directions visible",
            endorses=endorses,
        ),
    ]


def route_visible_result(
    place_name: str,
    *,
    mode: str = "driving",
    result_scrolls: int = 0,
    after_scroll: list[Step] | None = None,
) -> list[Step]:
    """距离排序 → 滚动露出目标行 →（可选就地断言）→ 点行内"路线"按钮。

    ``after_scroll`` 在滚动完成、点"路线"离开结果列表之前插入——只在结果行上
    可见的证据（如评分）必须在这个窗口断言。
    """
    steps: list[Step] = [*sort_results_by_distance()]
    steps.extend(scroll_results(result_scrolls, summary_prefix="scroll result sheet to target result"))
    if after_scroll:
        steps.extend(after_scroll)
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


def route_between(*, mode: str = "driving") -> list[Step]:
    """从 {origin} 到 {destination} 的路线：两侧选点均由 _ROUTE_PICKS 查表派生。

    ``{origin_query}/{origin_main}/{origin_sub}`` 与
    ``{destination_query}/{destination_main}/{destination_sub}`` 按任务的
    ``origin`` / ``destination`` 参数查表渲染，覆盖 ``DRIVING_OD_PAIRS``
    白名单里的全部地名（采样器只会取这 4 对）。
    """
    steps: list[Step] = [
        *open_map(),
        click_selector("button.bg-teal-700:visible", "open route setup"),
        wait(0.5, summary="wait for route setup"),
        tap_action("routeSetup.open.originPicker", summary="open origin picker"),
        wait(0.4, summary="wait for origin picker"),
        type_text("{origin_query}", selector=ROUTE_ORIGIN_INPUT_SELECTOR, clear=True, summary="type route origin"),
        wait(0.6, summary="wait for origin predictions"),
        click_selector(
            route_prediction("{origin_main}", subtitle="{origin_sub}"),
            "select origin prediction",
        ),
        wait(1.0, summary="wait for origin selection"),
        tap_action("routeSetup.open.destinationPicker", summary="open destination picker"),
        wait(0.4, summary="wait for destination picker"),
        type_text(
            "{destination_query}",
            selector=ROUTE_DEST_INPUT_SELECTOR,
            clear=True,
            summary="type route destination",
        ),
        wait(0.6, summary="wait for destination predictions"),
        click_selector(
            route_prediction("{destination_main}", subtitle="{destination_sub}"),
            "select destination prediction",
        ),
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
    # 主题弹窗的单选标签与 criteria 存储值同串（apps/Map res/strings.ts
    # theme_light/dark/device），声明参数 {theme} 可直接渲染进选项定位。
    return [
        *open_settings(),
        click_selector(row_with_text("应用和显示", "App & display"), "open app display settings"),
        wait(0.2, summary="wait for app display"),
        click_selector(row_with_text("主题", "Theme"), "open theme modal"),
        wait(0.2, summary="wait for theme modal"),
        click_selector(radio_option("{theme}"), "select theme option"),
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


# ---------------------------------------------------------------------------
# Derived params — sampling-path compatibility
# ---------------------------------------------------------------------------
# Each calculator mirrors its task's judge (get_answer / check_goals in
# bench_env/task/map/tasks.py, defs/NorthResearchInstituteAnswer.py) through
# the same Map static-data accessors, so the typed/asserted values are
# judge-homologous by construction. None of them reads the episode state:
# Map judges compute expectations from apps/Map/data/{places,routes}.json.

# place 参数值 → (选点输入词, 预测行主文本, 副标题消歧子串)。
# 逐项按 places.json.autocomplete_index 与 routes.json 核验：三元组点中的 POI
# 与 Map.resolve_places(place)[0]（答案派生和判分 check_alternatives 首选支所
# 用候选）的 current> 距离/时长文本一致，OD 地名还需挂有 DRIVING_OD_PAIRS 的
# 离线路段。match_duration 判分为精确分钟匹配（无容差），因此"点中的 POI 与
# 派生 POI 文本一致"是硬约束，不能靠容差兜底。
_ROUTE_PICKS: dict[str, tuple[str, str, str]] = {
    # main="故宫" 的 place 预测行有两个（东城区 / 景山前街），OD 驾车段挂在
    # 景山前街 POI 上；三个同名候选的 current 距离/时长文本一致（14.5 公里/36分钟）。
    "故宫": ("故宫", "故宫", "景山前街"),
    # main="天安门广场" 有前门/东城区两行；故宫>天安门广场 段挂前门 POI。
    "天安门广场": ("天安门广场", "天安门广场", "前门"),
    # main="颐和园" 的 place 行唯一。
    "颐和园": ("颐和园", "颐和园", "海淀区"),
    # 查询"圆明园"的预测里没有可路由的 POI —— 判分候选首位（也是 OD 段目的地）
    # 是"圆明园遗址公园"，必须输入全名；副标题区分同名的清华西路行。
    "圆明园": ("圆明园遗址公园", "圆明园遗址公园", "北京市海淀区圆明园"),
    # 查询"国家图书馆"的预测主文本全是"中国国家图书馆"（精确匹配原词必落空）；
    # 判分候选首位/两条 OD 段都挂中关村南大街 POI。
    "国家图书馆": ("国家图书馆", "中国国家图书馆", "中关村南大街"),
    "中国国家博物馆": ("中国国家博物馆", "中国国家博物馆", "东长安街"),
    # 判分 alias 固定指向万柳店，预测只在完整名下出现。
    "北京华联": ("北京华联（万柳购物中心）", "北京华联（万柳购物中心）", "万柳中路"),
}


def _pick(param: str, index: int) -> Callable[[Any, dict[str, Any]], str]:
    """route-picker 三元组派生器：按任务的 place/origin/destination 参数查表。"""

    def fn(task: Any, state: dict[str, Any]) -> str:
        place = str(getattr(task.p, param))
        if place not in _ROUTE_PICKS:
            raise KeyError(
                f"no _ROUTE_PICKS entry for {param}={place!r}; the sampled value "
                "must be added to the verified route-picker table"
            )
        return _ROUTE_PICKS[place][index]

    return fn


_PLACE_PICK_PARAMS: dict[str, Callable[[Any, dict[str, Any]], str]] = {
    "place_query": _pick("place", 0),
    "place_main": _pick("place", 1),
    "place_sub": _pick("place", 2),
}

_OD_PICK_PARAMS: dict[str, Callable[[Any, dict[str, Any]], str]] = {
    "origin_query": _pick("origin", 0),
    "origin_main": _pick("origin", 1),
    "origin_sub": _pick("origin", 2),
    "destination_query": _pick("destination", 0),
    "destination_main": _pick("destination", 1),
    "destination_sub": _pick("destination", 2),
}


def _search_results(task: Any) -> list[dict[str, Any]]:
    """判分同源：Map.geo_search(category, limit=0)（tasks.py 各 get_answer/check_goals 同款）。"""
    return Map.geo_search(str(task.p.category), limit=0)


def _best_rated(task: Any) -> dict[str, Any]:
    """镜像 CheckHighestRatedPlace/FindBestRatedAndRoute/BestRatedWithWalkRoute 判分。"""
    return Map.best_rated_from_results(_search_results(task), max_distance_meters=task.p.radius)


def _nearest_rated(task: Any) -> dict[str, Any]:
    """镜像 FindNearestWithRating/NearestDetailAndWalkRoute 判分（全结果最近有评分）。"""
    return Map.nearest_rated_from_results(_search_results(task))


def _first_route_from_current(task: Any, mode: str) -> dict[str, Any]:
    """镜像 QueryDrivingDistance/CompareRouteDuration 判分 check_alternatives 的首选支。"""
    place = Map.resolve_places(str(task.p.place))[0]
    return Map.geo_route_from_current(str(place["place_id"]), mode)


def _drive_distance_answer(task: Any, state: dict[str, Any]) -> str:
    return str(_first_route_from_current(task, "DRIVING")["distance"])


def _route_steps_answer(task: Any, state: dict[str, Any]) -> str:
    """镜像 CheckRouteSuccess 判分：离线 OD 段（首个 triple）的前 3 步文本。"""
    _origin, _destination, route = Map.resolve_route_pairs(
        str(task.p.origin), str(task.p.destination), "DRIVING"
    )[0]
    return "；".join(Map.route_step_texts_from_api_route(route)[:3])


def _fastest_mode_answer(task: Any, state: dict[str, Any]) -> str:
    """镜像 CompareRouteDuration 判分 check_route_faster_mode_answer 的期望结论。"""
    walk = float(_first_route_from_current(task, "WALKING")["duration_seconds"])
    drive = float(_first_route_from_current(task, "DRIVING")["duration_seconds"])
    if walk < drive:
        return "步行更快"
    if drive < walk:
        return "开车更快"
    return "一样快"


def _driving_cost_answer(task: Any, state: dict[str, Any]) -> str:
    """镜像 EstimateDrivingCost 判分 check_driving_cost_answer（首候选路线 × 费率）。"""
    route = _first_route_from_current(task, "DRIVING")
    cost = (float(route["distance_meters"]) / 1000.0) * float(task.p.rate)
    return f"{cost:.2f}"


def _rating_rank_answer(task: Any, state: dict[str, Any]) -> str:
    """精确镜像 NearestInRadiusRatingRank.get_answer（半径内最近有评分者的评分排名）。"""
    in_radius = Map.filter_results(_search_results(task), max_distance_meters=task.p.radius)
    nearest = Map.nearest_rated_from_results(in_radius)
    return str(
        Map.rating_rank_from_results(
            in_radius,
            str(nearest["name"]),
            min_results=2,
            place_id=str(nearest["place_id"]),
        )
    )


def _north_institute_answer(task: Any, state: dict[str, Any]) -> str:
    """镜像 NorthResearchInstituteAnswer 判分常量：答案是任务类硬编码的正则
    （defs/NorthResearchInstituteAnswer.py），取其首个分支（规范全名）。"""
    pattern = getattr(getattr(task, "answer", None), "pattern", None)
    if not isinstance(pattern, str) or "|" not in pattern:
        raise ValueError("NorthResearchInstituteAnswer.answer regex changed shape; update the deriver")
    return pattern.split("|")[0]


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict[str, Any]], Any]]] = {
    "map.CheckDriveRoute": {**_PLACE_PICK_PARAMS},
    "map.CheckHighestRatedPlace": {
        "answer": lambda task, state: str(_best_rated(task)["name"]),
    },
    "map.CheckNearestPlaceAddress": {
        "answer": lambda task, state: Map.extract_address(
            Map.nearest_from_results(_search_results(task))
        ),
    },
    "map.QueryDrivingDistance": {
        **_PLACE_PICK_PARAMS,
        "answer": _drive_distance_answer,
    },
    "map.CheckRouteSuccess": {
        **_OD_PICK_PARAMS,
        "answer": _route_steps_answer,
    },
    "map.FindBestRatedAndRoute": {
        "target_place": lambda task, state: str(_best_rated(task)["name"]),
        "answer_name": lambda task, state: str(_best_rated(task)["name"]),
        "answer_distance": lambda task, state: str(
            Map.geo_route_from_current(str(_best_rated(task)["place_id"]), "DRIVING")["distance"]
        ),
    },
    "map.FindNearestWithRating": {
        "answer_name": lambda task, state: str(_nearest_rated(task)["name"]),
        "answer_rating": lambda task, state: str(Map.extract_rating(_nearest_rated(task))),
    },
    "map.CompareRouteDuration": {
        **_PLACE_PICK_PARAMS,
        "answer_fastest": _fastest_mode_answer,
        "answer_walk_duration": lambda task, state: str(
            _first_route_from_current(task, "WALKING")["duration"]
        ),
        "answer_drive_duration": lambda task, state: str(
            _first_route_from_current(task, "DRIVING")["duration"]
        ),
    },
    "map.FindNearestAndRoute": {
        "target_place": lambda task, state: str(
            Map.nearest_from_results(_search_results(task))["name"]
        ),
    },
    "map.EstimateDrivingCost": {
        **_PLACE_PICK_PARAMS,
        "answer": _driving_cost_answer,
    },
    "map.NearestInRadiusRatingRank": {
        "answer": _rating_rank_answer,
    },
    "map.BestRatedWithWalkRoute": {
        "target_place": lambda task, state: str(_best_rated(task)["name"]),
        "answer_name": lambda task, state: str(_best_rated(task)["name"]),
        "answer_distance": lambda task, state: str(
            Map.geo_route_from_current(str(_best_rated(task)["place_id"]), "WALKING")["distance"]
        ),
    },
    "map.NearestDetailAndWalkRoute": {
        "target_place": lambda task, state: str(_nearest_rated(task)["name"]),
        "answer_name": lambda task, state: str(_nearest_rated(task)["name"]),
        "answer_rating": lambda task, state: str(Map.extract_rating(_nearest_rated(task))),
        "answer_duration": lambda task, state: str(
            Map.geo_route_from_current(str(_nearest_rated(task)["place_id"]), "WALKING")["duration"]
        ),
    },
    "map.NorthResearchInstituteAnswer": {
        "answer": _north_institute_answer,
    },
}


# 就地自证 lint（R1/R2）豁免清单——理由必填，豁免项会在 lint 报告中单列。
LINT_EXEMPT: dict[str, str] = {
    # 屏上任何断言都必然失败：App 数据层（places.json / search_index）没有可响应
    # "研究所"查询的 POI，期望答案只存在于底图瓦片标注（详见下方 PLANS 内注释）。
    # 硬插证据断言只会把"任务设计缺陷"伪装成 plan 回放失败。
    "map.NorthResearchInstituteAnswer": "答案不在 App 数据层，任务设计缺陷候选，待任务侧决策",
}

PLANS: dict[str, list[Step]] = {
    "map.CheckDriveRoute": [
        *route_to_place(mode="driving"),
        complete(),
    ],
    "map.CheckHighestRatedPlace": [
        *search_map("{category}"),
        # deep-dive 浏览：最高评分地点在相关性序中的行位随 category 采样漂移
        # （咖啡馆#2 … 购物中心#36/酒店#38），首屏虚拟分页只渲染 20 行。翻页到
        # 列表绝对末尾（slice(0,n) 只增不卸载，翻过的行留在 DOM），使任意行位的
        # 名称都能被 assert_answer 命中（其文本采集不裁剪视口，只要求已渲染）。
        *browse_results(22),
        # 就地自证：先断言名称可见（全列表已渲染）再作答，证明答案读自屏幕而非直填。
        assert_answer("{answer}", field_index=0, summary="assert best rated place name on screen"),
        *grounded_answer("{answer}", summary="submit highest rated place answer"),
        complete(),
    ],
    "map.CheckNearestPlaceAddress": [
        *search_map("{category}"),
        # 地址不在结果行内：距离排序后最近地点即第 0 行，点开详情页读 AddressCard。
        # 采样鲁棒：nearest 恒为距离序第 1 行，与 category 取值无关。
        *sort_results_by_distance(),
        *open_nearest_result_detail(),
        # 就地自证：断言 AddressCard 上的地址可见。判分期望值是去"中国"前缀、去邮编
        # 后缀的规整地址，规整化包含可命中屏上完整地址文本。
        assert_answer("{answer}", field_index=0, summary="assert nearest place address on screen"),
        *grounded_answer("{answer}", summary="submit nearest place address"),
        complete(),
    ],
    "map.SetMapNorthUp": [
        *set_north_up(),
        complete(),
    ],
    "map.QueryDrivingDistance": [
        *route_to_place(mode="driving"),
        # 就地自证：驾车距离在路线页头部"36分钟 (14.5 公里)"里，断言可见后再作答
        # （文本 matcher 规整化包含，空格差异无碍）。
        assert_answer("{answer}", field_index=0, summary="assert driving distance on screen"),
        *grounded_answer("{answer}", summary="submit driving distance"),
        complete(),
    ],
    "map.CheckRouteSuccess": [
        *route_between(mode="driving"),
        # 分步导航文本只在 route sheet 拖到近全屏的 expanded 态渲染；{answer}
        # （前 3 步导航文本拼接）即读自该展开列表，断言背书之。
        *expand_route_sheet(endorses=["answer"]),
        *grounded_answer("{answer}", summary="submit route steps"),
        *return_to_map(),
        complete(),
    ],
    # 【采样豁免·滚动行位耦合】result_scrolls=2 按默认 category=咖啡馆 的距离序
    # 行位（best#8）标定；其他采样值下目标行位在 #2~#14 间漂移，固定滚动次数会
    # 让行内"路线"按钮不在视口（env 不做隐式滚动，视口外点不到）。行位是数据布局
    # 事实而非任务参数，受限 Branch 也无法按 category×radius 组合枚举穷举——
    # 完全采样化需要 read_text 类读屏机制（滚动中检测目标行进入视口再停）。
    "map.FindBestRatedAndRoute": [
        *search_map("{category}"),
        *route_visible_result("{target_place}", mode="driving", result_scrolls=2),
        # 就地自证：路线顶栏目的地即最高评分地点名，路线页头部"时长 (距离)"含驾车距离。
        assert_answer("{answer_name}", field_index=0, summary="assert best rated place name on route page"),
        assert_answer("{answer_distance}", field_index=1, summary="assert driving distance on screen"),
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
    # 【采样豁免·滚动行位耦合】scroll_results(2) 按默认 category=咖啡馆 的距离序
    # 行位（nearest_rated#6）标定；其他采样值下行位在 #1~#14 间漂移（#1 会被滚出
    # 视口、#14 滚不到），行级评分断言 rated_result_row 是视口敏感的 assert_visible。
    "map.FindNearestWithRating": [
        *search_map("{category}"),
        # 最近的有评分地点（麦咖啡，距离序第 6 行）不在首屏：距离排序后滚动使行内名称+评分可见。
        *sort_results_by_distance(),
        *scroll_results(2, summary_prefix="scroll to nearest rated result"),
        # 就地自证：名称走判分 matcher；评分为纯短数字改走行级数值绑定（见 rated_result_row）。
        assert_answer("{answer_name}", field_index=0, summary="assert nearest rated place name on screen"),
        assert_visible(
            rated_result_row("{answer_name}", "{answer_rating}"),
            summary="assert rating on the nearest rated result row",
        ),
        *grounded_answer("{answer_name}", "{answer_rating}", summary="submit nearest rating answer"),
        complete(),
    ],
    "map.CompareRouteDuration": [
        *route_to_place(mode="driving"),
        # 就地自证：结论字段（answer_fastest"步行更快/开车更快"）屏上没有——它是对
        # 两个模式时长的比较推理；证据是两个时长同屏可见：驾车时长在路线页头部与
        # 驾车 tab，步行时长在步行 tab（路线页各交通方式 tab 自带该模式时长）。
        # 双时长断言合证比较依据，收尾断言背书 {answer_fastest}。
        assert_answer("{answer_walk_duration}", field_index=1, summary="assert walking duration on screen"),
        assert_answer(
            "{answer_drive_duration}",
            field_index=2,
            summary="assert driving duration on screen",
            endorses=["answer_fastest"],
        ),
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
        # 采样鲁棒：nearest 恒为距离序第 1 行（排序后无需滚动即可点行内"路线"）。
        *route_visible_result("{target_place}", mode="driving"),
        complete(),
    ],
    "map.EstimateDrivingCost": [
        *route_to_place(mode="driving"),
        # 就地自证（证据断言）：油费=距离×费率是推理值，屏上只有距离；而距离本身
        # 不是本任务注入参数（answer 只有费用数值），无法 assert_answer 逐字段——
        # 断言路线页头部的距离栏（RouteDetailSheet 的"(14.5 公里)"span）可见，
        # 证明估算依据读自屏幕，背书 {answer}。
        assert_visible(
            '[data-adjust-resize] div.shadow-up.rounded-t-2xl '
            'span.text-lg.text-gray-600:text-matches("公里|千米|km|米"):visible',
            summary="assert route distance figure on screen",
            endorses=["answer"],
        ),
        *grounded_answer("{answer}", summary="submit driving cost"),
        complete(),
    ],
    "map.NearestInRadiusRatingRank": [
        *search_map("{category}"),
        # deep_dive：排名需要浏览半径内全部同类评分。距离排序后连续翻页浏览到列表
        # 绝对末尾（各 category 全列表 56~60 行；~3 行/次 × 22 次含越界余量——列表
        # 到底后滚动钳制，多余滑动无害），完整覆盖半径内条目。浏览深度对采样鲁棒：
        # radius 只影响判分计算，不影响"翻到底"这个行为。
        *sort_results_by_distance(),
        *browse_results(22),
        # 就地自证（证据断言）："第 N 名"排名屏上不存在（对半径内同类评分的推理值），
        # 无法 assert_answer；断言浏览终点：列表最后一行（末端结果行）在屏，证明
        # 排名依据的结果列表已翻阅到底，背书 {answer}。
        assert_visible(
            'xpath=(//div[contains(@class,"place-results-sheet-container")]'
            '//div[@data-action="placeResults.result.select.item"])[last()]',
            summary="assert result list browsed to its last row",
            endorses=["answer"],
        ),
        *grounded_answer("{answer}", summary="submit rating rank"),
        complete(),
    ],
    # 【采样豁免·滚动行位耦合】同 FindBestRatedAndRoute：result_scrolls=2 按
    # 咖啡馆行位标定，目标行位随 category/radius 采样漂移。
    "map.BestRatedWithWalkRoute": [
        *search_map("{category}"),
        *route_visible_result("{target_place}", mode="walking", result_scrolls=2),
        # 就地自证：路线顶栏目的地即最高评分地点名；切步行后头部"时长 (距离)"含步行距离。
        assert_answer("{answer_name}", field_index=0, summary="assert best rated place name on route page"),
        assert_answer("{answer_distance}", field_index=1, summary="assert walking distance on screen"),
        *grounded_answer("{answer_name}", "{answer_distance}", summary="submit best rated walk answer"),
        *return_to_map(),
        complete(),
    ],
    # 【采样豁免·滚动行位耦合】同 FindNearestWithRating：result_scrolls=1 按
    # 咖啡馆 nearest_rated#6 标定，行级评分断言视口敏感，行位随 category 漂移。
    "map.NearestDetailAndWalkRoute": [
        *search_map("{category}"),
        *route_visible_result(
            "{target_place}",
            mode="walking",
            result_scrolls=1,
            # 就地自证：评分只在结果行上（路线页不显示），必须在点"路线"离开列表前
            # 断言；评分为纯短数字改走行级数值绑定（见 rated_result_row）。
            after_scroll=[
                assert_answer("{answer_name}", field_index=0, summary="assert nearest rated place name on screen"),
                assert_visible(
                    rated_result_row("{answer_name}", "{answer_rating}"),
                    summary="assert rating on the nearest rated result row",
                ),
            ],
        ),
        # 就地自证：步行时长在路线页头部"时长 (距离)"（duration matcher 容忍时长格式差异）。
        assert_answer("{answer_duration}", field_index=2, summary="assert walking duration on screen"),
        *grounded_answer("{answer_name}", "{answer_rating}", "{answer_duration}", summary="submit nearest detail walk answer"),
        complete(),
    ],
    # 任务设计缺陷候选（保留现有步骤，勿在 plan 层"修复"）：App 数据层没有任何"研究所"POI——
    # places.json（843 个地点）与 search_index 均无匹配，搜索"研究所"必然空结果；
    # autocomplete_index 仅在"北京华联"词条下带出"北京华联机电技术研究所"（朝阳区，不响应"研究所"查询）。
    # 期望答案"中国科学院物理研究所"只存在于底图瓦片标注数据（apps/Map/sw/files/*.js 缓存的
    # tile API 响应），Agent 只能读地图画面上的瓦片标注作答；判分器
    # （bench_env/task/map/defs/NorthResearchInstituteAnswer.py）check_goals 仅验答案正则
    # （含否定式防护），无操作/状态前置检查（expected_changes 只是副作用允许清单），
    # 因此本 plan 即使搜索空结果也能通过。修复方向（给 places.json 补"研究所"POI，
    # 或改写任务/判分）由任务作者决策。采样兼容：answer 派生自判分器的常量正则
    # （无参数任务，实例恒同）。
    "map.NorthResearchInstituteAnswer": [
        *search_map("研究所"),
        *grounded_answer("{answer}", summary="submit north research institute answer"),
        complete(),
    ],
}
