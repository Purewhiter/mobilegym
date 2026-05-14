# -- Task Index (auto-generated, do not edit) --
# 16 tasks | L1×3  L2×5  L3×6  L4×2
#
# [L2] Reddit_DisableCommunityThemes                帮我在 Reddit 设置里关闭社区主题
# [L2] Reddit_AdvancedPrivacyToggles                帮我在 Reddit 设置里调整隐私选项，打开显示成人内容，关闭模糊成人图片，同时关闭社区主题
# [L4] Reddit_TurnOffMatureContentButKeepUnblurred  帮我在 Reddit 设置里关闭显示成人内容，并且保持不模糊成人媒体
# [L2] Reddit_OpenLinksOutsideApp                   帮我在 Reddit 设置里把链接打开方式改成用外部默认浏览器打开，不要在应用内打开
# [L2] Reddit_JoinCommunityFromFeed                 在 Reddit 首页动态里找到 {community} 社区的帖子，先加入这个社区，再给里面任意一条帖子点赞
# [L3] Reddit_UpvoteSpecificFeedPost                在 Reddit 首页动态里找到标题是 {post_title} 的帖子，给这条帖子点赞
# [L1] Reddit_CreatePostToCommunity                 帮我在 Reddit 向 {community} 社区发布一篇帖子，标题包含 {title}，内容包含 {body}
# [L3] Reddit_AddCommentToPost                      在 Reddit 打开标题为 {post_title} 的帖子，发表一条评论 {comment}
# [L3] Reddit_DeleteSeededOwnComment                在 Reddit 打开标题是 {post_title} 的帖子，把我刚才发的 {seed_comment} 这条评论删掉
# [L3] Reddit_SendChatMessage                       在 Reddit 聊天里，给用户 {username} 发送消息 {message}
# [L1] Reddit_DeleteSeededChatMessage               在 Reddit 聊天里打开和 {username} 的对话，把我发的 {seed_message} 这条消息删掉
# [L2] Reddit_UpvoteAnyComment                      在 Reddit 随便一个帖子的评论区，给任意一条评论点赞
# [L3] Reddit_EditSeededOwnComment                  在 Reddit 找到我之前发的 {seed_comment} 评论，把它修改成包含 {new_comment} 的内容
# [L1] Reddit_UpdateProfileBio                      帮我进入 Reddit 个人资料编辑页面，把个人简介改成包含 {bio} 的内容并保存
# [L3] Reddit_DeleteSeededOwnPost                   在 Reddit 个人主页里，把我之前发的标题是 {seed_title} 的帖子删掉
# [L4] Reddit_DeepThreadReplyAndDeleteSeedMessage   在 Reddit 聊天里打开和 {username} 的对话，找到对方发的 {thread_seed_message} 消息，在这条消息的子对话里回复包含 {reply} 的内容，然后回到聊天列表，删掉我之前发的 {delete_seed_message} 这条消息
# -- End Task Index --

from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import CriteriaTask
from bench_env.task.judge import JudgeInput
from bench_env.task.reddit.app import (
    REDDIT_COMMENT_DELETE_CHANGES,
    REDDIT_COMMENT_UPDATE_CHANGES,
    REDDIT_COMMENT_VOTE_CHANGES,
    REDDIT_CHAT_THREADS_CHANGES,
    REDDIT_DEEP_THREAD_REPLY_AND_DELETE_CHANGES,
    REDDIT_JOIN_AND_POST_VOTE_CHANGES,
    REDDIT_POST_DELETE_CHANGES,
    REDDIT_POST_VOTE_CHANGES,
    REDDIT_PROFILE_BIO_CHANGES,
    REDDIT_SETTINGS_CHANGES,
    REDDIT_COMMENT_CREATE_CHANGES,
    REDDIT_POST_CREATE_CHANGES,
    Reddit,
)


# =============================================================================
# Settings tasks (state-judge; UI must actually wire these toggles)
# =============================================================================


class Reddit_DisableCommunityThemes(CriteriaTask):
    templates = [
        "帮我在 Reddit 设置里关闭社区主题",
        "Go to Reddit settings and disable community themes",
    ]
    apps = ["reddit"]
    scope = "S1"
    objective = "operate"
    composition = "atomic"
    difficulty = "L2"
    capabilities = ["settings"]
    criteria = {"settings.showCommunityStyles": False}
    expected_changes = REDDIT_SETTINGS_CHANGES


class Reddit_AdvancedPrivacyToggles(CriteriaTask):
    """
    Hard multi-toggle task in Settings.

    Notes about current app implementation:
    - `blurNSFW` toggle is disabled unless `showNSFW` is enabled, so this task
      requires doing toggles in a specific order.
    """

    templates = [
        "帮我在 Reddit 设置里调整隐私选项，打开显示成人内容，关闭模糊成人图片，同时关闭社区主题",
        "Go to Reddit settings and adjust privacy options: enable Show Mature Content, disable Blur Mature Images, and disable Community Themes",
    ]
    apps = ["reddit"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings"]
    criteria = {
        "settings.showNSFW": True,
        "settings.blurNSFW": False,
        "settings.showCommunityStyles": False,
    }
    expected_changes = REDDIT_SETTINGS_CHANGES


class Reddit_TurnOffMatureContentButKeepUnblurred(CriteriaTask):
    """
    Harder order-dependent task:
    - First enable mature content to unlock blur toggle,
    - then disable blur,
    - then turn mature content back off.
    """

    templates = [
        "帮我在 Reddit 设置里关闭显示成人内容，并且保持不模糊成人媒体",
        "Go to Reddit settings, turn off Show Mature Content while keeping Blur Mature Media disabled",
    ]
    apps = ["reddit"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["settings", "reasoning"]
    criteria = {
        "settings.showNSFW": False,
        "settings.blurNSFW": False,
    }
    expected_changes = REDDIT_SETTINGS_CHANGES


class Reddit_OpenLinksOutsideApp(CriteriaTask):
    templates = [
        "帮我在 Reddit 设置里把链接打开方式改成用外部默认浏览器打开，不要在应用内打开",
        "Go to Reddit settings and change the link opening behavior to use the external default browser instead of opening links in-app",
    ]
    apps = ["reddit"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["settings"]
    criteria = {"settings.openLinksInApp": False}
    expected_changes = REDDIT_SETTINGS_CHANGES


# 说明：根据你的要求，设置类任务只保留 4 个最难的（需要顺序/依赖或明确 state 判定）。


# =============================================================================
# Feed & community tasks
# =============================================================================


class Reddit_JoinCommunityFromFeed(BaseTask):
    templates = [
        "在 Reddit 首页动态里找到 {community} 社区的帖子，先加入这个社区，再给里面任意一条帖子点赞",
    ]
    apps = ["reddit"]
    scope = "S1"
    objective = "operate"
    difficulty = "L2"
    composition = "sequential"
    capabilities = ["nav", "social"]
    expected_changes = REDDIT_JOIN_AND_POST_VOTE_CHANGES
    parameters = {
        "community": {
            "type": "string",
            "default": "r/memes",
            "description": "目标社区名（信息流里可见）",
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        reddit = Reddit(input.apps["reddit"], init=input.apps_init["reddit"])
        community = str(self.p.community).strip()
        return [
            reddit.check_joined_community(community),
            reddit.check_new_post_upvote_in_subreddit(community),
        ]


class Reddit_UpvoteSpecificFeedPost(BaseTask):
    templates = [
        "在 Reddit 首页动态里找到标题是 {post_title} 的帖子，给这条帖子点赞",
        "On the Reddit home feed, find the post titled {post_title} and upvote it",
    ]
    apps = ["reddit"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["nav", "social"]
    expected_changes = REDDIT_POST_VOTE_CHANGES
    parameters = {
        # Use a home-feed rank in the initial page (HomePage shows PAGE_SIZE=20 items first),
        # instead of relying on a specific title being visible.
        "post": {
            "sampler": Reddit.sample_home_feed_post_rank_15,
            # The sampler returns a dict; TaskSampler will flatten it into params when `fields` is present.
            "fields": {"post_id": "post_id", "post_title": "post_title", "feed_rank": "feed_rank"},
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        reddit = Reddit(input.apps["reddit"], init=input.apps_init["reddit"])
        return [reddit.check_new_post_upvote(str(self.p.post_id))]


# =============================================================================
# Create / profile content tasks
# =============================================================================


class Reddit_CreatePostToCommunity(BaseTask):
    templates = [
        "帮我在 Reddit 向 {community} 社区发布一篇帖子，标题包含 {title}，内容包含 {body}",
        "On Reddit, create a post in the {community} community with a title containing {title} and body containing {body}",
    ]
    apps = ["reddit"]
    scope = "S1"
    objective = "operate"
    difficulty = "L1"
    composition = "sequential"
    capabilities = ["nav", "create"]
    expected_changes = REDDIT_POST_CREATE_CHANGES
    parameters = {
        "community": {
            "type": "enum",
            "values": ["r/China_irl", "r/Games", "r/Music", "r/OtherSide"],
            "default": "r/China_irl",
            "description": "要发帖的社区（Create 页里选择）",
        },
        "title": {
            "type": "string",
            "default": "Bench post",
            "description": "帖子标题片段",
        },
        "body": {
            "type": "string",
            "default": "This is a benchmark post body",
            "description": "帖子正文片段",
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        reddit = Reddit(input.apps["reddit"], init=input.apps_init["reddit"])
        return [
            reddit.check_created_post(
                subreddit=str(self.p.community),
                title_contains=str(self.p.title),
                body_contains=str(self.p.body),
                field="reddit.posts(new)",
            )
        ]


# =============================================================================
# Comment tasks
# =============================================================================


class Reddit_AddCommentToPost(BaseTask):
    templates = [
        "在 Reddit 打开标题为 {post_title} 的帖子，发表一条评论 {comment}",
        "On Reddit, open the post titled {post_title} and leave a comment saying {comment}",
    ]
    apps = ["reddit"]
    scope = "S1"
    objective = "operate"
    difficulty = "L3"
    composition = "sequential"
    capabilities = ["nav", "social", "create"]
    expected_changes = REDDIT_COMMENT_CREATE_CHANGES
    parameters = {
        "post": {
            "sampler": Reddit.sample_fixture_post,
            "fields": {"post_id": "post_id", "post_title": "post_title"},
        },
        "comment": {
            "type": "string",
            "default": "Nice post!",
            "description": "评论内容片段",
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        reddit = Reddit(input.apps["reddit"], init=input.apps_init["reddit"])
        return [
            reddit.check_created_comment(
                str(self.p.post_id),
                str(self.p.comment),
            )
        ]


class Reddit_DeleteSeededOwnComment(BaseTask):
    templates = [
        "在 Reddit 打开标题是 {post_title} 的帖子，把我刚才发的 {seed_comment} 这条评论删掉",
        "On Reddit, open the post titled {post_title} and delete my comment that says {seed_comment}",
    ]
    apps = ["reddit"]
    scope = "S1"
    objective = "operate"
    difficulty = "L3"
    composition = "sequential"
    capabilities = ["nav", "delete", "social"]
    expected_changes = REDDIT_COMMENT_DELETE_CHANGES
    parameters = {
        # 这里的标题和评论都是 seed post 固定内容，用参数只是为了模板渲染友好。
        "post_title": {
            "type": "string",
            "default": "People who have tried Padel recently, what have you enjoyed the most about it to make you go back ?",
            "description": "种子帖子标题（用于描述）",
        },
        "seed_comment": {
            "type": "string",
            "default": "我也遇到过类似情况，先从每天提前 10 分钟开始会更容易坚持。",
            "description": "要删除的评论内容（seed post 内置）",
        },
    }

    async def _prepare(self, env: Any) -> None:
        state = await env.get_state()
        reddit = Reddit(state["apps"]["reddit"])
        seed_post_id = str(Reddit.fixture_post()["id"])
        seeded_id = "bench_seed_comment_delete_1"
        next_reddit = reddit.prepare_state_with_seeded_comment(
            seeded_id, seed_post_id, str(self.p.seed_comment),
        )
        await env.set_state({"apps": {"reddit": next_reddit}})

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        reddit = Reddit(input.apps["reddit"], init=input.apps_init["reddit"])
        return [reddit.check_deleted_comment("bench_seed_comment_delete_1")]


# =============================================================================
# Chat tasks
# =============================================================================


class Reddit_SendChatMessage(BaseTask):
    templates = [
        "在 Reddit 聊天里，给用户 {username} 发送消息 {message}",
        "In Reddit chat, send user {username} the message {message}",
    ]
    apps = ["reddit"]
    scope = "S1"
    objective = "operate"
    difficulty = "L3"
    composition = "sequential"
    capabilities = ["social", "create"]
    expected_changes = REDDIT_CHAT_THREADS_CHANGES
    parameters = {
        "username": {
            "type": "enum",
            "values": ["Objective-Skill-2591", "Intelligent_Drama_46"],
            "default": "Intelligent_Drama_46",
            "description": "聊天对象（Chats 列表里可见）",
        },
        "message": {
            "type": "string",
            "default": "hello from bench",
            "description": "发送内容片段",
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        reddit = Reddit(input.apps["reddit"], init=input.apps_init["reddit"])
        return [reddit.check_new_chat_message_to(str(self.p.username), str(self.p.message))]


class Reddit_DeleteSeededChatMessage(BaseTask):
    """删除指定聊天消息。通过 init state 中 from=me 的消息定位 ID，验证 current state 中已删除。"""

    templates = [
        "在 Reddit 聊天里打开和 {username} 的对话，把我发的 {seed_message} 这条消息删掉",
        "In Reddit chat, open the conversation with {username} and delete my message that says {seed_message}",
    ]
    apps = ["reddit"]
    scope = "S1"
    objective = "operate"
    difficulty = "L1"
    composition = "sequential"
    capabilities = ["nav", "delete", "social"]
    expected_changes = REDDIT_CHAT_THREADS_CHANGES
    parameters = {
        "username": {"type": "string", "default": "Objective-Skill-2591"},
        "seed_message": {"type": "string", "default": "我等下去把快递拿一下，晚点回你。", "description": "要删除的预置消息内容"},
        "_pair": {
            "sampler": Reddit.sample_deletable_chat_pair,
            "fields": {"username": "username", "seed_message": "seed_message"},
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        reddit = Reddit(input.apps["reddit"], init=input.apps_init["reddit"])
        msg = reddit.init.find_my_chat_message(self.p.username, self.p.seed_message)
        return [reddit.check_deleted_chat_message(self.p.username, msg["id"])]


class Reddit_UpvoteAnyComment(BaseTask):
    templates = [
        "在 Reddit 随便一个帖子的评论区，给任意一条评论点赞",
        "On Reddit, go to any post's comment section and upvote any comment",
    ]
    apps = ["reddit"]
    scope = "S1"
    objective = "operate"
    difficulty = "L2"
    composition = "sequential"
    capabilities = ["nav", "social"]
    expected_changes = REDDIT_COMMENT_VOTE_CHANGES

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        reddit = Reddit(input.apps["reddit"], init=input.apps_init["reddit"])
        return [reddit.check_new_comment_upvote()]


class Reddit_EditSeededOwnComment(BaseTask):
    templates = [
        "在 Reddit 找到我之前发的 {seed_comment} 评论，把它修改成包含 {new_comment} 的内容",
        "On Reddit, find my previous comment {seed_comment} and edit it to contain {new_comment}",
    ]
    apps = ["reddit"]
    scope = "S1"
    objective = "operate"
    difficulty = "L3"
    composition = "sequential"
    capabilities = ["nav", "edit"]
    expected_changes = REDDIT_COMMENT_UPDATE_CHANGES
    parameters = {
        "seed_comment": {"type": "string", "default": "补充一点：晚上早点放下手机真的有用。", "description": "要编辑的评论内容（seed post 内置）"},
        "new_comment": {
            "type": "string",
            "default": "我后来发现把早起目标拆成两步：先固定起床时间，再慢慢提前入睡，更容易坚持。",
            "description": "编辑后的内容片段（用于判定）",
        },
    }

    async def _prepare(self, env: Any) -> None:
        state = await env.get_state()
        reddit = Reddit(state["apps"]["reddit"])
        seed_post_id = str(Reddit.fixture_post()["id"])
        seeded_id = "bench_seed_comment_edit_1"
        next_reddit = reddit.prepare_state_with_seeded_comment(
            seeded_id,
            seed_post_id,
            str(self.p.seed_comment),
            created_utc=1710000002,
        )
        await env.set_state({"apps": {"reddit": next_reddit}})

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        reddit = Reddit(input.apps["reddit"], init=input.apps_init["reddit"])
        return [reddit.check_comment_body_contains("bench_seed_comment_edit_1", str(self.p.new_comment))]


class Reddit_UpdateProfileBio(BaseTask):
    templates = [
        "帮我进入 Reddit 个人资料编辑页面，把个人简介改成包含 {bio} 的内容并保存",
        "Go to Reddit's profile edit page, change my bio to contain {bio}, and save",
    ]
    apps = ["reddit"]
    scope = "S1"
    objective = "operate"
    difficulty = "L1"
    composition = "sequential"
    capabilities = ["nav", "edit"]
    expected_changes = REDDIT_PROFILE_BIO_CHANGES
    parameters = {
        "bio": {
            "type": "string",
            "default": "最近在学做家常川菜，也在练早起打卡。",
            "description": "新的 bio 片段（用于 state 判定）",
        }
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        reddit = Reddit(input.apps["reddit"], init=input.apps_init["reddit"])
        return [reddit.check_bio_contains(str(self.p.bio))]


class Reddit_DeleteSeededOwnPost(BaseTask):
    templates = [
        "在 Reddit 个人主页里，把我之前发的标题是 {seed_title} 的帖子删掉",
        "On Reddit's profile page, delete my post titled {seed_title}",
    ]
    apps = ["reddit"]
    scope = "S1"
    objective = "operate"
    difficulty = "L3"
    composition = "sequential"
    capabilities = ["nav", "edit"]
    expected_changes = REDDIT_POST_DELETE_CHANGES
    parameters = {"seed_title": {"type": "string", "default": "有没有人也会半夜突然想整理房间?"}}

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        reddit = Reddit(input.apps["reddit"], init=input.apps_init["reddit"])
        post = reddit.init.find_user_post_by_title(self.p.seed_title)
        return [reddit.check_deleted_post(post["id"])]


class Reddit_DeepThreadReplyAndDeleteSeedMessage(BaseTask):
    templates = [
        "在 Reddit 聊天里打开和 {username} 的对话，找到对方发的 {thread_seed_message} 消息，在这条消息的子对话里回复包含 {reply} 的内容，然后回到聊天列表，删掉我之前发的 {delete_seed_message} 这条消息",
    ]
    apps = ["reddit"]
    scope = "S1"
    objective = "operate"
    difficulty = "L4"
    composition = "sequential"
    capabilities = ["nav", "social", "create", "edit"]
    expected_changes = REDDIT_DEEP_THREAD_REPLY_AND_DELETE_CHANGES
    parameters = {
        "username": {"type": "enum", "values": ["Objective-Skill-2591"], "default": "Objective-Skill-2591"},
        "thread_seed_message": {
            "type": "string",
            "default": "你上次推荐的那家店我去了,味道确实不错!",
            "description": "用于定位 thread 的种子消息文本（来自对方）",
        },
        "delete_seed_message": {
            "type": "string",
            "default": "我等下去把快递拿一下,晚点回你。",
            "description": "用于定位要删除的种子消息文本（来自我）",
        },
        "reply": {
            "type": "string",
            "default": "哈哈同感！我也觉得他们家辣度刚刚好，下次一起去试试新菜。",
            "description": "thread 回复内容片段（用于判定）",
        },
        "_deep_thread_pair": {
            "sampler": Reddit.sample_deep_thread_reply_and_delete_pair,
            "fields": {
                "username": "username",
                "thread_source_message_id": "thread_source_message_id",
                "thread_seed_message": "thread_seed_message",
                "delete_message_id": "delete_message_id",
                "delete_seed_message": "delete_seed_message",
            },
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        reddit = Reddit(input.apps["reddit"], init=input.apps_init["reddit"])
        username = self.p.username
        source_message_id = self.params.get("thread_source_message_id")
        if not source_message_id:
            source_message_id = reddit.init.find_chat_message(username, self.p.thread_seed_message)["id"]
        delete_message_id = self.params.get("delete_message_id")
        if not delete_message_id:
            delete_message_id = reddit.init.find_my_chat_message(username, self.p.delete_seed_message)["id"]
        return [
            reddit.check_new_chat_reply(username, str(source_message_id), self.p.reply),
            reddit.check_deleted_chat_message(
                username, str(delete_message_id), field=f"chatThreads.{username}_seed_delete",
            ),
        ]
