#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

try:
    from tqdm import tqdm
except ImportError:  # pragma: no cover
    tqdm = None

from io_utils import OUTPUT_ROOT, append_jsonl, batched, load_posts, read_jsonl_map
from openai_v1 import chat_json


POST_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "content": {"type": "string"},
        "comments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "body": {"type": "string"},
                },
                "required": ["id", "body"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["title", "content", "comments"],
    "additionalProperties": False,
}


SYSTEM = """You are rewriting Reddit post text for a public UI-agent benchmark.
Goal: preserve the post's subreddit fit, topic, intent, tone, and interaction usefulness, but make the text impossible to search back to the original Reddit post.
Rules:
1. Process exactly one post. Output strict JSON only.
2. Output only title, content, and comments.
3. Rewrite title, content, and every comment body. Do not merely swap a few words.
4. Keep the same broad topic and conversational function. A question should stay a question; advice should stay advice; a joke should stay joke-like.
5. Preserve public context names when they are necessary to understand the content, such as well-known movies, games, celebrities, historical figures, public institutions, countries, cities, and common products.
6. Do not replace one specific real event, person, place, or brand with a different specific real one. If a specific detail is not necessary, generalize it or invent a neutral fictional detail.
7. Remove or fictionalize ordinary usernames, private names, account handles, contact info, URLs, invite links, phone numbers, emails, and exact addresses.
8. Keep comment ids exactly as provided. Do not output authors, scores, timestamps, post ids, raw ids, URLs, or permalinks.
9. Keep the number of comments and the comment ids exactly aligned with input.
10. Do not add meta language such as "rewritten", "sanitized", or "anonymous"."""


def _build_payload(post: dict[str, Any]) -> dict[str, Any]:
    comments = [
        {
            "id": str(comment.get("id", "")),
            "body": comment.get("body", ""),
        }
        for comment in post.get("commentsData", []) or []
    ]
    return {
        "subreddit": post.get("subreddit", ""),
        "title": post.get("title", ""),
        "content": post.get("content", ""),
        "comments": comments,
    }


def _validate_result(post: dict[str, Any], result: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if not str(result.get("title", "")).strip():
        errors.append("empty title")
    if not isinstance(result.get("content"), str):
        errors.append("content is not a string")
    original_comments = post.get("commentsData", []) or []
    rewritten_comments = result.get("comments")
    if not isinstance(rewritten_comments, list):
        return [*errors, "comments is not an array"]
    original_ids = [str(comment.get("id", "")) for comment in original_comments]
    rewritten_ids = [str(comment.get("id", "")) for comment in rewritten_comments]
    if original_ids != rewritten_ids:
        errors.append("comment ids/count do not match input")
    for index, comment in enumerate(rewritten_comments):
        body = comment.get("body")
        if not isinstance(body, str) or not body.strip():
            errors.append(f"empty comment body at index {index}")
            break
    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description="Rewrite Reddit post titles/content/comments with a local OpenAI-compatible model.")
    parser.add_argument("--out", type=Path, default=OUTPUT_ROOT / "posts_text.jsonl")
    parser.add_argument("--model", default=os.environ.get("REDDIT_TEXT_MODEL", "local-model"))
    parser.add_argument("--limit", type=int)
    parser.add_argument("--concurrency", type=int, default=1)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--failures", type=Path, help="JSONL file for failed posts; default is <out>.failures.jsonl.")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    posts = load_posts()
    done = {} if args.force else read_jsonl_map(args.out, "id")
    pending = [post for post in posts if str(post["id"]) not in done]
    iterable = list(batched(pending, args.limit))
    failures_path = args.failures or args.out.with_name(f"{args.out.stem}.failures.jsonl")
    if args.force:
        if args.out.exists():
            args.out.unlink()
        if failures_path.exists():
            failures_path.unlink()

    pbar = tqdm(total=len(iterable), desc="reddit-posts", unit="post", smoothing=0.1) if tqdm else None
    write_lock = threading.Lock()
    failure_count = 0

    def process(post: dict[str, Any]) -> None:
        nonlocal failure_count
        post_id = str(post.get("id", ""))
        payload = _build_payload(post)
        result: dict[str, Any] | None = None
        last_error: Exception | None = None
        for attempt in range(args.retries + 1):
            try:
                candidate = chat_json(
                    model=args.model,
                    system=SYSTEM,
                    user_content="Rewrite this Reddit post text. Output JSON:\n"
                    + json.dumps(payload, ensure_ascii=False, indent=2),
                    schema_name="reddit_post_text_rewrite",
                    schema=POST_SCHEMA,
                )
                errors = _validate_result(post, candidate)
                if errors:
                    raise RuntimeError("; ".join(errors))
                result = candidate
                break
            except Exception as exc:
                last_error = exc
                if attempt < args.retries:
                    time.sleep(min(2**attempt, 5))

        with write_lock:
            if result is None:
                append_jsonl(failures_path, {"kind": "post_failed", "id": post_id, "error": str(last_error)})
                failure_count += 1
                print(f"ERROR post {post_id}: {last_error}")
            else:
                result["id"] = post_id
                append_jsonl(args.out, result)
                if pbar:
                    pbar.set_postfix_str(result.get("title", "")[:40])
            if pbar:
                pbar.update(1)

    try:
        if args.concurrency <= 1:
            for post in iterable:
                process(post)
        else:
            with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
                futures = [ex.submit(process, post) for post in iterable]
                for future in as_completed(futures):
                    future.result()
    finally:
        if pbar:
            pbar.close()

    if failure_count:
        print(f"FAILED posts: {failure_count}; see {failures_path}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
