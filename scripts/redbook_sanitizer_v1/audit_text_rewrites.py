#!/usr/bin/env python3
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

from io_utils import OUTPUT_ROOT, load_redbook_notes, load_redbook_users, read_jsonl_map, write_json
from risk_utils import contained_forbidden_terms, note_risk_context, similarity, user_risk_context


def audit_users(rewritten_path: Path, threshold: float) -> dict[str, Any]:
    originals = {str(user["id"]): user for user in load_redbook_users()}
    rewritten = read_jsonl_map(rewritten_path, "id")
    issues: list[dict[str, Any]] = []

    for user_id, original in originals.items():
        item = rewritten.get(user_id)
        if not item:
            issues.append({"kind": "missing_user", "id": user_id})
            continue
        risk = user_risk_context(original)
        text = f"{item.get('name', '')}\n{item.get('intro', '')}"
        hits = contained_forbidden_terms(text, risk["forbiddenTerms"])
        name_sim = similarity(original.get("name", ""), item.get("name", ""))
        intro_sim = similarity(original.get("intro", ""), item.get("intro", ""))
        if hits or name_sim >= threshold or intro_sim >= threshold:
            issues.append({
                "kind": "risky_user",
                "id": user_id,
                "forbiddenHits": hits,
                "nameSimilarity": round(name_sim, 3),
                "introSimilarity": round(intro_sim, 3),
                "originalName": original.get("name", ""),
                "rewrittenName": item.get("name", ""),
            })

    return {
        "totalOriginalUsers": len(originals),
        "totalRewrittenUsers": len(rewritten),
        "issueCount": len(issues),
        "issues": issues[:200],
    }


def audit_notes(rewritten_path: Path, threshold: float) -> dict[str, Any]:
    users_by_id = {str(user["id"]): user for user in load_redbook_users()}
    originals = {str(note["id"]): note for note in load_redbook_notes()}
    rewritten = read_jsonl_map(rewritten_path, "id")
    issues: list[dict[str, Any]] = []

    for note_id, original in originals.items():
        item = rewritten.get(note_id)
        if not item:
            issues.append({"kind": "missing_note", "id": note_id})
            continue
        risk = note_risk_context(original, users_by_id)
        comments_text = "\n".join(c.get("content", "") for c in item.get("comments", []))
        text = "\n".join([
            item.get("title", ""),
            item.get("content", ""),
            " ".join(item.get("tags", [])),
            comments_text,
        ])
        hits = contained_forbidden_terms(text, risk["forbiddenTerms"])
        title_sim = similarity(original.get("title", ""), item.get("title", ""))
        content_sim = similarity(original.get("content", ""), item.get("content", ""))
        unchanged_comments = []
        original_comments = {str(c.get("id")): c for c in original.get("commentList", []) or []}
        for comment in item.get("comments", []):
            original_comment = original_comments.get(str(comment.get("id")))
            if original_comment and similarity(original_comment.get("content", ""), comment.get("content", "")) >= threshold:
                unchanged_comments.append(comment.get("id"))
        if hits or title_sim >= threshold or (original.get("content") and content_sim >= threshold) or unchanged_comments:
            issues.append({
                "kind": "risky_note",
                "id": note_id,
                "forbiddenHits": hits[:30],
                "titleSimilarity": round(title_sim, 3),
                "contentSimilarity": round(content_sim, 3),
                "unchangedCommentIds": unchanged_comments[:30],
                "originalTitle": original.get("title", ""),
                "rewrittenTitle": item.get("title", ""),
            })

    return {
        "totalOriginalNotes": len(originals),
        "totalRewrittenNotes": len(rewritten),
        "issueCount": len(issues),
        "issues": issues[:200],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit rewritten RedBook text against original data.")
    parser.add_argument("--users", type=Path, default=OUTPUT_ROOT / "users.jsonl", help="Rewritten users JSONL.")
    parser.add_argument("--notes", type=Path, default=OUTPUT_ROOT / "notes.jsonl", help="Rewritten notes JSONL.")
    parser.add_argument("--out", type=Path, default=OUTPUT_ROOT / "text_audit_report.json")
    parser.add_argument("--similarity-threshold", type=float, default=0.72)
    args = parser.parse_args()

    report: dict[str, Any] = {"similarityThreshold": args.similarity_threshold}
    if args.users:
        report["users"] = audit_users(args.users, args.similarity_threshold)
    if args.notes:
        report["notes"] = audit_notes(args.notes, args.similarity_threshold)
    write_json(args.out, report)
    print(args.out)


if __name__ == "__main__":
    main()
