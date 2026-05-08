#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from tqdm import tqdm

from io_utils import OUTPUT_ROOT, append_jsonl, load_redbook_users, read_jsonl_map
from openai_v1 import responses_json
from risk_utils import user_risk_context


USER_ITEM_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "id": {"type": "string"},
        "name": {"type": "string"},
        "intro": {"type": "string"},
        "location": {"type": "string"},
        "styleNotes": {"type": "string"},
        "removedSensitiveItems": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["id", "name", "intro", "location", "styleNotes", "removedSensitiveItems"],
    "additionalProperties": False,
}


USER_BATCH_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "users": {"type": "array", "items": USER_ITEM_SCHEMA},
    },
    "required": ["users"],
    "additionalProperties": False,
}


SYSTEM = """你是小红书用户资料脱敏改写员。
目标：保留每个用户的人设和真实感，但不能看出原昵称、原签名，不能搜索回真人。
输入：一个 users 数组，每个元素是一个独立用户。
输出：长度与输入完全一致的 users 数组，按输入顺序一一对应。每个输出元素的 id 必须与对应输入元素的 id 一致。
规则：
1. 用户之间互相独立改写，不要让一个用户的昵称、人设、风格影响另一个用户；同一批中的多个用户不要使用相同昵称。
2. 昵称必须是虚构的中文/中英混合小红书风格昵称，不要随机乱码，不要使用真实姓名。
3. 简介保留原始人设主题，例如健身、学习、穿搭、探店、育儿、摄影、生活记录。
4. 删除或虚构化真实品牌、机构、学校、公司、店名、姓名、邮箱、微信、手机号、URL、小红书号。
5. 如果原简介为空或"还没有简介"，生成一个短的自然简介，不能复制原文。
6. location 可以保留到省市级，不要加入具体地址。
7. 每个用户输入的 auditContext.forbiddenTerms 中的词和短句都不能原样出现在该用户的 name 或 intro 中；contactCandidates 必须删除或虚构化。
8. **intro 是用户自己的小红书简介**：只写人设、兴趣、生活态度，不要写"邮箱已去除""已删除联系方式""脱敏处理"等元信息——脱敏过程的痕迹只能写到 removedSensitiveItems 字段里。
9. 输出严格 JSON，不要 Markdown，不要在数组之外添加额外字段。"""


def chunked(items: list[Any], size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


def main() -> None:
    parser = argparse.ArgumentParser(description="Rewrite RedBook users in batches with /v1 Responses API.")
    parser.add_argument("--out", type=Path, default=OUTPUT_ROOT / "users.jsonl")
    parser.add_argument("--model", default=os.environ.get("REDBOOK_TEXT_MODEL", "gpt-5-mini"))
    parser.add_argument("--limit", type=int, help="Total number of users to rewrite this run.")
    parser.add_argument("--batch-size", type=int, default=10, help="Users per LLM call.")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    users = load_redbook_users()
    done = {} if args.force else read_jsonl_map(args.out, "id")
    pending = [u for u in users if str(u["id"]) not in done]
    if args.limit is not None:
        pending = pending[: args.limit]

    pbar = tqdm(total=len(pending), desc="users", unit="user", smoothing=0.1)
    try:
        for batch in chunked(pending, args.batch_size):
            payload_users = [
                {
                    "id": user.get("id"),
                    "name": user.get("name", ""),
                    "intro": user.get("intro", ""),
                    "location": user.get("location", ""),
                    "gender": user.get("gender", ""),
                    "age": user.get("age", ""),
                    "auditContext": user_risk_context(user),
                }
                for user in batch
            ]
            result = responses_json(
                model=args.model,
                system=SYSTEM,
                user_content="请改写下面这批用户资料，输出 JSON：\n"
                + json.dumps({"users": payload_users}, ensure_ascii=False, indent=2),
                schema_name="redbook_user_rewrite_batch",
                schema=USER_BATCH_SCHEMA,
            )
            rewritten_by_id = {str(item.get("id")): item for item in (result.get("users") or [])}
            for orig in batch:
                rw = rewritten_by_id.get(str(orig["id"]))
                if rw is None:
                    tqdm.write(f"WARN: model dropped user {orig['id']}, retry singly")
                    rw = responses_json(
                        model=args.model,
                        system=SYSTEM,
                        user_content="请改写下面这批用户资料，输出 JSON：\n"
                        + json.dumps(
                            {
                                "users": [
                                    {
                                        "id": orig.get("id"),
                                        "name": orig.get("name", ""),
                                        "intro": orig.get("intro", ""),
                                        "location": orig.get("location", ""),
                                        "gender": orig.get("gender", ""),
                                        "age": orig.get("age", ""),
                                        "auditContext": user_risk_context(orig),
                                    }
                                ]
                            },
                            ensure_ascii=False,
                            indent=2,
                        ),
                        schema_name="redbook_user_rewrite_batch",
                        schema=USER_BATCH_SCHEMA,
                    )["users"][0]
                append_jsonl(args.out, rw)
                pbar.set_postfix_str(rw["name"][:20])
                pbar.update(1)
    finally:
        pbar.close()


if __name__ == "__main__":
    main()
