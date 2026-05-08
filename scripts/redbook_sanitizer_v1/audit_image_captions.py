#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any

from tqdm import tqdm

from io_utils import OUTPUT_ROOT, append_jsonl, read_jsonl_map
from openai_v1 import responses_json


AUDIT_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "key": {"type": "string"},
        "pass": {"type": "boolean"},
        "riskLevel": {"type": "string", "enum": ["low", "medium", "high"]},
        "issues": {"type": "array", "items": {"type": "string"}},
        "fixedPromptZh": {"type": "string"},
    },
    "required": ["key", "pass", "riskLevel", "issues", "fixedPromptZh"],
    "additionalProperties": False,
}


SYSTEM = """你是小红书图片重生成 prompt 的审核员。
目标：生成图必须保持原图语义、图像类型和真实感，同时不能保留真实品牌、真人身份、联系方式、账号、水印或可搜索原文案。
判定标准：
1. text_card 必须仍是文字卡片，screenshot 必须仍是截图风格，food 必须仍是同类菜品，outfit 必须保留穿搭/镜头/场景大类。
2. prompt 中不能要求复刻真实 Logo、品牌名、店名、人名、账号、手机号、邮箱、URL。
3. 如果 prompt 太泛泛，可能导致语义漂移，判为不通过并修正。
4. 输入 auditContext.forbiddenTerms 中的原始标题短句、标签、昵称、评论用户名、评论短句不能原样出现在 fixedPromptZh 中。
5. 输入 auditContext.contactCandidates 里的联系方式/URL/账号必须删除或虚构化。
6. fixedPromptZh 应是可直接给生图模型使用的中文 prompt。
7. **不要**把"人脸被手机/物体遮挡"、"打码"、"马赛克"等掩面信息写进 fixedPromptZh——生成图里的人脸是模型生成的虚构人脸、与真人无关，自然展示即可，强加遮挡反而损失真实感。原图无论是否掩面，prompt 里都默认正常展示人物。可以描述年龄、气质、发型、神态、姿势、长相风格等（如"年轻女性、清爽五官、长发披肩、自然微笑"），保留视觉真实感。"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Audit image captions/prompts with the OpenAI /v1 Responses API.")
    parser.add_argument("--captions", default=str(OUTPUT_ROOT / "image.captions.jsonl"))
    parser.add_argument("--out", default=str(OUTPUT_ROOT / "image.caption_audits.jsonl"))
    parser.add_argument("--model", default=os.environ.get("REDBOOK_TEXT_MODEL", "gpt-5-mini"))
    parser.add_argument("--limit", type=int)
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    captions = list(read_jsonl_map(Path(args.captions), "key").values())
    done = {} if args.force else read_jsonl_map(Path(args.out), "key")
    pending = [c for c in captions if c["key"] not in done]
    if args.limit is not None:
        pending = pending[: args.limit]

    pbar = tqdm(pending, desc="audits", unit="img", smoothing=0.1)
    try:
        for caption in pbar:
            key = caption["key"]
            result = responses_json(
                model=args.model,
                system=SYSTEM,
                user_content="请审核并修正以下 JSON caption/prompt：\n" + json.dumps(caption, ensure_ascii=False, indent=2),
                schema_name="redbook_caption_audit",
                schema=AUDIT_SCHEMA,
            )
            append_jsonl(Path(args.out), result)
            pbar.set_postfix_str(f"pass={result['pass']} risk={result['riskLevel']} {key}")
    finally:
        pbar.close()


if __name__ == "__main__":
    main()
