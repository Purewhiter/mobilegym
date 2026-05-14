# -- Task Index (auto-generated, do not edit) --
# 11 tasks | L1×4  L2×3  L3×2  L4×2
#
# [L3] SetAudiencePrivacyBundle           我想改一下X的隐私设置：帖子私密{private_posts}，视频保护{protect_videos}，照片圈人{photo_tagging}
# [L1] SetCallPermissionsBundle           我想在X设置里打开音视频通话，只让我关注的人和认证用户能打给我，不让通讯录里的人打过来
# [L3] SetPushNotificationMix             我想改改X的推送，把推荐推送关掉，保留紧急警报和专业版相关的通知
# [L4] QuotePostAndTweet                  我想找到{author_handle}发的那条带「{post_preview}」的推文，引用它再发一条新推文，内容是「{content}」
# [L1] SendDmToConversation               我想在X私信里找到和{participant_handle}的聊天框，发一句「{content}」
# [L2] SearchAndBookmark                  我想在X搜「{keyword}」，从结果里找一条相关推文收藏
# [L1] FollowUserAndLikeTheirPost         我想在X上关注{user_handle}（{user_name}），再给TA发的随便一条推文点个赞
# [L2] ReplyAndRetweetSamePost            我想找到{author_handle}发的有「{post_preview}」的推文，先评论「{reply_content}」，再把这条推文转发出去
# [L2] ComplexSettingsChain               帮我统一调一下X的几个设置：帖子互动显示互动量，关闭探索页里“显示你当前所在位置的内容”，过滤器打开只留重要通知，只启用聊天推送，再把推送通知里的“推荐”关掉
# [L4] SearchMultipleKeywordsAndInteract  我想先在X搜「{keyword1}」，给一条相关推文点赞，再搜「{keyword2}」，把一条相关推文收藏起来
# [L1] PostWithImageAndReply              我想在X发一条推文说「{content}」，再给自己这条推文回复一句「{reply_content}」
# -- End Task Index --

from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import CriteriaTask
from bench_env.task.judge import JudgeInput
from bench_env.task.x.app import X


# ============================================================
# Settings (high-pressure, multi-toggle) tasks
# ============================================================


class SetAudiencePrivacyBundle(CriteriaTask):
    templates = [
        "我想改一下X的隐私设置：帖子私密{private_posts}，视频保护{protect_videos}，照片圈人{photo_tagging}",
        "帮我改一下X的隐私设置，帖子私密{private_posts}，视频保护{protect_videos}，照片圈人{photo_tagging}",
    ]
    apps = ["x"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["nav", "settings"]

    async def _post_sample(self, env: Any) -> None:
        await self._invert_criteria(env)

    parameters = {
        "private_posts": {"type": "bool", "default": True, "description": "是否将帖子设为私密"},
        "protect_videos": {"type": "bool", "default": True, "description": "是否保护新视频不可下载"},
        "photo_tagging": {"type": "bool", "default": False, "description": "是否开启照片圈人"},
    }
    criteria = {
        "settings.privatePosts": "{private_posts}",
        "settings.protectVideos": "{protect_videos}",
        "settings.photoTagging": "{photo_tagging}",
    }
class SetCallPermissionsBundle(CriteriaTask):
    templates = [
        "我想在X设置里打开音视频通话，只让我关注的人和认证用户能打给我，不让通讯录里的人打过来",
        "帮我设置下X的音视频通话，开启通话功能，来电只接受关注的人和认证用户，通讯录里的人不行",
        "I want to enable audio/video calls on X, only allow people I follow and verified users to call me, and block calls from call log contacts",
        "Help me set up X's audio/video calls: enable calls, only accept from followed and verified users, disallow calls from call log contacts",
    ]
    apps = ["x"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["nav", "settings"]

    async def _post_sample(self, env: Any) -> None:
        await self._invert_criteria(env)

    criteria = {
        "settings.enableAvCalls": True,
        "settings.allowCallFromFollowing": True,
        "settings.allowCallFromVerified": True,
        "settings.allowCallFromLogs": False,
    }


class SetPushNotificationMix(CriteriaTask):
    templates = [
        "我想改改X的推送，把推荐推送关掉，保留紧急警报和专业版相关的通知",
        "帮我修改下X的推送设置，推荐关掉，但紧急警报和专业版通知要保留",
        "I want to change X's push notifications: turn off recommendation pushes, keep only emergency alerts and professional-related notifications",
        "Help me adjust X's push settings: disable recommended content, but keep emergency alerts and Pro notifications",
    ]
    apps = ["x"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["nav", "settings"]

    async def _post_sample(self, env: Any) -> None:
        await self._invert_criteria(env)

    # UI 上 SettingsNotificationPushPage 有两个标签都叫"推荐":
    #   - section1 顶部 (推送偏好): prefRecommend  ← criteria 要求的目标
    #   - section2 "来自 X":         fromXRecommend ← 允许同时被关, 不警告
    # 任务文案"推荐推送关掉"在 UI 上 ambiguous, 接受用户关其中一个或两个都通过。
    expected_changes = ["apps.x.settings.fromXRecommend"]
    criteria = {
        "settings.prefRecommend": False,
        "settings.fromXAlert": True,
        "settings.proNotify": True,
    }
    

# ============================================================
# Content / interaction tasks (state-judged, higher difficulty)
# ============================================================


class QuotePostAndTweet(BaseTask):
    templates = [
        "我想找到{author_handle}发的那条带「{post_preview}」的推文，引用它再发一条新推文，内容是「{content}」",
        "帮我在X上找到{author_handle}那条有「{post_preview}」的推文，引用转发它，写一条「{content}」",
        "麻烦在X里定位到{author_handle}发的带「{post_preview}」的推文，引用这条推文发一条「{content}」",
    ]
    apps = ["x"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["search", "social", "create"]
    parameters = {
        "_target_post": {
            "sampler": X.sample_post_reference,
            "fields": {
                "post_id": "post_id",
                "author_handle": "author_handle",
                "post_preview": "post_preview",
            },
        },
        "post_id": {
            "type": "string",
            "description": "被引用推文的 id（从环境中采样）",
            "default": "",
        },
        "author_handle": {
            "type": "string",
            "description": "被引用推文作者的用户名（如 @xxxx）",
            "default": "@unknown",
        },
        "post_preview": {
            "type": "string",
            "description": "被引用推文内容摘要，方便在 UI 中定位目标",
            "default": "示例内容",
        },
        "content": {
            "type": "string",
            "default": "Quoting this post for testing.",
            "description": "推文内容",
        },
    }
    expected_changes = ["apps.x.posts", "apps.x.user.postIds[+1]"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        post_id = str(self.p.post_id or "").strip()
        if not post_id:
            raise RuntimeError("任务设计错误：未能从 X base dataset 采样到 post_id")

        if not str(self.p.content or "").strip():
            raise RuntimeError("任务设计错误：content 不能为空")

        app = X(input.apps["x"], init=input.apps_init["x"])
        return [app.check_created_quoted_post(self.p.post_id, self.p.content)]


class SendDmToConversation(BaseTask):
    templates = [
        "我想在X私信里找到和{participant_handle}的聊天框，发一句「{content}」",
    ]
    apps = ["x"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L1"
    capabilities = ["social", "create"]
    parameters = {
        "_target_conversation": {
            "sampler": X.sample_conversation_reference,
            "fields": {
                "conversation_id": "conversation_id",
                "participant_handle": "participant_handle",
                "last_message_preview": "last_message_preview",
            },
        },
        "conversation_id": {
            "type": "string",
            "description": "对话 id（从环境中采样）",
            "default": "",
        },
        "participant_handle": {
            "type": "string",
            "description": "对话对象的用户名（如 @waylybaye）",
            "default": "@unknown",
        },
        "last_message_preview": {
            "type": "string",
            "description": "该对话最近一条消息的内容摘要，方便在列表中定位",
            "default": "示例消息",
        },
        "content": {
            "type": "string",
            "default": "Hello from benchmark.",
            "description": "私信内容",
        },
    }
    expected_changes = ["apps.x.conversations[id={conversation_id}]"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        if not str(self.p.conversation_id or "").strip():
            raise RuntimeError("任务设计错误：未能从 apps.x.conversations 采样到 conversation_id")
        if not str(self.p.content or "").strip():
            raise RuntimeError("任务设计错误：content 不能为空")
        app = X(input.apps["x"], init=input.apps_init["x"])
        return [app.check_sent_dm(self.p.conversation_id, self.p.content)]


class SearchAndBookmark(BaseTask):
    templates = [
        "我想在X搜「{keyword}」，从结果里找一条相关推文收藏",
    ]
    apps = ["x"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["search", "social"]
    parameters = {
        "keyword": {
            "type": "enum",
            "values": ["Tesla", "Claude", "Grok", "Linux", "privacy"],
            "default": "Tesla",
            "description": "搜索关键字（硬编码候选词）",
        },
    }
    expected_changes = ["apps.x.user.bookmarkedPostIds[+1]"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        if not str(self.p.keyword or "").strip():
            raise RuntimeError("任务设计错误：keyword 不能为空")
        app = X(input.apps["x"], init=input.apps_init["x"])
        return [app.check_bookmarked_post_for_keyword(self.p.keyword)]


# ============================================================
# Advanced multi-step tasks (L4, high pressure)
# ============================================================


class FollowUserAndLikeTheirPost(BaseTask):
    """
    多步骤任务：先关注一个用户，再点赞该用户的推文。
    考验 Agent 的多步骤规划和状态追踪能力。
    模板用 @handle 给 Agent 做 UI 定位；judge 内部把 handle 解析为精确 user.id 后比对。
    """
    templates = [
        "我想在X上关注{user_handle}（{user_name}），再给TA发的随便一条推文点个赞",
        "帮我先关注X上的{user_handle}（{user_name}），再从TA的推文里挑一条点个赞",
    ]
    apps = ["x"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["social", "search"]
    parameters = {
        "_target_user": {
            "sampler": X.sample_follow_target,
            "fields": {
                "user_handle": "user_handle",
                "user_name": "user_name",
            },
        },
        "user_handle": {
            "type": "string",
            "default": "",
        },
        "user_name": {
            "type": "string",
            "default": "某位用户",
        },
    }
    expected_changes = [
        "apps.x.user.followedUserIds[+1]",
        "apps.x.user.likedPostIds[+1]",
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        if not str(self.p.user_handle or "").strip():
            raise RuntimeError("任务设计错误：未能从 posts 采样到未关注的作者 user_handle")
        app = X(input.apps["x"], init=input.apps_init["x"])
        return [
            app.check_followed_user(self.p.user_handle),
            app.check_liked_post_by_user(self.p.user_handle),
        ]


class ReplyAndRetweetSamePost(BaseTask):
    """
    多步骤任务：先回复一条推文，再转帖同一条推文。
    考验 Agent 的多步骤操作和状态管理。
    """
    templates = [
        "我想找到{author_handle}发的有「{post_preview}」的推文，先评论「{reply_content}」，再把这条推文转发出去",
        "帮我在X上找到{author_handle}那条有「{post_preview}」的推文，回复一句「{reply_content}」，然后转发这条推文",
    ]
    apps = ["x"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["social", "create"]
    parameters = {
        "_target_post": {
            "sampler": X.sample_unretweeted_post_reference,
            "fields": {
                "post_id": "post_id",
                "author_handle": "author_handle",
                "post_preview": "post_preview",
            },
        },
        "post_id": {
            "type": "string",
            "description": "目标推文 id（从环境中采样，排除已转帖）",
            "default": "",
        },
        "author_handle": {
            "type": "string",
            "description": "目标推文作者用户名",
            "default": "@unknown",
        },
        "post_preview": {
            "type": "string",
            "description": "目标推文内容摘要",
            "default": "示例内容",
        },
        "reply_content": {
            "type": "string",
            "default": "Great post!",
            "description": "回复内容",
        },
    }
    expected_changes = [
        "apps.x.posts",
        "apps.x.user.replyIds[+1]",
        "apps.x.user.retweetedPostIds[+1]",
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        if not str(self.p.post_id or "").strip():
            raise RuntimeError("任务设计错误：未能从 X base dataset 采样到 post_id")
        if not str(self.p.reply_content or "").strip():
            raise RuntimeError("任务设计错误：reply_content 不能为空")
        app = X(input.apps["x"], init=input.apps_init["x"])
        return [
            app.check_replied_to_post(self.p.post_id, self.p.reply_content),
            app.check_retweeted_post(self.p.post_id),
        ]


class ComplexSettingsChain(CriteriaTask):
    """
    超高难度：需要在设置中修改 5 个不同的开关，跨越多个设置页面。
    考验 Agent 的深度导航和多步骤设置修改能力。
    """

    async def _post_sample(self, env: Any) -> None:
        await self._invert_criteria(env)

    templates = [
        "帮我统一调一下X的几个设置：帖子互动显示互动量，关闭探索页里“显示你当前所在位置的内容”，过滤器打开只留重要通知，只启用聊天推送，再把推送通知里的“推荐”关掉",
        "我想统一调下X的设置：开启显示互动量，关掉探索页里的“显示你当前所在位置的内容”，过滤器打开只留重要通知，聊天只启用聊天推送，推送通知里的“推荐”也关掉",
        "Help me change a few X settings: show interaction counts for post interactions, turn off 'Show content in your current location' in Explore, set the notification filter to important only, enable push for chats only, and turn off 'Recommendations' in push notifications",
        "I want to adjust X's settings: enable show interaction counts, disable 'Show content in your current location' in Explore, set the filter to important notifications only, enable chat-only push, and turn off 'Recommendations' in push notifications",
    ]
    apps = ["x"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["nav", "settings", "explore"]
    # 与 SetPushNotificationMix 同一对 ambiguous 字段: prefRecommend 是 criteria 目标,
    # fromXRecommend 进 allowlist (允许用户同时关掉, 不警告)。
    expected_changes = ["apps.x.settings.fromXRecommend"]
    criteria = {
        "settings.showInteractionCounts": True,
        "settings.showLocalContent": False,
        "settings.onlyImportant": True,
        "settings.pushOnlyDm": True,
        "settings.prefRecommend": False,
    }


class SearchMultipleKeywordsAndInteract(BaseTask):
    """
    多步骤搜索任务：搜索多个关键字，在每个搜索结果中执行不同的交互。
    考验 Agent 的搜索能力和多次交互的状态管理。
    """
    templates = [
        "我想先在X搜「{keyword1}」，给一条相关推文点赞，再搜「{keyword2}」，把一条相关推文收藏起来",
        "帮我在X上先搜「{keyword1}」点赞一条相关推文，再搜「{keyword2}」收藏一条相关推文",
        'I want to search for "{keyword1}" on X and like a related post, then search for "{keyword2}" and bookmark a related post',
        'Help me search for "{keyword1}" on X and like a related post, then search for "{keyword2}" and bookmark a related post',
    ]
    apps = ["x"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["search", "social"]
    parameters = {
        "keyword1": {
            "type": "enum",
            "values": ["Tesla", "Claude", "Grok"],
            "default": "Tesla",
            "description": "第一个搜索关键字（硬编码候选词）",
        },
        "keyword2": {
            "type": "enum",
            "values": ["Linux", "privacy", "Travel"],
            "default": "Linux",
            "description": "第二个搜索关键字（硬编码候选词，与 keyword1 取自不同候选集）",
        },
    }
    expected_changes = [
        "apps.x.user.likedPostIds[+1]",
        "apps.x.user.bookmarkedPostIds[+1]",
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        app = X(input.apps["x"], init=input.apps_init["x"])
        return [
            app.check_liked_post_for_keyword(self.p.keyword1),
            app.check_bookmarked_post_for_keyword(self.p.keyword2),
        ]


class PostWithImageAndReply(BaseTask):
    """
    内容创建任务：发布一条推文，然后回复自己的推文。
    考验 Agent 的内容创建和自我交互能力。
    """
    templates = [
        "我想在X发一条推文说「{content}」，再给自己这条推文回复一句「{reply_content}」",
        "帮我在X上发一条「{content}」的推文，然后回复自己这条推文，写「{reply_content}」",
        'I want to post a tweet on X saying "{content}", then reply to my own tweet with "{reply_content}"',
        'Help me post "{content}" on X, then reply to my own tweet saying "{reply_content}"',
    ]
    apps = ["x"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L1"
    capabilities = ["create", "social"]
    parameters = {
        "content": {
            "type": "string",
            "default": "今天天气真不错。",
            "description": "推文内容（自然中文句子）",
        },
        "reply_content": {
            "type": "string",
            "default": "这是我对自己这条推文的回复。",
            "description": "回复内容（自然中文句子）",
        },
    }
    expected_changes = ["apps.x.posts", "apps.x.user.postIds[+1]", "apps.x.user.replyIds[+1]"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        if not str(self.p.content or "").strip() or not str(self.p.reply_content or "").strip():
            raise RuntimeError("任务设计错误：content 和 reply_content 不能为空")
        app = X(input.apps["x"], init=input.apps_init["x"])
        return [
            app.check_created_post(self.p.content),
            app.check_replied_to_new_post(self.p.content, self.p.reply_content),
        ]
