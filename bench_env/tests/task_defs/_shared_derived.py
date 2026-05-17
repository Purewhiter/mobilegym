"""
Derived cross-app task judge regression tests.
"""

from __future__ import annotations

import datetime
from typing import Any

from bench_env.task.calendar.app import Calendar
from bench_env.task.crossapp_content.defs.ThirdSpotifyPlayRecommendOnRedbookAndPlaylist import ThirdSpotifyPlayRecommendOnRedbookAndPlaylist
from bench_env.task.crossapp_life.defs.RealisticTrip001 import RealisticTrip001
from bench_env.task.crossapp_life.defs.WeekendShanghaiTripIfClearAndFree import WeekendShanghaiTripIfClearAndFree
from bench_env.task.crossapp_work.defs.ScheduleReleaseMeetingAndNotifyViaNotesWechatSms import ScheduleReleaseMeetingAndNotifyViaNotesWechatSms
from bench_env.task.launcher.defs.ChangeWallpaperAndAddWidget import ChangeWallpaperAndAddWidget
from bench_env.tests.conftest import make_judge_input


TEST_OS_STATE = {
    "time": {
        "timestamp": int(datetime.datetime(2026, 3, 16, 12, 0, 0).timestamp() * 1000)
    }
}
TARGET_DATE = "2026-03-21"
DAJUGUAN_ID = "347f3ecf-cd69-414b-8e25-41223586fd2b"
OTHER_WIDGET_ID = "b8006e83-c497-4642-9815-f674b82842b0"
MEETING_ID_WITH_SPACES = "123 456 789"
MEETING_ID_COMPACT = "123456789"
MEETING_PASSWORD = "123456"
REALISTIC_TRIP_DATE = "2026-03-18"


def _rail_state(*, searched: bool) -> dict[str, Any]:
    train = {
        "trainNo": "G101",
        "trainType": "G",
        "fromStation": "北京西",
        "toStation": "成都东",
        "departTime": "08:00",
        "arriveTime": "12:30",
        "duration": "4小时30分",
        "seats": [{"type": "二等座", "count": 5}],
    }
    return {
        "lastQuerySummary": (
            {"from": "北京", "to": "成都", "date": TARGET_DATE}
            if searched else {}
        ),
        "queryState": {"directTrains": [train] if searched else []},
    }


def _weather_state(*, rainy: bool) -> dict[str, Any]:
    return {
        "selectedCityId": "chengdu",
        "savedCities": [{"id": "chengdu", "name": "成都"}],
        "bundlesByCityId": {
            "chengdu": {
                "locationName": "成都",
                "bundle": {
                    "daily": [
                        {
                            "fxDate": TARGET_DATE,
                            "textDay": "小雨" if rainy else "晴",
                            "textNight": "阴",
                            "tempMax": "20",
                            "tempMin": "12",
                        }
                    ]
                },
            }
        },
    }


def _wechat_state(*, sent: bool) -> dict[str, Any]:
    messages = []
    if sent:
        messages.append({
            "id": "m-new",
            "senderId": "me",
            "type": "text",
            "content": "先看看",
        })
    return {
        "user": {"wxid": "me", "name": "我", "avatar": ""},
        "contacts": [{"wxid": "u-zhangsan", "name": "张三", "alias": ""}],
        "chats": [
            {
                "id": "u-zhangsan",
                "user": {"wxid": "u-zhangsan", "name": "张三"},
                "messages": messages,
            }
        ],
    }


def _realistic_trip_rail_state(*, searched: bool) -> dict[str, Any]:
    earliest = {
        "trainNo": "G7501",
        "trainType": "G",
        "fromStation": "杭州东",
        "toStation": "上海虹桥",
        "departTime": "06:00",
        "arriveTime": "07:10",
        "duration": "1小时10分",
        "seats": [{"type": "二等座", "count": 5}],
    }
    fastest = {
        "trainNo": "G7599",
        "trainType": "G",
        "fromStation": "杭州东",
        "toStation": "上海虹桥",
        "departTime": "07:30",
        "arriveTime": "08:05",
        "duration": "35分",
        "seats": [{"type": "二等座", "count": 5}],
    }
    return {
        "lastQuerySummary": (
            {"from": "杭州", "to": "上海", "date": REALISTIC_TRIP_DATE}
            if searched else {}
        ),
        "queryState": {"directTrains": [earliest, fastest] if searched else []},
    }


def _realistic_trip_weather_state() -> dict[str, Any]:
    return {
        "selectedCityId": "shanghai",
        "savedCities": [{"id": "shanghai", "name": "上海"}],
        "bundlesByCityId": {
            "shanghai": {
                "locationName": "上海",
                "bundle": {
                    "daily": [
                        {
                            "fxDate": REALISTIC_TRIP_DATE,
                            "textDay": "晴",
                            "textNight": "多云",
                            "tempMax": "18",
                            "tempMin": "10",
                        }
                    ]
                },
            }
        },
    }


def _realistic_trip_wechat_state(*, text: str = "") -> dict[str, Any]:
    return {
        "user": {"wxid": "me", "name": "我", "avatar": ""},
        "contacts": [{"wxid": "u-zhangsan", "name": "张三", "alias": ""}],
        "chats": [
            {
                "id": "u-zhangsan",
                "user": {"wxid": "u-zhangsan", "name": "张三"},
                "messages": [
                    {
                        "id": "wx-new",
                        "senderId": "me",
                        "type": "text",
                        "content": text,
                    }
                ] if text else [],
            }
        ],
    }


def _realistic_trip_notes_state(*, content: str = "") -> dict[str, Any]:
    return {
        "notes": [
            {
                "id": "note-new",
                "title": "上海出差备忘",
                "content": content,
                "updatedAt": 1,
            }
        ] if content else [],
        "todos": [],
        "folders": [],
        "settings": {},
    }


def _realistic_trip_apps_state(
    *,
    searched: bool,
    note_content: str = "",
    wechat_text: str = "",
) -> dict[str, Any]:
    return {
        "railway12306": _realistic_trip_rail_state(searched=searched),
        "weather": _realistic_trip_weather_state(),
        "notes": _realistic_trip_notes_state(content=note_content),
        "wechat": _realistic_trip_wechat_state(text=wechat_text),
    }


def _base_apps_state(*, rail_searched: bool, rainy: bool, wechat_sent: bool) -> dict[str, Any]:
    return {
        "railway12306": _rail_state(searched=rail_searched),
        "weather": _weather_state(rainy=rainy),
        "calendar": {"events": []},
        "clock": {"alarms": []},
        "notes": {"notes": [], "todos": [], "folders": [], "settings": {}},
        "wechat": _wechat_state(sent=wechat_sent),
    }


def _meeting_task_state(
    *,
    created: bool,
    note_text: str = "",
    wechat_text: str = "",
    sms_text: str = "",
) -> tuple[dict[str, Any], dict[str, Any]]:
    start_ms = Calendar.tomorrow_timestamp_ms_at_hh_mm(TEST_OS_STATE, "09:00")
    init_apps = {
        "tencent_meeting": {
            "scheduledMeetings": [],
            "ongoingMeetings": [],
            "history": [],
            "contacts": [],
            "messages": [],
            "settings": {},
            "personalRoom": {"meetingId": "111 222 333"},
            "user": {"id": "me", "name": "我"},
        },
        "notes": {"notes": [], "todos": [], "folders": [], "settings": {}},
        "wechat": {
            "user": {"wxid": "me", "name": "我", "avatar": ""},
            "contacts": [{"wxid": "u-chenjing", "name": "陈静", "alias": ""}],
            "chats": [
                {
                    "id": "u-chenjing",
                    "user": {"wxid": "u-chenjing", "name": "陈静"},
                    "messages": [],
                }
            ],
        },
        "sms": {},
    }
    init_os = {
        **TEST_OS_STATE,
        "providers": {
            "contacts": {
                "contacts": [
                    {"displayName": "张三", "phones": [{"number": "13800000000"}]},
                ],
            },
            "sms": {
                "conversations": [],
                "messagesByConversationId": {},
            },
        },
    }
    curr_apps = {
        name: value.copy() if isinstance(value, dict) else value
        for name, value in init_apps.items()
    }
    curr_apps["tencent_meeting"] = {
        **init_apps["tencent_meeting"],
        "scheduledMeetings": [],
        "currentScheduledMeeting": None,
    }
    if created:
        meeting = {
            "id": "scheduled-new",
            "meetingId": MEETING_ID_WITH_SPACES,
            "title": "版本发布会",
            "startTime": start_ms,
            "duration": 15,
            "settings": {"password": MEETING_PASSWORD},
        }
        curr_apps["tencent_meeting"]["scheduledMeetings"] = [meeting]
        curr_apps["tencent_meeting"]["currentScheduledMeeting"] = meeting
    curr_apps["notes"] = {
        "notes": [
            {
                "id": "note-new",
                "title": "版本发布会",
                "content": note_text,
                "updatedAt": start_ms,
            }
        ] if note_text else [],
        "todos": [],
        "folders": [],
        "settings": {},
    }
    curr_apps["wechat"] = {
        **init_apps["wechat"],
        "chats": [
            {
                "id": "u-chenjing",
                "user": {"wxid": "u-chenjing", "name": "陈静"},
                "messages": [
                    {
                        "id": "wx-new",
                        "senderId": "me",
                        "type": "text",
                        "content": wechat_text,
                    }
                ] if wechat_text else [],
            }
        ],
    }
    curr_os = {
        **init_os,
        "providers": {
            **init_os["providers"],
            "sms": {
                "conversations": [
                    {
                        "id": "conv-zhangsan",
                        "sender": "张三",
                        "messageCount": 1 if sms_text else 0,
                        "isUnread": False,
                    }
                ] if sms_text else [],
                "messagesByConversationId": {
                    "conv-zhangsan": [
                        {
                            "id": "sms-new",
                            "content": sms_text,
                            "timestamp": "2026-03-17 09:00",
                            "isOutgoing": True,
                        }
                    ]
                } if sms_text else {},
            },
        },
    }
    return {"apps": init_apps, "os": init_os}, {"apps": curr_apps, "os": curr_os}


def _launcher_state(
    *,
    wallpaper: str,
    has_dajuguan: bool,
    widget_id: str = DAJUGUAN_ID,
) -> dict[str, Any]:
    items: list[dict[str, Any]] = []
    if has_dajuguan:
        items.append(
            {
                "slot": {"cellX": 2, "cellY": 2},
                "kind": "widget",
                "widgetType": "wmr",
                "widgetId": widget_id,
                "variant": "widget_2x2",
                "previewUrl": f"/themes/{widget_id}/preview/widget_2x2.png",
            }
        )
    return {
        "wallpaper": {"kind": "gradient", "gradientId": wallpaper},
        "screens": [{"id": "screen_1", "items": items}],
    }


def test_realistic_trip_001_uses_earliest_high_speed_train_not_fastest():
    task = RealisticTrip001(contact="张三")
    init_state = {
        "apps": _realistic_trip_apps_state(searched=False),
        "os": TEST_OS_STATE,
    }
    curr_state = {
        "apps": _realistic_trip_apps_state(
            searched=True,
            note_content="G7501，上海晴转多云",
            wechat_text="G7501 到达时间 07:10，请安排接站",
        ),
        "os": TEST_OS_STATE,
    }

    result = task.evaluate(make_judge_input(init_state, curr_state))

    assert result.success is True


def test_realistic_trip_001_rejects_fastest_train_when_it_is_not_earliest():
    task = RealisticTrip001(contact="张三")
    init_state = {
        "apps": _realistic_trip_apps_state(searched=False),
        "os": TEST_OS_STATE,
    }
    curr_state = {
        "apps": _realistic_trip_apps_state(
            searched=True,
            note_content="G7599，上海晴转多云",
            wechat_text="G7599 到达时间 08:05，请安排接站",
        ),
        "os": TEST_OS_STATE,
    }

    result = task.evaluate(make_judge_input(init_state, curr_state))

    assert result.success is False
    failed_fields = {issue["field"] for issue in result.issues if issue["passed"] is False}
    assert {"memo_train", "wechat_arrive"} <= failed_fields


def test_realistic_harder_001_rain_branch_does_not_accept_wechat_message():
    task = WeekendShanghaiTripIfClearAndFree(contact="张三")
    init_state = {
        "apps": _base_apps_state(rail_searched=False, rainy=True, wechat_sent=False),
        "os": TEST_OS_STATE,
    }
    curr_state = {
        "apps": _base_apps_state(rail_searched=True, rainy=True, wechat_sent=True),
        "os": TEST_OS_STATE,
    }

    result = task.evaluate(make_judge_input(init_state, curr_state))

    assert result.success is False
    assert any(
        issue["field"] == "no_weekend_trip_message"
        and issue["passed"] is False
        for issue in result.issues
    )


def test_realistic_harder_001_allows_calendar_event_on_success_branch():
    task = WeekendShanghaiTripIfClearAndFree(contact="张三")

    assert "calendar.events" in task.expected_changes


def test_schedule_release_meeting_accepts_compact_shared_meeting_id():
    task = ScheduleReleaseMeetingAndNotifyViaNotesWechatSms()
    init_state, curr_state = _meeting_task_state(
        created=True,
        note_text=f"会议号：{MEETING_ID_COMPACT}\n密码：{MEETING_PASSWORD}",
        wechat_text=f"版本发布会会议号 {MEETING_ID_COMPACT}，密码 {MEETING_PASSWORD}",
        sms_text=f"会议号{MEETING_ID_COMPACT} 密码{MEETING_PASSWORD}",
    )

    result = task.evaluate(make_judge_input(init_state, curr_state))

    assert result.success is True


def test_schedule_release_meeting_rejects_missing_shared_password():
    task = ScheduleReleaseMeetingAndNotifyViaNotesWechatSms()
    init_state, curr_state = _meeting_task_state(
        created=True,
        note_text=f"会议号：{MEETING_ID_WITH_SPACES}",
        wechat_text=f"版本发布会会议号 {MEETING_ID_WITH_SPACES}",
        sms_text=f"会议号{MEETING_ID_WITH_SPACES}",
    )

    result = task.evaluate(make_judge_input(init_state, curr_state))

    assert result.success is False
    failed_fields = {issue["field"] for issue in result.issues if issue["passed"] is False}
    assert {"notes_meeting", "wechat_meeting", "sms_meeting"} <= failed_fields


def test_third_spotify_redbook_playlist_has_scoped_spotify_expected_changes():
    task = ThirdSpotifyPlayRecommendOnRedbookAndPlaylist()

    assert "apps.spotify" not in task.expected_changes
    for path in [
        "spotify.customPlaylists",
        "spotify.currentTrack",
        "spotify.isPlaying",
        "spotify.queue",
        "spotify.recentPlays",
        "spotify.playHistory",
    ]:
        assert path in task.expected_changes


def test_change_wallpaper_and_add_widget_does_not_require_app_store():
    task = ChangeWallpaperAndAddWidget()

    assert task.apps == []


def test_change_wallpaper_and_add_widget_positive():
    task = ChangeWallpaperAndAddWidget()
    init_state = {
        "apps": {},
        "os": {"launcher": _launcher_state(wallpaper="light_sky", has_dajuguan=False)},
    }
    curr_state = {
        "apps": {},
        "os": {"launcher": _launcher_state(wallpaper="ocean", has_dajuguan=True)},
    }

    result = task.evaluate(make_judge_input(init_state, curr_state))

    assert result.success is True


def test_change_wallpaper_and_add_widget_rejects_partial_wallpaper_only():
    task = ChangeWallpaperAndAddWidget()
    init_state = {
        "apps": {},
        "os": {"launcher": _launcher_state(wallpaper="light_sky", has_dajuguan=False)},
    }
    curr_state = {
        "apps": {},
        "os": {"launcher": _launcher_state(wallpaper="ocean", has_dajuguan=False)},
    }

    result = task.evaluate(make_judge_input(init_state, curr_state))

    assert result.success is False
    assert any(
        issue["field"] == "widget_added" and issue["passed"] is False
        for issue in result.issues
    )


def test_change_wallpaper_and_add_widget_rejects_wrong_wmr_widget():
    task = ChangeWallpaperAndAddWidget()
    init_state = {
        "apps": {},
        "os": {"launcher": _launcher_state(wallpaper="light_sky", has_dajuguan=False)},
    }
    curr_state = {
        "apps": {},
        "os": {
            "launcher": _launcher_state(
                wallpaper="ocean",
                has_dajuguan=True,
                widget_id=OTHER_WIDGET_ID,
            )
        },
    }

    result = task.evaluate(make_judge_input(init_state, curr_state))

    assert result.success is False
    assert any(
        issue["field"] == "widget_added"
        and issue["actual"] == [OTHER_WIDGET_ID]
        and issue["passed"] is False
        for issue in result.issues
    )
