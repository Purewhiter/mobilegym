#!/usr/bin/env python3
"""
为 RedBook 全部 15000 个用户重生头像。
- prompt = name + intro，size 256x256，negative_prompt 抑制中文字符渲染
- 并发 = 4（z_image_turbo 单卡上限大致如此）
- 输出落到 mobilegym-data/redbook/images/avatars/<filename>，文件名由 users.json 的 avatar 字段决定
- 支持断点续跑：默认跳过已存在文件，--force 全量覆盖
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import threading
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from tqdm import tqdm

API = "http://localhost:30000/v1/images/generations"
MODEL = "Z-Image-turbo"

NEGATIVE_PROMPT = (
    "中文字符, 汉字, 文字, 文本, 字体, 书法, 印刷字, 招牌, 标牌, "
    "字幕, 标签, 水印, logo, 商标, 二维码, 海报排版, 网红脸, "
    "text, chinese characters, calligraphy, signboard, watermark, logo"
)

USERS_JSON = Path("/home/dingbang.wu/mobile-gym/apps/RedBook/data/users.json")
AVATARS_DIR = Path("/home/dingbang.wu/mobilegym-data/redbook/images/avatars")
RAW_AVATARS_DIR = Path("/data2/rui.hao/images/avatars")
SANITIZER_SECRET = Path("/home/dingbang.wu/.config/redbook_sanitizer_secret.json")
HASH9_RE = re.compile(r"^[a-z0-9]{9}$")


def md5_of(p: Path) -> str:
    return hashlib.md5(p.read_bytes()).hexdigest()


def is_orig_copy(out_path: Path, inv_user_map: dict) -> bool:
    """当前文件是否字节级等同于原始 xhs 头像。"""
    if not out_path.exists():
        return False
    stem = out_path.stem
    if HASH9_RE.fullmatch(stem):
        old_id = inv_user_map.get(stem)
        if not old_id:
            return False
        orig = RAW_AVATARS_DIR / f"{old_id}.jpg"
    else:
        orig = RAW_AVATARS_DIR / out_path.name
    if not orig.exists():
        return False
    return md5_of(out_path) == md5_of(orig)


def compose_prompt(name: str, intro: str) -> str:
    return f"方形头像，符合用户{name}的特征，以及简介的{intro}特征"


def gen_one(name: str, intro: str, seed: int, out_path: Path, size: str,
            blacklist_md5: list[str] | None = None, max_retry: int = 3) -> tuple[bool, str]:
    prompt = compose_prompt(name, intro)
    blacklist_md5 = blacklist_md5 or []
    last_md5 = ""
    for attempt in range(max_retry):
        cur_seed = (seed + attempt * 7919) % (2**31)
        payload = json.dumps({
            "model": MODEL, "prompt": prompt, "negative_prompt": NEGATIVE_PROMPT,
            "size": size, "seed": cur_seed,
        }).encode("utf-8")
        req = urllib.request.Request(API, data=payload, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = json.loads(r.read())
        except Exception as e:
            return False, f"API: {e}"
        items = data.get("data", [])
        if not items:
            return False, "no data"
        fp = items[0].get("file_path")
        if not fp or not Path(fp).exists():
            return False, "no file_path"
        # 立即读出字节（防止 z_image 重写/删除该文件）
        try:
            content = Path(fp).read_bytes()
        except Exception as e:
            return False, f"read: {e}"
        h = hashlib.md5(content).hexdigest()
        last_md5 = h
        if any(h.startswith(p) for p in blacklist_md5):
            continue  # 命中黑名单（同 file_path 竞态产生的重复图），换 seed 重试
        out_path.parent.mkdir(parents=True, exist_ok=True)
        # 关键：write_bytes 会跟随 symlink，必须先 unlink 否则会写穿到 symlink target
        if out_path.is_symlink() or out_path.exists():
            out_path.unlink()
        out_path.write_bytes(content)
        return True, "ok"
    return False, f"all {max_retry} attempts produced blacklisted md5 (last={last_md5[:10]})"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--users-json", default=str(USERS_JSON))
    ap.add_argument("--out-dir", default=str(AVATARS_DIR))
    ap.add_argument("--size", default="256x256")
    ap.add_argument("--concurrency", type=int, default=4)
    ap.add_argument("--force", action="store_true", help="覆盖已存在文件（与 --only-orig-copies 互斥时优先 force）")
    ap.add_argument("--only-orig-copies", action="store_true",
                    help="只跑当前文件字节级等同于原始 xhs 头像的（推荐用于补齐脱敏）")
    ap.add_argument("--retry-md5", default=None,
                    help="只重跑当前 md5 匹配此前缀的文件（用于修复 z_image 并发返回同 file_path 的批次）")
    ap.add_argument("--blacklist-md5", default=None,
                    help="逗号分隔的 md5 前缀；若新生成图命中黑名单则换 seed 重试（防止 z_image 竞态再次出现）")
    ap.add_argument("--limit", type=int, default=0, help=">0 时只跑前 N 个")
    ap.add_argument("--filter", choices=["all", "real", "cu"], default="all",
                    help="all=全部, real=hash9 命名（4179）, cu=token 命名（10821）")
    args = ap.parse_args()

    inv_user_map: dict = {}
    if args.only_orig_copies:
        m = json.load(open(SANITIZER_SECRET, encoding="utf-8"))
        inv_user_map = {v: k for k, v in m["users"].items()}

    blacklist = [p.strip() for p in (args.blacklist_md5 or "").split(",") if p.strip()]

    users = json.load(open(args.users_json, encoding="utf-8"))
    out_dir = Path(args.out_dir)

    tasks: list[tuple[str, str, str, int, Path]] = []
    for u in users:
        av = u.get("avatar", "") or ""
        if not av.startswith("./images/avatars/"):
            continue
        filename = Path(av).name
        is_hash9 = len(Path(av).stem) == 9 and Path(av).stem.isalnum()
        if args.filter == "real" and not is_hash9:
            continue
        if args.filter == "cu" and is_hash9:
            continue
        out_path = out_dir / filename
        if args.only_orig_copies:
            # 模式 A：只跑当前文件 == 原图的
            if not is_orig_copy(out_path, inv_user_map):
                continue
        elif args.retry_md5:
            # 模式 C：只跑当前文件 md5 匹配指定前缀的（修复 z_image 同 file_path bug）
            if not out_path.exists():
                continue
            if not md5_of(out_path).startswith(args.retry_md5):
                continue
        else:
            # 模式 B：默认跳过已存在；--force 覆盖
            if out_path.exists() and not args.force:
                continue
        # 用 user.id 作为 seed 派生，确定性
        seed = abs(hash(u["id"])) % (2**31)
        tasks.append((u["id"], u["name"], u.get("intro", "") or "", seed, out_path))

    if args.limit:
        tasks = tasks[: args.limit]

    print(f"待生成 {len(tasks)} 张头像，并发={args.concurrency}, size={args.size}")
    if not tasks:
        return

    ok_count = 0
    fail_count = 0
    failures: list[tuple[str, str]] = []
    lock = threading.Lock()

    def work(t):
        uid, name, intro, seed, out_path = t
        ok, msg = gen_one(name, intro, seed, out_path, args.size, blacklist_md5=blacklist)
        return uid, ok, msg

    t0 = time.time()
    with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
        futs = {ex.submit(work, t): t for t in tasks}
        with tqdm(total=len(tasks), unit="img") as pbar:
            for fut in as_completed(futs):
                uid, ok, msg = fut.result()
                with lock:
                    if ok:
                        ok_count += 1
                    else:
                        fail_count += 1
                        failures.append((uid, msg))
                pbar.update(1)
                pbar.set_postfix(ok=ok_count, fail=fail_count)
    elapsed = time.time() - t0

    print(f"\n完成: ok={ok_count}, fail={fail_count}, 用时={elapsed:.1f}s ({elapsed/max(ok_count,1):.2f}s/张)")
    if failures:
        print(f"前 10 个失败: {failures[:10]}")


if __name__ == "__main__":
    main()
