#!/usr/bin/env python3
"""把 apps/RedBook/data/defaults.json 里所有原始 xhs ID 替换为新哈希 ID。

defaults.json 包含登录用户 xiaoming 的：
  - followings: [user.id, ...]
  - likedNotes / collectedNotes: [note.id, ...]
  - likedCommentsByNote: { note.id: [comment.id, ...] }

以及 sampleNotes / sampleUsers / etc 里嵌入的若干用户 / 帖子记录。

本脚本根据 id_mapping.json 全量替换。原始 ID 找不到映射的（如 'xiaoming' 这种自创 ID）
保留不动；自创的 sample notes（id 是 'note_0'/'note_1' 这种）也保留。
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

DEFAULTS_PATH = Path("/home/dingbang.wu/mobile-gym/apps/RedBook/data/defaults.json")
MAPPING_PATH = Path("/home/dingbang.wu/.config/redbook_sanitizer_secret.json")
USERS_JSON = Path("/home/dingbang.wu/mobile-gym/apps/RedBook/data/users.json")
NOTES_JSON = Path("/home/dingbang.wu/mobile-gym/apps/RedBook/data/notes.json")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--defaults", default=str(DEFAULTS_PATH))
    ap.add_argument("--mapping", default=str(MAPPING_PATH))
    ap.add_argument("--users-json", default=str(USERS_JSON))
    ap.add_argument("--notes-json", default=str(NOTES_JSON))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    defaults = json.load(open(args.defaults, encoding="utf-8"))
    mapping = json.load(open(args.mapping, encoding="utf-8"))
    user_map = mapping.get("users", {})
    note_map = mapping.get("notes", {})
    comment_map = mapping.get("comments", {})
    print(f"loaded mapping: users={len(user_map)} notes={len(note_map)} comments={len(comment_map)}")

    # 加载 sanitized users.json / notes.json 用于覆盖 defaults 内嵌记录
    sanitized_users = {u["id"]: u for u in json.load(open(args.users_json, encoding="utf-8"))}
    sanitized_notes = {n["id"]: n for n in json.load(open(args.notes_json, encoding="utf-8"))}
    print(f"loaded sanitized: users={len(sanitized_users)} notes={len(sanitized_notes)}")

    # 1. user.followings: list of user.id
    user = defaults.get("user", {})
    if "followings" in user:
        old = list(user["followings"])
        new = [user_map.get(uid, uid) for uid in old]
        user["followings"] = new
        diff = sum(1 for a, b in zip(old, new) if a != b)
        print(f"user.followings: {len(old)} 个，替换 {diff}")

    # 2. user.likedNotes / collectedNotes: list of note.id
    for key in ("likedNotes", "collectedNotes"):
        if key in user:
            old = list(user[key])
            new = [note_map.get(nid, nid) for nid in old]
            user[key] = new
            diff = sum(1 for a, b in zip(old, new) if a != b)
            print(f"user.{key}: {len(old)} 个，替换 {diff}")

    # 3. user.likedCommentsByNote: {note.id: [comment.id, ...]}
    if "likedCommentsByNote" in user:
        old_map = user["likedCommentsByNote"]
        new_map: dict[str, list[str]] = {}
        n_keys = 0
        n_items = 0
        for nid, cids in old_map.items():
            new_nid = note_map.get(nid, nid)
            new_cids = [comment_map.get(c, c) for c in cids]
            new_map[new_nid] = new_cids
            n_keys += int(new_nid != nid)
            n_items += sum(1 for a, b in zip(cids, new_cids) if a != b)
        user["likedCommentsByNote"] = new_map
        print(f"user.likedCommentsByNote: 替换 {n_keys} note key, {n_items} comment id")

    # 4. defaults.users: 嵌入的若干 user 记录
    # 这些 records 在 loader.ts 里 merge 时**覆盖** users.json 同 id 记录
    # → 必须用 sanitized 数据替换 name/avatar/intro 等内容字段
    if "users" in defaults:
        old_users = defaults["users"]
        replaced_id = 0
        rewritten = 0
        new_arr = []
        for u in old_users:
            uid = u.get("id")
            new_id = user_map.get(uid, uid)
            if new_id != uid:
                replaced_id += 1
            # 用 sanitized 同 id 的 user 内容覆盖
            sani = sanitized_users.get(new_id)
            if sani:
                merged = {**u, **sani}  # sanitized 字段优先
                merged["id"] = new_id
                new_arr.append(merged)
                rewritten += 1
            else:
                u["id"] = new_id
                new_arr.append(u)
        defaults["users"] = new_arr
        print(f"defaults.users: {len(old_users)} 个，替换 ID {replaced_id}, 用 sanitized 数据覆盖 {rewritten}")

    # 5. defaults.sampleNotes: 同样用 sanitized 覆盖
    if "sampleNotes" in defaults:
        old_n = defaults["sampleNotes"]
        replaced_id = 0
        rewritten = 0
        new_arr = []
        for n in old_n:
            nid = n.get("id")
            new_id = note_map.get(nid, nid)
            if new_id != nid:
                replaced_id += 1
            sani = sanitized_notes.get(new_id)
            if sani:
                # sanitized 数据覆盖：title/content/tags/cover/images/commentList/authorId 等
                merged = {**n, **sani}
                merged["id"] = new_id
                new_arr.append(merged)
                rewritten += 1
            else:
                # 没有 sanitized 对应 → 至少修 ID 和 authorId
                n["id"] = new_id
                if n.get("authorId") in user_map:
                    n["authorId"] = user_map[n["authorId"]]
                for c in n.get("commentList") or []:
                    if c.get("id") in comment_map:
                        c["id"] = comment_map[c["id"]]
                    if c.get("userId") in user_map:
                        c["userId"] = user_map[c["userId"]]
                new_arr.append(n)
        defaults["sampleNotes"] = new_arr
        print(f"defaults.sampleNotes: {len(old_n)} 个，替换 ID {replaced_id}, 用 sanitized 数据覆盖 {rewritten}")

    # 6. (可选) 其他嵌入字段：feedSearchHotwords / feedSearchHistory 通常是字符串列表，不动
    # 6.5. user.publishedNoteIds: 这些是用户自己发的（如 'note_0'/'note_1'），不在 note_map 里，保留
    # 6.6. user.commentList: 用户在别人帖子下的评论，可能有 noteId 字段
    if "commentList" in user:
        for c in user["commentList"] or []:
            if isinstance(c, dict):
                if c.get("noteId") in note_map:
                    c["noteId"] = note_map[c["noteId"]]
                if c.get("id") in comment_map:
                    c["id"] = comment_map[c["id"]]

    if args.dry_run:
        print("\n[dry-run] 未写入文件")
        return

    Path(args.defaults + ".orig.bak").write_text(
        json.dumps(json.load(open(args.defaults, encoding="utf-8")), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    json.dump(defaults, open(args.defaults, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\n写入: {args.defaults}")
    print(f"备份: {args.defaults}.orig.bak")


if __name__ == "__main__":
    main()
