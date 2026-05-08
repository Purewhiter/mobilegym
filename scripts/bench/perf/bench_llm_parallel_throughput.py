#!/usr/bin/env python3
"""
Measure OpenAI-compatible chat completions throughput vs concurrency.

Usage:
  python scripts/bench/perf/bench_llm_parallel_throughput.py \\
    --base-url http://127.0.0.1:8001/v1 \\
    --model gelab-zero

默认 --mode vision：对齐 bench_env 里 GUI Agent（如 AutoGLM）的「system + 截图 data URL + 文本」
多模态请求。每路请求独立 **随机 PNG + 随机 user 文本**，减轻前缀/KV 缓存导致的虚高吞吐。

纯文本压测用 --mode text（每路亦为随机文本）。

**--prompt-json**：从 trajectory 导出的 `step_*_prompt.json` 加载**完整多轮 messages**（与真实评测上下文长度一致）。
其中 `image_url.url` 为 `[IMAGE_DATA_STRIPPED]` 时，每路请求注入 `--image-width`×`--image-height` 的随机 PNG。
指定后不再使用上面的随机短 prompt，`--mode` / `--no-system` / `--task-prefix` 不生效。

默认在**首条消息的文本最前**加每路唯一的 `[bench_prefill_noise:...]`，削弱多路前缀缓存；可用 `--no-prefill-noise` 关闭。

prompt-json 下若希望**长文本 + 图**尽量「不随机」：`--no-prefill-noise` 去掉文本前缀，`--reuse-placeholder-image` 令所有请求共用同一张合成 PNG（占位符仍由 image 尺寸决定）。

Sweeps concurrency and reports total completion tokens per wall-clock second
for one batch of N parallel requests (sum(completion_tokens) / batch_time).
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import copy
import io
import json
import os
import random
import secrets
import statistics
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, AsyncIterator

# `python scripts/...` 时 sys.path 不含仓库根目录，无法 import bench_env（vision 下需 AutoGLM system）
_REPO_ROOT = Path(__file__).resolve().parents[3]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

# 随机 user 文本中的「应用名」等（与真实 route 风格接近）
_RAND_APPS = [
    "settings",
    "wechat",
    "launcher",
    "alipay",
    "clock",
    "camera",
    "gallery",
    "contacts",
    "phone",
    "messages",
    "browser",
    "maps",
]

_RAND_ACTIONS = [
    "打开深色模式",
    "搜索联系人并拨号",
    "返回上一级",
    "打开飞行模式后关闭",
    "清除通知栏",
    "在设置里查看存储空间",
    "打开 Wi‑Fi 并连接列表第一项",
    "截图并保存到相册",
    "打开勿扰模式",
    "在桌面找到设置并进入",
]


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--base-url", default="http://127.0.0.1:8001/v1")
    p.add_argument("--model", default="")
    p.add_argument(
        "--mode",
        choices=["vision", "text"],
        default="vision",
        help="vision=图+文（GUI Agent）；text=仅文本（旧行为）",
    )
    p.add_argument(
        "--no-system",
        action="store_true",
        help="vision 模式下不附带 AutoGLM 长 system（仅测 user 图+文，预填更轻）",
    )
    p.add_argument(
        "--image-width",
        type=int,
        default=1080,
        help="合成截图宽（PNG），与手机竖屏接近时可调",
    )
    p.add_argument(
        "--image-height",
        type=int,
        default=2400,
        help="合成截图高（PNG）",
    )
    p.add_argument(
        "--task-prefix",
        type=str,
        default="",
        help="可选：每条随机任务前附加的固定前缀（默认可空，任务与 Screen Info 均随机）",
    )
    p.add_argument(
        "--prompt-json",
        type=str,
        default="",
        help=(
            "从 trajectory 的 step_*_prompt.json 加载完整 messages（OpenAI 格式数组）。"
            "含 [IMAGE_DATA_STRIPPED] 时按 image-width/height 每路注入随机 PNG"
        ),
    )
    p.add_argument(
        "--concurrency",
        type=str,
        default="1,2,4,6,8,10,12,16,20,24,32,40,48,56,64",
        help="Comma-separated concurrency levels to try",
    )
    p.add_argument("--max-tokens", type=int, default=256)
    p.add_argument("--rounds", type=int, default=3, help="Repeated batches per level (median reported)")
    p.add_argument("--timeout", type=float, default=300.0)
    p.add_argument(
        "--no-progress",
        action="store_true",
        help="Disable per-request live lines (only print summary rows)",
    )
    p.add_argument(
        "--no-prefill-noise",
        action="store_true",
        help="不在首条消息的文本最前注入随机前缀（默认会注入，以削弱多路前缀 KV 缓存命中）",
    )
    p.add_argument(
        "--reuse-placeholder-image",
        action="store_true",
        help=(
            "仅 prompt-json：对 [IMAGE_DATA_STRIPPED] 全进程复用同一张合成 PNG（仍由 image-width/height 决定分辨率），"
            "多路并行不再每路换随机图"
        ),
    )
    return p.parse_args()


def _log(msg: str) -> None:
    print(msg, flush=True)


def make_screenshot_data_url(width: int, height: int) -> str:
    """
    生成与 Observation.image_data_url 同格式的 PNG data URL（随机像素，体积接近真实截图）。
    每次调用独立随机，避免多路共用同一张图。
    """
    from PIL import Image

    if width < 1 or height < 1:
        raise ValueError("image width/height must be >= 1")
    raw = os.urandom(width * height * 3)
    img = Image.frombytes("RGB", (width, height), raw, "raw", "RGB")
    buf = io.BytesIO()
    img.save(buf, format="PNG", compress_level=6)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _random_vision_user_text(args: argparse.Namespace) -> str:
    """随机任务句 + 随机 Screen Info JSON（对齐 AutoGLM user 文本结构）。"""
    app = random.choice(_RAND_APPS)
    action = random.choice(_RAND_ACTIONS)
    tag = secrets.token_hex(4)
    if (args.task_prefix or "").strip():
        task_line = f"{args.task_prefix.strip()} [rid={tag}]"
    else:
        task_line = f"在「{app}」中：{action}（rid={tag}）"
    screen_info = {
        "current_app": app,
        "req_id": secrets.token_hex(8),
        "step": random.randint(1, 200),
        "noise": secrets.token_hex(12),
    }
    return f"{task_line}\n\n{json.dumps(screen_info, ensure_ascii=False)}"


def _random_text_only_user_content() -> str:
    """纯文本模式：每路不同，避免完全相同 prompt。"""
    return (
        f"List {random.randint(5, 80)} short bullet facts about topic "
        f"{secrets.token_hex(10)}. One per line, no preamble. uid={secrets.token_hex(8)}"
    )


def build_random_openai_messages(args: argparse.Namespace) -> list[dict[str, Any]]:
    """单路请求：vision 为 system（可选）+ 随机图 + 随机文本；text 为随机 user 文本。"""
    if args.mode == "text":
        msgs = [{"role": "user", "content": _random_text_only_user_content()}]
        if not getattr(args, "no_prefill_noise", False):
            prepend_bench_prefill_noise(msgs)
        return msgs

    data_url = make_screenshot_data_url(args.image_width, args.image_height)
    user_text = _random_vision_user_text(args)
    user_content: list[dict[str, Any]] = [
        {"type": "image_url", "image_url": {"url": data_url}},
        {"type": "text", "text": user_text},
    ]
    msgs: list[dict[str, Any]] = []
    if not args.no_system:
        from bench_env.agent.autoglm import AutoGLMAgent

        system_prompt = AutoGLMAgent.SYSTEM_PROMPT.replace(
            "{today}", AutoGLMAgent._get_today_string()
        )
        msgs.append({"role": "system", "content": system_prompt})
    msgs.append({"role": "user", "content": user_content})
    if not getattr(args, "no_prefill_noise", False):
        prepend_bench_prefill_noise(msgs)
    return msgs


def _prompt_json_needs_pil(template: list[Any]) -> bool:
    return "[IMAGE_DATA_STRIPPED]" in json.dumps(template, ensure_ascii=False)


def prepend_bench_prefill_noise(messages: list[dict[str, Any]]) -> None:
    """
    在整条 prompt 的「文本最前面」注入每路唯一的随机前缀，削弱多路并行时共享前缀缓存。

    - 首条为 string content（常见 system）：直接前缀拼接。
    - 首条为 parts 列表：若首块为 text 则拼到该 text 前；否则在列表最前插入一条 text（含 image 时则文本在图前）。
    """
    if not messages:
        return
    nonce = secrets.token_hex(8)
    prefix = f"[bench_prefill_noise:{nonce}]\n"
    m0 = messages[0]
    c = m0.get("content")
    if isinstance(c, str):
        m0["content"] = prefix + c
    elif isinstance(c, list):
        if c and c[0].get("type") == "text":
            c[0]["text"] = prefix + str(c[0].get("text", ""))
        else:
            c.insert(0, {"type": "text", "text": prefix.rstrip("\n")})


def inject_placeholder_images(
    messages: list[dict[str, Any]], args: argparse.Namespace
) -> None:
    """将 recorder 占位符替换为 PNG data URL；可复用 args._cached_placeholder_data_url。"""
    for m in messages:
        c = m.get("content")
        if not isinstance(c, list):
            continue
        for part in c:
            if part.get("type") != "image_url":
                continue
            iu = part.setdefault("image_url", {})
            url = iu.get("url", "")
            if url == "[IMAGE_DATA_STRIPPED]":
                cached = getattr(args, "_cached_placeholder_data_url", None)
                if cached:
                    iu["url"] = cached
                else:
                    iu["url"] = make_screenshot_data_url(args.image_width, args.image_height)


def build_messages_from_prompt_template(args: argparse.Namespace) -> list[dict[str, Any]]:
    tpl: list[dict[str, Any]] = getattr(args, "_prompt_template", [])
    msgs = copy.deepcopy(tpl)
    inject_placeholder_images(msgs, args)
    if not getattr(args, "no_prefill_noise", False):
        prepend_bench_prefill_noise(msgs)
    return msgs


def build_messages_for_request(args: argparse.Namespace) -> list[dict[str, Any]]:
    if getattr(args, "_prompt_template", None) is not None:
        return build_messages_from_prompt_template(args)
    return build_random_openai_messages(args)


async def one_completion(
    client, model: str, max_tokens: int, messages: list[dict[str, Any]]
) -> tuple[int, int]:
    """Returns (prompt_tokens, completion_tokens)."""
    r = await client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=0.3,
    )
    u = r.usage
    if u is None:
        return 0, len((r.choices[0].message.content or "")) // 4
    return int(u.prompt_tokens or 0), int(u.completion_tokens or 0)


async def batch_throughput(
    client,
    model: str,
    n: int,
    max_tokens: int,
    args: argparse.Namespace,
    *,
    progress: bool,
    level_tag: str,
    round_idx: int,
    n_rounds: int,
) -> tuple[float, int, int, float]:
    """
    One batch of n parallel requests（每路独立随机 messages）。
    Returns (tok/s, sum_prompt, sum_completion, seconds).
    """
    t0 = time.perf_counter()
    tasks = [
        asyncio.create_task(
            one_completion(client, model, max_tokens, build_messages_for_request(args))
        )
        for _ in range(n)
    ]
    results: list[tuple[int, int]] = []
    cum_ct = 0

    if progress:
        for k, t in enumerate(asyncio.as_completed(tasks), start=1):
            pt, ct = await t
            results.append((pt, ct))
            cum_ct += ct
            elapsed = time.perf_counter() - t0
            rate = cum_ct / elapsed if elapsed > 0 else 0.0
            _log(
                f"  [{level_tag} r{round_idx}/{n_rounds}] "
                f"完成 {k}/{n} 路 · 本路 +{ct} completion tok · "
                f"累计 completion {cum_ct} tok · 瞬时 {rate:.1f} tok/s"
            )
    else:
        raw = await asyncio.gather(*tasks)
        results = list(raw)

    elapsed = time.perf_counter() - t0
    sp = sum(a for a, _ in results)
    sc = sum(b for _, b in results)
    tps = sc / elapsed if elapsed > 0 else 0.0
    return tps, sp, sc, elapsed


@asynccontextmanager
async def openai_client(base_url: str, timeout: float) -> AsyncIterator:
    """AsyncOpenAI with httpx trust_env=False so localhost ignores HTTP(S)_PROXY / SOCKS."""
    import httpx
    from openai import AsyncOpenAI

    timeout_cfg = httpx.Timeout(timeout, connect=30.0)
    http_client = httpx.AsyncClient(trust_env=False, timeout=timeout_cfg)
    client = AsyncOpenAI(
        base_url=base_url.rstrip("/"),
        api_key="dummy",
        http_client=http_client,
    )
    try:
        yield client
    finally:
        await client.close()
        await http_client.aclose()


async def main_async() -> int:
    args = parse_args()
    levels = [int(x.strip()) for x in args.concurrency.split(",") if x.strip()]
    if not levels:
        print("No concurrency levels", file=sys.stderr)
        return 2

    base = args.base_url.rstrip("/")
    model = args.model.strip()
    progress = not args.no_progress

    prompt_path: Path | None = None
    if (args.prompt_json or "").strip():
        prompt_path = Path(args.prompt_json.strip()).expanduser()
        if not prompt_path.is_file():
            print(f"[ERROR] --prompt-json 文件不存在: {prompt_path}", file=sys.stderr)
            return 2
        with prompt_path.open(encoding="utf-8") as f:
            loaded = json.load(f)
        if not isinstance(loaded, list):
            print("[ERROR] prompt-json 须为 JSON 数组（OpenAI messages 列表）", file=sys.stderr)
            return 2
        setattr(args, "_prompt_template", loaded)
    else:
        setattr(args, "_prompt_template", None)

    tpl = getattr(args, "_prompt_template", None)
    needs_pil = False
    if tpl is not None:
        needs_pil = _prompt_json_needs_pil(tpl)
    elif args.mode == "vision":
        needs_pil = True

    _mib = 0.0
    setattr(args, "_cached_placeholder_data_url", None)
    if needs_pil:
        try:
            _probe = make_screenshot_data_url(args.image_width, args.image_height)
            _mib = len(_probe) / (1024 * 1024)
            if tpl is not None and getattr(args, "reuse_placeholder_image", False):
                setattr(args, "_cached_placeholder_data_url", _probe)
        except ModuleNotFoundError as e:
            if "PIL" in str(e) or "pillow" in str(e).lower():
                print(
                    "需要 Pillow：pip install pillow\n"
                    "（vision 或 prompt-json 中含 [IMAGE_DATA_STRIPPED]）",
                    file=sys.stderr,
                )
                return 2
            raise

    async with openai_client(base, args.timeout) as ac:
        if not model:
            ml = await ac.models.list()
            ids = [m.id for m in ml.data]
            if not ids:
                print("No models from /v1/models", file=sys.stderr)
                return 2
            model = ids[0]
            _log(f"[info] --model 未指定，使用服务端首个模型: {model}")

        _log("")
        if tpl is not None and prompt_path is not None:
            nmsg = len(tpl)
            roles_preview = [str(m.get("role", "?")) for m in tpl[:8]]
            extra = " …" if nmsg > 8 else ""
            _log(f"prompt-json: {prompt_path.resolve()}")
            _log(f"  messages={nmsg} · 前若干 role: {roles_preview}{extra}")
            if needs_pil:
                if getattr(args, "reuse_placeholder_image", False):
                    _log(
                        f"  [IMAGE_DATA_STRIPPED] → 全进程复用同一张 PNG "
                        f"{args.image_width}x{args.image_height}（≈ {_mib:.2f} MiB，--reuse-placeholder-image）"
                    )
                else:
                    _log(
                        f"  [IMAGE_DATA_STRIPPED] → 每路随机 PNG {args.image_width}x{args.image_height} "
                        f"（典型 data URL ≈ {_mib:.2f} MiB）"
                    )
            else:
                _log("  无图片占位符，不注入 PNG")
        elif args.mode == "vision":
            _log(
                f"mode=vision · 截图 {args.image_width}x{args.image_height} · "
                f"单路 PNG data URL 典型体积 ≈ {_mib:.2f} MiB（每路独立随机图）· "
                f"user 文本每路随机 · "
                f"AutoGLM system={'开' if not args.no_system else '关（--no-system）'}"
            )
            if (args.task_prefix or "").strip():
                _log(f"task-prefix: {args.task_prefix.strip()[:80]}{'…' if len(args.task_prefix) > 80 else ''}")
        else:
            _log("mode=text · 每路独立随机 user 文本（无图）")
        _log("")
        _log(
            f"base_url={base}\nmodel={model}\nmax_tokens={args.max_tokens} "
            f"每档 rounds={args.rounds} · 进度: {'开' if progress else '关（--no-progress）'}"
        )
        if getattr(args, "no_prefill_noise", False):
            _log("首条文本前缀: 关（--no-prefill-noise）")
        else:
            _log("首条文本前缀: 开（每路随机 [bench_prefill_noise:…]，削弱前缀缓存）")
        _log("")
        _log(f"{'conc':>6} {'tok/s_med':>12} {'tok/s_min':>12} {'tok/s_max':>12} {'ctok_sum':>10} {'sec':>8}")
        _log("-" * 72)

        best_n = 0
        best_tps = 0.0
        n_levels = len(levels)
        # (conc, tok/s_med, tok/s_min, tok/s_max, ctok_sum, sec)
        summary_rows: list[tuple[int, float, float, float, int, float]] = []

        for li, n in enumerate(levels, start=1):
            rates: list[float] = []
            last_sc = 0
            last_el = 0.0
            level_tag = f"{li}/{n_levels}·c={n}"
            try:
                if progress:
                    _log(f"\n>>> 档位 [{level_tag}] 开始（{args.rounds} 轮批测）")
                for r in range(args.rounds):
                    if progress:
                        _log(f"  --- 第 {r + 1}/{args.rounds} 轮：同时发起 {n} 个请求 ---")
                    tps, _sp, sc, elapsed = await batch_throughput(
                        ac,
                        model,
                        n,
                        args.max_tokens,
                        args,
                        progress=progress,
                        level_tag=level_tag,
                        round_idx=r + 1,
                        n_rounds=args.rounds,
                    )
                    rates.append(tps)
                    last_sc, last_el = sc, elapsed
                    if progress:
                        _log(
                            f"  === 本轮结束: {sc} completion tok / {elapsed:.3f}s "
                            f"→ {tps:.1f} tok/s"
                        )
            except Exception as e:
                _log(f"{n:>6} ERROR {type(e).__name__}: {e}")
                continue
            med = statistics.median(rates)
            lo = min(rates)
            hi = max(rates)
            if med > best_tps:
                best_tps, best_n = med, n
            summary_rows.append((n, med, lo, hi, last_sc, last_el))
            _log(
                f"{n:>6} {med:>12.1f} {lo:>12.1f} {hi:>12.1f} {last_sc:>10} {last_el:>8.3f}"
            )

        _log("-" * 72)
        _log("汇总（全部成功档位，按并发升序）")
        _log(f"{'conc':>6} {'tok/s_med':>12} {'tok/s_min':>12} {'tok/s_max':>12} {'ctok_sum':>10} {'sec':>8}")
        _log("-" * 72)
        for n, med, lo, hi, sc, el in summary_rows:
            _log(f"{n:>6} {med:>12.1f} {lo:>12.1f} {hi:>12.1f} {sc:>10} {el:>8.3f}")
        _log("-" * 72)
        if summary_rows:
            by_speed = sorted(summary_rows, key=lambda r: r[1], reverse=True)
            _log("按 tok/s_med 从高到低：")
            for rank, (n, med, lo, hi, _sc, _el) in enumerate(by_speed, 1):
                mark = " ← 峰值" if rank == 1 else ""
                _log(
                    f"  {rank:>2}. 并发 {n:>4} · {med:>8.1f} tok/s"
                    f" (min {lo:.1f} / max {hi:.1f}){mark}"
                )
            _log(
                f"峰值（中位数吞吐）: {best_tps:.1f} completion tok/s · 并发={best_n} "
                f"· 每档 {args.rounds} 轮"
            )
        else:
            _log("无成功档位。")
    return 0


def main() -> int:
    return asyncio.run(main_async())


if __name__ == "__main__":
    raise SystemExit(main())
