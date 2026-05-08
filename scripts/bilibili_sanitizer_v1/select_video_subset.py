#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BILIBILI_DATA = PROJECT_ROOT / "apps" / "Bilibili" / "data"
DEFAULT_OUT_ROOT = PROJECT_ROOT / "scripts" / "bilibili_sanitizer_v1" / "out" / "users_full_20260503"

PGC_PARTITIONS = {"番剧", "国创", "纪录片", "电影", "电视剧"}
TASK_RANKING_PARTITIONS = ["全站", "番剧", "国创", "纪录片", "电影", "电视剧"]


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def extract_video_id(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("id") or value.get("bvid") or value.get("videoId") or "")
    return str(value or "")


def collect_video_ids(obj: Any, video_ids: set[str]) -> set[str]:
    out: set[str] = set()
    if isinstance(obj, dict):
        for key, value in obj.items():
            if key in {"id", "videoId", "bvid", "activeVideoId"} and isinstance(value, (str, int)):
                raw = str(value)
                if raw in video_ids:
                    out.add(raw)
            out |= collect_video_ids(value, video_ids)
    elif isinstance(obj, list):
        for item in obj:
            out |= collect_video_ids(item, video_ids)
    elif isinstance(obj, str) and obj in video_ids:
        out.add(obj)
    return out


class Selector:
    def __init__(self, data_dir: Path, top_authors_per_ugc_partition: int) -> None:
        self.data_dir = data_dir
        self.top_authors_per_ugc_partition = top_authors_per_ugc_partition
        self.videos = read_json(data_dir / "videos.json")
        self.rankings = read_json(data_dir / "rankings.json")
        self.authors = read_json(data_dir / "authors.json")
        self.video_by_id = {
            str(row.get("id")): row
            for row in self.videos
            if isinstance(row, dict) and row.get("id")
        }
        self.video_ids = set(self.video_by_id)
        self.name_to_mids: dict[str, list[str]] = defaultdict(list)
        for mid, author in self.authors.items():
            name = str(author.get("name") or "").strip()
            if name:
                self.name_to_mids[name].append(str(mid))
        self.partition_by_id: dict[str, str] = {}
        for video in self.videos:
            if not isinstance(video, dict) or not video.get("id"):
                continue
            partition = str(video.get("partition") or "").strip()
            if partition:
                self.partition_by_id[str(video["id"])] = partition

    def add_reason(self, reasons: dict[str, set[str]], video_id: str, reason: str) -> None:
        if video_id in self.video_ids:
            reasons.setdefault(video_id, set()).add(reason)

    def author_mids_for_ranking_entry(self, item: dict[str, Any]) -> list[str]:
        video_id = str(item.get("id") or "")
        video = self.video_by_id.get(video_id)
        author_name = str((video or {}).get("author") or item.get("author") or "").strip()
        return self.name_to_mids.get(author_name, [])

    def add_author_videos(self, reasons: dict[str, set[str]], mids: set[str], reason: str) -> None:
        for mid in mids:
            author = self.authors.get(str(mid), {})
            for item in author.get("videos") or []:
                video_id = extract_video_id(item)
                self.add_reason(reasons, video_id, reason)

    def ranking_author_mids_by_partition(self) -> dict[str, list[str]]:
        out: dict[str, list[str]] = defaultdict(list)
        for partition, items in self.rankings.items():
            if not isinstance(items, list):
                continue
            seen: set[str] = set()
            rows = sorted(
                [item for item in items if isinstance(item, dict)],
                key=lambda item: int(item.get("rank") or 10**9),
            )
            for item in rows:
                video_id = str(item.get("id") or "")
                if video_id:
                    self.partition_by_id.setdefault(video_id, str(partition))
                for mid in self.author_mids_for_ranking_entry(item):
                    if mid not in seen:
                        out[str(partition)].append(mid)
                        seen.add(mid)
        return out

    def task_ranking_author_mids(self) -> set[str]:
        out: set[str] = set()

        def add_rank(partition: str, rank: int) -> None:
            for item in self.rankings.get(partition, []):
                if isinstance(item, dict) and int(item.get("rank") or 0) == int(rank):
                    out.update(self.author_mids_for_ranking_entry(item))

        for partition in TASK_RANKING_PARTITIONS:
            for rank in range(1, 16):
                add_rank(partition, rank)
        add_rank("舞蹈", 10)
        for rank in range(1, 21):
            add_rank("娱乐", rank)
        return out

    def select(self) -> tuple[dict[str, set[str]], dict[str, Any]]:
        reasons: dict[str, set[str]] = {}

        for video in self.videos:
            if not isinstance(video, dict) or not video.get("id"):
                continue
            video_id = str(video["id"])
            partition = str(video.get("partition") or "").strip()
            if partition:
                self.add_reason(reasons, video_id, "all_non_empty_partition")
            if partition in PGC_PARTITIONS:
                self.add_reason(reasons, video_id, "pgc_all")

        for partition, items in self.rankings.items():
            if not isinstance(items, list):
                continue
            for item in items:
                if isinstance(item, dict) and item.get("id"):
                    video_id = str(item["id"])
                    self.partition_by_id.setdefault(video_id, str(partition))
                    self.add_reason(reasons, video_id, "ranking_video")

        for name, reason in [
            ("defaults.json", "defaults_reference"),
            ("hot.json", "hot_reference"),
            ("recommend.json", "recommend_reference"),
            ("videoComments.json", "comments_reference"),
            ("videoTags.json", "tags_reference"),
            ("videoOnline.json", "online_reference"),
        ]:
            path = self.data_dir / name
            if path.exists():
                for video_id in collect_video_ids(read_json(path), self.video_ids):
                    self.add_reason(reasons, video_id, reason)
        details_path = self.data_dir / "videoDetails.jsonl"
        if details_path.exists():
            with details_path.open(encoding="utf-8") as file:
                for line in file:
                    if not line.strip():
                        continue
                    video_id = str(json.loads(line).get("bvid") or "")
                    self.add_reason(reasons, video_id, "details_reference")

        ranking_mids = self.ranking_author_mids_by_partition()
        task_mids = self.task_ranking_author_mids()
        main_mids = set(task_mids)
        main_mids.update(ranking_mids.get("全站", []))
        for partition, mids in ranking_mids.items():
            if partition in PGC_PARTITIONS or partition == "全站":
                continue
            main_mids.update(mids[: self.top_authors_per_ugc_partition])

        self.add_author_videos(reasons, task_mids, "task_ranking_author_profile")
        self.add_author_videos(reasons, set(ranking_mids.get("全站", [])), "ranking_author_profile:全站")
        for partition, mids in ranking_mids.items():
            if partition in PGC_PARTITIONS or partition == "全站":
                continue
            self.add_author_videos(
                reasons,
                set(mids[: self.top_authors_per_ugc_partition]),
                f"ranking_author_profile:{partition}:top{self.top_authors_per_ugc_partition}",
            )

        partition_counts: Counter[str] = Counter()
        kind_counts: Counter[str] = Counter()
        for video_id in reasons:
            video = self.video_by_id[video_id]
            partition = self.partition_by_id.get(video_id) or str(video.get("partition") or "").strip() or "(empty)"
            partition_counts[partition] += 1
            kind_counts["PGC" if partition in PGC_PARTITIONS else "UGC"] += 1

        report = {
            "strategy": {
                "pgcPartitions": sorted(PGC_PARTITIONS),
                "topAuthorsPerUgcRankingPartition": self.top_authors_per_ugc_partition,
                "rules": [
                    "keep all videos with non-empty partition",
                    "keep all ranking videos",
                    "keep all hot/recommend/defaults/comments/tags/online/details referenced videos",
                    "keep all task-reachable ranking author profile videos",
                    "keep all 全站 ranking author profile videos",
                    f"keep top {self.top_authors_per_ugc_partition} author profile videos for each non-PGC ranking partition",
                ],
            },
            "selectedVideoCount": len(reasons),
            "selectedKindCounts": dict(kind_counts),
            "selectedPartitionCounts": dict(sorted(partition_counts.items())),
            "selectedAuthorCount": len(main_mids),
            "taskRankingAuthorCount": len(task_mids),
        }
        return reasons, report


def main() -> None:
    parser = argparse.ArgumentParser(description="Select a compact Bilibili video subset for sanitized data and cover generation.")
    parser.add_argument("--data-dir", type=Path, default=BILIBILI_DATA)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_ROOT / "selection_k40")
    parser.add_argument("--top-authors-per-ugc-partition", type=int, default=40)
    args = parser.parse_args()

    selector = Selector(args.data_dir, args.top_authors_per_ugc_partition)
    reasons, report = selector.select()
    args.out_dir.mkdir(parents=True, exist_ok=True)

    selected_ids = sorted(reasons)
    (args.out_dir / "selected_video_ids.txt").write_text("\n".join(selected_ids) + "\n", encoding="utf-8")
    with (args.out_dir / "selected_videos.jsonl").open("w", encoding="utf-8") as file:
        for video_id in selected_ids:
            video = selector.video_by_id[video_id]
            partition = selector.partition_by_id.get(video_id) or str(video.get("partition") or "").strip() or ""
            file.write(
                json.dumps(
                    {
                        "id": video_id,
                        "partition": partition,
                        "title": video.get("title"),
                        "author": video.get("author"),
                        "reasons": sorted(reasons[video_id]),
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
    (args.out_dir / "selection_report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
