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
from bench_env.task.reddit.app import Reddit


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
    expected_changes = ["settings"]


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
    expected_changes = ["settings"]


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
    expected_changes = ["settings"]


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
    expected_changes = ["settings"]


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
    expected_changes = ["joinedCommunityIds", "postVotes"]
    parameters = {
        "community": {
            "type": "string",
            "default": "r/memes",
            "description": "目标社区名（信息流里可见）",
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        app = input.apps.get("reddit", {}) or {}
        init = input.apps_init.get("reddit", {}) or {}

        community = str(self.p.community).strip()
        if not community:
            raise RuntimeError("任务设计错误：community 为空")

        cur_joined = app.get("joinedCommunityIds", [])
        init_joined = init.get("joinedCommunityIds", [])
        # Some runs may not expose reddit.communities reliably; don't hard-require communityId mapping.
        # We only need to verify the user actually joined a community (joinedCommunityIds grows).
        cur_set = set(cur_joined) if isinstance(cur_joined, list) else set()
        init_set = set(init_joined) if isinstance(init_joined, list) else set()
        newly_joined = list(cur_set - init_set)
        join_ok = len(newly_joined) > 0

        posts = app.get("posts", [])
        post_by_id: dict[str, str] = {}
        if isinstance(posts, list):
            for p in posts:
                if isinstance(p, dict) and p.get("id") and p.get("subreddit"):
                    post_by_id[str(p.get("id"))] = str(p.get("subreddit"))

        cur_votes = app.get("postVotes", {}) or {}
        init_votes = init.get("postVotes", {}) or {}
        vote_ok = False
        if isinstance(cur_votes, dict):
            for pid, v in cur_votes.items():
                if str(v) != "up":
                    continue
                if post_by_id.get(str(pid)) != community:
                    continue
                prev_v = init_votes.get(pid) if isinstance(init_votes, dict) else None
                if prev_v != "up":
                    vote_ok = True
                    break

        return [
            {
                "field": "reddit.joinedCommunityIds",
                "expected": "joinedCommunityIds 相对初始 state 有新增（表示加入了某个社区）",
                "actual": {"newly_joined": newly_joined, "cur": cur_joined, "init": init_joined},
                "passed": join_ok,
            },
            {
                "field": f"reddit.postVotes(any_upvote_in_{community})",
                "expected": "对该社区任意帖子产生一次新的 upvote",
                "actual": {"upvotes": [k for k, v in cur_votes.items()] if isinstance(cur_votes, dict) else None},
                "passed": vote_ok,
            },
        ]


class Reddit_UpvoteSpecificFeedPost(CriteriaTask):
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
    expected_changes = ["postVotes"]
    parameters = {
        # Use a home-feed rank in the initial page (HomePage shows PAGE_SIZE=20 items first),
        # instead of relying on a specific title being visible.
        "post": {
            "sampler": "sample_home_feed_post_rank_10_20",
            # The sampler returns a dict; TaskSampler will flatten it into params when `fields` is present.
            "fields": {"post_id": "post_id", "post_title": "post_title", "feed_rank": "feed_rank"},
        },
    }

    @property
    def criteria(self) -> dict[str, Any]:
        pid = str(self.p.post_id)
        return {"postVotes": lambda m: isinstance(m, dict) and m.get(pid) == "up"}

    @staticmethod
    def sample_home_feed_post_rank_10_20(env_state: dict[str, Any]) -> dict[str, Any]:
        """
        Sample a post located in the initial home feed window [10..20] (1-based).

        HomePage.tsx renders `posts.slice(0, displayCount)` where displayCount initial value is 20.
        """
        reddit = (env_state.get("apps") or {}).get("reddit") or {}
        posts = reddit.get("posts") or []
        if not isinstance(posts, list) or not posts:
            # Fallback: no posts in env state -> sample from empty (will fail criteria)
            raise RuntimeError("任务设计错误：reddit.posts 为空，无法采样首页帖子")

        n = len(posts)
        min_rank = 10
        max_rank = 20
        max_rank = min(max_rank, n)
        if min_rank > max_rank:
            # If there are less than 10 posts, clamp to what exists.
            min_rank = 1

        # Pick a deterministic rank within [10..20] to make the task stable.
        # You can adjust this constant if you want a different "slot".
        feed_rank = min(max(15, min_rank), max_rank)  # 1-based rank
        post = posts[feed_rank - 1]

        if not isinstance(post, dict):
            raise RuntimeError("任务设计错误：reddit.posts 元素不是对象")

        return {
            "feed_rank": feed_rank,
            "post_id": str(post.get("id")),
            "post_title": str(post.get("title") or ""),
        }


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
    expected_changes = ["posts", "userPosts", "postVotes"]
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
            reddit.check_new_post_title_body_in_subreddit(
                str(self.p.community),
                title_keyword=str(self.p.title),
                body_keyword=str(self.p.body),
                field="reddit.userPosts(new)",
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
    expected_changes = ["userCommentsByPostId"]
    parameters = {
        "post": {
            "source": "apps.reddit.posts",
            "fields": {"post_id": "id", "post_title": "title"},
        },
        "comment": {
            "type": "string",
            "default": "Nice post!",
            "description": "评论内容片段",
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        post_id = str(self.p.post_id)
        target = str(self.p.comment).strip().lower()

        app = input.apps.get("reddit", {}) or {}
        init = input.apps_init.get("reddit", {}) or {}
        posts = app.get("posts", [])
        if not isinstance(posts, list) or not any(isinstance(p, dict) and str(p.get("id")) == post_id for p in posts):
            raise RuntimeError(f"任务设计错误：postId '{post_id}' 不存在于 reddit.posts")

        cur_map = app.get("userCommentsByPostId", {}) or {}
        init_map = init.get("userCommentsByPostId", {}) or {}
        cur_list = cur_map.get(post_id, [])
        init_list = init_map.get(post_id, [])
        if not isinstance(cur_list, list) or not isinstance(init_list, list):
            raise RuntimeError("任务设计错误：reddit.userCommentsByPostId[postId] 不是 list")

        init_ids = {c.get("id") for c in init_list if isinstance(c, dict)}
        new_comments = [c for c in cur_list if isinstance(c, dict) and c.get("id") not in init_ids]
        matched = any(target in str(c.get("body", "")).strip().lower() for c in new_comments)

        return [
            {
                "field": f"userCommentsByPostId.{post_id}(new)",
                "expected": f"新增评论包含 '{self.p.comment}'",
                "actual": f"new_comments={len(new_comments)}",
                "passed": matched,
            }
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
    capabilities = ["nav", "edit"]
    expected_changes = ["userCommentsByPostId"]
    parameters = {
        # 这里的标题和评论都是 seed post 固定内容，用参数只是为了模板渲染友好。
        "post_title": {
            "type": "string",
            "default": "早起后精神更好，但总是坚持不住，有什么小技巧？",
            "description": "种子帖子标题（用于描述）",
        },
        "seed_comment": {
            "type": "string",
            "default": "我也遇到过类似情况，先从每天提前 10 分钟开始会更容易坚持。",
            "description": "要删除的评论内容（seed post 内置）",
        },
    }

    async def _prepare(self, env: Any) -> None:
        # Ensure the seed post + the deletable comment exist even if app hydration overwrote posts.
        state = await env.get_state()
        apps = state.get("apps", {}) if isinstance(state, dict) else {}
        reddit = apps.get("reddit", {}) if isinstance(apps, dict) else {}

        seed_post_id = "bench_post_seed_1"
        seeded_id = "bench_seed_comment_delete_1"
        post_title = str(self.parameters["post_title"]["default"])
        seed_comment = str(self.parameters["seed_comment"]["default"])

        posts = reddit.get("posts", [])
        # Avoid duplicating a post that already exists in the app (same topic but different id).
        # Some app boot paths may already contain the same seeded content from config/sample posts.
        has_post = False
        existing_post_id: str | None = None
        if isinstance(posts, list):
            for p in posts:
                if not isinstance(p, dict):
                    continue
                if str(p.get("id")) == seed_post_id:
                    has_post = True
                    existing_post_id = seed_post_id
                    break
                if str(p.get("subreddit", "")).strip() == "r/China_irl" and str(p.get("title", "")).strip() == post_title:
                    has_post = True
                    existing_post_id = str(p.get("id")) if p.get("id") is not None else None
                    break

        post_id = existing_post_id or seed_post_id

        user_map = reddit.get("userCommentsByPostId", {})
        cur_list = user_map.get(post_id, []) if isinstance(user_map, dict) else []
        has_comment = isinstance(cur_list, list) and any(isinstance(c, dict) and str(c.get("id")) == seeded_id for c in cur_list)

        if has_post and has_comment:
            return

        # Minimal post object for UI + search + comments page.
        seed_post = {
            "id": seed_post_id,
            "subreddit": "r/China_irl",
            "subredditIcon": None,
            "author": "u/SeedUser1",
            "authorAvatar": "",
            "timeAgo": "now",
            "title": post_title,
            "content": "最近想把作息调到 6 点起床，确实感觉白天精神更好，但坚持一周后就容易崩。大家有什么更容易坚持的小方法吗？",
            "image": None,
            "images": None,
            "upvotes": "1",
            "comments": "2",
            "shares": 0,
            "isAd": False,
            "url": "",
            "commentsData": [
                {"id": "seed_c_1", "author": "Someone", "body": "我用的方法是先固定“起床时间”，不管几点睡都照样起。", "score": 12, "created_utc": 1710000005},
                {"id": "seed_c_2", "author": "Another", "body": "睡前 1 小时别刷手机，换成读书或拉伸会更容易早睡。", "score": 8, "created_utc": 1710000006},
            ],
        }

        next_user_map = user_map if isinstance(user_map, dict) else {}
        next_list = cur_list if isinstance(cur_list, list) else []
        if not has_comment:
            next_list = [
                *next_list,
                {"id": seeded_id, "author": (reddit.get("user", {}) or {}).get("username", "me"), "body": seed_comment, "score": 1, "created_utc": 1710000000},
            ]
        next_user_map = {**next_user_map, post_id: next_list}

        # 只在帖子缺失时才写回 posts，避免把 get_state() 裁剪过的 posts（无 commentsData）覆盖运行时 store。
        state_patch: dict = {"userCommentsByPostId": next_user_map}
        if not has_post:
            next_posts = [seed_post, *(posts if isinstance(posts, list) else [])]
            state_patch["posts"] = next_posts
        await env.set_state({"apps": {"reddit": state_patch}})

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        seeded_id = "bench_seed_comment_delete_1"
        app = input.apps.get("reddit", {}) or {}
        cur_map = app.get("userCommentsByPostId", {}) or {}
        if not isinstance(cur_map, dict):
            raise RuntimeError("任务设计错误：reddit.userCommentsByPostId 不是 dict")

        # Find the seeded comment wherever it lives (postId can vary if the app already had a matching seeded post).
        still_exists = False
        located_in: str | None = None
        for pid, lst in cur_map.items():
            if not isinstance(lst, list):
                continue
            if any(isinstance(c, dict) and str(c.get("id")) == seeded_id for c in lst):
                still_exists = True
                located_in = str(pid)
                break

        return [
            {
                "field": f"userCommentsByPostId.*(seeded_id={seeded_id})",
                "expected": "seeded_comment_deleted",
                "actual": {"status": "exists" if still_exists else "deleted", "located_in": located_in},
                "passed": not still_exists,
            }
        ]


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
    expected_changes = ["chatThreadsByUsername"]
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
        app = input.apps.get("reddit", {}) or {}
        threads = app.get("chatThreadsByUsername", {}) or {}
        username = str(self.p.username)
        msg = str(self.p.message).strip().lower()

        lst = threads.get(username, [])
        if not isinstance(lst, list) or len(lst) == 0:
            return [
                {
                    "field": f"chatThreadsByUsername.{username}",
                    "expected": f"last message contains '{self.p.message}'",
                    "actual": "no thread/messages",
                    "passed": False,
                }
            ]

        last = lst[-1] if isinstance(lst[-1], dict) else {}
        passed = (
            isinstance(last, dict)
            and str(last.get("from")) == "me"
            and msg in str(last.get("body", "")).strip().lower()
        )

        return [
            {
                "field": f"chatThreadsByUsername.{username}[-1]",
                "expected": f"from=me and body contains '{self.p.message}'",
                "actual": {"from": last.get("from"), "body": last.get("body")},
                "passed": passed,
            }
        ]


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
    capabilities = ["nav", "edit"]
    expected_changes = ["chatThreadsByUsername"]
    parameters = {
        "username": {"type": "string", "default": "Objective-Skill-2591"},
        "seed_message": {"type": "string", "default": "我等下去把快递拿一下，晚点回你。", "description": "要删除的预置消息内容"},
        "_pair": {
            "sampler": Reddit.sample_deletable_chat_pair,
            "fields": {"username": "username", "seed_message": "seed_message"},
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        reddit_init = Reddit(input.apps_init["reddit"])
        reddit_cur = Reddit(input.apps["reddit"])
        msg = reddit_init.find_my_chat_message(self.p.username, self.p.seed_message)
        return [reddit_cur.check_chat_message_deleted(self.p.username, msg["id"])]


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
    expected_changes = ["commentVotes"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        app = input.apps.get("reddit", {}) or {}
        init = input.apps_init.get("reddit", {}) or {}
        cur = app.get("commentVotes", {}) or {}
        prev = init.get("commentVotes", {}) or {}
        if not isinstance(cur, dict) or not isinstance(prev, dict):
            raise RuntimeError("任务设计错误：reddit.commentVotes 不是 dict")

        new_keys = [k for k in cur.keys() if k not in prev]
        up_keys = [k for k in new_keys if cur.get(k) == "up"]
        passed = len(up_keys) > 0

        return [
            {
                "field": "reddit.commentVotes(new_upvote)",
                "expected": "产生至少 1 个新的 commentVotes 记录，且值为 'up'",
                "actual": {"new": len(new_keys), "new_up": len(up_keys)},
                "passed": passed,
            }
        ]


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
    expected_changes = ["userCommentsByPostId"]
    parameters = {
        "seed_comment": {"type": "string", "default": "补充一点：晚上早点放下手机真的有用。", "description": "要编辑的评论内容（seed post 内置）"},
        "new_comment": {
            "type": "string",
            "default": "我后来发现把早起目标拆成两步：先固定起床时间，再慢慢提前入睡，更容易坚持。",
            "description": "编辑后的内容片段（用于判定）",
        },
    }

    async def _prepare(self, env: Any) -> None:
        # Same seed post as delete-comment task; ensure editable comment exists.
        state = await env.get_state()
        apps = state.get("apps", {}) if isinstance(state, dict) else {}
        reddit = apps.get("reddit", {}) if isinstance(apps, dict) else {}

        seed_post_id = "bench_post_seed_1"
        seeded_id = "bench_seed_comment_edit_1"
        seed_comment = str(self.parameters["seed_comment"]["default"])

        user_map = reddit.get("userCommentsByPostId", {})
        me = str((reddit.get("user", {}) or {}).get("username") or "me")

        # If the app already has the seeded comment content from config/sample data,
        # do not inject duplicates. Bench tasks should operate on existing data when present.
        already_has_equivalent = False
        if isinstance(user_map, dict):
            for lst in user_map.values():
                if not isinstance(lst, list):
                    continue
                for c in lst:
                    if not isinstance(c, dict):
                        continue
                    if str(c.get("author") or "") != me:
                        continue
                    if seed_comment.strip().lower() in str(c.get("body", "") or "").strip().lower():
                        already_has_equivalent = True
                        break
                if already_has_equivalent:
                    break

        if already_has_equivalent:
            return

        cur_list = user_map.get(seed_post_id, []) if isinstance(user_map, dict) else []
        has_comment = isinstance(cur_list, list) and any(isinstance(c, dict) and str(c.get("id")) == seeded_id for c in cur_list)

        posts = reddit.get("posts", [])
        # Avoid duplicating a post that already exists in the app (same topic but different id).
        has_post = False
        existing_post_id: str | None = None
        if isinstance(posts, list):
            for p in posts:
                if not isinstance(p, dict):
                    continue
                if str(p.get("id")) == seed_post_id:
                    has_post = True
                    existing_post_id = seed_post_id
                    break
                if str(p.get("subreddit", "")).strip() == "r/China_irl" and str(p.get("title", "")).strip() == "早起后精神更好，但总是坚持不住，有什么小技巧？":
                    has_post = True
                    existing_post_id = str(p.get("id")) if p.get("id") is not None else None
                    break

        post_id = existing_post_id or seed_post_id
        # Re-check comment existence on the resolved post_id.
        cur_list = user_map.get(post_id, []) if isinstance(user_map, dict) else []
        has_comment = isinstance(cur_list, list) and any(isinstance(c, dict) and str(c.get("id")) == seeded_id for c in cur_list)

        if has_post and has_comment:
            return

        # Reuse the same post title/content as the delete-comment task defaults.
        post_title = "早起后精神更好，但总是坚持不住，有什么小技巧？"
        seed_post = {
            "id": seed_post_id,
            "subreddit": "r/China_irl",
            "subredditIcon": None,
            "author": "u/SeedUser1",
            "authorAvatar": "",
            "timeAgo": "now",
            "title": post_title,
            "content": "最近想把作息调到 6 点起床，确实感觉白天精神更好，但坚持一周后就容易崩。大家有什么更容易坚持的小方法吗？",
            "image": None,
            "images": None,
            "upvotes": "1",
            "comments": "2",
            "shares": 0,
            "isAd": False,
            "url": "",
            "commentsData": [
                {"id": "seed_c_1", "author": "Someone", "body": "我用的方法是先固定“起床时间”，不管几点睡都照样起。", "score": 12, "created_utc": 1710000005},
                {"id": "seed_c_2", "author": "Another", "body": "睡前 1 小时别刷手机，换成读书或拉伸会更容易早睡。", "score": 8, "created_utc": 1710000006},
            ],
        }

        next_user_map = user_map if isinstance(user_map, dict) else {}
        next_list = cur_list if isinstance(cur_list, list) else []
        if not has_comment:
            next_list = [
                *next_list,
                {"id": seeded_id, "author": (reddit.get("user", {}) or {}).get("username", "me"), "body": seed_comment, "score": 1, "created_utc": 1710000002},
            ]
        next_user_map = {**next_user_map, post_id: next_list}

        # 只在帖子缺失时才写回 posts，避免把 get_state() 裁剪过的 posts（无 commentsData）覆盖运行时 store。
        state_patch: dict = {"userCommentsByPostId": next_user_map}
        if not has_post:
            next_posts = [seed_post, *(posts if isinstance(posts, list) else [])]
            state_patch["posts"] = next_posts
        await env.set_state({"apps": {"reddit": state_patch}})

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        app = input.apps.get("reddit", {}) or {}
        cur_map = app.get("userCommentsByPostId", {}) or {}
        init = input.apps_init.get("reddit", {}) or {}
        init_map = init.get("userCommentsByPostId", {}) or {}
        if not isinstance(cur_map, dict) or not isinstance(init_map, dict):
            raise RuntimeError("任务设计错误：reddit.userCommentsByPostId 不是 dict")

        me = str(((app.get("user", {}) or {}).get("username")) or ((init.get("user", {}) or {}).get("username")) or "me")
        seed_text = str(self.p.seed_comment).strip().lower()

        # Locate the exact comment to edit from the *initial* state by author+body match.
        init_post_id: str | None = None
        init_comment_id: str | None = None
        init_body: str | None = None
        for pid, lst in init_map.items():
            if not isinstance(lst, list):
                continue
            for c in lst:
                if not isinstance(c, dict):
                    continue
                if str(c.get("author") or "") != me:
                    continue
                body = str(c.get("body", "") or "").strip()
                if seed_text and seed_text in body.lower():
                    init_post_id = str(pid)
                    init_comment_id = str(c.get("id"))
                    init_body = body
                    break
            if init_comment_id:
                break

        # If not found in init, fallback to the known seeded id (for fully seeded runs).
        if not init_comment_id:
            init_post_id = None
            init_comment_id = "bench_seed_comment_edit_1"

        target = None
        located_in: str | None = None
        if init_post_id and isinstance(cur_map.get(init_post_id), list):
            for c in cur_map.get(init_post_id, []):
                if isinstance(c, dict) and str(c.get("id")) == init_comment_id:
                    target = c
                    located_in = str(init_post_id)
                    break
        if target is None:
            # As a last resort, scan all posts for that id (in case postId changed).
            for pid, lst in cur_map.items():
                if not isinstance(lst, list):
                    continue
                for c in lst:
                    if isinstance(c, dict) and str(c.get("id")) == init_comment_id:
                        target = c
                        located_in = str(pid)
                        break
                if target is not None:
                    break

        if not target:
            raise RuntimeError("任务设计错误：无法定位需要编辑的评论（init 与 cur 状态不一致）")

        passed = str(self.p.new_comment).strip().lower() in str(target.get("body", "")).strip().lower()
        return [
            {
                "field": f"userCommentsByPostId.*.{init_comment_id}.body",
                "expected": f"包含 '{self.p.new_comment}'",
                "actual": {"located_in": located_in, "body": target.get("body", ""), "init_body": init_body, "me": me},
                "passed": passed,
            }
        ]


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
    expected_changes = ["user"]
    parameters = {
        "bio": {
            "type": "string",
            "default": "最近在学做家常川菜，也在练早起打卡。",
            "description": "新的 bio 片段（用于 state 判定）",
        }
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        app = input.apps.get("reddit", {}) or {}
        user = app.get("user", {}) or {}
        if not isinstance(user, dict):
            raise RuntimeError("任务设计错误：reddit.user 不是 dict")

        bio = str(user.get("bio", "") or "").strip()
        passed = str(self.p.bio).strip().lower() in bio.lower()
        return [
            {
                "field": "reddit.user.bio",
                "expected": f"包含 '{self.p.bio}'",
                "actual": bio,
                "passed": passed,
            }
        ]


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
    expected_changes = ["posts", "userPosts"]
    parameters = {"seed_title": {"type": "string", "default": "有没有人也会半夜突然想整理房间？"}}

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        reddit_init = Reddit(input.apps_init["reddit"])
        reddit_cur = Reddit(input.apps["reddit"])
        post = reddit_init.find_user_post_by_title(self.p.seed_title)
        return [reddit_cur.check_post_deleted(post["id"])]


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
    expected_changes = ["chatThreadRepliesByKey", "chatThreadsByUsername"]
    parameters = {
        "username": {"type": "enum", "values": ["Objective-Skill-2591"], "default": "Objective-Skill-2591"},
        "thread_seed_message": {
            "type": "string",
            "default": "你上次推荐的那家店我去了，味道确实不错！",
            "description": "用于定位 thread 的种子消息文本（来自对方）",
        },
        "delete_seed_message": {
            "type": "string",
            "default": "我等下去把快递拿一下，晚点回你。",
            "description": "用于定位要删除的种子消息文本（来自我）",
        },
        "reply": {
            "type": "string",
            "default": "哈哈同感！我也觉得他们家辣度刚刚好，下次一起去试试新菜。",
            "description": "thread 回复内容片段（用于判定）",
        },
    }

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        reddit_init = Reddit(input.apps_init["reddit"])
        reddit_cur = Reddit(input.apps["reddit"])
        username = self.p.username

        # 1) thread reply: 从 init 中定位源消息 ID，在 current 中检查回复
        source_msg = None
        thread_seed_lower = self.p.thread_seed_message.strip().lower()
        for m in reddit_init.raw["chatThreadsByUsername"][username]:
            if thread_seed_lower in m["body"].strip().lower():
                source_msg = m
                break
        source_id = source_msg["id"] if source_msg else None
        k = f"{username}:{source_id}" if source_id else f"{username}:(unresolved)"

        replies = reddit_cur.raw.get("chatThreadRepliesByKey", {})
        lst = replies.get(k, [])
        last = lst[-1] if lst else {}
        reply_ok = (
            bool(lst)
            and last.get("from") == "me"
            and self.p.reply.strip().lower() in (last.get("body") or "").strip().lower()
        )

        # 2) seed delete message: 从 init 查找消息 ID，用 check 方法验证删除
        delete_msg = reddit_init.find_my_chat_message(username, self.p.delete_seed_message)
        delete_check = reddit_cur.check_chat_message_deleted(
            username, delete_msg["id"], field=f"chatThreadsByUsername.{username}_seed_delete",
        )

        return [
            {
                "field": f"chatThreadRepliesByKey.{k}[-1]",
                "expected": f"from=me and body contains '{self.p.reply}'",
                "actual": {
                    "source_message_id": source_id,
                    "source_message_found": source_msg["body"] if source_msg else None,
                    "from": last.get("from"),
                    "body": last.get("body"),
                    "len": len(lst),
                },
                "passed": reply_ok,
            },
            delete_check,
        ]
