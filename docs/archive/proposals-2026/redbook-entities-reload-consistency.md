# 小红书 entities reload 一致性问题

## 背景

RedBook 的 `entities`（`notesById`、`usersById`）以及 `feedIds`、`userIds` 数据量较大，不能直接写入 localStorage。当前 store 通过 `partialize` 排除了这些字段，只持久化用户侧状态。

这会带来一个一致性问题：用户交互同时修改了 `user.*`（已持久化）和 `entities.*`（未持久化）。页面 reload 后，`user.*` 保留，但 `entities.*` 会从原始 JSON 快照重新加载，导致两边状态不一致。

## 现象

| 用户动作 | `user.*` 侧（持久化） | `entities.*` 侧（reload 后丢失） |
| --- | --- | --- |
| 点赞 | `user.likedNotes` | `note.likes ± 1` |
| 收藏 | `user.collectedNotes` | `note.collections ± 1` |
| 评论 | `user.commentList` | `note.comments` / `note.commentList` 追加 |
| 删评 | `user.commentList` | `note.comments` / `note.commentList` 删除 |
| 关注 | `user.followings` | `targetUser.followers ± 1` |
| 发布 | `user.publishedNoteIds` | `notesById` 新增、`feedIds` 新增 |

## 当前代码位置

- `apps/RedBook/state.ts`
  - `partialize` 排除 `entities`、`feedIds`、`userIds`
  - `toggleLike`、`toggleCollect`、`addComment`、`toggleCommentLike`、`followUser`、`addNote` 仍会修改 `entities`
- `apps/RedBook/pages/*`
  - 多处仍直接渲染 `note.likes`、`note.collections`、`note.comments`、`user.followers` 等 entity 字段

## 旧代码 tradeoff

迁移前的 Context 手动持久化已有类似取舍，原注释为：

```ts
// We lose 'likes' persistence on refresh for imported notes, but this is necessary for large datasets
```

## 推荐方向：派生渲染

将 `entities` 视为只读快照，用户操作结果全部落在 `user.*` 或专门的轻量 overlay 状态中。渲染时从原始 entity 数据 + 用户状态派生显示值。

例如点赞数：

```tsx
const baseLikes = parseCount(note.likes);
const isLiked = user.likedNotes.includes(note.id);
const displayLikes = baseLikes + (isLiked ? 1 : 0);
```

收藏、评论数、关注数同理派生；评论列表可以用 `user.commentList` 作为 overlay 合并到当前笔记的原始 `note.commentList`。

## 取舍

优点：

- `entities` 永远保持原始 JSON 快照，不需要持久化大对象。
- `user.*` 成为用户行为的唯一真相源。
- reload 后用户侧状态和渲染结果保持一致。

缺点：

- 需要梳理所有读取 likes、collections、comments、followers、published notes 的页面。
- 发布笔记和评论列表需要定义 overlay 合并规则，而不是直接依赖 `entities.notesById`。

## 优先级

低到中。bench_env 通常在单次 page load 内完成任务，短期不受影响；但开发调试和手动刷新会看到状态回退/计数不一致，后续整理 RedBook 数据层时应一并处理。
