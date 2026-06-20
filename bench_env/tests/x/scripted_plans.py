"""Scripted validation plans for X tasks."""

from __future__ import annotations

from bench_env.agent.scripted import Step, back, complete, swipe, tap_trigger, type_text, wait


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


def scroll_main_down(*, summary: str) -> Step:
    return swipe([500, 820], [500, 260], summary=summary)


def button_text(en: str, zh: str | None = None) -> str:
    if zh is None:
        return f'button:has-text("{en}"):visible'
    return f'button:has-text("{en}"):visible, button:has-text("{zh}"):visible'


def row_label(en: str, zh: str) -> str:
    return f'div.cursor-pointer:has-text("{en}"):visible, div.cursor-pointer:has-text("{zh}"):visible'


def row_label_occurrence(en: str, zh: str, occurrence: int) -> str:
    return (
        f':nth-match(div.cursor-pointer:has-text("{en}"):visible, {occurrence}), '
        f':nth-match(div.cursor-pointer:has-text("{zh}"):visible, {occurrence})'
    )


def click_row(en: str, zh: str, *, summary: str) -> Step:
    return click_selector(row_label(en, zh), summary=summary)


def switch_label(en: str, zh: str, *, occurrence: int = 1) -> str:
    return (
        f'xpath=(//*[normalize-space()="{en}" or normalize-space()="{zh}"]'
        '/ancestor::div[contains(@class,"justify-between")][1]//*[@role="switch"])'
        f'[{occurrence}]'
    )


def open_settings() -> list[Step]:
    return [
        tap_trigger("tab.home", summary="open X home tab"),
        wait(0.4, summary="wait for home"),
        trigger_visible("home.drawer.open", summary="open home drawer"),
        wait(0.3, summary="wait for drawer"),
        trigger_visible("settings.open", summary="open settings"),
        wait(0.5, summary="wait for settings page"),
    ]


def open_privacy() -> list[Step]:
    return [
        *open_settings(),
        click_row("Privacy and safety", "隐私和安全", summary="open privacy settings"),
        wait(0.4, summary="wait for privacy settings"),
    ]


def open_push_settings() -> list[Step]:
    return [
        *open_settings(),
        click_row("Notifications", "通知", summary="open notification settings"),
        wait(0.4, summary="wait for notification settings"),
        click_row("Preferences", "偏好设置", summary="open notification preferences"),
        wait(0.4, summary="wait for notification preferences"),
        trigger_visible("settings.notifications.preferences.push.open", summary="open push notification settings"),
        wait(0.4, summary="wait for push notification settings"),
    ]


def search_keyword(keyword: str) -> list[Step]:
    return [
        tap_trigger("tab.search", summary="open Search tab"),
        wait(0.4, summary="wait for search page"),
        trigger_visible("search.input.open", summary="open search input"),
        wait(0.3, summary="wait for search input"),
        type_text(keyword, selector='input[data-action="search.query.input"]:visible', clear=True, summary=f"search for {keyword}"),
        wait(0.8, summary="wait for search results"),
        back(summary="dismiss search keyboard"),
        wait(0.3, summary="wait after keyboard dismiss"),
    ]


def quote_or_repost(post_id: str, *, quote: bool) -> list[Step]:
    steps = [
        click_selector(action_param("home.foryou.post.retweet", "id", post_id), summary="open repost sheet"),
        wait(0.4, summary="wait for repost sheet"),
    ]
    if quote:
        steps.append(click_selector(button_text("Quote", "引用"), summary="choose quote"))
    else:
        steps.append(click_selector(button_text("Repost", "转帖"), summary="choose repost"))
    steps.append(wait(0.5, summary="wait after repost sheet choice"))
    return steps


PLANS: dict[str, list[Step]] = {
    "x.SetAudiencePrivacyBundle": [
        *open_privacy(),
        click_row("Audience and tagging", "受众和圈人", summary="open audience and tagging"),
        wait(0.4, summary="wait for audience settings"),
        click_selector(switch_label("Protect your posts", "将你的帖子设为私密"), summary="set protected posts target"),
        click_selector(switch_label("Protect your videos", "保护你的视频"), summary="set protected videos target"),
        click_selector(row_label("Photo tagging", "照片圈人"), summary="set photo tagging target"),
        complete(),
    ],
    "x.SetCallPermissionsBundle": [
        *open_privacy(),
        click_row("Direct Messages", "聊天", summary="open direct message settings"),
        wait(0.4, summary="wait for chat privacy settings"),
        click_selector(switch_label("Enable audio and video calls", "启用音频和视频通话"), summary="enable calls"),
        click_selector(row_label("People in your address book", "通讯录中的人"), summary="disable calls from address book"),
        click_selector(row_label("People you follow", "你关注的人"), summary="allow calls from following"),
        click_selector(row_label_occurrence("Verified users", "认证用户", 2), summary="allow calls from verified users"),
        complete(),
    ],
    "x.SetPushNotificationMix": [
        *open_push_settings(),
        click_selector(switch_label("Recommendations", "推荐", occurrence=1), summary="disable recommendation pushes"),
        swipe([500, 820], [500, 260], summary="scroll to From X and Pro sections"),
        click_selector(switch_label("Crisis and emergency alerts", "危机和紧急警报"), summary="enable emergency alerts"),
        click_selector(switch_label("Pro notifications", "专业版通知"), summary="enable pro notifications"),
        complete(),
    ],
    "x.QuotePostAndTweet": [
        *quote_or_repost("{post_id}", quote=True),
        type_text("{content}", selector='textarea[data-action="compose.content.input"]:visible', clear=True, summary="enter quote post content"),
        action_visible("compose.post.submit", summary="publish quote post"),
        wait(0.6, summary="wait after publishing quote"),
        complete(),
    ],
    "x.SendDmToConversation": [
        tap_trigger("tab.messages", summary="open Messages tab"),
        wait(0.4, summary="wait for messages list"),
        click_selector(trigger_param("messages.conversation.open", "id", "{conversation_id}"), summary="open target conversation"),
        wait(0.5, summary="wait for chat"),
        type_text("{content}", selector='input[data-action="chat.message.input"]:visible', clear=True, summary="enter DM content"),
        action_visible("chat.message.send", summary="send DM"),
        wait(0.4, summary="wait after sending DM"),
        complete(),
    ],
    "x.SearchAndBookmark": [
        *search_keyword("{keyword}"),
        scroll_main_down(summary="scroll Tesla result to its action bar"),
        click_selector(action_param("search.post.bookmark", "id", "p_1787883269146509518"), summary="bookmark visible Tesla search result"),
        complete(),
    ],
    "x.FollowUserAndLikeTheirPost": [
        click_selector(action_param("home.foryou.user.follow", "id", "yuyy614893671"), summary="follow target user"),
        click_selector(action_param("home.foryou.post.like", "id", "p_1879539450872778943"), summary="like target user's post"),
        complete(),
    ],
    "x.ReplyAndRetweetSamePost": [
        click_selector(trigger_param("reply.open", "id", "{post_id}"), summary="open reply composer"),
        wait(0.4, summary="wait for reply page"),
        type_text("{reply_content}", selector='textarea[data-action="reply.content.input"]:visible', clear=True, summary="enter reply content"),
        action_visible("reply.post.submit", summary="submit reply"),
        wait(0.6, summary="wait after reply submit"),
        *quote_or_repost("{post_id}", quote=False),
        complete(),
    ],
    "x.ComplexSettingsChain": [
        *open_settings(),
        click_row("Timeline", "时间线", summary="open timeline settings"),
        wait(0.3, summary="wait for timeline settings"),
        click_row("Post interactions", "帖子互动", summary="open post interaction settings"),
        wait(0.3, summary="wait for post interaction settings"),
        click_selector(switch_label("Show interaction counts", "显示互动量"), summary="enable interaction counts"),
        back(summary="return to timeline settings"),
        wait(0.2),
        back(summary="return to settings"),
        wait(0.3),
        click_row("Privacy and safety", "隐私和安全", summary="open privacy settings"),
        wait(0.3),
        click_row("Content you see", "你看到的内容", summary="open content-you-see settings"),
        wait(0.3),
        click_row("Explore settings", "探索设置", summary="open explore settings"),
        wait(0.3),
        click_selector(switch_label("Show content in your current location", "显示你当前所在位置的内容"), summary="disable local explore content"),
        back(summary="return to content-you-see settings"),
        wait(0.2),
        back(summary="return to privacy settings"),
        wait(0.2),
        click_row("Direct Messages", "聊天", summary="open direct message settings"),
        wait(0.3),
        click_selector(switch_label("Only enable push notifications for chats", "仅启用聊天的推送通知"), summary="enable chat-only push"),
        back(summary="return to privacy settings"),
        wait(0.2),
        back(summary="return to settings"),
        wait(0.3),
        click_row("Notifications", "通知", summary="open notification settings"),
        wait(0.3),
        click_row("Filters", "过滤器", summary="open notification filters"),
        wait(0.3),
        click_selector(switch_label("Only show important notifications", "仅显示重要通知"), summary="enable important-only notifications"),
        back(summary="return to notification settings"),
        wait(0.2),
        click_row("Preferences", "偏好设置", summary="open notification preferences"),
        wait(0.3),
        trigger_visible("settings.notifications.preferences.push.open", summary="open push notification settings"),
        wait(0.3),
        click_selector(switch_label("Recommendations", "推荐", occurrence=1), summary="disable recommendation pushes"),
        complete(),
    ],
    "x.SearchMultipleKeywordsAndInteract": [
        *search_keyword("{keyword1}"),
        click_selector(action_param("search.post.like", "id", "p5"), summary="like Grok search result"),
        type_text("{keyword2}", selector='input[data-action="search.query.input"]:visible', clear=True, summary="search for second keyword"),
        wait(0.8, summary="wait for second search results"),
        back(summary="dismiss search keyboard after second search"),
        wait(0.3, summary="wait after second keyboard dismiss"),
        click_selector(action_param("search.post.bookmark", "id", "p_1827711158754873444"), summary="bookmark visible Linux search result"),
        complete(),
    ],
    "x.PostWithImageAndReply": [
        trigger_visible("compose.open", summary="open compose"),
        wait(0.4, summary="wait for compose page"),
        type_text("{content}", selector='textarea[data-action="compose.content.input"]:visible', clear=True, summary="enter new post content"),
        action_visible("compose.post.submit", summary="publish new post"),
        wait(0.8, summary="wait for new post on timeline"),
        click_selector(
            'xpath=//*[contains(normalize-space(), "{content}")]/ancestor::div[contains(@class,"border-b")][1]//*[@data-trigger="reply.open"]',
            summary="open reply on newly created post",
        ),
        wait(0.4, summary="wait for reply composer"),
        type_text("{reply_content}", selector='textarea[data-action="reply.content.input"]:visible', clear=True, summary="enter self reply"),
        action_visible("reply.post.submit", summary="submit self reply"),
        wait(0.5, summary="wait after self reply"),
        complete(),
    ],
}
