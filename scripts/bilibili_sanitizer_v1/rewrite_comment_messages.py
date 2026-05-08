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

from io_utils import OUTPUT_ROOT, append_jsonl, load_video_comments, load_videos, read_jsonl_map
from openai_v1 import chat_text


SYSTEM = """你是 Bilibili 评论脱敏改写员。
目标：只改写评论正文，保留原评论的大致语义、语气、梗、情绪和讨论方向，但不能复制原句，不能搜索回原评论。
规则：
1. 输入只包含一条评论，格式：key<TAB>视频标题<TAB>评论者显示名<TAB>原评论。
2. 只输出新评论正文，不要输出 key、视频标题、评论者显示名。
3. 新评论不能等于原评论，不能只替换一两个词，长度足够的评论要明显改写表达方式。
4. @原昵称、联系方式、账号、URL、个人姓名、学校/公司/机构等要删除、泛化或虚构化。
5. 公开人物、运动员、演员、导演、歌手、历史人物、作品名、角色名、游戏名、影视名、音乐名等公共语境名称，如果是理解评论所必需，应该保留。
6. 不要把原文中的具体名称替换成另一个真实具体名称；如果不保留，应改成中性泛称或虚构称呼。
7. 不要写“脱敏后”“已删除”等处理痕迹。
8. 不要输出编号、解释或 Markdown。"""


def _cell(value: Any) -> str:
    return str(value or "").replace("\t", " ").replace("\r", " ").replace("\n", " ").strip()


def _similarity(a: Any, b: Any) -> float:
    left = " ".join(str(a or "").split())
    right = " ".join(str(b or "").split())
    if not left and not right:
        return 1.0
    if not left or not right:
        return 0.0
    return SequenceMatcher(None, left, right).ratio()


def _message_is_bad(original: Any, rewritten: Any, threshold: float) -> bool:
    original_text = _cell(original)
    rewritten_text = _cell(rewritten)
    if not original_text:
        return False
    if original_text == rewritten_text and len(original_text) >= 3:
        return True
    return len(original_text) >= 6 and _similarity(original_text, rewritten_text) >= threshold


def _validate_message(original: Any, rewritten: Any, threshold: float) -> None:
    original_text = _cell(original)
    rewritten_text = _cell(rewritten)
    if original_text and not rewritten_text:
        raise RuntimeError("empty rewritten message")
    if _message_is_bad(original_text, rewritten_text, threshold):
        raise RuntimeError(
            f"message too close to original ({_similarity(original_text, rewritten_text):.3f}): "
            f"{original_text!r} -> {rewritten_text!r}"
        )


def _flatten(nodes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for node in nodes or []:
        out.append(node)
        replies = node.get("replies") or []
        if isinstance(replies, list):
            out.extend(_flatten(replies))
    return out


def _walk_update(
    nodes: list[dict[str, Any]],
    video_id: str,
    patches: dict[str, str],
    user_rewrites: dict[str, dict[str, Any]],
) -> None:
    for node in nodes or []:
        rpid = str(node.get("rpid", ""))
        mid = str(node.get("mid", ""))
        key = f"{video_id}:{rpid}"
        if key in patches:
            node["message"] = patches[key]
        else:
            node["message"] = _cell(node.get("message", ""))
        user = user_rewrites.get(f"commenter:{mid}") or {}
        if user.get("name"):
            node["uname"] = _cell(user["name"])
        else:
            node["uname"] = _cell(node.get("uname", ""))
        replies = node.get("replies") or []
        if isinstance(replies, list):
            _walk_update(replies, video_id, patches, user_rewrites)


def _parse_lines(text: str, expected_keys: list[str]) -> dict[str, str]:
    expected = set(expected_keys)
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
        key = parts[0].strip()
        if key in expected:
            rows[key] = parts[1].strip()
    missing = [key for key in expected_keys if key not in rows]
    if missing:
        raise RuntimeError(f"model missed keys {missing[:10]}")
    return rows


def _parse_single_line(text: str, expected_key: str) -> str:
    rows = _parse_lines(text, [expected_key])
    return rows[expected_key]


def _parse_single_message(text: str) -> str:
    lines = [line.strip() for line in text.splitlines() if line.strip() and not line.strip().startswith("```")]
    if not lines:
        return ""
    message = lines[0]
    if "\t" in message:
        message = message.split("\t")[-1].strip()
    return message.strip("“”\"' ")


def _load_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.exists():
        return rows
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Rewrite only high-similarity Bilibili comment messages.")
    parser.add_argument("--out", type=Path, default=OUTPUT_ROOT / "video_comments.jsonl")
    parser.add_argument("--users", type=Path, default=OUTPUT_ROOT / "users.jsonl")
    parser.add_argument("--videos", type=Path, default=OUTPUT_ROOT / "videos.jsonl")
    parser.add_argument("--patches", type=Path, default=OUTPUT_ROOT / "comment_message_patches.jsonl")
    parser.add_argument("--failures", type=Path, default=OUTPUT_ROOT / "comment_message_patch_failures.jsonl")
    parser.add_argument("--model", default=os.environ.get("BILIBILI_TEXT_MODEL", "local-model"))
    parser.add_argument("--concurrency", type=int, default=1)
    parser.add_argument("--retries", type=int, default=4)
    parser.add_argument("--similarity-threshold", type=float, default=0.72)
    parser.add_argument("--apply-only", action="store_true")
    args = parser.parse_args()

    originals = load_video_comments()
    rows = _load_jsonl(args.out)
    by_video = {str(row.get("id", "")): row for row in rows}
    user_rewrites = read_jsonl_map(args.users, "key")
    video_rewrites = read_jsonl_map(args.videos, "id")
    original_videos = {str(video.get("id", "")): video for video in load_videos()}
    patch_rows = _load_jsonl(args.patches)
    patches = {str(row["key"]): str(row["message"]) for row in patch_rows if row.get("key")}

    targets: list[dict[str, str]] = []
    for video_id, original_payload in originals.items():
        current_payload = by_video.get(str(video_id))
        if not current_payload:
            continue
        current_by_rpid = {str(item.get("rpid", "")): item for item in _flatten(current_payload.get("comments") or [])}
        title = (
            video_rewrites.get(str(video_id), {}).get("title")
            or original_videos.get(str(video_id), {}).get("title")
            or ""
        )
        for original_comment in _flatten(original_payload.get("comments") or []):
            rpid = str(original_comment.get("rpid", ""))
            key = f"{video_id}:{rpid}"
            if key in patches:
                continue
            current_comment = current_by_rpid.get(rpid)
            if not current_comment:
                continue
            if _message_is_bad(
                original_comment.get("message", ""),
                current_comment.get("message", ""),
                args.similarity_threshold,
            ):
                mid = str(original_comment.get("mid", ""))
                user = user_rewrites.get(f"commenter:{mid}") or {}
                targets.append(
                    {
                        "key": key,
                        "title": _cell(title),
                        "displayName": _cell(user.get("name") or current_comment.get("uname") or "用户"),
                        "original": _cell(original_comment.get("message", "")),
                    }
                )

    if not args.apply_only and targets:
        pbar = tqdm(total=len(targets), desc="comment-messages", unit="msg", smoothing=0.1) if tqdm else None
        write_lock = threading.Lock()
        failure_count = 0

        def process(item: dict[str, str]) -> None:
            nonlocal failure_count
            last_error: Exception | None = None
            rewritten: str | None = None
            for attempt in range(args.retries + 1):
                try:
                    input_line = f"{item['key']}\t{item['title']}\t{item['displayName']}\t{item['original']}"
                    text = chat_text(
                        model=args.model,
                        system=SYSTEM,
                        user_content="请改写下面这一条 Bilibili 评论，只输出新评论正文：\n" + input_line,
                    )
                    rewritten = _parse_single_message(text)
                    _validate_message(item["original"], rewritten, args.similarity_threshold)
                    break
                except Exception as exc:
                    last_error = exc
                    rewritten = None
                    if attempt < args.retries:
                        time.sleep(min(2**attempt, 5))
            with write_lock:
                if rewritten is None:
                    failure_count += 1
                    append_jsonl(
                        args.failures,
                        {
                            "kind": "comment_message_failed",
                            "key": item["key"],
                            "error": str(last_error),
                        },
                    )
                    if pbar:
                        pbar.update(1)
                    return
                append_jsonl(args.patches, {"key": item["key"], "message": rewritten})
                patches[item["key"]] = rewritten
                if pbar:
                    pbar.update(1)

        try:
            if args.concurrency <= 1:
                for item in targets:
                    process(item)
            else:
                with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
                    futures = [ex.submit(process, item) for item in targets]
                    for future in as_completed(futures):
                        future.result()
        finally:
            if pbar:
                pbar.close()
        if failure_count:
            print(f"FAILED comment messages: {failure_count}; see {args.failures}")

    patch_rows = _load_jsonl(args.patches)
    patches = {str(row["key"]): str(row["message"]) for row in patch_rows if row.get("key")}
    for row in rows:
        video_id = str(row.get("id", ""))
        _walk_update(row.get("comments") or [], video_id, patches, user_rewrites)

    tmp = args.out.with_name(f".{args.out.name}.tmp")
    with tmp.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")
    tmp.replace(args.out)
    print(json.dumps({"targets": len(targets), "patches": len(patches), "rows": len(rows)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
