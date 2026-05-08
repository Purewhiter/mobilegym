import argparse
import json
import subprocess
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


COMMIT = "665191c98ee31b7a96ad0a830fb7b9c014c46ccd"
REMOTE_IMPORTED_DATA = "apps/X/data/importedData.json"
REMOTE_CRAWLED_REPLIES = "apps/X/data/crawled_replies.json"


def load_git_json(revision: str, path: str) -> Any:
    raw = subprocess.check_output(["git", "show", f"{revision}:{path}"])
    return json.loads(raw)


def normalize_post_id(post_id: str) -> str:
    return post_id if post_id.startswith("p_") else f"p_{post_id}"


def normalize_handle(handle: str | None) -> str | None:
    if not handle:
        return None
    value = handle.strip()
    if not value:
        return None
    return value if value.startswith("@") else f"@{value}"


def user_id_from_handle(handle: str) -> str:
    return f"u_{handle.lstrip('@')}"


def parse_iso_datetime(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def to_relative_time(value: str, reference_now: datetime) -> str:
    parsed = parse_iso_datetime(value)
    if parsed is None:
        return value

    seconds = max(0, int((reference_now - parsed).total_seconds()))
    if seconds < 60:
        return "刚刚"

    minutes = seconds // 60
    if minutes < 60:
        return f"{minutes}m"

    hours = seconds // 3600
    if hours < 24:
        return f"{hours}h"

    days = seconds // 86400
    return f"{days}d"


def is_missing(value: Any) -> bool:
    return value is None or value == ""


def merge_user(existing: dict[str, Any] | None, incoming: dict[str, Any]) -> dict[str, Any]:
    merged = deepcopy(existing) if existing else {}

    for key, value in incoming.items():
        if is_missing(value):
            continue
        if key not in merged or is_missing(merged[key]):
            merged[key] = value

    merged.setdefault("id", incoming["id"])
    merged.setdefault("name", incoming.get("name") or incoming["id"])
    merged.setdefault("handle", incoming.get("handle") or "@unknown")
    merged.setdefault("avatar", incoming.get("avatar", ""))
    merged.setdefault("verified", incoming.get("verified", False))
    merged.setdefault("following", incoming.get("following", 0))
    merged.setdefault("followers", incoming.get("followers", 0))
    return merged


def build_imported_user_profile(raw_user: dict[str, Any], fallback_handle: str | None = None) -> dict[str, Any] | None:
    handle = normalize_handle(raw_user.get("handle") or raw_user.get("id") or fallback_handle)
    if handle is None:
        return None

    screen_name = handle.lstrip("@")
    return {
        "id": user_id_from_handle(screen_name),
        "name": raw_user.get("name") or screen_name,
        "handle": handle,
        "avatar": raw_user.get("avatar", ""),
        "banner": raw_user.get("banner"),
        "verified": bool(raw_user.get("verified", False)),
        "bio": raw_user.get("bio", ""),
        "location": raw_user.get("location", ""),
        "website": raw_user.get("website", ""),
        "joinDate": raw_user.get("joinDate", ""),
        "following": raw_user.get("following", 0),
        "followers": raw_user.get("followers", 0),
        "screenName": screen_name,
    }


def build_reply_user_profile(raw_author: dict[str, Any]) -> dict[str, Any] | None:
    handle = normalize_handle(raw_author.get("handle"))
    if handle is None:
        return None

    screen_name = handle.lstrip("@")
    return {
        "id": user_id_from_handle(screen_name),
        "name": raw_author.get("name") or screen_name,
        "handle": handle,
        "avatar": raw_author.get("avatar", ""),
        "verified": False,
        "bio": "",
        "following": 0,
        "followers": 0,
        "screenName": screen_name,
    }


def build_handle_index(users: dict[str, dict[str, Any]]) -> dict[str, str]:
    handle_to_uid: dict[str, str] = {}
    for uid, user in users.items():
        handle = normalize_handle(user.get("handle"))
        if handle:
            handle_to_uid.setdefault(handle.lower(), uid)
    return handle_to_uid


def upsert_user(
    users: dict[str, dict[str, Any]],
    handle_to_uid: dict[str, str],
    profile: dict[str, Any] | None,
) -> str | None:
    if profile is None:
        return None

    handle = normalize_handle(profile.get("handle"))
    if handle is None:
        return None

    handle_key = handle.lower()
    existing_uid = handle_to_uid.get(handle_key)
    if existing_uid:
        profile = {**profile, "id": existing_uid}
        users[existing_uid] = merge_user(users.get(existing_uid), profile)
        return existing_uid

    uid = profile["id"]
    users[uid] = merge_user(users.get(uid), profile)
    handle_to_uid[handle_key] = uid
    return uid


def convert_post(
    raw_post: dict[str, Any],
    imported_users: dict[str, dict[str, Any]],
    users: dict[str, dict[str, Any]],
    handle_to_uid: dict[str, str],
    reference_now: datetime,
) -> dict[str, Any]:
    author_ref = raw_post.get("authorId")
    imported_user = imported_users.get(author_ref, {})
    profile = build_imported_user_profile(imported_user, fallback_handle=author_ref)
    author_id = upsert_user(users, handle_to_uid, profile)

    post_id = normalize_post_id(raw_post["id"])
    converted = {
        "id": post_id,
        "authorId": author_id or user_id_from_handle("unknown"),
        "content": raw_post.get("content", ""),
        "time": to_relative_time(raw_post.get("time", ""), reference_now),
        "tweetUrl": raw_post.get("tweetUrl"),
        "stats": raw_post.get("stats", {"comments": 0, "retweets": 0, "likes": 0, "views": 0}),
    }

    if raw_post.get("image"):
        converted["image"] = raw_post["image"]
    if raw_post.get("video"):
        converted["video"] = raw_post["video"]
    if raw_post.get("quotedPostId"):
        converted["quotedPostId"] = normalize_post_id(raw_post["quotedPostId"])
    if raw_post.get("threadId"):
        converted["threadId"] = normalize_post_id(raw_post["threadId"])

    return converted


def convert_reply(
    root_post_id: str,
    reply_index: int,
    raw_reply: dict[str, Any],
    users: dict[str, dict[str, Any]],
    handle_to_uid: dict[str, str],
) -> dict[str, Any]:
    profile = build_reply_user_profile(raw_reply.get("author", {}))
    author_id = upsert_user(users, handle_to_uid, profile)

    return {
        "id": f"r_{root_post_id}_{reply_index}",
        "authorId": author_id or user_id_from_handle("unknown"),
        "content": raw_reply.get("text", ""),
        "time": raw_reply.get("time", ""),
        "stats": {
            "comments": 0,
            "retweets": 0,
            "likes": 0,
            "views": 0,
        },
        "replies": [],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Merge bojiang X dataset additions into local split JSON files.")
    parser.add_argument(
        "--reference-date",
        default="2026-03-13T00:00:00+00:00",
        help="Reference datetime used to convert imported post ISO timestamps into relative display strings.",
    )
    args = parser.parse_args()

    reference_now = datetime.fromisoformat(args.reference_date)
    if reference_now.tzinfo is None:
        reference_now = reference_now.replace(tzinfo=timezone.utc)

    script_dir = Path(__file__).resolve().parent
    repo_root = script_dir.parent.parent.parent
    data_dir = repo_root / "apps" / "X" / "data"

    posts_path = data_dir / "posts.json"
    users_path = data_dir / "users.json"
    replies_path = data_dir / "replies.json"

    local_posts = json.loads(posts_path.read_text())
    local_users = json.loads(users_path.read_text())
    local_replies = json.loads(replies_path.read_text())

    old_imported = load_git_json(f"{COMMIT}^", REMOTE_IMPORTED_DATA)
    new_imported = load_git_json(COMMIT, REMOTE_IMPORTED_DATA)
    old_replies = load_git_json(f"{COMMIT}^", REMOTE_CRAWLED_REPLIES)
    new_replies = load_git_json(COMMIT, REMOTE_CRAWLED_REPLIES)

    added_post_ids = sorted(set(p["id"] for p in new_imported["importedPosts"]) - set(p["id"] for p in old_imported["importedPosts"]))
    added_reply_root_ids = sorted(set(new_replies) - set(old_replies))

    new_post_map = {post["id"]: post for post in new_imported["importedPosts"]}
    imported_user_map = new_imported["importedUsers"]

    posts = deepcopy(local_posts)
    users = deepcopy(local_users)
    replies = deepcopy(local_replies)

    handle_to_uid = build_handle_index(users)
    local_post_index = {post["id"]: idx for idx, post in enumerate(posts)}

    added_user_count = 0
    updated_user_count = 0
    inserted_post_count = 0
    replaced_post_count = 0
    inserted_reply_root_count = 0
    replaced_reply_root_count = 0

    for raw_user in imported_user_map.values():
        profile = build_imported_user_profile(raw_user)
        if profile is None:
            continue
        target_uid = handle_to_uid.get(profile["handle"].lower())
        existed = target_uid in users if target_uid else False
        upsert_user(users, handle_to_uid, profile)
        if existed:
            updated_user_count += 1
        else:
            added_user_count += 1

    for raw_post_id in added_post_ids:
        raw_post = new_post_map[raw_post_id]
        converted = convert_post(raw_post, imported_user_map, users, handle_to_uid, reference_now)
        existing_idx = local_post_index.get(converted["id"])
        if existing_idx is None:
            local_post_index[converted["id"]] = len(posts)
            posts.append(converted)
            inserted_post_count += 1
        else:
            posts[existing_idx] = converted
            replaced_post_count += 1

    for raw_root_id in added_reply_root_ids:
        normalized_root_id = normalize_post_id(raw_root_id)
        converted_replies = [
            convert_reply(normalized_root_id, index, raw_reply, users, handle_to_uid)
            for index, raw_reply in enumerate(new_replies[raw_root_id])
        ]
        if normalized_root_id in replies:
            replaced_reply_root_count += 1
        else:
            inserted_reply_root_count += 1
        replies[normalized_root_id] = converted_replies

    posts_path.write_text(json.dumps(posts, ensure_ascii=False, indent=2) + "\n")
    users_path.write_text(json.dumps(users, ensure_ascii=False, indent=2) + "\n")
    replies_path.write_text(json.dumps(replies, ensure_ascii=False, indent=2) + "\n")

    print(f"reference_date={reference_now.isoformat()}")
    print(f"added_post_ids={len(added_post_ids)}")
    print(f"added_reply_root_ids={len(added_reply_root_ids)}")
    print(f"users_added={len(users) - len(local_users)}")
    print(f"users_touched_added_from_imported={added_user_count}")
    print(f"users_touched_updated_from_imported={updated_user_count}")
    print(f"posts_inserted={inserted_post_count}")
    print(f"posts_replaced={replaced_post_count}")
    print(f"reply_roots_inserted={inserted_reply_root_count}")
    print(f"reply_roots_replaced={replaced_reply_root_count}")
    print(f"final_users={len(users)}")
    print(f"final_posts={len(posts)}")
    print(f"final_reply_roots={len(replies)}")


if __name__ == "__main__":
    main()
