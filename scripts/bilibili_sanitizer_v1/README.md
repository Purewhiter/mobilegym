# Bilibili Sanitizer v1 Scripts

这组脚本用于重新生成 Bilibili 数据脱敏流水线。

当前版本只处理文本和 JSON 映射，不生成头像、封面或视频图片。
脚本默认不覆盖 `apps/Bilibili/data`，只写到指定输出目录。

## 环境变量

默认使用本地 OpenAI 兼容模型服务：

```bash
export OPENAI_BASE_URL=http://localhost:8000/v1
export OPENAI_API_KEY=EMPTY
export BILIBILI_TEXT_MODEL=local-model
export BILIBILI_OUT_ROOT=/tmp/bilibili_sanitize_v1
```

如果本地服务的模型名不是 `local-model`，设置 `BILIBILI_TEXT_MODEL` 或在命令里传
`--model`。

## 推荐顺序

先小批量试跑：

```bash
OUT=/tmp/bilibili_sanitize_v1

python scripts/bilibili_sanitizer_v1/rewrite_users.py \
  --source all \
  --out "$OUT/users.jsonl" \
  --limit 20

python scripts/bilibili_sanitizer_v1/rewrite_videos.py \
  --users "$OUT/users.jsonl" \
  --out "$OUT/videos.jsonl" \
  --limit 20

python scripts/bilibili_sanitizer_v1/rewrite_video_comments.py \
  --users "$OUT/users.jsonl" \
  --videos "$OUT/videos.jsonl" \
  --out "$OUT/video_comments.jsonl" \
  --limit 20

python scripts/bilibili_sanitizer_v1/audit_text_rewrites.py \
  --users "$OUT/users.jsonl" \
  --videos "$OUT/videos.jsonl" \
  --comments "$OUT/video_comments.jsonl" \
  --out "$OUT/text_audit_report.json"
```

确认文本质量后，再应用到一个新的数据目录：

```bash
python scripts/bilibili_sanitizer_v1/apply_rewrites.py \
  --users "$OUT/users.jsonl" \
  --videos "$OUT/videos.jsonl" \
  --comments "$OUT/video_comments.jsonl" \
  --out-dir "$OUT/data"
```

## 设计要点

- `rewrite_users.py`：统一处理 `authors.json` 和 `commenters.json`。
  - `namespace=author` 和 `namespace=commenter` 是两个身份域。
  - 即使同一个 mid 同时出现在作者和评论者里，也会按两个新身份处理。
  - 模型按 TSV 行协议输出：每行 `name<TAB>sign`。
  - `key/namespace/mid` 由脚本本地合回。
- `rewrite_videos.py`：改写 `videos.json` 的标题、作者展示名和 `videoTags.json` 标签。
  - 如果作者已在 `users.jsonl` 里改写，视频作者优先使用作者映射。
  - 模型只输出 `title/author/tags`；`BV id` 由脚本本地合回。
- `rewrite_video_comments.py`：按视频改写 `videoComments.json` 里的评论树。
  - 模型只输出 `message/replies`；`mid/rpid/uname` 由脚本本地合回。
  - `uname` 统一使用 `commenter:<mid>` 的改写昵称；找不到映射时兜底为“用户”。
- `apply_rewrites.py`：把 JSONL 输出应用到新的 data 目录。
  - 同步改写 `authors/commenters/videos/videoTags/videoComments/rankings/hot/recommend/defaults`。
  - 图片字段 `face/cover/avatar/top_photo` 暂时原样保留，后续由图片阶段替换。
- `audit_text_rewrites.py`：检查缺失 ID、高相似文本、原昵称/标题/评论残留。

所有 JSONL 输出支持断点续跑；已有 key/id 默认跳过，传 `--force` 可重跑。
