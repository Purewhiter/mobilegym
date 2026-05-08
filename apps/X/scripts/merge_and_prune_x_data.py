#!/usr/bin/env python3
"""
将 crawled_data.json 合并进 apps/X/data，并按「方案 B」修剪 posts.json。

方案 B（每作者最多 100 条，不含评论的需满足互动/粉丝门槛）：
  - replies.json 里有的帖子：优先保留（排序：先按是否有评论、再按点赞）
  - 否则：百万粉任意保留（在 cap 内）；10 万粉且全站点赞排名 <100；1 万粉且 likes>=100；任意 likes>=1000

用法:
  python3 apps/X/scripts/merge_and_prune_x_data.py
  python3 apps/X/scripts/merge_and_prune_x_data.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import shutil
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from x_text_cleaner import clean_post_content

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CRAWLED_PATH = Path(__file__).resolve().parent / "crawled_data.json"
MAX_PER_AUTHOR = 100


def twitter_created_to_iso(created_at: str) -> str:
    """Twitter syndication: 'Wed Mar 25 04:43:06 +0000 2026' -> ISO UTC."""
    if not created_at:
        return ""
    dt = datetime.strptime(created_at, "%a %b %d %H:%M:%S %z %Y")
    dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")


def tier_b_keep(p: dict, followers: int, rank_by_likes: int) -> bool:
    likes = int(p.get("stats", {}).get("likes") or 0)
    if followers >= 1_000_000:
        return True
    if followers >= 100_000 and rank_by_likes < 100:
        return True
    if followers >= 10_000 and likes >= 100:
        return True
    if likes >= 1000:
        return True
    return False


def prune_posts(posts: list, users: dict, reply_post_ids: set[str]) -> list:
    by_author: dict[str, list] = defaultdict(list)
    for p in posts:
        by_author[p["authorId"]].append(p)

    keep_ids: set[str] = set()
    for author_id, ps in by_author.items():
        followers = int(users.get(author_id, {}).get("followers") or 0)
        ps_by_likes = sorted(ps, key=lambda p: -int(p.get("stats", {}).get("likes") or 0))
        rank_by_id = {p["id"]: i for i, p in enumerate(ps_by_likes)}
        ps_merged = sorted(
            ps,
            key=lambda p: (
                0 if p["id"] in reply_post_ids else 1,
                -int(p.get("stats", {}).get("likes") or 0),
            ),
        )
        take: list = []
        for p in ps_merged:
            if len(take) >= MAX_PER_AUTHOR:
                break
            if p["id"] in reply_post_ids:
                take.append(p)
                continue
            r = rank_by_id[p["id"]]
            if tier_b_keep(p, followers, r):
                take.append(p)
        for p in take:
            keep_ids.add(p["id"])

    return [p for p in posts if p["id"] in keep_ids]


def crawled_user_to_x(screen_name: str, u: dict) -> dict:
    low = screen_name.lower()
    uid = f"u_{low}"
    sn = u.get("screen_name") or screen_name
    handle = f"@{sn}"
    ver = u.get("verification") or {}
    avatar = (u.get("avatar_url") or "").replace("_normal", "_200x200")
    out = {
        "id": uid,
        "name": u.get("name") or sn,
        "handle": handle,
        "screenName": sn,
        "avatar": avatar or "https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png",
        "verified": bool(ver.get("verified") if isinstance(ver, dict) else False)
        or int(u.get("followers") or 0) >= 100000,
        "bio": u.get("description") or "",
        "location": u.get("location") or "",
        "following": int(u.get("following") or 0),
        "followers": int(u.get("followers") or 0),
    }
    if u.get("banner_url"):
        out["banner"] = u["banner_url"]
    if u.get("joined"):
        out["joinDate"] = u["joined"]
    wid = u.get("id")
    if wid:
        out["restId"] = str(wid)
    return out


def crawled_tweet_to_post(screen_name: str, author_id: str, t: dict) -> dict:
    tid = t["id"]
    sn = screen_name
    permalink = (t.get("permalink") or "").strip()
    if permalink.startswith("/"):
        tweet_url = f"https://x.com{permalink}"
    else:
        tweet_url = f"https://x.com/{sn}/status/{tid}"
    images = t.get("images") or []
    videos = t.get("videos") or []
    post = {
        "id": f"p_{tid}",
        "authorId": author_id,
        "content": clean_post_content(
            t.get("text"),
            images[0] if images else None,
            videos[0] if videos else None,
        ),
        "time": twitter_created_to_iso(t.get("created_at") or ""),
        "tweetUrl": tweet_url,
        "stats": {
            "comments": int(t.get("replies") or 0),
            "retweets": int(t.get("retweets") or 0),
            "likes": int(t.get("likes") or 0),
            "views": int(t.get("views") or 0),
        },
    }
    if images:
        post["image"] = images[0]
    if videos:
        post["video"] = videos[0]
    return post


def merge_user(existing: dict, incoming: dict) -> dict:
    """保留现有展示字段，用爬取数据补强数字与头像。"""
    m = dict(existing)
    for k in ("followers", "following", "verified", "avatar", "banner", "bio", "name"):
        if k in incoming and incoming[k] is not None and incoming[k] != "":
            if k in ("followers", "following"):
                m[k] = max(int(m.get(k) or 0), int(incoming[k] or 0))
            elif k == "bio" and existing.get("bio"):
                pass
            else:
                m[k] = incoming[k]
    m.setdefault("handle", incoming.get("handle"))
    m.setdefault("screenName", incoming.get("screenName"))
    return m


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--no-backup", action="store_true")
    args = ap.parse_args()

    for name in ("posts.json", "users.json", "replies.json"):
        p = DATA_DIR / name
        if not p.exists():
            raise SystemExit(f"缺少 {p}")

    crawled = json.loads(CRAWLED_PATH.read_text(encoding="utf-8"))
    users = json.loads((DATA_DIR / "users.json").read_text(encoding="utf-8"))
    posts = json.loads((DATA_DIR / "posts.json").read_text(encoding="utf-8"))
    replies = json.loads((DATA_DIR / "replies.json").read_text(encoding="utf-8"))

    reply_post_ids = set(replies.keys())
    existing_post_ids = {p["id"] for p in posts}

    added_posts = 0
    added_users = 0
    for block in crawled:
        sn = block.get("screen_name") or (block.get("user") or {}).get("screen_name")
        u_raw = block.get("user") or {}
        if not sn or not u_raw:
            continue
        uid = f"u_{sn.lower()}"
        xu = crawled_user_to_x(sn, u_raw)
        if uid in users:
            users[uid] = merge_user(users[uid], xu)
        else:
            users[uid] = xu
            added_users += 1

        for t in block.get("tweets") or []:
            if not t.get("id"):
                continue
            pid = f"p_{t['id']}"
            if pid in existing_post_ids:
                continue
            posts.append(crawled_tweet_to_post(sn, uid, t))
            existing_post_ids.add(pid)
            added_posts += 1

    before_len = len(posts)
    posts = prune_posts(posts, users, reply_post_ids)
    after_len = len(posts)
    kept_ids = {p["id"] for p in posts}

    new_replies = {k: v for k, v in replies.items() if k in kept_ids}
    dropped_replies = len(replies) - len(new_replies)

    print(
        "合并: +%d 用户(新键), +%d 推文 | 修剪: %d -> %d 推文 | replies: %d -> %d (丢弃 %d 条帖子下的评论树)"
        % (
            added_users,
            added_posts,
            before_len,
            after_len,
            len(replies),
            len(new_replies),
            dropped_replies,
        )
    )

    if args.dry_run:
        print("dry-run: 未写入文件")
        return

    if not args.no_backup:
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        for name in ("posts.json", "users.json", "replies.json"):
            src = DATA_DIR / name
            shutil.copy2(src, src.with_suffix(f".json.bak.{ts}"))

    (DATA_DIR / "users.json").write_text(
        json.dumps(users, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (DATA_DIR / "posts.json").write_text(
        json.dumps(posts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (DATA_DIR / "replies.json").write_text(
        json.dumps(new_replies, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print("已写入 %s (users / posts / replies)" % DATA_DIR)


if __name__ == "__main__":
    main()
