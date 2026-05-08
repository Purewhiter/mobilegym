import json
from pathlib import Path
from urllib.parse import quote


def load_json(path: Path):
    return json.loads(path.read_text())


def normalize_screen_name(user_id: str) -> str:
    if user_id.startswith("u_"):
        return user_id[2:]
    return user_id


def build_placeholder_user(user_id: str) -> dict:
    screen_name = normalize_screen_name(user_id)
    handle = f"@{screen_name}"
    seed = quote(screen_name, safe="")
    return {
        "id": user_id,
        "name": screen_name,
        "handle": handle,
        "avatar": f"https://api.dicebear.com/7.x/avataaars/svg?seed={seed}",
        "screenName": screen_name,
        "verified": False,
        "bio": "",
        "location": "",
        "website": "",
        "joinDate": "",
        "following": 0,
        "followers": 0,
    }


def normalize_existing_user(user_id: str, user: dict) -> dict:
    normalized = dict(user)
    screen_name = normalized.get("screenName") or normalize_screen_name(user_id)
    handle = normalized.get("handle") or f"@{screen_name}"
    seed = quote(screen_name, safe="")

    normalized.setdefault("id", user_id)
    normalized.setdefault("name", screen_name)
    normalized.setdefault("handle", handle)
    normalized.setdefault("screenName", screen_name)
    normalized.setdefault("verified", False)
    normalized.setdefault("bio", "")
    normalized.setdefault("location", "")
    normalized.setdefault("website", "")
    normalized.setdefault("joinDate", "")
    normalized.setdefault("following", 0)
    normalized.setdefault("followers", 0)

    if not normalized.get("avatar"):
        normalized["avatar"] = f"https://api.dicebear.com/7.x/avataaars/svg?seed={seed}"

    return normalized


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    data_dir = script_dir.parent / "data"

    users_path = data_dir / "users.json"
    defaults_path = data_dir / "defaults.json"
    replies_path = data_dir / "replies.json"

    users = load_json(users_path)
    default_users = load_json(defaults_path).get("xUsers", {})
    replies = load_json(replies_path)

    combined_user_ids = set(default_users) | set(users)
    missing_author_ids = sorted(
        {
            reply["authorId"]
            for reply_list in replies.values()
            for reply in reply_list
            if isinstance(reply, dict)
            and isinstance(reply.get("authorId"), str)
            and reply["authorId"] not in combined_user_ids
        }
    )

    for user_id in missing_author_ids:
        users[user_id] = build_placeholder_user(user_id)

    for user_id, user in list(users.items()):
        users[user_id] = normalize_existing_user(user_id, user)

    users_path.write_text(json.dumps(users, ensure_ascii=False, indent=2) + "\n")

    print(f"missing_author_ids={len(missing_author_ids)}")
    print(f"final_users={len(users)}")


if __name__ == "__main__":
    main()
