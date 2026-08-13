"""Scripted replay plans for cross-app content tasks.

Sampling compatibility (``DERIVED_PARAMS``): every non-declared plan
placeholder (whole-sentence messages like ``{wechat_message}``, target ids
like ``{note_id}``/``{bvid}``, and on-screen assert values) is computed at
materialization time from the episode's post-setup initial state through the
*judge-homologous* domain classes — calculators build
``Redbook(init_state["apps"]["redbook"])`` / ``Spotify(...)`` /
``WechatReading(...)`` / ``Notes(...)`` / ``X(...)`` / ``Wechat(...)``
exactly like judges build them from ``input.apps_init[...]`` (multi-app
``task.setup`` warms every declared app before the first observation, so all
app stores are present). Bilibili rankings/authors and eBay products are
static disk datasets that the judges themselves read via classmethods /
module functions — the calculators call the same functions, which is the
judge-homologous form for those sources. Explicit test injections would still
win over these calculators; ``test_scripted.py`` deliberately injects
declared parameters only, exercising this derivation path end to end.

Restricted ``Branch`` plans (initial-state conditionals):

- ``RedbookAuthorFollowersToWechat`` — the judge requires the first search
  note's author to be *followed*; whether the author is already followed
  depends on ``{keyword}`` (数分's author is pre-followed, the other enum
  keywords' authors are not), so the pure ``pick`` reads the initial
  ``followingIds`` and selects the arm with / without the follow tap.
- ``WechatReadingBestBookToWechat`` — ``{category}`` samples over top-level
  category cards spread across the 2-column category grid; arms differ only
  in how many pre-scrolls bring the card into the viewport.
"""

from __future__ import annotations

from typing import Any, Callable

from bench_env.agent.scripted import (
    Branch,
    Step,
    assert_text,
    assert_visible,
    awake,
    back,
    complete,
    enter,
    home,
    swipe,
    tap_trigger,
    type_text,
    wait,
)
from bench_env.task.bilibili.app import Bilibili, format_compact_stat
from bench_env.task.ebay.app import expect_top
from bench_env.task.notes.app import Notes
from bench_env.task.redbook.app import Redbook
from bench_env.task.spotify.app import Spotify
from bench_env.task.utils import sim_today
from bench_env.task.wechat.app import Wechat
from bench_env.task.wechat_reading.app import WECHAT_READING_UI_TO_DATA, WechatReading
from bench_env.task.x.app import X


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
    """Send a text message to ``{contact}`` via the WeChat search route.

    The home chat list only shows contacts with an existing conversation
    (4 of 12 default contacts), while ``{contact}`` samples over *all*
    contacts — search covers every contact with no scroll geometry.
    """
    return [
        *open_app("WeChat"),
        # search.open 在多个 App 里同名（小红书/微信读书/B站…），warm 后各 App DOM
        # 常驻——必须限定 :visible 才能命中前台微信的搜索入口。
        click_selector('[data-trigger="search.open"]:visible', "open WeChat search"),
        type_text("{contact}", selector="input:visible", clear=True, summary="search WeChat contact"),
        wait(0.5, summary="wait for contact search results"),
        trigger_param("chat.open", "id", "{contact_wxid}", "open WeChat contact chat from search"),
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
    # 输入框 + 回车提交：recentSearches 默认只有 '电风扇'，而 {product} 采样
    # 覆盖全部枚举商品，点击"最近搜索"项对其余商品不可达。
    return [
        *open_app("eBay"),
        tap_trigger("home.search.open", summary="open eBay search"),
        type_text("{product}", selector="input:visible", clear=True, summary="type eBay search query"),
        enter(summary="submit eBay search"),
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
            "{now_playing_title}",
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
    """长按收藏按钮直开收藏夹 sheet，勾选目标夹后"完成"落夹。

    收藏按钮同一元素绑定 click（收藏到默认夹）与长按（video.intro.fav.longPress
    → 直接打开选择收藏夹 sheet，打开时勾选集为空、"完成"按勾选覆盖落夹）。
    相比旧链路（默认夹收藏 → toast"修改收藏夹" → 取消默认夹）每个视频省 5 步：
    该 L4 任务在 CLI 采样路径的步数预算是 60，旧链路展开 69 步必然超步（live
    此前靠测试侧 80 步放宽才通过），且长按路径不留默认夹残余。
    """
    steps: list[Step] = [
        trigger_param("video.open", "bvid", bvid, "open ranked video for favorite folder"),
        wait(0.8, summary="wait for Bilibili video detail"),
        long_press_selector(
            '[data-action="video.intro.fav.toggle"]:visible',
            "long press Fav to open folder sheet",
            duration_ms=900,
        ),
        wait(0.5, summary="wait for favorite folder sheet"),
    ]
    if create_folder:
        steps.extend(
            [
                click_selector('button:has-text("新建收藏夹"):visible', "open create favorite folder"),
                wait(0.5, summary="wait for favorite folder form"),
                type_text("{folder}", selector='input[placeholder="名称"]:visible', clear=True, summary="type folder name"),
                click_selector('button:has-text("完成"):visible', "create favorite folder"),
                # 创建完成回到 sheet，新夹自动勾选（pendingNewFolderId 预选机制）。
                wait(0.8, summary="return to favorite folder sheet with new folder preselected"),
            ]
        )
    else:
        steps.append(click_selector(bilibili_fav_folder_label("{folder}"), "select target favorite folder"))
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
        *favorite_rank_video_to_folder("{bvid1}", create_folder=True),
        *favorite_rank_video_to_folder("{bvid2}"),
        *favorite_rank_video_to_folder("{bvid3}"),
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


def wechat_reading_best_book_steps(*, category_swipes: int) -> list[Step]:
    """到达"{category} 分类推荐值最高的书"信息页：分类列表 →（可选滚动）→
    顶级分类 {category} 详情页。

    {category} 采样值（历史/文学/心理/悬疑推理/科学技术）都是顶级分类卡片；
    详情页默认"全部"chip 的过滤集 = 判分器的 UI→data 分类映射，且按 rating
    降序排列——首行即目标书 + "推荐值 xx%"。卡片在 2 列网格中的行位随分类
    不同，Branch 只在预滚动次数上分叉。
    """
    steps: list[Step] = [
        *open_app("微信读书"),
        click_selector('[data-trigger="categories.open"]:visible', "open WeChat Reading categories"),
        wait(0.5, summary="wait for category list"),
    ]
    if category_swipes:
        steps += scroll_page(category_swipes, summary="scroll category grid toward target category")
    steps += [
        trigger_param("category.detail.open", "categoryName", "{category}", "open target category detail"),
        wait(0.6, summary="wait for category detail"),
        # 书名+推荐值证据：分类详情按 rating 降序，首行即目标书，行内展示"推荐值 xx%"。
        assert_text("{top_book_title}", summary="assert top rated book title visible"),
        assert_text("{top_book_rv_label}", summary="assert top book recommendation value visible"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ]
    return steps


# 2 列网格行位（CategoryListPage.TOP_CATEGORIES 索引 // 2）：历史 r2 / 文学 r3 /
# 心理 r5 首屏可见；悬疑推理 r7 需 1 次滚动；科学技术 r11 需 3 次。
_WR_CATEGORY_ARMS = {"悬疑推理": "second_screen", "科学技术": "deep_screen"}


def _best_book_pick(task: Any, state: dict[str, Any]) -> str:
    return _WR_CATEGORY_ARMS.get(str(task.p.category), "first_screen")


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
        # {username} 枚举作者 5-7 篇笔记（网格 3-4 行）：2 次滚动保证 feed 序最后
        # 一篇卡片露出；笔记少时滚动 clamp 到底不会过头。
        *scroll_page(2, summary="scroll user notes grid"),
    ]


# 相册水景照片的文件名与倒序时间线位置由任务定义的 target_paths/target_times
# 固定（_prepare 里重新钉时间戳），静态无采样漂移——滚动/选择顺序按此标定。
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


# ---------------------------------------------------------------------------
# Derived params — sampling-path compatibility
# ---------------------------------------------------------------------------
# 判分同源访问器：与各判分器的 `Domain(input.apps_init["<app>"])` 完全同构，
# 只是状态来自首帧 act() 观测（runner 的 post-setup initial_obs）。多 App 任务
# setup 会先 warm 全部声明 App，故 init_state["apps"] 含所有相关 store。

def _redbook_state(state: dict[str, Any]) -> Redbook:
    return Redbook(state["apps"]["redbook"])


def _spotify_state(state: dict[str, Any]) -> Spotify:
    return Spotify(state["apps"]["spotify"])


def _reading_state(state: dict[str, Any]) -> WechatReading:
    return WechatReading(state["apps"]["wechat_reading"])


def _notes_state(state: dict[str, Any]) -> Notes:
    return Notes(state["apps"]["notes"])


def _contact_wxid(task: Any, state: dict[str, Any]) -> str:
    """联系人 wxid：与 Wechat.require_contact_wxid 的判分/数据口径一致。"""
    return Wechat(state["apps"]["wechat"]).require_contact_wxid(str(task.p.contact))


def redbook_author_followers_steps(*, follow_first: bool) -> list[Step]:
    """搜索 {keyword} → 首篇笔记 → 作者主页，读作者名/粉丝数并微信汇报。

    判分器要求最终状态已关注该作者：数分的首篇作者初始已关注（再点会取关），
    其余枚举关键词的首篇作者初始未关注（必须点关注）——Branch 按初始
    followingIds 分叉，关注方向用 ``"to":true`` 参数锁定，避免误触取关。
    """
    steps: list[Step] = [
        *redbook_search("{keyword}"),
        trigger_param("note.open", "id", "{note_id}", "open first RedNote search result"),
        wait(0.5, summary="wait for RedNote detail"),
        trigger_param("user.open", "userId", "{author_id}", "open note author profile"),
        wait(0.8, summary="view author followers on profile"),
    ]
    if follow_first:
        steps += [
            click_selector(
                '[data-action="user.page.follow.toggle"][data-action-params*=\'"to":true\']:visible',
                "follow the note author",
            ),
            wait(0.4, summary="wait for follow state update"),
        ]
    steps += [
        # 作者名与粉丝数证据：粉丝数字与"粉丝"标签分属兄弟 span，用结构选择器绑定成对断言，
        # 避免裸短数字误匹配。断言值取"关注后"视图口径（已关注作者 followers 显示 +1，
        # 与判分器 final 状态读数一致——见 _first_note_author_final_followers）。
        assert_text("{author_name}", summary="assert author name on profile"),
        assert_visible(
            'div:has(> span:text-is("{author_followers}")):has(> span:text-is("粉丝")):visible',
            summary="assert author follower count visible",
        ),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ]
    return steps


def _author_followers_pick(task: Any, state: dict[str, Any]) -> str:
    rb = _redbook_state(state)
    author = rb.note_author(rb.first_search_note(str(task.p.keyword)))
    following = {str(uid) for uid in rb.following_ids}
    return "already_following" if str(author["id"]) in following else "follow_first"


# 就地自证 lint（R1/R2/R3/R4）豁免清单——理由必填，豁免项会在 lint 报告中单列。
LINT_EXEMPT: dict[str, str] = {
    # R3（多 App awake 覆盖）：plan 在 Gallery 内发起图片分享 → 系统 chooser 选"微信" →
    # 微信分享目标页搜索联系人并 share.confirm.send 完成发送。微信全程经分享跳转到达
    # （对应 Android ACTION_SEND 流），插入 awake("微信") 反而会打断分享链路。
    "crossapp_content.FavoriteWaterSceneryPhotos": (
        "微信经 Gallery 分享 chooser 跳转到达（分享目标页内完成发送），无需也不应 awake"
    ),
}

PLANS: dict[str, list[Step] | Branch] = {
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
    # Branch 仅分叉分类卡片的预滚动次数（{category} 在 2 列网格中的行位不同）。
    "crossapp_content.WechatReadingBestBookToWechat": Branch(
        pick=_best_book_pick,
        branches={
            "first_screen": wechat_reading_best_book_steps(category_swipes=0),
            "second_screen": wechat_reading_best_book_steps(category_swipes=1),
            "deep_screen": wechat_reading_best_book_steps(category_swipes=3),
        },
    ),
    "crossapp_content.WechatReadingStatsToWechat": [
        *wechat_reading_weekly_stats(),
        # 聚合类证据：最佳阅读日按滚动 7 天窗口取，可跨自然周（最佳日常落在上个日历周），
        # 周视图单屏的"周X阅读最久"汇总条不保证展示该结论文本；断"阅读时长分布"图表卡
        # 可见作为读屏证据（与 wechat_reading 套件同页面口径一致）。
        assert_text("阅读时长分布", summary="assert weekly duration chart visible"),
        *send_wechat_message("{wechat_message}"),
        complete(),
    ],
    # Branch：判分器要求已关注首篇作者——数分的作者初始已关注（再点会取关），
    # 其余关键词的作者需先点关注；pick 读初始 followingIds。
    "crossapp_content.RedbookAuthorFollowersToWechat": Branch(
        pick=_author_followers_pick,
        branches={
            "already_following": redbook_author_followers_steps(follow_first=False),
            "follow_first": redbook_author_followers_steps(follow_first=True),
        },
    ),
    "crossapp_content.XLatestPostToReddit_WithTitleFormat": [
        *view_x_user_latest_post(),
        *create_reddit_post("{reddit_title}", "{reddit_body}"),
        complete(),
    ],
    "crossapp_content.RedbookFollowingNoteCountToSms": [
        *open_redbook_me_following_user_profile(),
        # 计数类证据不断短数字"5"：断浏览终点——feed 序最后（第 5）篇笔记卡片标题可见，
        # 证明笔记网格已完整翻到底（与 redbook 套件同页面口径一致）。
        assert_text("{last_note_title}", summary="assert last note card of followed user visible"),
        *send_sms("{sms_message}"),
        complete(),
    ],
    "crossapp_content.SpotifySongFullDetailsToRedbook": [
        *spotify_search("{song}"),
        back(summary="dismiss keyboard to reveal song results"),
        wait(0.4, summary="wait for keyboard dismiss"),
        action_param("search.track.play", "trackId", "{first_result_track_id}", "play first search result"),
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
    # 经"我-关注列表-用户主页-私信"到达聊天：消息 Tab 只列既有会话（安静岛无
    # 预置会话），主页私信按钮对 {username} 采样域全覆盖。
    "crossapp_content.RedbookDmThenWechatReport": [
        *open_app("RedNote"),
        # tab.me 与微信/微信读书同名，限定 :visible 命中前台小红书的 TabBar。
        click_selector('[data-trigger="tab.me"]:visible', "open RedNote Me tab"),
        wait(0.5, summary="wait for Me tab"),
        trigger_param("followList.open", "type", "1", "open RedNote following list"),
        wait(0.5, summary="wait for following list"),
        click_selector('[data-trigger="user.open"]:has-text("{username}"):visible', "open followed user profile"),
        wait(0.8, summary="wait for user profile"),
        trigger_param("chat.open", "userId", "{redbook_user_id}", "open DM chat from user profile"),
        wait(0.4, summary="wait for RedNote chat"),
        type_text(
            "{message}",
            selector='input[placeholder="发消息..."]:visible, input[placeholder="Message..."]:visible',
            clear=True,
            summary="type RedNote DM",
        ),
        click_selector("button.bg-app-primary:visible", "send RedNote DM"),
        wait(0.4, summary="wait for RedNote DM send"),
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
        # 排行 tab 滚 1 次 / 榜单滚 1 次 / 投稿滚 2 次的步数按 category=舞蹈、rank=10
        # 的静态榜单位次标定（两参数均为单值枚举，数据集静态，无采样漂移）。
        *open_bilibili_ranked_video_after_tab_scroll("{category}", "{bvid}", swipes=1),
        # 粉丝数在作者主页头部；user.open 默认落在"投稿"列表（最新发布排序，日期/播放量可见）。
        trigger_param("user.open", "mid", "{author_mid}", "open ranked video author profile"),
        wait(0.8, summary="view author followers and works list"),
        *scroll_page(2, summary="scroll author works to last November"),
        trigger_param("video.open", "bvid", "{nov_top_bvid}", "open top-played last-November video"),
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
        # 滚动步数按 query=旅行（单值枚举）的固定 feed 序标定，基础数据集静态无漂移。
        *redbook_search("{query}"),
        *scroll_page(2, summary="scroll search results to most-liked note"),
        trigger_param("note.open", "id", "{top_note_id}", "open most-liked search result"),
        wait(0.6, summary="wait for note detail"),
        trigger_param("user.open", "userId", "{author_id}", "open note author profile"),
        wait(0.8, summary="view author likes-and-collections on profile"),
        *scroll_page(1, summary="scroll author notes grid", from_y=780, to_y=560),
        click_selector(
            'div.cursor-pointer:has-text("{top_collected_prefix}"):visible',
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
        # 滚动步数按 query=旅行（单值枚举）的固定 feed 序标定，基础数据集静态无漂移。
        *scroll_page(2, summary="scroll search results across top-10 notes"),
        trigger_param("note.open", "id", "{top_note_id}", "open most-liked search result"),
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
        # 滚动 1 次按 {user} 枚举作者（8-12 篇、网格 4-5 行）的固定发帖序标定。
        *scroll_page(1, summary="scroll user notes grid"),
        click_selector(
            'div.cursor-pointer:has-text("{worst_note_prefix}"):visible',
            "open least-collected note",
        ),
        wait(0.6, summary="view collect count on note detail"),
        *create_note("{note_title}", "{note_content}"),
        complete(),
    ],
    "crossapp_content.RedbookUserTopCollectToWechat": [
        *collect_redbook_note("{note_id}", "{note_title}"),
        # 作者获赞与收藏数在作者主页头部展示（详情页头像 trigger 内无作者名文本，按 userId 定位）。
        trigger_param("user.open", "userId", "{author_id}", "open note author profile"),
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


# ---------------------------------------------------------------------------
# DERIVED_PARAMS 计算器 — 每个值与对应任务 check_goals 的取数逻辑同构
# ---------------------------------------------------------------------------

def _first_note_author(task: Any, state: dict[str, Any]) -> dict[str, Any]:
    """{keyword} 首篇笔记的作者——镜像 RedbookAuthorFollowersToWechat.check_goals。"""
    rb = _redbook_state(state)
    return rb.note_author(rb.first_search_note(str(task.p.keyword)))


def _first_note_author_final_followers(task: Any, state: dict[str, Any]) -> str:
    """作者粉丝数——关注后（final 视图）口径。

    bench 域类与前端视图层都对"已关注作者"的 followers +1（view_user /
    resolveRedBookRuntimeUser），而判分器从 *final* 状态读该值；plan 结束时
    必然已关注，故 init 未关注（follow_first 臂）时需在 init 视图值上 +1，
    init 已关注（already_following 臂）时 init 视图已含 +1、即 final 值。
    屏上断言同理：关注动作之后页面立即显示 +1 后的数字。
    """
    rb = _redbook_state(state)
    author = rb.note_author(rb.first_search_note(str(task.p.keyword)))
    followers = int(str(author["followers"]))
    if str(author["id"]) not in {str(uid) for uid in rb.following_ids}:
        followers += 1
    return str(followers)


def _best_book(task: Any, state: dict[str, Any]) -> dict[str, Any]:
    """{category} 分类 rating 最高的书——镜像 WechatReadingBestBookToWechat.check_goals。"""
    category = str(task.p.category)
    data_cats = WECHAT_READING_UI_TO_DATA.get(category, [category])
    books = [b for b in _reading_state(state).store if str(b.get("category")) in data_cats]
    if not books:
        raise ValueError(f"No books in UI category {category!r}")
    books.sort(key=lambda b: float(b.get("rating") or 0), reverse=True)
    return books[0]


def _reading_stats_message(task: Any, state: dict[str, Any]) -> str:
    """镜像 WechatReadingStatsToWechat：ISO 日期是判分 date_labels 的首个标签。

    判分器用终态 os 计算 7 天窗口；episode 时长为分钟级，与初始 os 的窗口
    一致（跨 sim 午夜的边界情形与旧测试的挂钟锚点近似同级，可接受）。
    """
    date_value, minutes = _reading_state(state).best_reading_day_and_duration(state["os"])
    return f"{date_value} 读了 {minutes} 分钟"


def _x_latest_post_line(task: Any, state: dict[str, Any]) -> str:
    """镜像 XLatestPostToReddit.check_goals：view_posts 序 + authorId 匹配取首条。"""
    user = str(task.p.user)
    user_lower = user.lower().lstrip("@")
    for post in X(state["apps"]["x"]).view_posts():
        aid = str(post.get("authorId") or "").lower()
        if aid.removeprefix("u_") == user_lower or user_lower in aid:
            content = str(post.get("content") or "").strip()
            if content:
                return f"{user.strip()}: {content}"
            break
    raise ValueError(f"No non-empty X post found for user {user!r}")


def _daily_log_moment(task: Any, state: dict[str, Any]) -> str:
    """镜像 DailyLogToMoments：最新两条笔记标题（title 缺失回退 content）。"""
    latest = _notes_state(state).latest_n_notes(2)
    if len(latest) < 2:
        raise ValueError("DailyLogToMoments needs at least 2 notes")
    titles = [str(note.get("title") or note.get("content") or "").strip() for note in latest]
    return f"今天简单总结：{titles[0]}、{titles[1]}"


def _weekly_reading_moment(task: Any, state: dict[str, Any]) -> str:
    """镜像 WeeklyReadingAndLikedSpotifySongsToMoment（判分用 init os/apps）。"""
    best_date, minutes = _reading_state(state).best_reading_day_and_duration(state["os"])
    date_label = WechatReading.date_labels(best_date, state["os"])[0]
    liked_recent = _spotify_state(state).liked_recent_intersection()
    if liked_recent:
        first = liked_recent[0]
        song = f"{first['title']} {first['artist']}"
    else:
        song = "暂无已点赞歌曲"
    return f"最近阅读最投入的一天：{date_label}，读了{minutes}分钟。现在在听的歌：{song}"


def _bili_rank_entry(task: Any) -> dict[str, Any]:
    """排行榜 (partition, rank) 条目——judge 同款 classmethod（静态榜单数据）。"""
    return Bilibili.ranking_entry(str(task.p.partition), int(task.p.rank))


def _bili_nov_author(task: Any, state: dict[str, Any]) -> tuple[str, int]:
    """(作者名, 去年年份)——年份与判分器一致取 sim_today(os_init).year - 1。"""
    author_name = Bilibili.ranking_author_name(str(task.p.category), int(task.p.rank))
    return author_name, sim_today(state["os"]).year - 1


def _bili_nov_message(task: Any, state: dict[str, Any]) -> str:
    """镜像 BilibiliRankAuthorLastNovToWechat：粉丝紧凑格式/数量带量词均在判分 label 集内。"""
    author_name, last_year = _bili_nov_author(task, state)
    followers = Bilibili.author_follower_count(author_name)
    last_nov = Bilibili.author_videos_in_year_month(author_name, last_year, 11)
    top_video = Bilibili.author_top_played_video_in_year_month(author_name, last_year, 11)
    return (
        f"{author_name} 粉丝 {format_compact_stat(followers)}，"
        f"去年11月发过 {len(last_nov)} 个视频，播放最高的是 {top_video['title']}"
    )


def _bili_top3(task: Any) -> list[dict[str, Any]]:
    """镜像 BilibiliRankTop3FolderAndWechat：前 {rank} 名按播放量降序取 3。"""
    return Bilibili.top_ranking_videos_by_plays(str(task.p.category), int(task.p.rank), top_n=3)


def _rb_top_search_note(task: Any, state: dict[str, Any]) -> dict[str, Any]:
    """{query} 前 10 篇中点赞最多的一篇——镜像 most_liked_search_note 判分口径。"""
    return _redbook_state(state).most_liked_search_note(str(task.p.query))


def _rb_author_top_collect_facts(task: Any, state: dict[str, Any]) -> tuple[dict, dict, dict]:
    """(点赞最高笔记, 作者, 作者收藏最多笔记)——镜像 RedbookAuthorTopCollectToWechat。"""
    rb = _redbook_state(state)
    top_note = rb.most_liked_search_note(str(task.p.query))
    author = rb.note_author(top_note)
    top_collected = rb.user_max_collected_note(str(author["name"]))
    return top_note, author, top_collected


def _rb_user_top_liked_facts(task: Any, state: dict[str, Any]) -> tuple[dict, dict]:
    """(用户点赞最高笔记, 作者)——镜像 RedbookUserTopCollectToWechat。"""
    rb = _redbook_state(state)
    top_liked = rb.user_max_liked_note(str(task.p.user))
    return top_liked, rb.note_author(top_liked)


def _ebay_cheapest_note(task: Any, state: dict[str, Any]) -> str:
    """镜像 EbayCheapToRedbook：priceLow 首位商品标题 + 总价（静态商品库）。"""
    top = expect_top(query=str(task.p.product), sort_id="priceLow", n=1)[0]
    return f"{top.title}\n总价 {float(top.total_cost):.2f}"


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict[str, Any]], Any]]] = {
    "crossapp_content.SpotifyNowPlayingToWechat": {
        "now_playing_title": lambda task, state: _spotify_state(state).current_track_title,
        "wechat_message": lambda task, state: f"正在听 {_spotify_state(state).current_track_title}",
        "contact_wxid": _contact_wxid,
    },
    "crossapp_content.BilibiliRankingToWechat": {
        "bvid": lambda task, state: str(_bili_rank_entry(task)["id"]),
        "title": lambda task, state: str(_bili_rank_entry(task)["title"]),
        "wechat_message": lambda task, state: str(_bili_rank_entry(task)["title"]),
        "contact_wxid": _contact_wxid,
    },
    "crossapp_content.RedbookSearchTitleToWechat": {
        "wechat_message": lambda task, state: str(
            _redbook_state(state).first_search_note(str(task.p.keyword))["title"]
        ),
        "contact_wxid": _contact_wxid,
    },
    "crossapp_content.SpotifyTodayNthPlayToRedbook": {
        "redbook_title": lambda task, state: (
            f"推荐 {_spotify_state(state).nth_today_play(int(task.p.nth))['title']}"
        ),
        "redbook_content": lambda task, state: (
            f"{_spotify_state(state).nth_today_play(int(task.p.nth))['title']} "
            f"{_spotify_state(state).nth_today_play(int(task.p.nth))['artist']}"
        ),
    },
    "crossapp_content.WechatReadingBestBookToWechat": {
        "top_book_title": lambda task, state: str(_best_book(task, state)["title"]),
        "top_book_rv_label": lambda task, state: (
            f"推荐值 {_best_book(task, state)['recommendedValue']}%"
        ),
        "wechat_message": lambda task, state: (
            f"{_best_book(task, state)['title']} "
            f"推荐值 {_best_book(task, state).get('recommendedValue', '')}"
        ),
        "contact_wxid": _contact_wxid,
    },
    "crossapp_content.WechatReadingStatsToWechat": {
        "wechat_message": _reading_stats_message,
        "contact_wxid": _contact_wxid,
    },
    "crossapp_content.RedbookAuthorFollowersToWechat": {
        "note_id": lambda task, state: str(
            _redbook_state(state).first_search_note(str(task.p.keyword))["id"]
        ),
        "author_id": lambda task, state: str(_first_note_author(task, state)["id"]),
        "author_name": lambda task, state: str(_first_note_author(task, state)["name"]),
        "author_followers": _first_note_author_final_followers,
        "wechat_message": lambda task, state: (
            f"{_first_note_author(task, state)['name']} "
            f"粉丝 {_first_note_author_final_followers(task, state)}"
        ),
        "contact_wxid": _contact_wxid,
    },
    "crossapp_content.XLatestPostToReddit_WithTitleFormat": {
        "reddit_title": _x_latest_post_line,
        "reddit_body": _x_latest_post_line,
    },
    "crossapp_content.RedbookFollowingNoteCountToSms": {
        "sms_contact": lambda task, state: str(task.p.contact),
        "sms_message": lambda task, state: (
            f"{task.p.username}发了"
            f"{_redbook_state(state).followed_user_note_count(str(task.p.username))}篇笔记"
        ),
        "last_note_title": lambda task, state: str(
            _redbook_state(state).user_notes_by_name(str(task.p.username))[-1]["title"]
        ).strip(),
    },
    "crossapp_content.SpotifySongFullDetailsToRedbook": {
        "first_result_track_id": lambda task, state: str(
            _spotify_state(state).search_local_tracks(str(task.p.song), limit=1)[0]["id"]
        ),
        "redbook_title": lambda task, state: f"{task.p.song} 听歌笔记",
        "redbook_content": lambda task, state: (
            f"{task.p.song} {_spotify_state(state).track_by_title(str(task.p.song))['artist']} "
            f"时长 {_spotify_state(state).track_by_title(str(task.p.song))['duration']}"
        ),
    },
    "crossapp_content.BilibiliTripleLikeThenMoments": {
        "bvid": lambda task, state: str(_bili_rank_entry(task)["id"]),
        "moment_content": lambda task, state: f"推荐这个视频：{_bili_rank_entry(task)['title']}",
    },
    "crossapp_content.RedbookDmThenWechatReport": {
        "redbook_user_id": lambda task, state: str(
            _redbook_state(state).require_user_by_name(str(task.p.username))["id"]
        ),
        "wechat_message": lambda task, state: f"已经联系{task.p.username}了",
        "contact_wxid": _contact_wxid,
    },
    "crossapp_content.NotesContentToRedbookAndX": {
        "note_title": lambda task, state: f"{task.p.topic}想法",
        "shared_content": lambda task, state: f"{task.p.topic}需要更强的任务判定和更清晰的执行边界。",
        "redbook_title": lambda task, state: f"{task.p.topic}想法",
    },
    "crossapp_content.DailyLogToMoments": {
        "moment_content": _daily_log_moment,
    },
    "crossapp_content.CulturalChecklistToRedbook": {
        "note_title": lambda task, state: "今日文化清单",
        "redbook_title": lambda task, state: "今日文化清单",
        "note_content": lambda task, state: (
            f"{_spotify_state(state).nth_today_play(1)['title']}\n"
            f"{_reading_state(state).first_hot_search_title()}"
        ),
    },
    "crossapp_content.EbayCheapToRedbook": {
        "redbook_title": lambda task, state: "eBay商品推荐",
        "redbook_content": _ebay_cheapest_note,
    },
    "crossapp_content.SpotifySaveCurrentSongToNotes": {
        "note_title": lambda task, state: "Spotify当前播放",
        "note_content": lambda task, state: (
            f"{_spotify_state(state).current_track['title']} "
            f"{_spotify_state(state).current_track['artist']}"
        ),
    },
    "crossapp_content.WechatReadingShareBookList": {
        "wechat_message": lambda task, state: "\n".join(
            str(_reading_state(state).require_store_book(str(item["bookId"]))["title"])
            for item in _reading_state(state).shelf[: int(task.p.n)]
        ),
        "contact_wxid": _contact_wxid,
    },
    "crossapp_content.ReadingPlanToNotes": {
        "note_title": lambda task, state: "本周阅读计划",
        "note_content": lambda task, state: "本周阅读计划\n" + "\n".join(
            f"- {title}" for title in _reading_state(state).reading_book_titles()
        ),
    },
    "crossapp_content.FileManagerSendFileToWechatContact": {
        # 判分器直接锚定这两个完整文件名（含扩展名），与文件管理器数据一致。
        "wechat_message": lambda task, state: "downloaded_image.jpg\ndownloaded_image_copy.jpg",
        "contact_wxid": _contact_wxid,
    },
    "crossapp_content.NotesToWechatAndRedbook": {
        "note_title": lambda task, state: "同步记录",
        "redbook_title": lambda task, state: "同步记录",
        "contact_wxid": _contact_wxid,
    },
    "crossapp_content.BilibiliRankAuthorLastNovToWechat": {
        "bvid": lambda task, state: str(
            Bilibili.ranking_entry(str(task.p.category), int(task.p.rank))["id"]
        ),
        "author_mid": lambda task, state: str(
            Bilibili.author_by_name(_bili_nov_author(task, state)[0])["mid"]
        ),
        "nov_top_bvid": lambda task, state: str(
            Bilibili.author_top_played_video_in_year_month(
                _bili_nov_author(task, state)[0], _bili_nov_author(task, state)[1], 11
            )["id"]
        ),
        "wechat_message": _bili_nov_message,
        "contact_wxid": _contact_wxid,
    },
    "crossapp_content.BilibiliRankTop3FolderAndWechat": {
        "bvid1": lambda task, state: str(_bili_top3(task)[0]["id"]),
        "bvid2": lambda task, state: str(_bili_top3(task)[1]["id"]),
        "bvid3": lambda task, state: str(_bili_top3(task)[2]["id"]),
        "wechat_message": lambda task, state: (
            f"{_bili_top3(task)[0]['title']} "
            f"播放量 {format_compact_stat(int(_bili_top3(task)[0]['plays']))}"
        ),
        "contact_wxid": _contact_wxid,
    },
    "crossapp_content.RedbookAuthorTopCollectToWechat": {
        "top_note_id": lambda task, state: str(_rb_top_search_note(task, state)["id"]),
        "author_id": lambda task, state: str(_rb_author_top_collect_facts(task, state)[1]["id"]),
        "top_collected_prefix": lambda task, state: str(
            _rb_author_top_collect_facts(task, state)[2]["title"]
        ).strip()[:12],
        "wechat_message": lambda task, state: (
            lambda facts: (
                f"{facts[1]['name']} {facts[2]['title']} "
                f"获赞与收藏 {facts[1]['likesAndCollections']}"
            )
        )(_rb_author_top_collect_facts(task, state)),
        "contact_wxid": _contact_wxid,
    },
    "crossapp_content.RedbookTopLikedToNotes": {
        "top_note_id": lambda task, state: str(_rb_top_search_note(task, state)["id"]),
        "note_title": lambda task, state: "小红书点赞Top2",
        "note_content": lambda task, state: "\n".join(
            str(note["title"]).strip()
            for note in _redbook_state(state).search_top_notes_by_likes(str(task.p.query), top_n=2)
        ),
    },
    "crossapp_content.RedbookUserBestWorstToNotes": {
        "worst_note_prefix": lambda task, state: str(
            _redbook_state(state).user_best_worst_notes(str(task.p.user))[1]["title"]
        ).strip()[:12],
        "note_title": lambda task, state: "用户热门冷门笔记",
        "note_content": lambda task, state: (
            lambda pair: f"{pair[0]['title']}\n{pair[1]['title']}"
        )(_redbook_state(state).user_best_worst_notes(str(task.p.user))),
    },
    "crossapp_content.RedbookUserTopCollectToWechat": {
        "note_id": lambda task, state: str(_rb_user_top_liked_facts(task, state)[0]["id"]),
        "note_title": lambda task, state: str(_rb_user_top_liked_facts(task, state)[0]["title"]),
        "author_id": lambda task, state: str(_rb_user_top_liked_facts(task, state)[1]["id"]),
        "wechat_message": lambda task, state: (
            lambda facts: (
                f"{facts[0]['title']} 获赞与收藏 {facts[1]['likesAndCollections']}"
            )
        )(_rb_user_top_liked_facts(task, state)),
        "contact_wxid": _contact_wxid,
    },
    "crossapp_content.ThirdSpotifyPlayRecommendOnRedbookAndPlaylist": {
        "track_id": lambda task, state: str(_spotify_state(state).nth_today_play(3)["id"]),
        "redbook_title": lambda task, state: (
            f"推荐 {_spotify_state(state).nth_today_play(3)['title']}"
        ),
        "redbook_content": lambda task, state: (
            f"{_spotify_state(state).nth_today_play(3)['title']} "
            f"{_spotify_state(state).nth_today_play(3)['artist']}"
        ),
    },
    "crossapp_content.WeeklyReadingAndLikedSpotifySongsToMoment": {
        "moment_content": _weekly_reading_moment,
    },
}
