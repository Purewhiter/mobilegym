"""
Bilibili app task definitions.
"""
# -- Task Index (auto-generated, do not edit) --
# 20 tasks | L1×3  L2×12  L3×3  L4×2
#
# [L1] OpenRankingTask                         打开B站排行榜。
# [L1] ViewProfileStatTask                     我B站现在有多少{stat}？
# [L2] SubscribeTask                           在B站关注UP主'{up_name}'。
# [L2] UpdateSignTask                          在B站把个人签名改成'{new_sign}'。
# [L2] CoinVideoTask                           给B站视频'{title}'投1个币，不要点赞。
# [L2] ViewMyUidTask                           去看看我的b站UID是多少？
# [L2] UpdateNicknameTask                      把我的B站昵称改成'{new_name}'。
# [L2] VideoAnswerOnlineTask                   打开b站视频'{title}'，看看现在有多少人在线。
# [L3] VideoAnswerTagsTask                     打开b站视频'{title}'，说出其中任意3个标签。
# [L4] ToggleAnimeSubscriptionTask             帮我追番'{anime_title}'。
# [L1] SetSexTask                              把B站账号资料里的性别改成'{sex}'。
# [L2] ViewFavoritesFolderCountTask            看看我B站的'{folder_title}'收藏夹里有多少个内容。
# [L2] SearchUserFollowerCountTask             在B站搜一下'{up_name}'，ta现在有多少粉丝？
# [L2] SanlianTask                             在B站排行榜里找到视频'{title}'，给它一键三连。
# [L2] FollowRecommendationTask                先关注UP主'{target_up_name}'，再从推荐列表里关注一位不同的UP主。
# [L2] UnfollowAndClearHistoryTask             取消关注UP主'{up_name}'，并把B站搜索记录清空。
# [L3] SetBirthdayTask                         在B站个人资料里把生日设为1980年{month}月{day}日。
# [L3] FavVideoAndCountTask                    把B站'{partition}'排行榜的第{rank}名收藏到默认收藏夹，然后告诉我默认收藏夹现在有多少个内容。
# [L2] VideoCommentContainsAnswerUidTask       帮我在b站视频'{title}'的评论区里找到提到'{snippet}'的那条评论，告诉我评论者的UID。
# [L4] VideoCommentContainsAnswerLocationTask  在b站视频'{title}'的评论区找到提到'{snippet}'的那条评论，告诉我它显示的IP属地。
# -- End Task Index --

from __future__ import annotations

import re
from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.common_tasks import AnswerTask, CriteriaTask, build_answer_checks
from bench_env.task.judge import JudgeInput

from .app import RANKING_PARTITIONS, SEARCHABLE_AUTHOR_NAMES, Bilibili, norm_ip_location



# =============================================================================
# L1 — Atomic operations & simple queries
# =============================================================================


class OpenRankingTask(CriteriaTask):
    apps = ["bilibili"]
    templates = [
        "打开B站排行榜。",
        "帮我把B站排行榜打开。",
        "Open the Bilibili Rankings page.",
        "Go to the Rankings on Bilibili.",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L1"
    capabilities = ["nav"]
    criteria = {"route": "/ranking?tab=全站"}

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        """判断是否成功打开排行榜。

        只要路由中包含 ``/ranking?tab=`` 即视为成功，从而兼容 URL
        编码后的中文参数（例如 ``tab=%E5%85%A8%E7%AB%99``）。
        """
        current_path = input.route.get("path", "") if input.route else ""
        expected_substr = "/ranking?tab="
        passed = expected_substr in str(current_path)
        return [
            {
                "field": "route_contains",
                "expected": expected_substr,
                "actual": current_path,
                "passed": passed,
            }
        ]
class ViewProfileStatTask(AnswerTask):
    apps = ["bilibili"]
    templates = [
        "我B站现在有多少{stat}？",
        "帮我看看我B站的{stat}是多少。",
    ]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L1"
    capabilities = ["extract"]
    parameters = {
        "stat": {
            "type": "enum",
            "values": {
                "硬币": "coins",
                "关注": "following",
                "粉丝": "followers",
                "B币": "b_coins",
            },
            "default": "coins",
            "description": "个人页统计项",
        },
    }

    @property
    def answer_fields(self):  # type: ignore[override]
        stat_val = getattr(self.p, "stat", None)
        label = next((k for k, v in self.parameters["stat"]["values"].items() if v == stat_val), stat_val or "") + "数量"
        return [{"type": "number", "label": label}]

    def get_answer(self, input: JudgeInput) -> Any:
        return Bilibili(input.apps_init["bilibili"]).profile_stat(self.p.stat)


# =============================================================================
# L2 — Multi-step operations & queries
# =============================================================================


class SubscribeTask(BaseTask):
    apps = ["bilibili"]
    templates = ["在B站关注UP主'{up_name}'。"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["search", "social"]
    parameters = {
        "up_name": {
            "type": "string",
            "default": "流光视界",
            "source": "apps.bilibili.recommendedUp[name]",
            "description": "UP主名称",
        },
    }
    expected_changes = [
        "user.followingList",
        "user.following",
        "user.searchHistory",
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        app = Bilibili(input.apps["bilibili"])
        return [app.check_following(self.p.up_name)]


class UpdateSignTask(CriteriaTask):
    apps = ["bilibili"]
    templates = ["在B站把个人签名改成'{new_sign}'。"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["edit"]
    parameters = {
        "new_sign": {"type": "string", "default": "学习B站", "description": "新签名"},
    }
    criteria = {"user.sign": "{new_sign}"}


class CoinVideoTask(BaseTask):
    apps = ["bilibili"]
    templates = ["给B站视频'{title}'投1个币，不要点赞。"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["social"]
    parameters = {
        "title": {
            "type": "string",
            "default": "盘点某国令人啼笑皆非的荒诞瞬间",
            "description": "视频标题",
        },
    }
    expected_changes = [
        "user.coinedVideoCoins",
        "user.coins",
        "user.searchHistory",
        "activeVideoId",
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        app = Bilibili(input.apps["bilibili"])
        return [app.check_coined(self.p.title)]


class ViewMyUidTask(AnswerTask):
    apps = ["bilibili"]
    templates = [
        "去看看我的b站UID是多少？",
        "What is my Bilibili UID?",
    ]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["extract"]
    answer = ".user.uid"


class UpdateNicknameTask(CriteriaTask):
    apps = ["bilibili"]
    templates = ["把我的B站昵称改成'{new_name}'。"]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["edit"]
    parameters = {
        "new_name": {"type": "string", "default": "xiaoming2026", "description": "新昵称"},
    }
    criteria = {"user.name": "{new_name}"}
class VideoAnswerOnlineTask(AnswerTask):
    apps = ["bilibili"]
    templates = ["打开b站视频'{title}'，看看现在有多少人在线。"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["extract"]
    parameters = {
        "title": {"type": "string", "default": "盘点某国令人啼笑皆非的荒诞瞬间", "description": "视频标题"},
    }
    expected_changes = ["activeVideoId", "user.searchHistory"]
    answer_fields = [{"type": "text", "label": "在线人数", "hint": "如：3.2万+"}]

    def get_answer(self, input: JudgeInput) -> Any:
        video_id = Bilibili.bvid_from_title(self.p.title)
        return Bilibili.video_detail(video_id)["online"]


class VideoAnswerTagsTask(BaseTask):
    apps = ["bilibili"]
    templates = ["打开b站视频'{title}'，说出其中任意3个标签。"]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["extract"]
    parameters = {
        "title": {"type": "string", "default": "盘点某国令人啼笑皆非的荒诞瞬间", "description": "视频标题"},
    }
    expected_changes = ["activeVideoId", "user.searchHistory"]
    answer_fields = [
        {"type": "text", "label": "标签1", "hint": "如：音乐"},
        {"type": "text", "label": "标签2", "hint": "如：舞蹈"},
        {"type": "text", "label": "标签3", "hint": "如：游戏"},
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        video_id = Bilibili.bvid_from_title(self.p.title)
        tags = Bilibili.video_detail(video_id)["tags"]
        if not isinstance(tags, list) or len(tags) < 3:
            raise ValueError(f"Bilibili video tags unavailable for: {self.p.title}")
        expected_tags = [str(tag).strip() for tag in tags if str(tag).strip()]
        actual = str(input.answer or "")
        # 允许自然语言作答：只要回答文本中包含任意 3 个真实标签即可通过。
        hit_count = sum(1 for tag in set(expected_tags) if tag in actual)
        return [
            {
                "field": "answer_tags",
                "expected": "任意3个有效标签",
                "actual": actual,
                "passed": hit_count >= 3,
            },
        ]


# 说明：此任务先保留。当前虚拟 B 站在搜索结果页可直接点击“追番”完成任务，
# 与真机主路径一致；但点开后仅进入通用视频页，缺少真机详情页也可“追番”的能力。
# 因此这里暂不改 task/judge，后续如需补齐，应优先完善 App 详情页能力而非修改任务语义。
class ToggleAnimeSubscriptionTask(BaseTask):
    apps = ["bilibili"]
    templates = [
        "帮我追番'{anime_title}'。",
        "Subscribe to the anime '{anime_title}' on Bilibili.",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["social"]
    parameters = {
        "anime_title": {"type": "string", "default": "鬼灭之刃 游郭篇 中配版", "description": "番剧标题"},
    }
    expected_changes = ["user.subscribedAnime", "user.searchHistory"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        app = Bilibili(input.apps["bilibili"])
        return [app.check_anime_subscribed(self.p.anime_title, expected=True)]


class SetSexTask(CriteriaTask):
    apps = ["bilibili"]
    templates = [
        "把B站账号资料里的性别改成'{sex}'。",
        "把我的B站性别设置成'{sex}'。",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L1"
    capabilities = ["edit"]
    parameters = {
        "sex": {
            "type": "enum",
            "values": ["男", "女", "保密"],
            "default": "男",
            "description": "目标性别",
        },
    }
    criteria = {"user.sex": "{sex}"}

    async def _post_sample(self, env):
        await self._invert_criteria(env)


class ViewFavoritesFolderCountTask(AnswerTask):
    apps = ["bilibili"]
    templates = [
        "看看我B站的'{folder_title}'收藏夹里有多少个内容。",
        "帮我查一下B站'{folder_title}'收藏夹现在有几个内容。",
    ]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["extract"]
    answer_fields = [{"type": "number", "label": "收藏夹内容数"}]
    parameters = {
        "folder_title": {
            "type": "enum",
            "values": ["默认收藏夹", "科技数码"],
            "default": "默认收藏夹",
            "description": "收藏夹名称",
        },
    }

    def get_answer(self, input: JudgeInput) -> Any:
        return Bilibili(input.apps_init["bilibili"]).folder_video_count(self.p.folder_title)


class SearchUserFollowerCountTask(AnswerTask):
    apps = ["bilibili"]
    templates = [
        "在B站搜一下'{up_name}'，ta现在有多少粉丝？",
        "帮我在B站查查UP主'{up_name}'现在有多少粉丝。",
    ]
    scope = "S1"
    objective = "query"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["search", "extract"]
    answer_fields = [{"type": "text", "label": "粉丝数", "hint": "如：56.7万"}]
    parameters = {
        "up_name": {
            "type": "enum",
            "values": list(SEARCHABLE_AUTHOR_NAMES),
            "default": "流光视界",
            "description": "UP主名称",
        },
    }
    expected_changes = ["user.searchHistory"]

    def get_answer(self, input: JudgeInput) -> Any:
        return Bilibili.author_follower_display(self.p.up_name)


# =============================================================================
# L3 — Complex reasoning & hybrid tasks
# =============================================================================


class SanlianTask(BaseTask):
    apps = ["bilibili"]
    templates = [
        "在B站排行榜里找到视频'{title}'，给它一键三连。",
        "帮我把b站排行榜上的'{title}'一键三连。",
        "Find the video '{title}' on the Bilibili Rankings and give it a Triple (Like + Coin + Favorite).",
        "Go to the Bilibili Rankings, find '{title}', and Triple it (Like + Coin + Favorite).",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["social"]
    parameters = {
        "title": {"type": "string", "default": "盘点某国令人啼笑皆非的荒诞瞬间", "description": "视频标题"},
    }
    expected_changes = [
        "user.likedVideoIds",
        "user.dislikedVideoIds",
        "user.coinedVideoCoins",
        "user.favoritesFolders",
        "user.coins",
        "user.searchHistory",
        "activeVideoId",
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        app = Bilibili(input.apps["bilibili"])
        return [
            app.check_active_video(self.p.title),
            app.check_liked(self.p.title),
            app.check_coined(self.p.title),
            app.check_favored(self.p.title),
        ]


class FollowRecommendationTask(BaseTask):
    apps = ["bilibili"]
    templates = [
        "先关注UP主'{target_up_name}'，再从推荐列表里关注一位不同的UP主。",
        "在B站关注'{target_up_name}'后，再顺手关注一个推荐里的别的UP主。",
        "Follow the creator '{target_up_name}' on Bilibili, then follow a different creator from the recommendation list.",
        "On Bilibili, follow '{target_up_name}' and then follow another recommended creator.",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["social"]
    parameters = {
        "target_up_name": {
            "type": "string",
            "default": "流光视界",
            "source": "apps.bilibili.recommendedUp[name]",
            "description": "目标UP主名称",
        },
    }
    expected_changes = [
        "user.followingList",
        "user.following",
        "user.searchHistory",
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        app = Bilibili(input.apps["bilibili"])
        target_mid = app.resolve_mid_by_name(self.p.target_up_name)
        followed_other = any(
            mid != target_mid and app.is_following(mid)
            for mid in app.recommended_mids()
        )
        return [
            app.check_following(self.p.target_up_name, field="follow_target"),
            {"field": "follow_recommendation", "expected": True,
             "actual": followed_other, "passed": followed_other},
        ]


class UnfollowAndClearHistoryTask(BaseTask):
    apps = ["bilibili"]
    templates = [
        "取消关注UP主'{up_name}'，并把B站搜索记录清空。",
        "Unfollow the creator '{up_name}' on Bilibili and clear the search history.",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L2"
    capabilities = ["social", "search"]
    parameters = {
        "up_name": {
            "type": "string",
            "default": "铁壁观察",
            "source": "apps.bilibili.user.followingList[name]",
            "description": "UP主名称",
        },
    }
    expected_changes = [
        "user.followingList",
        "user.following",
        "user.searchHistory",
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        app = Bilibili(input.apps["bilibili"])
        return [
            app.check_following(self.p.up_name, expected=False),
            app.check_search_history_cleared(),
        ]


class SetBirthdayTask(BaseTask):
    apps = ["bilibili"]
    templates = [
        "在B站个人资料里把生日设为1980年{month}月{day}日。",
        "把我的B站生日改成1980年{month}月{day}日。",
    ]
    scope = "S1"
    objective = "operate"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["edit"]
    parameters = {
        "month": {"type": "int", "default": 8, "min": 1, "max": 12, "description": "月份"},
        "day": {"type": "int", "default": 13, "min": 1, "max": 28, "description": "日期"},
    }
    expected_changes = ["user.birthday"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        app = Bilibili(input.apps["bilibili"])
        expected = f"1980-{int(self.p.month):02d}-{int(self.p.day):02d}"
        return [app.check_birthday(expected)]


class FavVideoAndCountTask(BaseTask):
    apps = ["bilibili"]
    templates = [
        "把B站'{partition}'排行榜的第{rank}名收藏到默认收藏夹，然后告诉我默认收藏夹现在有多少个内容。",
        "帮我把B站排行榜'{partition}'分区第{rank}名的视频收藏起来，再告诉我默认收藏夹现在有几个内容。",
    ]
    scope = "S1"
    objective = "hybrid"
    composition = "sequential"
    difficulty = "L3"
    capabilities = ["social", "extract"]
    parameters = {
        "partition": {
            "type": "enum",
            "values": RANKING_PARTITIONS,
            "default": "全站",
            "description": "排行榜分区",
        },
        "rank": {
            "type": "int",
            "default": 1,
            "min": 1,
            "max": 15,
            "description": "榜单名次",
        },
    }
    expected_changes = ["user.favoritesFolders", "activeVideoId"]
    answer_fields = [{"type": "number", "label": "默认收藏夹内容数"}]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        app = Bilibili(input.apps["bilibili"])
        entry = Bilibili.ranking_entry(self.p.partition, int(self.p.rank))
        title = entry["title"]
        bvid = str(entry["id"])
        count = app.folder_video_count("默认收藏夹")
        return [
            app.check_favored_bvid(bvid, video_title=title),
            app.check_folder_contains_bvid("默认收藏夹", bvid, video_title=title),
            *build_answer_checks(count, input.answer),
        ]


# =============================================================================
# L4 — Deep multi-step & complex queries
# =============================================================================


class VideoCommentContainsAnswerUidTask(AnswerTask):
    apps = ["bilibili"]
    templates = [
        "帮我在b站视频'{title}'的评论区里找到提到'{snippet}'的那条评论，告诉我评论者的UID。",
        "去b站视频'{title}'评论区找包含'{snippet}'的评论，看看发评论的人UID是多少。",
    ]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L2"
    capabilities = ["extract", "reasoning", "explore"]
    parameters = {
        "title": {"type": "string", "default": "盘点某国令人啼笑皆非的荒诞瞬间", "description": "视频标题"},
        "snippet": {"type": "string", "default": "十二小时", "description": "评论内容片段"},
    }
    expected_changes = ["activeVideoId", "user.searchHistory"]
    answer_fields = [{"type": "text", "label": "评论者UID", "hint": "如：87654321"}]

    def get_answer(self, input: JudgeInput) -> Any:
        video_id = Bilibili.bvid_from_title(self.p.title)
        comment = Bilibili.comment_by_contains(video_id, self.p.snippet)
        return str(comment["mid"])


class VideoCommentContainsAnswerLocationTask(AnswerTask):
    apps = ["bilibili"]
    templates = [
        "在b站视频'{title}'的评论区找到提到'{snippet}'的那条评论，告诉我它显示的IP属地。",
        "去b站视频'{title}'评论区里找包含'{snippet}'的评论，看看评论者显示的IP属地在哪。",
    ]
    scope = "S1"
    objective = "query"
    composition = "deep_dive"
    difficulty = "L4"
    capabilities = ["extract", "reasoning", "explore"]
    parameters = {
        "title": {"type": "string", "default": "把老式音乐盒改造成 AI 作曲机：从硬件到算法全流程", "description": "视频标题"},
        "snippet": {
            "type": "string",
            "default": "整活达人",
            "description": "评论内容片段",
        },
    }
    expected_changes = ["activeVideoId", "user.searchHistory"]
    answer_fields = [{"type": "text", "label": "IP属地", "hint": "如：浙江"}]

    def get_answer(self, input: JudgeInput) -> Any:
        video_id = Bilibili.bvid_from_title(self.p.title)
        comment = Bilibili.comment_by_contains(video_id, self.p.snippet)
        return norm_ip_location(comment["location"])
