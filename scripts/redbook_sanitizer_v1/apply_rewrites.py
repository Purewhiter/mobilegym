#!/usr/bin/env python3
"""Merge rewritten jsonl + original metadata into final users.json/notes.json.

- Hashes all IDs (user / note / comment) with HMAC-SHA256 + salt → unguessable
  but deterministic mapping. Mapping saved as id_mapping.json for reverse lookup.
- Replaces commentList[].username with the new name from rewritten users.
- Rewrites avatar/image URLs to local paths (./images/...) for nginx serving.
- Renames avatars (long-id only) and post directories on disk to match new IDs.
"""
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import shutil
import string
from pathlib import Path
from typing import Any

ROOT = Path("/home/dingbang.wu/output_sanitized_v1")
ORIG_USERS = Path("/home/dingbang.wu/mobile-gym/apps/RedBook/data/users.json")
ORIG_NOTES = Path("/home/dingbang.wu/mobile-gym/apps/RedBook/data/notes.json")

DEFAULT_SALT = "mobile-gym-redbook-sanitize-2026"
ALPHABET36 = string.ascii_lowercase + string.digits  # 36 chars, 小写字母+数字


def make_hasher(salt: bytes, length: int = 9):
    """生成 9-char base36 ID（小红书号风格：lowercase + digits）。"""
    def hid(s: str) -> str:
        h = hmac.new(salt, str(s).encode(), hashlib.sha256).digest()
        val = int.from_bytes(h, "big")
        out = []
        for _ in range(length):
            val, mod = divmod(val, 36)
            out.append(ALPHABET36[mod])
        return "".join(reversed(out))
    return hid


def url_token(url: str) -> str | None:
    if not isinstance(url, str):
        return None
    if "/avatar/" not in url:
        return None
    tail = url.split("/avatar/", 1)[1]
    return tail.split("?", 1)[0]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--salt", default=os.environ.get("REDBOOK_HASH_SALT", DEFAULT_SALT))
    ap.add_argument("--users-jsonl", default=str(ROOT / "users.jsonl"))
    ap.add_argument("--notes-jsonl", default=str(ROOT / "notes.jsonl"))
    ap.add_argument("--out-users", default=str(ROOT / "users.json"))
    ap.add_argument("--out-notes", default=str(ROOT / "notes.json"))
    ap.add_argument("--avatars-dir", default=str(ROOT / "images" / "avatars"))
    ap.add_argument("--posts-dir", default=str(ROOT / "images" / "posts"))
    ap.add_argument("--mapping-out", default=str(ROOT / "id_mapping.json"))
    ap.add_argument("--prev-mapping", default=str(ROOT / "id_mapping.json"), help="上次的 mapping，用于判断当前文件命名。")
    ap.add_argument("--no-rename", action="store_true", help="Skip file/dir renames on disk.")
    args = ap.parse_args()

    hid = make_hasher(args.salt.encode())

    # ── load ─────────────────────────────────────────────────────────
    orig_users = json.load(open(ORIG_USERS, encoding="utf-8"))
    orig_notes = json.load(open(ORIG_NOTES, encoding="utf-8"))
    rw_users = {json.loads(l)["id"]: json.loads(l) for l in open(args.users_jsonl, encoding="utf-8")}
    rw_notes = {json.loads(l)["id"]: json.loads(l) for l in open(args.notes_jsonl, encoding="utf-8")}
    print(f"loaded: orig_users={len(orig_users)} orig_notes={len(orig_notes)} rw_users={len(rw_users)} rw_notes={len(rw_notes)}")

    # ── build ID maps ─────────────────────────────────────────────────
    user_id_map: dict[str, str] = {u["id"]: hid(u["id"]) for u in orig_users}
    note_id_map: dict[str, str] = {n["id"]: hid(n["id"]) for n in orig_notes}
    comment_id_map: dict[str, str] = {}
    for n in orig_notes:
        for c in n.get("commentList") or []:
            cid = c.get("id")
            if cid:
                comment_id_map[cid] = hid(cid)
            uid = c.get("userId")
            if uid and uid not in user_id_map:
                # cu_* users that appear only in comments
                user_id_map[uid] = hid(uid)

    # collision check
    for label, m in [("users", user_id_map), ("notes", note_id_map), ("comments", comment_id_map)]:
        if len(set(m.values())) != len(m):
            raise SystemExit(f"hash collision detected in {label}: {len(m)} → {len(set(m.values()))} unique")
    print(f"id maps: users={len(user_id_map)} notes={len(note_id_map)} comments={len(comment_id_map)}  (no collisions)")

    # original_user_id → new display name
    orig_id_to_new_name: dict[str, str] = {}
    for u in orig_users:
        rw = rw_users.get(u["id"])
        if rw and rw.get("name"):
            orig_id_to_new_name[u["id"]] = rw["name"]

    # for cu_* users that aren't in users.json but appear in commentList (rare),
    # we need to assign them a "new name". Use original username (already present in commentList) directly.
    # Skipping for now — comment[].username will fall back to original if not found.

    # ── build users.json ──────────────────────────────────────────────
    new_users: list[dict[str, Any]] = []
    for u in orig_users:
        rw = rw_users.get(u["id"], {})
        new_id = user_id_map[u["id"]]
        nu = dict(u)
        nu["id"] = new_id
        if rw.get("name"):
            nu["name"] = rw["name"]
        if rw.get("intro"):
            nu["intro"] = rw["intro"]
        if rw.get("location"):
            nu["location"] = rw["location"]
        # avatar local path
        avatar = u.get("avatar", "")
        token = url_token(avatar)
        if u["id"].startswith("cu_"):
            # cu_* users' avatars are stored under xhscdn token filenames
            if token:
                nu["avatar"] = f"./images/avatars/{token}.jpg"
        else:
            nu["avatar"] = f"./images/avatars/{new_id}.jpg"
        # cover (rare, we don't actually serve them but rewrite URL anyway)
        if u.get("userCover"):
            tok = url_token(u["userCover"])
            if u["id"].startswith("cu_") and tok:
                nu["userCover"] = f"./images/covers/{tok}.jpg"
            else:
                nu["userCover"] = f"./images/covers/{new_id}.jpg"
        # userUrl
        if u.get("userUrl"):
            nu["userUrl"] = f"./user/profile/{new_id}"
        new_users.append(nu)

    # ── build notes.json ──────────────────────────────────────────────
    new_notes: list[dict[str, Any]] = []
    for n in orig_notes:
        rw = rw_notes.get(n["id"], {})
        new_id = note_id_map[n["id"]]
        nn = dict(n)
        nn["id"] = new_id
        if rw.get("title") is not None:
            nn["title"] = rw["title"]
        if rw.get("content") is not None:
            nn["content"] = rw["content"]
        if rw.get("tags") is not None:
            nn["tags"] = rw["tags"]
        if n.get("authorId") in user_id_map:
            nn["authorId"] = user_id_map[n["authorId"]]
        # images & cover → local paths
        n_imgs = n.get("images") or []
        nn["cover"] = f"./images/posts/{new_id}/cover.jpg"
        nn["images"] = [f"./images/posts/{new_id}/{i}.jpg" for i in range(len(n_imgs))]
        # url
        if n.get("url"):
            nn["url"] = f"./explore/{new_id}"
        # xsec_token: opaque to user, but it's an xhs leak, scrub it
        if "xsec_token" in nn:
            nn["xsec_token"] = ""
        # commentList
        rw_comments_by_id = {c["id"]: c for c in (rw.get("comments") or [])}
        new_cl: list[dict[str, Any]] = []
        for c in (n.get("commentList") or []):
            nc = dict(c)
            cid = c.get("id")
            if cid in comment_id_map:
                nc["id"] = comment_id_map[cid]
            uid = c.get("userId")
            if uid in user_id_map:
                nc["userId"] = user_id_map[uid]
            # username: replace via uid → new_name
            if uid in orig_id_to_new_name:
                nc["username"] = orig_id_to_new_name[uid]
            # content from rewritten
            rwc = rw_comments_by_id.get(cid)
            if rwc and rwc.get("content") is not None:
                nc["content"] = rwc["content"]
            # avatar local path
            tok = url_token(c.get("avatar", ""))
            if tok:
                nc["avatar"] = f"./images/avatars/{tok}.jpg"
            # replyToId
            if c.get("replyToId") in comment_id_map:
                nc["replyToId"] = comment_id_map[c["replyToId"]]
            new_cl.append(nc)
        nn["commentList"] = new_cl
        new_notes.append(nn)

    # ── 先 load prev mapping（在覆盖之前），用于后续 rename 资源文件 ─────
    prev_user_map: dict[str, str] = {}
    prev_note_map: dict[str, str] = {}
    if args.prev_mapping and os.path.exists(args.prev_mapping):
        try:
            prev = json.load(open(args.prev_mapping, encoding="utf-8"))
            prev_user_map = prev.get("users", {}) or {}
            prev_note_map = prev.get("notes", {}) or {}
            print(f"prev mapping loaded: users={len(prev_user_map)} notes={len(prev_note_map)}")
        except Exception as exc:
            print(f"warn: failed to load prev mapping: {exc}")

    # ── write JSONs ──────────────────────────────────────────────────
    json.dump(new_users, open(args.out_users, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump(new_notes, open(args.out_notes, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    json.dump(
        {
            "users": user_id_map,
            "notes": note_id_map,
            "comments": comment_id_map,
            "salt_env_var": "REDBOOK_HASH_SALT",
            "salt_used": args.salt,
        },
        open(args.mapping_out, "w", encoding="utf-8"),
        ensure_ascii=False,
        indent=2,
    )
    print(f"wrote: {args.out_users}, {args.out_notes}, {args.mapping_out}")

    # ── rename files on disk ──────────────────────────────────────────
    if args.no_rename:
        print("skipping disk rename")
        return

    avatars_dir = Path(args.avatars_dir)
    posts_dir = Path(args.posts_dir)

    def find_current(d: Path, orig_id: str, prev_id: str | None, ext: str = ".jpg", is_dir: bool = False) -> Path | None:
        """返回当前实际存在的文件/目录路径（可能是 orig_id 命名，也可能是 prev_id 命名）。"""
        for cand_name in [orig_id, prev_id]:
            if not cand_name:
                continue
            p = d / (cand_name + (ext if not is_dir else ""))
            if (is_dir and p.is_dir()) or (not is_dir and p.exists()):
                return p
        return None

    # Avatars: 长 ID 用户的头像文件命名 = user.id（原值或 prev hashed）
    avatar_renamed = 0
    for u in orig_users:
        if u["id"].startswith("cu_"):
            continue
        new_id = user_id_map[u["id"]]
        new_path = avatars_dir / f"{new_id}.jpg"
        if new_path.exists():
            continue  # 已经是新 id，跳过
        prev_id = prev_user_map.get(u["id"])
        cur = find_current(avatars_dir, u["id"], prev_id, ext=".jpg")
        if cur:
            os.rename(cur, new_path)
            avatar_renamed += 1
    print(f"avatars renamed: {avatar_renamed}")

    # Posts: 帖子目录 = note.id（原值或 prev hashed）
    posts_renamed = 0
    for n in orig_notes:
        new_id = note_id_map[n["id"]]
        new_path = posts_dir / new_id
        if new_path.is_dir():
            continue
        prev_id = prev_note_map.get(n["id"])
        cur = find_current(posts_dir, n["id"], prev_id, is_dir=True)
        if cur:
            os.rename(cur, new_path)
            posts_renamed += 1
    print(f"post dirs renamed: {posts_renamed}")


if __name__ == "__main__":
    main()
