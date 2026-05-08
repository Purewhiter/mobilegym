#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from tqdm import tqdm

from io_utils import OUTPUT_ROOT, append_jsonl, batched, load_redbook_notes, load_redbook_users, read_jsonl_map
from openai_v1 import responses_json
from risk_utils import note_risk_context


NOTE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "title": {"type": "string"},
        "content": {"type": "string"},
        "tags": {"type": "array", "items": {"type": "string"}},
        "comments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "username": {"type": "string"},
                    "content": {"type": "string"},
                },
                "required": ["id", "username", "content"],
                "additionalProperties": False,
            },
        },
        "entityMappings": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "source": {"type": "string"},
                    "replacement": {"type": "string"},
                    "kind": {"type": "string"},
                },
                "required": ["source", "replacement", "kind"],
                "additionalProperties": False,
            },
        },
        "qualityNotes": {"type": "string"},
    },
    "required": ["id", "title", "content", "tags", "comments", "entityMappings", "qualityNotes"],
    "additionalProperties": False,
}


SYSTEM = """你是小红书帖子脱敏改写员。
目标：保留原帖核心语义、场景、情绪、类别和真实感，但不能通过搜索文本找到原帖。
规则：
1. 每次只处理一个帖子，输出严格 JSON。
2. 标题、正文、标签、评论 content 都必须改写，不能只替换几个词。
3. 保持事实关系和消费/学习/穿搭/美食等语义，不要改成另一类内容。
4. 真实品牌、商品名、店名、公司、私人姓名、联系方式、账号、URL 必须虚构化或删除。**例外**：广为人知的公众人物（教材作者、知名学者、明星、公开名人、历史人物等）必须**原样保留**，不要替换成"某位作者""经典教材作者"这类虚化称呼——例如评论里的"陈纪修恩师""于品老师讲义""鲁迅笔下""周杰伦的歌"这种引用，必须按原文保留。**此规则优先于规则 8**：即使这些公众人物名字出现在 auditContext.forbiddenTerms 中（因为它们随评论文本被切片进入 forbiddenTerms），也要保留原名，不视为违反规则 8。判断标准：替换成虚构名会让内容失真或丢失语境信息→保留；此人只是原作者的私人朋友/同学/客户/同事→虚构化。学校名同理：综合性大学/知名院校（清华、复旦、北大等）可保留，具体的中小学、培训机构、私立学校虚构化。
5. 如果原文很短，也要自然扩写或换表达，避免和原句高度相似。
6. 评论 content 要保持口吻多样，像真实用户，不要全部变成同一种书面语。
7. tags 使用虚构或泛化标签，不保留真实品牌/账号。
8. 输入 auditContext.forbiddenTerms 中的词和短句不能原样出现在 title/content/tags/comments[].content 中；contactCandidates 必须删除或虚构化。
9. **评论的 username 字段必须原样保留输入值**（这些原始昵称由 user 改写脚本统一映射，本脚本不动）；username 字段不在规则 8 的检查范围内。
10. 评论 content 里出现的 @账号 或 @昵称 必须删除、改成"我朋友/姐妹/同学"等泛称，或替换成虚构 @昵称，不能保留原 @文本。"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Rewrite RedBook notes one by one with /v1 Responses API.")
    parser.add_argument("--out", type=Path, default=OUTPUT_ROOT / "notes.jsonl")
    parser.add_argument("--users", type=Path, default=OUTPUT_ROOT / "users.jsonl", help="Rewritten users JSONL for author/comment context.")
    parser.add_argument("--model", default=os.environ.get("REDBOOK_TEXT_MODEL", "gpt-5-mini"))
    parser.add_argument("--limit", type=int)
    parser.add_argument("--concurrency", type=int, default=1, help="Parallel notes in flight; 1 = serial.")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    notes = load_redbook_notes()
    done = {} if args.force else read_jsonl_map(args.out, "id")
    rewritten_users = read_jsonl_map(args.users, "id") if args.users else {}
    original_users = {str(user["id"]): user for user in load_redbook_users()}
    pending = [n for n in notes if str(n["id"]) not in done]

    iterable = list(batched(pending, args.limit))
    pbar = tqdm(total=len(iterable), desc="notes", unit="note", smoothing=0.1)
    write_lock = threading.Lock()

    def process(note: dict[str, Any]) -> None:
        comments = [
            {
                "id": c.get("id"),
                "username": c.get("username", ""),
                "content": c.get("content", ""),
            }
            for c in note.get("commentList", [])
        ]
        payload = {
            "id": note.get("id"),
            "title": note.get("title", ""),
            "content": note.get("content", ""),
            "tags": note.get("tags", []),
            "category": note.get("category", ""),
            "authorId": note.get("authorId", ""),
            "rewrittenAuthor": rewritten_users.get(str(note.get("authorId", "")), {}),
            "comments": comments,
            "auditContext": note_risk_context(note, original_users),
        }
        try:
            result = responses_json(
                model=args.model,
                system=SYSTEM,
                user_content="请改写这个帖子，输出 JSON：\n" + json.dumps(payload, ensure_ascii=False, indent=2),
                schema_name="redbook_note_rewrite",
                schema=NOTE_SCHEMA,
            )
        except Exception as exc:
            with write_lock:
                tqdm.write(f"ERROR note {note.get('id')}: {exc}")
                pbar.update(1)
            return
        username_by_id = {str(c.get("id")): c.get("username", "") for c in note.get("commentList", []) or []}
        for c in result.get("comments", []) or []:
            original_username = username_by_id.get(str(c.get("id")), "")
            if original_username:
                c["username"] = original_username
        with write_lock:
            append_jsonl(args.out, result)
            pbar.update(1)
            pbar.set_postfix_str(result.get("title", "")[:30])

    try:
        if args.concurrency <= 1:
            for note in iterable:
                process(note)
        else:
            with ThreadPoolExecutor(max_workers=args.concurrency) as ex:
                futures = [ex.submit(process, n) for n in iterable]
                for f in as_completed(futures):
                    f.result()
    finally:
        pbar.close()


if __name__ == "__main__":
    main()
