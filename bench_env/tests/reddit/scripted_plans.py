"""Scripted validation plans for Reddit tasks."""

from __future__ import annotations

from bench_env.agent.scripted import (
    Step,
    back,
    complete,
    long_press_at,
    swipe,
    tap_trigger,
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


def button_text(text: str) -> str:
    return f'button:has-text("{text}"):visible'


def settings_row(en: str, zh: str) -> str:
    return (
        f'xpath=//*[normalize-space()="{en}" or normalize-space()="{zh}"]'
        '/ancestor::div[contains(@class,"justify-between")][1]'
    )


def open_profile() -> list[Step]:
    return [
        trigger_visible("profile.me.open", summary="open my Reddit profile"),
        wait(0.5, summary="wait for profile page"),
    ]


def open_settings() -> list[Step]:
    return [
        *open_profile(),
        click_selector('button[aria-label="More"]:visible', summary="open profile account menu"),
        wait(0.3, summary="wait for account menu"),
        trigger_visible("profile.settings.open", summary="open settings"),
        wait(0.5, summary="wait for settings page"),
    ]


def open_chat_thread(username: str) -> list[Step]:
    return [
        tap_trigger("tab.chat", summary="open Chat tab"),
        wait(0.5, summary="wait for chat list"),
        click_selector(trigger_param("chat.thread.open", "username", username), summary=f"open chat with {username}"),
        wait(0.5, summary="wait for chat thread"),
    ]


def open_post(post_id: str) -> list[Step]:
    return [
        click_selector(trigger_param("post.comments.open", "postId", post_id), summary=f"open post {post_id}"),
        wait(0.6, summary="wait for post comments"),
    ]


def open_seed_fixture_post() -> list[Step]:
    return open_post("post_1rfdbcx")


def scroll_feed(count: int, *, summary: str) -> list[Step]:
    return [swipe([500, 820], [500, 260], summary=f"{summary} {i + 1}/{count}") for i in range(count)]


def delete_chat_message(username: str, message_id: str) -> list[Step]:
    return [
        long_press_at(
            action_param("chatThread.message.longPress.open", "messageId", message_id),
            summary=f"long press chat message {message_id}",
        ),
        wait(0.5, summary="wait for message menu"),
        click_selector(action_param("chatThread.message.menu.delete", "messageId", message_id), summary="choose delete message"),
        wait(0.3, summary="wait for delete confirmation"),
        click_selector(button_text("Yes, Delete"), summary="confirm chat message deletion"),
        wait(0.5, summary="wait after deleting chat message"),
    ]


def open_own_comment_menu(comment_id: str) -> list[Step]:
    return [
        click_selector(action_param("postComments.item.more.open", "commentId", comment_id), summary=f"open comment menu {comment_id}"),
        wait(0.4, summary="wait for comment menu"),
    ]


PLANS: dict[str, list[Step]] = {
    "reddit.Reddit_DisableCommunityThemes": [
        *open_settings(),
        action_visible("settings.showCommunityStyles.toggle", summary="disable community themes"),
        complete(),
    ],
    "reddit.Reddit_AdvancedPrivacyToggles": [
        *open_settings(),
        action_visible("settings.showNSFW.toggle", summary="enable mature content"),
        wait(0.2, summary="wait after enabling mature content"),
        action_visible("settings.blurNSFW.toggle", summary="disable mature media blur"),
        action_visible("settings.showCommunityStyles.toggle", summary="disable community themes"),
        complete(),
    ],
    "reddit.Reddit_TurnOffMatureContentButKeepUnblurred": [
        *open_settings(),
        action_visible("settings.showNSFW.toggle", summary="enable mature content to unlock blur toggle"),
        wait(0.2, summary="wait after enabling mature content"),
        action_visible("settings.blurNSFW.toggle", summary="disable mature media blur"),
        wait(0.2, summary="wait after disabling blur"),
        action_visible("settings.showNSFW.toggle", summary="turn mature content back off"),
        complete(),
    ],
    "reddit.Reddit_OpenLinksOutsideApp": [
        *open_settings(),
        swipe([500, 820], [500, 260], summary="scroll to advanced settings"),
        swipe([500, 820], [500, 260], summary="scroll further to open links setting"),
        click_selector(settings_row("Open links", "打开链接"), summary="open links behavior sheet"),
        wait(0.3, summary="wait for open links sheet"),
        action_visible("settings.openLinks.select.defaultBrowser", summary="select external default browser"),
        complete(),
    ],
    "reddit.Reddit_JoinCommunityFromFeed": [
        *scroll_feed(7, summary="scroll feed to requested community"),
        wait(0.4, summary="wait after scrolling feed to requested community"),
        click_selector(action_param("homeFeed.item.join.toggle", "communityId", "{community}"), summary="join requested community from feed"),
        click_selector(action_param("homeFeed.item.vote.select.up", "postId", "post_1rf7b40"), summary="upvote a post in requested community"),
        complete(),
    ],
    "reddit.Reddit_UpvoteSpecificFeedPost": [
        *scroll_feed(9, summary="scroll feed toward requested post"),
        wait(0.4, summary="wait after scrolling feed to requested post"),
        click_selector(action_param("homeFeed.item.vote.select.up", "postId", "{post_id}"), summary="upvote requested feed post"),
        complete(),
    ],
    "reddit.Reddit_CreatePostToCommunity": [
        tap_trigger("tab.create", summary="open create post"),
        wait(0.4, summary="wait for create page"),
        trigger_visible("create.community.open", summary="open community picker"),
        wait(0.4, summary="wait for community picker"),
        click_selector(button_text("{community}"), summary="select target community"),
        wait(0.4, summary="return to create page"),
        type_text("{title}", selector='input[placeholder="Title"]:visible', clear=True, summary="enter post title"),
        type_text("{body}", selector="textarea:visible", clear=True, summary="enter post body"),
        click_selector(button_text("Post"), summary="submit new post"),
        wait(0.6, summary="wait for post creation"),
        complete(),
    ],
    "reddit.Reddit_AddCommentToPost": [
        *open_post("{post_id}"),
        type_text("{comment}", selector='input[placeholder="Join the conversation"]:visible', clear=True, summary="enter new comment"),
        action_visible("postComments.comment.submit", summary="submit new comment"),
        wait(0.5, summary="wait after comment submission"),
        complete(),
    ],
    "reddit.Reddit_DeleteSeededOwnComment": [
        *open_seed_fixture_post(),
        *open_own_comment_menu("bench_seed_comment_delete_1"),
        click_selector(button_text("Delete"), summary="choose delete comment"),
        wait(0.3, summary="wait for delete comment confirmation"),
        click_selector(button_text("Delete"), summary="confirm comment deletion"),
        wait(0.5, summary="wait after deleting comment"),
        complete(),
    ],
    "reddit.Reddit_SendChatMessage": [
        *open_chat_thread("{username}"),
        type_text("{message}", selector='textarea[placeholder="Message"]:visible', clear=True, summary="enter chat message"),
        action_visible("chatThread.message.submit", summary="send chat message"),
        wait(0.5, summary="wait after sending chat message"),
        complete(),
    ],
    "reddit.Reddit_DeleteSeededChatMessage": [
        *open_chat_thread("{username}"),
        *delete_chat_message("{username}", "{message_id}"),
        complete(),
    ],
    "reddit.Reddit_UpvoteAnyComment": [
        *open_post("post_1rev3pa"),
        click_selector(action_param("postComments.item.vote.select.up", "commentId", "o7ftmd0"), summary="upvote first visible comment"),
        complete(),
    ],
    "reddit.Reddit_EditSeededOwnComment": [
        *open_seed_fixture_post(),
        *open_own_comment_menu("bench_seed_comment_edit_1"),
        click_selector(button_text("Edit"), summary="open edit comment page"),
        wait(0.4, summary="wait for edit comment page"),
        type_text("{new_comment}", selector="textarea:visible", clear=True, summary="replace seeded comment body"),
        action_visible("commentEdit.post.submit", summary="save edited comment"),
        wait(0.5, summary="wait after saving edited comment"),
        complete(),
    ],
    "reddit.Reddit_UpdateProfileBio": [
        *open_profile(),
        trigger_visible("profile.edit.open", summary="open profile editor"),
        wait(0.5, summary="wait for edit profile page"),
        type_text("{bio}", selector="textarea:visible", clear=True, summary="enter profile bio"),
        action_visible("editProfile.save.submit", summary="save profile bio"),
        wait(0.5, summary="wait after saving profile"),
        complete(),
    ],
    "reddit.Reddit_DeleteSeededOwnPost": [
        *open_profile(),
        click_selector(
            'xpath=//*[normalize-space()="{seed_title}"]/ancestor::div[contains(@class,"py-3")][1]//button[@aria-label="Post menu"]',
            summary="open own post menu",
        ),
        wait(0.4, summary="wait for own post menu"),
        click_selector(button_text("Delete"), summary="choose delete post"),
        wait(0.3, summary="wait for post delete confirmation"),
        click_selector(button_text("Delete"), summary="confirm post deletion"),
        wait(0.5, summary="wait after deleting own post"),
        complete(),
    ],
    "reddit.Reddit_DeepThreadReplyAndDeleteSeedMessage": [
        *open_chat_thread("{username}"),
        click_selector(
            trigger_param("chatThread.message.thread.open", "messageId", "{thread_source_message_id}"),
            summary="open message thread",
        ),
        wait(0.5, summary="wait for message thread"),
        type_text("{reply}", selector='input[placeholder="Reply"]:visible', clear=True, summary="enter thread reply"),
        action_visible("chatThread.reply.submit", summary="send thread reply"),
        wait(0.5, summary="wait after thread reply"),
        back(summary="dismiss keyboard after reply (consumes the first back)"),
        wait(0.3, summary="wait for keyboard dismiss"),
        back(summary="return from thread to chat"),
        wait(0.4, summary="wait for chat thread"),
        back(summary="return to chat list"),
        wait(0.4, summary="wait for chat list"),
        click_selector(trigger_param("chat.thread.open", "username", "{username}"), summary="re-open chat for deletion"),
        wait(0.5, summary="wait for chat thread"),
        *delete_chat_message("{username}", "{delete_message_id}"),
        complete(),
    ],
}
