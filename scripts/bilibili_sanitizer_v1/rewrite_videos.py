#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

try:
    from tqdm import tqdm
except ImportError:  # pragma: no cover
    tqdm = None

from io_utils import OUTPUT_ROOT, append_jsonl, batched, load_authors, load_video_tags, load_videos, read_jsonl_map
from openai_v1 import chat_json


VIDEO_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "tags": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["title", "tags"],
    "additionalProperties": False,
}


SYSTEM = """你是 Bilibili 视频文本脱敏改写员。
目标：保留视频分区、题材、情绪、任务可读性和真实 B 站标题风格，但不能通过标题/标签/作者名搜索回原视频。
规则：
1. 每次只处理一个视频，输出严格 JSON。
2. 只输出 title、tags。
3. title 要保持原视频的大致类型，例如测评、教程、游戏解说、影视吐槽、生活记录、排行榜短视频；不要改成完全无关题材。
4. 不要生成或改写作者名；作者名由用户映射统一处理。
5. 公开人物、运动员、演员、导演、歌手、历史人物、作品名、角色名、游戏名、影视名、音乐名等公共语境名称，如果是理解视频所必需，应该保留。
6. 不要把原文中的具体名称替换成另一个真实具体名称；如果不保留，应改成中性泛称或虚构称呼。
7. 不要凭空新增原文没有的领域标签、场景标签或事件类型；例如不要把一种运动、作品、活动、地点改成另一种。
8. 普通 UP 主昵称、普通用户昵称、联系方式、账号、URL、UID、群号、邮箱、手机号必须删除、泛化或虚构化。
9. tags 使用泛化或虚构标签，不保留可搜索的长短句、真实账号或联系方式。
10. 输出不要包含“脱敏”“改写”等元信息。"""


def _video_author_mid_map() -> dict[str, str]:
    out: dict[str, str] = {}
    for mid, author in load_authors().items():
        for video in author.get("videos", []) or []:
            video_id = str(video.get("id", ""))
            if video_id:
                out[video_id] = mid
    return out


def _fallback_author_name(original_author: str) -> str:
    adjectives = [
        "青柚",
        "云岭",
        "星河",
        "松间",
        "南窗",
        "澄夏",
        "半醒",
        "北岸",
        "微光",
        "远山",
        "拾光",
        "晴川",
    ]
    nouns = [
        "观察室",
        "放映间",
        "剪辑铺",
        "记录所",
        "频道",
        "研究社",
        "小剧场",
        "工作台",
        "实验室",
        "漫谈社",
        "情报站",
        "杂货铺",
    ]
    seed = sum((index + 1) * ord(ch) for index, ch in enumerate(original_author or "作者"))
    return f"{adjectives[seed % len(adjectives)]}{nouns[(seed // len(adjectives)) % len(nouns)]}"


def _similarity(a: Any, b: Any) -> float:
    left = " ".join(str(a or "").split())
    right = " ".join(str(b or "").split())
    if not left and not right:
        return 1.0
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def main() -> None:
    parser = argparse.ArgumentParser(description="Rewrite Bilibili video titles/tags/authors with a local OpenAI-compatible model.")
    parser.add_argument("--out", type=Path, default=OUTPUT_ROOT / "videos.jsonl")
    parser.add_argument("--users", type=Path, default=OUTPUT_ROOT / "users.jsonl")
    parser.add_argument("--model", default=os.environ.get("BILIBILI_TEXT_MODEL", "local-model"))
    parser.add_argument("--limit", type=int)
    parser.add_argument("--ids", nargs="+", help="Specific video ids to rewrite.")
    parser.add_argument("--concurrency", type=int, default=1)
    parser.add_argument("--retries", type=int, default=2, help="Retries per failed video.")
    parser.add_argument("--failures", type=Path, help="JSONL file for failed videos; default is <out>.failures.jsonl.")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    videos = load_videos()
    tags_by_id = load_video_tags()
    done = {} if args.force else read_jsonl_map(args.out, "id")
    rewritten_users = read_jsonl_map(args.users, "key") if args.users else {}
    author_mid_by_video = _video_author_mid_map()
    author_mid_by_name = {str(author.get("name", "")): str(mid) for mid, author in load_authors().items()}
    requested_ids = set(args.ids or [])
    pending = [
        video
        for video in videos
        if (not requested_ids or str(video["id"]) in requested_ids) and str(video["id"]) not in done
    ]
    iterable = list(batched(pending, args.limit))
    failures_path = args.failures or args.out.with_name(f"{args.out.stem}.failures.jsonl")
    if args.force and failures_path.exists():
        failures_path.unlink()

    pbar = tqdm(total=len(iterable), desc="videos", unit="video", smoothing=0.1) if tqdm else None
    write_lock = threading.Lock()
    failure_count = 0

    def process(video: dict[str, Any]) -> None:
        nonlocal failure_count
        video_id = str(video.get("id", ""))
        author_mid = author_mid_by_video.get(video_id)
        if not author_mid:
            author_mid = author_mid_by_name.get(str(video.get("author", "")))
        rewritten_author = rewritten_users.get(f"author:{author_mid}") if author_mid else None
        payload = {
            "title": video.get("title", ""),
            "tags": tags_by_id.get(video_id, []),
            "duration": video.get("duration", ""),
        }
        last_error: Exception | None = None
        result: dict[str, Any] | None = None
        for attempt in range(args.retries + 1):
            try:
                candidate = chat_json(
                    model=args.model,
                    system=SYSTEM,
                    user_content="请改写这个 Bilibili 视频文本，输出 JSON：\n"
                    + json.dumps(payload, ensure_ascii=False, indent=2),
                    schema_name="bilibili_video_rewrite",
                    schema=VIDEO_SCHEMA,
                )
                if not str(candidate.get("title", "")).strip():
                    raise RuntimeError("model returned empty title")
                tags = candidate.get("tags")
                if not isinstance(tags, list) or not tags:
                    raise RuntimeError("model returned empty tags")
                title_similarity = _similarity(video.get("title", ""), candidate.get("title", ""))
                if len(str(video.get("title", "")).strip()) >= 6 and title_similarity >= 0.72:
                    raise RuntimeError(f"title too close to original: {title_similarity:.3f}")
                original_tags = " ".join(str(tag) for tag in tags_by_id.get(video_id, []) or [])
                rewritten_tags = " ".join(str(tag) for tag in tags)
                tags_similarity = _similarity(original_tags, rewritten_tags)
                if len(original_tags.strip()) >= 6 and tags_similarity >= 0.72:
                    raise RuntimeError(f"tags too close to original: {tags_similarity:.3f}")
                result = candidate
                break
            except Exception as exc:
                last_error = exc
                if attempt < args.retries:
                    time.sleep(min(2**attempt, 5))
        if result is None:
            with write_lock:
                append_jsonl(
                    failures_path,
                    {
                        "kind": "video_failed",
                        "id": video_id,
                        "error": str(last_error),
                    },
                )
                failure_count += 1
                print(f"ERROR video {video_id}: {last_error}")
                if pbar:
                    pbar.update(1)
            return
        if rewritten_author and rewritten_author.get("name"):
            result["author"] = rewritten_author["name"]
        else:
            result["author"] = _fallback_author_name(str(video.get("author", "")))
        result["id"] = video_id
        with write_lock:
            append_jsonl(args.out, result)
            if pbar:
                pbar.set_postfix_str(result.get("title", "")[:30])
                pbar.update(1)

    try:
        if args.concurrency <= 1:
            for video in iterable:
                process(video)
        else:
            with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
                futures = [ex.submit(process, video) for video in iterable]
                for future in as_completed(futures):
                    future.result()
    finally:
        if pbar:
            pbar.close()
    if failure_count:
        print(f"FAILED videos: {failure_count}; see {failures_path}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
