"""Scripted replay plans for cross-app life tasks."""

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
    tap_trigger,
    type_text,
    wait,
)
from bench_env.tests.map.scripted_plans import route_to_place, search_map
from bench_env.tests.railway12306.scripted_plans import book_visible_train, open_my_account, query_route


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


def open_weather_city(city: str) -> list[Step]:
    return [
        *open_app("天气"),
        wait(0.5, summary=f"inspect weather for {city}"),
    ]


PLANS: dict[str, list[Step]] = {
    "crossapp_life.MapPlaceToWechat": [
        *search_map("{place}"),
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
        *open_weather_city("{city}"),
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
        *open_app("支付宝"),
        *grounded_text_then_choice(
            "{answer_price}",
            "{answer_afford}",
            summary="answer cheapest train price and balance affordability",
        ),
        complete(),
    ],
    "crossapp_life.RailwayDestWeatherQuery": [
        *open_app("铁路12306"),
        *open_weather_city("{city}"),
        *grounded_answer("{answer_weather}", "{answer_high}", "{answer_low}", summary="answer destination weather"),
        complete(),
    ],
    "crossapp_life.MapNearbyBestToWechat": [
        *search_map("{category}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.CalendarEventToWechat": [
        *open_app("日历"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.WeatherFirstNonRainyDayBuyTicket": [
        *open_weather_city("{city}"),
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
        *open_weather_city("{city}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.WeatherFirstSunnyDayCalendarAlarm": [
        *open_weather_city("{city}"),
        *create_calendar_event("{target_date}", "户外运动"),
        *set_alarm_time("07:00", "8", "0", source_hour="7", source_minute="0", scroll_to_source=True),
        complete(),
    ],
    "crossapp_life.RailwayBalanceConditionalBuyNotify": [
        *railway_book("{from_station}", "{city}", "{date}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.CalendarFreeWeatherInvite": [
        *open_app("日历"),
        *open_weather_city("{city}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.WechatFoodExtractMapSms": [
        *open_app("WeChat"),
        *search_map("{brand}"),
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
        *open_weather_city("{city}"),
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
        *open_weather_city("{city}"),
        *search_map("{destination}"),
        *create_calendar_event("{target_date}", "出游"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.TripMemoAndNotify": [
        *railway_query("{from_station}", "{city}", "{date}"),
        *open_weather_city("{city}"),
        *create_note("出行备忘", "{note_content}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.TravelPlanToWechat": [
        *search_map("{dest}"),
        *open_weather_city("{weather_city}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.WeatherCalendar_CreateEventIfNotSunny": [
        *open_weather_city("{city}"),
        *create_calendar_event("{today}", "{event_title}", all_day=True, notes="{event_notes}"),
        complete(),
    ],
    "crossapp_life.OpenedFridgeFoodsToMom": [
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
        *open_weather_city("上海"),
        *create_note("上海出差备忘", "{note_content}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.RecommendMenuDishesToXiaozhou": [
        *send_wechat_message("{wechat_message}", contact_wxid="{xiaozhou_wxid}"),
        complete(),
    ],
    "crossapp_life.TopRatedNearbyPlaceConditionalWechatOrSmsInvite": [
        *search_map("{category}"),
        *send_wechat_message("{wechat_message}", contact_wxid="{target_wxid}"),
        *send_wechat_message("{notify_message}", contact_wxid="{notify_wxid}", ensure_root=True),
        complete(),
    ],
    "crossapp_life.WeatherFirstNonRainyToCalendarAndSms": [
        *open_weather_city("{city}"),
        *create_calendar_event("{target_date}", "户外跑步"),
        *send_sms_message("{sms_message}"),
        complete(),
    ],
    "crossapp_life.WeekendShanghaiTripIfClearAndFree": [
        *railway_query("北京", "成都", "{target_date}"),
        *open_weather_city("成都"),
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
