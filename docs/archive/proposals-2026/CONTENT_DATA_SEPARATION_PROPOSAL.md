# 内容数据与用户状态分离方案

> **状态**：Proposal（待实施）
> **涉及 App**：RedBook、X、Reddit（以及未来所有含大量内容数据的 App）
> **关联文档**：`APP_STATE_DATA_SPEC.md`

---

## 一、问题

### 1.1 现象

`bench_env` 每次调用 `__SIM__.getState()` 都会序列化全量 App 状态。对于内容密集型 App，payload 极大：

| App | 大数据文件 | getState 行数 | 实际变化 |
|-----|-----------|--------------|---------|
| RedBook | notes.json (230K 行) + users.json (167K 行) | ~400K 行 | 2-3 条 note, 1-2 个 user |
| X | posts.json (476K 行) + users.json (100K 行) | ~576K 行 | 类似 |
| Reddit | posts.json (276K 行) | ~276K 行 | 类似 |

一个典型任务执行中，用户可能只点赞 1 条帖子、评论 1 次、关注 1 个人，但 getState 把**几千条未变化的帖子和用户**全部序列化传输。

### 1.2 影响

- **序列化耗时**：大 payload 通过 CDP 传输慢，即使有 gzip 压缩（`mobile_gym.py` 中 >100KB 自动压缩）
- **状态 diff 开销**：`StateComparator.diff_states()` 递归比较几千条 entity，绝大多数无变化
- **任务评判噪声**：`expected_changes` 需要精确列出 `entities.notesById.{id}`，entities 结构庞大增加维护成本

### 1.3 根因

当前架构把**平台内容数据**（帖子、用户资料 — 大量、稳定）和**用户操作状态**（点赞列表、设置、聊天记录 — 少量、易变）混在同一个 Zustand store 里。store 的 `partialize` 虽然排除了 entities 不写 localStorage，但 `getAllStoreStates()` 读的是运行时 `.getState()`，entities 仍在 getState 输出中。

---

## 二、方案：引用 diff + stateAdapter

### 2.1 核心思想

**不改前端 store 架构，不改 UI 代码，不改 store actions。** 利用 Zustand 不可变更新的特性，在 `stateAdapter` 中通过**引用相等性比较**自动检测哪些 entity 被修改过：

1. Store 中的 entities 初始来源是 `loader.ts` 的缓存（通过 `_setEntities` 注入）
2. Zustand 的不可变更新保证：未修改的 entity 保持与 loader 缓存相同的引用，修改过的 entity 是新对象
3. `stateAdapter` 在 `getState()` 输出时，遍历 entities 对比引用，只输出引用不同的（即被修改/新增的）

bench_env 侧：首次通过 `__SIM__.queryContentDB(appId)` 加载完整 base 内容（一次性），之后每次 getState 只收 modified entries，合并即得全量。

### 2.2 引用相等性原理

Zustand 使用不可变更新。以 `toggleLike` 为例：

```typescript
set({
  entities: {
    ...s.entities,
    notesById: {
      ...s.entities.notesById,           // 展开——未改的 entry 保持原引用
      [noteId]: { ...targetNote, likes: newCount },  // 改了的 entry 是新对象
    },
  },
});
```

数据流追踪：

1. `loadAll()` 创建 `cache = { notesById, usersById, feedIds, userIds }`
2. `_setEntities(cache)` 将 `cache.notesById` 直接 set 进 store
3. 此时 `store.entities.notesById[id] === cache.notesById[id]`（每个 entry 引用相等）
4. `toggleLike(noteId)` 创建新 note 对象，但其他 entry 引用不变
5. 结果：`store.notesById[noteId] !== cache.notesById[noteId]`（改了），其他仍 `===`

因此 adapter 中只需：

```
store.entities.notesById[id] !== loaderCache.notesById[id]  →  已修改或新增
store.entities.notesById[id] === loaderCache.notesById[id]  →  未变化
loaderCache.notesById[id] 存在但 store 中没有            →  已删除
```

**关键 invariant**：引用相等性成立的前提条件：

1. `_setEntities` 必须在 `loadAll()` 同一流程中调用（确保 store 持有的是 loader cache 的同一引用）
2. `entities` 必须被 `partialize` 排除（避免 localStorage hydrate 时生成新引用替换掉 loader 注入的引用）
3. Store actions 使用标准不可变更新（spread），不做 deep clone

以上三点在现有代码中均已满足。

### 2.3 概念模型

```
┌─────────────────────────────────────────────────┐
│               Zustand Store (完全不变)            │
│                                                   │
│  entities.notesById: { note_1: {...}, ... }      │  ← 正常可变，点赞/评论直接改
│  entities.usersById: { u1: {...}, ... }          │
│  user: { likedNotes: [...], ... }                │
│  settings: { ... }                                │
│  (无新增字段)                                     │
└─────────────────────────────────────────────────┘
                      │
                      ▼ stateAdapter（引用 diff）
┌─────────────────────────────────────────────────┐
│            getState() 输出 (精简)                │
│                                                   │
│  user: { ... }              ← 完整               │
│  settings: { ... }          ← 完整               │
│  chats: [ ... ]             ← 完整               │
│  feedIds: [ ... ]           ← 完整（可能有新帖）  │
│  _modifiedNotes: {          ← 只含改过/新增的     │
│    "note_2": { likes: 3422, commentList: [...] } │
│    "note_new": { ... }      ← 新发的帖子也在此   │
│  }                                                │
│  _modifiedUsers: {          ← 只含改过/新增的     │
│    "u3": { followers: 891 }                      │
│  }                                                │
│  _deletedNoteIds: []        ← 被删除的帖子 ID    │
│  _deletedUserIds: []        ← 被删除的用户 ID    │
│  _baseNotes: {              ← 被修改帖子的原始版  │
│    "note_2": { likes: 3421 }  (供 diff 恢复粒度) │
│  }                                                │
│  _baseUsers: {              ← 被修改用户的原始版  │
│    "u3": { followers: 890 }                      │
│  }                                                │
│  (entities / userIds 被 adapter 移除)            │
└─────────────────────────────────────────────────┘
                      │
                      ▼ bench_env 侧合并
┌─────────────────────────────────────────────────┐
│  base (queryContentDB, 只加载一次, 缓存):        │
│    notesById: { 几千条 }                         │
│    usersById: { 几百条 }                         │
│                                                   │
│  + _modifiedNotes/_modifiedUsers 覆盖             │
│  - _deletedNoteIds/_deletedUserIds 移除           │
│  = 完整的全量 entities 视图                       │
└─────────────────────────────────────────────────┘
```

---

## 三、实现细节

### 3.1 前端 — Store 零改动 + 注册 stateAdapter

**Store schema、actions、partialize 均不需要修改。** 唯一的改动是在 `state.ts` 末尾注册 adapter。

#### 3.1.1 通用 diff 工具函数

在 `os/createAppStore.ts` 中新增（供所有 App 复用）：

```typescript
export interface EntityDiffResult {
  modified: Record<string, any>;
  deleted: string[];
  modifiedBase: Record<string, any>;
}

/**
 * 对比 store 中的 entity map 与 loader base，返回三类信息：
 * - modified: 引用不同的 entries（被修改或新增的，完整对象）
 * - deleted: 在 base 中存在但 store 中已不存在的 key
 * - modifiedBase: 被修改 entries 在 base 中的原始版本（供 bench_env 做字段级 diff）
 *
 * 利用 Zustand 不可变更新的特性：未修改的 entry 保持与 base 相同的引用。
 */
export function diffEntities(
  current: Record<string, any> | undefined,
  base: Record<string, any> | undefined,
): EntityDiffResult {
  if (!current && !base) return { modified: {}, deleted: [], modifiedBase: {} };
  if (!current) return { modified: {}, deleted: Object.keys(base!), modifiedBase: {} };
  if (!base) return { modified: { ...current }, deleted: [], modifiedBase: {} };

  const modified: Record<string, any> = {};
  const deleted: string[] = [];
  const modifiedBase: Record<string, any> = {};

  for (const [id, entity] of Object.entries(current)) {
    if (entity !== base[id]) {
      modified[id] = entity;
      if (base[id] !== undefined) {
        modifiedBase[id] = base[id];
      }
    }
  }
  for (const id of Object.keys(base)) {
    if (!(id in current)) {
      deleted.push(id);
    }
  }
  return { modified, deleted, modifiedBase };
}
```

#### 3.1.2 注册 stateAdapter（以 RedBook 为例）

```typescript
// apps/RedBook/state.ts 末尾

import { registerStateAdapter, diffEntities } from '../../os/createAppStore';
import { getEntitiesSync } from './data/loader';

registerStateAdapter('redbook', (raw) => {
  const base = getEntitiesSync();
  if (!base) return raw; // loader 未就绪，降级返回原始状态

  const { entities, userIds, ...rest } = raw;
  const notesDiff = diffEntities(entities?.notesById, base.notesById);
  const usersDiff = diffEntities(entities?.usersById, base.usersById);

  return {
    ...rest,
    feedIds: raw.feedIds,
    _modifiedNotes: notesDiff.modified,
    _modifiedUsers: usersDiff.modified,
    _deletedNoteIds: notesDiff.deleted,
    _deletedUserIds: usersDiff.deleted,
    _baseNotes: notesDiff.modifiedBase,
    _baseUsers: usersDiff.modifiedBase,
  };
});
```

**`_baseNotes` / `_baseUsers` 的作用**：

`_modifiedNotes` 中的 entry 对应的**修改前原始版本**。bench_env 的 `StateComparator.diff_states()` 对比 init 和 final 状态时，如果 init 的 `_modifiedNotes` 中没有某个 key（即 init 时该 entity 未被修改），diff 只能看到 `None → {完整对象}`，无法做字段级对比。`_baseNotes` 为 bench_env 提供了补齐 init 侧数据的能力，使字段级 diff 得以恢复。详见 §3.4。

**前端改动总结**：

| 文件 | 改动 |
|------|------|
| `os/createAppStore.ts` | 新增 `diffEntities()` 工具函数（~25 行） |
| `apps/RedBook/state.ts` | 末尾新增 adapter 注册（~15 行） |
| Store interface / actions / partialize | **零改动** |
| UI 组件 | **零改动** |

#### 3.1.3 边界情况

| 场景 | 行为 | 说明 |
|------|------|------|
| loader 未加载 | `getEntitiesSync()` 返回 null → adapter 返回原始 raw | 降级为全量输出，功能正确 |
| 新增 entity（`addNote`） | `base[newId]` 为 undefined，`!== undefined` 成立，`modifiedBase` 中无该 key | 自动捕获为新增，无需特殊处理 |
| 删除 entity | `current` 中无该 key，`base` 中有 → 进入 `deleted` | 自动捕获 |
| store reset 后重新加载 | `_setEntities(cache)` 重新建立引用等价关系 | 引用关系自动恢复 |
| localStorage hydrate | entities 被 partialize 排除，始终从 loader 加载 | 不影响引用关系 |

#### 3.1.4 性能

adapter 内的引用比较是 O(n) 次指针比较（n = entity 总数）。对于 RedBook（~10K notes + ~500 users），单次 adapter 执行 < 1ms，远快于原来 JSON.stringify 全量 entities 的开销。

`_baseNotes` / `_baseUsers` 只包含**被修改的**已有 entity 的原始版本。典型任务中被修改的 entity 只有 1-5 个，因此额外开销极小。

`getAllStoreStates()` 已有引用缓存优化：store 状态引用不变时跳过 adapter 重算，只有 store 状态变化后才执行一次 diff。

#### 3.1.5 stateCache 失效语义

`getAllStoreStates()` 的缓存以 `store.getState()` 返回的引用为 key（参见 `createAppStore.ts` 中 `cached.rawRef === raw`）。adapter 依赖的外部数据是 `getEntitiesSync()`（loader cache）。

**为什么不需要手动 `invalidateStateCache`**：`_setEntities()` 调用 `set()` 必定改变 store 引用 → 缓存自动失效 → adapter 重算时读到最新的 loader cache。Reset 后重新加载也是同样流程。只要 `_setEntities` 和 `loadAll()` 在同一流程中执行（当前代码已如此），引用关系始终一致。

**何时需要 `invalidateStateCache('redbook')`**：仅当 adapter 依赖了 store 之外的、且不会触发 `store.set()` 的外部状态变化时。当前 RedBook adapter 不存在此情况。

### 3.2 OS 层 — Content 查询 API

#### 3.2.1 新增 `__SIM__.queryContentDB`

在 `os/OSContext.tsx` 的 `window.__SIM__` 中新增：

```typescript
queryContentDB: async (appId: string) => {
  if (window.__SIM__?.waitForData) {
    await window.__SIM__.waitForData([appId]);
  }
  const loaderImport = _loaderByAppId.get(appId);
  if (!loaderImport) return null;
  const mod = await loaderImport();
  if (typeof mod.getEntitiesSync === 'function') return mod.getEntitiesSync();
  if (typeof mod.getContentDB === 'function') return mod.getContentDB();
  return null;
},
```

> **注**：`_loaderByAppId` 已存在于 `OSContext.tsx`（通过 `import.meta.glob('../apps/*/data/loader.ts')` 构建），无需新建 registry。各 App loader 已有的 `getEntitiesSync()` 可直接复用。

#### 3.2.2 queryContentDB 的传输优化

`queryContentDB` 首次拉取的数据量大（RedBook ~15-20MB JSON），需复用 `_get_state` 的压缩传输路径：

```python
# bench_env/env/mobile_gym.py
async def get_content_db(self, app_id: str) -> dict | None:
    if app_id in self._content_cache:
        return self._content_cache[app_id]

    # 复用 gzip 压缩传输，避免大 payload 卡顿
    compressed_b64 = await self.page.evaluate(
        """async (id) => {
            const data = await window.__SIM__?.queryContentDB?.(id);
            if (!data) return null;
            const json = JSON.stringify(data);
            if (json.length < 100000) return { raw: data };
            const blob = new Blob([json]);
            const cs = new CompressionStream('gzip');
            const compressed = await new Response(
                blob.stream().pipeThrough(cs)
            ).arrayBuffer();
            const bytes = new Uint8Array(compressed);
            let binary = '';
            for (let i = 0; i < bytes.length; i++)
                binary += String.fromCharCode(bytes[i]);
            return { gz: btoa(binary) };
        }""",
        app_id,
    )
    if not compressed_b64:
        return None
    if "gz" in compressed_b64:
        import base64, gzip, json as json_mod
        raw = gzip.decompress(base64.b64decode(compressed_b64["gz"]))
        data = json_mod.loads(raw)
    else:
        data = compressed_b64.get("raw")

    if data:
        self._content_cache[app_id] = data
    return data
```

### 3.3 bench_env — 完整注入链路 + Accessor 改造

#### 3.3.1 `mobile_gym.py` 新增 content 缓存

```python
class MobileGymEnv:
    def __init__(self, ...):
        ...
        self._content_cache: dict[str, dict] = {}

    async def get_content_db(self, app_id: str) -> dict | None:
        """获取 App 的完整内容数据（首次从前端获取，后续走缓存）。"""
        if app_id in self._content_cache:
            return self._content_cache[app_id]
        # 实现见 §3.2.2
        ...

    def invalidate_content_cache(self, app_id: str | None = None) -> None:
        """清除 content 缓存。app_id=None 时清除全部。"""
        if app_id:
            self._content_cache.pop(app_id, None)
        else:
            self._content_cache.clear()
```

**缓存策略**：

- `env.reset()` 时**不清除** content cache（base 数据来自静态 JSON 文件，reset 只重置 store 状态）
- 如果 task 通过 `env.reset(overrides=...)` 覆盖了 `defaults.json`，且覆盖内容影响了 loader 的合并逻辑（如 `REDBOOK_CONFIG.sampleNotes` 变化），需在 `reset()` 中自动 invalidate 相关 app 的 cache
- 同一批次内同 app 的多个 task 共享 cache
- 切换到不同 app 批次时，可选择释放上一个 app 的 cache 以节省内存（~15-30MB per app）

#### 3.3.2 `JudgeInput` 扩展 + 完整注入链路

**`JudgeInput` 新增 `content_db` 字段**：

```python
# bench_env/task/judge.py
@dataclass
class JudgeInput:
    init_obs: Observation
    last_obs: Observation
    answer: str | None = None
    content_db: dict[str, dict] = field(default_factory=dict)  # appId → content

    def get_content(self, app_id: str) -> dict:
        """获取 App 的 base 内容数据。"""
        return self.content_db.get(app_id, {})
```

**`Evaluator` 注入 content_db**：

当前 `Evaluator._evaluate_with_state()` 只传了三个参数（`runner/base.py:65-72`），需要扩展：

```python
# bench_env/runner/base.py
class Evaluator:
    def __init__(self, judge_mode: str = "state", vlm_judge=None, env=None):
        self.judge_mode = judge_mode
        self.vlm_judge = vlm_judge
        self.env = env  # 持有 env 引用以访问 content_db

    async def evaluate(self, task, init_obs, last_obs, agent_message, episode=None):
        ...
        return await self._evaluate_with_state(task, init_obs, last_obs, agent_message)

    async def _evaluate_with_state(self, task, init_obs, last_obs, agent_message):
        # 按需获取 content_db（只在 task 涉及的 app 有大数据时才拉取）
        content_db = {}
        if self.env and hasattr(task, 'app') and task.app:
            content = await self.env.get_content_db(task.app)
            if content:
                content_db[task.app] = content

        judge_input = JudgeInput(
            init_obs=init_obs,
            last_obs=last_obs,
            answer=agent_message,
            content_db=content_db,
        )
        return task.evaluate(judge_input)
```

**调用链全貌**：

```
BaseRunner.run_episode()
  → Evaluator(env=env)              ← 创建时传入 env 引用
    → evaluator.evaluate(task, ...)
      → _evaluate_with_state()
        → env.get_content_db(task.app)   ← 按需拉取（有缓存）
        → JudgeInput(content_db=...)     ← 注入
          → task.evaluate(judge_input)
            → Redbook(state, content=input.get_content("redbook"))
```

**对无 content 的 App 的兼容**：`get_content_db()` 对不支持 `queryContentDB` 的 App 返回 None，`content_db` 为空 dict，`input.get_content("wechat")` 返回 `{}`。不影响现有非内容密集型 App 的任何行为。

#### 3.3.3 `redbook/app.py` Accessor 改造

```python
from functools import cached_property

class Redbook(BaseApp):
    """
    state:   来自 getState()，只含 user/settings/chats + _modifiedNotes/_modifiedUsers
    content: 来自 queryContentDB()，完整的 base 内容（notesById, usersById, feedIds, userIds）
    """

    def __init__(self, state, content=None, init=None, init_content=None):
        super().__init__(state, init)
        self._content = content or {}
        self._init_content = init_content or content
        if init is not None:
            self._init_instance = None  # lazy

    @property
    def init(self) -> "Redbook":
        if self._init_state is None:
            raise ValueError("No init state provided")
        if self._init_instance is None:
            self._init_instance = Redbook(self._init_state, content=self._init_content)
        return self._init_instance

    # ---- 合并视图（带实例级缓存，避免重复 dict copy）----

    @cached_property
    def notes_by_id(self) -> dict[str, dict]:
        """base + modified 合并后的全量帖子。"""
        merged = dict(self._content.get("notesById", {}))
        merged.update(self.get("_modifiedNotes", {}))
        for nid in self.get_list("_deletedNoteIds"):
            merged.pop(nid, None)
        return merged

    @cached_property
    def users_by_id(self) -> dict[str, dict]:
        """base + modified 合并后的全量用户。"""
        merged = dict(self._content.get("usersById", {}))
        merged.update(self.get("_modifiedUsers", {}))
        for uid in self.get_list("_deletedUserIds"):
            merged.pop(uid, None)
        return merged

    @property
    def feed_ids(self) -> list[str]:
        """feedIds 直接从 getState 读取（含新帖插入）。"""
        return self.get_list("feedIds")

    # ---- 新增/修改分类 ----

    @property
    def new_notes(self) -> list[dict]:
        """Agent 新发布的帖子（不在 base 中的 ID）。"""
        base_ids = set(self._content.get("notesById", {}).keys())
        return [
            note for nid, note in self.get("_modifiedNotes", {}).items()
            if nid not in base_ids
        ]

    @property
    def modified_existing_notes(self) -> list[dict]:
        """被修改的已有帖子（在 base 中存在的 ID，如被点赞/评论的帖子）。"""
        base_ids = set(self._content.get("notesById", {}).keys())
        return [
            note for nid, note in self.get("_modifiedNotes", {}).items()
            if nid in base_ids
        ]

    @property
    def new_users(self) -> list[dict]:
        """新增的用户。"""
        base_ids = set(self._content.get("usersById", {}).keys())
        return [
            user for uid, user in self.get("_modifiedUsers", {}).items()
            if uid not in base_ids
        ]

    # ---- 查询方法 ----

    def get_note(self, note_id: str) -> dict | None:
        modified = self.get("_modifiedNotes", {}).get(note_id)
        if modified:
            return modified
        return self._content.get("notesById", {}).get(note_id)

    def get_user_entity(self, user_id: str) -> dict | None:
        modified = self.get("_modifiedUsers", {}).get(user_id)
        if modified:
            return modified
        return self._content.get("usersById", {}).get(user_id)

    def find_note_by_keyword(self, keyword: str) -> dict | None:
        """在全量帖子（base + modified）中按关键词查找。"""
        k = keyword.lower()
        for note in self.notes_by_id.values():
            title = (note.get("title") or "").lower()
            content = (note.get("content") or "").lower()
            category = (note.get("category") or "").lower()
            if k in title or k in content or k in category:
                return note
        return None

    def find_new_note_by_keyword(self, keyword: str) -> dict | None:
        """仅在 Agent 新发布的帖子中按关键词查找。"""
        k = keyword.lower()
        for note in self.new_notes:
            title = (note.get("title") or "").lower()
            content = (note.get("content") or "").lower()
            if k in title or k in content:
                return note
        return None

    def find_user_by_name(self, name: str) -> dict | None:
        name_lower = name.lower()
        all_user_ids = self._content.get("userIds", [])
        for uid in all_user_ids:
            user = self.get_user_entity(uid)
            if user and name_lower in (user.get("name") or "").lower():
                return user
        return None

    # note_has_comment, note_has_reply, chat_has_message 等
    # 内部调用 get_note()，自动走合并逻辑，接口签名不变
```

> **`cached_property` 说明**：`notes_by_id` 和 `users_by_id` 使用 `@cached_property`，每个 Accessor 实例只做一次 `dict(base) + update` 合并。Accessor 是短生命周期对象（task judge 中临时创建），不存在缓存过期问题。

#### 3.3.4 Task 中构造 Accessor 的改动

```python
# 改造前：
rb = Redbook(input.apps.get("redbook", {}))

# 改造后：
rb = Redbook(
    input.apps.get("redbook", {}),
    content=input.get_content("redbook"),
)

# 带 init 对比的：
rb = Redbook(
    input.apps.get("redbook", {}),
    content=input.get_content("redbook"),
    init=input.apps_init.get("redbook", {}),
)
```

#### 3.3.5 expected_changes 路径迁移清单

以下是 `bench_env/task/redbook/tasks.py` 中所有需要迁移的路径（已审计全部 Task）：

| Task 类 | 旧路径 | 新路径 |
|---------|--------|--------|
| `UnlikeFirstLikedNote` | `entities.notesById.{target}` | `_modifiedNotes.{target}` |
| `CommentOnSearchNote` | `entities.notesById.{note_id}` | `_modifiedNotes.{note_id}` |
| `ReplyToCommentInSearch` | `entities.notesById.{note_id}` | `_modifiedNotes.{note_id}` |
| `BatchReplyFeedNotes` | `entities.notesById.{nid}`（循环） | `_modifiedNotes.{nid}`（循环） |
| `PublishOotdNote` | `entities.notesById`（整体） | `_modifiedNotes` |
| `ComplexSearchLikeFollowDM` | `entities.notesById.{note_id}` | `_modifiedNotes.{note_id}` |
| `ComplexSearchLikeFollowDM` | `entities.usersById.{author_id}` | `_modifiedUsers.{author_id}` |
| `InteractFeedKeywordNote` | `entities.notesById.{nid}`（循环） | `_modifiedNotes.{nid}`（循环） |

**不变的路径**：`user.*`、`feedIds`、`history`、`homeState`、`chats`、`publishDraft`、`settings.*`。

**`redbook/app.py` Accessor 中需更新的 property**（见 §3.3.3，已完整列出）：

| 旧实现 | 新实现 |
|--------|--------|
| `self.entities.get("notesById", {})` | `base + _modifiedNotes 合并`（cached_property） |
| `self.entities.get("usersById", {})` | `base + _modifiedUsers 合并`（cached_property） |
| `self.get_list("userIds")` | `self._content.get("userIds", [])`（来自 content_db） |

#### 3.3.6 Task 判题模式

`_modifiedNotes` 同时包含**新增的帖子**和**被修改的已有帖子**（如被点赞/评论的帖子）。Task 判题时需根据任务类型选择合适的查询方式：

**确定 ID 的操作任务**（如"给 note_42 点赞"）→ 直接用 `expected_changes`：

```python
expected_changes = [
    "_modifiedNotes.note_42",
    "_baseNotes.note_42",
    "user.likedNotes",
]
```

> 注意：`_baseNotes.note_42` 也需列入 expected_changes——adapter 输出了修改前的原始版本，diff 时会检测到该字段从无到有。

**动态 ID 的创作任务**（如"发一条关于美食的帖子"）→ 用自定义 judge + 语义方法：

```python
class PublishFoodNote(CriteriaTask):
    def judge(self, input: JudgeInput) -> JudgeResult:
        rb = Redbook(
            input.apps.get("redbook", {}),
            content=input.get_content("redbook"),
        )

        food_note = rb.find_new_note_by_keyword("美食")
        if not food_note:
            return JudgeResult(passed=False, reason="未发布美食相关帖子")

        if len(rb.new_notes) > 1:
            return JudgeResult(
                passed=True,
                warning=f"发布了 {len(rb.new_notes)} 条帖子，预期 1 条",
            )

        return JudgeResult(passed=True)
```

**区分新增 vs 修改**的判断完全在 Accessor 层完成（对比 `_modifiedNotes` 的 key 是否存在于 base content 中），Task 代码只需调用 `rb.new_notes` / `rb.modified_existing_notes`。

### 3.4 side-effect 检测粒度分析

#### 3.4.1 问题

`StateComparator.diff_states()` 递归对比 init 和 final 状态。改造后存在一个粒度退化场景：

**改造前**（entities 完整输出）：
```
init: entities.notesById.note_42 = { likes: 100, title: "原标题" }
final: entities.notesById.note_42 = { likes: 101, title: "被篡改" }
→ diff 递归对比，分别检测到 likes 变化（预期）和 title 变化（非预期 → warning）
```

**改造后**（如果不做 _baseNotes 补齐）：
```
init: _modifiedNotes = {}
final: _modifiedNotes.note_42 = { likes: 101, title: "被篡改", ... }
→ diff 检测到 _modifiedNotes.note_42: None → {完整对象}（作为一个 addition）
→ expected_changes = ["_modifiedNotes.note_42.likes"]
→ _is_expected() 反向匹配成功：整个 note_42 被标记为 expected
→ title 篡改无法检测！
```

**根因**：init 的 `_modifiedNotes` 中没有该 entity（init 时它未被修改），diff 无法做 dict-vs-dict 的字段级递归比较。

#### 3.4.2 解决方案：bench_env 侧预处理补齐

利用 adapter 输出的 `_baseNotes` 字段，在 `StateComparator.diff_states()` 之前预处理 init 状态。当 final 的 `_modifiedNotes` 中出现某个 key 而 init 的 `_modifiedNotes` 中没有时，从 final 的 `_baseNotes` 读取该 entity 的原始版本，注入 init 的 `_modifiedNotes` 中：

```python
# bench_env/task/base.py — BaseTask.evaluate() 中，diff_states 之前
def _patch_init_for_entity_diff(
    init_apps: dict, curr_apps: dict, app_id: str
) -> None:
    """
    补齐 init 侧的 _modifiedNotes/_modifiedUsers，使 diff 能做字段级对比。
    直接修改 init_apps（浅拷贝后），不影响原始 init_obs。
    """
    curr_app = curr_apps.get(app_id, {})
    init_app = init_apps.get(app_id, {})

    for mod_key, base_key in [
        ("_modifiedNotes", "_baseNotes"),
        ("_modifiedUsers", "_baseUsers"),
    ]:
        curr_modified = curr_app.get(mod_key, {})
        init_modified = init_app.get(mod_key, {})
        base_data = curr_app.get(base_key, {})

        for entity_id in curr_modified:
            if entity_id not in init_modified and entity_id in base_data:
                if mod_key not in init_app:
                    init_app[mod_key] = {}
                init_app[mod_key][entity_id] = base_data[entity_id]
```

**补齐后的 diff 过程**：
```
init: _modifiedNotes.note_42 = { likes: 100, title: "原标题" }   ← 从 _baseNotes 补齐
final: _modifiedNotes.note_42 = { likes: 101, title: "被篡改" }
→ diff 递归对比：likes 100→101（预期），title "原标题"→"被篡改"（非预期 → warning）✅
```

**对 `_baseNotes` / `_baseUsers` 自身的 always_ignore**：

`_baseNotes` / `_baseUsers` 是纯辅助字段，用于预处理后即可丢弃，不应触发 unexpected change 告警：

```python
# bench_env/task/base.py
always_ignore: ClassVar[list[str]] = [
    "os.time",
    "os.isLauncherVisible",
    "os.runningApps",
    "os.activeAppId",
    "apps.*._temp",
    "apps.*._baseNotes",      # 辅助字段，预处理后不检查
    "apps.*._baseUsers",
    "apps.*._deletedNoteIds",  # 删除记录
    "apps.*._deletedUserIds",
]
```

---

## 四、getState 输出大小对比

### 改造前（RedBook）

```json
{
  "user": { "likedNotes": [...], ... },
  "entities": {
    "notesById": { "note_0": { "完整帖子" }, "...": "...", "note_9999": { "完整帖子" } },
    "usersById": { "u1": { "完整用户" }, "...": "...", "u500": { "完整用户" } }
  },
  "feedIds": ["note_0", "...", "note_9999"],
  "userIds": ["u1", "...", "u500"],
  "settings": { "..." : "..." },
  "chats": ["..."],
  "history": ["..."]
}
// → ~400K 行
```

### 改造后

```json
{
  "user": { "likedNotes": ["..."], "..." : "..." },
  "feedIds": ["note_new", "note_0", "...", "note_9999"],
  "_modifiedNotes": {
    "note_2": { "id": "note_2", "likes": 3422, "..." : "..." },
    "note_new": { "id": "note_new", "title": "今日穿搭", "..." : "..." }
  },
  "_modifiedUsers": {
    "u3": { "id": "u3", "followers": 891, "..." : "..." }
  },
  "_baseNotes": {
    "note_2": { "id": "note_2", "likes": 3421, "..." : "..." }
  },
  "_baseUsers": {
    "u3": { "id": "u3", "followers": 890, "..." : "..." }
  },
  "_deletedNoteIds": [],
  "_deletedUserIds": [],
  "settings": { "..." : "..." },
  "chats": ["..."],
  "history": ["..."]
}
// → ~数百行（modified/base 各 1-5 条 entity，远小于全量 10K+）
```

> **注意**：`feedIds` 仍然完整输出（几千个字符串 ID），因为新帖会插入其中，bench_env 需要验证帖子是否在 feed 中。
> `feedIds` 是纯 string 数组（无 id field），`StateComparator` 会回退到按索引比较。如果新帖插入 feed 头部，所有索引偏移会产生大量 diff entry。这在改造前也存在相同问题，暂不在本方案范围内优化。后续可考虑输出 feedIds delta（`_addedFeedIds` / `_removedFeedIds`）。

---

## 五、实施步骤

> **⚠️ 原子交付要求**：Phase 1-4 是一个**不可分割的交付单元**。单独发布 Phase 1-3（前端 adapter）而不同步发布 Phase 4（bench_env 适配）会导致所有 redbook task 判题失败——因为 adapter 移除了 `entities` 输出，而 task 仍在读 `entities.notesById.*` 路径。
>
> 回退时同理：回退 adapter 必须同时回退 bench_env 路径。

```
Phase 1: OS 层基础设施
         - createAppStore.ts 新增 diffEntities() + EntityDiffResult
         - OSContext.tsx 新增 __SIM__.queryContentDB()
         改动：2 个文件

Phase 2: RedBook 前端 adapter
         - state.ts 末尾新增 stateAdapter 注册（~15 行）
         Store schema / actions / partialize：零改动
         前端 UI 代码：零改动

Phase 3: bench_env 适配（与 Phase 2 同步发布）
         a) mobile_gym.py:
            - 新增 get_content_db() + gzip 压缩传输 + 缓存
            - 新增 invalidate_content_cache()
         b) runner/base.py:
            - Evaluator.__init__ 接受 env 参数
            - _evaluate_with_state 按需获取 content_db，注入 JudgeInput
         c) task/judge.py:
            - JudgeInput 新增 content_db 字段 + get_content() 方法
         d) task/base.py:
            - always_ignore 新增 _baseNotes/_baseUsers/_deletedNoteIds/_deletedUserIds
            - evaluate() 中 diff 前调用 _patch_init_for_entity_diff()
         e) task/redbook/app.py:
            - Accessor 全面改造（content 注入 + 合并视图 + cached_property）
         f) task/redbook/tasks.py:
            - 全部 8 处 expected_changes 路径迁移
            - 全部 Accessor 构造函数增加 content 参数

Phase 4: 验证
         - 跑全部 redbook 任务确认 pass
         - 对比 getState payload 大小
         - 验证 side-effect 检测粒度（构造一个修改 likes + title 的 case，确认 title 被报为 unexpected）

Phase 5: 推广（可选，每个 App 独立交付）
         - X: 同样模式（diffEntities 对比 posts/users）
         - Reddit: 同样模式（diffEntities 对比 posts）
```

---

## 六、风险与回退

| 风险 | 严重度 | 缓解 |
|------|--------|------|
| loader 未就绪时 adapter 获取不到 base | 低 | `getEntitiesSync()` 返回 null → 降级为全量输出，功能正确 |
| Phase 2 与 Phase 3 未同步发布 | **高** | 原子交付（见 §5），CI 中为 redbook task 增加端到端测试 |
| bench_env content cache 过期 | 低 | `reset(overrides=...)` 时自动 invalidate；无 override 时 base 不变 |
| queryContentDB 首次拉取卡顿 | 中 | 复用 gzip 压缩传输（§3.2.2），~15MB JSON → ~2-3MB gzip |
| side-effect 检测粒度退化 | 中 | `_baseNotes` 预处理方案（§3.4）恢复字段级 diff |
| entity 删除未检测 | 低 | `diffEntities` 返回 `deleted` 列表 + adapter 输出 `_deletedNoteIds`（§3.1.1） |
| 引用相等性被意外破坏 | 极低 | 降级为全量输出（所有 entry 引用不等 = 全部输出），功能正确但性能无优化。现有代码均使用标准不可变更新，不存在此风险 |
| content cache 内存消耗 | 低 | 单个 App ~15-30MB，切换 App 批次时释放上一个 cache |
| feedIds diff 产生大量 diff entry | 中 | 改造前同样存在，非本方案引入。后续可优化为 delta 输出 |
| 其他 App 改造遗漏 | 低 | 每个 App 独立改造（Phase 5），不影响已有 App |

**回退策略**：
1. 移除 `apps/RedBook/state.ts` 末尾的 `registerStateAdapter('redbook', ...)` 调用
2. 回退 `bench_env/task/redbook/tasks.py` 中的 `expected_changes` 路径（`_modifiedNotes.*` → `entities.notesById.*`）
3. 回退 `bench_env/task/redbook/app.py` 中的 Accessor（移除 content 参数，恢复 `self.entities` 访问）

Store 无需回退（因为 store 没有改动）。OS 层新增的 `diffEntities` 和 `queryContentDB` 可保留（不影响任何现有行为）。

---

## 七、与相关方案的对比

| 方案 | 前端改动 | UI 改动 | bench_env 改动 | 概念模型 |
|------|---------|---------|---------------|---------|
| ❌ overlay 重构 | store 全面重构 | 8 个页面 | accessor 重写 | base 不可变 + overlay（人为抽象） |
| ❌ getState 按路径查询 | 新增查询 API | 无 | 大量改造 | 无全量快照，逐字段查询 |
| ❌ entities 从 store 移出 | store + UI 全面重构 | 全部页面 | accessor 重写 | 分离缓存 |
| ❌ 手动脏标记 + stateAdapter | 6 行标记 + adapter | 无 | accessor 适配 | 正常可变 store + 手动追踪变化 |
| ❌ `__SIM__.getState({ mode })` 协议 | OS 层新增模式协议 | 无 | 统一适配 | OS 层感知 app 内部结构 |
| ❌ JSON Patch / op-log 增量流 | store middleware | 无 | patch 重放 | 首次全量 + 后续增量 |
| ✅ **引用 diff + stateAdapter** | **仅 adapter（~15 行）** | **无** | accessor 适配 | 正常可变 store + 自动检测变化 |

### 引用 diff 相比手动脏标记的优势

| 维度 | 手动脏标记 | 引用 diff |
|------|-----------|-----------|
| Store schema 改动 | 新增 `_dirtyNoteIds` / `_dirtyUserIds` | **零改动** |
| Action 改动 | 每个 action 加一行 | **零改动** |
| partialize 改动 | 需排除脏标记字段 | **零改动** |
| 漏标记风险 | 有（新增 action 忘加标记 → 静默丢失） | **无**（自动检测） |
| 性能 | O(1) 查 dirty set | O(n) 引用比较，n=entity 数量，< 1ms |
| 新增 action 维护成本 | 每个新 action 必须记得加标记 | **零维护** |
| 回退复杂度 | 删 adapter + 删脏标记字段 + 恢复 actions | **只删 adapter** |

### 不采用 `getState({ mode })` 协议的理由

统一协议理论上更优雅，但：
- 需要 OS 层理解每个 App 的"哪些字段是 entities"——目前 OS 层对 App 状态结构完全透明
- 打破了 `stateAdapter` 的简洁模型（adapter 由 App 自己注册，OS 不需要知道细节）
- 当前仅 3 个 App 需要 compact 输出，ROI 不足
- 如果未来超过 5 个 App 需要，再考虑统一协议

### 不采用 JSON Patch / op-log 的理由

理论最优性能（首次全量，后续只传 patch），但：
- 需要 store middleware 拦截每次 `set()` 生成 patch
- 需要 bench_env 端实现 patch 重放和状态重建
- 需要处理 reset/hydration 时的 patch 流重置
- 需要调试工具查看累积 patch
- 当前方案已可将 payload 从 ~400K 行降到 ~数百行，足以解决实际问题
