from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.bilibili.app import Bilibili, compact_stat_labels, video_count_labels
from bench_env.task.judge import JudgeInput
from bench_env.task.utils import sim_today
from bench_env.task.wechat.app import WECHAT_CONTACT_PARAM, WECHAT_SEND_CHANGES, Wechat


class BilibiliRankAuthorLastNovToWechat(BaseTask):
    """判定：微信消息包含作者粉丝数、去年 11 月发布数、以及去年 11 月内播放量最高的视频标题。"""

    templates = [
        "看看B站“{category}”分区排行榜第 {rank} 名作者去年 11月发过多少个视频，把粉丝数量和发过的视频数量、这里面播放量最多的视频名称发给微信联系人“{contact}”。",
    ]
    apps = ["bilibili", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "deep_dive"
    difficulty = "L3"
    capabilities = ["extract", "reasoning", "handoff"]
    parameters = {
        "category": {
            "type": "enum",
            "values": {"舞蹈": "舞蹈"},
            "default": "舞蹈",
            "description": "B站排行榜分区",
        },
        "rank": {
            "type": "enum",
            "values": {"10": 10},
            "default": 10,
            "description": "排行榜名次",
        },
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WECHAT_SEND_CHANGES + ["bilibili.activeVideoId"]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        author_name = Bilibili.ranking_author_name(self.p.category, int(self.p.rank))
        followers = Bilibili.author_follower_count(author_name)
        last_year = sim_today(input.os_init).year - 1
        last_nov = Bilibili.author_videos_in_year_month(author_name, last_year, 11)
        top_video = Bilibili.author_top_played_video_in_year_month(author_name, last_year, 11)
        video_count = len(last_nov)
        # Agent 只能看到 UI 上的紧凑展示（如 "118.7 万"），保留精确数字仅作兼容。
        # 接受两种写法中任一即可；视频数量要求带量词/字段名，避免被粉丝数里的单个数字误命中。
        follower_labels = compact_stat_labels(followers)
        return [
            wechat.check_new_sent_any_of(
                self.p.contact,
                follower_labels,
                field="rank_author_followers_share",
            ),
            wechat.check_new_sent_any_of(
                self.p.contact,
                video_count_labels(video_count),
                field="rank_author_last_nov_count_share",
            ),
            wechat.check_new_sent_norm_contains(
                self.p.contact,
                str(top_video["title"]),
                field="rank_author_top_video_share",
            ),
        ]
