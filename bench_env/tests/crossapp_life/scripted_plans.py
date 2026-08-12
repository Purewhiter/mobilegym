"""Scripted replay plans for cross-app life tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
    assert_answer,
    awake,
    back,
    complete,
    enter,
    grounded_answer,
    home,
    open_answer_sheet,
    submit_answer_sheet,
    swipe,
    tap_trigger,
    type_text,
    wait,
)
from bench_env.tests.crossapp_commerce.scripted_plans import open_alipay_balance
from bench_env.tests.crossapp_work.scripted_plans import (
    open_gallery_album,
    open_wechat_chat,
    select_calendar_day,
    view_gallery_photos,
)
from bench_env.tests.map.scripted_plans import (
    result_route_button,
    result_sort_button,
    route_to_place,
    search_map,
)
from bench_env.tests.railway12306.scripted_plans import (
    book_visible_train,
    open_my_account,
    open_my_tickets,
    query_route,
)
from bench_env.tests.weather.scripted_plans import (
    open_daily_forecast,
    select_city,
    swipe_forecast_days,
)


def click_selector(selector: str, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def wheel_scroll(
    selector: str,
    current: str,
    target: str,
    modulo: int,
    summary: str,
    *,
    max_delta_per_swipe: int = 1,
) -> Step:
    step: Step = {
        "op": "wheel_scroll",
        "selector": selector,
        "current": current,
        "target": target,
        "modulo": modulo,
        "summary": summary,
        "max_delta_per_swipe": max_delta_per_swipe,
    }
    step.update(
        {
            "start_y_fraction": 0.68,
            "reverse_start_y_fraction": 0.32,
            "delta_y_fraction": 0.134,
        }
    )
    return step


def open_app(app: str, *, home_first: bool = True, settle: float = 0.8) -> list[Step]:
    steps: list[Step] = []
    if home_first:
        steps.append(home(summary="return to launcher"))
    steps.append(awake(app, summary=f"launch {app}"))
    if settle > 0:
        steps.append(wait(settle, summary=f"wait for {app} foreground"))
    return steps


def trigger_param(trigger_id: str, key: str, value: str, summary: str) -> Step:
    return click_selector(
        f'[data-trigger="{trigger_id}"][data-trigger-params*=\'"{key}":"{value}"\']:visible',
        summary,
    )


def send_wechat_message(
    content: str,
    *,
    contact_wxid: str = "{contact_wxid}",
    via_contacts: bool = False,
    home_first: bool = True,
    compact: bool = False,
    ensure_root: bool = False,
) -> list[Step]:
    steps = [
        *open_app("WeChat", home_first=home_first, settle=0 if compact else 0.8),
    ]
    if ensure_root:
        steps.extend(
            [
                back(summary="normalize WeChat to chat list"),
                awake("WeChat", summary="return to WeChat chat list"),
                wait(0.3, summary="wait for WeChat chat list"),
            ]
        )
    if via_contacts:
        steps.extend(
            [
                back(summary="normalize WeChat to a main tab"),
                awake("WeChat", summary="return to WeChat root"),
                wait(0.3, summary="wait for WeChat root"),
                click_selector('[data-trigger="tab.contacts"]:visible', "open WeChat contacts tab"),
                wait(0.4, summary="wait for WeChat contacts"),
                trigger_param("userProfile.open", "id", contact_wxid, "open WeChat contact profile"),
                wait(0.4, summary="wait for contact profile"),
                trigger_param("chat.open", "id", contact_wxid, "open WeChat contact chat"),
            ]
        )
    else:
        steps.append(trigger_param("chat.open", "id", contact_wxid, "open WeChat contact chat"))
    steps.extend(
        [
        *([] if compact else [wait(0.5, summary="wait for chat")]),
        type_text(content, selector="textarea:visible", clear=True, summary="type WeChat message"),
        click_selector("button.bg-app-primary:visible", "send WeChat message"),
        *([] if compact else [wait(0.5, summary="wait for WeChat send")]),
        ]
    )
    return steps


def grounded_text_then_choice(text: str, choice: str, *, summary: str | None = None) -> list[Step]:
    return [
        *open_answer_sheet(),
        type_text(
            text,
            selector='[data-scroll-container="sheet-form"] div.space-y-5 > div:nth-child(1) input',
            clear=True,
            summary=f"fill answer text: {text!r}",
        ),
        back(summary="dismiss keyboard before selecting choice"),
        click_selector(
            f'xpath=(//div[@data-scroll-container="sheet-form"]//button[normalize-space()="{choice}"])[1]',
            f"choose answer {choice}",
        ),
        submit_answer_sheet(summary=summary),
    ]


def send_sms_message(content: str, *, recipient: str = "{sms_contact}") -> list[Step]:
    return [
        *open_app("短信"),
        back(summary="normalize SMS to conversation list"),
        awake("短信", summary="return to SMS conversation list"),
        wait(0.3, summary="wait for SMS conversation list"),
        click_selector("button.absolute.bottom-6.right-6:visible", "open SMS composer"),
        type_text(recipient, selector="input:visible", clear=True, summary="type SMS recipient"),
        click_selector(f'button:has-text("{recipient}"):visible', "select SMS contact suggestion"),
        type_text(content, selector='input:visible >> nth=1', clear=True, summary="type SMS body"),
        click_selector("button[aria-disabled=false]:visible", "send SMS"),
        wait(0.6, summary="wait for SMS send"),
    ]


def create_note(title: str, content: str) -> list[Step]:
    return [
        *open_app("Notes"),
        click_selector('button[aria-label="新建笔记"]:visible', "create new note"),
        wait(0.4, summary="wait for note editor"),
        type_text(title, selector='input[placeholder="标题"]:visible', clear=True, summary="type note title"),
        type_text(content, selector="textarea:visible", clear=True, summary="type note content"),
        back(summary="leave note editor"),
        wait(0.8, summary="wait for note autosave"),
    ]


def open_calendar_event_form(date_value: str, *, compact: bool = False) -> list[Step]:
    steps: list[Step] = [
        *open_app("日历", settle=0 if compact else 0.8),
        click_selector('button[aria-label="更多"]:visible', "open Calendar more menu"),
    ]
    if not compact:
        steps.append(wait(0.3, summary="wait for Calendar action sheet"))
    steps.append(click_selector('button:has-text("日期跳转"):visible', "open date jump"))
    if not compact:
        steps.append(wait(0.4, summary="wait for date jump page"))
    steps.extend(
        [
            type_text(date_value, selector='input[type="date"]:visible', clear=True, summary="enter target date"),
            click_selector('button:has-text("跳转"):visible', "jump to target date"),
        ]
    )
    if not compact:
        steps.append(wait(0.5, summary="wait for Calendar home on target date"))
    steps.append(click_selector('button[aria-label="新建"]:visible', "open new event page"))
    if not compact:
        steps.append(wait(0.5, summary="wait for event form"))
    return steps


def save_calendar_event() -> Step:
    return click_selector(
        'xpath=(//h1[normalize-space()="创建日程" or normalize-space()="Create Event"]'
        '/preceding::button[contains(@class,"p-2")][1])',
        "save event form",
    )


def set_event_reminder(option_label: str) -> list[Step]:
    return [
        click_selector(
            'xpath=//span[normalize-space()="提醒"]/ancestor::div[contains(@class,"justify-between")][1]//button',
            "open event reminder sheet",
        ),
        wait(0.2, summary="wait for reminder sheet"),
        click_selector(f'button:has-text("{option_label}"):visible', f"choose reminder {option_label}"),
        wait(0.3, summary="wait for reminder sheet to close"),
    ]


def toggle_calendar_row(label: str) -> Step:
    return click_selector(
        f'xpath=//span[normalize-space()="{label}"]/ancestor::div[contains(@class,"justify-between")][1]//div[contains(@class,"rounded-full")]',
        f"toggle calendar row {label}",
    )


def create_calendar_event(
    date_value: str,
    title: str,
    *,
    start: str = "09:00",
    end: str = "10:00",
    reminder: str | None = None,
    alarm: bool = False,
    all_day: bool = False,
    notes: str | None = None,
    compact: bool = False,
) -> list[Step]:
    steps = [
        *open_calendar_event_form(date_value, compact=compact),
        type_text(title, selector='input[placeholder="请输入日程标题"]:visible', clear=True, summary="type event title"),
    ]
    if all_day:
        steps.append(toggle_calendar_row("全天事件"))
        steps.append(wait(0.2, summary="wait for all-day toggle"))
    else:
        steps.extend(
            [
                type_text(start, selector='input[placeholder="09:00"]:visible', clear=True, summary="type event start"),
                enter(summary="commit start time"),
                type_text(end, selector='input[placeholder="10:00"]:visible', clear=True, summary="type event end"),
                enter(summary="commit end time"),
            ]
        )
    if reminder:
        steps.extend(set_event_reminder(reminder))
    if alarm:
        steps.append(toggle_calendar_row("闹钟提醒"))
    if notes:
        steps.append(type_text(notes, selector='input[placeholder="请输入备注"]:visible', clear=True, summary="type event notes"))
    steps.append(save_calendar_event())
    if not compact:
        steps.append(wait(0.8, summary="wait for calendar event save"))
    return steps


def add_default_alarm() -> list[Step]:
    return [
        *open_app("时钟"),
        click_selector('button:has-text("闹钟"):visible', "open Alarm tab"),
        wait(0.3, summary="wait for Alarm tab"),
        click_selector('xpath=//button[contains(@class,"bottom-[112px]")]', "open add alarm sheet"),
        wait(0.5, summary="wait for add alarm sheet"),
        click_selector('xpath=(//div[contains(@class,"z-40")]//button[contains(@class,"w-10")])[2]', "save alarm sheet"),
        wait(0.6, summary="wait for alarm creation"),
    ]


def alarm_list_scroll_down(summary: str = "scroll alarm list down") -> Step:
    return {
        "op": "swipe",
        "selector": "div.h-full.overflow-y-auto.no-scrollbar:visible",
        "start_fraction": 0.5,
        "end_fraction": 0.5,
        "start_y_fraction": 0.78,
        "end_y_fraction": 0.42,
        "duration_ms": 260,
        "summary": summary,
    }


def alarm_time_button(time_text: str) -> str:
    return f'button:visible:has(span:text-is("{time_text}"))'


def _wheel_by_label(zh_label: str, en_label: str) -> str:
    return (
        f'xpath=(//span[normalize-space()="{zh_label}" or normalize-space()="{en_label}"]'
        f'/following-sibling::div[contains(@class,"overflow-y-scroll")])[1]'
    )


def set_alarm_time(
    source_time: str,
    target_hour: str,
    target_minute: str,
    *,
    source_hour: str,
    source_minute: str,
    max_delta_per_swipe: int = 1,
    compact: bool = False,
    scroll_to_source: bool = False,
) -> list[Step]:
    steps: list[Step] = [*open_app("时钟", home_first=False, settle=0 if compact else 0.8)]
    steps.append(click_selector('button:has-text("闹钟"):visible', "open Alarm tab"))
    if not compact:
        steps.append(wait(0.3, summary="wait for Alarm tab"))
    if scroll_to_source:
        steps.append(alarm_list_scroll_down(f"scroll to alarm {source_time}"))
        if not compact:
            steps.append(wait(0.2, summary="wait for alarm list scroll"))
    steps.append(click_selector(alarm_time_button(source_time), f"open alarm {source_time} editor"))
    if not compact:
        steps.append(wait(0.4, summary="wait for quick alarm editor"))
    steps.append(click_selector('button:has-text("更多设置"):visible', "open full alarm settings"))
    if not compact:
        steps.append(wait(0.5, summary="wait for full alarm editor"))
    steps.extend(
        [
            wheel_scroll(
                _wheel_by_label("时", "H"),
                source_hour,
                target_hour,
                24,
                "set alarm hour",
                max_delta_per_swipe=max_delta_per_swipe,
            ),
            wheel_scroll(
                _wheel_by_label("分", "M"),
                source_minute,
                target_minute,
                60,
                "set alarm minute",
                max_delta_per_swipe=max_delta_per_swipe,
            ),
            click_selector(
                'xpath=(//div[contains(@class,"z-40")]//button[contains(@class,"w-10")])[2]',
                "save alarm time",
            ),
        ]
    )
    if not compact:
        steps.append(wait(0.6, summary="wait for alarm update"))
    return steps


def railway_query(from_station: str, to_station: str, date_value: str) -> list[Step]:
    return [
        *query_route(from_station, to_station, date_value),
    ]


def railway_book(from_station: str, to_station: str, date_value: str) -> list[Step]:
    return [
        *railway_query(from_station, to_station, date_value),
        *book_visible_train("{train_no}", "{seat_type}", "{passenger_name}"),
    ]


def open_weather_city(
    city: str,
    *,
    select: bool = False,
    forecast_swipes: int | None = None,
) -> list[Step]:
    """Open Weather with the info-gathering path the task needs.

    - ``select=True``：episode 固定从 located 城市（北京）首页开始，目标城市
      非北京时要经城市管理页点卡片切换（weather 套件 select_city 已修模式）。
    - ``forecast_swipes is not None``：目标日期超出首页 3 日短卡（今天/明天/后天）
      时进「查看15日天气预报」页；首屏约 5 列（72px/列），一次强横扫推进约 5-6 列，
      横扫为 best-effort，取数硬失败语义由 tap 类步骤承担。
    """
    steps: list[Step] = [*open_app("天气")]
    if select:
        steps.extend(select_city(city))
    else:
        steps.append(wait(0.5, summary=f"inspect weather for {city}"))
    if forecast_swipes is not None:
        steps.extend(open_daily_forecast())
        for index in range(forecast_swipes):
            steps.append(swipe_forecast_days(span=f"target-date window {index + 1}/{forecast_swipes}"))
    return steps


def open_place_detail(place_name: str) -> list[Step]:
    """Tap a Map search-result card by name to open its PlaceDetailSheet.

    结果列表卡片只有名称/评分/距离，地址在详情页 AddressCard 上——判分需要
    地址的任务必须点开目标地点详情。同名多卡时 env 取第一个可见匹配
    （按距离排序后即最近门店）。
    """
    return [
        click_selector(
            f'.place-results-sheet-container h3:text-is("{place_name}"):visible',
            f"open {place_name} place detail",
        ),
        wait(1.0, summary=f"read {place_name} address on detail sheet"),
    ]


def sort_results_by_distance() -> list[Step]:
    """Switch the Map results sheet sort to 距离（最近优先）——map 套件
    route_visible_result 已验证的排序菜单路径。"""
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


def open_route_to_result(place_name: str) -> list[Step]:
    """Tap 路线 on the named result card; the driving route sheet shows the
    DRIVING distance the conditional branch depends on."""
    return [
        click_selector(result_route_button(place_name), f"open driving route to {place_name}"),
        wait(1.5, summary="read driving distance on route sheet"),
    ]


# 条件分支任务的 R3 豁免：注入场景（湘临天下酒楼）驾车距离 < 2 公里，走微信
# 邀请分支；判分在该分支明确要求短信 App 零新增发送（sms_no_extra），正确轨迹
# 不打开短信，awake("短信") 覆盖不适用。
LINT_EXEMPT: dict[str, str] = {
    "crossapp_life.TopRatedNearbyPlaceConditionalWechatOrSmsInvite": (
        "条件分支任务：注入场景驾车距离<2公里走微信邀请分支，"
        "判分要求短信 App 零新增发送（sms_no_extra），正确轨迹不打开短信，"
        "R3 awake 覆盖不适用"
    ),
}

PLANS: dict[str, list[Step]] = {
    "crossapp_life.MapPlaceToWechat": [
        # 判分需要地址：结果卡片不含地址，点开目标地点详情页读 AddressCard。
        *search_map("{place}"),
        *open_place_detail("{place}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.WeatherShareMetric": [
        *open_weather_city("{city}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.WeatherReportToNotes": [
        *open_weather_city("{city}"),
        *create_note("天气记录", "{note_content}"),
        complete(),
    ],
    "crossapp_life.WeatherFilterNonRainyDays": [
        # 未来五天超出首页 3 日短卡，进 15 日预报页（首屏约 5 列 + 一次横扫）。
        *open_weather_city("{city}", forecast_swipes=1),
        *create_note("适合出行的日子", "{note_content}"),
        complete(),
    ],
    "crossapp_life.WeatherRainBranchNotify": [
        *open_weather_city("{city}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.RailwayTrainInfoToWechat": [
        *railway_query("{from_station}", "{to_station}", "{date}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.RailwayPriceVsBalance": [
        *railway_query("{from_station}", "{to_station}", "{date}"),
        # 证据断言：最便宜二等座 ¥110 出现在查询结果页（卡片渲染 "¥110起"，
        # 目录价与日期无关；scope 收窄到 12306 页面容器）。
        assert_answer(
            "110",
            field_index=0,
            scope='[data-scroll-container="main"]',
            summary="assert cheapest second-class price on query results",
        ),
        # 余额在 支付宝 → 我的 → 余额页（crossapp_commerce 已验证路径）。
        *open_alipay_balance(),
        *grounded_text_then_choice(
            "{answer_price}",
            "{answer_afford}",
            summary="answer cheapest train price and balance affordability",
        ),
        complete(),
    ],
    "crossapp_life.RailwayDestWeatherQuery": [
        # 到达日期在 12306「订单 → 本人车票」页（_post_sample 注入的去 {city} 车票，
        # 滚动为 best-effort）；再切天气到 {city}，进 15 日预报页横扫到到达日
        # （注入日期在未来 1-10 天内，两次强横扫覆盖）。
        *open_my_tickets(),
        swipe([500, 720], [500, 280], summary="scroll my tickets to the {city} ticket"),
        wait(0.3, summary="read the {city} ticket travel date"),
        *open_weather_city("{city}", select=True, forecast_swipes=2),
        # 证据断言：到达日最高/最低温出现在 15 日预报页（列全量渲染，scope
        # 收窄到预报横滚容器；天气文案为昼夜合并注入值，无法整串包含匹配）。
        assert_answer(
            "{answer_high}",
            field_index=1,
            scope='[data-scroll-container="forecast"]',
            summary="assert arrival-day high temp on 15-day forecast",
        ),
        assert_answer(
            "{answer_low}",
            field_index=2,
            scope='[data-scroll-container="forecast"]',
            summary="assert arrival-day low temp on 15-day forecast",
        ),
        *grounded_answer("{answer_weather}", "{answer_high}", "{answer_low}", summary="answer destination weather"),
        complete(),
    ],
    "crossapp_life.MapNearbyBestToWechat": [
        # 判分需要最高分店的地址：点开 {best_name}（测试按离线口径注入）详情页。
        *search_map("{category}"),
        *open_place_detail("{best_name}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.CalendarEventToWechat": [
        # 日历首页日程面板只显示今天：月视图点明天格（{tomorrow_day} 由测试注入）。
        *open_app("日历"),
        *select_calendar_day("{tomorrow_day}", summary="read tomorrow's first event in agenda"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.WeatherFirstNonRainyDayBuyTicket": [
        # 目标窗口为明天起 3 天（最远今天+3，超 3 日短卡）：切城市 + 15 日预报页首屏。
        *open_weather_city("{city}", select=True, forecast_swipes=0),
        *railway_book("{from_station}", "{city}", "{target_date}"),
        complete(),
    ],
    "crossapp_life.MapRatingConditionBuyTicket": [
        *search_map("{place}"),
        *railway_book("{from_station}", "{to_city}", "{tomorrow}"),
        complete(),
    ],
    "crossapp_life.RailwayWeatherToWechat": [
        *railway_query("{from_station}", "{city}", "{date}"),
        # {date}=后天在首页 3 日短卡内，但 {city} 非 located 默认城市：需切城市。
        *open_weather_city("{city}", select=True),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.WeatherFirstSunnyDayCalendarAlarm": [
        # 目标窗口未来两周：进 15 日预报页两次强横扫通览。
        *open_weather_city("{city}", forecast_swipes=2),
        *create_calendar_event("{target_date}", "户外运动"),
        *set_alarm_time("07:00", "8", "0", source_hour="7", source_minute="0", scroll_to_source=True),
        complete(),
    ],
    "crossapp_life.RailwayBalanceConditionalBuyNotify": [
        # 分支条件依赖支付宝余额：先查票读到最低票价，再进支付宝余额页比对，
        # 回 12306（后台保留在查询结果页）完成购票，最后微信通知。
        # 注意顺序不能是“先支付宝”：episode 起始会后台挂载任务所需 App，
        # 12306 首页的隐藏 tab.my 会与支付宝的 tab.my 选择器冲突。
        *railway_query("{from_station}", "{city}", "{date}"),
        *open_alipay_balance(),
        *open_app("铁路12306"),
        *book_visible_train("{train_no}", "{seat_type}", "{passenger_name}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.CalendarFreeWeatherInvite": [
        # 下周末在 8-14 天后：天气侧进 15 日预报页两次强横扫。（日历侧下周末
        # 日期格可能跨月，月视图点格有歧义风险，保持日历首页浏览。）
        *open_app("日历"),
        *open_weather_city("{city}", forecast_swipes=2),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.WechatFoodExtractMapSms": [
        # 判分地址=最近门店：同名门店多家，先按距离排序再点第一张卡进详情读地址。
        *open_app("WeChat"),
        *search_map("{brand}"),
        *sort_results_by_distance(),
        *open_place_detail("{brand}"),
        *send_sms_message("{sms_message}"),
        complete(),
    ],
    "crossapp_life.RestaurantRatingInviteCalendar": [
        *search_map("{restaurant}"),
        *send_wechat_message("{wechat_message}"),
        *create_calendar_event("{today}", "聚餐", start="19:00", end="21:00"),
        complete(),
    ],
    "crossapp_life.TripClosedLoopNotify": [
        *railway_query("{from_station}", "{to_station}", "{date}"),
        *create_calendar_event("{date}", "出行", start="{depart_time}", end="{arrive_time}", compact=True),
        *set_alarm_time(
            "{alarm_source_time}",
            "{alarm_hour}",
            "{alarm_wheel_minute}",
            source_hour="{alarm_source_hour}",
            source_minute="{alarm_source_minute}",
            max_delta_per_swipe=1,
            compact=True,
        ),
        *send_wechat_message("{wechat_message}", home_first=False, compact=True),
        complete(),
    ],
    "crossapp_life.FullTripPlanWeatherDriven": [
        # 目标日期在未来两周内：切城市 + 15 日预报页两次强横扫。
        *open_weather_city("{city}", select=True, forecast_swipes=2),
        # 任务要求核对日历无冲突：打开日历首页浏览（只读，R3 awake 覆盖）。
        *open_app("日历"),
        *railway_book("{from_station}", "{city}", "{target_date}"),
        *set_alarm_time(
            "{alarm_source_time}",
            "{alarm_hour}",
            "{alarm_wheel_minute}",
            source_hour="{alarm_source_hour}",
            source_minute="{alarm_source_minute}",
        ),
        complete(),
    ],
    "crossapp_life.WeekendTripFullPlan": [
        # 下周六在 8-14 天后（城市=北京即 located 页）：进 15 日预报页两次强横扫。
        *open_weather_city("{city}", forecast_swipes=2),
        *search_map("{destination}"),
        *create_calendar_event("{target_date}", "出游"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.TripMemoAndNotify": [
        *railway_query("{from_station}", "{city}", "{date}"),
        # {date}=后天在首页 3 日短卡内，但 {city} 非 located 默认城市：需切城市。
        *open_weather_city("{city}", select=True),
        *create_note("出行备忘", "{note_content}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.TravelPlanToWechat": [
        # 判分需要 {dest} 的详细地址：点开详情页读 AddressCard；天气为北京当前值（located 页）。
        *search_map("{dest}"),
        *open_place_detail("{dest}"),
        *open_weather_city("{weather_city}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.WeatherCalendar_CreateEventIfNotSunny": [
        # 当前天气在首页 hero，但 {city}=成都 非 located 默认城市：需切城市。
        *open_weather_city("{city}", select=True),
        *create_calendar_event("{today}", "{event_title}", all_day=True, notes="{event_notes}"),
        complete(),
    ],
    "crossapp_life.OpenedFridgeFoodsToMom": [
        # 开封食材信息在相册「相机」的两张冰箱照片里（crossapp_work 相册 helper 模式）。
        *open_gallery_album("相机"),
        *view_gallery_photos("IMG_8051.jpg", "IMG_8052.jpg"),
        *send_wechat_message("{wechat_message}", contact_wxid="{mom_wxid}"),
        complete(),
    ],
    "crossapp_life.RailwayEarliestGTrainToWechat": [
        *railway_query("{from_station}", "{to_station}", "{date}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.RailwayMyAccountToWechat": [
        *open_app("铁路12306"),
        *open_my_account(),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.RailwayTomorrowMomBookingToWechat": [
        *railway_query("{from_station}", "{to_station}", "{date}"),
        *send_wechat_message("{wechat_message}", contact_wxid="{mom_wxid}", via_contacts=True),
        complete(),
    ],
    "crossapp_life.RealisticTrip001": [
        *railway_query("杭州", "上海", "{target_date}"),
        # 后天在首页 3 日短卡内，但上海非 located 默认城市：切城市读那天天气。
        *open_weather_city("上海", select=True),
        *create_note("上海出差备忘", "{note_content}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.RecommendMenuDishesToXiaozhou": [
        # 先读小周聊天里的忌口消息，再看相册「相机」的两张菜单照片，最后回复推荐菜。
        *open_wechat_chat("{xiaozhou_wxid}", summary="read 小周's dietary restrictions"),
        *open_gallery_album("相机"),
        *view_gallery_photos("IMG_8131.jpg", "IMG_8132.jpg"),
        *send_wechat_message("{wechat_message}", contact_wxid="{xiaozhou_wxid}", ensure_root=True),
        complete(),
    ],
    "crossapp_life.TopRatedNearbyPlaceConditionalWechatOrSmsInvite": [
        # 分支条件是开车距离：点目标结果卡的「路线」进驾车路线页读距离。
        *search_map("{category}"),
        *open_route_to_result("{category}"),
        *send_wechat_message("{wechat_message}", contact_wxid="{target_wxid}"),
        *send_wechat_message("{notify_message}", contact_wxid="{notify_wxid}", ensure_root=True),
        complete(),
    ],
    "crossapp_life.WeatherFirstNonRainyToCalendarAndSms": [
        # 目标窗口未来一周：进 15 日预报页一次强横扫。
        *open_weather_city("{city}", forecast_swipes=1),
        *create_calendar_event("{target_date}", "户外跑步"),
        *send_sms_message("{sms_message}"),
        complete(),
    ],
    "crossapp_life.WeekendShanghaiTripIfClearAndFree": [
        *railway_query("北京", "成都", "{target_date}"),
        # 下周六最多 7 天后：切城市成都 + 15 日预报页一次强横扫。
        *open_weather_city("成都", select=True, forecast_swipes=1),
        # 任务要求核对那天日历有没有安排：打开日历首页浏览（只读，R3 awake 覆盖）。
        *open_app("日历"),
        *create_note("周末成都计划", "{note_content}"),
        *set_alarm_time(
            "{alarm_source_time}",
            "{alarm_hour}",
            "{alarm_wheel_minute}",
            source_hour="{alarm_source_hour}",
            source_minute="{alarm_source_minute}",
        ),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
}
