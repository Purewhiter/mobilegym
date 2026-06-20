"""Scripted replay plans for cross-app content tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
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


BILI_DANCE_RANK10_BVID = str(Bilibili.ranking_entry("舞蹈", 10)["id"])
BILI_ENTERTAINMENT_TOP3_BVIDS = [
    str(video["id"]) for video in Bilibili.top_ranking_videos_by_plays("娱乐", 20, top_n=3)
]


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


def open_app(app: str) -> list[Step]:
    return [
        home(summary="return to launcher"),
        awake(app, summary=f"launch {app}"),
        wait(0.8, summary=f"wait for {app} foreground"),
    ]


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


def spotify_recent_track_to_new_playlist() -> list[Step]:
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


PLANS: dict[str, list[Step]] = {
    "crossapp_content.SpotifyNowPlayingToWechat": [
        *like_spotify_current(),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.BilibiliRankingToWechat": [
        *open_bilibili_ranked_video(),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.RedbookSearchTitleToWechat": [
        *redbook_search("{keyword}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.SpotifyTodayNthPlayToRedbook": [
        *open_app("Spotify"),
        *publish_redbook("{redbook_title}", "{redbook_content}"),
        complete(),
    ],
    "crossapp_content.WechatReadingBestBookToWechat": [
        *open_app("微信读书"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.WechatReadingStatsToWechat": [
        *open_app("微信读书"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.RedbookAuthorFollowersToWechat": [
        *redbook_search("{keyword}"),
        trigger_param("note.open", "id", "{note_id}", "open first RedNote search result"),
        wait(0.5, summary="wait for RedNote detail"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.XLatestPostToReddit_WithTitleFormat": [
        *open_app("X"),
        *create_reddit_post("{reddit_title}", "{reddit_body}"),
        complete(),
    ],
    "crossapp_content.RedbookFollowingNoteCountToSms": [
        *open_app("RedNote"),
        *send_sms("{sms_message}"),
        complete(),
    ],
    "crossapp_content.SpotifySongFullDetailsToRedbook": [
        *spotify_search("{song}"),
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
        *open_app("Spotify"),
        *open_app("微信读书"),
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
        *open_app("微信读书"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.ReadingPlanToNotes": [
        *open_app("微信读书"),
        *create_note("{note_title}", "{note_content}"),
        complete(),
    ],
    "crossapp_content.FileManagerSendFileToWechatContact": [
        *open_app("文件"),
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
        *redbook_search("{query}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.RedbookTopLikedToNotes": [
        *redbook_search("{query}"),
        *create_note("{note_title}", "{note_content}"),
        complete(),
    ],
    "crossapp_content.RedbookUserBestWorstToNotes": [
        *redbook_search("{user}"),
        *create_note("{note_title}", "{note_content}"),
        complete(),
    ],
    "crossapp_content.RedbookUserTopCollectToWechat": [
        *collect_redbook_note("{note_id}", "{note_title}"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    "crossapp_content.ThirdSpotifyPlayRecommendOnRedbookAndPlaylist": [
        *open_app("Spotify"),
        *publish_redbook("{redbook_title}", "{redbook_content}"),
        *spotify_recent_track_to_new_playlist(),
        complete(),
    ],
    "crossapp_content.WeeklyReadingAndLikedSpotifySongsToMoment": [
        *open_app("微信读书"),
        *open_app("Spotify"),
        *post_wechat_moment("{moment_content}"),
        complete(),
    ],
}
