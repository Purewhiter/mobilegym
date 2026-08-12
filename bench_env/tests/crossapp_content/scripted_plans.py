"""Scripted replay plans for cross-app content tasks."""

from __future__ import annotations

import datetime as _dt
import json
from pathlib import Path

from bench_env.agent.scripted import (
    Step,
    assert_text,
    assert_visible,
    awake,
    back,
    complete,
    home,
    swipe,
    tap_trigger,
    type_text,
    wait,
)
from bench_env.task.bilibili.app import Bilibili
from bench_env.task.redbook.app import Redbook
from bench_env.task.spotify.app import Spotify
from bench_env.task.wechat_reading.app import WECHAT_READING_UI_TO_DATA

_ROOT = Path(__file__).resolve().parents[3]


BILI_DANCE_RANK10_BVID = str(Bilibili.ranking_entry("舞蹈", 10)["id"])
BILI_ENTERTAINMENT_TOP3_BVIDS = [
    str(video["id"]) for video in Bilibili.top_ranking_videos_by_plays("娱乐", 20, top_n=3)
]

# BilibiliRankAuthorLastNovToWechat：排行榜第 10 名作者的主页 mid 与其
# 去年 11 月播放量最高的视频（与 test_scripted.py 注入参数同源计算）。
_BILI_DANCE_RANK10_AUTHOR = Bilibili.ranking_author_name("舞蹈", 10)
BILI_DANCE_RANK10_AUTHOR_MID = str(Bilibili.author_by_name(_BILI_DANCE_RANK10_AUTHOR)["mid"])
BILI_DANCE_AUTHOR_LAST_NOV_TOP_BVID = str(
    Bilibili.author_top_played_video_in_year_month(
        _BILI_DANCE_RANK10_AUTHOR, _dt.datetime.now().year - 1, 11
    )["id"]
)

# Redbook 派生目标（与判分器同源：defaults.json + notes.json 基础数据集）。
_REDBOOK = Redbook(
    json.loads((_ROOT / "apps" / "RedBook" / "data" / "defaults.json").read_text(encoding="utf-8"))
)
_RB_TRAVEL_TOP_NOTE = _REDBOOK.most_liked_search_note("旅行")
RB_TRAVEL_TOP_LIKED_NOTE_ID = str(_RB_TRAVEL_TOP_NOTE["id"])
_RB_TRAVEL_AUTHOR = _REDBOOK.note_author(_RB_TRAVEL_TOP_NOTE)
RB_TRAVEL_AUTHOR_ID = str(_RB_TRAVEL_AUTHOR["id"])
RB_TRAVEL_AUTHOR_TOP_COLLECTED_TITLE_PREFIX = str(
    _REDBOOK.user_max_collected_note(str(_RB_TRAVEL_AUTHOR["name"]))["title"]
).strip()[:12]
RB_FITNESS_WORST_TITLE_PREFIX = str(
    _REDBOOK.user_best_worst_notes("铁铁健身日记")[1]["title"]
).strip()[:12]
RB_FITNESS_AUTHOR_ID = str(_REDBOOK.require_user_by_name("铁铁健身日记")["id"])

# RedbookAuthorFollowersToWechat：'数分' 首篇笔记作者（与 test_scripted.py 注入
# note_id/author_id 同源），作者名/粉丝数在其主页头部展示。
_RB_SHUFEN_AUTHOR = _REDBOOK.note_author(_REDBOOK.first_search_note("数分"))
RB_SHUFEN_AUTHOR_NAME = str(_RB_SHUFEN_AUTHOR["name"])
RB_SHUFEN_AUTHOR_FOLLOWERS = str(_RB_SHUFEN_AUTHOR["followers"])

# RedbookFollowingNoteCountToSms：西柚慢行 feed 序最后一篇笔记标题（计数=5 的浏览终点证据）。
RB_XIYOU_LAST_NOTE_TITLE = str(_REDBOOK.user_notes_by_name("西柚慢行")[-1]["title"]).strip()

# SpotifySongFullDetailsToRedbook：离线搜索首条结果（时长信息在播放器页）。
SPOTIFY_GEQIAN_FIRST_RESULT_ID = str(Spotify({}).search_local_tracks("搁浅", limit=1)[0]["id"])

# SpotifyNowPlayingToWechat：冷启动 currentTrack = recentPlays[0]（apps/Spotify/state.ts
# 初始化逻辑，judge 的 current_track_title 同口径），标题展示在首页底部迷你播放器。
SPOTIFY_NOW_PLAYING_TITLE = str(
    json.loads((_ROOT / "apps" / "Spotify" / "data" / "defaults.json").read_text(encoding="utf-8"))[
        "recentPlays"
    ][0]["title"]
)

# WechatReadingBestBookToWechat：'商业' UI 分类推荐值最高的书（与判分器同源：
# store 按 UI→data 分类映射过滤后 rating 降序取首），分类详情行展示"推荐值 xx%"。
_WR_BUSINESS_BOOKS = sorted(
    (
        book
        for book in json.loads(
            (_ROOT / "apps" / "WechatReading" / "data" / "defaults.json").read_text(encoding="utf-8")
        )["store"]
        if str(book.get("category")) in WECHAT_READING_UI_TO_DATA.get("商业", ["商业"])
    ),
    key=lambda book: float(book.get("rating") or 0),
    reverse=True,
)
WR_BUSINESS_TOP_TITLE = str(_WR_BUSINESS_BOOKS[0]["title"])
WR_BUSINESS_TOP_RV_LABEL = f"推荐值 {_WR_BUSINESS_BOOKS[0]['recommendedValue']}%"


def click_selector(selector: str, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def long_press_selector(selector: str, summary: str, *, duration_ms: int = 900) -> Step:
    return {"op": "long_press", "selector": selector, "duration_ms": duration_ms, "summary": summary}


def long_press_point(point: list[int], summary: str, *, duration_ms: int = 900) -> Step:
    return {"op": "long_press", "point": point, "duration_ms": duration_ms, "summary": summary}


def trigger_param(trigger_id: str, key: str, value: str, summary: str) -> Step:
    return click_selector(
        f'[data-trigger="{trigger_id}"][data-trigger-params*=\'"{key}":"{value}"\']:visible',
        summary,
    )


def action_param(action_id: str, key: str, value: str, summary: str) -> Step:
    return click_selector(
        f'[data-action="{action_id}"][data-action-params*=\'"{key}":"{value}"\']:visible',
        summary,
    )


def open_app(app: str) -> list[Step]:
    return [
        home(summary="return to launcher"),
        awake(app, summary=f"launch {app}"),
        wait(0.8, summary=f"wait for {app} foreground"),
    ]


def scroll_page(times: int, *, summary: str, from_y: int = 820, to_y: int = 420) -> list[Step]:
    """Best-effort vertical scrolls (norm_0_1000); hard semantics stay on tap steps."""
    steps: list[Step] = []
    for idx in range(times):
        steps.append(swipe([500, from_y], [500, to_y], summary=f"{summary} {idx + 1}/{times}"))
        steps.append(wait(0.3, summary="wait after scroll"))
    return steps


def send_wechat_message(content: str) -> list[Step]:
    return [
        *open_app("WeChat"),
        trigger_param("chat.open", "id", "{contact_wxid}", "open WeChat contact chat"),
        wait(0.5, summary="wait for chat"),
        type_text(content, selector="textarea:visible", clear=True, summary="type WeChat message"),
        click_selector("button.bg-app-primary:visible", "send WeChat message"),
        wait(0.5, summary="wait for WeChat send"),
    ]


def post_wechat_moment(content: str) -> list[Step]:
    return [
        *open_app("WeChat"),
        tap_trigger("tab.discover", summary="open Discover tab"),
        tap_trigger("discover.moments.open", summary="open Moments"),
        long_press_point([930, 82], "open text Moment composer"),
        wait(0.5, summary="wait for Moment text composer"),
        type_text(content, selector="textarea:visible", clear=True, summary="type Moment text"),
        click_selector('[data-action="moments.postText.submit"]:visible', "publish text Moment"),
        wait(0.8, summary="wait for Moment publish"),
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


def publish_redbook(title: str, content: str) -> list[Step]:
    main = '[data-scroll-container="main"]'
    return [
        *open_app("RedNote"),
        tap_trigger("home.modal.publish.open", summary="open RedNote publish sheet"),
        tap_trigger("publish.text.open.fromSheet", summary="choose text post"),
        wait(0.4, summary="wait for text editor"),
        click_selector(f"{main} >> text=说点什么或提个问题", "focus RedNote text editor"),
        type_text(content, selector=f"{main} textarea:visible", clear=True, summary="type RedNote post body"),
        click_selector('button:has-text("下一步"):visible', "continue from text editor"),
        wait(0.5, summary="wait for template picker"),
        click_selector('button:has-text("下一步"):visible', "continue from template"),
        wait(0.5, summary="wait for final editor"),
        type_text(title, selector='input[placeholder="添加标题"]:visible', clear=True, summary="type RedNote title"),
        type_text(content, selector=f"{main} textarea:visible", clear=True, summary="confirm RedNote post body"),
        back(summary="dismiss RedNote keyboard"),
        wait(0.3, summary="wait for RedNote submit bar"),
        click_selector('[data-action="publish.text.submit"]:visible', "publish RedNote post"),
        wait(0.8, summary="wait for RedNote publish"),
    ]


def post_x(content: str) -> list[Step]:
    return [
        *open_app("X"),
        tap_trigger("compose.open", summary="open X composer"),
        wait(0.4, summary="wait for X composer"),
        type_text(content, selector='textarea[data-action="compose.content.input"]:visible', clear=True, summary="type X post"),
        click_selector('[data-action="compose.post.submit"]:visible', "submit X post"),
        wait(0.6, summary="wait for X post"),
    ]


def create_reddit_post(title: str, body: str) -> list[Step]:
    return [
        *open_app("Reddit"),
        tap_trigger("tab.create", summary="open Reddit create tab"),
        wait(0.4, summary="wait for Reddit create page"),
        tap_trigger("create.community.open", summary="open community picker"),
        wait(0.4, summary="wait for Reddit community picker"),
        click_selector('button:has-text("r/{subreddit}"):visible, button:has-text("{subreddit}"):visible', "select subreddit"),
        wait(0.4, summary="return to Reddit create page"),
        type_text(title, selector='input[placeholder="Title"]:visible', clear=True, summary="type Reddit title"),
        type_text(body, selector="textarea:visible", clear=True, summary="type Reddit body"),
        click_selector('button:has-text("Post"):visible', "submit Reddit post"),
        wait(0.8, summary="wait for Reddit post"),
    ]


def send_sms(content: str) -> list[Step]:
    return [
        *open_app("短信"),
        click_selector("button.absolute.bottom-6.right-6:visible", "open SMS composer"),
        type_text("{sms_contact}", selector="input:visible", clear=True, summary="type SMS recipient"),
        click_selector('button:has-text("{sms_contact}"):visible', "select SMS contact suggestion"),
        type_text(content, selector='input:visible >> nth=1', clear=True, summary="type SMS body"),
        click_selector("button[aria-disabled=false]:visible", "send SMS"),
        wait(0.6, summary="wait for SMS send"),
    ]


def ebay_price_low_search() -> list[Step]:
    return [
        *open_app("eBay"),
        tap_trigger("home.search.open", summary="open eBay search"),
        click_selector('div.cursor-pointer:has-text("{product}"):visible', "select eBay recent search"),
        wait(0.8, summary="wait for eBay results"),
        click_selector('button:has-text("排序"):visible', "open eBay sort sheet"),
        click_selector(
            'xpath=//div[@role="dialog"]//div[contains(@class,"cursor-pointer") and .//span[normalize-space()="最低价 + 运费优先"]]',
            "choose lowest price sort",
        ),
        wait(0.8, summary="wait for sorted eBay results"),
    ]


def like_spotify_current() -> list[Step]:
    return [
        *open_app("Spotify"),
        # 歌名证据：首页底部迷你播放器展示当前播放曲目标题；先断可见再点喜欢，
        # 避免点赞后的 toast/浮层遮挡断言点。
        assert_text(
            SPOTIFY_NOW_PLAYING_TITLE,
            scope='[data-trigger="player.open"]',
            summary="assert now-playing title on mini player",
        ),
        click_selector('[data-action="track.like.toggle"]:visible', "like current Spotify track"),
        wait(0.5, summary="wait for Spotify like"),
    ]


def spotify_search(query: str) -> list[Step]:
    return [
        *open_app("Spotify"),
        tap_trigger("tab.search", summary="open Spotify search tab"),
        tap_trigger("search.input.open", summary="open Spotify search input"),
        type_text(query, selector="input:visible", clear=True, summary="type Spotify search"),
        wait(1.0, summary="wait for Spotify search results"),
    ]


def open_bilibili_ranked_video() -> list[Step]:
    return [
        *open_app("Bilibili"),
        trigger_param("home.tab.switch", "tab", "hot", "open Bilibili Hot tab"),
        wait(0.3, summary="wait for Hot tab"),
        tap_trigger("ranking.open", summary="open ranking"),
        wait(0.6, summary="wait for ranking page"),
        click_selector('button:has-text("{partition}"):visible', "select ranking partition"),
        wait(0.3, summary="wait for ranking partition"),
        trigger_param("video.open", "bvid", "{bvid}", "open ranked video"),
        wait(0.8, summary="wait for video detail"),
    ]


def open_bilibili_ranking(category: str) -> list[Step]:
    return [
        *open_app("Bilibili"),
        trigger_param("home.tab.switch", "tab", "hot", "open Bilibili Hot tab"),
        wait(0.3, summary="wait for Hot tab"),
        tap_trigger("ranking.open", summary="open ranking"),
        wait(0.6, summary="wait for ranking page"),
        click_selector(f'button:has-text("{category}"):visible', "select ranking partition"),
        wait(0.3, summary="wait for ranking partition"),
    ]


def scroll_bilibili_ranking_tabs(times: int) -> list[Step]:
    return [
        swipe([860, 125], [160, 125], summary=f"scroll Bilibili ranking tabs {idx + 1}/{times}")
        for idx in range(times)
    ]


def open_bilibili_ranking_after_tab_scroll(category: str, *, swipes: int) -> list[Step]:
    return [
        *open_app("Bilibili"),
        trigger_param("home.tab.switch", "tab", "hot", "open Bilibili Hot tab"),
        wait(0.3, summary="wait for Hot tab"),
        tap_trigger("ranking.open", summary="open ranking"),
        wait(0.6, summary="wait for ranking page"),
        *scroll_bilibili_ranking_tabs(swipes),
        wait(0.3, summary="wait after ranking tab scroll"),
        trigger_param("ranking.tab.switch", "tab", category, "select ranking partition after tab scroll"),
        wait(0.3, summary="wait for ranking partition"),
    ]


def open_bilibili_ranked_video_after_tab_scroll(category: str, bvid: str, *, swipes: int) -> list[Step]:
    return [
        *open_bilibili_ranking_after_tab_scroll(category, swipes=swipes),
        swipe([500, 820], [500, 500], summary="scroll Bilibili ranking list to target rank"),
        wait(0.3, summary="wait after ranking list scroll"),
        trigger_param("video.open", "bvid", bvid, "open ranked video after tab scroll"),
        wait(0.8, summary="wait for video detail"),
    ]


def bilibili_fav_folder_label(folder: str) -> str:
    return f'xpath=//span[normalize-space()="选择收藏夹"]/following::div[normalize-space()="{folder}"][1]'


def favorite_rank_video_to_folder(bvid: str, *, create_folder: bool = False) -> list[Step]:
    steps: list[Step] = [
        trigger_param("video.open", "bvid", bvid, "open ranked video for favorite folder"),
        wait(0.8, summary="wait for Bilibili video detail"),
        click_selector('[data-action="video.intro.fav.toggle"]:visible', "favorite Bilibili video to default folder"),
        wait(0.3, summary="wait for Bilibili favorite toast"),
        click_selector('button:has-text("修改收藏夹"):visible', "open Bilibili favorite folder sheet"),
        wait(0.5, summary="wait for favorite folder sheet"),
    ]
    if create_folder:
        steps.extend(
            [
                click_selector('button:has-text("新建收藏夹"):visible', "open create favorite folder"),
                wait(0.5, summary="wait for favorite folder form"),
                type_text("{folder}", selector='input[placeholder="名称"]:visible', clear=True, summary="type folder name"),
                click_selector('button:has-text("完成"):visible', "create favorite folder"),
                wait(0.8, summary="return to favorite folder sheet"),
                click_selector(bilibili_fav_folder_label("默认收藏夹"), "deselect Bilibili default favorite folder"),
                wait(0.2, summary="wait for default folder deselection"),
            ]
        )
    else:
        steps.extend(
            [
                click_selector(bilibili_fav_folder_label("{folder}"), "select existing favorite folder"),
                wait(0.2, summary="wait for folder selection"),
                click_selector(bilibili_fav_folder_label("默认收藏夹"), "deselect Bilibili default favorite folder"),
                wait(0.2, summary="wait for default folder deselection"),
            ]
        )
    steps.extend(
        [
            click_selector('button:has-text("完成"):visible', "confirm favorite folder selection"),
            wait(0.6, summary="wait for favorite folder update"),
            back(summary="return to Bilibili ranking"),
            wait(0.4, summary="wait for ranking page"),
        ]
    )
    return steps


def create_bilibili_top3_folder() -> list[Step]:
    return [
        *open_bilibili_ranking_after_tab_scroll("{category}", swipes=2),
        *favorite_rank_video_to_folder(BILI_ENTERTAINMENT_TOP3_BVIDS[0], create_folder=True),
        *favorite_rank_video_to_folder(BILI_ENTERTAINMENT_TOP3_BVIDS[1]),
        *favorite_rank_video_to_folder(BILI_ENTERTAINMENT_TOP3_BVIDS[2]),
    ]


def bilibili_triple_actions() -> list[Step]:
    return [
        *open_bilibili_ranked_video(),
        long_press_selector(
            '[data-action="video.intro.like.toggle"]:visible',
            "long press Like to trigger Bilibili triple action",
            duration_ms=1000,
        ),
        wait(0.8, summary="wait for Bilibili triple action"),
    ]


def redbook_search(keyword: str) -> list[Step]:
    return [
        *open_app("RedNote"),
        tap_trigger("search.open", summary="open RedNote search"),
        type_text(keyword, selector="input:visible", clear=True, summary="type RedNote search keyword"),
        tap_trigger("search.query.submit.push", summary="submit RedNote search"),
        wait(0.8, summary="wait for RedNote search results"),
    ]


def collect_redbook_note(note_id: str, title: str) -> list[Step]:
    return [
        *redbook_search(title),
        trigger_param("note.open", "id", note_id, "open target RedNote note"),
        wait(0.5, summary="wait for RedNote detail"),
        click_selector('[data-action="note.item.collect.toggle"]:visible', "collect RedNote note"),
        wait(0.4, summary="wait for RedNote collect state"),
    ]


def open_spotify_recent_played() -> list[Step]:
    """到达"今天听过的歌"信息页：最近播放页 + 展开今天分组（曲目标题/艺人可见）。"""
    return [
        *open_app("Spotify"),
        tap_trigger("home.sidebar.open", summary="open Spotify sidebar"),
        wait(0.3, summary="wait for Spotify sidebar"),
        tap_trigger("history.open", summary="open Spotify recent played"),
        wait(0.6, summary="wait for recent played"),
        click_selector(
            'xpath=//h2[normalize-space()="今天" or normalize-space()="Today"]/following::div[contains(@class,"cursor-pointer")][1]',
            "expand Spotify recent played group",
        ),
        wait(0.3, summary="wait for recent played tracks"),
    ]


def spotify_recent_played_back_home() -> list[Step]:
    """从最近播放页返回 Spotify 首页（history.open 是 replace，back 一次即回首页）。"""
    return [
        back(summary="return to Spotify home from recent played"),
        wait(0.4, summary="wait for Spotify home"),
    ]


def spotify_recent_track_to_new_playlist() -> list[Step]:
    return [
        *open_spotify_recent_played(),
        trigger_param("history.trackMenu.open", "trackId", "{track_id}", "open third recent track menu"),
        wait(0.4, summary="wait for Spotify track menu"),
        tap_trigger("history.addPlaylist.open", summary="open add to playlist sheet"),
        wait(0.5, summary="wait for add playlist sheet"),
        click_selector('button:has-text("新建歌单"):visible, button:has-text("New playlist"):visible', "open new playlist naming"),
        wait(0.5, summary="wait for playlist naming"),
        type_text("{playlist}", selector="input:visible", clear=True, summary="type Spotify playlist name"),
        click_selector('button:has-text("创建"):visible, button:has-text("Create"):visible', "create Spotify playlist"),
        wait(0.8, summary="wait for Spotify playlist creation"),
    ]


def wechat_reading_weekly_stats() -> list[Step]:
    """到达"最近一周每日阅读时长"信息页：我 → 阅读时长周视图。"""
    return [
        *open_app("微信读书"),
        tap_trigger("tab.me", summary="open WeChat Reading Me tab"),
        wait(0.5, summary="wait for Me tab"),
        # myReading.open.week 在首页与我页各有一个绑定（主 Tab 常驻，首页隐藏仍在 DOM），需限定可见。
        click_selector('[data-trigger="myReading.open.week"]:visible', "open weekly reading duration stats"),
        wait(0.8, summary="view weekly reading stats"),
    ]


def wechat_reading_bookshelf() -> list[Step]:
    """到达"书架前 N 本书"信息页：书架 Tab（书架数组序展示）。"""
    return [
        *open_app("微信读书"),
        tap_trigger("tab.bookshelf", summary="open WeChat Reading bookshelf tab"),
        wait(0.6, summary="view bookshelf books"),
    ]


def wechat_reading_in_progress_list() -> list[Step]:
    """到达"正在读的书"信息页：我 → 在读列表。"""
    return [
        *open_app("微信读书"),
        tap_trigger("tab.me", summary="open WeChat Reading Me tab"),
        wait(0.5, summary="wait for Me tab"),
        tap_trigger("readingList.open.reading", summary="open in-progress reading list"),
        wait(0.6, summary="view in-progress books"),
    ]


def wechat_reading_hot_search() -> list[Step]:
    """到达"热搜第一本书"信息页：搜索落地页（热搜榜可见）。"""
    return [
        *open_app("微信读书"),
        tap_trigger("search.open", summary="open WeChat Reading search hot list"),
        wait(0.6, summary="view hot search list"),
    ]


def wechat_reading_business_category() -> list[Step]:
    """到达"{category} 分类推荐值最高的书"信息页：分类列表 → 经济理财 →
    子分类 chip {category}（分类详情按 rating 降序，首行即目标书 + 推荐值）。"""
    return [
        *open_app("微信读书"),
        tap_trigger("categories.open", summary="open WeChat Reading categories"),
        wait(0.5, summary="wait for category list"),
        trigger_param("category.detail.open", "categoryName", "经济理财", "open 经济理财 category detail"),
        wait(0.5, summary="wait for category detail"),
        click_selector('span.text-sm.cursor-pointer:has-text("{category}"):visible', "filter by sub-category"),
        wait(0.5, summary="view top rated book of sub-category"),
    ]


def view_x_user_latest_post() -> list[Step]:
    """到达"X 用户最新推文"信息页：搜索用户 → 用户主页（帖子按 feed 序过滤，首条即最新）。"""
    return [
        *open_app("X"),
        tap_trigger("tab.search", summary="open X search tab"),
        wait(0.4, summary="wait for X search page"),
        tap_trigger("search.input.open", summary="open X search input"),
        wait(0.4, summary="wait for X search input"),
        type_text("{user}", selector="input:visible", clear=True, summary="type X user query"),
        wait(0.6, summary="wait for X search results"),
        trigger_param("user.open.fromSearch", "id", "{user}", "open X user profile from search"),
        wait(0.8, summary="wait for X user profile"),
        swipe([500, 700], [500, 520], summary="scroll X profile to latest post"),
        wait(0.4, summary="view latest post on profile"),
    ]


def browse_file_manager_copy_dirs() -> list[Step]:
    """到达"两个目录中的图片副本文件名"信息页：依次浏览 Download 与 Pictures。"""
    return [
        *open_app("文件"),
        *scroll_page(1, summary="scroll storage list toward Download"),
        click_selector('button:has-text("Download"):visible', "open Download directory"),
        wait(0.6, summary="view files in Download"),
        back(summary="return to storage list"),
        wait(0.4, summary="wait for storage list"),
        *scroll_page(2, summary="scroll storage list toward Pictures"),
        click_selector('button:has-text("Pictures"):visible', "open Pictures directory"),
        wait(0.6, summary="view files in Pictures"),
    ]


def open_redbook_me_following_user_profile() -> list[Step]:
    """到达"我关注的 {username} 的笔记数"信息页：我 → 关注列表 → 用户主页笔记网格。"""
    return [
        *open_app("RedNote"),
        tap_trigger("tab.me", summary="open RedNote Me tab"),
        wait(0.5, summary="wait for Me tab"),
        trigger_param("followList.open", "type", "1", "open RedNote following list"),
        wait(0.5, summary="wait for following list"),
        click_selector('[data-trigger="user.open"]:has-text("{username}"):visible', "open followed user profile"),
        wait(0.8, summary="wait for user profile"),
        *scroll_page(1, summary="scroll user notes grid"),
    ]


WATER_PHOTO_ALTS = [
    "IMG_20260320_yiheyuan_wanshoushan.jpg",
    "photo_001.jpg",
    "downloaded_image.jpg",
    "mmexport1737200000002.jpg",
    "downloaded_image_copy.jpg",
    "IMG_20260119_101504.jpg",
    "IMG_20260119_101502.jpg",
    "IMG_20260117_185412.jpg",
    "IMG_20251020_091520.jpg",
    "IMG_20230325_110540.jpg",
]


def gallery_photo_tile(alt: str) -> str:
    return f'div.relative.aspect-square:has(img[alt="{alt}"]):visible'


def favorite_water_photos_and_share_latest() -> list[Step]:
    steps: list[Step] = [
        *open_app("Gallery"),
        long_press_selector(
            gallery_photo_tile(WATER_PHOTO_ALTS[0]),
            "select latest water scenery photo",
            duration_ms=700,
        ),
        wait(0.4, summary="wait for Gallery select mode"),
    ]
    for alt in WATER_PHOTO_ALTS[1:]:
        if alt in {WATER_PHOTO_ALTS[7], WATER_PHOTO_ALTS[9]}:
            steps.append(swipe([500, 860], [500, 520], summary="scroll Gallery to more water scenery photos"))
            steps.append(wait(0.3, summary="wait after Gallery scroll"))
        steps.append(click_selector(gallery_photo_tile(alt), f"select water scenery photo {alt}"))
        steps.append(wait(0.1, summary="wait for Gallery selection"))
    steps.extend(
        [
            click_selector('button:has-text("收藏"):visible, button:has-text("Favorite"):visible', "favorite selected water photos"),
            wait(0.5, summary="wait for Gallery favorites update"),
            click_selector('xpath=(//button)[1]', "exit Gallery select mode"),
            wait(0.3, summary="wait for Gallery normal mode"),
            swipe([500, 360], [500, 860], summary="scroll Gallery back toward latest photos 1/2"),
            wait(0.2, summary="wait after Gallery upward reset scroll"),
            swipe([500, 360], [500, 860], summary="scroll Gallery back toward latest photos 2/2"),
            wait(0.3, summary="wait for latest photo visible again"),
            long_press_selector(
                gallery_photo_tile(WATER_PHOTO_ALTS[0]),
                "select only latest water scenery photo",
                duration_ms=700,
            ),
            wait(0.4, summary="wait for Gallery select mode with latest photo"),
            click_selector('[data-action="gallery.select.share"]:visible', "share latest selected water scenery photo"),
            wait(0.5, summary="wait for image share app chooser"),
            click_selector('button:has-text("微信"):visible, button:has-text("WeChat"):visible', "choose WeChat from image share chooser"),
            wait(0.8, summary="wait for WeChat share target page"),
            type_text("{contact}", selector='[data-action="share.forward.search.input"]:visible', clear=True, summary="search WeChat share contact"),
            wait(0.3, summary="wait for WeChat share search results"),
            click_selector('[data-action="share.forward.target.select"]:has-text("{contact}"):visible', "select WeChat share target"),
            wait(0.4, summary="wait for WeChat share confirm"),
            click_selector('[data-action="share.confirm.send"]:visible', "send shared image"),
            wait(0.8, summary="wait for image share send"),
        ]
    )
    return steps


# 就地自证 lint（R1/R2/R3/R4）豁免清单——理由必填，豁免项会在 lint 报告中单列。
LINT_EXEMPT: dict[str, str] = {
    # R3（多 App awake 覆盖）：plan 在 Gallery 内发起图片分享 → 系统 chooser 选"微信" →
    # 微信分享目标页搜索联系人并 share.confirm.send 完成发送。微信全程经分享跳转到达
    # （对应 Android ACTION_SEND 流），插入 awake("微信") 反而会打断分享链路。
    "crossapp_content.FavoriteWaterSceneryPhotos": (
        "微信经 Gallery 分享 chooser 跳转到达（分享目标页内完成发送），无需也不应 awake"
    ),
}

PLANS: dict[str, list[Step]] = {
    "crossapp_content.SpotifyNowPlayingToWechat": [
        *like_spotify_current(),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.BilibiliRankingToWechat": [
        *open_bilibili_ranked_video(),
        # 标题证据：排行榜第 {rank} 名视频详情页头部展示完整标题（{title} 与注入的
        # wechat_message 同源于 ranking_entry）。
        assert_text("{title}", summary="assert ranked video title on detail page"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.RedbookSearchTitleToWechat": [
        *redbook_search("{keyword}"),
        # 标题证据：搜索结果第一张卡片展示第一篇笔记完整标题（注入的 wechat_message
        # 即该标题原串）。
        assert_text("{wechat_message}", summary="assert first search note title visible"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.SpotifyTodayNthPlayToRedbook": [
        *open_spotify_recent_played(),
        *publish_redbook("{redbook_title}", "{redbook_content}"),
        complete(),
    ],
    "crossapp_content.WechatReadingBestBookToWechat": [
        *wechat_reading_business_category(),
        # 书名+推荐值证据：分类详情按 rating 降序，首行即目标书，行内展示"推荐值 xx%"。
        assert_text(WR_BUSINESS_TOP_TITLE, summary="assert top rated book title visible"),
        assert_text(WR_BUSINESS_TOP_RV_LABEL, summary="assert top book recommendation value visible"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.WechatReadingStatsToWechat": [
        *wechat_reading_weekly_stats(),
        # 聚合类证据：最佳阅读日按滚动 7 天窗口取，可跨自然周（最佳日常落在上个日历周），
        # 周视图单屏的"周X阅读最久"汇总条不保证展示该结论文本；断"阅读时长分布"图表卡
        # 可见作为读屏证据（与 wechat_reading 套件同页面口径一致）。
        assert_text("阅读时长分布", summary="assert weekly duration chart visible"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.RedbookAuthorFollowersToWechat": [
        *redbook_search("{keyword}"),
        trigger_param("note.open", "id", "{note_id}", "open first RedNote search result"),
        wait(0.5, summary="wait for RedNote detail"),
        # 作者名/粉丝数在作者主页展示；初始数据已关注该作者，点关注会变成取关，故只查看不点击。
        trigger_param("user.open", "userId", "{author_id}", "open note author profile"),
        wait(0.8, summary="view author followers on profile"),
        # 作者名与粉丝数证据：粉丝数字与"粉丝"标签分属兄弟 span，用结构选择器绑定成对断言，
        # 避免裸短数字误匹配。
        assert_text(RB_SHUFEN_AUTHOR_NAME, summary="assert author name on profile"),
        assert_visible(
            f'div:has(> span:text-is("{RB_SHUFEN_AUTHOR_FOLLOWERS}")):has(> span:text-is("粉丝")):visible',
            summary="assert author follower count visible",
        ),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.XLatestPostToReddit_WithTitleFormat": [
        *view_x_user_latest_post(),
        *create_reddit_post("{reddit_title}", "{reddit_body}"),
        complete(),
    ],
    "crossapp_content.RedbookFollowingNoteCountToSms": [
        *open_redbook_me_following_user_profile(),
        # 计数类证据不断短数字"5"：断浏览终点——feed 序最后（第 5）篇笔记卡片标题可见，
        # 证明笔记网格已完整翻到底（与 redbook 套件同页面口径一致）。
        assert_text(RB_XIYOU_LAST_NOTE_TITLE, summary="assert last note card of followed user visible"),
        *send_sms("{sms_message}"),
        complete(),
    ],
    "crossapp_content.SpotifySongFullDetailsToRedbook": [
        *spotify_search("{song}"),
        back(summary="dismiss keyboard to reveal song results"),
        wait(0.4, summary="wait for keyboard dismiss"),
        action_param("search.track.play", "trackId", SPOTIFY_GEQIAN_FIRST_RESULT_ID, "play first search result"),
        wait(0.6, summary="wait for playback"),
        tap_trigger("player.open", summary="open full player"),
        wait(0.8, summary="view artist and duration on player"),
        *publish_redbook("{redbook_title}", "{redbook_content}"),
        complete(),
    ],
    "crossapp_content.BilibiliTripleLikeThenMoments": [
        *bilibili_triple_actions(),
        *post_wechat_moment("{moment_content}"),
        complete(),
    ],
    "crossapp_content.RedbookDmThenWechatReport": [
        *open_app("RedNote"),
        tap_trigger("tab.message", summary="open RedNote messages"),
        trigger_param("chat.open", "userId", "{redbook_user_id}", "open RedNote followed user chat"),
        wait(0.4, summary="wait for RedNote chat"),
        type_text(
            "{message}",
            selector='input[placeholder="发消息..."]:visible, input[placeholder="Message..."]:visible',
            clear=True,
            summary="type RedNote DM",
        ),
        click_selector("button.bg-app-primary:visible", "send RedNote DM"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.NotesContentToRedbookAndX": [
        *create_note("{note_title}", "{shared_content}"),
        *publish_redbook("{redbook_title}", "{shared_content}"),
        *post_x("{shared_content}"),
        complete(),
    ],
    "crossapp_content.DailyLogToMoments": [
        *open_app("Notes"),
        *post_wechat_moment("{moment_content}"),
        complete(),
    ],
    "crossapp_content.CulturalChecklistToRedbook": [
        *open_spotify_recent_played(),
        *wechat_reading_hot_search(),
        *create_note("{note_title}", "{note_content}"),
        *publish_redbook("{redbook_title}", "{note_content}"),
        complete(),
    ],
    "crossapp_content.EbayCheapToRedbook": [
        *ebay_price_low_search(),
        *publish_redbook("{redbook_title}", "{redbook_content}"),
        complete(),
    ],
    "crossapp_content.SpotifySaveCurrentSongToNotes": [
        *open_app("Spotify"),
        *create_note("{note_title}", "{note_content}"),
        complete(),
    ],
    "crossapp_content.WechatReadingShareBookList": [
        # 首页轮播按 addedAt 排序，与判分器的书架数组序不一致，必须进书架 Tab。
        *wechat_reading_bookshelf(),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.ReadingPlanToNotes": [
        *wechat_reading_in_progress_list(),
        *create_note("{note_title}", "{note_content}"),
        complete(),
    ],
    "crossapp_content.FileManagerSendFileToWechatContact": [
        *browse_file_manager_copy_dirs(),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.NotesToWechatAndRedbook": [
        *create_note("{note_title}", "{text_keyword}"),
        *send_wechat_message("{text_keyword}"),
        *publish_redbook("{redbook_title}", "{text_keyword}"),
        complete(),
    ],
    "crossapp_content.BilibiliRankAuthorLastNovToWechat": [
        *open_bilibili_ranked_video_after_tab_scroll("{category}", BILI_DANCE_RANK10_BVID, swipes=1),
        # 粉丝数在作者主页头部；user.open 默认落在"投稿"列表（最新发布排序，日期/播放量可见）。
        trigger_param("user.open", "mid", BILI_DANCE_RANK10_AUTHOR_MID, "open ranked video author profile"),
        wait(0.8, summary="view author followers and works list"),
        *scroll_page(2, summary="scroll author works to last November"),
        trigger_param("video.open", "bvid", BILI_DANCE_AUTHOR_LAST_NOV_TOP_BVID, "open top-played last-November video"),
        wait(0.8, summary="view top-played November video detail"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.BilibiliRankTop3FolderAndWechat": [
        *create_bilibili_top3_folder(),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.FavoriteWaterSceneryPhotos": [
        *favorite_water_photos_and_share_latest(),
        complete(),
    ],
    "crossapp_content.RedbookAuthorTopCollectToWechat": [
        # 前 10 篇中点赞最多的一篇按相关性排在第 8 位（"最多点赞"排序作用于全部结果，
        # 与判分器"前 10 篇内取最大"口径不一致，不能走排序捷径），滚动后打开。
        *redbook_search("{query}"),
        *scroll_page(2, summary="scroll search results to most-liked note"),
        trigger_param("note.open", "id", RB_TRAVEL_TOP_LIKED_NOTE_ID, "open most-liked search result"),
        wait(0.6, summary="wait for note detail"),
        trigger_param("user.open", "userId", RB_TRAVEL_AUTHOR_ID, "open note author profile"),
        wait(0.8, summary="view author likes-and-collections on profile"),
        *scroll_page(1, summary="scroll author notes grid", from_y=780, to_y=560),
        click_selector(
            f'div.cursor-pointer:has-text("{RB_TRAVEL_AUTHOR_TOP_COLLECTED_TITLE_PREFIX}"):visible',
            "open author top-collected note",
        ),
        wait(0.6, summary="view collect count on note detail"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.RedbookTopLikedToNotes": [
        *redbook_search("{query}"),
        # 点赞 Top2 分别位于相关性第 4/8 位；滚动使两篇卡片（标题+点赞数）可见，
        # 并打开更深的第 8 位那篇以硬校验滚动深度。
        *scroll_page(2, summary="scroll search results across top-10 notes"),
        trigger_param("note.open", "id", RB_TRAVEL_TOP_LIKED_NOTE_ID, "open most-liked search result"),
        wait(0.6, summary="view most-liked note detail"),
        *create_note("{note_title}", "{note_content}"),
        complete(),
    ],
    "crossapp_content.RedbookUserBestWorstToNotes": [
        *redbook_search("{user}"),
        trigger_param("search.tab.switch", "tab", "users", "switch to user search results"),
        wait(0.5, summary="wait for user results"),
        click_selector('[data-trigger="user.open"]:has-text("{user}"):visible', "open searched user profile"),
        wait(0.8, summary="wait for user profile"),
        # 网格卡片展示点赞数；收藏数需进详情——打开收藏最低的那篇查看。
        *scroll_page(1, summary="scroll user notes grid"),
        click_selector(
            f'div.cursor-pointer:has-text("{RB_FITNESS_WORST_TITLE_PREFIX}"):visible',
            "open least-collected note",
        ),
        wait(0.6, summary="view collect count on note detail"),
        *create_note("{note_title}", "{note_content}"),
        complete(),
    ],
    "crossapp_content.RedbookUserTopCollectToWechat": [
        *collect_redbook_note("{note_id}", "{note_title}"),
        # 作者获赞与收藏数在作者主页头部展示（详情页头像 trigger 内无作者名文本，按 userId 定位）。
        trigger_param("user.open", "userId", RB_FITNESS_AUTHOR_ID, "open note author profile"),
        wait(0.8, summary="view author likes-and-collections on profile"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.ThirdSpotifyPlayRecommendOnRedbookAndPlaylist": [
        # 按指令顺序：先查看今天听过的歌，再发小红书，最后回来加歌单。
        *open_spotify_recent_played(),
        *spotify_recent_played_back_home(),
        *publish_redbook("{redbook_title}", "{redbook_content}"),
        *spotify_recent_track_to_new_playlist(),
        complete(),
    ],
    "crossapp_content.WeeklyReadingAndLikedSpotifySongsToMoment": [
        *wechat_reading_weekly_stats(),
        *open_spotify_recent_played(),
        *spotify_recent_played_back_home(),
        tap_trigger("tab.library", summary="open Spotify library tab"),
        wait(0.5, summary="wait for library tab"),
        tap_trigger("likedSongs.open", summary="open liked songs"),
        wait(0.6, summary="view liked songs list"),
        *post_wechat_moment("{moment_content}"),
        complete(),
    ],
}
