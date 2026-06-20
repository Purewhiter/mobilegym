"""Scripted validation plans for Tencent Meeting tasks."""

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


PLANS: dict[str, list[Step]] = {
    "tencent_meeting.ConfigAudioSettings": [
        *open_settings(),
        action_visible("settings.audio.micOnJoin.toggle", summary="toggle mic-on-join setting"),
        action_visible("settings.audio.speakerOnJoin.toggle", summary="toggle speaker-on-join setting"),
        complete(),
    ],
    "tencent_meeting.CheckPersonalRoomId": [
        *grounded_answer("{answer}", summary="answer personal room id"),
        complete(),
    ],
    "tencent_meeting.CheckContactCount": [
        *grounded_answer("{answer}", summary="answer contact count"),
        complete(),
    ],
    "tencent_meeting.ToggleNotification": [
        *open_settings(),
        action_visible("settings.notifications.toggle", summary="toggle notifications"),
        complete(),
    ],
    "tencent_meeting.FindMeetingHistory": [
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
        *grounded_answer("{answer}", summary="answer scheduled meeting id"),
        complete(),
    ],
    "tencent_meeting.CheckScheduledMeetingEndTime": [
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
        *grounded_answer("{answer}", summary="answer new scheduled meeting id"),
        complete(),
    ],
    "tencent_meeting.CountFriendMeetings": [
        *grounded_answer("{answer}", summary="answer friend-hosted meeting count"),
        complete(),
    ],
    "tencent_meeting.GetSecondParticipationTime": [
        *grounded_answer("{answer}", summary="answer second participation time"),
        complete(),
    ],
    "tencent_meeting.FindLongestMeeting": [
        *grounded_answer("{answer}", summary="answer longest meeting"),
        complete(),
    ],
    "tencent_meeting.FindMeetingWithMostParticipants": [
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
        *grounded_answer("{answer}", summary="answer total participation duration"),
        complete(),
    ],
    "tencent_meeting.CompareParticipationDurations": [
        *grounded_choice_answer("{answer}", summary="answer longer participation meeting"),
        complete(),
    ],
}
