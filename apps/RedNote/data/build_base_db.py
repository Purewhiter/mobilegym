#!/usr/bin/env python3
"""
Build apps/RedNote/data/base.sqlite from RedBook JSON sources.

Source: apps/RedBook/data/{users,notes}.json (committed, ~13MB)
Output: apps/RedNote/data/base.sqlite (committed, ~10MB)

Idempotent: deletes existing base.sqlite, recreates from schema.sql, inserts all rows.

Run:
    python apps/RedNote/data/build_base_db.py
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent
SCHEMA_PATH = DATA_DIR / "schema.sql"
DB_PATH = DATA_DIR / "base.sqlite"

# Pull base data from RedBook (the SQL fork shares initial content for apples-to-apples benchmarking).
REDBOOK_DATA_DIR = DATA_DIR.parent.parent / "RedBook" / "data"
USERS_JSON = REDBOOK_DATA_DIR / "users.json"
NOTES_JSON = REDBOOK_DATA_DIR / "notes.json"


def _connect_fresh(db_path: Path, schema_sql: str) -> sqlite3.Connection:
    if db_path.exists():
        db_path.unlink()
    conn = sqlite3.connect(db_path)
    conn.executescript(schema_sql)
    return conn


def _insert_users(conn: sqlite3.Connection, users: list[dict]) -> int:
    rows = [
        (
            u["id"],
            u.get("name") or "",
            u.get("avatar"),
            u.get("userCover"),
            int(u.get("following") or 0),
            int(u.get("followers") or 0),
            int(u.get("likesAndCollections") or 0),
            u.get("intro"),
            u.get("location"),
            u.get("gender"),
            u.get("age"),
            u.get("userUrl"),
        )
        for u in users
    ]
    conn.executemany(
        """
        INSERT INTO users
          (id, name, avatar, user_cover, following, followers, likes_and_collections,
           intro, location, gender, age, user_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    return len(rows)


def _harvest_implicit_users(notes: list[dict], known_user_ids: set[str]) -> list[dict]:
    """Some notes reference comment authors not present in users.json.

    The RedBook loader synthesizes minimal user records from comment fields
    (username + avatar) for these — we replicate that here so the FK on notes.author_id
    never points at a missing user.
    """
    seen = set(known_user_ids)
    synthesized: list[dict] = []
    for note in notes:
        author_id = note.get("authorId")
        if author_id and author_id not in seen:
            seen.add(author_id)
            synthesized.append({
                "id": author_id,
                "name": "Unknown",
                "avatar": None,
                "intro": "暂无简介",
                "location": "未知",
                "followers": 0,
                "following": 0,
                "likesAndCollections": 0,
            })
        for comment in note.get("commentList") or []:
            cid = comment.get("userId")
            if not cid or cid in seen:
                continue
            seen.add(cid)
            synthesized.append({
                "id": cid,
                "name": comment.get("username") or "Unknown",
                "avatar": comment.get("avatar"),
                "intro": "暂无简介",
                "location": comment.get("location") or "未知",
                "followers": 0,
                "following": 0,
                "likesAndCollections": 0,
            })
    return synthesized


def _insert_notes(conn: sqlite3.Connection, notes: list[dict]) -> tuple[int, int]:
    note_rows = []
    image_rows = []
    for n in notes:
        nid = n["id"]
        note_rows.append((
            nid,
            n.get("title") or "",
            n.get("content"),
            n["authorId"],
            n.get("video"),
            n.get("cover"),
            int(n.get("likes") or 0),
            int(n.get("collections") or 0),
            int(n.get("comments") or 0),
            int(n.get("createdAt") or 0),
            n.get("category"),
            n.get("url"),
            n.get("xsec_token"),
            json.dumps(n.get("tags") or [], ensure_ascii=False),
            json.dumps(n.get("commentList") or [], ensure_ascii=False),
        ))
        for ordinal, url in enumerate(n.get("images") or []):
            image_rows.append((nid, ordinal, url))

    conn.executemany(
        """
        INSERT INTO notes
          (id, title, content, author_id, video, cover, likes, collections, comments_count,
           created_at, category, url, xsec_token, tags_json, comment_list_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        note_rows,
    )
    conn.executemany(
        "INSERT INTO note_images (note_id, ordinal, url) VALUES (?, ?, ?)",
        image_rows,
    )
    return len(note_rows), len(image_rows)


def main() -> None:
    schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
    users = json.loads(USERS_JSON.read_text(encoding="utf-8"))
    notes = json.loads(NOTES_JSON.read_text(encoding="utf-8"))

    known_user_ids = {u["id"] for u in users}
    implicit_users = _harvest_implicit_users(notes, known_user_ids)
    users_with_implicit = users + implicit_users

    conn = _connect_fresh(DB_PATH, schema_sql)
    try:
        with conn:
            n_users = _insert_users(conn, users_with_implicit)
            n_notes, n_images = _insert_notes(conn, notes)
        conn.execute("VACUUM")
        conn.execute("ANALYZE")
    finally:
        conn.close()

    size_mb = DB_PATH.stat().st_size / (1024 * 1024)
    print(
        f"Built {DB_PATH.relative_to(DATA_DIR.parents[2])} "
        f"({size_mb:.2f} MB): "
        f"{n_users} users ({len(implicit_users)} synthesized), "
        f"{n_notes} notes, "
        f"{n_images} images"
    )


if __name__ == "__main__":
    main()
