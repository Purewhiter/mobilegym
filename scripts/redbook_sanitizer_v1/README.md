# RedBook Sanitizer v1 Scripts

这组脚本用于重新生成小红书数据脱敏流水线，所有 OpenAI 调用都走原始 REST `/v1` 接口：

- 文本/VLM：`POST /v1/responses`
- 生图：`POST /v1/images/generations`

脚本默认不覆盖 `apps/RedBook/data`，只写到你指定的输出目录。

## 环境变量

```bash
export OPENAI_API_KEY=...
export OPENAI_BASE_URL=https://api.openai.com/v1
export REDBOOK_TEXT_MODEL=gpt-5-mini
export REDBOOK_VLM_MODEL=gpt-5-mini
export REDBOOK_IMAGE_MODEL=gpt-image-1.5
```

如果使用 OpenAI 兼容网关，只需要改 `OPENAI_BASE_URL`。

## 推荐顺序

先小批量试跑：

```bash
OUT=/tmp/redbook_sanitize_v1
SRC=/home/dingbang.wu/output

python scripts/redbook_sanitizer_v1/rewrite_users.py \
  --out "$OUT/users.rewritten.jsonl" \
  --limit 20

python scripts/redbook_sanitizer_v1/rewrite_notes.py \
  --users "$OUT/users.rewritten.jsonl" \
  --out "$OUT/notes.rewritten.jsonl" \
  --limit 20

python scripts/redbook_sanitizer_v1/caption_images.py \
  --source-images-root "$SRC" \
  --source-ts "$SRC/crawledData_localized.ts" \
  --out "$OUT/image.captions.jsonl" \
  --limit 20

python scripts/redbook_sanitizer_v1/audit_image_captions.py \
  --captions "$OUT/image.captions.jsonl" \
  --out "$OUT/image.caption_audits.jsonl" \
  --limit 20

python scripts/redbook_sanitizer_v1/generate_images.py \
  --audits "$OUT/image.caption_audits.jsonl" \
  --out-root "$OUT/images" \
  --limit 20

python scripts/redbook_sanitizer_v1/audit_text_rewrites.py \
  --users "$OUT/users.rewritten.jsonl" \
  --notes "$OUT/notes.rewritten.jsonl" \
  --out "$OUT/text_audit_report.json"
```

## 设计要点

- `rewrite_users.py`：一次一个用户，改写昵称和简介，保留人设，不保留真实身份/联系方式。
- `rewrite_notes.py`：一次一个帖子，改写标题、正文、标签、评论。
- `caption_images.py`：用 VLM 为本地原图生成结构化 caption 和生图 prompt。
- `audit_image_captions.py`：审核 prompt 是否保持图片类型，是否残留品牌/联系方式/可搜索原文。
- `generate_images.py`：只对审核通过的 prompt 生图。
- `audit_text_rewrites.py`：对照当前原始 `notes.json/users.json`，检查缺失 ID、高相似字段、原昵称/签名/标签/联系方式/可搜索短句残留。

所有 JSONL 输出都支持断点续跑；已有 ID/key 默认跳过，传 `--force` 可重跑。
