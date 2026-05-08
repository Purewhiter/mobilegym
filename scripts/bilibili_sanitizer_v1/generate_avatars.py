#!/usr/bin/env python3
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
import hashlib
import json
import os
import random
import shutil
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from tqdm import tqdm


PROJECT_ROOT = Path(__file__).resolve().parents[2]
BILIBILI_DATA = PROJECT_ROOT / "apps" / "Bilibili" / "data"
DEFAULT_OUT_ROOT = Path(os.environ.get("BILIBILI_OUT_ROOT", "scripts/bilibili_sanitizer_v1/out/users_full_20260503"))
DEFAULT_API = os.environ.get("BILIBILI_IMAGE_API", "http://127.0.0.1:30000/v1/images/generations")
DEFAULT_MODEL = os.environ.get("BILIBILI_IMAGE_MODEL", "Z-Image-turbo")

NEGATIVE_PROMPT = (
    "中文字符, 汉字, 文字, 文本, 字体, 书法, 印刷字, 招牌, 标牌, "
    "字幕, 标签, 姓名标签, 用户名, 简介文字, 资料卡, 个人主页, 社交媒体页面, UI卡片, "
    "边框, 相框, 头像框, 白色方框, 卡片背景, "
    "哔哩哔哩标志, bilibili标志, 水印, logo, 商标, 二维码, "
    "text, chinese characters, profile card, user interface, frame, border, watermark, logo, bilibili logo"
)


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl_map(path: Path, key_field: str) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    with path.open(encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            key = row.get(key_field)
            if key:
                out[str(key)] = row
    return out


def read_id_set(path: Path | None) -> set[str] | None:
    if path is None:
        return None
    return {line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()}


def stable_seed(value: str) -> int:
    return int(hashlib.sha256(value.encode("utf-8")).hexdigest()[:8], 16)


def safe_stem(value: str) -> str:
    return "".join(ch if ch.isalnum() else "_" for ch in value)[:120]


def extract_video_id(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("id") or value.get("bvid") or value.get("videoId") or "")
    return str(value or "")


def walk_comments(items: list[dict[str, Any]] | None):
    for item in items or []:
        yield item
        yield from walk_comments(item.get("replies") or [])


def collect_selected_user_keys(data_dir: Path, selected_video_ids: set[str] | None) -> tuple[set[str], set[str]]:
    authors = read_json(data_dir / "authors.json")
    videos = read_json(data_dir / "videos.json")
    comments = read_json(data_dir / "videoComments.json")

    all_video_ids = {str(video.get("id")) for video in videos if isinstance(video, dict) and video.get("id")}
    selected = selected_video_ids or all_video_ids
    video_by_id = {str(video.get("id")): video for video in videos if isinstance(video, dict) and video.get("id")}

    name_to_author_mids: dict[str, list[str]] = {}
    video_to_author_mids: dict[str, list[str]] = {}
    for mid, author in authors.items():
        name = str(author.get("name") or "").strip()
        if name:
            name_to_author_mids.setdefault(name, []).append(str(mid))
        for item in author.get("videos") or []:
            video_id = extract_video_id(item)
            if video_id:
                video_to_author_mids.setdefault(video_id, []).append(str(mid))

    author_keys: set[str] = set()
    unresolved_author_names: set[str] = set()
    for video_id in selected:
        video = video_by_id.get(str(video_id))
        if not video:
            continue
        mids = set(video_to_author_mids.get(str(video_id), []))
        author_name = str(video.get("author") or "").strip()
        mids.update(name_to_author_mids.get(author_name, []))
        if mids:
            author_keys.update(f"author:{mid}" for mid in mids)
        elif author_name:
            unresolved_author_names.add(author_name)

    commenter_keys: set[str] = set()
    for video_id, payload in comments.items():
        if str(video_id) not in selected:
            continue
        for comment in walk_comments(payload.get("comments") or []):
            mid = str(comment.get("mid") or "")
            if mid:
                commenter_keys.add(f"commenter:{mid}")

    return author_keys | commenter_keys, {f"display_author:{name}" for name in unresolved_author_names}


def read_rewritten_video_authors(videos_path: Path, selected_video_ids: set[str] | None) -> dict[str, str]:
    out: dict[str, str] = {}
    with videos_path.open(encoding="utf-8") as file:
        for line in file:
            line = line.strip()
            if not line:
                continue
            row = json.loads(line)
            video_id = str(row.get("id") or "")
            if selected_video_ids is not None and video_id not in selected_video_ids:
                continue
            author = str(row.get("author") or "").strip()
            if author:
                out[video_id] = author
    return out


def rewritten_display_author_names(
    *,
    data_dir: Path,
    videos_path: Path,
    selected_video_ids: set[str] | None,
    display_author_keys: set[str],
) -> dict[str, str]:
    unresolved_names = {key.split(":", 1)[1] for key in display_author_keys}
    if not unresolved_names:
        return {}
    rewritten_author_by_video = read_rewritten_video_authors(videos_path, selected_video_ids)
    counters: dict[str, Counter[str]] = defaultdict(Counter)
    for video in read_json(data_dir / "videos.json"):
        if not isinstance(video, dict):
            continue
        video_id = str(video.get("id") or "")
        if selected_video_ids is not None and video_id not in selected_video_ids:
            continue
        original_author = str(video.get("author") or "").strip()
        rewritten_author = rewritten_author_by_video.get(video_id, "").strip()
        if original_author in unresolved_names and rewritten_author:
            counters[original_author][rewritten_author] += 1
    return {
        original_name: counter.most_common(1)[0][0]
        for original_name, counter in counters.items()
        if counter
    }


def build_avatar_entities(
    *,
    users_path: Path,
    videos_path: Path,
    data_dir: Path,
    selected_video_ids: set[str] | None,
    include_display_authors: bool,
    dedupe_mid: bool,
) -> list[dict[str, Any]]:
    users_by_key = read_jsonl_map(users_path, "key")
    selected_keys, display_author_keys = collect_selected_user_keys(data_dir, selected_video_ids)
    display_author_name_map = rewritten_display_author_names(
        data_dir=data_dir,
        videos_path=videos_path,
        selected_video_ids=selected_video_ids,
        display_author_keys=display_author_keys,
    )

    grouped: dict[str, dict[str, Any]] = {}
    for key in sorted(selected_keys):
        user = users_by_key.get(key)
        if not user:
            continue
        namespace = str(user.get("namespace") or key.split(":", 1)[0])
        mid = str(user.get("mid") or key.split(":", 1)[-1])
        entity_key = f"mid:{mid}" if dedupe_mid else key
        item = grouped.setdefault(
            entity_key,
            {
                "entityKey": entity_key,
                "mid": mid,
                "keys": [],
                "namespace": namespace,
                "name": str(user.get("name") or ""),
                "sign": str(user.get("sign") or ""),
            },
        )
        item["keys"].append(key)
        # Author records usually have richer profile text; prefer them for a shared mid.
        if namespace == "author" or not item.get("name"):
            item["namespace"] = namespace
            item["name"] = str(user.get("name") or item.get("name") or "")
            item["sign"] = str(user.get("sign") or item.get("sign") or "")

    if include_display_authors:
        for key in sorted(display_author_keys):
            original_name = key.split(":", 1)[1]
            # These are PGC display authors without an author record. Use the
            # rewritten video author text for prompts; original_name is only
            # kept in the mapping key so data joins remain traceable.
            name = display_author_name_map.get(original_name, original_name)
            entity_key = f"display_author:{safe_stem(name)}"
            grouped[entity_key] = {
                "entityKey": entity_key,
                "mid": "",
                "keys": [key, f"display_author_rewritten:{name}"],
                "namespace": "display_author",
                "name": name,
                "sign": "",
            }

    return sorted(grouped.values(), key=lambda item: item["entityKey"])


def compose_prompt(user: dict[str, Any]) -> str:
    name = str(user.get("name") or "用户").strip()
    sign = str(user.get("sign") or "").strip()
    if sign:
        return (
            "B站社区常见头像风格，1:1 构图的单张图片，不要头像框、边框、相框、资料卡或页面截图。"
            "主体和场景根据气质参考自然选择，不默认人物；可以是人物、动物、食物、物品、风景、抽象图形或二次元角色。"
            "画面自然有辨识度。"
            f"气质参考：{name}，{sign}"
        )
    return (
        "B站社区常见头像风格，1:1 构图的单张图片，不要头像框、边框、相框、资料卡或页面截图。"
        "主体和场景根据气质参考自然选择，不默认人物；可以是人物、动物、食物、物品、风景、抽象图形或二次元角色。"
        "画面自然有辨识度。"
        f"气质参考：{name}"
    )


def extract_image_bytes(item: dict[str, Any], api: str) -> bytes:
    b64 = item.get("b64_json")
    if isinstance(b64, str):
        import base64

        return base64.b64decode(b64)
    file_path = item.get("file_path")
    if isinstance(file_path, str) and Path(file_path).exists():
        return Path(file_path).read_bytes()
    url = item.get("url")
    if isinstance(url, str):
        full_url = url
        if not url.startswith("http"):
            from urllib.parse import urlsplit

            parts = urlsplit(api)
            full_url = f"{parts.scheme}://{parts.netloc}{url if url.startswith('/') else '/' + url}"
        with urllib.request.urlopen(full_url, timeout=120) as response:
            return response.read()
    raise RuntimeError(f"image generation returned no usable content: {item}")


def generate_one(
    *,
    api: str,
    model: str,
    user: dict[str, Any],
    out_path: Path,
    size: str,
    steps: int,
    max_retry: int,
) -> tuple[bool, str]:
    seed = stable_seed(str(user["entityKey"]))
    last_error = ""
    for attempt in range(max_retry):
        payload: dict[str, Any] = {
            "model": model,
            "prompt": compose_prompt(user),
            "negative_prompt": NEGATIVE_PROMPT,
            "size": size,
            "seed": (seed + attempt * 7919) % (2**31),
        }
        if steps > 0:
            payload["num_inference_steps"] = steps
            payload["steps"] = steps
        request = urllib.request.Request(
            api,
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                data = json.loads(response.read())
            items = data.get("data") or []
            if not items:
                raise RuntimeError("no data")
            image_bytes = extract_image_bytes(items[0], api)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            tmp_path = out_path.with_suffix(out_path.suffix + ".tmp")
            tmp_path.write_bytes(image_bytes)
            shutil.move(str(tmp_path), str(out_path))
            return True, "ok"
        except Exception as exc:
            last_error = str(exc)
            time.sleep(min(2.0, 0.25 * (attempt + 1)))
    return False, last_error


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate sanitized Bilibili user avatars.")
    parser.add_argument("--users", type=Path, default=DEFAULT_OUT_ROOT / "users.jsonl")
    parser.add_argument("--videos", type=Path, default=DEFAULT_OUT_ROOT / "videos.jsonl")
    parser.add_argument("--data-dir", type=Path, default=BILIBILI_DATA)
    parser.add_argument("--selected-video-ids", type=Path, default=DEFAULT_OUT_ROOT / "selection_k40" / "selected_video_ids.txt")
    parser.add_argument("--entity-keys", type=Path, default=None, help="Optional file with one avatar entityKey per line.")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_ROOT / "images" / "avatars")
    parser.add_argument("--mapping", type=Path, default=None)
    parser.add_argument("--api", default=DEFAULT_API)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--size", default="256x256")
    parser.add_argument("--steps", type=int, default=0)
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--sample-size", type=int, default=0, help="Randomly sample N pending avatars after filtering.")
    parser.add_argument("--sample-seed", type=int, default=20260503)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--no-dedupe-mid", action="store_true")
    parser.add_argument("--include-display-authors", action="store_true")
    args = parser.parse_args()

    selected_video_ids = read_id_set(args.selected_video_ids) if args.selected_video_ids else None
    entities = build_avatar_entities(
        users_path=args.users,
        videos_path=args.videos,
        data_dir=args.data_dir,
        selected_video_ids=selected_video_ids,
        include_display_authors=args.include_display_authors,
        dedupe_mid=not args.no_dedupe_mid,
    )
    entity_key_filter = read_id_set(args.entity_keys)
    if entity_key_filter is not None:
        entities = [entity for entity in entities if str(entity["entityKey"]) in entity_key_filter]

    tasks: list[tuple[dict[str, Any], Path]] = []
    mapping: dict[str, str] = {}
    for user in entities:
        filename = f"{safe_stem(str(user['entityKey']))}.jpg"
        rel_path = f"./images/avatars/{filename}"
        for key in user["keys"]:
            mapping[str(key)] = rel_path
        out_path = args.out_dir / filename
        if out_path.exists() and not args.force:
            continue
        tasks.append((user, out_path))

    if args.sample_size:
        rng = random.Random(args.sample_seed)
        if args.sample_size < len(tasks):
            tasks = rng.sample(tasks, args.sample_size)
        tasks.sort(key=lambda item: str(item[0]["entityKey"]))

    if args.limit:
        tasks = tasks[: args.limit]

    mapping_path = args.mapping or (args.out_dir.parent / "avatar_mapping.json")
    mapping_path.parent.mkdir(parents=True, exist_ok=True)
    mapping_path.write_text(json.dumps(mapping, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        json.dumps(
            {
                "avatarEntityCount": len(entities),
                "mappingCount": len(mapping),
                "pending": len(tasks),
                "size": args.size,
                "steps": args.steps,
                "api": args.api,
                "mapping": str(mapping_path),
            },
            ensure_ascii=False,
        )
    )
    if args.dry_run or not tasks:
        return

    ok_count = 0
    fail_count = 0
    failures: list[dict[str, str]] = []
    lock = threading.Lock()

    def work(item: tuple[dict[str, Any], Path]) -> tuple[str, bool, str]:
        user, out_path = item
        ok, msg = generate_one(
            api=args.api,
            model=args.model,
            user=user,
            out_path=out_path,
            size=args.size,
            steps=args.steps,
            max_retry=args.retries,
        )
        return str(user["entityKey"]), ok, msg

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.concurrency) as executor:
        futures = {executor.submit(work, item): item for item in tasks}
        with tqdm(total=len(futures), unit="avatar", desc="avatars", smoothing=0.1) as pbar:
            for future in as_completed(futures):
                entity_key, ok, msg = future.result()
                with lock:
                    if ok:
                        ok_count += 1
                    else:
                        fail_count += 1
                        failures.append({"entityKey": entity_key, "error": msg})
                pbar.update(1)
                pbar.set_postfix(ok=ok_count, fail=fail_count)

    elapsed = time.time() - t0
    print(json.dumps({"ok": ok_count, "fail": fail_count, "elapsed": elapsed}, ensure_ascii=False))
    if failures:
        fail_path = args.out_dir.parent / "avatar_failures.jsonl"
        with fail_path.open("a", encoding="utf-8") as file:
            for row in failures:
                file.write(json.dumps(row, ensure_ascii=False) + "\n")
        print(f"失败记录已追加到 {fail_path}")


if __name__ == "__main__":
    main()
