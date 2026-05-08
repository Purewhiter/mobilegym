#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import shutil
from copy import deepcopy
from pathlib import Path
from typing import Any

from io_utils import BILIBILI_DATA, PROJECT_ROOT, read_json, write_json


DEFAULT_SOURCE = PROJECT_ROOT / "scripts" / "bilibili_sanitizer_v1" / "out" / "users_full_20260503"
DEFAULT_TARGET = PROJECT_ROOT / "mobilegym-data" / "bilibili"
DEFAULT_ARTIFACTS = PROJECT_ROOT / "mobilegym-data" / "_artifacts" / "bilibili" / "users_full_20260503"

FAKE_VIDEO_PREFIX = "BVmg"
FAKE_AID_BASE = 900_000_000_000
FAKE_CID_BASE = 910_000_000_000
FAKE_MID_BASE = 800_000_000_000
FAKE_RPID_BASE = 920_000_000_000
PGC_PARTITIONS = {"番剧", "国创", "纪录片", "电影", "电视剧"}
DEFAULT_COVER_REL = "./images/covers/default.svg"

FORBIDDEN_RUNTIME_MARKERS = (
    "hdslb.com",
    "b23.tv",
    "player.bilibili.com",
    "api.bilibili.com",
    "api.dicebear.com",
    "picsum.photos",
    "BV1",
)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    if not path.exists():
        return rows
    with path.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def read_jsonl_map(path: Path, key: str) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for row in read_jsonl(path):
        value = row.get(key)
        if value is not None:
            out[str(value)] = row
    return out


def load_defaults_for_publish(data_path: Path, artifacts: Path) -> dict[str, Any]:
    source_defaults = artifacts / "source_defaults.json"
    defaults = read_json(source_defaults if source_defaults.exists() else data_path)
    user = defaults.get("user") or {}
    relation_mids = [
        str(item.get("mid") or "")
        for key in ("followingList", "followersList")
        for item in user.get(key) or []
    ]
    already_sanitized = (
        str(user.get("uid") or "") == "800000000000"
        or any(mid.startswith("800000") for mid in relation_mids)
        or str(user.get("avatar") or "").startswith("./images/")
    )
    if already_sanitized and not source_defaults.exists():
        raise RuntimeError(
            "apps/Bilibili/data/defaults.json 已经像是发布后的 fake-id 版本；"
            "请先把原始 defaults.json 放到 artifacts/source_defaults.json，再重跑发布脚本。"
        )
    return defaults


def write_runtime_json(path: Path, payload: Any) -> None:
    write_json(path, scrub_runtime_value(payload))


def scrub_runtime_text(value: str) -> str:
    value = re.sub(r"https?://\S+", "", value)
    value = re.sub(r"BV1[0-9A-Za-z]+", "视频编号", value)
    value = re.sub(r"\bav\d+\b", "视频编号", value, flags=re.IGNORECASE)
    return value.replace("b23.tv", "").replace("hdslb.com", "").replace("player.bilibili.com", "")


def scrub_runtime_value(value: Any) -> Any:
    if isinstance(value, str):
        return scrub_runtime_text(value)
    if isinstance(value, list):
        return [scrub_runtime_value(item) for item in value]
    if isinstance(value, dict):
        return {key: scrub_runtime_value(child) for key, child in value.items()}
    return value


def stable_fake_video_id(index: int) -> str:
    return f"{FAKE_VIDEO_PREFIX}{index:08d}"


def as_video_id(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("id") or value.get("bvid") or value.get("videoId") or "")
    return str(value or "")


def walk_comments(comments: list[dict[str, Any]] | None):
    for comment in comments or []:
        yield comment
        yield from walk_comments(comment.get("replies") or [])


def collect_comment_meta(comments: list[dict[str, Any]] | None) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for comment in walk_comments(comments):
        rpid = str(comment.get("rpid") or "")
        if rpid:
            out[rpid] = comment
    return out


def build_case_insensitive_file_map(directory: Path) -> dict[str, Path]:
    out: dict[str, Path] = {}
    if not directory.exists():
        return out
    for path in directory.iterdir():
        if path.is_file():
            out.setdefault(path.stem.lower(), path)
    return out


def resolve_source_file(directory: Path, stem: str, suffix: str, ci_map: dict[str, Path]) -> Path | None:
    direct = directory / f"{stem}{suffix}"
    if direct.exists():
        return direct
    return ci_map.get(stem.lower())


def copy_image(src: Path | None, dst: Path, warnings: list[str]) -> str:
    rel = f"./images/{dst.parent.name}/{dst.name}"
    if src is None or not src.exists():
        warnings.append(f"missing image source for {rel}")
        return rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    if not dst.exists() or src.stat().st_size != dst.stat().st_size:
        shutil.copy2(src, dst)
    return rel


def load_selected_ids(source: Path) -> list[str]:
    selected_path = source / "selection_k40" / "selected_video_ids.txt"
    if not selected_path.exists():
        raise FileNotFoundError(f"missing selected ids: {selected_path}")
    ids = [line.strip() for line in selected_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if not ids:
        raise ValueError("selected_video_ids.txt is empty")
    return ids


def ordered_video_ids(videos: list[dict[str, Any]], selected_ids: list[str]) -> list[str]:
    all_ids = [str(video.get("id") or "") for video in videos if video.get("id")]
    all_set = set(all_ids)
    selected = [video_id for video_id in selected_ids if video_id in all_set]
    selected_set = set(selected)
    return selected + [video_id for video_id in all_ids if video_id not in selected_set]


def build_video_maps(video_ids: list[str]) -> tuple[dict[str, str], dict[str, dict[str, Any]]]:
    old_to_fake: dict[str, str] = {}
    private: dict[str, dict[str, Any]] = {}
    for index, old_id in enumerate(video_ids, start=1):
        fake_id = stable_fake_video_id(index)
        old_to_fake[old_id] = fake_id
        private[old_id] = {
            "newId": fake_id,
            "newBvid": fake_id,
            "newAid": FAKE_AID_BASE + index,
            "newCid": FAKE_CID_BASE + index,
        }
    return old_to_fake, private


def collect_needed_mids(
    *,
    selected_ids: set[str],
    videos: list[dict[str, Any]],
    authors: dict[str, dict[str, Any]],
    comments_by_video: dict[str, dict[str, Any]],
    comment_rewrites: dict[str, dict[str, Any]],
    defaults: dict[str, Any],
) -> set[str]:
    needed: set[str] = set()
    for video in videos:
        if str(video.get("id") or "") not in selected_ids:
            continue
        owner = video.get("raw", {}).get("owner") if isinstance(video.get("raw"), dict) else None
        if isinstance(owner, dict) and owner.get("mid") is not None:
            needed.add(str(owner["mid"]))

    for mid, author in authors.items():
        if any(as_video_id(item) in selected_ids for item in author.get("videos") or []):
            needed.add(str(mid))

    for video_id, payload in comments_by_video.items():
        if str(video_id) not in selected_ids and str(payload.get("bvid") or "") not in selected_ids:
            continue
        for comment in walk_comments(payload.get("comments") or []):
            if comment.get("mid") is not None:
                needed.add(str(comment["mid"]))

    for row in comment_rewrites.values():
        for comment in walk_comments(row.get("comments") or []):
            if comment.get("mid") is not None:
                needed.add(str(comment["mid"]))

    user = defaults.get("user") or {}
    for key in ("followingList", "followersList"):
        for item in user.get(key) or []:
            if item.get("mid") is not None:
                needed.add(str(item["mid"]))

    return needed


def build_mid_map(mids: set[str]) -> dict[str, int]:
    def sort_key(value: str) -> tuple[int, Any]:
        try:
            return (0, int(value))
        except ValueError:
            return (1, value)

    return {mid: FAKE_MID_BASE + index for index, mid in enumerate(sorted(mids, key=sort_key), start=1)}


def rewrite_user_name(
    *,
    mid: str,
    namespace: str,
    rewrites: dict[str, dict[str, Any]],
) -> tuple[str, str]:
    rewrite = rewrites.get(f"{namespace}:{mid}") or rewrites.get(f"author:{mid}") or rewrites.get(f"commenter:{mid}")
    name = str(rewrite.get("name") or "").strip() if rewrite else ""
    sign = str(rewrite.get("sign") or "").strip() if rewrite else ""
    if not name:
        raise RuntimeError(f"missing rewritten user name for {namespace}:{mid}")
    return name, sign


def avatar_for_mid(
    *,
    mid: str,
    namespace: str,
    fake_mid: int,
    avatar_mapping: dict[str, str],
    source_avatar_dir: Path,
    target_avatar_dir: Path,
    warnings: list[str],
) -> str:
    rel = (
        avatar_mapping.get(f"{namespace}:{mid}")
        or avatar_mapping.get(f"author:{mid}")
        or avatar_mapping.get(f"commenter:{mid}")
    )
    if not rel:
        raise RuntimeError(f"missing avatar mapping for {namespace}:{mid}")
    src = source_avatar_dir / Path(rel).name if rel else None
    if src is None or not src.exists():
        raise RuntimeError(f"missing avatar file for {namespace}:{mid}: {rel}")
    return copy_image(src, target_avatar_dir / f"mid_{fake_mid}.jpg", warnings)


def build_public_user(
    *,
    source: dict[str, Any],
    old_mid: str,
    fake_mid: int,
    namespace: str,
    user_rewrites: dict[str, dict[str, Any]],
    avatar_mapping: dict[str, str],
    source_avatar_dir: Path,
    target_avatar_dir: Path,
    warnings: list[str],
) -> dict[str, Any]:
    name, sign = rewrite_user_name(
        mid=old_mid,
        namespace=namespace,
        rewrites=user_rewrites,
    )
    return {
        "mid": fake_mid,
        "name": name,
        "face": avatar_for_mid(
            mid=old_mid,
            namespace=namespace,
            fake_mid=fake_mid,
            avatar_mapping=avatar_mapping,
            source_avatar_dir=source_avatar_dir,
            target_avatar_dir=target_avatar_dir,
            warnings=warnings,
        ),
        "sign": sign,
        "level": source.get("level", 0),
        "vip": source.get("vip") or {"status": 0, "label": ""},
        "official": {"role": 0, "title": "", "type": -1},
        "top_photo": "",
        "live_room": None,
        "follower": source.get("follower", 0),
        "following": source.get("following", 0),
        "likes": source.get("likes", 0),
        "videos": [],
        "location": source.get("location", ""),
    }


def rewrite_video(
    *,
    original: dict[str, Any],
    index: int,
    fake_id: str,
    fake_aid: int,
    video_rewrite: dict[str, Any] | None,
    owner_mid: str | None,
    fake_mid_by_old: dict[str, int],
    avatar_mapping: dict[str, str],
    source_avatar_dir: Path,
    target_avatar_dir: Path,
    source_cover_dir: Path,
    target_cover_dir: Path,
    cover_ci_map: dict[str, Path],
    use_generated_cover: bool,
    warnings: list[str],
) -> dict[str, Any]:
    is_pgc = str(original.get("partition") or "").strip() in PGC_PARTITIONS
    title_source = original if is_pgc else (video_rewrite or {})
    author_source = original if is_pgc else (video_rewrite or {})
    title = str(title_source.get("title") or "").strip()
    author = str(author_source.get("author") or "").strip()
    if not title:
        raise RuntimeError(f"missing rewritten title for video {original.get('id')}")
    if not author:
        raise RuntimeError(f"missing rewritten author for video {original.get('id')}")
    fake_mid = fake_mid_by_old.get(owner_mid or "")
    face = ""
    if owner_mid and fake_mid:
        face = avatar_for_mid(
            mid=owner_mid,
            namespace="author",
            fake_mid=fake_mid,
            avatar_mapping=avatar_mapping,
            source_avatar_dir=source_avatar_dir,
            target_avatar_dir=target_avatar_dir,
            warnings=warnings,
        )

    if use_generated_cover:
        cover_src = resolve_source_file(source_cover_dir, str(original.get("id") or ""), ".jpg", cover_ci_map)
        cover = copy_image(cover_src, target_cover_dir / f"{fake_id}.jpg", warnings)
    else:
        cover = DEFAULT_COVER_REL

    out: dict[str, Any] = {
        "id": fake_id,
        "title": title,
        "cover": cover,
        "author": author,
        "face": face,
        "plays": original.get("plays", 0),
        "danmaku": original.get("danmaku", 0),
        "duration": original.get("duration", ""),
        "date": original.get("date"),
        "desc": "",
        "partition": original.get("partition", ""),
        "stats": original.get("stats") or {},
    }
    if original.get("isAd"):
        out["isAd"] = True
    return out


def rewrite_comment_tree(
    *,
    comments: list[dict[str, Any]],
    original_meta: dict[str, dict[str, Any]],
    fake_mid_by_old: dict[str, int],
    user_rewrites: dict[str, dict[str, Any]],
    avatar_mapping: dict[str, str],
    source_avatar_dir: Path,
    target_avatar_dir: Path,
    rpid_map: dict[str, str],
    warnings: list[str],
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for comment in comments:
        old_rpid = str(comment.get("rpid") or "")
        old_mid = str(comment.get("mid") or "")
        if not old_rpid:
            old_rpid = f"missing_{len(rpid_map) + 1}"
        if old_rpid not in rpid_map:
            rpid_map[old_rpid] = str(FAKE_RPID_BASE + len(rpid_map) + 1)
        if old_mid not in fake_mid_by_old:
            warnings.append(f"comment references unknown mid: {old_mid}")
            continue
        fake_mid = fake_mid_by_old[old_mid]
        meta = original_meta.get(old_rpid) or {}
        name, _ = rewrite_user_name(
            mid=old_mid,
            namespace="commenter",
            rewrites=user_rewrites,
        )
        message = str(comment.get("message") or "").strip() or "这条评论已脱敏"
        out.append(
            {
                "rpid": rpid_map[old_rpid],
                "mid": str(fake_mid),
                "uname": str(comment.get("uname") or "").strip() or name,
                "avatar": avatar_for_mid(
                    mid=old_mid,
                    namespace="commenter",
                    fake_mid=fake_mid,
                    avatar_mapping=avatar_mapping,
                    source_avatar_dir=source_avatar_dir,
                    target_avatar_dir=target_avatar_dir,
                    warnings=warnings,
                ),
                "sex": meta.get("sex"),
                "level": meta.get("level", 0),
                "vip": meta.get("vip", False),
                "message": message,
                "like": meta.get("like", 0),
                "ctime": meta.get("ctime", 0),
                "rcount": meta.get("rcount", 0),
                "location": meta.get("location", ""),
                "time_desc": meta.get("time_desc", ""),
                "replies": rewrite_comment_tree(
                    comments=comment.get("replies") or [],
                    original_meta=original_meta,
                    fake_mid_by_old=fake_mid_by_old,
                    user_rewrites=user_rewrites,
                    avatar_mapping=avatar_mapping,
                    source_avatar_dir=source_avatar_dir,
                    target_avatar_dir=target_avatar_dir,
                    rpid_map=rpid_map,
                    warnings=warnings,
                )
                or None,
            }
        )
    return out


def map_video_ids_in_user_defaults(value: Any, old_to_fake_video: dict[str, str]) -> Any:
    if isinstance(value, list):
        return [mapped for item in value if (mapped := old_to_fake_video.get(str(item)))]
    if isinstance(value, dict):
        return {
            old_to_fake_video.get(str(k), str(k)): v
            for k, v in value.items()
            if str(k) in old_to_fake_video
        }
    return value


def rewrite_defaults(
    *,
    defaults: dict[str, Any],
    old_to_fake_video: dict[str, str],
    fake_mid_by_old: dict[str, int],
    user_rewrites: dict[str, dict[str, Any]],
    avatar_mapping: dict[str, str],
    source_avatar_dir: Path,
    target_avatar_dir: Path,
    warnings: list[str],
) -> dict[str, Any]:
    out = deepcopy(defaults)
    user = out.get("user") or {}
    user["uid"] = "800000000000"
    user["avatar"] = copy_image(
        next(iter(source_avatar_dir.glob("*.jpg")), None),
        target_avatar_dir / "self.jpg",
        warnings,
    )

    for list_key, namespace in (("followingList", "author"), ("followersList", "commenter")):
        rewritten = []
        for item in user.get(list_key) or []:
            old_mid = str(item.get("mid") or "")
            fake_mid = fake_mid_by_old.get(old_mid)
            if not fake_mid:
                continue
            name, sign = rewrite_user_name(
                mid=old_mid,
                namespace=namespace,
                rewrites=user_rewrites,
            )
            rewritten.append(
                {
                    **item,
                    "mid": str(fake_mid),
                    "name": name,
                    "face": avatar_for_mid(
                        mid=old_mid,
                        namespace=namespace,
                        fake_mid=fake_mid,
                        avatar_mapping=avatar_mapping,
                        source_avatar_dir=source_avatar_dir,
                        target_avatar_dir=target_avatar_dir,
                        warnings=warnings,
                    ),
                    "sign": sign,
                }
            )
        user[list_key] = rewritten

    user["following"] = len(user.get("followingList") or [])
    user["followers"] = len(user.get("followersList") or [])

    user["likedVideoIds"] = map_video_ids_in_user_defaults(user.get("likedVideoIds") or [], old_to_fake_video)
    user["dislikedVideoIds"] = map_video_ids_in_user_defaults(user.get("dislikedVideoIds") or [], old_to_fake_video)
    user["coinedVideoCoins"] = map_video_ids_in_user_defaults(user.get("coinedVideoCoins") or {}, old_to_fake_video)

    for folder in user.get("favoritesFolders") or []:
        folder["videoIds"] = map_video_ids_in_user_defaults(folder.get("videoIds") or [], old_to_fake_video)
        folder.pop("cover", None)

    for key in ("subscribedAnime", "subscribedDramas"):
        rows = []
        for item in user.get(key) or []:
            new_id = old_to_fake_video.get(str(item.get("id") or ""))
            if new_id:
                rows.append({**item, "id": new_id})
        user[key] = rows

    return out


def validate_runtime(data_dir: Path, image_root: Path) -> dict[str, Any]:
    runtime_names = (
        "authors.json",
        "commenters.json",
        "defaults.json",
        "rankings.json",
        "videoComments.json",
        "videoOnline.json",
        "videoTags.json",
        "videos.json",
    )
    runtime_json = [data_dir / name for name in runtime_names]
    report: dict[str, Any] = {"files": len(runtime_json), "forbidden": [], "missingImages": []}

    for path in runtime_json:
        if not path.exists():
            report["missingImages"].append({"file": str(path), "path": "<missing json>"})
            continue
        text = path.read_text(encoding="utf-8")
        for marker in FORBIDDEN_RUNTIME_MARKERS:
            if marker in text:
                report["forbidden"].append({"file": str(path), "marker": marker})

    def check_images(value: Any, source_file: Path) -> None:
        if isinstance(value, str) and value.startswith("./images/"):
            physical = image_root / value.removeprefix("./")
            if not physical.exists():
                report["missingImages"].append({"file": str(source_file), "path": value})
        elif isinstance(value, list):
            for item in value:
                check_images(item, source_file)
        elif isinstance(value, dict):
            for item in value.values():
                check_images(item, source_file)

    for path in runtime_json:
        check_images(read_json(path), path)

    report["ok"] = not report["forbidden"] and not report["missingImages"]
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish sanitized Bilibili data into mobilegym-data with fake platform IDs.")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--target", type=Path, default=DEFAULT_TARGET, help="Image root under mobilegym-data; JSON is written to apps/Bilibili/data.")
    parser.add_argument("--artifacts", type=Path, default=DEFAULT_ARTIFACTS)
    args = parser.parse_args()

    source = args.source
    target = args.target
    data_dir = BILIBILI_DATA
    image_dir = target / "images"
    avatar_dir = image_dir / "avatars"
    cover_dir = image_dir / "covers"
    warnings: list[str] = []

    user_rewrites = read_jsonl_map(source / "users.jsonl", "key")
    video_rewrites = read_jsonl_map(source / "videos.jsonl", "id")
    comment_rewrites = read_jsonl_map(source / "video_comments.jsonl", "id")
    avatar_mapping = read_json(source / "images" / "avatar_mapping.json")

    original_videos = read_json(BILIBILI_DATA / "videos.json")
    selected_ids = load_selected_ids(source)
    selected_set = set(selected_ids)
    publish_video_ids = ordered_video_ids(original_videos, selected_ids)
    old_to_fake_video, private_video_map = build_video_maps(publish_video_ids)
    original_authors = {str(k): v for k, v in read_json(BILIBILI_DATA / "authors.json").items()}
    original_commenters = {str(k): v for k, v in read_json(BILIBILI_DATA / "commenters.json").items()}
    original_comments = read_json(BILIBILI_DATA / "videoComments.json")
    original_tags = read_json(BILIBILI_DATA / "videoTags.json")
    original_online = read_json(BILIBILI_DATA / "videoOnline.json")
    original_rankings = read_json(BILIBILI_DATA / "rankings.json")
    defaults = load_defaults_for_publish(BILIBILI_DATA / "defaults.json", args.artifacts)

    needed_mids = collect_needed_mids(
        selected_ids=selected_set,
        videos=original_videos,
        authors=original_authors,
        comments_by_video=original_comments,
        comment_rewrites=comment_rewrites,
        defaults=defaults,
    )
    fake_mid_by_old = build_mid_map(needed_mids)

    source_avatar_dir = source / "images" / "avatars"
    source_cover_dir = source / "images" / "covers"
    cover_ci_map = build_case_insensitive_file_map(source_cover_dir)

    videos_by_old_id = {str(video.get("id") or ""): video for video in original_videos if video.get("id")}
    public_videos: list[dict[str, Any]] = []
    public_video_by_old: dict[str, dict[str, Any]] = {}
    owner_mid_by_video: dict[str, str] = {}
    pgc_author_name_by_old_mid: dict[str, str] = {}

    for index, old_id in enumerate(publish_video_ids, start=1):
        original = videos_by_old_id.get(old_id)
        if not original:
            warnings.append(f"selected video missing from original videos.json: {old_id}")
            continue
        owner = original.get("raw", {}).get("owner") if isinstance(original.get("raw"), dict) else None
        owner_mid = str(owner.get("mid")) if isinstance(owner, dict) and owner.get("mid") is not None else ""
        owner_mid_by_video[old_id] = owner_mid
        if owner_mid and str(original.get("partition") or "").strip() in PGC_PARTITIONS:
            pgc_author_name = str(original.get("author") or "").strip()
            existing = pgc_author_name_by_old_mid.get(owner_mid)
            if existing and existing != pgc_author_name:
                warnings.append(f"conflicting PGC author name for mid {owner_mid}: {existing} / {pgc_author_name}")
            elif pgc_author_name:
                pgc_author_name_by_old_mid[owner_mid] = pgc_author_name
        fake_meta = private_video_map[old_id]
        public = rewrite_video(
            original=original,
            index=index,
            fake_id=fake_meta["newId"],
            fake_aid=fake_meta["newAid"],
            video_rewrite=video_rewrites.get(old_id),
            owner_mid=owner_mid,
            fake_mid_by_old=fake_mid_by_old,
            avatar_mapping=avatar_mapping,
            source_avatar_dir=source_avatar_dir,
            target_avatar_dir=avatar_dir,
            source_cover_dir=source_cover_dir,
            target_cover_dir=cover_dir,
            cover_ci_map=cover_ci_map,
            use_generated_cover=old_id in selected_set,
            warnings=warnings,
        )
        public_videos.append(public)
        public_video_by_old[old_id] = public

    public_video_by_fake = {video["id"]: video for video in public_videos}

    public_authors: dict[str, dict[str, Any]] = {}
    for old_mid, author in original_authors.items():
        selected_author_videos = [
            item for item in author.get("videos") or [] if as_video_id(item) in old_to_fake_video
        ]
        if old_mid not in fake_mid_by_old and not selected_author_videos:
            continue
        fake_mid = fake_mid_by_old.get(old_mid)
        if not fake_mid:
            continue
        public = build_public_user(
            source=author,
            old_mid=old_mid,
            fake_mid=fake_mid,
            namespace="author",
            user_rewrites=user_rewrites,
            avatar_mapping=avatar_mapping,
            source_avatar_dir=source_avatar_dir,
            target_avatar_dir=avatar_dir,
            warnings=warnings,
        )
        if old_mid in pgc_author_name_by_old_mid:
            public["name"] = pgc_author_name_by_old_mid[old_mid]
        public["videos"] = [
            {
                "id": old_to_fake_video[as_video_id(item)],
                "title": public_video_by_old[as_video_id(item)]["title"],
                "date": item.get("date") if isinstance(item, dict) else None,
                "cover": public_video_by_old[as_video_id(item)]["cover"],
            }
            for item in selected_author_videos
            if as_video_id(item) in public_video_by_old
        ]
        public_authors[str(fake_mid)] = public

    public_commenters: dict[str, dict[str, Any]] = {}
    for old_mid, fake_mid in fake_mid_by_old.items():
        if str(fake_mid) in public_authors:
            continue
        source_user = original_commenters.get(old_mid) or original_authors.get(old_mid) or {}
        public_commenters[str(fake_mid)] = build_public_user(
            source=source_user,
            old_mid=old_mid,
            fake_mid=fake_mid,
            namespace="commenter",
            user_rewrites=user_rewrites,
            avatar_mapping=avatar_mapping,
            source_avatar_dir=source_avatar_dir,
            target_avatar_dir=avatar_dir,
            warnings=warnings,
        )

    public_tags: dict[str, list[str]] = {}
    public_online: dict[str, str] = {}
    for old_id, fake_id in old_to_fake_video.items():
        rewrite = video_rewrites.get(old_id) or {}
        tags = rewrite.get("tags") or original_tags.get(old_id) or []
        public_tags[fake_id] = [str(tag) for tag in tags]
        if old_id in original_online:
            public_online[fake_id] = str(original_online[old_id])

    public_comments: dict[str, dict[str, Any]] = {}
    private_rpid_map: dict[str, str] = {}
    for old_id, rewrite in comment_rewrites.items():
        if old_id not in old_to_fake_video:
            continue
        original_payload = original_comments.get(old_id) or {}
        original_meta = collect_comment_meta(original_payload.get("comments") or [])
        comments = rewrite_comment_tree(
            comments=rewrite.get("comments") or [],
            original_meta=original_meta,
            fake_mid_by_old=fake_mid_by_old,
            user_rewrites=user_rewrites,
            avatar_mapping=avatar_mapping,
            source_avatar_dir=source_avatar_dir,
            target_avatar_dir=avatar_dir,
            rpid_map=private_rpid_map,
            warnings=warnings,
        )
        fake_id = old_to_fake_video[old_id]
        public_comments[fake_id] = {
            "bvid": fake_id,
            "aid": private_video_map[old_id]["newAid"],
            "title": public_video_by_old.get(old_id, {}).get("title", ""),
            "comments": comments,
            "count": len(comments),
        }
    for old_id, original_payload in original_comments.items():
        if old_id not in old_to_fake_video:
            continue
        fake_id = old_to_fake_video[old_id]
        if fake_id in public_comments:
            continue
        public_comments[fake_id] = {
            "bvid": fake_id,
            "aid": private_video_map[old_id]["newAid"],
            "title": public_video_by_old.get(old_id, {}).get("title", ""),
            "comments": [],
            "count": 0,
        }

    public_rankings: dict[str, list[dict[str, Any]]] = {}
    for partition, rows in original_rankings.items():
        out_rows: list[dict[str, Any]] = []
        for row in rows:
            old_id = str(row.get("id") or "")
            fake_id = old_to_fake_video.get(old_id)
            if not fake_id:
                continue
            full = public_video_by_fake.get(fake_id, {})
            out_rows.append(
                {
                    "id": fake_id,
                    "rank": row.get("rank", len(out_rows) + 1),
                    "partition": row.get("partition", partition),
                    "title": full.get("title", ""),
                    "cover": full.get("cover", ""),
                    "author": full.get("author", ""),
                    "face": full.get("face", ""),
                    "plays": full.get("plays", 0),
                    "danmaku": full.get("danmaku", 0),
                    "duration": full.get("duration", ""),
                    "desc": "",
                    "score": row.get("score", 0),
                }
            )
        public_rankings[partition] = out_rows

    public_defaults = rewrite_defaults(
        defaults=defaults,
        old_to_fake_video=old_to_fake_video,
        fake_mid_by_old=fake_mid_by_old,
        user_rewrites=user_rewrites,
        avatar_mapping=avatar_mapping,
        source_avatar_dir=source_avatar_dir,
        target_avatar_dir=avatar_dir,
        warnings=warnings,
    )

    write_runtime_json(data_dir / "videos.json", public_videos)
    write_runtime_json(data_dir / "authors.json", public_authors)
    write_runtime_json(data_dir / "commenters.json", public_commenters)
    write_runtime_json(data_dir / "videoTags.json", public_tags)
    write_runtime_json(data_dir / "videoOnline.json", public_online)
    write_runtime_json(data_dir / "videoComments.json", public_comments)
    write_runtime_json(data_dir / "rankings.json", public_rankings)
    write_runtime_json(data_dir / "defaults.json", public_defaults)

    manifest = {
        "version": 1,
        "source": str(source),
        "counts": {
            "videos": len(public_videos),
            "authors": len(public_authors),
            "commenters": len(public_commenters),
            "videoComments": len(public_comments),
            "avatars": len(list(avatar_dir.glob("*.jpg"))) if avatar_dir.exists() else 0,
            "covers": len(list(cover_dir.glob("*.jpg"))) if cover_dir.exists() else 0,
        },
        "fakeIdPolicy": {
            "videoPrefix": FAKE_VIDEO_PREFIX,
            "aidBase": FAKE_AID_BASE,
            "cidBase": FAKE_CID_BASE,
            "midBase": FAKE_MID_BASE,
            "rpidBase": FAKE_RPID_BASE,
        },
        "warnings": warnings[:200],
        "warningCount": len(warnings),
    }
    args.artifacts.mkdir(parents=True, exist_ok=True)
    write_json(args.artifacts / "manifest.json", manifest)
    write_json(args.artifacts / "private_id_mapping.json", {
        "videos": private_video_map,
        "mids": {old: str(new) for old, new in fake_mid_by_old.items()},
        "rpids": private_rpid_map,
    })
    for name in (
        "selection_k40/selection_report.json",
        "text_audit_report.json",
        "similarity_audit_full.json",
        "mapping_audit_report.json",
        "cover_descriptions.jsonl",
    ):
        src = source / name
        if src.exists():
            dst = args.artifacts / Path(name).name
            shutil.copy2(src, dst)

    validation = validate_runtime(data_dir, target)
    write_json(args.artifacts / "publish_validation_report.json", validation)

    print(json.dumps({
        "jsonTarget": str(data_dir),
        "imageTarget": str(image_dir),
        "counts": manifest["counts"],
        "validationOk": validation["ok"],
        "warningCount": len(warnings),
        "forbidden": len(validation["forbidden"]),
        "missingImages": len(validation["missingImages"]),
    }, ensure_ascii=False, indent=2))

    if not validation["ok"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
