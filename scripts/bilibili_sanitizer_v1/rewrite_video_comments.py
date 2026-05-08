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

from io_utils import OUTPUT_ROOT, append_jsonl, batched, load_video_comments, load_videos, read_jsonl_map
from openai_v1 import chat_text


SYSTEM = """你是 Bilibili 评论区脱敏改写员。
目标：保留评论区讨论关系、口吻、情绪和梗的密度，但不能搜索回原评论或识别原评论者。
规则：
1. 输入每行是一条评论，格式是：路径<TAB>评论者显示名<TAB>原评论。
2. 输出必须覆盖每个输入路径，路径必须原样保留。
3. 每个输出行格式是：路径<TAB>新评论。
3. 评论者昵称由外部用户映射统一处理，你不要生成或改写昵称。
4. message 要保持评论的语义方向和口吻，例如补充解释、吐槽、玩梗、反驳、提问、感谢，但不能复制原句。
5. @原昵称、联系方式、账号、URL、个人姓名、学校/公司/机构等要删除、泛化或虚构化。
6. 公开人物、运动员、演员、导演、歌手、历史人物、作品名、角色名、游戏名、影视名、音乐名等公共语境名称，如果是理解评论所必需，应该保留。
7. 不要把原文中的具体名称替换成另一个真实具体名称；如果不保留，应改成中性泛称或虚构称呼。
8. 不要写“脱敏后”“已删除”等处理痕迹。
9. 字段内不要出现换行或制表符。
10. 不要输出编号、解释或 Markdown。"""


def _commenter_name(comment: dict[str, Any], user_rewrites: dict[str, dict[str, Any]]) -> str:
    mid = str(comment.get("mid", ""))
    hint = user_rewrites.get(f"commenter:{mid}") or {}
    return str(hint.get("name") or "用户")


def _trim_comment(comment: dict[str, Any], user_rewrites: dict[str, dict[str, Any]]) -> dict[str, Any]:
    replies = comment.get("replies") or []
    return {
        "displayName": _commenter_name(comment, user_rewrites),
        "message": comment.get("message", ""),
        "replies": [_trim_comment(reply, user_rewrites) for reply in replies] if isinstance(replies, list) else [],
    }


def _cell(value: Any) -> str:
    return str(value or "").replace("\t", " ").replace("\r", " ").replace("\n", " ").strip()


def _flatten_comment_paths(
    comments: list[dict[str, Any]],
    user_rewrites: dict[str, dict[str, Any]],
    prefix: str = "",
) -> list[tuple[str, dict[str, Any], str]]:
    rows: list[tuple[str, dict[str, Any], str]] = []
    for index, comment in enumerate(comments):
        path = f"{prefix}.{index}" if prefix else str(index)
        rows.append((path, comment, _commenter_name(comment, user_rewrites)))
        replies = comment.get("replies") or []
        if isinstance(replies, list):
            rows.extend(_flatten_comment_paths(replies, user_rewrites, path))
    return rows


def _parse_comment_lines(text: str, expected_paths: list[str]) -> dict[str, str]:
    expected = set(expected_paths)
    rows: dict[str, str] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("```"):
            continue
        parts = line.split("\t", 1)
        if len(parts) < 2:
            parts = line.split(None, 1)
        if len(parts) < 2:
            continue
        path = parts[0].strip()
        if path in expected:
            rows[path] = parts[1].strip()
    missing = [path for path in expected_paths if path not in rows]
    if missing:
        raise RuntimeError(f"model missed comment paths {missing[:10]}")
    return rows


def _similarity(a: Any, b: Any) -> float:
    left = " ".join(str(a or "").split())
    right = " ".join(str(b or "").split())
    if not left and not right:
        return 1.0
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def _validate_comment_message(original: Any, rewritten: Any) -> None:
    original_text = _cell(original)
    rewritten_text = _cell(rewritten)
    if original_text and not rewritten_text:
        raise RuntimeError("model returned empty comment message")
    if original_text and rewritten_text and original_text == rewritten_text and len(original_text) >= 3:
        raise RuntimeError(f"comment message unchanged: {original_text!r}")
    if len(original_text) >= 6:
        message_similarity = _similarity(original_text, rewritten_text)
        if message_similarity >= 0.72:
            raise RuntimeError(f"comment message too close to original: {message_similarity:.3f}")


def _merge_comment_tree(
    original: dict[str, Any],
    rewritten_by_path: dict[str, str],
    user_rewrites: dict[str, dict[str, Any]],
    path: str,
) -> dict[str, Any]:
    original_replies = original.get("replies") or []
    if not isinstance(original_replies, list):
        original_replies = []
    return {
        "rpid": str(original.get("rpid", "")),
        "mid": str(original.get("mid", "")),
        "uname": _commenter_name(original, user_rewrites),
        "message": rewritten_by_path.get(path, original.get("message", "")),
        "replies": [
            _merge_comment_tree(orig_reply, rewritten_by_path, user_rewrites, f"{path}.{index}")
            for index, orig_reply in enumerate(original_replies)
        ],
    }


def _validate_comment_tree(original: dict[str, Any], rewritten: Any, path: str) -> list[str]:
    if not isinstance(rewritten, dict):
        return [f"{path} is not an object"]
    errors: list[str] = []
    if "message" not in rewritten:
        errors.append(f"{path}.message missing")
    if "replies" not in rewritten:
        errors.append(f"{path}.replies missing")
        return errors
    original_replies = original.get("replies") or []
    rewritten_replies = rewritten.get("replies")
    if not isinstance(original_replies, list):
        original_replies = []
    if not isinstance(rewritten_replies, list):
        errors.append(f"{path}.replies is not a list")
        return errors
    if len(rewritten_replies) != len(original_replies):
        errors.append(f"{path}.replies length {len(rewritten_replies)} != {len(original_replies)}")
        return errors
    for index, (orig_reply, rw_reply) in enumerate(zip(original_replies, rewritten_replies)):
        errors.extend(_validate_comment_tree(orig_reply, rw_reply, f"{path}.replies[{index}]"))
    return errors


def _validate_comment_forest(originals: list[dict[str, Any]], rewritten: Any) -> list[str]:
    if not isinstance(rewritten, list):
        return ["comments is not a list"]
    if len(rewritten) != len(originals):
        return [f"comments length {len(rewritten)} != {len(originals)}"]
    errors: list[str] = []
    for index, (original, rewrite) in enumerate(zip(originals, rewritten)):
        errors.extend(_validate_comment_tree(original, rewrite, f"comments[{index}]"))
    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Rewrite Bilibili video comments with a local OpenAI-compatible model.")
    parser.add_argument("--out", type=Path, default=OUTPUT_ROOT / "video_comments.jsonl")
    parser.add_argument("--users", type=Path, default=OUTPUT_ROOT / "users.jsonl")
    parser.add_argument("--videos", type=Path, default=OUTPUT_ROOT / "videos.jsonl")
    parser.add_argument("--model", default=os.environ.get("BILIBILI_TEXT_MODEL", "local-model"))
    parser.add_argument("--limit", type=int, help="Total video comment threads to rewrite in this run.")
    parser.add_argument("--ids", nargs="+", help="Specific video ids to rewrite; useful for targeted validation.")
    parser.add_argument("--concurrency", type=int, default=1)
    parser.add_argument("--retries", type=int, default=2, help="Retries per failed comment thread.")
    parser.add_argument("--failures", type=Path, help="JSONL file for failed comment threads; default is <out>.failures.jsonl.")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    comments_by_video = load_video_comments()
    videos_by_id = {str(video["id"]): video for video in load_videos()}
    video_rewrites = read_jsonl_map(args.videos, "id") if args.videos else {}
    user_rewrites = read_jsonl_map(args.users, "key") if args.users else {}
    done = {} if args.force else read_jsonl_map(args.out, "id")
    source_ids = args.ids if args.ids else list(comments_by_video.keys())
    pending_ids = [video_id for video_id in source_ids if video_id in comments_by_video and video_id not in done]
    iterable = list(batched(pending_ids, args.limit))
    failures_path = args.failures or args.out.with_name(f"{args.out.stem}.failures.jsonl")
    if args.force and failures_path.exists():
        failures_path.unlink()

    pbar = tqdm(total=len(iterable), desc="comments", unit="video", smoothing=0.1) if tqdm else None
    write_lock = threading.Lock()
    failure_count = 0

    def process(video_id: str) -> None:
        nonlocal failure_count
        original = comments_by_video.get(video_id, {})
        comments = original.get("comments") or []
        video_title = video_rewrites.get(video_id, {}).get("title") or videos_by_id.get(video_id, {}).get("title", "")
        flattened = _flatten_comment_paths(comments, user_rewrites)
        if not flattened:
            with write_lock:
                append_jsonl(args.out, {"id": video_id, "comments": []})
                if pbar:
                    pbar.set_postfix_str(video_id)
                    pbar.update(1)
            return
        last_error: Exception | None = None
        rewritten_by_path: dict[str, str] | None = None
        for attempt in range(args.retries + 1):
            try:
                input_lines = [
                    f"{path}\t{_cell(display_name)}\t{_cell(comment.get('message', ''))}"
                    for path, comment, display_name in flattened
                ]
                output_text = chat_text(
                    model=args.model,
                    system=SYSTEM,
                    user_content=(
                        "请逐行改写这个 Bilibili 视频评论区，只输出 TSV。\n"
                        f"视频标题：{_cell(video_title)}\n"
                        + "\n".join(input_lines)
                    ),
                )
                rewritten_by_path = _parse_comment_lines(output_text, [path for path, _, _ in flattened])
                for path, comment, _ in flattened:
                    _validate_comment_message(comment.get("message", ""), rewritten_by_path[path])
                break
            except Exception as exc:
                last_error = exc
                rewritten_by_path = None
                if attempt < args.retries:
                    time.sleep(min(2**attempt, 5))
        if rewritten_by_path is None:
            with write_lock:
                append_jsonl(
                    failures_path,
                    {
                        "kind": "comments_failed",
                        "id": video_id,
                        "error": str(last_error),
                    },
                )
                failure_count += 1
                print(f"ERROR comments {video_id}: {last_error}")
                if pbar:
                    pbar.update(1)
            return
        with write_lock:
            append_jsonl(
                args.out,
                {
                    "id": video_id,
                    "comments": [
                        _merge_comment_tree(original_comment, rewritten_by_path, user_rewrites, str(index))
                        for index, original_comment in enumerate(comments)
                    ],
                },
            )
            if pbar:
                pbar.set_postfix_str(video_id)
                pbar.update(1)

    try:
        if args.concurrency <= 1:
            for video_id in iterable:
                process(video_id)
        else:
            with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
                futures = [ex.submit(process, video_id) for video_id in iterable]
                for future in as_completed(futures):
                    future.result()
    finally:
        if pbar:
            pbar.close()
    if failure_count:
        print(f"FAILED comment threads: {failure_count}; see {failures_path}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
