"""Scripted validation plans for Bilibili tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
    assert_answer,
    assert_text,
    assert_visible,
    back,
    complete,
    enter,
    grounded_answer,
    grounded_answer_repeatable,
    long_press_at,
    swipe,
    tap_action,
    type_text,
    wait,
)


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def trigger_visible(trigger_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-trigger="{trigger_id}"]:visible', summary=summary)


def action_visible(action_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-action="{action_id}"]:visible', summary=summary)


def trigger_param(trigger_id: str, key: str, value: str) -> str:
    return f'[data-trigger="{trigger_id}"][data-trigger-params*=\'"{key}":"{value}"\']:visible'


def action_param(action_id: str, key: str, value: str) -> str:
    return f'[data-action="{action_id}"][data-action-params*=\'"{key}":"{value}"\']:visible'


def row_by_label(label: str) -> str:
    return f'xpath=//span[normalize-space()="{label}"]/ancestor::div[contains(@class,"justify-between")][1]'


def button_text(text: str) -> str:
    return f'button:has-text("{text}"):visible'


def search_user_row_for_name(name: str) -> str:
    return f'[data-trigger="user.open"]:has-text("{name}"):visible'


def unfollow_menu_item() -> str:
    return (
        'xpath=//div[contains(@class,"fixed")]'
        '//*[normalize-space()="取消关注" or normalize-space()="Unfollow"]'
    )


def open_search_results(query: str) -> list[Step]:
    return [
        trigger_visible("search.open", summary="open Bilibili search"),
        type_text(query, selector="input:visible", clear=True, summary=f"search for {query}"),
        enter(summary="submit search"),
        wait(0.8, summary="wait for search results"),
    ]


def open_search_user(query: str) -> list[Step]:
    return [
        *open_search_results(query),
        click_selector(trigger_param("search.results.tab.switch", "tab", "user"), summary="open search user tab"),
        wait(0.5, summary="wait for user results"),
    ]


def open_video_from_search(title: str, bvid: str) -> list[Step]:
    return [
        *open_search_results(title),
        click_selector(trigger_param("video.open", "bvid", bvid), summary=f"open video {bvid}"),
        wait(0.8, summary="wait for video detail"),
    ]


def open_me() -> list[Step]:
    return [
        trigger_visible("tab.me", summary="open Me tab"),
        wait(0.3, summary="wait for Me page"),
    ]


def open_profile_edit() -> list[Step]:
    return [
        *open_me(),
        trigger_visible("profileEdit.open", summary="open profile edit"),
        wait(0.4, summary="wait for profile edit"),
    ]


def update_profile_field(trigger_id: str, value: str, *, summary: str) -> list[Step]:
    field_label = {
        "profileEditName.open": "昵称",
        "profileEditSign.open": "个性签名",
    }.get(trigger_id)
    opener = row_by_label(field_label) if field_label else f'[data-trigger="{trigger_id}"]:visible'
    return [
        *open_profile_edit(),
        click_selector(opener, summary=summary),
        wait(0.3, summary="wait for edit field"),
        type_text(value, selector="input:visible, textarea:visible", clear=True, summary=f"type {value!r}"),
        click_selector('button:has-text("保存"):not([disabled]):visible', summary="save profile field"),
        wait(0.4, summary="wait for profile save"),
    ]


def open_ranking() -> list[Step]:
    return [
        click_selector(trigger_param("home.tab.switch", "tab", "hot"), summary="open Hot home tab"),
        wait(0.3, summary="wait for Hot tab"),
        trigger_visible("ranking.open", summary="open ranking"),
        wait(0.6, summary="wait for ranking page"),
    ]


def open_ranking_video(bvid: str) -> list[Step]:
    return [
        *open_ranking(),
        click_selector(trigger_param("video.open", "bvid", bvid), summary=f"open ranking video {bvid}"),
        wait(0.8, summary="wait for video detail"),
    ]


def coin_current_video(*, also_like: bool) -> list[Step]:
    steps: list[Step] = [
        action_visible("video.intro.coin.open", summary="open coin dialog"),
        wait(0.3, summary="wait for coin dialog"),
    ]
    if not also_like:
        steps.append(click_selector('div.cursor-pointer:has-text("同时点赞内容"):visible', summary="turn off also-like in coin dialog"))
        steps.append(wait(0.2, summary="wait after toggling also-like"))
    steps.extend(
        [
            action_visible("video.intro.coinDialog.submit", summary="submit one coin"),
            wait(0.5, summary="wait for coin dialog to close"),
        ]
    )
    return steps


def switch_video_tab(tab: str) -> list[Step]:
    return [
        click_selector(trigger_param("video.tab.switch", "tab", tab), summary=f"switch video tab to {tab}"),
        wait(0.4, summary="wait for video tab"),
    ]


def scroll_video_main(times: int, *, summary_prefix: str = "scroll video page") -> list[Step]:
    """Deterministic scrolls inside the video-detail main scroll container.

    Fraction-based swipe without inertia: each swipe drags from 80% to 20% of
    the container height, moving a fixed ~0.6 x container-height per swipe, so
    ``times`` swipes land at a predictable scroll offset (unlike full-screen
    inertia swipes).
    """
    steps: list[Step] = []
    for i in range(times):
        steps.append(
            {
                "op": "swipe",
                "selector": '[data-scroll-container="main"]:visible',
                "start_fraction": 0.5,
                "end_fraction": 0.5,
                "start_y_fraction": 0.8,
                "end_y_fraction": 0.2,
                "duration_ms": 300,
                "inertia": False,
                "summary": f"{summary_prefix} {i + 1}/{times}",
            }
        )
        steps.append(wait(0.3, summary="wait for scroll to settle"))
    return steps


def clear_search_history() -> list[Step]:
    return [
        trigger_visible("search.results.close", summary="return to search home"),
        wait(0.4, summary="wait for search home"),
        click_selector('h2:has-text("搜索历史") ~ svg:visible', summary="clear Bilibili search history"),
        wait(0.3, summary="wait for history clear"),
    ]


PLANS: dict[str, list[Step]] = {
    "bilibili.OpenRankingTask": [
        *open_ranking(),
        complete(),
    ],
    "bilibili.ViewProfileStatTask": [
        *open_me(),
        # Scope to the Me-header card (unique `.px-5.pb-4` div holding B币/硬币/
        # 动态/关注/粉丝): following/followers answers are 1-digit numbers that
        # would otherwise match stray digits elsewhere on the page.
        assert_answer(
            "{answer}",
            scope=".px-5.pb-4",
            summary="assert profile stat value in Me header card",
        ),
        *grounded_answer("{answer}", summary="answer profile stat"),
        complete(),
    ],
    "bilibili.SubscribeTask": [
        *open_search_user("{up_name}"),
        click_selector(action_param("search.user.follow.toggle", "mid", "{mid}"), summary="follow target UP"),
        complete(),
    ],
    "bilibili.UpdateSignTask": [
        *update_profile_field("profileEditSign.open", "{new_sign}", summary="open sign editor"),
        complete(),
    ],
    "bilibili.CoinVideoTask": [
        *open_video_from_search("{title}", "{bvid}"),
        *coin_current_video(also_like=False),
        complete(),
    ],
    "bilibili.ViewMyUidTask": [
        *open_profile_edit(),
        # The UID row renders label and 12-digit value in separate spans;
        # the judge's text matcher finds the value via normalized containment.
        assert_answer("{answer}", summary="assert my UID on profile edit page"),
        *grounded_answer("{answer}", summary="answer my UID"),
        complete(),
    ],
    "bilibili.UpdateNicknameTask": [
        *update_profile_field("profileEditName.open", "{new_name}", summary="open nickname editor"),
        complete(),
    ],
    "bilibili.VideoAnswerOnlineTask": [
        *open_video_from_search("{title}", "{bvid}"),
        # Anchor the full "N人正在看" line (outside the collapsed description,
        # visible by default) rather than the bare count: the plays stat next
        # to it can render a near-identical "N.N万" figure.
        assert_text("{answer}人正在看", summary="assert online count on video detail"),
        *grounded_answer("{answer}", summary="answer video online count"),
        complete(),
    ],
    "bilibili.VideoAnswerTagsTask": [
        *open_video_from_search("{title}", "{bvid}"),
        # Tags live in the collapsed description block; expand it first via the
        # chevron button next to the title (plain onClick, no data-trigger).
        click_selector("h1 + button:visible", summary="expand video description"),
        wait(0.6, summary="wait for description expand animation"),
        assert_visible(
            'span.rounded-full:text-is("{tag1}"):visible',
            summary="assert first tag pill is on screen",
        ),
        *grounded_answer("{tag1}", "{tag2}", "{tag3}", summary="answer three video tags"),
        complete(),
    ],
    "bilibili.ToggleAnimeSubscriptionTask": [
        *open_search_results("{anime_title}"),
        click_selector(trigger_param("search.results.tab.switch", "tab", "anime"), summary="open anime search tab"),
        wait(0.4, summary="wait for anime results"),
        click_selector(action_param("search.media.subscribe.toggle", "id", "{anime_id}"), summary="subscribe to anime"),
        complete(),
    ],
    "bilibili.SetSexTask": [
        *open_profile_edit(),
        click_selector(row_by_label("性别"), summary="open sex picker"),
        click_selector('xpath=//div[contains(@class,"fixed")]//div[normalize-space()="{sex}"]', summary="choose target sex"),
        complete(),
    ],
    "bilibili.ViewFavoritesFolderCountTask": [
        *open_me(),
        trigger_visible("favorites.open", summary="open favorites"),
        wait(0.4, summary="wait for favorites"),
        click_selector(trigger_param("favFolderDetail.open", "folderId", "{folder_id}"), summary="open target favorite folder"),
        wait(0.4, summary="wait for favorite folder"),
        # The folder detail header shows "{count}个内容"; the semantic line is
        # safer than a bare-number assert (video durations/plays nearby).
        assert_text("{answer}个内容", summary="assert folder item count on detail page"),
        *grounded_answer("{answer}", summary="answer favorite folder count"),
        complete(),
    ],
    "bilibili.SearchUserFollowerCountTask": [
        *open_search_user("{up_name}"),
        # The user-tab row renders "{N.N万}粉丝 · {n}个视频" via the same
        # compact-stat formatting the judge injects, so containment matches.
        assert_answer("{answer}", summary="assert follower count on user search row"),
        *grounded_answer("{answer}", summary="answer searched user follower count"),
        complete(),
    ],
    "bilibili.SanlianTask": [
        *open_ranking_video("{bvid}"),
        long_press_at(
            '[data-action="video.intro.like.toggle"]:visible',
            summary="long press Like to trigger Bilibili triple action",
            duration_ms=1000,
        ),
        wait(0.8, summary="wait for Bilibili triple action"),
        complete(),
    ],
    "bilibili.FollowRecommendationTask": [
        *open_search_user("{target_up_name}"),
        click_selector('[data-trigger="user.open"]:has-text("{target_up_name}"):visible', summary="open target user profile"),
        wait(0.8, summary="wait for user profile"),
        action_visible("user.works.follow.submit", summary="follow target user"),
        wait(0.4, summary="wait for recommendation panel"),
        click_selector(
            'xpath=//button[@data-action="user.works.follow.submit" and contains(normalize-space(), "关注") and not(contains(normalize-space(), "已关注"))]',
            summary="follow a different recommended UP",
        ),
        complete(),
    ],
    "bilibili.UnfollowAndClearHistoryTask": [
        *open_search_user("{up_name}"),
        click_selector(search_user_row_for_name("{up_name}"), summary="open target user profile"),
        wait(0.8, summary="wait for user profile"),
        trigger_visible("user.menu.open", summary="open followed user menu"),
        wait(0.3, summary="wait for profile unfollow menu"),
        click_selector(unfollow_menu_item(), summary="unfollow target user"),
        wait(0.4, summary="wait after unfollow"),
        back(summary="return to search results"),
        wait(0.4, summary="wait for search results"),
        *clear_search_history(),
        complete(),
    ],
    "bilibili.SetBirthdayTask": [
        *open_profile_edit(),
        click_selector(row_by_label("出生年月"), summary="open birthday picker"),
        wait(0.3, summary="wait for birthday picker"),
        click_selector(button_text("确定"), summary="confirm default 1980-01-01 birthday"),
        complete(),
    ],
    "bilibili.FavVideoAndCountTask": [
        *open_ranking_video("{bvid}"),
        action_visible("video.intro.fav.toggle", summary="favorite requested ranking video"),
        wait(0.4, summary="wait after favorite"),
        # Long-press the favorite icon to open the folder sheet, whose rows show
        # "{count}个内容" from the live store. Long press never emits a click
        # (simInput), so the just-added favorite is not toggled back off.
        long_press_at(
            '[data-action="video.intro.fav.toggle"]:visible',
            summary="long press favorite icon to open folder sheet",
            duration_ms=800,
        ),
        wait(0.8, summary="wait for favorite folder sheet"),
        assert_text("{answer}个内容", summary="assert default folder item count on screen"),
        *grounded_answer("{answer}", summary="answer default favorite folder count"),
        complete(),
    ],
    "bilibili.VideoCommentContainsAnswerUidTask": [
        *open_video_from_search("{title}", "{bvid}"),
        *switch_video_tab("comment"),
        # The comment list shows nicknames only; the UID is on the commenter's
        # profile page. Scroll the hot-sorted list (target sits around rank 11),
        # then open the commenter via their avatar/nickname (comment mids are
        # strings, so the params JSON carries quotes).
        *scroll_video_main(3, summary_prefix="scroll comments toward target"),
        click_selector(trigger_param("user.open", "mid", "{answer}"), summary="open matching commenter profile"),
        wait(0.8, summary="wait for user profile page"),
        assert_text("UID: {answer}", summary="assert commenter UID on screen"),
        *grounded_answer("{answer}", summary="answer matching comment UID"),
        complete(),
    ],
    "bilibili.VideoCommentContainsAnswerLocationTask": [
        *open_video_from_search("{title}", "{bvid}"),
        *switch_video_tab("comment"),
        swipe([500, 850], [500, 300], summary="scroll comments"),
        # Comment rows render "{time} {location}" with the IP属地： prefix
        # stripped — the same normalization the judge applies to the answer.
        # The comment list is fully rendered (no virtualization), so the
        # probe sees the row regardless of the exact scroll offset.
        assert_answer("{answer}", summary="assert comment IP location on screen"),
        *grounded_answer("{answer}", summary="answer matching comment IP location"),
        complete(),
    ],
}
