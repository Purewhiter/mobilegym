from __future__ import annotations

from typing import Any

from bench_env.task.base import BaseTask
from bench_env.task.bilibili.app import Bilibili, format_compact_stat
from bench_env.task.judge import JudgeInput
from bench_env.task.wechat.app import WECHAT_CONTACT_PARAM, WECHAT_SEND_CHANGES, Wechat


class BilibiliRankTop3FolderAndWechat(BaseTask):
    """判定：新建名为 {folder} 的收藏夹并恰好含分区排行榜前 {rank} 名中播放量最高的 3 个视频；
    微信消息同时包含最高播放量视频的标题和播放量。
    """

    templates = [
        "把 B 站“{category}”分区排行榜前 {rank} 名中播放量最多的三个视频收藏到名叫{folder}的新建收藏夹里面，然后把其中播放量最高的视频名称和播放量微信发给“{contact}”。",
    ]
    apps = ["bilibili", "wechat"]
    scope = "S2"
    objective = "operate"
    composition = "sequential"
    difficulty = "L4"
    capabilities = ["extract", "create", "social", "handoff"]
    parameters = {
        "category": {
            "type": "enum",
            "values": {"娱乐": "娱乐"},
            "default": "娱乐",
            "description": "B站排行榜分区",
        },
        "rank": {
            "type": "enum",
            "values": {"20": 20},
            "default": 20,
            "description": "排行榜前若干名的门槛",
        },
        "folder": {
            "type": "enum",
            "values": {"热门视频": "热门视频"},
            "default": "热门视频",
            "description": "新建收藏夹名称",
        },
        "contact": WECHAT_CONTACT_PARAM,
    }
    expected_changes = WECHAT_SEND_CHANGES + [
        "bilibili.user.favoritesFolders",
        "bilibili.activeVideoId",
    ]

    def check_goals(self, input: JudgeInput) -> list[dict[str, Any]]:
        bili = Bilibili(input.apps["bilibili"], init=input.apps_init["bilibili"])
        wechat = Wechat(input.apps["wechat"], init=input.apps_init["wechat"])
        # top_ranking_videos_by_plays 在 top_n 不足时会抛错（见 bilibili/app.py）
        top3 = Bilibili.top_ranking_videos_by_plays(self.p.category, int(self.p.rank), top_n=3)
        top_video = top3[0]
        top_title = str(top_video["title"])
        top_plays = int(top_video["plays"])
        play_labels = [str(top_plays), format_compact_stat(top_plays)]
        return [
            bili.check_folder_created_with_bvids(
                self.p.folder,
                [str(v["id"]) for v in top3],
                video_titles=[str(v["title"]) for v in top3],
                field="new_folder_with_top3",
            ),
            wechat.check_new_sent_any_of(
                self.p.contact,
                play_labels,
                field="top_video_play_count",
            ),
            wechat.check_new_sent_norm_contains(
                self.p.contact,
                top_title,
                field="top_video_title",
            ),
        ]
