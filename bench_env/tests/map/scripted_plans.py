"""Scripted replay plans for Map tasks."""

from __future__ import annotations

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


def expand_route_sheet() -> list[Step]:
    """Drag the route sheet from the MEDIUM snap to the near-fullscreen EXPANDED snap.

    After route calculation the sheet rests at MEDIUM (300 app px; only
    "duration (distance)" is shown). Step-by-step navigation text renders only
    in the expanded state (RouteDetailSheet ``isExpanded`` branch), so drag the
    sheet handle (norm y≈683 at MEDIUM under the 412-design-width zoom) up
    before reading directions; the trailing assert hard-fails if the sheet did
    not actually expand.
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


# 就地自证 lint（R1/R2）豁免清单——理由必填，豁免项会在 lint 报告中单列。
LINT_EXEMPT: dict[str, str] = {
    # 屏上任何断言都必然失败：App 数据层（places.json / search_index）没有可响应
    # "研究所"查询的 POI，期望答案只存在于底图瓦片标注（详见下方 PLANS 内注释）。
    # 硬插证据断言只会把"任务设计缺陷"伪装成 plan 回放失败。
    "map.NorthResearchInstituteAnswer": "答案不在 App 数据层，任务设计缺陷候选，待任务侧决策",
}

PLANS: dict[str, list[Step]] = {
    "map.CheckDriveRoute": [
        *route_to_place("{place}", mode="driving"),
        complete(),
    ],
    "map.CheckHighestRatedPlace": [
        *search_map("{category}"),
        # 就地自证：搜索结果默认相关性排序，默认参数（咖啡馆）下最高评分地点位于
        # 首屏第 2 行，名称直接可见；先断言可见再作答，证明答案读自屏幕而非直填。
        assert_answer("{answer}", field_index=0, summary="assert best rated place name on screen"),
        *grounded_answer("{answer}", summary="submit highest rated place answer"),
        complete(),
    ],
    "map.CheckNearestPlaceAddress": [
        *search_map("{category}"),
        # 地址不在结果行内：距离排序后最近地点即第 0 行，点开详情页读 AddressCard。
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
        *route_to_place("{place}", mode="driving"),
        # 就地自证：驾车距离在路线页头部"36分钟 (14.5 公里)"里，断言可见后再作答
        # （文本 matcher 规整化包含，空格差异无碍）。
        assert_answer("{answer}", field_index=0, summary="assert driving distance on screen"),
        *grounded_answer("{answer}", summary="submit driving distance"),
        complete(),
    ],
    "map.CheckRouteSuccess": [
        *route_between("{origin}", "{destination}", mode="driving", origin_subtitle="景山前街"),
        # 分步导航文本只在 route sheet 拖到近全屏的 expanded 态渲染。
        *expand_route_sheet(),
        *grounded_answer("{answer}", summary="submit route steps"),
        *return_to_map(),
        complete(),
    ],
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
    "map.FindNearestWithRating": [
        *search_map("{category}"),
        # 最近的有评分地点（如"麦咖啡"，距离序第 5 行）不在首屏：距离排序后滚动使行内名称+评分可见。
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
        *route_to_place("{place}", mode="driving"),
        # 就地自证：结论字段（answer_fastest"步行更快/开车更快"）屏上没有——它是对
        # 两个模式时长的比较推理；证据是两个时长同屏可见：驾车时长在路线页头部与
        # 驾车 tab，步行时长在步行 tab（路线页各交通方式 tab 自带该模式时长）。
        assert_answer("{answer_walk_duration}", field_index=1, summary="assert walking duration on screen"),
        assert_answer("{answer_drive_duration}", field_index=2, summary="assert driving duration on screen"),
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
        # 就地自证（证据断言）：油费=距离×费率是推理值，屏上只有距离；而距离本身
        # 不是本任务注入参数（answer 只有费用数值），无法 assert_answer 逐字段——
        # 断言路线页头部的距离栏（RouteDetailSheet 的"(14.5 公里)"span）可见，
        # 证明估算依据读自屏幕。
        assert_visible(
            '[data-adjust-resize] div.shadow-up.rounded-t-2xl '
            'span.text-lg.text-gray-600:text-matches("公里|千米|km|米"):visible',
            summary="assert route distance figure on screen",
        ),
        *grounded_answer("{answer}", summary="submit driving cost"),
        complete(),
    ],
    "map.NearestInRadiusRatingRank": [
        *search_map("{category}"),
        # deep_dive：排名需要浏览半径内全部同类评分。距离排序后连续翻页浏览到列表
        # 绝对末尾（默认参数下全列表 60 行、2000m 内 41 行；~3 行/次 × 22 次含越界
        # 余量——列表到底后滚动钳制，多余滑动无害），完整覆盖半径内条目。
        *sort_results_by_distance(),
        *browse_results(22),
        # 就地自证（证据断言）："第 N 名"排名屏上不存在（对半径内同类评分的推理值），
        # 无法 assert_answer；断言浏览终点：列表最后一行（末端结果行）在屏，证明
        # 排名依据的结果列表已翻阅到底。
        assert_visible(
            'xpath=(//div[contains(@class,"place-results-sheet-container")]'
            '//div[@data-action="placeResults.result.select.item"])[last()]',
            summary="assert result list browsed to its last row",
        ),
        *grounded_answer("{answer}", summary="submit rating rank"),
        complete(),
    ],
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
    # 或改写任务/判分）由任务作者决策。
    "map.NorthResearchInstituteAnswer": [
        *search_map("研究所"),
        *grounded_answer("{answer}", summary="submit north research institute answer"),
        complete(),
    ],
}
