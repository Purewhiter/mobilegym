#!/usr/bin/env python3
from __future__ import annotations

import argparse
import shutil
from copy import deepcopy
from pathlib import Path
from typing import Any

from io_utils import BILIBILI_DATA, read_json, read_jsonl_map, write_json


def _apply_user(user: dict[str, Any], rewrite: dict[str, Any] | None) -> dict[str, Any]:
    if not rewrite:
        return user
    out = deepcopy(user)
    if rewrite.get("name"):
        out["name"] = rewrite["name"]
    if "sign" in rewrite:
        out["sign"] = rewrite.get("sign", "")
    live_room = out.get("live_room")
    if isinstance(live_room, dict) and "liveRoomTitle" in rewrite:
        live_room["title"] = rewrite.get("liveRoomTitle", "")
    return out


def _apply_comment(comment: dict[str, Any], rewrite_by_rpid: dict[str, dict[str, Any]]) -> dict[str, Any]:
    out = deepcopy(comment)
    rewrite = rewrite_by_rpid.get(str(comment.get("rpid", "")))
    if rewrite:
        out["uname"] = rewrite.get("uname", out.get("uname", ""))
        out["message"] = rewrite.get("message", out.get("message", ""))
    replies = comment.get("replies")
    if isinstance(replies, list):
        out["replies"] = [_apply_comment(reply, rewrite_by_rpid) for reply in replies]
    return out


def _collect_comment_rewrites(comments: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for comment in comments:
        rpid = str(comment.get("rpid", ""))
        if rpid:
            out[rpid] = comment
        replies = comment.get("replies") or []
        if isinstance(replies, list):
            out.update(_collect_comment_rewrites(replies))
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Apply Bilibili sanitizer JSONL outputs into a new data directory.")
    parser.add_argument("--users", type=Path, required=True)
    parser.add_argument("--videos", type=Path)
    parser.add_argument("--comments", type=Path)
    parser.add_argument("--out-dir", type=Path, required=True)
    args = parser.parse_args()

    user_rewrites = read_jsonl_map(args.users, "key")
    video_rewrites = read_jsonl_map(args.videos, "id") if args.videos else {}
    comment_rewrites = read_jsonl_map(args.comments, "id") if args.comments else {}

    authors = read_json(BILIBILI_DATA / "authors.json")
    commenters = read_json(BILIBILI_DATA / "commenters.json")
    videos = read_json(BILIBILI_DATA / "videos.json")
    video_tags = read_json(BILIBILI_DATA / "videoTags.json")
    video_comments = read_json(BILIBILI_DATA / "videoComments.json")
    defaults = read_json(BILIBILI_DATA / "defaults.json")

    for mid, user in list(authors.items()):
        authors[mid] = _apply_user(user, user_rewrites.get(f"author:{mid}"))
        for video in authors[mid].get("videos", []) or []:
            rewrite = video_rewrites.get(str(video.get("id", "")))
            if rewrite and rewrite.get("title"):
                video["title"] = rewrite["title"]

    for mid, user in list(commenters.items()):
        commenters[mid] = _apply_user(user, user_rewrites.get(f"commenter:{mid}"))

    for video in videos:
        rewrite = video_rewrites.get(str(video.get("id", "")))
        if not rewrite:
            continue
        if rewrite.get("title"):
            video["title"] = rewrite["title"]
        if rewrite.get("author"):
            video["author"] = rewrite["author"]
        if rewrite.get("tags"):
            video_tags[str(video["id"])] = rewrite["tags"]

    for video_id, payload in list(video_comments.items()):
        rewrite = comment_rewrites.get(str(video_id))
        if not rewrite:
            continue
        rewrite_by_rpid = _collect_comment_rewrites(rewrite.get("comments", []) or [])
        payload["comments"] = [_apply_comment(comment, rewrite_by_rpid) for comment in payload.get("comments", []) or []]

    for name in ("hot.json", "recommend.json"):
        rows = read_json(BILIBILI_DATA / name)
        for row in rows:
            rewrite = video_rewrites.get(str(row.get("id", "")))
            if rewrite and rewrite.get("title"):
                row["title"] = rewrite["title"]
        write_json(args.out_dir / name, rows)

    rankings = read_json(BILIBILI_DATA / "rankings.json")
    for rows in rankings.values():
        for row in rows:
            rewrite = video_rewrites.get(str(row.get("id", "")))
            if rewrite and rewrite.get("title"):
                row["title"] = rewrite["title"]
    write_json(args.out_dir / "rankings.json", rankings)

    user = defaults.get("user", {})
    for item in user.get("followingList", []) or []:
        mid = str(item.get("mid", ""))
        rewrite = user_rewrites.get(f"author:{mid}") or user_rewrites.get(f"commenter:{mid}")
        if rewrite and rewrite.get("name"):
            item["name"] = rewrite["name"]
    for item in user.get("followersList", []) or []:
        mid = str(item.get("mid", ""))
        rewrite = user_rewrites.get(f"commenter:{mid}") or user_rewrites.get(f"author:{mid}")
        if rewrite:
            if rewrite.get("name"):
                item["name"] = rewrite["name"]
            if "sign" in rewrite:
                item["sign"] = rewrite.get("sign", "")

    write_json(args.out_dir / "authors.json", authors)
    write_json(args.out_dir / "commenters.json", commenters)
    write_json(args.out_dir / "videos.json", videos)
    write_json(args.out_dir / "videoTags.json", video_tags)
    write_json(args.out_dir / "videoComments.json", video_comments)
    write_json(args.out_dir / "defaults.json", defaults)

    for name in ("videoOnline.json", "school.json"):
        write_json(args.out_dir / name, read_json(BILIBILI_DATA / name))

    for name in ("index.ts", "loader.ts", "hotData.ts", "recommendData.ts", "schoolData.ts"):
        source = BILIBILI_DATA / name
        if source.exists():
            args.out_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, args.out_dir / name)

    print(f"wrote sanitized Bilibili data to {args.out_dir}")


if __name__ == "__main__":
    main()
