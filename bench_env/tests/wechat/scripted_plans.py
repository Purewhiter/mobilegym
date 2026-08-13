"""Scripted validation plans for WeChat tasks.

Sampling compatibility (``DERIVED_PARAMS``): every non-declared plan
placeholder is computed at materialization time from the episode's
post-setup initial state through the *judge-homologous* ``Wechat`` domain
class — calculators build ``Wechat(init_state["apps"]["wechat"])`` exactly
like judges build ``Wechat(input.apps_init["wechat"])``, so derived values
cannot drift from the judge:

- ``answer`` (ReadMyWxid / ReadContactRegion / ReadStepsLeaderboardTop)
  mirrors ``answer = ".user.wxid"`` / ``find_contact(contact).region`` /
  ``top_stepper()[0]`` respectively;
- ``moment_text`` (PostMomentFromChat) mirrors
  ``last_received_text_from(contact)`` in the task's ``check_goals``;
- ``contact_wxid`` (the four contact tasks) is the classic derived lookup —
  ``require_contact_wxid(contact)`` resolves the declared ``{contact}`` name
  to the wxid carried by the row's ``data-trigger-params``, giving an exact
  row selector instead of a fuzzy ``:has-text`` match;
- ``sports_action`` (ToggleWechatSports) is a pure function of the declared
  ``toggle`` param: ``_invert_criteria`` guarantees the initial state is the
  opposite of the target, so the plan taps ``enable.submit`` when the target
  is on and ``disable.submit`` when it is off.

Explicit test injections still win over these calculators; ``test_scripted.py``
injects declared parameters only, exercising the derivation path end to end.

Restricted ``Branch`` usage:

- ``wechat.ConditionalReplyToBoss`` — the judge derives the expected reply
  from whether {keyword} appears in Boss's *initial* chat history
  (``received_texts_from("Boss")``); the pure ``pick`` mirrors that predicate
  over the same accessor and selects the ``yes`` (type {yes_reply}) or ``no``
  (type {no_reply}) arm.
- The four contact tasks (BlacklistContact / ReadContactRegion /
  SetFriendChatOnly / StarAndRestrictFriend) — the env never scrolls
  implicitly, and the Contacts list (4 utility rows + 12 grouped contacts on
  a 360x800 viewport) only shows roughly the first six contact rows.
  ``pick`` recomputes the list's rendered order exactly like Contacts.tsx
  (non-blacklisted, grouped by ``category``, groups sorted, source order
  within a group) and returns ``visible`` (rendered index < 6 — live-proven:
  刘浪 at index 5 is tappable without scrolling) or ``scrolled`` (two clamped
  full swipes pin the list to the bottom, where rows from index 5 on are in
  view).

Exemptions (kept hardcoded deliberately):

- ``wechat.PostMomentsTextWithCity`` — ``location`` is a string param with
  no sampler/source, so the sampling path always uses the default 北京市;
  the SelectLocation rows carry no ``data-action-params`` and the location
  list is frontend-static (not in app state), so there is nothing to derive
  from. ``postMoment.location.select.beijing`` stays pinned.
- ``wechat.ScenicPhotoToMomentsWithPhrase`` — ``_photo_path`` (and the other
  string params) have no sampler/source and always keep their defaults; the
  album xpath's ``wanshoushan`` alt fragment matches that pinned path.
- ``wechat.ConditionalReplyToBoss`` history swipes stay a fixed best-effort
  3x scroll: the Boss history is static initial data and the swipes only
  gather on-screen evidence — the reply itself is branch-picked from state.
"""

from __future__ import annotations

from typing import Any, Callable

from bench_env.agent.scripted import (
    Branch,
    Step,
    assert_answer,
    back,
    complete,
    enter,
    grounded_answer,
    long_press_at,
    swipe,
    type_text,
    wait,
)
from bench_env.task.wechat.app import Wechat


def click_selector(selector: str, *, summary: str) -> Step:
    return {"op": "click", "selector": selector, "summary": summary}


def trigger_visible(trigger_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-trigger="{trigger_id}"]:visible', summary=summary)


def action_visible(action_id: str, *, summary: str) -> Step:
    return click_selector(f'[data-action="{action_id}"]:visible', summary=summary)


def trigger_param(trigger_id: str, key: str, value: str, *, summary: str) -> Step:
    return click_selector(
        f'[data-trigger="{trigger_id}"][data-trigger-params*=\'"{key}":"{value}"\']:visible',
        summary=summary,
    )


def action_param(action_id: str, key: str, value: str, *, summary: str) -> Step:
    return click_selector(
        f'[data-action="{action_id}"][data-action-params*=\'"{key}":"{value}"\']:visible',
        summary=summary,
    )


def auth_app_row(name: str) -> Step:
    return click_selector(
        f'[data-trigger="settings.privacy.authorization.detail.open"]:has-text("{name}"):visible',
        summary=f"open authorized app {name}",
    )


def open_settings() -> list[Step]:
    return [
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("me.settings.open", summary="open WeChat settings"),
    ]


def open_general_settings() -> list[Step]:
    return [
        *open_settings(),
        trigger_visible("settings.general.open", summary="open General settings"),
    ]


def open_friend_privacy() -> list[Step]:
    return [
        *open_settings(),
        trigger_visible("settings.privacy.friends.open", summary="open Friend permissions"),
    ]


def open_add_me_methods() -> list[Step]:
    return [
        *open_friend_privacy(),
        trigger_visible("settings.privacy.addMe.open", summary="open Add Me methods"),
    ]


def open_moments_privacy() -> list[Step]:
    return [
        *open_friend_privacy(),
        trigger_visible("settings.privacy.moments.open", summary="open Moments permissions"),
    ]


def open_accessibility() -> list[Step]:
    return [
        *open_general_settings(),
        trigger_visible("settings.general.accessibility.open", summary="open Accessibility"),
    ]


def open_wechat_sports_detail() -> list[Step]:
    return [
        *open_accessibility(),
        trigger_visible("settings.accessibility.wechatSports.open", summary="open WeChat Sports detail"),
    ]


def open_discover_item(item_id: str) -> list[Step]:
    return [
        *open_general_settings(),
        trigger_visible("settings.general.discover.open", summary="open Discover management"),
        trigger_param("settings.discover.item.open", "id", item_id, summary=f"open Discover item {item_id}"),
    ]


def open_profile_detail() -> list[Step]:
    return [
        trigger_visible("tab.me", summary="open Me tab"),
        trigger_visible("profile.detail.open", summary="open profile detail"),
    ]


def open_text_moment_form() -> list[Step]:
    return [
        trigger_visible("tab.discover", summary="open Discover tab"),
        trigger_visible("discover.moments.open", summary="open Moments"),
        long_press_at('[data-trigger="moments.post.open.longPress"]:visible', summary="long press Moments camera"),
        wait(0.3, summary="wait for text Moment form"),
    ]


def post_text_moment(content: str) -> list[Step]:
    return [
        *open_text_moment_form(),
        type_text(content, selector="textarea:visible", clear=True, summary=f"type Moment text {content!r}"),
        action_visible("moments.postText.submit", summary="submit text Moment"),
        wait(0.5, summary="wait for Moment publish"),
    ]


def post_text_moment_with_location(content: str, location_action: str) -> list[Step]:
    return [
        *open_text_moment_form(),
        type_text(content, selector="textarea:visible", clear=True, summary=f"type Moment text {content!r}"),
        trigger_visible("selectLocation.open", summary="open location picker"),
        action_visible(location_action, summary="select Moment location"),
        action_visible("moments.postText.submit", summary="submit text Moment with location"),
        wait(0.5, summary="wait for Moment publish"),
    ]


# ---------------------------------------------------------------------------
# Derived params — sampling-path compatibility
# ---------------------------------------------------------------------------
# Each calculator mirrors its task's judge (answer path / get_answer /
# check_goals in bench_env/task/wechat/tasks.py) through the same Wechat
# domain class over the same initial state, so the typed/asserted values are
# judge-homologous by construction.

def _wechat(state: dict[str, Any]) -> Wechat:
    """Judge-homologous accessor: ``Wechat(init_state["apps"]["wechat"])``."""
    return Wechat(state["apps"]["wechat"])


def _contact_wxid(task: Any, state: dict[str, Any]) -> str:
    """Declared {contact} name → wxid, via the domain lookup judges use.

    The Contacts rows are tagged ``userProfile.open`` with
    ``data-trigger-params = {"id": <wxid>}``, so the wxid gives an exact row
    selector (no fuzzy ``:has-text`` collisions)."""
    return _wechat(state).require_contact_wxid(str(task.p.contact))


def _contact_region(task: Any, state: dict[str, Any]) -> str:
    """Mirror ReadContactRegion.check_goals: ``find_contact(contact).region``."""
    contact = _wechat(state).find_contact(str(task.p.contact))
    return str((contact or {}).get("region", "") or "")


def _sports_action(task: Any, state: dict[str, Any]) -> str:
    """Enable vs disable submit on the WeChat Sports detail page.

    ``_invert_criteria`` seeds ``enabled = not {toggle}``, so the target
    direction is a pure function of the declared param."""
    direction = "enable" if task.p.toggle else "disable"
    return f"settings.accessibility.wechatSports.{direction}.submit"


DERIVED_PARAMS: dict[str, dict[str, Callable[[Any, dict[str, Any]], Any]]] = {
    "wechat.ToggleWechatSports": {"sports_action": _sports_action},
    "wechat.ReadMyWxid": {
        # Mirror AnswerTask answer = ".user.wxid" (resolved on apps_init).
        "answer": lambda task, state: _wechat(state).user_id,
    },
    "wechat.BlacklistContact": {"contact_wxid": _contact_wxid},
    "wechat.ReadContactRegion": {
        "contact_wxid": _contact_wxid,
        "answer": _contact_region,
    },
    "wechat.SetFriendChatOnly": {"contact_wxid": _contact_wxid},
    "wechat.StarAndRestrictFriend": {"contact_wxid": _contact_wxid},
    "wechat.ReadStepsLeaderboardTop": {
        # Mirror ReadStepsLeaderboardTop.get_answer: top_stepper()[0].
        "answer": lambda task, state: _wechat(state).top_stepper()[0],
    },
    "wechat.PostMomentFromChat": {
        # Mirror PostMomentFromChat.check_goals: last_received_text_from(contact).
        "moment_text": lambda task, state: _wechat(state).last_received_text_from(str(task.p.contact)),
    },
}


# ---------------------------------------------------------------------------
# Contact tasks — restricted Branch (contact row inside vs below the viewport)
# ---------------------------------------------------------------------------

def _rendered_contact_order(state: dict[str, Any]) -> list[str]:
    """Contact names in Contacts-tab render order — mirrors Contacts.tsx:
    non-blacklisted only, grouped by ``category`` (blank → '#'), groups
    sorted lexically, source order within a group."""
    groups: dict[str, list[str]] = {}
    for contact in _wechat(state).contacts:
        if not isinstance(contact, dict) or contact.get("isBlacklisted"):
            continue
        category = str(contact.get("category") or "").strip() or "#"
        groups.setdefault(category, []).append(str(contact.get("name") or ""))
    order: list[str] = []
    for category in sorted(groups):
        order.extend(groups[category])
    return order


# First N rendered contact rows reachable without scrolling on the 360x800
# viewport (4 utility rows + group headers above them). Live-calibrated:
# 刘浪 (index 5) was tappable without scrolling in the pre-migration suite.
_CONTACTS_VISIBLE_ROWS = 6


def _contact_visibility_pick(task: Any, state: dict[str, Any]) -> str:
    order = _rendered_contact_order(state)
    name = str(task.p.contact)
    if name not in order:
        raise ValueError(
            f"scripted contact pick: {name!r} not in the rendered Contacts "
            f"list {order}"
        )
    return "visible" if order.index(name) < _CONTACTS_VISIBLE_ROWS else "scrolled"


def _open_contact_profile_arm(*, scrolled: bool) -> list[Step]:
    """Contacts tab → (optional scroll to bottom) → tap the {contact} row.

    The scroll is two clamped full swipes (~400 css px each vs ~630 px max
    scroll), deterministically pinning the list to the bottom where every
    row from rendered index 5 on is in view."""
    steps: list[Step] = [trigger_visible("tab.contacts", summary="open Contacts tab")]
    if scrolled:
        steps += [
            swipe([500, 800], [500, 300], summary="scroll contact list to bottom 1/2"),
            swipe([500, 800], [500, 300], summary="scroll contact list to bottom 2/2"),
            wait(0.5, summary="wait for contact list to settle"),
        ]
    steps.append(
        click_selector(
            '[data-trigger="userProfile.open"][data-trigger-params*=\'"id":"{contact_wxid}"\']:visible',
            summary="open contact {contact} profile",
        )
    )
    return steps


def _contact_branch(rest: list[Step]) -> Branch:
    """visible/scrolled Branch: open the {contact} profile, then ``rest``."""
    return Branch(
        pick=_contact_visibility_pick,
        branches={
            "visible": [*_open_contact_profile_arm(scrolled=False), *rest],
            "scrolled": [*_open_contact_profile_arm(scrolled=True), *rest],
        },
    )


# ---------------------------------------------------------------------------
# wechat.ConditionalReplyToBoss — restricted Branch (keyword hit → reply)
# ---------------------------------------------------------------------------

def _boss_reply_pick(task: Any, state: dict[str, Any]) -> str:
    """Mirror ConditionalReplyToBoss.check_goals: expected reply is
    {yes_reply} iff {keyword} appears in Boss's initial received texts."""
    texts = _wechat(state).received_texts_from("Boss")
    keyword = str(task.p.keyword)
    return "yes" if any(keyword in text for text in texts) else "no"


def _boss_reply_arm(reply_placeholder: str) -> list[Step]:
    return [
        click_selector('[data-trigger="chat.open"]:has-text("Boss"):visible', summary="open Boss chat"),
        wait(0.3, summary="wait for Boss chat"),
        # Best-effort evidence gathering: scroll the history upward so the
        # older "{keyword}" region (buried above ~10 newer messages) enters
        # the viewport before replying.
        swipe([500, 300], [500, 780], summary="scroll Boss history up 1/3"),
        swipe([500, 300], [500, 780], summary="scroll Boss history up 2/3"),
        swipe([500, 300], [500, 780], summary="scroll Boss history up 3/3"),
        wait(0.3, summary="check history for {keyword}"),
        type_text(reply_placeholder, selector="textarea:visible", clear=True, summary="type conditional reply"),
        enter(summary="send conditional reply"),
        wait(0.3, summary="wait for message send"),
        complete(),
    ]


PLANS: dict[str, list[Step] | Branch] = {
    "wechat.OpenRadarAddFriend": [
        trigger_visible("home.menu.plus.open", summary="open plus menu"),
        trigger_visible("plusMenu.addFriend.open", summary="open Add Friend"),
        trigger_visible("addFriend.radar.open", summary="open Radar"),
        complete(),
    ],
    "wechat.OpenNewFriends": [
        trigger_visible("tab.contacts", summary="open Contacts tab"),
        trigger_visible("contacts.newFriends.open", summary="open New Friends"),
        complete(),
    ],
    "wechat.OpenBlacklist": [
        *open_friend_privacy(),
        trigger_visible("settings.privacy.blacklist.open", summary="open blacklist"),
        complete(),
    ],
    "wechat.ToggleFriendConfirmation": [
        *open_friend_privacy(),
        action_visible("settings.privacy.friendConfirmation.toggle", summary="toggle friend confirmation"),
        complete(),
    ],
    "wechat.ToggleWechatSports": [
        *open_wechat_sports_detail(),
        # {sports_action} derives enable vs disable from the {toggle} target.
        action_visible("{sports_action}", summary="set WeChat Sports to the target state"),
        complete(),
    ],
    "wechat.ToggleDiscoverEntry": [
        *open_discover_item("{entry}"),
        action_param("settings.discover.item.visible.toggle", "id", "{entry}", summary="toggle Discover entry visibility"),
        complete(),
    ],
    "wechat.ToggleMobileAutoPlayMomentsVideo": [
        *open_general_settings(),
        trigger_visible("settings.general.media.open", summary="open media settings"),
        action_visible("settings.general.media.mobileAutoPlay.toggle", summary="toggle mobile autoplay"),
        complete(),
    ],
    "wechat.SetAddMeSearch": [
        *open_add_me_methods(),
        action_visible("settings.privacy.addMe.searchByWxid.toggle", summary="enable WeChat ID search"),
        action_visible("settings.privacy.addMe.searchByPhone.toggle", summary="disable phone search"),
        complete(),
    ],
    "wechat.SetMomentsVisibleRange": [
        *open_moments_privacy(),
        trigger_visible("settings.privacy.moments.menu.range.open", summary="open Moments range picker"),
        # The four range rows share an id prefix and tag data-action-params
        # with the Chinese {range} value, so the declared param drives the
        # selection directly.
        click_selector(
            '[data-action^="settings.privacy.moments.range.select."]'
            '[data-action-params*=\'"range":"{range}"\']:visible',
            summary="choose Moments range {range}",
        ),
        complete(),
    ],
    "wechat.ToggleStrangerViewMoments": [
        *open_moments_privacy(),
        action_visible("settings.privacy.moments.strangerTen.toggle", summary="toggle stranger ten Moments"),
        complete(),
    ],
    "wechat.DisableWechatSportsLeaderboard": [
        *open_wechat_sports_detail(),
        action_visible("settings.accessibility.wechatSports.enable.submit", summary="enable WeChat Sports"),
        wait(0.3, summary="wait for enabled Sports detail"),
        trigger_visible("wechatSports.privacy.open", summary="open WeChat Sports privacy"),
        action_visible("wechatSports.privacy.joinLeaderboard.toggle", summary="disable leaderboard participation"),
        complete(),
    ],
    "wechat.EnableDarkMode": [
        *open_general_settings(),
        trigger_visible("settings.general.darkMode.open", summary="open dark mode settings"),
        action_visible("settings.general.darkMode.followSystem.toggle", summary="disable follow system"),
        action_visible("settings.general.darkMode.mode.select.dark", summary="select dark mode"),
        action_visible("settings.general.darkMode.submit", summary="save dark mode"),
        complete(),
    ],
    "wechat.SetPatText": [
        *open_profile_detail(),
        trigger_visible("profile.pat.open", summary="open Pat text"),
        type_text("{text}", selector="input:visible", clear=True, summary="enter Pat text"),
        action_visible("profile.pat.submit", summary="save Pat text"),
        complete(),
    ],
    "wechat.PostMomentsText": [
        *post_text_moment("{content}"),
        complete(),
    ],
    "wechat.PostMomentsTextWithCity": [
        # Exemption: {location} is sampler-less (always 北京市) and the
        # location rows carry no params tagging — see module docstring.
        *post_text_moment_with_location("{content}", "postMoment.location.select.beijing"),
        complete(),
    ],
    "wechat.ScenicPhotoToMomentsWithPhrase": [
        trigger_visible("tab.discover", summary="open Discover tab"),
        trigger_visible("discover.moments.open", summary="open Moments"),
        trigger_visible("moments.menu.camera.open", summary="open Moments camera menu"),
        trigger_visible("moments.post.open.fromAlbum", summary="open album picker"),
        wait(0.8, summary="wait for album images"),
        # Exemption: the alt fragment matches the pinned {_photo_path}
        # default — see module docstring.
        click_selector(
            'xpath=//img[contains(@alt, "wanshoushan")]/ancestor::div[contains(@class, "relative")][1]//button',
            summary="select scenic Wanshou Mountain album image",
        ),
        trigger_visible("moments.post.open.fromMediaPicker", summary="finish image selection"),
        type_text("{required_phrase}", selector="textarea:visible", clear=True, summary="type scenic Moment phrase"),
        action_visible("moments.post.submit", summary="submit image Moment"),
        wait(0.5, summary="wait for Moment publish"),
        complete(),
    ],
    "wechat.ReadMyWxid": [
        # Acquire the answer on-screen first: the Me tab renders "微信号: <wxid>".
        trigger_visible("tab.me", summary="open Me tab"),
        wait(0.3, summary="read my WeChat ID on Me page"),
        assert_answer("{answer}", summary="assert my WeChat ID on screen"),
        *grounded_answer("{answer}", summary="answer my WeChat ID"),
        complete(),
    ],
    "wechat.SetSignature": [
        *open_profile_detail(),
        trigger_visible("profile.signature.open", summary="open signature editor"),
        type_text("{text}", selector="input:visible", clear=True, summary="enter signature"),
        action_visible("profile.signature.submit", summary="save signature"),
        complete(),
    ],
    "wechat.BlacklistContact": _contact_branch([
        trigger_visible("friendSettings.open", summary="open friend settings"),
        trigger_visible("friendSettings.menu.blacklistConfirm.open", summary="open blacklist confirmation"),
        action_visible("friendSettings.menu.blacklistConfirm.submit", summary="confirm blacklist"),
        complete(),
    ]),
    "wechat.DeauthorizeApp": [
        *open_settings(),
        trigger_visible("settings.privacy.personal.open", summary="open personal info permissions"),
        trigger_visible("settings.privacy.authorization.open", summary="open authorization management"),
        auth_app_row("{app_name}"),
        trigger_visible("settings.privacy.authorization.menu.confirm.open", summary="open deauthorize confirmation"),
        action_visible("settings.privacy.authorization.menu.confirm.submit", summary="confirm deauthorize"),
        complete(),
    ],
    "wechat.ReadContactRegion": _contact_branch([
        # Acquire the answer on-screen first: the profile renders "地区: <region>".
        wait(0.3, summary="read contact region on profile"),
        assert_answer("{answer}", summary="assert contact region on screen"),
        *grounded_answer("{answer}", summary="answer contact region"),
        complete(),
    ]),
    "wechat.SetFriendChatOnly": _contact_branch([
        trigger_visible("friendInfo.open", summary="open friend info"),
        trigger_visible("friendPermissionsDetail.open", summary="open friend permissions detail"),
        action_visible("friendPermissionsDetail.permissionMode.select.chatOnly", summary="select Chat Only permission"),
        complete(),
    ]),
    "wechat.ReadStepsLeaderboardTop": [
        *open_wechat_sports_detail(),
        action_visible("settings.accessibility.wechatSports.enable.submit", summary="enable WeChat Sports"),
        wait(0.3, summary="wait for enabled Sports detail"),
        trigger_visible("wechatSports.open", summary="open WeChat Sports"),
        trigger_visible("wechatSports.leaderboard.open", summary="open leaderboard"),
        assert_answer("{answer}", summary="assert top stepper on leaderboard"),
        *grounded_answer("{answer}", summary="answer top stepper"),
        complete(),
    ],
    # Restricted Branch: pick mirrors the judge's keyword predicate over the
    # initial Boss history; each arm types the matching declared reply.
    "wechat.ConditionalReplyToBoss": Branch(
        pick=_boss_reply_pick,
        branches={
            "yes": _boss_reply_arm("{yes_reply}"),
            "no": _boss_reply_arm("{no_reply}"),
        },
    ),
    "wechat.PostMomentFromChat": [
        # Acquire the source message first: open the {contact} chat and read the
        # latest received text, then return to the chat list before posting.
        # (Opening ChatDetail writes no persistent state — the diff stays clean.)
        click_selector('[data-trigger="chat.open"]:has-text("{contact}"):visible', summary="open {contact} chat"),
        wait(0.3, summary="read the latest message from {contact}"),
        back(summary="return to chat list"),
        *post_text_moment("{moment_text}"),
        complete(),
    ],
    "wechat.StarAndRestrictFriend": _contact_branch([
        trigger_visible("friendSettings.open", summary="open friend settings"),
        action_visible("friendSettings.item.star.toggle", summary="star contact"),
        trigger_visible("friendPermissionsDetail.open", summary="open friend permissions"),
        action_visible("friendPermissionsDetail.item.hideMyMoments.toggle", summary="hide my Moments"),
        action_visible("friendPermissionsDetail.item.hideTheirMoments.toggle", summary="hide their Moments"),
        complete(),
    ]),
}
