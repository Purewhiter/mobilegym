"""Live scripted-plan verification for the cross-app content suite."""

from __future__ import annotations

import copy
import datetime as dt
import json
import re
from pathlib import Path
from typing import Any, Callable

import pytest

from bench_env.env.mobile_gym import MobileGymEnv
from bench_env.task.base import BaseTask
from bench_env.task.bilibili.app import Bilibili, format_compact_stat
from bench_env.task.crossapp_content import tasks as content_tasks
from bench_env.task.ebay.app import expect_top
from bench_env.task.notes.app import Notes
from bench_env.task.registry import TaskRegistry
from bench_env.task.redbook.app import Redbook
from bench_env.task.spotify.app import Spotify
from bench_env.task.wechat.app import Wechat
from bench_env.task.wechat_reading.app import WECHAT_READING_UI_TO_DATA, WechatReading
from bench_env.task.x.app import X
from bench_env.tests.scripted_support import (
    format_episode_result,
    run_scripted,
    suite_task_class_names,
)

SUITE = "crossapp_content"
ROOT = Path(__file__).resolve().parents[3]
CONTACT = "张伟"
CONTACT_WXID = "wxid_zhangwei_888"
SIM_ANCHOR = dt.datetime.now().replace(microsecond=0)
SIM_OS = {"time": {"timestamp": int(SIM_ANCHOR.timestamp() * 1000)}}

SCRIPTED_MAX_STEPS = {
    "BilibiliRankTop3FolderAndWechat": 80,
    "FavoriteWaterSceneryPhotos": 75,
}

_RELATIVE_RE = re.compile(r"(\d+)(w|d|h|m|s)")
_UNITS = {
    "w": dt.timedelta(days=7),
    "d": dt.timedelta(days=1),
    "h": dt.timedelta(hours=1),
    "m": dt.timedelta(minutes=1),
    "s": dt.timedelta(seconds=1),
}


def _load_json(*parts: str) -> dict[str, Any]:
    return json.loads(ROOT.joinpath(*parts).read_text(encoding="utf-8"))


def _contact_params(contact: str = CONTACT) -> dict[str, str]:
    wxid = Wechat(_load_json("apps", "Wechat", "data", "defaults.json")).require_contact_wxid(contact)
    return {"contact": contact, "contact_wxid": wxid}


def _fmt(value: float) -> str:
    return f"{float(value):.2f}"


def _spotify_state() -> dict[str, Any]:
    state = copy.deepcopy(_load_json("apps", "Spotify", "data", "defaults.json"))
    user = copy.deepcopy(state["user"])
    state.update(
        {
            "currentUser": user,
            "accounts": [user],
            "currentTrack": copy.deepcopy(
                state["recentPlays"][0] if state.get("recentPlays") else state["recommendedTracks"][0]
            ),
            "isPlaying": False,
            "shuffle": False,
            "repeat": "off",
            "queue": copy.deepcopy(state["recommendedTracks"]),
            "likedSongs": [],
            "followedArtists": copy.deepcopy(state.get("followedArtists", [])),
            "customPlaylists": [],
        }
    )
    return state


def _spotify() -> Spotify:
    return Spotify(_spotify_state())


def _spotify_default() -> Spotify:
    return Spotify(_load_json("apps", "Spotify", "data", "defaults.json"))


def _redbook() -> Redbook:
    return Redbook(_load_json("apps", "RedBook", "data", "defaults.json"))


def _parse_relative(value: Any) -> dt.datetime:
    if isinstance(value, (int, float)):
        return dt.datetime.fromtimestamp(float(value) / 1000.0)
    text = str(value).strip()
    if re.fullmatch(r"[+-]?(\d+[wdhms])+", text):
        delta = dt.timedelta()
        for amount, unit in _RELATIVE_RE.findall(text):
            delta += int(amount) * _UNITS[unit]
        return SIM_ANCHOR - delta if text.startswith("-") else SIM_ANCHOR + delta
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return dt.datetime.fromisoformat(f"{text}T00:00:00")
    return dt.datetime.fromisoformat(text)


def _to_iso(value: Any) -> str:
    return _parse_relative(value).strftime("%Y-%m-%dT%H:%M:%S")


def _to_date(value: Any) -> str:
    return _parse_relative(value).date().isoformat()


def _wechat_reading_state() -> dict[str, Any]:
    raw = copy.deepcopy(_load_json("apps", "WechatReading", "data", "defaults.json"))
    raw["shelf"] = [{**item, "addedAt": _to_iso(item["addedAt"])} for item in raw.get("shelf", [])]
    raw["readingRecords"] = [
        {**record, "date": _to_date(record["timestamp"]), "timestamp": _to_iso(record["timestamp"])}
        for record in raw.get("readingRecords", [])
    ]
    raw["bookProgress"] = {
        key: {**progress, "lastReadAt": _to_iso(progress["lastReadAt"])}
        for key, progress in raw.get("bookProgress", {}).items()
    }

    store_by_id = {str(book["id"]): book for book in raw.get("store", [])}
    shelf_by_book = {str(item["bookId"]): item for item in raw.get("shelf", [])}
    progress_ids = [str(book_id) for book_id in raw.get("bookProgress", {}).keys()]

    def is_finished(book_id: str) -> bool:
        book = store_by_id.get(book_id)
        progress = raw["bookProgress"].get(book_id)
        return bool(book and progress and int(progress["charOffset"]) >= int(book["totalWords"]))

    raw["allProgressBookIds"] = progress_ids
    raw["finishedBookIds"] = [book_id for book_id in progress_ids if is_finished(book_id)]
    raw["readingBookIds"] = [book_id for book_id in progress_ids if not is_finished(book_id)]
    raw["homeFinishedBookIds"] = [
        book_id
        for book_id in raw["finishedBookIds"]
        if not (shelf_by_book.get(book_id) and shelf_by_book[book_id].get("isPrivate") is True)
    ]
    return raw


def _wechat_reading() -> WechatReading:
    return WechatReading(_wechat_reading_state())


def _notes_state() -> dict[str, Any]:
    defaults = _load_json("system", "Notes", "data", "defaults.json")

    def parse_ts(value: Any) -> int:
        if isinstance(value, (int, float)):
            return int(value)
        return int(dt.datetime.fromisoformat(str(value)).timestamp() * 1000)

    return {
        "notes": [{**note, "updatedAt": parse_ts(note["updatedAt"])} for note in defaults["sampleNotes"]],
        "todos": [{**todo, "updatedAt": parse_ts(todo["updatedAt"])} for todo in defaults["sampleTodos"]],
        "folders": [
            {"id": "all", "name": "全部", "system": True},
            {"id": "call", "name": "通话笔记", "system": True},
            {"id": "unfiled", "name": "未分类", "system": True},
        ],
        "selectedFolderId": "all",
        "settings": copy.deepcopy(defaults["settings"]),
    }


def _bili_share_params(partition: str = "全站", rank: int = 1) -> dict[str, Any]:
    entry = Bilibili.ranking_entry(partition, rank)
    return {"partition": partition, "rank": rank, "bvid": str(entry["id"]), "title": str(entry["title"])}


def _redbook_first(keyword: str) -> tuple[dict[str, Any], dict[str, Any]]:
    rb = _redbook()
    note = rb.first_search_note(keyword)
    return note, rb.note_author(note)


def _best_book_message(category: str) -> str:
    wr = _wechat_reading()
    data_cats = WECHAT_READING_UI_TO_DATA.get(category, [category])
    books = [b for b in wr.store if str(b.get("category")) in data_cats]
    books.sort(key=lambda b: float(b.get("rating") or 0), reverse=True)
    book = books[0]
    return f"{book['title']} 推荐值 {book.get('recommendedValue', '')}"


def _reading_stats_message() -> str:
    date_value, minutes = _wechat_reading().best_reading_day_and_duration(SIM_OS)
    return f"{date_value} 读了 {minutes} 分钟"


def _book_list_message(n: int) -> str:
    wr = _wechat_reading()
    titles = [str(wr.require_store_book(str(item["bookId"]))["title"]) for item in wr.shelf[:n]]
    return "\n".join(titles)


def _reading_plan_note() -> str:
    titles = _wechat_reading().reading_book_titles()
    return "本周阅读计划\n" + "\n".join(f"- {title}" for title in titles)


def _latest_notes_moment() -> str:
    latest = Notes(_notes_state()).latest_n_notes(2)
    titles = [str(note.get("title") or note.get("content") or "").strip() for note in latest]
    return f"今天简单总结：{titles[0]}、{titles[1]}"


def _x_latest_post(user: str) -> str:
    user_lower = user.lower().lstrip("@")
    for post in X({}).view_posts():
        aid = str(post.get("authorId") or "").lower()
        if aid.removeprefix("u_") == user_lower or user_lower in aid:
            return str(post.get("content") or "").strip()
    raise AssertionError(f"Missing X post for {user}")


def _cheap_product_note(product: str) -> str:
    top = expect_top(query=product, sort_id="priceLow", n=1)[0]
    return f"{top.title}\n总价 {_fmt(top.total_cost)}"


def _task(name: str, **params: Any) -> BaseTask:
    return TaskRegistry().create_task(f"{SUITE}.{name}", **params)


def _bili_author_last_nov_params() -> dict[str, Any]:
    category = "舞蹈"
    rank = 10
    author_name = Bilibili.ranking_author_name(category, rank)
    followers = Bilibili.author_follower_count(author_name)
    last_year = SIM_ANCHOR.year - 1
    last_nov = Bilibili.author_videos_in_year_month(author_name, last_year, 11)
    top_video = Bilibili.author_top_played_video_in_year_month(author_name, last_year, 11)
    return {
        "category": category,
        "partition": category,
        "rank": rank,
        "bvid": str(Bilibili.ranking_entry(category, rank)["id"]),
        **_contact_params(),
        "wechat_message": (
            f"{author_name} 粉丝 {format_compact_stat(followers)}，"
            f"去年11月发过 {len(last_nov)} 个视频，播放最高的是 {top_video['title']}"
        ),
    }


def _bili_top3_folder_params() -> dict[str, Any]:
    category = "娱乐"
    top3 = Bilibili.top_ranking_videos_by_plays(category, 20, top_n=3)
    top = top3[0]
    return {
        "category": category,
        "rank": 20,
        "folder": "热门视频",
        "bvid1": str(top3[0]["id"]),
        "bvid2": str(top3[1]["id"]),
        "bvid3": str(top3[2]["id"]),
        **_contact_params(),
        "wechat_message": f"{top['title']} 播放量 {format_compact_stat(int(top['plays']))}",
    }


def _redbook_author_top_collect_message(query: str) -> str:
    rb = _redbook()
    top_note = rb.most_liked_search_note(query)
    author = rb.note_author(top_note)
    top_collected = rb.user_max_collected_note(str(author["name"]))
    return f"{author['name']} {top_collected['title']} 获赞与收藏 {author['likesAndCollections']}"


def _redbook_top_liked_note(query: str) -> str:
    top2 = _redbook().search_top_notes_by_likes(query, top_n=2)
    return "\n".join(str(note["title"]).strip() for note in top2)


def _redbook_best_worst_note(user: str) -> str:
    top_liked, min_collected = _redbook().user_best_worst_notes(user)
    return f"{top_liked['title']}\n{min_collected['title']}"


def _redbook_user_top_collect_params(user: str) -> dict[str, Any]:
    rb = _redbook()
    top_liked = rb.user_max_liked_note(user)
    author = rb.note_author(top_liked)
    return {
        "user": user,
        "note_id": str(top_liked["id"]),
        "note_title": str(top_liked["title"]),
        **_contact_params(),
        "wechat_message": f"{top_liked['title']} 获赞与收藏 {author['likesAndCollections']}",
    }


def _third_spotify_params() -> dict[str, Any]:
    track = _spotify().nth_today_play(3)
    return {
        "playlist": "今天爱听",
        "track_id": str(track["id"]),
        "redbook_title": f"推荐 {track['title']}",
        "redbook_content": f"{track['title']} {track['artist']}",
    }


def _weekly_reading_spotify_moment() -> str:
    wr = _wechat_reading()
    best_date, minutes = wr.best_reading_day_and_duration(SIM_OS)
    date_label = WechatReading.date_labels(best_date, SIM_OS)[0]
    liked_recent = _spotify_default().liked_recent_intersection()
    if liked_recent:
        first = liked_recent[0]
        song = f"{first['title']} {first['artist']}"
    else:
        song = "暂无已点赞歌曲"
    return f"最近阅读最投入的一天：{date_label}，读了{minutes}分钟。现在在听的歌：{song}"


SCRIPTED_CASES: list[tuple[str, Callable[[], BaseTask]]] = [
    (
        "SpotifyNowPlayingToWechat",
        lambda: content_tasks.SpotifyNowPlayingToWechat(
            **_contact_params(),
            wechat_message=f"正在听 {_spotify().current_track_title}",
        ),
    ),
    (
        "BilibiliRankingToWechat",
        lambda: content_tasks.BilibiliRankingToWechat(
            **_contact_params(),
            **_bili_share_params(),
            wechat_message=_bili_share_params()["title"],
        ),
    ),
    (
        "RedbookSearchTitleToWechat",
        lambda: content_tasks.RedbookSearchTitleToWechat(
            keyword="数分",
            **_contact_params(),
            wechat_message=str(_redbook_first("数分")[0]["title"]),
        ),
    ),
    (
        "SpotifyTodayNthPlayToRedbook",
        lambda: content_tasks.SpotifyTodayNthPlayToRedbook(
            nth=2,
            redbook_title=f"推荐 {_spotify().nth_today_play(2)['title']}",
            redbook_content=f"{_spotify().nth_today_play(2)['title']} {_spotify().nth_today_play(2)['artist']}",
        ),
    ),
    (
        "WechatReadingBestBookToWechat",
        lambda: content_tasks.WechatReadingBestBookToWechat(
            category="商业",
            **_contact_params(),
            wechat_message=_best_book_message("商业"),
        ),
    ),
    (
        "WechatReadingStatsToWechat",
        lambda: content_tasks.WechatReadingStatsToWechat(
            **_contact_params(),
            wechat_message=_reading_stats_message(),
        ),
    ),
    (
        "RedbookAuthorFollowersToWechat",
        lambda: content_tasks.RedbookAuthorFollowersToWechat(
            keyword="数分",
            **_contact_params(),
            note_id=str(_redbook_first("数分")[0]["id"]),
            author_id=str(_redbook_first("数分")[1]["id"]),
            wechat_message=f"{_redbook_first('数分')[1]['name']} 粉丝 {_redbook_first('数分')[1]['followers']}",
        ),
    ),
    (
        "XLatestPostToReddit_WithTitleFormat",
        lambda: content_tasks.XLatestPostToReddit_WithTitleFormat(
            user="elonmusk",
            subreddit="China_irl",
            reddit_title=f"elonmusk: {_x_latest_post('elonmusk')}",
            reddit_body=f"elonmusk: {_x_latest_post('elonmusk')}",
        ),
    ),
    (
        "RedbookFollowingNoteCountToSms",
        lambda: content_tasks.RedbookFollowingNoteCountToSms(
            username="西柚慢行",
            contact="张三",
            sms_contact="张三",
            sms_message=f"西柚慢行发了{_redbook().followed_user_note_count('西柚慢行')}篇笔记",
        ),
    ),
    (
        "SpotifySongFullDetailsToRedbook",
        lambda: content_tasks.SpotifySongFullDetailsToRedbook(
            song="搁浅",
            redbook_title="搁浅 听歌笔记",
            redbook_content=f"搁浅 {_spotify().track_by_title('搁浅')['artist']} 时长 {_spotify().track_by_title('搁浅')['duration']}",
        ),
    ),
    (
        "BilibiliTripleLikeThenMoments",
        lambda: content_tasks.BilibiliTripleLikeThenMoments(
            **_bili_share_params(),
            moment_content=f"推荐这个视频：{_bili_share_params()['title']}",
        ),
    ),
    (
        "RedbookDmThenWechatReport",
        lambda: content_tasks.RedbookDmThenWechatReport(
            username="西柚慢行",
            message="你好呀",
            **_contact_params(),
            redbook_user_id=str(_redbook().require_user_by_name("西柚慢行")["id"]),
            wechat_message="已经联系西柚慢行了",
        ),
    ),
    (
        "NotesContentToRedbookAndX",
        lambda: content_tasks.NotesContentToRedbookAndX(
            topic="AI代理",
            note_title="AI代理想法",
            shared_content="AI代理需要更强的任务判定和更清晰的执行边界。",
            redbook_title="AI代理想法",
        ),
    ),
    (
        "DailyLogToMoments",
        lambda: content_tasks.DailyLogToMoments(moment_content=_latest_notes_moment()),
    ),
    (
        "CulturalChecklistToRedbook",
        lambda: content_tasks.CulturalChecklistToRedbook(
            note_title="今日文化清单",
            note_content=f"{_spotify().nth_today_play(1)['title']}\n{_wechat_reading().first_hot_search_title()}",
            redbook_title="今日文化清单",
        ),
    ),
    (
        "EbayCheapToRedbook",
        lambda: content_tasks.EbayCheapToRedbook(
            product="电风扇",
            redbook_title="eBay商品推荐",
            redbook_content=_cheap_product_note("电风扇"),
        ),
    ),
    (
        "SpotifySaveCurrentSongToNotes",
        lambda: content_tasks.SpotifySaveCurrentSongToNotes(
            note_title="Spotify当前播放",
            note_content=f"{_spotify().current_track['title']} {_spotify().current_track['artist']}",
        ),
    ),
    (
        "WechatReadingShareBookList",
        lambda: content_tasks.WechatReadingShareBookList(
            n=3,
            **_contact_params(),
            wechat_message=_book_list_message(3),
        ),
    ),
    (
        "ReadingPlanToNotes",
        lambda: content_tasks.ReadingPlanToNotes(
            note_title="本周阅读计划",
            note_content=_reading_plan_note(),
        ),
    ),
    (
        "FileManagerSendFileToWechatContact",
        lambda: content_tasks.FileManagerSendFileToWechatContact(
            **_contact_params(),
            wechat_message="downloaded_image.jpg\ndownloaded_image_copy.jpg",
        ),
    ),
    (
        "NotesToWechatAndRedbook",
        lambda: content_tasks.NotesToWechatAndRedbook(
            text_keyword="今天心情很好",
            contact="张伟",
            contact_wxid=CONTACT_WXID,
            note_title="同步记录",
            redbook_title="同步记录",
        ),
    ),
    (
        "BilibiliRankAuthorLastNovToWechat",
        lambda: _task("BilibiliRankAuthorLastNovToWechat", **_bili_author_last_nov_params()),
    ),
    (
        "BilibiliRankTop3FolderAndWechat",
        lambda: _task("BilibiliRankTop3FolderAndWechat", **_bili_top3_folder_params()),
    ),
    (
        "FavoriteWaterSceneryPhotos",
        lambda: _task("FavoriteWaterSceneryPhotos", **_contact_params()),
    ),
    (
        "RedbookAuthorTopCollectToWechat",
        lambda: _task(
            "RedbookAuthorTopCollectToWechat",
            query="旅行",
            **_contact_params(),
            wechat_message=_redbook_author_top_collect_message("旅行"),
        ),
    ),
    (
        "RedbookTopLikedToNotes",
        lambda: _task(
            "RedbookTopLikedToNotes",
            query="旅行",
            note_title="小红书点赞Top2",
            note_content=_redbook_top_liked_note("旅行"),
        ),
    ),
    (
        "RedbookUserBestWorstToNotes",
        lambda: _task(
            "RedbookUserBestWorstToNotes",
            user="铁铁健身日记",
            note_title="用户热门冷门笔记",
            note_content=_redbook_best_worst_note("铁铁健身日记"),
        ),
    ),
    (
        "RedbookUserTopCollectToWechat",
        lambda: _task("RedbookUserTopCollectToWechat", **_redbook_user_top_collect_params("铁铁健身日记")),
    ),
    (
        "ThirdSpotifyPlayRecommendOnRedbookAndPlaylist",
        lambda: _task("ThirdSpotifyPlayRecommendOnRedbookAndPlaylist", **_third_spotify_params()),
    ),
    (
        "WeeklyReadingAndLikedSpotifySongsToMoment",
        lambda: _task(
            "WeeklyReadingAndLikedSpotifySongsToMoment",
            moment_content=_weekly_reading_spotify_moment(),
        ),
    ),
]


def test_scripted_cases_cover_every_task() -> None:
    covered = {name for name, _ in SCRIPTED_CASES}
    declared = suite_task_class_names(content_tasks)
    missing = declared - covered
    assert not missing, f"crossapp_content tasks without a scripted case: {sorted(missing)}"


@pytest.mark.live
@pytest.mark.asyncio(loop_scope="session")
@pytest.mark.parametrize("name,make_task", SCRIPTED_CASES, ids=[c[0] for c in SCRIPTED_CASES])
async def test_crossapp_content_scripted_passes_judge(
    env: MobileGymEnv, name: str, make_task: Callable[[], BaseTask]
) -> None:
    res = await run_scripted(env, make_task(), suite=SUITE, max_steps=SCRIPTED_MAX_STEPS.get(name))
    assert res.success, f"{name}: scripted episode must pass (COMPLETE + judge.passed):\n{format_episode_result(res)}"
