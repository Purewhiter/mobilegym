"""Scripted replay plans for cross-app life tasks.

Sampling compatibility (``DERIVED_PARAMS``): every non-declared plan
placeholder is computed at materialization time from the episode's
post-setup initial state through the *judge-homologous* domain classes
(Weather / Railway12306 / Map / Calendar / Wechat / Alipay) — calculators
build e.g. ``Weather(init_state["apps"]["weather"])`` exactly like judges
build ``Weather(input.apps["weather"])``, and static-catalog values (Map
POIs, 12306 train catalog) come from the same files the judges read.
Railway trains are derived from the catalog (``_catalog_available_trains``
+ the same seat-count RNG the frontend replays), so the values match what
the in-episode query renders and what the judge later picks from the query
state. Explicit test injections would still win over these calculators;
``test_scripted.py`` deliberately injects declared parameters only.

Conditional tasks use the restricted ``Branch`` form: a pure
``pick(task, init_state)`` mirrors the judge's own branch condition
(rain / balance / rating / driving distance / calendar conflicts) and
selects one of the static, individually lintable step lists.
"""

from __future__ import annotations

import datetime as dt
import functools
from typing import Any, Callable

from bench_env.agent.scripted import (
    Branch,
    Step,
    assert_answer,
    assert_text,
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
from bench_env.task.alipay.app import Alipay
from bench_env.task.calendar.app import Calendar
from bench_env.task.map.app import Map
from bench_env.task.railway12306.app import (
    Railway12306,
    _catalog_available_trains,
    _catalog_route_candidates,
    _is_generated_count_sellable,
    _load_train_catalog,
)
from bench_env.task.utils import city_aliases, sim_today
from bench_env.task.weather.app import Weather
from bench_env.task.wechat.app import Wechat
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


def scroll_wechat_contacts(*, target: str = "{contact_scrolls}") -> Step:
    """把通讯录列表滚到目标联系人行可见（按 category 字母分组排序，采样的
    联系人可能在列表深处）。次数按初始 contacts 的分组布局派生（0 时零开销），
    列表滚动 clamp 让底部联系人的次数高估自动止损。"""
    return {
        "op": "wheel_scroll",
        "selector": '[data-scroll-container="main"]:visible',
        "current": "0",
        "target": target,
        "modulo": 0,
        "max_delta_per_swipe": 1,
        "start_y_fraction": 0.78,
        "end_y_fraction": 0.35,
        "delta_y_fraction": 0.43,
        "summary": "scroll contacts list toward target contact",
    }


def send_wechat_message(
    content: str,
    *,
    contact_wxid: str = "{contact_wxid}",
    scrolls: str = "{contact_scrolls}",
    home_first: bool = True,
    compact: bool = False,
) -> list[Step]:
    """Send a WeChat message via the contacts tab (works for any contact).

    统一走「通讯录 → 滚动到联系人 → 资料页 → 发消息」路径：聊天列表快路径
    （直接点 chat.open）只对**已有会话**的联系人可用，采样路径的联系人参数
    会采到无既有会话的好友——通讯录页对全部联系人都渲染 userProfile.open。
    ``scrolls`` 是该收件人的通讯录滚动次数占位符（按收件人派生），selector
    解析自带可见等待，compact 模式省 wait 步。"""
    steps = [
        *open_app("WeChat", home_first=home_first, settle=0 if compact else 0.8),
        # 连按两次返回归位：上一条消息留下的 profile→chat 栈深 2 层，一次
        # back 只弹到资料页（无 TabBar）；主 tab 上多余的 back 退到桌面，
        # 随后的 awake 拉回微信主 tab，两种起点都收敛到可见 TabBar。
        back(summary="normalize WeChat toward a main tab"),
        back(summary="normalize WeChat toward a main tab (deep stack)"),
        awake("WeChat", summary="return to WeChat root"),
        *([] if compact else [wait(0.3, summary="wait for WeChat root")]),
        click_selector('[data-trigger="tab.contacts"]:visible', "open WeChat contacts tab"),
        *([] if compact else [wait(0.4, summary="wait for WeChat contacts")]),
        scroll_wechat_contacts(target=scrolls),
        trigger_param("userProfile.open", "id", contact_wxid, "open WeChat contact profile"),
        *([] if compact else [wait(0.4, summary="wait for contact profile")]),
        trigger_param("chat.open", "id", contact_wxid, "open WeChat contact chat"),
        *([] if compact else [wait(0.5, summary="wait for chat")]),
        type_text(content, selector="textarea:visible", clear=True, summary="type WeChat message"),
        click_selector("button.bg-app-primary:visible", "send WeChat message"),
        *([] if compact else [wait(0.5, summary="wait for WeChat send")]),
    ]
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


def scroll_train_results(*, target: str = "{train_scrolls}") -> Step:
    """把 12306 查询结果列表滚到目标车次可见（默认发时最早排序，非 G 的早班
    C/D 会把目标 G 车次挤出首屏）。滚动次数 {train_scrolls} 按目录同源的列表
    索引派生（0 时展开为空，零开销），wheel_scroll 宏逐次展开为容器相对滑动。"""
    return {
        "op": "wheel_scroll",
        # 查询结果主列表容器（QueryResultPage「内容区域」的 no-scrollbar 滚动区，
        # 区分于筛选面板的 px-4.pb-24 滚动区）。
        "selector": "div.flex-1.overflow-y-auto.no-scrollbar:visible",
        "current": "0",
        "target": target,
        "modulo": 0,
        "max_delta_per_swipe": 1,
        "start_y_fraction": 0.75,
        "end_y_fraction": 0.33,
        "delta_y_fraction": 0.42,
        "summary": "scroll train list toward target train",
    }


def railway_book(from_station: str, to_station: str, date_value: str) -> list[Step]:
    return [
        *railway_query(from_station, to_station, date_value),
        scroll_train_results(),
        *book_visible_train("{train_no}", "{seat_type}", "{passenger_name}"),
    ]


def scroll_result_sheet(*, target: str = "{result_scrolls}") -> Step:
    """把地图搜索结果 sheet 滚到目标店卡可见（相关性排序下评分最高店可能在
    列表深处）。次数 {result_scrolls} 按 UI 同源列表（geo_search excludes=None）
    中第一张同名卡的索引派生（0 时零开销）。"""
    return {
        "op": "wheel_scroll",
        # sheet 内部列表滚动区（swipe 打在 sheet 容器整体上会被 sheet 高度
        # 拖拽手势消费，列表几乎不滚）。步长故意压小（0.27 相对高度 ≈
        # 198css/次）：卡片整体（顶部 h3 + 底部路线按钮）落进半开视口的容差
        # 窗约 340css，步长必须小于窗宽才能保证任意索引可达。
        "selector": "div.place-results-sheet-scrollable:visible",
        "current": "0",
        "target": target,
        "modulo": 0,
        "max_delta_per_swipe": 1,
        "start_y_fraction": 0.80,
        "end_y_fraction": 0.53,
        "delta_y_fraction": 0.27,
        "summary": "scroll result sheet toward target place",
    }


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


# ---------------------------------------------------------------------------
# Derived params — sampling-path compatibility
# ---------------------------------------------------------------------------
# 每个计算器与其任务判分器同源（tasks.py / defs/*.py 的 check_goals）：同一领域
# 类构造自 episode 初始状态（runner post-setup obs.state，_prepare/_post_sample
# 注入已生效），静态目录（Map places / 12306 trainCatalog）与判分器共用同一份
# 文件。铁路车次/票价从目录 + 前端同款余票 RNG 推导（判分器读 episode 内查询
# 结果，两者由同一目录生成，值恒一致——crossapp_work 同款既有等价性）。

def _today_of(state: dict[str, Any]) -> dt.date:
    return sim_today(state["os"])


def _date_after_of(state: dict[str, Any], days: int) -> str:
    return (_today_of(state) + dt.timedelta(days=days)).isoformat()


def _next_saturday_of(state: dict[str, Any]) -> str:
    """镜像 WeekendShanghaiTripIfClearAndFree 判分的"下周六"（本周内最近周六）。"""
    today = _today_of(state)
    days = (5 - today.weekday()) % 7 or 7
    return (today + dt.timedelta(days=days)).isoformat()


def _next_weekend_saturday_dates(state: dict[str, Any]) -> tuple[dt.date, dt.date]:
    """镜像 CalendarFreeWeatherInvite / WeekendTripFullPlan 判分的"下周末"。"""
    today = _today_of(state)
    days_to_next_monday = (7 - today.weekday()) % 7 or 7
    saturday = today + dt.timedelta(days=days_to_next_monday + 5)
    return saturday, saturday + dt.timedelta(days=1)


def _weather_of(state: dict[str, Any]) -> Weather:
    return Weather(state["apps"]["weather"])


def _calendar_of(state: dict[str, Any]) -> Calendar:
    return Calendar(state["apps"]["calendar"])


def _wxid_of(state: dict[str, Any], name: str) -> str:
    return Wechat(state["apps"]["wechat"]).require_contact_wxid(name)


def _contact_wxid(task: Any, state: dict[str, Any]) -> str:
    return _wxid_of(state, str(task.p.contact))


def _wechat_contact_scrolls_of(state: dict[str, Any], name: str) -> str:
    """目标联系人行在通讯录列表中的滚动次数估算。

    复刻 Contacts.tsx 布局：顶部 4 个功能行（60css）→ 按 category 字母分组
    （组头 26css）排序，组内保持 contacts 原序（行高 60css）；列表视口约
    700css，一次容器相对滑动约 300css。找不到同名联系人时返回 0（保守）。"""
    contacts = state["apps"]["wechat"].get("contacts") or []
    visible = [c for c in contacts if isinstance(c, dict) and not c.get("isBlacklisted")]
    groups: dict[str, list[dict[str, Any]]] = {}
    for contact in visible:
        groups.setdefault(str(contact.get("category") or "").strip() or "#", []).append(contact)
    y = 4 * 60
    for letter in sorted(groups):
        y += 26
        for contact in groups[letter]:
            if str(contact.get("name")) == name:
                return str(max(0, round((y - 350) / 300)))
            y += 60
    return "0"


def _contact_scrolls(task: Any, state: dict[str, Any]) -> str:
    return _wechat_contact_scrolls_of(state, str(task.p.contact))


def _p(name: str) -> Callable[[Any, dict[str, Any]], str]:
    """声明参数的取值器（供工厂当 from/to/date 输入用）。"""
    return lambda task, state: str(getattr(task.p, name))


def _day_of_month(date_value: str) -> str:
    return str(int(str(date_value).rsplit("-", 1)[1]))


# ---- 12306 目录推导（判分器读 episode 内查询结果；查询结果由前端从同一目录
# ---- + 同一余票 RNG 生成，故目录推导值与判分值恒一致）----

def _lishi_minutes(value: Any) -> int:
    """目录 lishi 为 "H:MM"；判分侧 duration 为 "X小时Y分"，比较口径统一成分钟。"""
    text = str(value or "")
    if ":" in text:
        hours, minutes = text.split(":", 1)
        return int(hours) * 60 + int(minutes)
    return Railway12306.parse_duration_minutes(text)


def _picked_train(
    state: dict[str, Any],
    from_station: str,
    to_station: str,
    date_value: str,
    pref: str = "earliest",
) -> dict[str, Any]:
    """镜像 rail.pick_train_for_route_strict(pref, only_high_speed=True)：
    G 字头 + 有可售席别（目录 -1/正数 ↔ 查询态 None/正数），earliest 按
    (发车时间, 车次号)，fastest 按 (历时, 发车时间, 车次号)。"""
    trains = list(
        _catalog_available_trains(
            _today_of(state).isoformat(), from_station, to_station, date_value, True
        )
    )
    if not trains:
        raise ValueError(f"no sellable G train in catalog for {from_station}->{to_station} {date_value}")
    if pref == "fastest":
        return min(
            trains,
            key=lambda t: (
                _lishi_minutes(t.get("lishi")),
                Railway12306.parse_hhmm(str(t["startTime"])),
                str(t["trainCode"]),
            ),
        )
    return min(
        trains,
        key=lambda t: (Railway12306.parse_hhmm(str(t["startTime"])), str(t["trainCode"])),
    )


@functools.lru_cache(maxsize=1)
def _catalog_entry_index() -> dict[tuple[str, str, str], dict[str, Any]]:
    return {
        (str(e["trainCode"]), str(e["fromCode"]), str(e["toCode"])): e
        for e in _load_train_catalog()["availability"].values()
    }


def _catalog_seat_price(train: dict[str, Any], seat_key: str) -> float:
    entry = _catalog_entry_index()[
        (str(train["trainCode"]), str(train["fromCode"]), str(train["toCode"]))
    ]
    price = float((entry.get("prices") or {}).get(seat_key) or 0)
    if price <= 0:
        raise ValueError(f"train {train['trainCode']} has no catalog price for {seat_key}")
    return price


def _cheapest_high_speed_price(
    state: dict[str, Any], from_station: str, to_station: str, date_value: str
) -> float:
    """镜像 rail.cheapest_high_speed_seat_price：G 字头 × 可售席别 × price>0 取最低。
    席别遍历以目录 seatTypes 为准（前端 entryToTrainInfo 同款），余票编码
    目录 -1/正数 ↔ 查询态 None/正数（cheapest 判分的 count 过滤同口径）。"""
    index = _catalog_entry_index()
    best: float | None = None
    for item in _catalog_available_trains(
        _today_of(state).isoformat(), from_station, to_station, date_value, True
    ):
        entry = index[(str(item["trainCode"]), str(item["fromCode"]), str(item["toCode"]))]
        generated = item.get("generatedAvailability") or {}
        for seat_key in entry.get("seatTypes") or []:
            price = float((entry.get("prices") or {}).get(seat_key) or 0)
            count = generated.get(seat_key)
            if price > 0 and count is not None and _is_generated_count_sellable(count):
                best = price if best is None else min(best, price)
    if best is None:
        raise ValueError(f"no priced sellable G seat for {from_station}->{to_station} {date_value}")
    return best


def _rail_user_name(task: Any, state: dict[str, Any]) -> str:
    """判分 check_booking_order(passenger_names=[rail.user_name]) 同源。"""
    return Railway12306(state["apps"]["railway12306"]).user_name


def _train_list_scrolls(
    state: dict[str, Any], from_station: str, to_station: str, date_value: str, pref: str = "earliest"
) -> str:
    """目标车次在查询结果列表（默认发时最早排序）中的滚动次数估算。

    UI 列表 = 目录直达候选全集（含售罄）按 startTime 稳定排序（trainService
    applyFilterAndSort 'depart' 的 localeCompare 同口径）；卡高约 150css、
    一次容器相对滑动约 260css，公式让目标卡落进滚动后视口的中部。"""
    target = _picked_train(state, from_station, to_station, date_value, pref)
    ordered = sorted(
        _catalog_route_candidates(from_station, to_station, False),
        key=lambda t: str(t["startTime"]),
    )
    key = (str(target["trainCode"]), str(target["fromCode"]), str(target["toCode"]))
    idx = next(
        (
            i
            for i, t in enumerate(ordered)
            if (str(t["trainCode"]), str(t["fromCode"]), str(t["toCode"])) == key
        ),
        0,
    )
    return str(max(0, -(-(150 * idx - 350) // 260)))


def _map_result_scrolls(task: Any) -> str:
    """评分最高店卡在搜索结果 sheet 的滚动次数估算。

    UI 列表 = geo_search(excludes=None)（search_index 原序，与前端一致）；
    结果卡按 h3 文本精确匹配取**第一张同名卡**（open_route_to_result /
    open_place_detail 的定位口径），卡高约 190css、一次滑动约 230css。"""
    best_name = str(_map_best(task)["name"])
    ui_items = Map.geo_search(str(task.p.category), limit=0, excludes=None)
    idx = next((i for i, it in enumerate(ui_items) if str(it.get("name")) == best_name), 0)
    # 实测校准（模拟器 Playwright 量测）：带营业行的结果卡高约 174css；
    # scroll_result_sheet 为无惯性精确拖动，一次 = 0.27 × scrollable 视口高
    # （512css）= 138css。目标让整卡（顶部 h3 + 底部路线按钮）落进视口中部。
    # 首页仅渲染 20 条：目标排名超出分页 DOM 时（购物中心/酒店/必胜客的
    # best，已知数据缺口）clamp 到首页触底为止，让点击尽快失败、归因清晰，
    # 而不是滚动步吃光步数预算。
    return str(min(max(0, round((174 * idx - 169) / 138)), 21))


def _exact_place_result_scrolls(place: str) -> str:
    """{place} 精确同名卡在搜索结果 sheet 的滚动次数（同 _map_result_scrolls 校准）。

    相关性排序下带后缀的同前缀卡（如 北京华联（万柳购物中心））可能排在精确
    同名卡之前，把目标卡挤出半开 sheet 的可点视口——按 UI 同源列表索引派生。"""
    ui_items = Map.geo_search(place, limit=0, excludes=None)
    idx = next((i for i, it in enumerate(ui_items) if str(it.get("name")) == place), 0)
    return str(min(max(0, round((174 * idx - 169) / 138)), 21))


# ---- 闹钟滚轮参数（纯 UI 导航策略：从初始闹钟列表挑滚轮代价最小的源）----

def _wheel_delta(current: int, target: int, modulo: int) -> int:
    delta = (target - current) % modulo
    if delta > modulo / 2:
        delta -= modulo
    return int(delta)


def _hhmm_shift(time_text: str, hours_delta: int) -> str:
    hour, minute = (int(x) for x in str(time_text).split(":", 1))
    value = dt.datetime(2000, 1, 1, hour, minute) + dt.timedelta(hours=hours_delta)
    return value.strftime("%H:%M")


def _alarm_wheel_params(state: dict[str, Any], target_time: str) -> dict[str, str]:
    """目标时间来自判分（如发车-1h）；源闹钟从初始 clock.alarms 里选（UI 渲染
    为补零 HH:MM），时/分滚轮合计步数最小者。30→45 的分钟轮存在一格间隙，
    目标写 44 让物理滚动落在 45（沿用 live 验证过的 workaround）。"""
    target_hour, target_minute = (int(x) for x in str(target_time).split(":", 1))
    sources = sorted(
        {(int(a["hour"]), int(a["minute"])) for a in state["apps"]["clock"]["alarms"]}
    )
    if not sources:
        raise ValueError("initial clock state has no alarms to edit")

    def cost(source: tuple[int, int]) -> int:
        return abs(_wheel_delta(source[0], target_hour, 24)) + abs(
            _wheel_delta(source[1], target_minute, 60)
        )

    source_hour, source_minute = min(sources, key=cost)
    wheel_minute = target_minute
    if source_minute == 30 and target_minute == 45:
        wheel_minute = 44
    return {
        "alarm_time": str(target_time),
        "alarm_hour": str(target_hour),
        "alarm_minute": str(target_minute),
        "alarm_wheel_minute": str(wheel_minute),
        "alarm_source_time": f"{source_hour:02d}:{source_minute:02d}",
        "alarm_source_hour": str(source_hour),
        "alarm_source_minute": str(source_minute),
    }


_ALARM_KEYS = (
    "alarm_time",
    "alarm_hour",
    "alarm_minute",
    "alarm_wheel_minute",
    "alarm_source_time",
    "alarm_source_hour",
    "alarm_source_minute",
)


def _rail_train_fns(
    from_of: Callable[[Any, dict[str, Any]], str],
    to_of: Callable[[Any, dict[str, Any]], str],
    date_of: Callable[[Any, dict[str, Any]], str],
    *,
    pref: str = "earliest",
    alarm_before_hours: int | None = None,
) -> dict[str, Callable[[Any, dict[str, Any]], Any]]:
    """一条路线的整套车票/购票占位符计算器（与声明参数同名的键会被
    materialize 跳过——显式参数恒优先）。"""

    def train(task: Any, state: dict[str, Any]) -> dict[str, Any]:
        return _picked_train(state, from_of(task, state), to_of(task, state), date_of(task, state), pref)

    fns: dict[str, Callable[[Any, dict[str, Any]], Any]] = {
        "date": date_of,
        "date_day": lambda t, s: _day_of_month(date_of(t, s)),
        "train_no": lambda t, s: str(train(t, s)["trainCode"]),
        "seat_type": lambda t, s: "二等",
        "passenger_name": _rail_user_name,
        "depart_time": lambda t, s: str(train(t, s)["startTime"]),
        "arrive_time": lambda t, s: str(train(t, s)["arriveTime"]),
        "train_scrolls": lambda t, s: _train_list_scrolls(
            s, from_of(t, s), to_of(t, s), date_of(t, s), pref
        ),
    }
    if alarm_before_hours is not None:
        def alarm_params(task: Any, state: dict[str, Any]) -> dict[str, str]:
            depart = str(train(task, state)["startTime"])
            return _alarm_wheel_params(state, _hhmm_shift(depart, -alarm_before_hours))

        for key in _ALARM_KEYS:
            fns[key] = (lambda k: lambda t, s: alarm_params(t, s)[k])(key)
    return fns


# ---- 天气 / 地图 / 日历派生值 ----

def _forecast_message_of(state: dict[str, Any], city: str, date_value: str) -> str:
    day = _weather_of(state).daily_by_date(city, date_value)
    return (
        f"{date_value} {city} {day.get('textDay')} "
        f"{int(round(float(day.get('tempMax', 0))))}/{int(round(float(day.get('tempMin', 0))))}度"
    )


def _weather_metric_message(task: Any, state: dict[str, Any]) -> str:
    """镜像 WeatherShareMetric.check_goals 的 keywords 组合。"""
    weather = _weather_of(state)
    city, metric = str(task.p.city), str(task.p.metric)
    if metric == "humidity":
        return weather.current_humidity_str(city)
    if metric == "tomorrow":
        high, low = weather.tomorrow_high_low_str(city)
        return f"{high} {low}"
    return f"{weather.current_temp_str(city)} {weather.current_feels_like_str(city)}"


def _weather_report_note(task: Any, state: dict[str, Any]) -> str:
    """镜像 WeatherReportToNotes.check_goals：城市 + 天气描述 + 温度（±2 容差）。"""
    weather = _weather_of(state)
    city = str(task.p.city)
    return f"{city} {weather.current_weather_text(city)} {weather.current_temp(city)}度"


def _map_best(task: Any) -> dict[str, Any]:
    """镜像 MapNearbyBestToWechat / TopRated… 判分的评分最高 POI（同分最近）。"""
    return Map.best_rated_from_results(
        Map.geo_search(str(task.p.category), limit=0),
        max_distance_meters=float(task.p.radius),
    )


def _map_best_message(task: Any, state: dict[str, Any]) -> str:
    best = _map_best(task)
    return f"{best['name']} 评分{best['rating']} {Map.extract_address(best)}"


def _place_address(place: str) -> str:
    return Map.extract_address(Map.resolve_places(place)[0])


def _tomorrow_first_event_message(task: Any, state: dict[str, Any]) -> str:
    """镜像 CalendarEventToWechat.check_goals：明天第一个事件的标题 + 开始时间。"""
    tomorrow = _today_of(state) + dt.timedelta(days=1)
    event = _calendar_of(state).first_event_on_date(tomorrow)
    return f"{event['title']} {Calendar.hhmm(event['startTs'])}"


def _dest_ticket_weather_day(task: Any, state: dict[str, Any]) -> dict[str, Any]:
    """镜像 RailwayDestWeatherQuery.check_goals：从初始 12306 本人车票（
    _post_sample 已注入）找去 {city} 的票，读到达日预报。RNG 复刻已删除——
    直接读注入结果本身。"""
    rail = Railway12306(state["apps"]["railway12306"])
    city = str(task.p.city)
    ticket = next(
        (
            t
            for t in rail.my_tickets()
            if city in str(t.get("toStation") or "")
            or any(
                alias.lower() in str(t.get("toStation") or "").lower()
                for alias in city_aliases(city)
            )
        ),
        None,
    )
    if ticket is None:
        raise ValueError(f"no owned railway ticket for destination {city!r} in initial state")
    return _weather_of(state).daily_by_date(city, str(ticket["date"]))


def _first_non_rainy_sms_message(task: Any, state: dict[str, Any]) -> str:
    """镜像 WeatherFirstNonRainyToCalendarAndSms 判分：日期标签（ISO 在
    date_match_labels 内）+ 昼/夜天气描述任一。"""
    weather = _weather_of(state)
    date_value = weather.first_non_rainy_date(str(task.p.city), 1, 7)
    day = weather.daily_by_date(str(task.p.city), date_value)
    labels = [str(day.get(key) or "").strip() for key in ("textDay", "textNight")]
    return f"{date_value} {' '.join(label for label in labels if label)} 一起跑步"


def _full_trip_target_date(task: Any, state: dict[str, Any]) -> str:
    """镜像 FullTripPlanWeatherDriven 判分：未来两周第一个不下雨且日历无安排的日期。"""
    calendar = _calendar_of(state)
    target = next(
        (
            fx_date
            for fx_date in _weather_of(state).non_rainy_dates(str(task.p.city), 1, 14)
            if calendar.count_events_on_date(dt.date.fromisoformat(fx_date)) == 0
        ),
        None,
    )
    if target is None:
        raise ValueError("no non-rainy calendar-free date in the next 14 days")
    return target


def _realistic_trip_is_rainy(state: dict[str, Any]) -> bool:
    day = _weather_of(state).daily_by_date("上海", _date_after_of(state, 2))
    return Weather.is_raining_text(str(day.get("textDay") or "")) or Weather.is_raining_text(
        str(day.get("textNight") or "")
    )


def _realistic_trip_message(task: Any, state: dict[str, Any]) -> str:
    """镜像 RealisticTrip001 判分分支：雨天消息含"伞"，非雨天含到达时间。"""
    date_value = _date_after_of(state, 2)
    train = _picked_train(state, "杭州", "上海", date_value)
    if _realistic_trip_is_rainy(state):
        return f"{train['trainCode']} {train['startTime']} 出发 带伞"
    return f"{train['trainCode']} {train['arriveTime']} 到达"


def _calendar_free_valid_days(task: Any, state: dict[str, Any]) -> list[dt.date]:
    """镜像 CalendarFreeWeatherInvite 判分：下周末中日历空闲且不下雨的日子。"""
    saturday, sunday = _next_weekend_saturday_dates(state)
    calendar = _calendar_of(state)
    weather = _weather_of(state)
    today = _today_of(state)
    free = [d for d in (saturday, sunday) if calendar.count_events_on_date(d) == 0]
    return [d for d in free if not weather.is_rainy_on_date(str(task.p.city), d, today)]


def _calendar_free_invite_message(task: Any, state: dict[str, Any]) -> str:
    """可约两天 → "下周末"；只可约一天 → 该天的 M月D日 标签（date_match_labels 含）。"""
    valid = _calendar_free_valid_days(task, state)
    if len(valid) >= 2:
        return "下周末天气不错，一起出去玩"
    day = valid[0] if valid else _next_weekend_saturday_dates(state)[0]
    return f"{day.month}月{day.day}日天气不错，一起出去玩"


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict[str, Any]], Any]]] = {
    "crossapp_life.MapPlaceToWechat": {
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
        "result_scrolls": lambda t, s: _exact_place_result_scrolls(str(t.p.place)),
        # 判分 check_alternatives 接受任一同名 POI 地址；取 resolve_places[0] 与原注入一致。
        "wechat_message": lambda t, s: _place_address(str(t.p.place)),
    },
    "crossapp_life.WeatherShareMetric": {
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
        "wechat_message": _weather_metric_message,
    },
    "crossapp_life.WeatherReportToNotes": {
        "note_content": _weather_report_note,
    },
    "crossapp_life.WeatherFilterNonRainyDays": {
        # 判分对每个不下雨日期做多标签匹配，ISO（non_rainy_dates 原值）是标签之一。
        "note_content": lambda t, s: "\n".join(_weather_of(s).non_rainy_dates(str(t.p.city), 1, 5)),
    },
    "crossapp_life.WeatherRainBranchNotify": {
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
    },
    "crossapp_life.RailwayTrainInfoToWechat": {
        **_rail_train_fns(_p("from_station"), _p("to_station"), _p("date")),
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
        # 判分：最早高铁车次号 contains + 发车时间 match_time。
        "wechat_message": lambda t, s: (
            lambda train: f"{train['trainCode']} {train['startTime']} 出发"
        )(_picked_train(s, str(t.p.from_station), str(t.p.to_station), str(t.p.date))),
    },
    "crossapp_life.RailwayPriceVsBalance": {
        "date_day": lambda t, s: _day_of_month(str(t.p.date)),
        # 判分：answer 含最低票价数字（±1）+ 够/不够与 余额 vs 票价 一致。
        # 证据断言用同一目录派生的裸数字（卡片价格数字是独立节点，exact 命中）。
        "cheapest_price_digits": lambda t, s: (
            f"{round(_cheapest_high_speed_price(s, str(t.p.from_station), str(t.p.to_station), str(t.p.date)), 2):g}"
        ),
        # 余额页标题渲染 toLocaleString('en-US', 2fr)——与 crossapp_commerce 的
        # {balance_screen} 同款屏显派生（_post_sample 注入值 round 2 位恒吻合）。
        "balance_screen": lambda t, s: (
            f"{float(Alipay(s['apps']['alipay']).total_balance):,.2f}"
        ),
        "answer_price": lambda t, s: (
            f"{round(_cheapest_high_speed_price(s, str(t.p.from_station), str(t.p.to_station), str(t.p.date)), 2):g}元"
        ),
        "answer_afford": lambda t, s: (
            "够"
            if float(Alipay(s["apps"]["alipay"]).total_balance)
            >= _cheapest_high_speed_price(s, str(t.p.from_station), str(t.p.to_station), str(t.p.date))
            else "不够"
        ),
    },
    "crossapp_life.RailwayDestWeatherQuery": {
        # 判分 Weather.forecast_text_matches 对昼/夜文案模糊匹配；高低温取整同判分。
        "answer_weather": lambda t, s: (
            lambda day: f"{day.get('textDay')} {day.get('textNight')}"
        )(_dest_ticket_weather_day(t, s)),
        "answer_high": lambda t, s: str(int(round(float(_dest_ticket_weather_day(t, s)["tempMax"])))),
        "answer_low": lambda t, s: str(int(round(float(_dest_ticket_weather_day(t, s)["tempMin"])))),
    },
    "crossapp_life.MapNearbyBestToWechat": {
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
        "best_name": lambda t, s: str(_map_best(t)["name"]),
        "result_scrolls": lambda t, s: _map_result_scrolls(t),
        "wechat_message": _map_best_message,
    },
    "crossapp_life.CalendarEventToWechat": {
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
        "tomorrow_day": lambda t, s: str((_today_of(s) + dt.timedelta(days=1)).day),
        "wechat_message": _tomorrow_first_event_message,
    },
    "crossapp_life.WeatherFirstNonRainyDayBuyTicket": {
        **_rail_train_fns(
            _p("from_station"),
            _p("city"),
            lambda t, s: _weather_of(s).first_non_rainy_date(str(t.p.city), 1, 3),
        ),
        "target_date": lambda t, s: _weather_of(s).first_non_rainy_date(str(t.p.city), 1, 3),
    },
    "crossapp_life.MapRatingConditionBuyTicket": {
        # PLACE_PARAM 全部地点评分>4（静态目录）——判分恒走"买票"分支，无需 Branch。
        **_rail_train_fns(
            _p("from_station"),
            lambda t, s: Map.city_from_address(str(Map.resolve_places(str(t.p.place))[0].get("address") or "")),
            lambda t, s: _date_after_of(s, 1),
        ),
        "to_city": lambda t, s: Map.city_from_address(str(Map.resolve_places(str(t.p.place))[0].get("address") or "")),
        "tomorrow": lambda t, s: _date_after_of(s, 1),
    },
    "crossapp_life.RailwayWeatherToWechat": {
        "date_day": lambda t, s: _day_of_month(str(t.p.date)),
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
        # 判分：车次号 contains + Weather.forecast_text_matches（forecast 消息含 textDay）。
        "wechat_message": lambda t, s: (
            lambda train: f"{train['trainCode']} {train['startTime']} 出发 "
            f"{_forecast_message_of(s, str(t.p.city), str(t.p.date))}"
        )(_picked_train(s, str(t.p.from_station), str(t.p.city), str(t.p.date))),
    },
    "crossapp_life.WeatherFirstSunnyDayCalendarAlarm": {
        "target_date": lambda t, s: _weather_of(s).first_non_rainy_date(str(t.p.city), 1, 14),
        # 判分固定 check_alarm_at(8, 0)。
        **{
            key: (lambda k: lambda t, s: _alarm_wheel_params(s, "08:00")[k])(key)
            for key in _ALARM_KEYS
        },
    },
    "crossapp_life.RailwayBalanceConditionalBuyNotify": {
        **_rail_train_fns(_p("from_station"), _p("city"), _p("date")),
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
    },
    "crossapp_life.CalendarFreeWeatherInvite": {
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
        "wechat_message": _calendar_free_invite_message,
    },
    "crossapp_life.WechatFoodExtractMapSms": {
        # 判分：短信含品牌最近门店地址（nearest_from_results 同源）。
        "sms_message": lambda t, s: Map.extract_address(
            Map.nearest_from_results(Map.geo_search(str(t.p.brand), limit=0))
        ),
    },
    "crossapp_life.RestaurantRatingInviteCalendar": {
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
        "today": lambda t, s: _today_of(s).isoformat(),
    },
    "crossapp_life.TripClosedLoopNotify": {
        **_rail_train_fns(_p("from_station"), _p("to_station"), _p("date"), alarm_before_hours=1),
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
        "wechat_message": lambda t, s: (
            lambda train: f"{train['trainCode']} {train['startTime']} 出发"
        )(_picked_train(s, str(t.p.from_station), str(t.p.to_station), str(t.p.date))),
    },
    "crossapp_life.FullTripPlanWeatherDriven": {
        **_rail_train_fns(_p("from_station"), _p("city"), _full_trip_target_date, alarm_before_hours=1),
        "target_date": _full_trip_target_date,
    },
    "crossapp_life.WeekendTripFullPlan": {
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
        "target_date": lambda t, s: _next_weekend_saturday_dates(s)[0].isoformat(),
    },
    "crossapp_life.TripMemoAndNotify": {
        "date_day": lambda t, s: _day_of_month(str(t.p.date)),
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
        # 判分：笔记含最快车次号 + forecast_text_matches；微信含车次号 + 到达时间。
        "note_content": lambda t, s: (
            lambda train: f"{train['trainCode']} {train['startTime']} 出发 "
            f"{_forecast_message_of(s, str(t.p.city), str(t.p.date))}"
        )(_picked_train(s, str(t.p.from_station), str(t.p.city), str(t.p.date), "fastest")),
        "wechat_message": lambda t, s: (
            lambda train: f"{train['trainCode']} {train['arriveTime']} 到达"
        )(_picked_train(s, str(t.p.from_station), str(t.p.city), str(t.p.date), "fastest")),
    },
    "crossapp_life.TravelPlanToWechat": {
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
        "result_scrolls": lambda t, s: _exact_place_result_scrolls(str(t.p.dest)),
        "weather_city": lambda t, s: Map.city_from_address(_place_address(str(t.p.dest))),
        # 判分把地址串直接传给 Weather 城市解析——派生消息用同一调用保持同源。
        "wechat_message": lambda t, s: (
            lambda addr: f"{addr} {_weather_of(s).current_weather_text(addr)} {_weather_of(s).current_temp(addr)}"
        )(_place_address(str(t.p.dest))),
    },
    "crossapp_life.WeatherCalendar_CreateEventIfNotSunny": {
        "today": lambda t, s: _today_of(s).isoformat(),
        # 判分：备注含天气描述（原文/归类任一）+ 温度（±2 容差）。
        "event_notes": lambda t, s: (
            f"{_weather_of(s).current_weather_text(str(t.p.city))} "
            f"{_weather_of(s).current_temp(str(t.p.city))}度"
        ),
    },
    "crossapp_life.OpenedFridgeFoodsToMom": {
        # "母亲"联系人由任务 _prepare 注入初始状态（wxid_mom_home）。
        "mom_wxid": lambda t, s: _wxid_of(s, "母亲"),
        "mom_scrolls": lambda t, s: _wechat_contact_scrolls_of(s, "母亲"),
        # 判分按 task.target_food_aliases 每组 any_of——取每组首选名。
        "wechat_message": lambda t, s: " ".join(str(group[0]) for group in t.target_food_aliases),
    },
    "crossapp_life.RailwayEarliestGTrainToWechat": {
        # 任务声明 from_city/to_city；plan 复用 railway_query 的 from/to 占位符。
        "from_station": _p("from_city"),
        "to_station": _p("to_city"),
        "date_day": lambda t, s: _day_of_month(str(t.p.date)),
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
        # 判分：最早 G 字头车次号 + 二等座票价（round(:g) 同款格式）。
        "wechat_message": lambda t, s: (
            lambda train: f"{train['trainCode']} {round(_catalog_seat_price(train, 'secondClass'), 2):g}"
        )(_picked_train(s, str(t.p.from_city), str(t.p.to_city), str(t.p.date))),
    },
    "crossapp_life.RailwayMyAccountToWechat": {
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
        # 判分：微信消息含 12306 账号 username（初始状态同源）。
        "wechat_message": lambda t, s: Railway12306(s["apps"]["railway12306"]).account_username,
    },
    "crossapp_life.RailwayTomorrowMomBookingToWechat": {
        **_rail_train_fns(_p("from_city"), _p("to_city"), lambda t, s: _date_after_of(s, 1)),
        # 专用占位符名（见 plan 注释）：_route sampler 会把 from_station/
        # to_station 原始键泄漏进 task.params（与判分读的 from_city/to_city
        # 错位），同名 derived 会被显式参数覆盖——换名绕开。
        "mom_from_station": _p("from_city"),
        "mom_to_station": _p("to_city"),
        # "母亲"联系人由任务 _prepare 注入。
        "mom_wxid": lambda t, s: _wxid_of(s, "母亲"),
        "mom_scrolls": lambda t, s: _wechat_contact_scrolls_of(s, "母亲"),
        "wechat_message": lambda t, s: str(
            _picked_train(s, str(t.p.from_city), str(t.p.to_city), _date_after_of(s, 1))["trainCode"]
        ),
    },
    "crossapp_life.RealisticTrip001": {
        "target_date": lambda t, s: _date_after_of(s, 2),
        "date_day": lambda t, s: _day_of_month(_date_after_of(s, 2)),
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
        # 雨天判分不查笔记（建了无害），非雨天查车次号 + forecast_text_matches。
        "note_content": lambda t, s: (
            lambda train: f"{train['trainCode']} {train['startTime']} 出发 "
            f"{_forecast_message_of(s, '上海', _date_after_of(s, 2))}"
        )(_picked_train(s, "杭州", "上海", _date_after_of(s, 2))),
        "wechat_message": _realistic_trip_message,
    },
    "crossapp_life.RecommendMenuDishesToXiaozhou": {
        # "小周"联系人由任务 _prepare 注入（wxid_xiaozhou_menu）。
        "xiaozhou_wxid": lambda t, s: _wxid_of(s, "小周"),
        "xiaozhou_scrolls": lambda t, s: _wechat_contact_scrolls_of(s, "小周"),
        # 判分按 task.acceptable_dish_groups 每组 any_of + 排除表；
        # target_dish_names 是任务自带的每组代表菜清单。
        "wechat_message": lambda t, s: " ".join(str(name) for name in t.target_dish_names),
    },
    "crossapp_life.TopRatedNearbyPlaceConditionalWechatOrSmsInvite": {
        "best_name": lambda t, s: str(_map_best(t)["name"]),
        "result_scrolls": lambda t, s: _map_result_scrolls(t),
        "target_wxid": lambda t, s: _wxid_of(s, str(t.p.target)),
        "target_scrolls": lambda t, s: _wechat_contact_scrolls_of(s, str(t.p.target)),
        "notify_wxid": lambda t, s: _wxid_of(s, str(t.p.notify_to)),
        "notify_scrolls": lambda t, s: _wechat_contact_scrolls_of(s, str(t.p.notify_to)),
        "sms_message": lambda t, s: Map.extract_address(_map_best(t)),
    },
    "crossapp_life.WeatherFirstNonRainyToCalendarAndSms": {
        "target_date": lambda t, s: _weather_of(s).first_non_rainy_date(str(t.p.city), 1, 7),
        # 任务声明 contact（SMS_RECIPIENT_PARAM）；plan 复用 send_sms_message 的占位符名。
        "sms_contact": _p("contact"),
        "sms_message": _first_non_rainy_sms_message,
    },
    "crossapp_life.WeekendShanghaiTripIfClearAndFree": {
        **_rail_train_fns(
            lambda t, s: "北京",
            lambda t, s: "成都",
            lambda t, s: _next_saturday_of(s),
            alarm_before_hours=1,
        ),
        "target_date": lambda t, s: _next_saturday_of(s),
        "contact_wxid": _contact_wxid,
        "contact_scrolls": _contact_scrolls,
        # 判分：笔记标题"周末成都计划"含车次号；forecast 信息保持备忘完整性。
        "note_content": lambda t, s: (
            lambda date_value, train: f"{train['trainCode']} {train['startTime']} 出发 "
            f"{_forecast_message_of(s, '成都', date_value)}"
        )(_next_saturday_of(s), _picked_train(s, "北京", "成都", _next_saturday_of(s))),
    },
}


# ---------------------------------------------------------------------------
# Branch picks — 条件分支任务（pick 与判分器分支条件同源）
# ---------------------------------------------------------------------------

def _rain_branch_pick(task: Any, state: dict[str, Any]) -> str:
    """镜像 WeatherRainBranchNotify：weather.tomorrow_is_rainy(city)。"""
    return "rain_umbrella" if _weather_of(state).tomorrow_is_rainy(str(task.p.city)) else "clear_nice"


def _balance_conditional_pick(task: Any, state: dict[str, Any]) -> str:
    """镜像 RailwayBalanceConditionalBuyNotify：余额 vs 最低高铁票价。
    注：任务文档声称注入随机余额，但当前实现无 _post_sample——按现实现状
    从初始状态读余额（默认余额远大于票价，采样路径恒走"够"分支；若未来补上
    注入，此 pick 自动跟随）。"""
    cheapest = _cheapest_high_speed_price(
        state, str(task.p.from_station), str(task.p.city), str(task.p.date)
    )
    balance = float(Alipay(state["apps"]["alipay"]).total_balance)
    return "buy_and_notify" if balance >= cheapest else "notify_broke"


def _weekend_shanghai_pick(task: Any, state: dict[str, Any]) -> str:
    """镜像 WeekendShanghaiTripIfClearAndFree：下周六成都昼/夜任一下雨，或
    日历当天已有安排 → 只查不动。"""
    target = dt.date.fromisoformat(_next_saturday_of(state))
    day = _weather_of(state).daily_by_date("成都", target.isoformat())
    rainy = Weather.is_raining_text(str(day.get("textDay") or "")) or Weather.is_raining_text(
        str(day.get("textNight") or "")
    )
    conflict = _calendar_of(state).count_events_on_date(target) > 0
    return "stop_after_query" if (rainy or conflict) else "plan_trip"


def _not_sunny_pick(task: Any, state: dict[str, Any]) -> str:
    """镜像 WeatherCalendar_CreateEventIfNotSunny：is_sunny_text(当前天气)。"""
    is_sunny = Weather.is_sunny_text(_weather_of(state).current_weather_text(str(task.p.city)))
    return "skip_when_sunny" if is_sunny else "create_event"


def _top_rated_pick(task: Any, state: dict[str, Any]) -> str:
    """镜像 TopRated… 判分：评分最高 POI 的驾车距离 < 2 公里 → 微信双邀请，
    否则短信地址（静态目录 + geo_route_from_current，与判分完全同款调用）。"""
    route = Map.geo_route_from_current(str(_map_best(task)["place_id"]), "DRIVING")
    return "wechat_invite" if float(route["distance_meters"]) < 2000 else "sms_address"


def _restaurant_rating_pick(task: Any, state: dict[str, Any]) -> str:
    """镜像 RestaurantRatingInviteCalendar：静态目录评分 vs {rating} 阈值。"""
    rating = float(Map.resolve_places(str(task.p.restaurant))[0]["rating"])
    return "invite_and_schedule" if rating > float(task.p.rating) else "skip_low_rating"


def _weekend_trip_pick(task: Any, state: dict[str, Any]) -> str:
    """镜像 WeekendTripFullPlan：下周六 {city} 昼/夜任一下雨 → 全流程中止。"""
    saturday, _ = _next_weekend_saturday_dates(state)
    rainy = _weather_of(state).is_rainy_on_date(str(task.p.city), saturday, _today_of(state))
    return "rainy_stop" if rainy else "go_plan"


def _calendar_free_invite_pick(task: Any, state: dict[str, Any]) -> str:
    """镜像 CalendarFreeWeatherInvite：存在日历空闲且不下雨的下周末日子才邀请。"""
    return "send_invite" if _calendar_free_valid_days(task, state) else "no_invite"


# 条件分支任务的 R3 豁免：判分在"不行动"分支明确要求输出端 App 零新增
# （check_no_new_* / check_no_event_created），正确轨迹不打开这些 App，
# R3 的 awake 全覆盖要求不适用（豁免为任务级，附带跳过其余分支的 lint）。
LINT_EXEMPT: dict[str, str] = {
    "crossapp_life.TopRatedNearbyPlaceConditionalWechatOrSmsInvite": (
        "条件分支任务（已 Branch 化）：微信分支判分要求短信零新增（sms_no_extra）"
        "不开短信 App，短信分支判分要求微信零新增（wechat_no_invite*）不开微信，"
        "两分支各缺一个 App 的 awake，R3 覆盖不适用"
    ),
    "crossapp_life.WeekendShanghaiTripIfClearAndFree": (
        "条件分支任务（已 Branch 化）：stop_after_query 分支判分要求笔记/闹钟/微信"
        "零新增（check_no_new_*），正确轨迹只查票+天气+日历，不打开 notes/clock/"
        "wechat，R3 覆盖不适用"
    ),
    "crossapp_life.RestaurantRatingInviteCalendar": (
        "条件分支任务（已 Branch 化）：skip_low_rating 分支判分要求微信零新增 + "
        "日历零新增（no_invite_when_low_rating / no_dinner_event），正确轨迹只搜"
        "地图看评分，R3 覆盖不适用"
    ),
    "crossapp_life.WeekendTripFullPlan": (
        "条件分支任务（已 Branch 化）：rainy_stop 分支判分要求日历/微信零新增"
        "（check_no_new_*），正确轨迹只查天气即止，不打开 map/calendar/wechat，"
        "R3 覆盖不适用"
    ),
    "crossapp_life.CalendarFreeWeatherInvite": (
        "条件分支任务（已 Branch 化）：no_invite 分支判分要求微信零新增"
        "（no_invite），正确轨迹只看日历+天气，不打开 wechat，R3 覆盖不适用"
    ),
}

PLANS: dict[str, list[Step] | Branch] = {
    "crossapp_life.MapPlaceToWechat": [
        # 判分需要地址：结果卡片不含地址，点开目标地点详情页读 AddressCard。
        # 相关性排序下精确同名卡可能被带后缀卡挤出首屏（如 北京华联 排第 6），
        # 先按派生索引滚动 sheet 再点。
        *search_map("{place}"),
        scroll_result_sheet(),
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
        # {city} 为 enum（可采样成任意收藏城市）：先切城市再取数。
        *open_weather_city("{city}", select=True, forecast_swipes=1),
        *create_note("适合出行的日子", "{note_content}"),
        complete(),
    ],
    # Branch：pick 同判分 weather.tomorrow_is_rainy({city})——雨天消息含"伞"，
    # 晴天含"天气不错"；两分支同为 天气→微信，R3 全覆盖。
    "crossapp_life.WeatherRainBranchNotify": Branch(
        pick=_rain_branch_pick,
        branches={
            "rain_umbrella": [
                *open_weather_city("{city}", select=True),
                *send_wechat_message("明天有雨，记得带伞"),
                complete(),
            ],
            "clear_nice": [
                *open_weather_city("{city}", select=True),
                *send_wechat_message("明天天气不错"),
                complete(),
            ],
        },
    ),
    "crossapp_life.RailwayTrainInfoToWechat": [
        *railway_query("{from_station}", "{to_station}", "{date}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_life.RailwayPriceVsBalance": [
        *railway_query("{from_station}", "{to_station}", "{date}"),
        # 证据断言：最便宜票价数字出现在查询结果页（卡片渲染 "¥<价格>起"，
        # 价格按采样站点对从目录派生，与日期无关；scope 收窄到 12306 页面容器）。
        assert_answer(
            "{cheapest_price_digits}",
            field_index=0,
            scope='[data-scroll-container="main"]',
            summary="assert cheapest second-class price on query results",
            endorses=["answer_price"],
        ),
        # 余额在 支付宝 → 我的 → 余额页（crossapp_commerce 已验证路径）。
        *open_alipay_balance(),
        # 证据断言：够/不够是 票价 vs 余额 的比较结论，屏上无此字样；票价断言
        # + 余额屏显断言合证比较依据，收尾断言背书 {answer_afford}。
        assert_text(
            "{balance_screen}",
            summary="assert Alipay total balance on screen",
            endorses=["answer_afford"],
        ),
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
        # 收窄到预报横滚容器；天气文案为昼夜合并注入值，无法整串包含匹配——
        # 文案与温度同列渲染，双温度断言钉住到达日列，收尾断言背书
        # {answer_weather}）。
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
            endorses=["answer_weather"],
        ),
        *grounded_answer("{answer_weather}", "{answer_high}", "{answer_low}", summary="answer destination weather"),
        complete(),
    ],
    "crossapp_life.MapNearbyBestToWechat": [
        # 判分需要最高分店的地址：滚动结果 sheet 到 {best_name}（派生的评分
        # 最高店）后点开详情页读 AddressCard。
        *search_map("{category}"),
        scroll_result_sheet(),
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
        # 目标窗口未来两周：切城市（{city} 为 enum）+ 15 日预报页两次强横扫。
        # 闹钟目标固定 08:00，源闹钟/滚轮参数从初始 clock.alarms 派生。
        *open_weather_city("{city}", select=True, forecast_swipes=2),
        *create_calendar_event("{target_date}", "户外运动"),
        *set_alarm_time(
            "{alarm_source_time}",
            "{alarm_hour}",
            "{alarm_wheel_minute}",
            source_hour="{alarm_source_hour}",
            source_minute="{alarm_source_minute}",
            scroll_to_source=True,
        ),
        complete(),
    ],
    # Branch：pick 同判分 余额 vs 最低高铁票价——够则购票+微信告知去向，不够
    # 则微信说没钱；两分支都查票+看余额+发微信（12306/支付宝/微信 R3 全覆盖）。
    # 顺序不能是"先支付宝"：episode 起始会后台挂载任务所需 App，12306 首页的
    # 隐藏 tab.my 会与支付宝的 tab.my 选择器冲突。
    "crossapp_life.RailwayBalanceConditionalBuyNotify": Branch(
        pick=_balance_conditional_pick,
        branches={
            "buy_and_notify": [
                *railway_query("{from_station}", "{city}", "{date}"),
                *open_alipay_balance(),
                *open_app("铁路12306"),
                scroll_train_results(),
                *book_visible_train("{train_no}", "{seat_type}", "{passenger_name}"),
                *send_wechat_message("我要去{city}"),
                complete(),
            ],
            # 判分：无新订单 + 消息含 没钱/不够/买不起（"没钱"短路差额数字要求）。
            "notify_broke": [
                *railway_query("{from_station}", "{city}", "{date}"),
                *open_alipay_balance(),
                *send_wechat_message("没钱了，买不起去{city}的票"),
                complete(),
            ],
        },
    ),
    # Branch：pick 同判分 下周末（日历空闲 ∧ 不下雨）——有可约日子才发邀请，
    # 消息带具体日期标签；无可约日子只看日历+天气（no_invite 分支不开微信，
    # R3 豁免见 LINT_EXEMPT）。
    "crossapp_life.CalendarFreeWeatherInvite": Branch(
        pick=_calendar_free_invite_pick,
        branches={
            "send_invite": [
                # 下周末在 8-14 天后：天气侧切城市（{city} 为 enum）+ 15 日预报页
                # 两次强横扫。（日历侧下周末日期格可能跨月，保持日历首页浏览。）
                *open_app("日历"),
                *open_weather_city("{city}", select=True, forecast_swipes=2),
                *send_wechat_message("{wechat_message}"),
                complete(),
            ],
            "no_invite": [
                *open_app("日历"),
                *open_weather_city("{city}", select=True, forecast_swipes=2),
                complete(),
            ],
        },
    ),
    "crossapp_life.WechatFoodExtractMapSms": [
        # 判分地址=最近门店：同名门店多家，先按距离排序再点第一张卡进详情读地址。
        *open_app("WeChat"),
        *search_map("{brand}"),
        *sort_results_by_distance(),
        *open_place_detail("{brand}"),
        *send_sms_message("{sms_message}"),
        complete(),
    ],
    # Branch：pick 同判分 静态目录评分 vs {rating} 阈值——超过才发邀请+建日程
    # （默认参数 沸腾鱼乡=4.0 不超过 4.0 阈值，走 skip 分支）；skip 分支只搜
    # 地图看评分（不开微信/日历，R3 豁免见 LINT_EXEMPT）。
    "crossapp_life.RestaurantRatingInviteCalendar": Branch(
        pick=_restaurant_rating_pick,
        branches={
            "invite_and_schedule": [
                *search_map("{restaurant}"),
                *send_wechat_message("今晚去{restaurant}吃饭？"),
                *create_calendar_event("{today}", "聚餐", start="19:00", end="21:00"),
                complete(),
            ],
            "skip_low_rating": [
                *search_map("{restaurant}"),
                complete(),
            ],
        },
    ),
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
    # Branch：pick 同判分 下周六 {city} 是否下雨——下雨则整个流程中止（只查
    # 天气，不开 map/calendar/wechat，R3 豁免见 LINT_EXEMPT）。
    "crossapp_life.WeekendTripFullPlan": Branch(
        pick=_weekend_trip_pick,
        branches={
            "go_plan": [
                # 下周六在 8-14 天后（城市=北京即 located 页）：15 日预报页两次强横扫。
                *open_weather_city("{city}", forecast_swipes=2),
                *search_map("{destination}"),
                *create_calendar_event("{target_date}", "出游"),
                *send_wechat_message("下周六一起去{destination}出游"),
                complete(),
            ],
            "rainy_stop": [
                *open_weather_city("{city}", forecast_swipes=2),
                complete(),
            ],
        },
    ),
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
        # 同 MapPlaceToWechat：先按派生索引滚动 sheet 把精确同名卡滚进可点视口。
        *search_map("{dest}"),
        scroll_result_sheet(),
        *open_place_detail("{dest}"),
        *open_weather_city("{weather_city}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    # Branch：pick 同判分 is_sunny_text(当前天气)——非晴才建全天日程；晴天分支
    # 查完天气后打开日历浏览确认（判分只查 check_no_event_created，浏览不产生
    # 事件，同时保住 R3 覆盖，任务无需豁免）。
    "crossapp_life.WeatherCalendar_CreateEventIfNotSunny": Branch(
        pick=_not_sunny_pick,
        branches={
            "create_event": [
                # 当前天气在首页 hero，但 {city} 可能非 located 默认城市：切城市。
                *open_weather_city("{city}", select=True),
                *create_calendar_event("{today}", "{event_title}", all_day=True, notes="{event_notes}"),
                complete(),
            ],
            "skip_when_sunny": [
                *open_weather_city("{city}", select=True),
                *open_app("日历"),
                complete(),
            ],
        },
    ),
    "crossapp_life.OpenedFridgeFoodsToMom": [
        # 开封食材信息在相册「相机」的两张冰箱照片里（crossapp_work 相册 helper 模式）。
        *open_gallery_album("相机"),
        *view_gallery_photos("IMG_8051.jpg", "IMG_8052.jpg"),
        *send_wechat_message("{wechat_message}", contact_wxid="{mom_wxid}", scrolls="{mom_scrolls}"),
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
        # 专用占位符：任务 _route sampler 的输出键（from_station/to_station）
        # 会直接落进 task.params 且与判分读的 from_city/to_city 不一致（任务
        # 定义 fields 仅文档性的既有错位）——plan 占位符避开被污染的键名，
        # 从判分同源的 from_city/to_city 派生。
        *railway_query("{mom_from_station}", "{mom_to_station}", "{date}"),
        *send_wechat_message("{wechat_message}", contact_wxid="{mom_wxid}", scrolls="{mom_scrolls}"),
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
        *send_wechat_message("{wechat_message}", contact_wxid="{xiaozhou_wxid}", scrolls="{xiaozhou_scrolls}"),
        complete(),
    ],
    # Branch：pick 同判分 评分最高店的驾车距离 vs 2 公里——近则微信双邀请，
    # 远则短信发地址（各缺一个输出端 App 的 awake，R3 豁免见 LINT_EXEMPT）。
    # 结果卡按 {best_name}（派生的评分最高店名）定位；泛类别同名多店时首个
    # 可见匹配可能非评分最高那家——判分自算 best，不影响判定，仅证据近似。
    "crossapp_life.TopRatedNearbyPlaceConditionalWechatOrSmsInvite": Branch(
        pick=_top_rated_pick,
        branches={
            "wechat_invite": [
                # 分支条件是开车距离：滚动到目标结果卡后点「路线」读驾车距离。
                *search_map("{category}"),
                scroll_result_sheet(),
                *open_route_to_result("{best_name}"),
                *send_wechat_message("{best_name} 要不要一起去", contact_wxid="{target_wxid}", scrolls="{target_scrolls}"),
                *send_wechat_message("{best_name} 要不要一起去", contact_wxid="{notify_wxid}", scrolls="{notify_scrolls}"),
                complete(),
            ],
            "sms_address": [
                *search_map("{category}"),
                scroll_result_sheet(),
                *open_route_to_result("{best_name}"),
                # 「路线」按钮 push 探索页路线态并卸载搜索结果页（/search 为
                # exclusive subpage）；back 回到空态搜索页后重新提交同一查询
                # 恢复结果列表，再点开目标店详情读判分地址（AddressCard）。
                back(summary="close route view back to search page"),
                wait(0.5, summary="wait for search page"),
                *search_map("{category}"),
                scroll_result_sheet(),
                *open_place_detail("{best_name}"),
                *send_sms_message("{sms_message}"),
                complete(),
            ],
        },
    ),
    "crossapp_life.WeatherFirstNonRainyToCalendarAndSms": [
        # 目标窗口未来一周：切城市（{city} 为 enum）+ 15 日预报页一次强横扫。
        *open_weather_city("{city}", select=True, forecast_swipes=1),
        *create_calendar_event("{target_date}", "户外跑步"),
        *send_sms_message("{sms_message}"),
        complete(),
    ],
    # Branch：pick 同判分 下周六成都下雨 ∨ 日历冲突——满足才做全套（笔记+闹钟
    # +微信），否则只查票+天气+日历即止（不开 notes/clock/wechat，R3 豁免见
    # LINT_EXEMPT）。判分两分支都要求完成 12306 查询。
    "crossapp_life.WeekendShanghaiTripIfClearAndFree": Branch(
        pick=_weekend_shanghai_pick,
        branches={
            "plan_trip": [
                *railway_query("北京", "成都", "{target_date}"),
                # 下周六最多 7 天后：切城市成都 + 15 日预报页一次强横扫。
                *open_weather_city("成都", select=True, forecast_swipes=1),
                # 任务要求核对那天日历有没有安排：打开日历首页浏览（只读）。
                *open_app("日历"),
                *create_note("周末成都计划", "{note_content}"),
                *set_alarm_time(
                    "{alarm_source_time}",
                    "{alarm_hour}",
                    "{alarm_wheel_minute}",
                    source_hour="{alarm_source_hour}",
                    source_minute="{alarm_source_minute}",
                ),
                *send_wechat_message("那天见面方便吗"),
                complete(),
            ],
            "stop_after_query": [
                *railway_query("北京", "成都", "{target_date}"),
                *open_weather_city("成都", select=True, forecast_swipes=1),
                *open_app("日历"),
                complete(),
            ],
        },
    ),
}
