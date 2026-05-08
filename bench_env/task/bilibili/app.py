from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

from bench_env.task.base import BaseApp

RANKING_PARTITIONS = [
    "全站",
    "番剧",
    "国创",
    "纪录片",
    "电影",
    "电视剧",
]

AUTHOR_NAME_TO_MID: dict[str, str] = {
    "视界观察员": "800000036064",
    "铁壁观察": "800000025938",
    "小白工坊志": "800000019727",
    "_拾光记录者_": "800000064982",
    "流光视界": "800000001054",
}

BILIBILI_PARTITION_PARAM = {
    "type": "enum",
    "values": RANKING_PARTITIONS,
    "default": "全站",
}

SEARCHABLE_AUTHOR_NAMES: tuple[str, ...] = (
    "流光视界",
    "视界观察员",
    "小白工坊志",
)

_ROOT = Path(__file__).resolve().parents[3]
_BILI_DATA_DIR = _ROOT / "apps" / "Bilibili" / "data"
_AUTHORS_JSON = _BILI_DATA_DIR / "authors.json"
_VIDEO_DETAILS_JSONL = _BILI_DATA_DIR / "videoDetails.jsonl"
_RANKINGS_JSON = _BILI_DATA_DIR / "rankings.json"
_VIDEOS_JSON = _BILI_DATA_DIR / "videos.json"


@lru_cache(maxsize=1)
def load_rankings() -> dict[str, Any]:
    return json.loads(_RANKINGS_JSON.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_authors() -> dict[str, dict[str, Any]]:
    return json.loads(_AUTHORS_JSON.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def build_title_to_bvid() -> dict[str, str]:
    title_to_bvid: dict[str, str] = {}
    rankings = load_rankings()
    for items in rankings.values():
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            bvid = item.get("id")
            title = item.get("title")
            title_key = str(title or "").strip()
            if bvid and title_key and title_key not in title_to_bvid:
                title_to_bvid[title_key] = str(bvid)
    return title_to_bvid


@lru_cache(maxsize=1)
def load_videos() -> list[dict[str, Any]]:
    """videos.json 是 Bilibili 视频大库，每条含 id/title/author/plays/date/... 。"""
    return json.loads(_VIDEOS_JSON.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _videos_by_bvid() -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for item in load_videos():
        if not isinstance(item, dict):
            continue
        bvid = item.get("id")
        if bvid:
            out[str(bvid)] = item
    return out


@lru_cache(maxsize=1)
def _videos_by_author() -> dict[str, list[dict[str, Any]]]:
    out: dict[str, list[dict[str, Any]]] = {}
    for item in load_videos():
        if not isinstance(item, dict):
            continue
        author = str(item.get("author") or "").strip()
        if not author:
            continue
        out.setdefault(author, []).append(item)
    return out


@lru_cache(maxsize=1)
def load_video_details() -> dict[str, dict[str, Any]]:
    data: dict[str, dict[str, Any]] = {}
    with _VIDEO_DETAILS_JSONL.open("r", encoding="utf-8") as file:
        for line in file:
            row = line.strip()
            if not row:
                continue
            obj = json.loads(row)
            bvid = str(obj["bvid"])
            data[bvid] = obj
    return data


def norm_name(value: str) -> str:
    return str(value or "").strip().lower().replace(" ", "")


def route_query(path: str, key: str) -> str:
    try:
        return (parse_qs(urlsplit(str(path or "")).query).get(key) or [""])[0]
    except Exception:
        return ""


def norm_text(value: str) -> str:
    return re.sub(
        r"[\s,，。.;；、:：()\[\]{}<>《》\u201c\u201d\"'`~!@#$%^&*_+=?|\\/-]+",
        "",
        str(value or ""),
    )


def norm_ip_location(value: str) -> str:
    raw = str(value or "").strip()
    raw = raw.replace("IP属地：", "").replace("IP属地:", "")
    return norm_text(raw)


def format_compact_stat(value: int | float | str) -> str:
    if isinstance(value, str) and ("万" in value or "亿" in value):
        return value
    num = float(value)
    if num >= 100000000:
        return f"{num / 100000000:.1f}亿"
    if num >= 10000:
        return f"{num / 10000:.1f}万"
    return str(int(num)) if num.is_integer() else f"{num:g}"


def compact_stat_labels(value: int | float | str, *, include_exact: bool = True) -> list[str]:
    """生成 B 站数字的常见可见表达，如 118.7万 / 118.7 万。"""
    labels: list[str] = []
    if include_exact:
        try:
            num = float(value)
            labels.append(str(int(num)) if num.is_integer() else f"{num:g}")
        except (TypeError, ValueError):
            pass

    compact = format_compact_stat(value)
    labels.append(compact)
    compact_no_space = compact.replace(" ", "")
    match = re.fullmatch(r"(.+?)([万亿])", compact_no_space)
    if match:
        labels.append(f"{match.group(1)} {match.group(2)}")

    deduped: list[str] = []
    for label in labels:
        if label and label not in deduped:
            deduped.append(label)
    return deduped


_CN_COUNT_LABELS = {
    0: "零",
    1: "一",
    2: "二",
    3: "三",
    4: "四",
    5: "五",
    6: "六",
    7: "七",
    8: "八",
    9: "九",
    10: "十",
}


def video_count_labels(count: int) -> list[str]:
    """生成视频数量的常见表达，用于消息子串匹配。"""
    labels = [
        f"{count}个",
        f"{count} 个",
        f"{count}条",
        f"{count} 条",
        f"{count}部",
        f"{count} 部",
        f"{count}支",
        f"{count} 支",
        f"数量{count}",
        f"数量：{count}",
        f"数量: {count}",
        f"视频数{count}",
        f"视频数：{count}",
        f"视频数: {count}",
    ]
    if count in _CN_COUNT_LABELS:
        cn = _CN_COUNT_LABELS[count]
        labels.extend([
            f"{cn}个",
            f"{cn} 个",
            f"{cn}条",
            f"{cn} 条",
            f"{cn}部",
            f"{cn} 部",
            f"{cn}支",
            f"{cn} 支",
        ])
    return labels


def subscribed_titles(items: Any) -> set[str]:
    if not isinstance(items, list):
        return set()
    titles: set[str] = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        if title:
            titles.add(title)
    return titles


class Bilibili(BaseApp):
    @property
    def user(self) -> dict[str, Any]:
        return self._state["user"]

    def check_vip_opened(self, *, field: str = "bilibili.membership.opened") -> dict[str, Any]:
        actual = {
            "isVip": bool(self.user.get("isVip")),
            "vipExpireAt": self.user.get("vipExpireAt"),
        }
        return {
            "field": field,
            "expected": True,
            "actual": actual,
            "passed": actual["isVip"] and actual["vipExpireAt"] is not None,
        }

    def get_video_interaction_status(self, vid: str) -> dict[str, bool]:
        video_id = str(vid)
        coined_coins = self.user.get("coinedVideoCoins") or {}
        return {
            "liked": video_id in self.user["likedVideoIds"],
            "disliked": video_id in self.user["dislikedVideoIds"],
            "coined": coined_coins.get(video_id, 0) > 0,
            "favored": any(
                video_id in folder["videoIds"]
                for folder in self.user["favoritesFolders"]
            ),
        }

    def is_following(self, mid: str | int) -> bool:
        mid_str = str(mid)
        return any(str(item["mid"]) == mid_str for item in self.user["followingList"])

    def is_following_by_name(self, name: str) -> bool:
        target = norm_name(name)
        for item in self.get_user_following_list():
            if norm_name(str(item["name"])) == target:
                return True
        return False

    def get_search_history(self) -> list[str]:
        return self.user["searchHistory"]

    def get_coins(self) -> int:
        return int(self.user["coins"])

    def get_sign(self) -> str:
        return str(self.user["sign"])

    def get_nickname(self) -> str:
        return str(self.user["name"])

    def get_active_video_id(self) -> str | None:
        value = self.get("activeVideoId", None)
        return str(value) if value is not None else None

    def get_user_following_list(self) -> list[dict[str, Any]]:
        return self.user["followingList"]

    def recommended_mid_by_name(self, name: str) -> str:
        target = norm_name(name)
        for item in self.get("recommendedUp", []):
            if not isinstance(item, dict):
                continue
            if norm_name(str(item.get("name") or "")) == target:
                return str(item["id"])
        return ""

    def recommended_mids(self) -> list[str]:
        mids: list[str] = []
        for item in self.get("recommendedUp", []):
            if isinstance(item, dict) and item.get("id") is not None:
                mids.append(str(item["id"]))
        return mids

    def resolve_mid_by_name(self, name: str) -> str:
        if mid := self.recommended_mid_by_name(name):
            return mid
        return self.mid_from_name(name)

    def profile_stat(self, stat: str) -> int:
        if stat == "coins":
            return int(self.user["coins"])
        if stat == "following":
            return len(self.user["followingList"])
        if stat == "followers":
            return len(self.user["followersList"])
        if stat == "b_coins":
            return int(self.user["bCoins"])
        raise ValueError(f"Unsupported bilibili profile stat: {stat}")

    def folder_by_title(self, title: str) -> dict[str, Any]:
        for folder in self.user["favoritesFolders"]:
            if str(folder["title"]) == title:
                return folder
        raise ValueError(f"Bilibili favorites folder not found: {title}")

    def folder_video_count(self, title: str) -> int:
        folder = self.folder_by_title(title)
        return len(folder["videoIds"])

    # -- Check methods (§1.2.2: return single dict) -------------------------

    def check_following(self, up_name: str, *, expected: bool = True,
                        field: str | None = None) -> dict[str, Any]:
        mid = self.resolve_mid_by_name(up_name)
        following = self.is_following(mid) or self.is_following_by_name(up_name)
        passed = following if expected else not following
        default_field = "following" if expected else "unfollowed"
        return {"field": field or default_field, "expected": expected,
                "actual": following, "passed": passed}

    def check_coined(self, title: str, *, field: str | None = None) -> dict[str, Any]:
        video_id = self.bvid_from_title(title)
        return self.check_coined_bvid(video_id, video_title=title, field=field)

    def check_coined_bvid(
        self,
        bvid: str,
        *,
        video_title: str | None = None,
        field: str | None = None,
    ) -> dict[str, Any]:
        video_id = str(bvid)
        coined = self.get_video_interaction_status(video_id)["coined"]
        return {"field": field or "coined", "expected": video_title or video_id,
                "actual": coined, "passed": coined}

    def check_liked(self, title: str, *, field: str | None = None) -> dict[str, Any]:
        video_id = self.bvid_from_title(title)
        return self.check_liked_bvid(video_id, video_title=title, field=field)

    def check_liked_bvid(
        self,
        bvid: str,
        *,
        video_title: str | None = None,
        field: str | None = None,
    ) -> dict[str, Any]:
        video_id = str(bvid)
        liked = self.get_video_interaction_status(video_id)["liked"]
        return {"field": field or "liked", "expected": video_title or video_id,
                "actual": liked, "passed": liked}

    def check_favored(self, title: str, *, field: str | None = None) -> dict[str, Any]:
        video_id = self.bvid_from_title(title)
        return self.check_favored_bvid(video_id, video_title=title, field=field)

    def check_favored_bvid(
        self,
        bvid: str,
        *,
        video_title: str | None = None,
        field: str | None = None,
    ) -> dict[str, Any]:
        video_id = str(bvid)
        favored = self.get_video_interaction_status(video_id)["favored"]
        return {"field": field or "favored", "expected": video_title or video_id,
                "actual": favored, "passed": favored}

    def check_active_video(self, title: str, *, field: str | None = None) -> dict[str, Any]:
        video_id = self.bvid_from_title(title)
        actual = self.get_active_video_id()
        return {"field": field or "activeVideoId", "expected": video_id,
                "actual": actual, "passed": actual == video_id}

    def check_anime_subscribed(self, anime_title: str, *, expected: bool = True,
                               field: str | None = None) -> dict[str, Any]:
        subscribed = any(
            str(item["title"]) == str(anime_title)
            for item in self.user["subscribedAnime"]
        )
        passed = subscribed if expected else not subscribed
        default_field = "anime_subscribed" if expected else "anime_removed"
        return {"field": field or default_field, "expected": expected,
                "actual": subscribed, "passed": passed}

    def check_search_history_cleared(self, *, field: str | None = None) -> dict[str, Any]:
        cleared = len(self.get_search_history()) == 0
        return {"field": field or "search_history_cleared", "expected": True,
                "actual": cleared, "passed": cleared}

    def check_birthday(self, expected_date: str, *, field: str | None = None) -> dict[str, Any]:
        actual = str(self.user["birthday"])
        return {"field": field or "birthday", "expected": expected_date,
                "actual": actual, "passed": actual == expected_date}

    def check_folder_contains(self, folder_title: str, video_title: str, *,
                              field: str | None = None) -> dict[str, Any]:
        folder = self.folder_by_title(folder_title)
        video_id = self.bvid_from_title(video_title)
        return self.check_folder_contains_bvid(
            folder_title,
            video_id,
            video_title=video_title,
            field=field,
        )

    def check_folder_contains_bvid(
        self,
        folder_title: str,
        bvid: str,
        *,
        video_title: str | None = None,
        field: str | None = None,
    ) -> dict[str, Any]:
        folder = self.folder_by_title(folder_title)
        video_id = str(bvid)
        contains = video_id in folder["videoIds"]
        return {"field": field or f"folder_{folder_title}", "expected": video_title or video_id,
                "actual": contains, "passed": contains}

    @classmethod
    def mid_from_name(cls, name: str) -> str:
        raw_name = str(name or "").strip()
        if raw_name in AUTHOR_NAME_TO_MID:
            return AUTHOR_NAME_TO_MID[raw_name]
        target = norm_name(raw_name)
        for key, value in load_authors().items():
            author = value
            if norm_name(str(author.get("name") or "")) == target:
                return key
        raise ValueError(f"Bilibili author not found: {name}")

    @classmethod
    def author_by_mid(cls, mid: str | int) -> dict[str, Any]:
        mid_str = str(mid)
        authors = load_authors()
        if mid_str not in authors:
            raise ValueError(f"Bilibili author mid not found: {mid}")
        return authors[mid_str]

    @classmethod
    def author_by_name(cls, name: str) -> dict[str, Any]:
        return cls.author_by_mid(cls.mid_from_name(name))

    @classmethod
    def author_follower_display(cls, name: str) -> str:
        author = cls.author_by_name(name)
        return format_compact_stat(author["follower"])

    @classmethod
    def ranking_entry(cls, partition: str, rank: int) -> dict[str, Any]:
        items = load_rankings().get(partition)
        if not isinstance(items, list):
            raise ValueError(f"Bilibili ranking partition not found: {partition}")
        for item in items:
            if isinstance(item, dict) and int(item["rank"]) == int(rank):
                return item
        raise ValueError(f"Bilibili ranking entry not found: partition={partition}, rank={rank}")

    @classmethod
    def ranking_title(cls, partition: str, rank: int) -> str:
        return str(cls.ranking_entry(partition, rank)["title"])

    @classmethod
    def ranking_creator_keyword(cls, partition: str, rank: int) -> str:
        """排行榜 (partition, rank) 视频的 UP 主搜索关键词，等于 author 字段。"""
        return str(cls.ranking_video_entry(partition, rank).get("author", "")).strip()

    @classmethod
    def video_entry_by_bvid(cls, bvid: str) -> dict[str, Any]:
        """按 bvid 从 videos.json（大库）中读取视频条目（含 title/author/plays/date）。"""
        bvid_str = str(bvid or "")
        entry = _videos_by_bvid().get(bvid_str)
        if entry is None:
            raise ValueError(f"Bilibili video not found in videos.json: {bvid}")
        return entry

    @classmethod
    def ranking_video_entry(cls, partition: str, rank: int) -> dict[str, Any]:
        """排行榜 (partition, rank) 对应的完整视频条目。"""
        bvid = cls.ranking_entry(partition, rank)["id"]
        return cls.video_entry_by_bvid(str(bvid))

    @classmethod
    def ranking_author_name(cls, partition: str, rank: int) -> str:
        """排行榜 (partition, rank) 作者的显示名。"""
        return str(cls.ranking_video_entry(partition, rank)["author"])

    @classmethod
    def videos_by_author(cls, author_name: str) -> list[dict[str, Any]]:
        """按作者显示名从 videos.json 中找到所有视频。"""
        target = str(author_name or "").strip()
        if not target:
            return []
        return list(_videos_by_author().get(target, []))

    @classmethod
    def author_videos_in_year_month(
        cls, author_name: str, year: int, month: int
    ) -> list[dict[str, Any]]:
        """作者在指定 (year, month) 内发布的视频。date 字段为 Unix 秒。"""
        import datetime as _dt
        year_i = int(year)
        month_i = int(month)
        out: list[dict[str, Any]] = []
        for entry in cls.videos_by_author(author_name):
            ts = entry.get("date")
            if ts is None:
                continue
            try:
                dt = _dt.datetime.fromtimestamp(float(ts))
            except (TypeError, ValueError, OSError):
                continue
            if dt.year == year_i and dt.month == month_i:
                out.append(entry)
        return out

    @classmethod
    def author_top_played_video(cls, author_name: str) -> dict[str, Any]:
        """作者所有视频中 plays 最多的一条（并列取第一个）。"""
        videos = cls.videos_by_author(author_name)
        if not videos:
            raise ValueError(f"Bilibili author has no videos in dataset: {author_name}")
        return max(videos, key=lambda v: float(v.get("plays") or 0))

    @classmethod
    def author_top_played_video_in_year_month(
        cls, author_name: str, year: int, month: int
    ) -> dict[str, Any]:
        """作者在指定年月内 plays 最多的一条视频（并列取第一个）。"""
        videos = cls.author_videos_in_year_month(author_name, year, month)
        if not videos:
            raise ValueError(
                f"Bilibili author {author_name!r} has no videos in {int(year):04d}-{int(month):02d}"
            )
        return max(videos, key=lambda v: float(v.get("plays") or 0))

    @classmethod
    def author_follower_count(cls, author_name: str) -> int:
        """作者粉丝数（来自 authors.json），无法找到时回退 videos.json 里的 author 条目。"""
        try:
            return int(cls.author_by_name(author_name)["follower"])
        except ValueError:
            for entry in cls.videos_by_author(author_name):
                fans = entry.get("fans") or entry.get("follower")
                if fans is not None:
                    return int(fans)
            raise

    @classmethod
    def top_ranking_videos_by_plays(
        cls, partition: str, top_rank: int, *, top_n: int
    ) -> list[dict[str, Any]]:
        """排行榜前 top_rank 名里按 plays 降序取 top_n 条（并列按 rank 升序）；候选不足时抛错。"""
        items = load_rankings().get(partition)
        if not isinstance(items, list):
            raise ValueError(f"Bilibili ranking partition not found: {partition}")
        prefix = [item for item in items if isinstance(item, dict) and int(item.get("rank") or 0) <= int(top_rank)]
        detailed: list[dict[str, Any]] = []
        for item in prefix:
            entry = cls.video_entry_by_bvid(str(item["id"]))
            detailed.append({**entry, "rank": int(item["rank"])})
        detailed.sort(key=lambda v: (-float(v.get("plays") or 0), int(v.get("rank") or 0)))
        if int(top_n) <= 0:
            return []
        if len(detailed) < int(top_n):
            raise ValueError(
                f"Bilibili partition {partition!r} has only {len(detailed)} entries "
                f"within rank ≤ {top_rank}; expected ≥ {top_n}"
            )
        return detailed[: int(top_n)]

    def check_folder_created_with_videos(
        self,
        folder_title: str,
        video_titles: list[str],
        *,
        field: str | None = None,
    ) -> dict[str, Any]:
        """验证新建了名为 folder_title 的收藏夹，并包含且仅包含给定的 video_titles（顺序可乱）。"""
        return self.check_folder_created_with_bvids(
            folder_title,
            [self.bvid_from_title(title) for title in video_titles],
            video_titles=video_titles,
            field=field,
        )

    def check_folder_created_with_bvids(
        self,
        folder_title: str,
        bvids: list[str],
        *,
        video_titles: list[str] | None = None,
        field: str | None = None,
    ) -> dict[str, Any]:
        """验证新建了名为 folder_title 的收藏夹，并包含且仅包含给定的 bvids（顺序可乱）。"""
        if field is None:
            field = f"folder_{folder_title}"
        init_ids: set[str] = set()
        if self.has_init:
            init_ids = {
                str(folder.get("id") or "")
                for folder in self.init.user.get("favoritesFolders") or []
            }
        target_title = str(folder_title).strip()
        expected_bvids = {str(bvid) for bvid in bvids}
        expected_videos = list(video_titles) if video_titles is not None else sorted(expected_bvids)
        folders = self.user.get("favoritesFolders") or []
        matching = [
            folder for folder in folders
            if str(folder.get("title") or "").strip() == target_title
            and str(folder.get("id") or "") not in init_ids
        ]
        actual_folders = [
            {
                "title": folder.get("title"),
                "videoCount": len(folder.get("videoIds") or []),
            }
            for folder in folders
        ]
        for folder in matching:
            actual_bvids = {str(vid) for vid in folder.get("videoIds") or []}
            if actual_bvids == expected_bvids:
                return {
                    "field": field,
                    "expected": {"folder": target_title, "videos": expected_videos},
                    "actual": {
                        "folder": folder.get("title"),
                        "bvids": sorted(actual_bvids),
                    },
                    "passed": True,
                }
        return {
            "field": field,
            "expected": {"folder": target_title, "videos": expected_videos},
            "actual": actual_folders or "未找到新建收藏夹",
            "passed": False,
        }

    @classmethod
    def bvid_from_title(cls, title: str) -> str:
        title_str = str(title or "").strip()
        if title_str not in build_title_to_bvid():
            raise ValueError(f"Bilibili video title not found in rankings: {title}")
        return build_title_to_bvid()[title_str]

    @classmethod
    def video_detail(cls, bvid: str) -> dict[str, Any]:
        bvid_str = str(bvid or "")
        details = load_video_details()
        if bvid_str not in details:
            raise ValueError(f"Bilibili video detail not found: {bvid}")
        return details[bvid_str]

    @classmethod
    def comment_by_contains(cls, bvid: str, needle: str) -> dict[str, Any]:
        detail = cls.video_detail(bvid)
        target = str(needle or "")
        for comment in detail["comments"]:
            if isinstance(comment, dict) and target in str(comment.get("message") or ""):
                return comment
        raise ValueError(f"Bilibili comment snippet not found: {needle}")
