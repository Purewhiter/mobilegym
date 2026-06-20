"""Scripted validation plans for WeChat tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
    complete,
    enter,
    grounded_answer,
    long_press_at,
    type_text,
    wait,
)


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


def contact_row(name: str, *, summary: str | None = None) -> Step:
    return click_selector(
        f'[data-trigger="userProfile.open"]:has-text("{name}"):visible',
        summary=summary or f"open contact {name}",
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


def open_contact_profile(name: str) -> list[Step]:
    return [
        trigger_visible("tab.contacts", summary="open Contacts tab"),
        contact_row(name),
    ]


def open_contact_settings(name: str) -> list[Step]:
    return [
        *open_contact_profile(name),
        trigger_visible("friendSettings.open", summary="open friend settings"),
    ]


def open_contact_permissions_from_profile(name: str) -> list[Step]:
    return [
        *open_contact_profile(name),
        trigger_visible("friendInfo.open", summary="open friend info"),
        trigger_visible("friendPermissionsDetail.open", summary="open friend permissions detail"),
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


PLANS: dict[str, list[Step]] = {
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
        action_visible("settings.accessibility.wechatSports.enable.submit", summary="enable WeChat Sports"),
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
        action_visible("settings.privacy.moments.range.select.recentHalfYear", summary="choose recent half year"),
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
        *post_text_moment_with_location("{content}", "postMoment.location.select.beijing"),
        complete(),
    ],
    "wechat.ScenicPhotoToMomentsWithPhrase": [
        trigger_visible("tab.discover", summary="open Discover tab"),
        trigger_visible("discover.moments.open", summary="open Moments"),
        trigger_visible("moments.menu.camera.open", summary="open Moments camera menu"),
        trigger_visible("moments.post.open.fromAlbum", summary="open album picker"),
        wait(0.8, summary="wait for album images"),
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
        *grounded_answer("xiaoming001", summary="answer my WeChat ID"),
        complete(),
    ],
    "wechat.SetSignature": [
        *open_profile_detail(),
        trigger_visible("profile.signature.open", summary="open signature editor"),
        type_text("{text}", selector="input:visible", clear=True, summary="enter signature"),
        action_visible("profile.signature.submit", summary="save signature"),
        complete(),
    ],
    "wechat.BlacklistContact": [
        *open_contact_settings("{contact}"),
        trigger_visible("friendSettings.menu.blacklistConfirm.open", summary="open blacklist confirmation"),
        action_visible("friendSettings.menu.blacklistConfirm.submit", summary="confirm blacklist"),
        complete(),
    ],
    "wechat.DeauthorizeApp": [
        *open_settings(),
        trigger_visible("settings.privacy.personal.open", summary="open personal info permissions"),
        trigger_visible("settings.privacy.authorization.open", summary="open authorization management"),
        auth_app_row("{app_name}"),
        trigger_visible("settings.privacy.authorization.menu.confirm.open", summary="open deauthorize confirmation"),
        action_visible("settings.privacy.authorization.menu.confirm.submit", summary="confirm deauthorize"),
        complete(),
    ],
    "wechat.ReadContactRegion": [
        *grounded_answer("马达加斯加", summary="answer contact region"),
        complete(),
    ],
    "wechat.SetFriendChatOnly": [
        *open_contact_permissions_from_profile("{contact}"),
        action_visible("friendPermissionsDetail.permissionMode.select.chatOnly", summary="select Chat Only permission"),
        complete(),
    ],
    "wechat.ReadStepsLeaderboardTop": [
        *open_wechat_sports_detail(),
        action_visible("settings.accessibility.wechatSports.enable.submit", summary="enable WeChat Sports"),
        wait(0.3, summary="wait for enabled Sports detail"),
        trigger_visible("wechatSports.open", summary="open WeChat Sports"),
        trigger_visible("wechatSports.leaderboard.open", summary="open leaderboard"),
        *grounded_answer("赵敏", summary="answer top stepper"),
        complete(),
    ],
    "wechat.ConditionalReplyToBoss": [
        click_selector('[data-trigger="chat.open"]:has-text("Boss"):visible', summary="open Boss chat"),
        type_text("{yes_reply}", selector="textarea:visible", clear=True, summary="type conditional reply"),
        enter(summary="send conditional reply"),
        wait(0.3, summary="wait for message send"),
        complete(),
    ],
    "wechat.PostMomentFromChat": [
        *post_text_moment("明天一起去吃火锅吗？"),
        complete(),
    ],
    "wechat.StarAndRestrictFriend": [
        *open_contact_settings("{contact}"),
        action_visible("friendSettings.item.star.toggle", summary="star contact"),
        trigger_visible("friendPermissionsDetail.open", summary="open friend permissions"),
        action_visible("friendPermissionsDetail.item.hideMyMoments.toggle", summary="hide my Moments"),
        action_visible("friendPermissionsDetail.item.hideTheirMoments.toggle", summary="hide their Moments"),
        complete(),
    ],
}
