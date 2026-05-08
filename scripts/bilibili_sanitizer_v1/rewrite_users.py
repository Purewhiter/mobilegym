#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

try:
    from tqdm import tqdm
except ImportError:  # pragma: no cover
    def tqdm(iterable=None, **_: Any):
        return iterable if iterable is not None else _NullProgress()

    class _NullProgress:
        def update(self, _: int = 1) -> None:
            pass

        def set_postfix_str(self, _: str) -> None:
            pass

        def close(self) -> None:
            pass

from io_utils import OUTPUT_ROOT, append_jsonl, chunked, load_authors, load_commenters, read_jsonl_map
from openai_v1 import chat_text
from risk_utils import EMAIL_RE, HANDLE_RE, PHONE_RE, URL_RE


SYSTEM = """你是 Bilibili 用户资料脱敏改写员。
目标：保留用户在 B 站里的账号类型、兴趣领域和真实感，但不能看出原昵称、原签名、原认证身份，不能搜索回真人或真实账号。
规则：
1. 输入每行是一个用户，格式是：行号<TAB>原昵称<TAB>原简介。
2. 输出必须覆盖每个输入行号，行号必须原样保留。
3. 每个输出行格式是：行号<TAB>新昵称<TAB>新简介。
4. 新昵称必须重新创作：不能等于原昵称，不能只改标点/空格/大小写，不能保留原昵称里的可识别片段、英文账号、数字串或特殊拼写。
5. 新昵称要保留账号类型和领域气质，例如资讯号、游戏号、舞蹈号、音乐号、数码号、影视号、生活号、二创号、评论区普通用户，但必须换成虚构 B 站风格昵称。
6. 新简介保留大致人设和创作/观看兴趣，但删除或虚构化真实公司、学校、机构、认证身份、品牌合作、微信、QQ、邮箱、URL、手机号、UID、群号、微博、公众号、小号等信息。
7. 如果原简介主要是联系方式、商务、接稿、社群、引流或全平台同名说明，必须改成自然的兴趣/创作简介；不要保留“私信”“合作”“商务”“微信”“邮箱”“QQ”“粉丝群”“全平台同名”“联系我”等联系或邀约语义。
8. 不要写“隐藏”“删除”“脱敏”“已去除”“联系方式”等元信息。
9. 字段内不要出现换行或制表符。
10. 不要输出编号、解释或 Markdown。"""


FORBIDDEN_OUTPUT_TERMS = (
    "全平台同名",
    "粉丝群",
    "私信",
    "合作",
    "商务",
    "微信",
    "邮箱",
    "QQ",
    "qq",
    "vx",
    "VX",
    "v信",
    "V信",
    "微博",
    "公众号",
    "小号",
    "群号",
    "投稿邮箱",
    "投稿群",
    "联系方式",
    "联系",
    "联系我",
    "加我",
    "接稿",
    "约稿",
)


CONTACT_CANDIDATE_RE = re.compile(
    r"(?i)(?:微信|vx|v信|商务|合作|邮箱|email|qq|微博|公众号|群号|投稿|扩列|商v|联系|加)"
    r"[:：\\s+＋➕-]*([A-Za-z0-9_.@-]{3,})"
)


def _items_for_source(source: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    if source in {"authors", "all"}:
        for mid, user in load_authors().items():
            items.append({"namespace": "author", "key": f"author:{mid}", "mid": mid, "user": user})
    if source in {"commenters", "all"}:
        for mid, user in load_commenters().items():
            items.append({"namespace": "commenter", "key": f"commenter:{mid}", "mid": mid, "user": user})
    return items


def _filter_items_by_keys(items: list[dict[str, Any]], keys: list[str] | None) -> list[dict[str, Any]]:
    if not keys:
        return items
    wanted = set(keys)
    items_by_key = {item["key"]: item for item in items}
    missing = [key for key in keys if key not in items_by_key]
    if missing:
        raise SystemExit(f"unknown user keys: {', '.join(missing[:20])}")
    return [items_by_key[key] for key in keys if key in wanted]


def _cell(value: Any) -> str:
    return str(value or "").replace("\t", " ").replace("\r", " ").replace("\n", " ").strip()


def _parse_user_lines(text: str, expected: int) -> list[dict[str, str]]:
    rows_by_index: dict[int, dict[str, str]] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("```"):
            continue
        parts = line.split("\t")
        if len(parts) < 3:
            parts = line.split(None, 2)
        if len(parts) < 3:
            continue
        try:
            row_index = int(parts[0].strip())
        except ValueError:
            continue
        if 1 <= row_index <= expected:
            rows_by_index[row_index] = {"name": parts[1].strip(), "sign": parts[2].strip()}
    missing = [i for i in range(1, expected + 1) if i not in rows_by_index]
    if missing:
        raise RuntimeError(f"model missed rows {missing[:10]} for {expected} inputs")
    return [rows_by_index[i] for i in range(1, expected + 1)]


def _norm(value: Any) -> str:
    return re.sub(r"[\s\\-_·.。!！?？~～|丨/\\\\:：,，、()（）\\[\\]【】{}<>《》\"'“”‘’]+", "", str(value or "")).lower()


def _name_too_close(original_name: str, rewritten_name: str) -> bool:
    old = _norm(original_name)
    new = _norm(rewritten_name)
    if not old or not new:
        return True
    if old == new:
        return True
    if len(old) >= 3 and old in new:
        return True
    if len(new) >= 3 and new in old:
        return True
    return SequenceMatcher(None, old, new).ratio() >= 0.75


def _validate_user_rewrite(original_user: dict[str, Any], rewritten: dict[str, str]) -> None:
    original_name = _cell(original_user.get("name", ""))
    original_sign = _cell(original_user.get("sign", ""))
    rewritten_name = _cell(rewritten.get("name", ""))
    rewritten_sign = _cell(rewritten.get("sign", ""))
    output_text = f"{rewritten_name}\n{rewritten_sign}"
    output_norm = _norm(output_text)

    if not rewritten_name:
        raise RuntimeError("model returned empty user name")
    if _name_too_close(original_name, rewritten_name):
        raise RuntimeError(f"user name too close to original: {original_name!r} -> {rewritten_name!r}")
    if original_sign and rewritten_sign:
        sign_similarity = SequenceMatcher(None, original_sign, rewritten_sign).ratio()
        if sign_similarity >= 0.72:
            raise RuntimeError(
                f"user sign too close to original ({sign_similarity:.3f}): "
                f"{original_sign!r} -> {rewritten_sign!r}"
            )

    for term in FORBIDDEN_OUTPUT_TERMS:
        if term in output_text:
            raise RuntimeError(f"output contains forbidden term {term!r}")

    for regex, label in ((EMAIL_RE, "email"), (URL_RE, "url"), (PHONE_RE, "phone"), (HANDLE_RE, "contact handle")):
        if regex.search(output_text):
            raise RuntimeError(f"output contains {label}")

    official_title = _cell((original_user.get("official") or {}).get("title", ""))
    if len(official_title) >= 3 and official_title in output_text:
        raise RuntimeError(f"output contains original official title {official_title!r}")

    candidates = []
    for regex in (EMAIL_RE, URL_RE, PHONE_RE, HANDLE_RE):
        candidates.extend(match.group(0) for match in regex.finditer(f"{original_name}\n{original_sign}"))
    candidates.extend(match.group(1) for match in CONTACT_CANDIDATE_RE.finditer(original_sign))
    for candidate in candidates:
        candidate_norm = _norm(candidate)
        if len(candidate_norm) >= 3 and candidate_norm in output_norm:
            raise RuntimeError(f"output contains original sensitive candidate {candidate!r}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Rewrite Bilibili authors/commenters with a local OpenAI-compatible model.")
    parser.add_argument("--source", choices=["authors", "commenters", "all"], default="all")
    parser.add_argument("--out", type=Path, default=OUTPUT_ROOT / "users.jsonl")
    parser.add_argument("--model", default=os.environ.get("BILIBILI_TEXT_MODEL", "local-model"))
    parser.add_argument("--limit", type=int, help="Total users to rewrite in this run.")
    parser.add_argument("--keys", nargs="+", help="Specific user keys, e.g. author:123 commenter:456.")
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--concurrency", type=int, default=1, help="Parallel batches in flight; 1 = serial.")
    parser.add_argument("--retries", type=int, default=2, help="Retries per failed batch.")
    parser.add_argument("--failures", type=Path, help="JSONL file for failed batches; default is <out>.failures.jsonl.")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    items = _filter_items_by_keys(_items_for_source(args.source), args.keys)
    done = {} if args.force else read_jsonl_map(args.out, "key")
    pending = [item for item in items if item["key"] not in done]
    if args.limit is not None:
        pending = pending[: args.limit]

    batches = list(chunked(pending, args.batch_size))
    failures_path = args.failures or args.out.with_name(f"{args.out.stem}.failures.jsonl")
    if args.force and failures_path.exists():
        failures_path.unlink()
    pbar = tqdm(total=len(pending), desc="users", unit="user", smoothing=0.1)
    write_lock = threading.Lock()
    failure_count = 0

    def process_batch(batch: list[dict[str, Any]]) -> None:
        nonlocal failure_count
        input_lines = []
        for idx, item in enumerate(batch, 1):
            input_lines.append(f"{idx}\t{_cell(item['user'].get('name', ''))}\t{_cell(item['user'].get('sign', ''))}")
        last_error: Exception | None = None
        rewritten: list[dict[str, Any]] = []
        for attempt in range(args.retries + 1):
            try:
                output_text = chat_text(
                    model=args.model,
                    system=SYSTEM,
                    user_content="请逐行改写下面这批 Bilibili 用户资料，只输出 TSV：\n"
                    + "\n".join(input_lines),
                )
                rewritten = _parse_user_lines(output_text, len(batch))
                for original, model_item in zip(batch, rewritten):
                    _validate_user_rewrite(original["user"], model_item)
                break
            except Exception as exc:
                last_error = exc
            if attempt < args.retries:
                time.sleep(min(2**attempt, 5))
        else:
            assert last_error is not None
            with write_lock:
                append_jsonl(
                    failures_path,
                    {
                        "kind": "user_batch_failed",
                        "error": str(last_error),
                        "keys": [item["key"] for item in batch],
                    },
                )
                failure_count += len(batch)
                pbar.set_postfix_str(f"failed batch {len(batch)}")
                pbar.update(len(batch))
            return

        rows: list[dict[str, Any]] = []
        for orig, model_item in zip(batch, rewritten):
            rows.append(
                {
                    "key": orig["key"],
                    "namespace": orig["namespace"],
                    "mid": orig["mid"],
                    "name": model_item.get("name", ""),
                    "sign": model_item.get("sign", ""),
                }
            )
        with write_lock:
            for rw in rows:
                append_jsonl(args.out, rw)
                pbar.set_postfix_str(rw.get("name", "")[:24])
                pbar.update(1)

    try:
        if args.concurrency <= 1:
            for batch in batches:
                process_batch(batch)
        else:
            with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
                futures = [ex.submit(process_batch, batch) for batch in batches]
                for future in as_completed(futures):
                    future.result()
    finally:
        pbar.close()
    if failure_count:
        print(f"FAILED users: {failure_count}; see {failures_path}")
        raise SystemExit(1)


if __name__ == "__main__":
    main()
