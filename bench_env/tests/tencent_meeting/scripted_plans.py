"""Scripted validation plans for Tencent Meeting tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
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
    type_text,
    wait,
)


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def trigger_visible(trigger_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-trigger="{trigger_id}"]:visible', summary=summary)


def action_visible(action_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-action="{action_id}"]:visible', summary=summary)


def button_text(*labels: str, summary: str) -> Step:
    selector = ", ".join(f'button:has-text("{label}"):visible' for label in labels)
    return click_selector(selector, summary=summary)


def open_meeting_app() -> list[Step]:
    return [
        home(summary="return to launcher"),
        awake("腾讯会议", summary="launch Tencent Meeting"),
        wait(0.8, summary="wait for Tencent Meeting home"),
    ]


def answer_sheet_input(index: int) -> str:
    return f'[data-scroll-container="sheet-form"] div.space-y-5 > div:nth-child({index + 1}) input'


def grounded_choice_answer(choice: str, *, summary: str | None = None) -> list[Step]:
    steps = open_answer_sheet()
    steps.append(click_selector(f'button:has-text("{choice}"):visible', summary=f"choose answer {choice}"))
    steps.append(submit_answer_sheet(summary=summary))
    return steps


def open_profile() -> list[Step]:
    return [
        *open_meeting_app(),
        trigger_visible("home.profile.open", summary="open Tencent Meeting profile"),
        wait(0.3, summary="wait for profile page"),
    ]


def open_settings() -> list[Step]:
    return [
        *open_profile(),
        trigger_visible("profile.settings.open", summary="open settings"),
        wait(0.4, summary="wait for settings page"),
    ]


def open_account_security() -> list[Step]:
    return [
        *open_profile(),
        trigger_visible("profile.account_security.open", summary="open account security"),
        wait(0.4, summary="wait for account security page"),
    ]


def join_meeting(meeting_id: str) -> list[Step]:
    return [
        *open_meeting_app(),
        trigger_visible("home.join.open", summary="open join meeting page"),
        type_text(meeting_id, selector='input[inputmode="numeric"]:visible', clear=True, summary=f"enter meeting id {meeting_id}"),
        button_text("加入会议", "Join", summary="join meeting"),
        wait(0.8, summary="wait for meeting page"),
    ]


def open_meeting_chat() -> list[Step]:
    return [
        trigger_visible("meeting.chat.open", summary="open in-meeting chat"),
        wait(0.3, summary="wait for chat sheet"),
    ]


def send_chat_message(message: str) -> list[Step]:
    return [
        type_text(message, selector="textarea:visible", clear=True, summary="enter chat message"),
        click_selector('button[aria-label="Send message"]:visible', summary="send chat message"),
        wait(0.3, summary="wait for message send"),
    ]


def select_chat_recipient(name: str) -> list[Step]:
    return [
        click_selector(
            'div.mb-1.flex:has-text("发送至"):visible, div.mb-1.flex:has-text("Send to"):visible',
            summary="open chat recipient selector",
        ),
        wait(0.3, summary="wait for recipient sheet"),
        click_selector(
            f'div.flex.items-center.justify-between.px-4.py-3:has-text("{name}"):visible',
            summary=f"select chat recipient {name}",
        ),
        wait(0.3, summary="wait for recipient selection"),
    ]


def rename_meeting_self(name: str) -> list[Step]:
    return [
        wait(2.1, summary="wait for meeting entry animation"),
        click_selector(
            'div.flex.flex-col.items-center.gap-1:has-text("静音"):visible, div.flex.flex-col.items-center.gap-1:has-text("Mute"):visible',
            summary="mute myself before renaming",
        ),
        wait(0.2, summary="wait for self mute setting"),
        click_selector(
            'div.flex.flex-col.items-center.gap-1:has-text("管理成员"):visible, div.flex.flex-col.items-center.gap-1:has-text("Participants"):visible',
            summary="open participant manager",
        ),
        wait(0.4, summary="wait for participant manager"),
        click_selector(
            'div.flex.items-center.justify-between.px-4.py-3:has-text("小明"):visible',
            summary="open my participant profile",
        ),
        wait(0.3, summary="wait for participant profile"),
        click_selector(
            'xpath=//span[normalize-space()="修改会中昵称" or normalize-space()="Rename in Meeting"]/ancestor::div[contains(@class,"active:bg-gray-50")][1]',
            summary="open rename dialog",
        ),
        type_text(
            name,
            selector='xpath=(//div[contains(@class,"bg-app-surface") and contains(@class,"rounded-xl") and .//*[normalize-space()="修改昵称" or normalize-space()="Rename"]]//input)[1]',
            clear=True,
            summary="enter new meeting nickname",
        ),
        button_text("确定", "OK", summary="confirm meeting nickname"),
        wait(0.3, summary="wait for rename to apply"),
    ]


def enable_schedule_password(pin: str) -> list[Step]:
    return [
        click_selector(
            'xpath=//span[normalize-space()="入会密码" or normalize-space()="Meeting Password"]/ancestor::div[contains(@class,"justify-between")][1]//div[contains(@class,"w-11")]',
            summary="enable meeting password",
        ),
        wait(0.3, summary="wait for password input"),
        type_text(
            pin,
            selector='input[placeholder="请输入4-6位数字密码"]:visible, input[placeholder="Enter 4-6 digit password"]:visible',
            clear=True,
            summary="enter meeting password",
        ),
    ]


def schedule_new_meeting() -> list[Step]:
    return [
        *open_meeting_app(),
        trigger_visible("home.schedule.open", summary="open schedule entry"),
        trigger_visible("schedule.regular.open", summary="choose regular meeting"),
        wait(0.4, summary="wait for schedule form"),
        type_text("{topic}", selector="input:visible", clear=True, summary="enter meeting topic"),
        back(summary="dismiss keyboard after entering meeting topic"),
        *enable_schedule_password("{pin}"),
        back(summary="dismiss keyboard after entering meeting password"),
        trigger_visible("schedule.complete", summary="complete scheduled meeting"),
        wait(0.8, summary="wait for meeting detail"),
    ]


# ---------------------------------------------------------------------------
# History-list navigation helpers (query tasks)
# ---------------------------------------------------------------------------

# 历史列表展示顺序（按最近入会时间倒序，见 HistoryMeetingsPage convertToDisplayFormat）。
HISTORY_TOPICS_DISPLAY_ORDER: tuple[str, ...] = (
    "老王的快速会议",
    "产品需求讨论",
    "技术方案评审",
    "小明的快速会议",
    "周例会",
    "王五的项目讨论",
    "张三的快速会议",
    "李四的快速会议",
    "长时间研讨会",
    "王五的快速会议",
    "项目周会",
    "孙七的快速会议",
    "周八的个人会议室",
)

# 2026-02-03 分组的 5 场历史会议（对应 CalculateTotalMeetingDuration 的 date 测试参数）。
HISTORY_TOPICS_2026_02_03: tuple[str, ...] = (
    "张三的快速会议",
    "李四的快速会议",
    "长时间研讨会",
    "王五的快速会议",
    "项目周会",
)

# 2026-02-03 各场详情页"参会时长"的屏幕渲染值（HH:MM:SS，= defaults.json 该场
# participations duration 之和），供 CalculateTotalMeetingDuration 逐场证据断言。
# 与 HISTORY_TOPICS_2026_02_03 同源硬编码，数据变更时一并更新。
HISTORY_PARTICIPATION_HHMMSS_2026_02_03: dict[str, str] = {
    "张三的快速会议": "00:14:00",
    "李四的快速会议": "00:28:00",
    "长时间研讨会": "01:45:00",
    "王五的快速会议": "00:43:00",
    "项目周会": "00:59:00",
}


def open_history_list() -> list[Step]:
    return [
        *open_meeting_app(),
        trigger_visible("home.history.open", summary="open history meetings list"),
        wait(0.4, summary="wait for history list"),
    ]


def scroll_history_list(times: int, *, summary: str) -> list[Step]:
    """Swipe through the history list to view every row (over-scroll clamps at bottom)."""
    return [
        swipe([500, 760], [500, 220], summary=f"{summary} ({index + 1}/{times})")
        for index in range(times)
    ]


def search_history(topic: str) -> Step:
    """Filter the history list by title via the search box.

    搜索状态经 sessionStorage 持久化，从详情页返回后仍保留搜索模式，
    因此逐场遍历时每次用 clear=True 直接替换关键词即可。
    """
    return type_text(
        topic,
        selector="input:visible",
        clear=True,
        summary=f"search history for {topic}",
    )


def open_history_detail(topic: str) -> list[Step]:
    """Search ``topic`` in the history list, then open its detail page."""
    return [
        search_history(topic),
        click_selector(
            f'[data-trigger="history.detail.open"]:has-text("{topic}"):visible',
            summary=f"open history detail of {topic}",
        ),
    ]


def visit_history_details(
    *topics: str,
    assert_after: dict[str, list[Step]] | None = None,
) -> list[Step]:
    """Visit each history meeting's detail page in turn (read info, then back).

    ``assert_after`` 按主题在其详情页打开后、返回列表前插入额外断言步
    （就地自证；断言自带 3s 轮询，无需额外 wait）。
    """
    steps: list[Step] = []
    for topic in topics:
        steps.extend(open_history_detail(topic))
        steps.extend((assert_after or {}).get(topic, []))
        steps.append(back(summary=f"back to history list from {topic}"))
    return steps


def open_scheduled_meeting_detail(topic: str) -> list[Step]:
    """Open a pending scheduled meeting's detail page from the home card."""
    return [
        *open_meeting_app(),
        click_selector(
            f'[data-trigger="home.meeting.detail"]:has-text("{topic}"):visible',
            summary=f"open scheduled meeting {topic}",
        ),
        wait(0.3, summary="wait for scheduled meeting detail"),
    ]


PLANS: dict[str, list[Step]] = {
    "tencent_meeting.ConfigAudioSettings": [
        *open_settings(),
        action_visible("settings.audio.micOnJoin.toggle", summary="toggle mic-on-join setting"),
        action_visible("settings.audio.speakerOnJoin.toggle", summary="toggle speaker-on-join setting"),
        complete(),
    ],
    "tencent_meeting.CheckPersonalRoomId": [
        *open_profile(),
        trigger_visible("profile.personal_room.open", summary="open personal meeting room"),
        wait(0.3, summary="read personal room meeting id"),
        # 就地自证（A类）：个人会议室页"会议号"行在屏。text 匹配为规整化包含
        # 且剥离空白，可吸收 "337 607 3736" 这类空格分段差异。
        assert_answer("{answer}", field_index=0, summary="assert personal room id on screen"),
        *grounded_answer("{answer}", summary="answer personal room id"),
        complete(),
    ],
    "tencent_meeting.CheckContactCount": [
        *open_meeting_app(),
        trigger_visible("tab.contacts", summary="open contacts tab"),
        wait(0.3, summary="read friend count on contacts page"),
        # 就地自证（A类）：通讯录分组头"我的好友 (5)"在屏（number 匹配提取独立数字）。
        assert_answer("{answer}", field_index=0, summary="assert friend count on screen"),
        *grounded_answer("{answer}", summary="answer contact count"),
        complete(),
    ],
    "tencent_meeting.ToggleNotification": [
        *open_settings(),
        action_visible("settings.notifications.toggle", summary="toggle notifications"),
        complete(),
    ],
    "tencent_meeting.FindMeetingHistory": [
        *open_history_list(),
        *open_history_detail("{topic}"),
        # 详情页时间行 "02月xx日HH:MM-HH:MM" 同时给出开始时间与预定时长（结束-开始）。
        wait(0.3, summary="read start time and planned duration"),
        # 就地自证（A类，仅 field 0）：开始时间在时间行内（time 匹配可从
        # "02月03日14:00-17:00..." 提取 HH:MM）。field 1 预定时长是"结束-开始"
        # 的推导值，"180分钟" 字样不在屏（match_duration 不解析 HH:MM-HH:MM
        # 区间，属格式失配），其证据与开始时间同一行，本断言已锁定该行可见。
        assert_answer("{answer_start}", field_index=0, summary="assert start time on detail time row"),
        *grounded_answer("{answer_start}", "{answer_duration}", summary="answer history start and duration"),
        complete(),
    ],
    "tencent_meeting.StartFastMeeting": [
        *open_meeting_app(),
        trigger_visible("home.quick.open", summary="open quick meeting"),
        click_selector(
            'xpath=(//span[normalize-space()="开启视频" or normalize-space()="Turn on video"]/following-sibling::div)[1]',
            summary="turn on quick meeting video",
        ),
        trigger_visible("quick.meeting.open", summary="enter quick meeting"),
        wait(0.8, summary="wait for quick meeting"),
        click_selector(
            'div.flex.flex-col.items-center.gap-1:has-text("静音"):visible, div.flex.flex-col.items-center.gap-1:has-text("Mute"):visible',
            summary="mute microphone in quick meeting",
        ),
        wait(0.2, summary="wait for mute setting"),
        complete(),
    ],
    "tencent_meeting.ChatInMeeting": [
        *join_meeting("{meeting_id}"),
        *open_meeting_chat(),
        *send_chat_message("{message}"),
        complete(),
    ],
    "tencent_meeting.ConfigPrivacySettings": [
        *open_settings(),
        swipe([500, 760], [500, 220], summary="scroll settings to video privacy options"),
        wait(0.2, summary="wait after settings scroll"),
        action_visible("settings.video.hideNonVideo.toggle", summary="toggle hide non-video attendees"),
        action_visible("settings.video.hideSelf.toggle", summary="toggle hide self"),
        complete(),
    ],
    "tencent_meeting.ConfigShowIdentity": [
        *open_account_security(),
        action_visible("accountSecurity.showIdentity.toggle", summary="toggle public certified identity"),
        complete(),
    ],
    "tencent_meeting.CheckPendingMeetingId": [
        *open_scheduled_meeting_detail("{topic}"),
        # 就地自证（A类）：预约详情页"会议号"行在屏；text 匹配剥离空白，
        # 屏幕渲染与答案（"836 291 475"）的分段差异均可吸收。
        assert_answer("{answer}", field_index=0, summary="assert scheduled meeting id on screen"),
        *grounded_answer("{answer}", summary="answer scheduled meeting id"),
        complete(),
    ],
    "tencent_meeting.CheckScheduledMeetingEndTime": [
        *open_scheduled_meeting_detail("{topic}"),
        # 就地自证（A类）：详情页右侧大字结束时间 HH:MM 在屏（time 匹配 ±5min，
        # 顺带吸收测试造答案与模拟器时钟的少量漂移；开始时间相距 1h 不会误中）。
        assert_answer("{answer}", field_index=0, summary="assert scheduled end time on screen"),
        *grounded_answer("{answer}", summary="answer scheduled meeting end time"),
        complete(),
    ],
    "tencent_meeting.JoinMeetingAndRename": [
        *join_meeting("{meeting_id}"),
        *rename_meeting_self("{name}"),
        complete(),
    ],
    "tencent_meeting.ScheduleMeeting": [
        *schedule_new_meeting(),
        # 就地自证（A类）：预约完成落地新会议详情页，"会议号"行在屏。答案由
        # TencentMeeting.predicted_meeting_id 预测，断言顺带验证 Python 预测
        # 与 App 端 generateMeetingId 派生一致（text 匹配剥离空白）。
        assert_answer("{answer}", field_index=0, summary="assert new meeting id on detail page"),
        *grounded_answer("{answer}", summary="answer new scheduled meeting id"),
        complete(),
    ],
    "tencent_meeting.CountFriendMeetings": [
        # 先看通讯录确认 5 位好友名单，再通览历史列表逐行核对主持人。
        *open_meeting_app(),
        trigger_visible("tab.contacts", summary="view friend list on contacts tab"),
        wait(0.3, summary="read friend names"),
        # 就地自证（B类）：答案 8 场是"好友名单 × 历史主持人"的聚合计数，不在
        # 任何单屏。证据一：通讯录末位好友"孙七"行在屏 → 5 人名单完整可见。
        assert_text("孙七", summary="assert last friend row visible on contacts"),
        trigger_visible("tab.home", summary="return to home tab"),
        trigger_visible("home.history.open", summary="open history meetings list"),
        wait(0.4, summary="wait for history list"),
        # 搜索态归零：历史页搜索状态经 sessionStorage 持久化，而 __SIM__.resetState
        # 只清 localStorage —— 同一浏览器里前序 episode 的搜索会泄漏进来，让本
        # episode 打开的是过滤后的列表（证据二断言正是因此在全套件运行中失败）。
        # 先点搜索框（无论何种初始态都进入搜索态）、再点"取消"（清空关键词并
        # 退出搜索、顺带删掉 sessionStorage 残留），确定性收敛到未过滤全列表。
        click_selector("input:visible", summary="focus history search box"),
        click_selector('button:has-text("取消"):visible', summary="cancel search to show unfiltered list"),
        wait(0.4, summary="wait for keyboard dismiss and full list"),
        # 5 次滑动确保滚到 13 行列表底部（过滚在底部钳制，多滑无副作用）。
        *scroll_history_list(5, summary="scan history hosts"),
        # 证据二：滚到底后列表末行"周八的个人会议室"在屏 → 13 场（每行带主持人
        # 列）已全部过目，计数所需信息获取完毕。
        assert_text("周八的个人会议室", summary="assert last history row visible after full scan"),
        *grounded_answer("{answer}", summary="answer friend-hosted meeting count"),
        complete(),
    ],
    "tencent_meeting.GetSecondParticipationTime": [
        *open_history_list(),
        *open_history_detail("{topic}"),
        click_selector(
            'div.cursor-pointer:has-text("参会时长"):visible',
            summary="expand participation records",
        ),
        wait(0.3, summary="read per-participation join times"),
        # 就地自证（A类，弹窗展开后断言）：第二次加入时间 15:00 只出现在参会
        # 记录弹窗的 "02月03日 15:00" 行（基础页时间行 14:00-17:00 与最近入会
        # 16:30 均不在 time 匹配的 ±5min 容差内），断言同时证明弹窗确已展开。
        assert_answer("{answer}", field_index=0, summary="assert second join time in participation popup"),
        *grounded_answer("{answer}", summary="answer second participation time"),
        complete(),
    ],
    "tencent_meeting.FindLongestMeeting": [
        # 预定时长只在详情页时间行可见：先通览列表，再逐场进详情比较全部 13 场。
        *open_history_list(),
        *scroll_history_list(2, summary="survey history list"),
        # 就地自证（B类）：答案 = 最长那场的标题，遍历到"长时间研讨会"详情时
        # 标题在屏（assert "{answer}"）；再断言其时间行区间 "14:00-17:00"
        # （180 分钟，全库唯一最长，仅详情页可见）证明比较依据确实读自该页，
        # 也排除点击未跳转、标题误中列表行的假阳性。
        *visit_history_details(
            *HISTORY_TOPICS_DISPLAY_ORDER,
            assert_after={
                "长时间研讨会": [
                    assert_text("{answer}", summary="assert longest meeting title on its detail page"),
                    assert_text("14:00-17:00", summary="assert longest meeting 180min time span"),
                ],
            },
        ),
        *grounded_answer("{answer}", summary="answer longest meeting"),
        complete(),
    ],
    "tencent_meeting.FindMeetingWithMostParticipants": [
        # 列表行显示主持人：通览找出"小明"主持的 2 场，再进详情读"已参会 共X人"。
        *open_history_list(),
        *scroll_history_list(3, summary="scan history hosts"),
        # 就地自证（A类）：我主持的两场中"周例会"参会人数最多（3 > 2），其详情
        # 页同屏可见标题（field 0，text 包含）与"已参会 共3人"（field 1，number
        # 提取独立数字；列表页无独立 "3"，该断言只可能在详情页命中）。
        *visit_history_details(
            "小明的快速会议",
            "周例会",
            assert_after={
                "周例会": [
                    assert_answer("{answer_title}", field_index=0, summary="assert most-participants meeting title"),
                    assert_answer("{answer_count}", field_index=1, summary="assert participants count on detail page"),
                ],
            },
        ),
        *grounded_answer("{answer_title}", "{answer_count}", summary="answer hosted meeting with most participants"),
        complete(),
    ],
    "tencent_meeting.ShareScreenAndConfirm": [
        *join_meeting("{meeting_id}"),
        click_selector(
            'div.flex.flex-col.items-center.gap-1:has-text("共享屏幕"):visible, div.flex.flex-col.items-center.gap-1:has-text("Share Screen"):visible',
            summary="start screen sharing",
        ),
        wait(0.3, summary="wait for share state"),
        *open_meeting_chat(),
        *send_chat_message("{message}"),
        complete(),
    ],
    "tencent_meeting.ChatWithSpecificUser": [
        *join_meeting("{meeting_id}"),
        *open_meeting_chat(),
        *select_chat_recipient("{target_user}"),
        *send_chat_message("{message}"),
        complete(),
    ],
    "tencent_meeting.CalculateTotalMeetingDuration": [
        # 定位 {date}（测试参数 2026-02-03）分组后，5 场逐场进详情读"参会时长"求和。
        *open_history_list(),
        *scroll_history_list(2, summary="locate the 2026-02-03 date group"),
        # 就地自证（B类）：总时长 249 分钟不在任何单屏（各详情页只显示本场
        # 参会时长 HH:MM:SS）。逐场断言该值在屏 —— 5 个加数齐备即证明求和
        # 所需信息全部读自屏幕，而非任何单一"最后证据"能替代。
        *visit_history_details(
            *HISTORY_TOPICS_2026_02_03,
            assert_after={
                topic: [assert_text(value, summary=f"assert participation duration of {topic}")]
                for topic, value in HISTORY_PARTICIPATION_HHMMSS_2026_02_03.items()
            },
        ),
        *grounded_answer("{answer}", summary="answer total participation duration"),
        complete(),
    ],
    "tencent_meeting.CompareParticipationDurations": [
        *open_history_list(),
        # 就地自证（B类）：答案是"哪场更长"的比较结论，不在任何单屏；对两场
        # 详情页各断言"参会时长"行在屏（该文案仅详情页有），证明两侧时长均已
        # 读取。不断言 "{answer}" 标题：参数抽样下赢家可能是 topic1，静态 plan
        # 无法预知，而两侧证据断言与参数取值无关。
        *visit_history_details(
            "{topic1}",
            assert_after={
                "{topic1}": [assert_text("参会时长", summary="assert participation duration row of topic1")],
            },
        ),
        *open_history_detail("{topic2}"),
        wait(0.3, summary="read second meeting participation duration"),
        assert_text("参会时长", summary="assert participation duration row of topic2"),
        *grounded_choice_answer("{answer}", summary="answer longer participation meeting"),
        complete(),
    ],
}
