"""Scripted validation plans for Bilibili tasks.

Sampling compatibility (``DERIVED_PARAMS``): every non-declared plan
placeholder (``answer``, ``bvid``, ``mid``, ``anime_id``, ``folder_id``,
``tag1-3``, ``rank_scrolls``) is computed at materialization time through the
*judge-homologous* ``Bilibili`` domain class — state-backed values build
``Bilibili(init_state["apps"]["bilibili"])`` exactly like judges build
``Bilibili(input.apps_init["bilibili"])``, and static-data values reuse the
same classmethod readers the judges call over ``rankings.json`` /
``videoDetails.jsonl`` / ``authors.json`` (``bvid_from_title`` /
``video_detail`` / ``comment_by_contains`` / ``author_follower_display`` /
``ranking_entry``), so derived values cannot drift from the judge. Explicit
test injections would still win; ``test_scripted.py`` deliberately pins
*declared* task parameters only, exercising this derivation path end to end.

String parameters without a sampling ``source`` (``title`` / ``snippet`` /
``anime_title`` / ``new_sign`` / ``new_name``) never vary on the sampling
path (``TaskSampler`` falls back to the schema default), so plans may rely on
their fixed data layout — see the scroll-count exemptions below.

Layout facts the parameterized navigation relies on (viewport 360x800 css px):

- Ranking page (``RankingPage.tsx``): virtual list, uniform 124px rows
  (``estimateSize`` positions rows without re-measurement), list container
  ``[data-scroll-container="main"]`` ≈650-700px tall. One fraction swipe
  0.75→0.25 without inertia scrolls exactly 0.5 x container height (~330px).
  ``_ranking_scrolls`` buckets rank 1-15 into 0-4 such swipes so the target
  row is always tap-hittable (the env probes several rect anchors, so a
  partially visible row still receives the tap). The six task partitions are
  the first six tabs — all within (or overlapping) the initial tab strip, so
  no horizontal tab scrolling is needed; the *active* tab renders without a
  ``data-trigger``, hence the Branch: the default 全站 arm must not tap it.
- Birthday picker (``ProfileEditPage.tsx``): calendar dialog, not a wheel.
  ``user.birthday`` starts empty so the picker always opens at 1980-01-01;
  the year is already the task-fixed 1980. Month navigation walks single
  steps via the header chevrons (left = -1 wraps 1→12, right = +1 wraps
  12→1) — a per-month ``Branch`` arm encodes the shorter direction as a
  static click list, then taps the day cell (exact ``:text-is`` match) and
  confirms.

Scroll-count exemptions (static-data coupling, parameters never sampled):

- ``VideoCommentContainsAnswerUidTask``: 3 main-container scrolls — the
  hot-sorted target comment for the fixed default title/snippet sits around
  rank 11.
- ``VideoCommentContainsAnswerLocationTask``: 1 comment-list swipe — fixed
  default data layout; the comment list is fully rendered (no
  virtualization), so the ``assert_answer`` probe is offset-independent.

Known sampling-path gap (test-only patch, documented, not fixable here):
``ViewMyUidTask`` declares no ``answer_fields``, so the official sampling
path never configures the AnswerSheet for it — ``test_scripted.py`` patches
``answer_fields`` onto the instance (``_grounded``), which is a task-definition
gap, not a parameter injection; fixing it requires editing the task class
(out of scope for this migration).
"""

from __future__ import annotations

from typing import Any, Callable

from bench_env.agent.scripted import (
    Branch,
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
from bench_env.task.bilibili.app import Bilibili, norm_ip_location


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


# ---------------------------------------------------------------------------
# Derived params — sampling-path compatibility
# ---------------------------------------------------------------------------
# Each calculator mirrors its task's judge (get_answer / check_goals in
# bench_env/task/bilibili/tasks.py) through the same Bilibili domain class
# over the same initial state / static data files, so the typed/asserted
# values are judge-homologous by construction.

def _bili(state: dict[str, Any]) -> Bilibili:
    """Judge-homologous accessor: ``Bilibili(init_state["apps"]["bilibili"])``."""
    return Bilibili(state["apps"]["bilibili"])


def _comment(task: Any) -> dict[str, Any]:
    """The comment matched by ``comment_by_contains`` — the judges' own lookup."""
    return Bilibili.comment_by_contains(Bilibili.bvid_from_title(task.p.title), task.p.snippet)


def _ranking_scrolls(rank: int) -> int:
    """Fraction-swipe count that brings ranking row ``rank`` on screen.

    Rows are a uniform 124px; each swipe (0.75→0.25, no inertia) scrolls
    0.5 x container height (~325-350px for the ~650-700px list container).
    Buckets keep the target row tap-hittable across that height range, with
    the last bucket relying on the bottom scroll clamp (15 rows + padding).
    """
    if rank <= 5:
        return 0
    if rank <= 8:
        return 1
    if rank <= 10:
        return 2
    if rank <= 13:
        return 3
    return 4


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict[str, Any]], Any]]] = {
    "bilibili.ViewProfileStatTask": {
        # Mirror ViewProfileStatTask.get_answer over the initial state.
        "answer": lambda task, state: str(_bili(state).profile_stat(task.p.stat)),
    },
    "bilibili.SubscribeTask": {
        # Mirror check_following's resolve_mid_by_name (state recommendedUp
        # first, then the authors.json static map).
        "mid": lambda task, state: _bili(state).resolve_mid_by_name(task.p.up_name),
    },
    "bilibili.CoinVideoTask": {
        "bvid": lambda task, state: Bilibili.bvid_from_title(task.p.title),
    },
    "bilibili.ViewMyUidTask": {
        # Mirror the class answer spec ".user.uid" over the initial state.
        "answer": lambda task, state: str(_bili(state).user["uid"]),
    },
    "bilibili.VideoAnswerOnlineTask": {
        "bvid": lambda task, state: Bilibili.bvid_from_title(task.p.title),
        # Mirror VideoAnswerOnlineTask.get_answer (videoDetails.jsonl).
        "answer": lambda task, state: str(
            Bilibili.video_detail(Bilibili.bvid_from_title(task.p.title))["online"]
        ),
    },
    "bilibili.VideoAnswerTagsTask": {
        # The judge accepts any 3 real tags; answer the first three, same
        # slice the videoDetails.jsonl data exposes to the detail page.
        "bvid": lambda task, state: Bilibili.bvid_from_title(task.p.title),
        "tag1": lambda task, state: str(
            Bilibili.video_detail(Bilibili.bvid_from_title(task.p.title))["tags"][0]
        ),
        "tag2": lambda task, state: str(
            Bilibili.video_detail(Bilibili.bvid_from_title(task.p.title))["tags"][1]
        ),
        "tag3": lambda task, state: str(
            Bilibili.video_detail(Bilibili.bvid_from_title(task.p.title))["tags"][2]
        ),
    },
    "bilibili.ToggleAnimeSubscriptionTask": {
        # The anime search tab lists rankings.json 番剧/国创 entries whose row
        # subscribe action carries the entry id — the same title→id map
        # bvid_from_title builds (the judge itself checks by title only).
        "anime_id": lambda task, state: Bilibili.bvid_from_title(task.p.anime_title),
    },
    "bilibili.ViewFavoritesFolderCountTask": {
        # Mirror folder_by_title / folder_video_count over the initial state.
        "folder_id": lambda task, state: str(_bili(state).folder_by_title(task.p.folder_title)["id"]),
        "answer": lambda task, state: str(_bili(state).folder_video_count(task.p.folder_title)),
    },
    "bilibili.SearchUserFollowerCountTask": {
        # Mirror SearchUserFollowerCountTask.get_answer (authors.json).
        "answer": lambda task, state: Bilibili.author_follower_display(task.p.up_name),
    },
    "bilibili.SanlianTask": {
        "bvid": lambda task, state: Bilibili.bvid_from_title(task.p.title),
    },
    "bilibili.FavVideoAndCountTask": {
        # Mirror check_goals' ranking_entry lookup for the sampled slot.
        "bvid": lambda task, state: str(
            Bilibili.ranking_entry(task.p.partition, int(task.p.rank))["id"]
        ),
        # The judge counts the post-episode folder; init count + the one
        # video this plan favorites is the same number by construction.
        "answer": lambda task, state: str(_bili(state).folder_video_count("默认收藏夹") + 1),
        "rank_scrolls": lambda task, state: _ranking_scrolls(int(task.p.rank)),
    },
    "bilibili.VideoCommentContainsAnswerUidTask": {
        "bvid": lambda task, state: Bilibili.bvid_from_title(task.p.title),
        # Mirror get_answer: comment_by_contains(...)["mid"].
        "answer": lambda task, state: str(_comment(task)["mid"]),
    },
    "bilibili.VideoCommentContainsAnswerLocationTask": {
        "bvid": lambda task, state: Bilibili.bvid_from_title(task.p.title),
        # Mirror get_answer: norm_ip_location(comment["location"]).
        "answer": lambda task, state: norm_ip_location(_comment(task)["location"]),
    },
}


# ---------------------------------------------------------------------------
# bilibili.FavVideoAndCountTask — restricted Branch (partition tab switch)
# ---------------------------------------------------------------------------

def scroll_ranking_to_rank() -> Step:
    """Deterministic ranking-list scrolls, {rank_scrolls} swipes of 0.5 height.

    Rendered before macro expansion, so the derived ``{rank_scrolls}`` count
    materializes into that many fraction swipes (0.75→0.25, no inertia) —
    see ``_ranking_scrolls`` for the rank→count buckets.
    """
    return {
        "op": "wheel_scroll",
        "selector": '[data-scroll-container="main"]:visible',
        "current": 0,
        "target": "{rank_scrolls}",
        "modulo": 0,
        "max_delta_per_swipe": 1,
        "start_y_fraction": 0.75,
        "delta_y_fraction": 0.5,
        "duration_ms": 300,
        "inertia": False,
        "summary": "scroll ranking toward rank {rank}",
    }


def _fav_video_and_count_steps(*, switch_partition: bool) -> list[Step]:
    steps: list[Step] = [*open_ranking()]
    if switch_partition:
        steps += [
            click_selector(
                trigger_param("ranking.tab.switch", "tab", "{partition}"),
                summary="switch ranking partition to {partition}",
            ),
            wait(0.5, summary="wait for {partition} ranking list"),
        ]
    steps += [
        scroll_ranking_to_rank(),
        click_selector(trigger_param("video.open", "bvid", "{bvid}"), summary="open ranking video rank {rank}"),
        wait(0.8, summary="wait for video detail"),
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
    ]
    return steps


# ---------------------------------------------------------------------------
# bilibili.SetBirthdayTask — restricted Branch (one static arm per month)
# ---------------------------------------------------------------------------

def _birthday_chevron(side: str) -> str:
    """Month-navigator chevron inside the birthday dialog (svg #1 = prev, #2 = next)."""
    nth = "first-of-type" if side == "prev" else "last-of-type"
    return f"div.fixed div.justify-between.mb-4 > svg:{nth}"


def _birthday_day_cell() -> str:
    """Day cell in the calendar grid — exact text match so 1 never hits 10-28."""
    return 'div.fixed div.grid.gap-y-1 > div:has(> span:text-is("{day}"))'


def _set_birthday_branch(month: int) -> list[Step]:
    """Static steps for one target month: shorter chevron direction, then day tap.

    The picker opens at 1980-01-01 (initial ``user.birthday`` is empty), so
    from January the right chevron needs ``month-1`` taps and the left
    chevron ``13-month`` (both wrap); each arm hardcodes the shorter walk.
    """
    steps_right = month - 1
    steps_left = 13 - month
    side, count = ("next", steps_right) if steps_right <= steps_left else ("prev", steps_left)
    steps: list[Step] = [
        *open_profile_edit(),
        click_selector(row_by_label("出生年月"), summary="open birthday picker"),
        wait(0.4, summary="wait for birthday picker"),
    ]
    for index in range(count):
        steps += [
            click_selector(
                _birthday_chevron(side),
                summary=f"step month {side} {index + 1}/{count}",
            ),
            wait(0.15, summary="wait for month to update"),
        ]
    steps += [
        assert_text("1980年{month}月", summary="assert picker shows 1980-{month}"),
        click_selector(_birthday_day_cell(), summary="tap day {day} in calendar grid"),
        wait(0.2, summary="wait for day selection"),
        assert_text("{month}月{day}日", summary="assert picker header shows {month}-{day}"),
        click_selector(button_text("确定"), summary="confirm birthday"),
        complete(),
    ]
    return steps


PLANS: dict[str, list[Step] | Branch] = {
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
        # Per-field asserts: all tags render as sibling pills in one flex-wrap
        # block inside the expanded description, so the three probes share the
        # first pill's render path and screen region.
        assert_visible(
            'span.rounded-full:text-is("{tag1}"):visible',
            summary="assert first tag pill is on screen",
        ),
        assert_visible(
            'span.rounded-full:text-is("{tag2}"):visible',
            summary="assert second tag pill is on screen",
        ),
        assert_visible(
            'span.rounded-full:text-is("{tag3}"):visible',
            summary="assert third tag pill is on screen",
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
    # Restricted Branch: one static arm per target month — the calendar's
    # month chevrons are single-step walks, so the click count is structural,
    # not renderable; {day} stays a rendered placeholder inside each arm.
    "bilibili.SetBirthdayTask": Branch(
        pick=lambda task, state: f"month_{int(task.p.month)}",
        branches={f"month_{m}": _set_birthday_branch(m) for m in range(1, 13)},
    ),
    # Restricted Branch: the ranking page lands on 全站 whose *active* tab
    # renders without a data-trigger — only non-default partitions can (and
    # must) tap ranking.tab.switch. Scroll depth derives from {rank}.
    "bilibili.FavVideoAndCountTask": Branch(
        pick=lambda task, state: (
            "default_partition" if str(task.p.partition) == "全站" else "switch_partition"
        ),
        branches={
            "default_partition": _fav_video_and_count_steps(switch_partition=False),
            "switch_partition": _fav_video_and_count_steps(switch_partition=True),
        },
    ),
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
