"""
crossapp_content task correctness tests.
"""

from __future__ import annotations

import copy
import inspect
import json
from pathlib import Path
from typing import Any, Callable

import pytest

from bench_env.task.base import BaseTask
from bench_env.task.bilibili.app import Bilibili
from bench_env.task.crossapp_content import tasks as _tasks_module
from bench_env.task.ebay.app import expect_top
from bench_env.task.judge import JudgeInput
from bench_env.task.notes.app import Notes
from bench_env.task.redbook.app import Redbook
from bench_env.task.reddit.app import Reddit
from bench_env.task.sms.app import Sms
from bench_env.task.spotify.app import Spotify
from bench_env.task.wechat.app import Wechat
from bench_env.task.wechat_reading.app import WechatReading
from bench_env.task.x.app import X
from bench_env.tests.conftest import make_judge_input
from bench_env.tests.bilibili.test_tasks import BASE_STATE as BILIBILI_BASE_STATE, _sanlian_video
from bench_env.tests.notes.test_tasks import BASE_STATE as NOTES_BASE_STATE, _add_note
from bench_env.tests.redbook.test_tasks import (
    BASE_STATE as REDBOOK_BASE_STATE,
    _append_chat_message as _append_redbook_chat_message,
    _collect_note,
    _publish_note,
)
from bench_env.tests.sms.test_tasks import (
    BASE_APP_STATE as SMS_APP_STATE,
    BASE_STATE as SMS_PROVIDER_STATE,
    _append_outgoing_message as _append_sms_outgoing,
)
from bench_env.tests.spotify.test_tasks import BASE_STATE as SPOTIFY_BASE_STATE, _track
from bench_env.tests.wechat_reading.test_tasks import (
    BASE_STATE as WECHAT_READING_BASE_STATE,
    TEST_OS_STATE,
)

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_ROUTE = {"app": "launcher", "path": "/"}


def test_mobile_gym_env_maps_notes_display_name():
    from bench_env.env.mobile_gym import MobileGymEnv

    assert MobileGymEnv.APP_NAME_MAP["笔记"] == "notes"


def _load_json(*parts: str) -> dict[str, Any]:
    return json.loads(ROOT.joinpath(*parts).read_text(encoding="utf-8"))


WECHAT_BASE_STATE = _load_json("apps", "Wechat", "data", "defaults.json")
CONTACTS_PROVIDER_STATE = _load_json("os", "providers", "defaults", "contacts.json")
X_USERS = _load_json("apps", "X", "data", "users.json")
EBAY_BASE_STATE = _load_json("apps", "Ebay", "data", "defaults.json")
_REDDIT_DEFAULTS = _load_json("apps", "Reddit", "data", "defaults.json")
REDDIT_BASE_STATE = {
    "user": {
        **copy.deepcopy(_REDDIT_DEFAULTS["user"]),
        "postIds": copy.deepcopy(_REDDIT_DEFAULTS["user"].get("postIds", [])),
        "commentIds": copy.deepcopy(_REDDIT_DEFAULTS["user"].get("commentIds", [])),
        "savedPostIds": copy.deepcopy(_REDDIT_DEFAULTS["user"].get("savedPostIds", [])),
        "joinedCommunityIds": copy.deepcopy(_REDDIT_DEFAULTS["user"].get("joinedCommunityIds", [])),
        "postVotes": copy.deepcopy(_REDDIT_DEFAULTS["user"].get("postVotes", {})),
        "commentVotes": copy.deepcopy(_REDDIT_DEFAULTS["user"].get("commentVotes", {})),
    },
    "settings": copy.deepcopy(_REDDIT_DEFAULTS["settings"]),
    "posts": copy.deepcopy(_REDDIT_DEFAULTS.get("posts", {})),
    "comments": copy.deepcopy(_REDDIT_DEFAULTS.get("comments", {})),
    "chatThreads": copy.deepcopy(_REDDIT_DEFAULTS["chatThreads"]),
    "chatReplies": copy.deepcopy(_REDDIT_DEFAULTS["chatReplies"]),
}

ALL_TASK_CLASSES: list[type[BaseTask]] = [
    obj
    for _, obj in inspect.getmembers(_tasks_module, inspect.isclass)
    if issubclass(obj, BaseTask) and obj is not BaseTask and obj.__module__ == _tasks_module.__name__
]
ALL_TASK_IDS = [cls.__name__ for cls in ALL_TASK_CLASSES]


def _base_x_state() -> dict[str, Any]:
    return {
        "user": {
            "id": "u_me",
            "name": "小明",
            "handle": "@xiaoming",
            "screenName": "xiaoming",
            "avatar": "",
            "verified": False,
            "bio": "",
            "location": "",
            "website": "",
            "joinDate": "Fri Jan 01 00:00:00 +0000 2026",
            "following": 0,
            "followers": 0,
            "postIds": [],
            "replyIds": [],
            "followedUserIds": [],
            "followerUserIds": [],
            "likedPostIds": [],
            "retweetedPostIds": [],
            "bookmarkedPostIds": [],
        },
        "posts": {},
        "conversations": [],
        "trends": [],
        "notifications": [],
        "searchHistory": [],
        "settings": {},
        "suggestedFollowingIds": [],
    }


def _base_apps() -> dict[str, Any]:
    redbook = copy.deepcopy(REDBOOK_BASE_STATE)
    return {
        "spotify": copy.deepcopy(SPOTIFY_BASE_STATE),
        "bilibili": copy.deepcopy(BILIBILI_BASE_STATE),
        "ebay": copy.deepcopy(EBAY_BASE_STATE),
        "redbook": redbook,
        "wechat_reading": copy.deepcopy(WECHAT_READING_BASE_STATE),
        "wechat": copy.deepcopy(WECHAT_BASE_STATE),
        "notes": copy.deepcopy(NOTES_BASE_STATE),
        "sms": copy.deepcopy(SMS_APP_STATE),
        "x": _base_x_state(),
        "reddit": copy.deepcopy(REDDIT_BASE_STATE),
        "file_manager": {"clipboardItems": [], "clipboardOperation": None},
        "gallery": {},
    }


def _apps_state(**patches: dict[str, Any]) -> dict[str, Any]:
    apps = _base_apps()
    for key, value in patches.items():
        apps[key] = copy.deepcopy(value)
    return apps


def _base_os() -> dict[str, Any]:
    return {
        "time": copy.deepcopy(TEST_OS_STATE["time"]),
        "providers": {
            "contacts": copy.deepcopy(CONTACTS_PROVIDER_STATE),
            "sms": copy.deepcopy(SMS_PROVIDER_STATE),
        },
        "fileSystem": {
            "nodes": [
                {"id": "root", "name": "/", "type": "directory", "parentId": None, "path": "/", "size": 0, "createdAt": 0, "modifiedAt": 0, "storage": "memory"},
                {"id": "dir_sdcard", "name": "sdcard", "type": "directory", "parentId": "root", "path": "/sdcard", "size": 0, "createdAt": 0, "modifiedAt": 0, "storage": "memory"},
                {"id": "dir_download", "name": "Download", "type": "directory", "parentId": "dir_sdcard", "path": "/sdcard/Download", "size": 0, "createdAt": 0, "modifiedAt": 0, "storage": "memory"},
                {"id": "dir_pictures", "name": "Pictures", "type": "directory", "parentId": "dir_sdcard", "path": "/sdcard/Pictures", "size": 0, "createdAt": 0, "modifiedAt": 0, "storage": "memory"},
                {"id": "file_download", "name": "downloaded_image.jpg", "type": "file", "parentId": "dir_download", "path": "/sdcard/Download/downloaded_image.jpg", "size": 1024, "mimeType": "image/jpeg", "createdAt": 0, "modifiedAt": 0, "storage": "indexeddb"},
                {"id": "file_picture", "name": "downloaded_image_copy.jpg", "type": "file", "parentId": "dir_pictures", "path": "/sdcard/Pictures/downloaded_image_copy.jpg", "size": 1024, "mimeType": "image/jpeg", "createdAt": 0, "modifiedAt": 0, "storage": "indexeddb"},
            ]
        },
    }


def _make_input(
    init_apps: dict[str, Any],
    curr_apps: dict[str, Any],
    *,
    init_os: dict[str, Any] | None = None,
    curr_os: dict[str, Any] | None = None,
    route: dict[str, Any] | None = None,
    answer: str | None = None,
) -> JudgeInput:
    return make_judge_input(
        {"apps": init_apps, "os": init_os or _base_os()},
        {"apps": curr_apps, "os": curr_os or _base_os()},
        route=route or DEFAULT_ROUTE,
        answer=answer,
    )


def _ensure_wechat_chat(state: dict[str, Any], contact_name: str) -> dict[str, Any]:
    wechat = Wechat(state)
    wxid = wechat.require_contact_wxid(contact_name)
    chat = next((item for item in state["chats"] if str(item["id"]) == wxid), None)
    if chat is not None:
        return chat
    contact = wechat.contact_by_name(contact_name)
    chat = {
        "id": wxid,
        "user": {
            "wxid": wxid,
            "name": contact["name"],
            "avatar": contact.get("avatar", ""),
        },
        "isMuted": False,
        "isSticky": False,
        "isAlert": False,
        "messages": [],
    }
    state["chats"].insert(0, chat)
    return chat


def _append_wechat_outgoing(state: dict[str, Any], contact_name: str, content: str) -> None:
    chat = _ensure_wechat_chat(state, contact_name)
    chat["messages"].append(
        {
            "id": f"wx_out_{len(chat['messages']) + 1}",
            "type": "text",
            "content": content,
            "senderId": state["user"]["wxid"],
            "timestamp": TEST_OS_STATE["time"]["timestamp"],
        }
    )


def _append_wechat_moment(state: dict[str, Any], content: str, *, images: list[str] | None = None) -> None:
    state["moments"].insert(
        0,
        {
            "id": f"mo_test_{len(state['moments']) + 1}",
            "wxid": state["user"]["wxid"],
            "userName": state["user"]["name"],
            "userAvatar": state["user"]["avatar"],
            "content": content,
            "timestamp": TEST_OS_STATE["time"]["timestamp"],
            "images": list(images or []),
        },
    )


def _append_x_post(state: dict[str, Any], content: str, *, thread_id: str | None = None) -> None:
    state.setdefault("posts", {})
    post_id = f"x_post_{len(state['posts']) + 1}"
    state["posts"][post_id] = {
        "id": post_id,
        "authorId": state["user"]["id"],
        "content": content,
        "threadId": thread_id,
        "timestamp": TEST_OS_STATE["time"]["timestamp"],
    }
    if thread_id:
        state["user"]["replyIds"] = [post_id, *state["user"].get("replyIds", [])]
    else:
        state["user"]["postIds"] = [post_id, *state["user"].get("postIds", [])]


def _append_reddit_comment(
    state: dict[str, Any],
    *,
    post_id: str,
    body: str,
) -> None:
    state.setdefault("comments", {})
    comment_id = f"reddit_comment_{post_id}_{len(state['comments']) + 1}"
    state["comments"][comment_id] = {
        "id": comment_id,
        "postId": post_id,
        "author": state.get("user", {}).get("username", "me"),
        "body": body,
        "score": 1,
    }
    state.setdefault("user", {}).setdefault("commentIds", []).append(comment_id)


def _append_reddit_post(
    state: dict[str, Any],
    *,
    post_id: str,
    subreddit: str,
    title: str,
) -> None:
    state.setdefault("posts", {})
    state["posts"][post_id] = {
        "id": post_id,
        "subreddit": subreddit,
        "title": title,
        "content": title,
        "author": state.get("user", {}).get("username", "me"),
        "timeAgo": "now",
        "upvotes": "1",
        "comments": "0",
        "isAd": False,
    }
    state.setdefault("user", {}).setdefault("postIds", []).append(post_id)


def _set_ebay_search(
    state: dict[str, Any],
    *,
    query: str,
    conditions: list[str] | None = None,
    sort_option: str | None = None,
) -> None:
    snapshot = {
        "query": query,
        "categoryId": "",
        "brand": "",
        "buyingFormat": "",
        "conditions": list(conditions or []),
        "location": "",
        "freeShippingOnly": False,
        "priceMin": "",
        "priceMax": "",
        "sortOption": sort_option or "",
        "resultsCount": 20,
    }
    state["search"]["current"] = snapshot
    state["search"]["history"].append(copy.deepcopy(snapshot))
    state["recentSearches"] = [query, *[item for item in state["recentSearches"] if item != query]]


def _build_spotify_now_playing_to_wechat():
    task = _tasks_module.SpotifyNowPlayingToWechat(contact="陈静")
    init_apps = _apps_state()
    curr_apps = _apps_state()
    curr_apps["spotify"]["currentTrack"] = _track("搁浅")
    curr_apps["spotify"]["likedSongs"] = [
        _track("修炼爱情"),
        _track("搁浅"),
    ]
    _append_wechat_outgoing(curr_apps["wechat"], "陈静", "我现在在听搁浅")
    return task, _make_input(init_apps, curr_apps)


def _build_bilibili_ranking_to_wechat():
    task = _tasks_module.BilibiliRankingToWechat(partition="音乐", rank=1, contact="陈静")
    init_apps = _apps_state()
    curr_apps = _apps_state()
    title = Bilibili.ranking_entry("音乐", 1)["title"]
    _append_wechat_outgoing(curr_apps["wechat"], "陈静", f"B站榜一是：{title}")
    return task, _make_input(init_apps, curr_apps)


def _build_redbook_search_title_to_wechat():
    task = _tasks_module.RedbookSearchTitleToWechat(keyword="数分", contact="陈静")
    init_apps = _apps_state()
    curr_apps = _apps_state()
    title = Redbook(curr_apps["redbook"]).first_search_note("数分")["title"]
    _append_wechat_outgoing(curr_apps["wechat"], "陈静", title)
    return task, _make_input(init_apps, curr_apps)
def _build_spotify_today_nth_play_to_redbook():
    task = _tasks_module.SpotifyTodayNthPlayToRedbook(nth=2)
    init_apps = _apps_state()
    curr_apps = _apps_state()
    # 今天第 2 首（从早到晚） = recentPlays 倒数第 2 个
    target = curr_apps["spotify"]["recentPlays"][-2]
    _publish_note(curr_apps["redbook"], target["title"], f"{target['artist']} 的歌")
    return task, _make_input(init_apps, curr_apps)
def _build_wechat_reading_best_book_to_wechat():
    task = _tasks_module.WechatReadingBestBookToWechat(category="商业", contact="陈静")
    init_apps = _apps_state()
    curr_apps = _apps_state()
    _append_wechat_outgoing(curr_apps["wechat"], "陈静", "推荐《纳瓦尔宝典》，推荐值 92.5")
    return task, _make_input(init_apps, curr_apps)
def _build_wechat_reading_stats_to_wechat():
    task = _tasks_module.WechatReadingStatsToWechat(contact="陈静")
    init_apps = _apps_state()
    curr_apps = _apps_state()
    _append_wechat_outgoing(curr_apps["wechat"], "陈静", "1月22日读了226分钟")
    return task, _make_input(init_apps, curr_apps)


def _build_redbook_author_followers_to_wechat():
    task = _tasks_module.RedbookAuthorFollowersToWechat(keyword="数分", contact="陈静")
    init_apps = _apps_state()
    curr_apps = _apps_state()
    rb = Redbook(curr_apps["redbook"])
    author = rb.note_author(rb.first_search_note("数分"))
    curr_apps["redbook"]["user"]["followingIds"] = [
        *curr_apps["redbook"]["user"].get("followingIds", []),
        author["id"],
    ]
    _append_wechat_outgoing(curr_apps["wechat"], "陈静", f"{author['name']}有{author['followers']}粉丝，我刚关注了TA")
    return task, _make_input(init_apps, curr_apps)


def _build_x_latest_post_to_reddit_with_title_format():
    task = _tasks_module.XLatestPostToReddit_WithTitleFormat(user="elonmusk", subreddit="technology")
    init_apps = _apps_state()
    curr_apps = _apps_state()
    tweet_content = next(
        str(post.get("content") or "").strip()
        for post in X(init_apps["x"]).view_posts()
        if str(post.get("authorId") or "").lower().removeprefix("u_") == "elonmusk"
    )
    _append_reddit_post(
        init_apps["reddit"],
        post_id="reddit_post_1",
        subreddit="technology",
        title="AI companies race to orbit",
    )
    curr_apps["reddit"] = copy.deepcopy(init_apps["reddit"])
    reddit = Reddit(curr_apps["reddit"])
    target_post = next(
        post
        for post in reddit.view_posts_list()
        if str(post.get("subreddit") or "").strip().removeprefix("r/").lower() == "technology"
    )
    _append_reddit_comment(
        curr_apps["reddit"],
        post_id=str(target_post["id"]),
        body=f"elonmusk:{tweet_content}",
    )
    return task, _make_input(init_apps, curr_apps)
def _build_file_manager_send_file_to_wechat_contact():
    task = _tasks_module.FileManagerSendFileToWechatContact(contact="陈静")
    init_apps = _apps_state()
    curr_apps = _apps_state()
    _append_wechat_outgoing(curr_apps["wechat"], "陈静", "第一个副本文件名是 downloaded_image.jpg")
    _append_wechat_outgoing(curr_apps["wechat"], "陈静", "第二个副本文件名是 downloaded_image_copy.jpg")
    return task, _make_input(init_apps, curr_apps)


def _build_redbook_following_note_count_to_sms():
    task = _tasks_module.RedbookFollowingNoteCountToSms(username="西柚慢行", contact="中国联通")
    init_apps = _apps_state()
    curr_apps = _apps_state()
    count = Redbook(curr_apps["redbook"]).followed_user_note_count("西柚慢行")
    curr_os = _base_os()
    _append_sms_outgoing(curr_os["providers"]["sms"], "中国联通", f"西柚慢行发了{count}篇笔记")
    return task, _make_input(init_apps, curr_apps, curr_os=curr_os)
def _build_spotify_song_full_details_to_redbook():
    task = _tasks_module.SpotifySongFullDetailsToRedbook(song="搁浅")
    init_apps = _apps_state()
    curr_apps = _apps_state()
    _publish_note(curr_apps["redbook"], "搁浅", "周杰伦 演唱，时长 3:58")
    return task, _make_input(init_apps, curr_apps)
def _build_bilibili_triple_like_then_moments():
    task = _tasks_module.BilibiliTripleLikeThenMoments(partition="音乐", rank=1)
    init_apps = _apps_state()
    curr_apps = _apps_state()
    title = Bilibili.ranking_entry("音乐", 1)["title"]
    _sanlian_video(curr_apps["bilibili"], title)
    _append_wechat_moment(curr_apps["wechat"], f"推荐一个视频：{title}")
    return task, _make_input(init_apps, curr_apps)


def _build_bilibili_triple_like_then_moments_duplicate_title():
    task = _tasks_module.BilibiliTripleLikeThenMoments(partition="电影", rank=7)
    init_apps = _apps_state()
    curr_apps = _apps_state()
    entry = Bilibili.ranking_entry("电影", 7)
    video_id = str(entry["id"])
    title = str(entry["title"])
    bili_user = curr_apps["bilibili"]["user"]
    if video_id not in bili_user["likedVideoIds"]:
        bili_user["likedVideoIds"].append(video_id)
    coined = bili_user.setdefault("coinedVideoCoins", {})
    coined[video_id] = max(int(coined.get(video_id, 0)), 1)
    for folder in bili_user["favoritesFolders"]:
        if folder["id"] == "fav_default" and video_id not in folder["videoIds"]:
            folder["videoIds"].append(video_id)
    curr_apps["bilibili"]["activeVideoId"] = video_id
    _append_wechat_moment(curr_apps["wechat"], f"推荐一个视频：{title}")
    return task, _make_input(init_apps, curr_apps)
def _build_redbook_dm_then_wechat_report():
    task = _tasks_module.RedbookDmThenWechatReport(
        username="西柚慢行",
        message="你好呀",
        contact="陈静",
    )
    init_apps = _apps_state()
    curr_apps = _apps_state()
    user = Redbook(curr_apps["redbook"]).require_user_by_name("西柚慢行")
    _append_redbook_chat_message(curr_apps["redbook"], user["id"], "你好呀")
    _append_wechat_outgoing(curr_apps["wechat"], "陈静", "已经联系西柚慢行了")
    return task, _make_input(init_apps, curr_apps)
def _build_notes_content_to_redbook_and_x():
    task = _tasks_module.NotesContentToRedbookAndX(topic="AI代理")
    init_apps = _apps_state()
    curr_apps = _apps_state()
    content = "AI代理需要更强的任务判定和更清晰的执行边界。"
    _add_note(curr_apps["notes"], "AI代理想法", content=content)
    _publish_note(curr_apps["redbook"], "AI代理想法", content)
    _append_x_post(curr_apps["x"], content)
    return task, _make_input(init_apps, curr_apps)


def _build_cultural_checklist_to_redbook():
    task = _tasks_module.CulturalChecklistToRedbook()
    init_apps = _apps_state()
    curr_apps = _apps_state()
    song = curr_apps["spotify"]["recentPlays"][-1]["title"]
    book = curr_apps["wechat_reading"]["hotSearch"][0]["title"]
    _add_note(curr_apps["notes"], "今日文化清单", content=f"{song}\n{book}")
    _publish_note(curr_apps["redbook"], "今日文化清单", f"{song}\n{book}")
    return task, _make_input(init_apps, curr_apps)
def _build_daily_log_to_moments():
    task = _tasks_module.DailyLogToMoments()
    init_apps = _apps_state()
    curr_apps = _apps_state()
    _add_note(init_apps["notes"], "买咖啡", content="下午提神")
    _add_note(init_apps["notes"], "写周报", content="整理本周进度")
    curr_apps["notes"] = copy.deepcopy(init_apps["notes"])
    _append_wechat_moment(curr_apps["wechat"], "今天主要做了两件事：买咖啡、写周报。")
    return task, _make_input(init_apps, curr_apps)


def _build_ebay_cheap_to_redbook():
    task = _tasks_module.EbayCheapToRedbook(product="电风扇")
    init_apps = _apps_state()
    curr_apps = _apps_state()
    _set_ebay_search(curr_apps["ebay"], query=task.p.product, sort_option="priceLow")
    top = expect_top(query=task.p.product, sort_id="priceLow", n=1)[0]
    _publish_note(curr_apps["redbook"], top.title, f"商品推荐：{top.title}，这款最便宜，值得入手。")
    return task, _make_input(init_apps, curr_apps)


POSITIVE_CASES: list[tuple[str, Callable[[], tuple[BaseTask, JudgeInput]]]] = [
    ("SpotifyNowPlayingToWechat", _build_spotify_now_playing_to_wechat),
    ("BilibiliRankingToWechat", _build_bilibili_ranking_to_wechat),
    ("RedbookSearchTitleToWechat", _build_redbook_search_title_to_wechat),
    ("SpotifyTodayNthPlayToRedbook", _build_spotify_today_nth_play_to_redbook),
    ("WechatReadingBestBookToWechat", _build_wechat_reading_best_book_to_wechat),
    ("WechatReadingStatsToWechat", _build_wechat_reading_stats_to_wechat),
    ("RedbookAuthorFollowersToWechat", _build_redbook_author_followers_to_wechat),
    ("XLatestPostToReddit_WithTitleFormat", _build_x_latest_post_to_reddit_with_title_format),
    ("FileManagerSendFileToWechatContact", _build_file_manager_send_file_to_wechat_contact),
    ("RedbookFollowingNoteCountToSms", _build_redbook_following_note_count_to_sms),
    ("SpotifySongFullDetailsToRedbook", _build_spotify_song_full_details_to_redbook),
    ("BilibiliTripleLikeThenMoments", _build_bilibili_triple_like_then_moments),
    ("RedbookDmThenWechatReport", _build_redbook_dm_then_wechat_report),
    ("NotesContentToRedbookAndX", _build_notes_content_to_redbook_and_x),
    ("CulturalChecklistToRedbook", _build_cultural_checklist_to_redbook),
    ("DailyLogToMoments", _build_daily_log_to_moments),
    ("EbayCheapToRedbook", _build_ebay_cheap_to_redbook),
]


class TestTaskDefinitions:
    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_instantiation(self, cls):
        task = cls()
        assert task.name == cls.__name__
        assert task.templates
        assert len(task.apps) >= 2

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_description_renders(self, cls):
        task = cls()
        task._env_state = {"os": _base_os()}
        assert "{" not in task.description

    @pytest.mark.parametrize("cls", ALL_TASK_CLASSES, ids=ALL_TASK_IDS)
    def test_parameter_defaults_present(self, cls):
        for key, schema in cls.parameters.items():
            if key.startswith("_"):
                continue
            assert "default" in schema


class TestCrossappContentOfflineJudge:
    @pytest.mark.parametrize("task_id,builder", POSITIVE_CASES, ids=[case[0] for case in POSITIVE_CASES])
    def test_positive_cases(self, task_id: str, builder: Callable[[], tuple[BaseTask, JudgeInput]]):
        task, judge_input = builder()
        checks = task.check_goals(judge_input)
        assert checks, task_id
        assert all(check["passed"] for check in checks), (task_id, checks)

    def test_redbook_search_title_to_wechat_allows_search_history_side_effect(self):
        task = _tasks_module.RedbookSearchTitleToWechat(keyword="美食", contact="陈静")
        init_apps = _apps_state()
        curr_apps = _apps_state()
        title = Redbook(curr_apps["redbook"]).first_search_note("美食")["title"]
        history = curr_apps["redbook"].setdefault("searchHistory", [])
        curr_apps["redbook"]["searchHistory"] = ["美食", *[item for item in history if item != "美食"]]
        _append_wechat_outgoing(curr_apps["wechat"], "陈静", title)

        result = task.evaluate(_make_input(init_apps, curr_apps))

        assert result.success
        assert result.clean, result.warnings

    def test_spotify_today_nth_play_to_redbook_song_title_in_content_passes(self):
        """歌名出现在正文（非标题）时也应通过——任务模板说"标题或正文"。"""
        task = _tasks_module.SpotifyTodayNthPlayToRedbook(nth=3)
        init_apps = _apps_state()
        curr_apps = _apps_state()
        # 今天第 3 首（从早到晚） = recentPlays 倒数第 3 个
        target = curr_apps["spotify"]["recentPlays"][-3]
        # 标题写通用语，歌名和艺人都写在正文
        _publish_note(curr_apps["redbook"], "推荐一首歌", f"{target['title']} {target['artist']} 强烈推荐")
        checks = task.check_goals(_make_input(init_apps, curr_apps))
        assert all(check["passed"] for check in checks), checks

    def test_spotify_today_nth_play_to_redbook_wrong_song_fails(self):
        """发了其他位置的歌（不是第 N 首）应判定失败。"""
        task = _tasks_module.SpotifyTodayNthPlayToRedbook(nth=1)
        init_apps = _apps_state()
        curr_apps = _apps_state()
        # 任务要第 1 首（recentPlays[-1]），但 agent 发的是 recentPlays[0]（最新的）
        wrong = curr_apps["spotify"]["recentPlays"][0]
        _publish_note(curr_apps["redbook"], wrong["title"], f"{wrong['artist']} 强烈推荐")
        checks = task.check_goals(_make_input(init_apps, curr_apps))
        assert any(not check["passed"] for check in checks), checks
    def test_spotify_now_playing_to_wechat_requires_liked_song(self):
        task = _tasks_module.SpotifyNowPlayingToWechat(contact="陈静")
        init_apps = _apps_state()
        curr_apps = _apps_state()
        curr_apps["spotify"]["currentTrack"] = _track("搁浅")
        _append_wechat_outgoing(curr_apps["wechat"], "陈静", "我现在在听搁浅")
        checks = task.check_goals(_make_input(init_apps, curr_apps))
        assert any(
            check["field"] == "spotify_liked" and check["passed"] is False
            for check in checks
        ), checks

    def test_redbook_author_followers_to_wechat_requires_following_author(self):
        task = _tasks_module.RedbookAuthorFollowersToWechat(keyword="数分", contact="陈静")
        init_apps = _apps_state()
        curr_apps = _apps_state()
        rb = Redbook(curr_apps["redbook"])
        author = rb.note_author(rb.first_search_note("数分"))
        curr_apps["redbook"]["user"]["followingIds"] = [
            item
            for item in curr_apps["redbook"]["user"].get("followingIds", [])
            if item != author["id"]
        ]
        _append_wechat_outgoing(curr_apps["wechat"], "陈静", f"{author['name']}有{author['followers']}粉丝")
        checks = task.check_goals(_make_input(init_apps, curr_apps))
        assert any(
            check["field"] == "redbook_following" and check["passed"] is False
            for check in checks
        ), checks

    def test_bilibili_triple_like_then_moments_uses_ranking_entry_id_for_duplicate_titles(self):
        task, judge_input = _build_bilibili_triple_like_then_moments_duplicate_title()
        checks = task.check_goals(judge_input)
        assert all(check["passed"] for check in checks), checks

    def test_bilibili_triple_like_then_moments_allows_normalized_moment_title(self):
        task = _tasks_module.BilibiliTripleLikeThenMoments(partition="全站", rank=1)
        init_apps = _apps_state()
        curr_apps = _apps_state()
        title = str(Bilibili.ranking_entry("全站", 1)["title"])
        _sanlian_video(curr_apps["bilibili"], title)
        _append_wechat_moment(curr_apps["wechat"], f"推荐一个视频：{title.replace(' AI ', 'AI')}")

        checks = task.check_goals(_make_input(init_apps, curr_apps))

        assert all(check["passed"] for check in checks), checks

    def test_file_manager_send_file_to_wechat_contact_requires_two_distinct_names(self):
        task = _tasks_module.FileManagerSendFileToWechatContact(contact="陈静")
        init_apps = _apps_state()
        curr_apps = _apps_state()
        _append_wechat_outgoing(curr_apps["wechat"], "陈静", "downloaded_image.jpg")
        _append_wechat_outgoing(curr_apps["wechat"], "陈静", "downloaded_image.jpg")
        checks = task.check_goals(_make_input(init_apps, curr_apps))
        assert any(
            check["field"] == "wechat_file_names" and check["passed"] is False
            for check in checks
        ), checks
