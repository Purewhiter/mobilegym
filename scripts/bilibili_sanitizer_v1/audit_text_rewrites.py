#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

from io_utils import OUTPUT_ROOT, load_authors, load_commenters, load_video_comments, load_video_tags, load_videos, read_jsonl_map, write_json
from risk_utils import contained_forbidden_terms, similarity, user_risk_context, video_risk_context


def audit_users(rewritten_path: Path, threshold: float) -> dict[str, Any]:
    originals: dict[str, dict[str, Any]] = {}
    for mid, user in load_authors().items():
        originals[f"author:{mid}"] = user
    for mid, user in load_commenters().items():
        originals[f"commenter:{mid}"] = user

    rewritten = read_jsonl_map(rewritten_path, "key")
    issues: list[dict[str, Any]] = []
    for key, original in originals.items():
        item = rewritten.get(key)
        if not item:
            issues.append({"kind": "missing_user", "key": key})
            continue
        risk = user_risk_context(original)
        text = "\n".join([item.get("name", ""), item.get("sign", ""), item.get("officialTitle", "")])
        hits = contained_forbidden_terms(text, risk["forbiddenTerms"])
        name_sim = similarity(original.get("name", ""), item.get("name", ""))
        sign_sim = similarity(original.get("sign", ""), item.get("sign", ""))
        if hits or name_sim >= threshold or (original.get("sign") and sign_sim >= threshold):
            issues.append(
                {
                    "kind": "risky_user",
                    "key": key,
                    "forbiddenHits": hits[:30],
                    "nameSimilarity": round(name_sim, 3),
                    "signSimilarity": round(sign_sim, 3),
                    "originalName": original.get("name", ""),
                    "rewrittenName": item.get("name", ""),
                }
            )

    return {
        "totalOriginalUsers": len(originals),
        "totalRewrittenUsers": len(rewritten),
        "issueCount": len(issues),
        "issues": issues[:300],
    }


def audit_videos(rewritten_path: Path, threshold: float) -> dict[str, Any]:
    tags_by_id = load_video_tags()
    originals = {str(video["id"]): video for video in load_videos()}
    rewritten = read_jsonl_map(rewritten_path, "id")
    issues: list[dict[str, Any]] = []
    for video_id, original in originals.items():
        item = rewritten.get(video_id)
        if not item:
            issues.append({"kind": "missing_video", "id": video_id})
            continue
        risk = video_risk_context(original, tags_by_id.get(video_id, []))
        text = "\n".join([item.get("title", ""), item.get("author", ""), " ".join(item.get("tags", []))])
        hits = contained_forbidden_terms(text, risk["forbiddenTerms"])
        title_sim = similarity(original.get("title", ""), item.get("title", ""))
        author_sim = similarity(original.get("author", ""), item.get("author", ""))
        if hits or title_sim >= threshold or author_sim >= threshold:
            issues.append(
                {
                    "kind": "risky_video",
                    "id": video_id,
                    "forbiddenHits": hits[:30],
                    "titleSimilarity": round(title_sim, 3),
                    "authorSimilarity": round(author_sim, 3),
                    "originalTitle": original.get("title", ""),
                    "rewrittenTitle": item.get("title", ""),
                }
            )

    return {
        "totalOriginalVideos": len(originals),
        "totalRewrittenVideos": len(rewritten),
        "issueCount": len(issues),
        "issues": issues[:300],
    }


def _flatten_comments(comments: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for comment in comments:
        out.append(comment)
        replies = comment.get("replies") or []
        if isinstance(replies, list):
            out.extend(_flatten_comments(replies))
    return out


def audit_comments(rewritten_path: Path, threshold: float) -> dict[str, Any]:
    originals = load_video_comments()
    rewritten = read_jsonl_map(rewritten_path, "id")
    issues: list[dict[str, Any]] = []
    for video_id, original_payload in originals.items():
        item = rewritten.get(str(video_id))
        if not item:
            issues.append({"kind": "missing_video_comments", "id": video_id})
            continue
        original_by_rpid = {str(c.get("rpid", "")): c for c in _flatten_comments(original_payload.get("comments", []) or [])}
        for comment in _flatten_comments(item.get("comments", []) or []):
            rpid = str(comment.get("rpid", ""))
            original = original_by_rpid.get(rpid)
            if not original:
                issues.append({"kind": "unknown_comment", "id": video_id, "rpid": rpid})
                continue
            name_sim = similarity(original.get("uname", ""), comment.get("uname", ""))
            msg_sim = similarity(original.get("message", ""), comment.get("message", ""))
            hits = contained_forbidden_terms(
                "\n".join([comment.get("uname", ""), comment.get("message", "")]),
                [original.get("uname", ""), *[p for p in original.get("message", "").splitlines() if len(p) >= 6]],
            )
            if hits or name_sim >= threshold or (original.get("message") and msg_sim >= threshold):
                issues.append(
                    {
                        "kind": "risky_comment",
                        "id": video_id,
                        "rpid": rpid,
                        "forbiddenHits": hits[:20],
                        "nameSimilarity": round(name_sim, 3),
                        "messageSimilarity": round(msg_sim, 3),
                    }
                )
                if len(issues) >= 300:
                    break
        if len(issues) >= 300:
            break

    return {
        "totalOriginalThreads": len(originals),
        "totalRewrittenThreads": len(rewritten),
        "issueCount": len(issues),
        "issues": issues[:300],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit rewritten Bilibili text against original data.")
    parser.add_argument("--users", type=Path, default=OUTPUT_ROOT / "users.jsonl")
    parser.add_argument("--videos", type=Path, default=OUTPUT_ROOT / "videos.jsonl")
    parser.add_argument("--comments", type=Path, default=OUTPUT_ROOT / "video_comments.jsonl")
    parser.add_argument("--out", type=Path, default=OUTPUT_ROOT / "text_audit_report.json")
    parser.add_argument("--similarity-threshold", type=float, default=0.72)
    args = parser.parse_args()

    report: dict[str, Any] = {"similarityThreshold": args.similarity_threshold}
    if args.users:
        report["users"] = audit_users(args.users, args.similarity_threshold)
    if args.videos:
        report["videos"] = audit_videos(args.videos, args.similarity_threshold)
    if args.comments:
        report["comments"] = audit_comments(args.comments, args.similarity_threshold)
    write_json(args.out, report)
    print(args.out)


if __name__ == "__main__":
    main()
