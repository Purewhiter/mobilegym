# Store 框架改进：单一数据源 + 自动 CRUD（V2）

> 基于 [原方案](../.cursor/plans/store_immer_auto-patch_c99b43da.plan.md) 的改进版。
> 去掉 immer 全局中间件，聚焦纯函数 `patch` + 更完整的 CRUD 覆盖。

## 核心问题（不变）

22 个 App 存在三类 state 管理问题：

- **数据源不一致** — `defaults.json` / `types.ts` / `state.ts` 三处定义同一结构
- **样板代码多** — 13 个 App 手写 `updateSettings`、`updatePrivacy` 等嵌套 shallow-merge
- **无统一 CRUD** — 17 个 App 在 state.ts 中重复 `.filter()` / `.map()` / `[...arr, item]` 模式

## 与原方案的关键差异

| 维度 | 原方案 | V2 |
|------|--------|-----|
| 中间件 | 全局 immer（+6-8KB gzip，每次 set 创建 Proxy） | **无新依赖**，纯函数 deepMerge |
| `findItem` | 注入到 store actions | **移除** — 违反项目 §5.3 查询型 getter 禁令 |
| 数组覆盖 | 仅顶层数组 `ArrayKeys<S>` | 新增 **`Record<string, T[]>` 操作**（覆盖 Reddit/Wechat 等高频模式） |
| deepMerge 数组语义 | 未明确 | **数组整体替换，不递归** |
| 注入方式 | 全量注入所有 CRUD | **按需声明** `arrayFields` / `recordArrayFields` |
| `set` 签名 | 改为 immer draft 模式 | **不改变**，现有 `set({ ... })` 和 `set(state => ({ ... }))` 完全不受影响 |

---

## 目标架构

```
defaults.json ──satisfies──▶ types.ts（可选）
      │
      ▼ initialState
createAppStoreWithActions(appId, state, actions, options?)
      │
      ├─▶ patch(deepPartial)          ← 自动注入，替代所有 updateXxx 样板
      ├─▶ insertItem / removeItem / updateItem   ← 按需注入，顶层数组
      ├─▶ insertRecord / removeRecord / updateRecord ← 按需注入，Record<string, T[]>
      └─▶ App 业务 action             ← 只写框架 CRUD 覆盖不了的逻辑
```

**看 `defaults.json` 就知道 `getState()` 返回什么。**

---

## 1. `patch` — 深层嵌套更新（自动注入）

替代所有 `updateSettings`、`updatePrivacy`、`updateProfilePrivacy`、`updateNotifications`、`updateReaderPrefs`、`updateUser` 等样板。

### 语义

```typescript
patch({ settings: { privacy: { requireFollowRequest: true } } })
// 等价于手写:
// set({ settings: { ...state.settings, privacy: { ...state.settings.privacy, requireFollowRequest: true } } })
```

### deepMerge 规则

1. **原始值** — 直接替换
2. **普通对象** — 递归合并（只处理 updates 中出现的 key）
3. **数组** — **整体替换，不做元素级合并**（数组增删改由 CRUD API 负责）
4. **null / undefined** — 显式 `null` 替换目标值，`undefined` 跳过（不删除）

### 实现：`os/deepMerge.ts`

```typescript
export type DeepPartial<T> = T extends (infer E)[]
  ? E[]  // 数组不递归，整体替换
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

/** 纯函数 deepMerge，返回新对象（保持 zustand 不可变约定） */
export function deepMerge<T extends Record<string, any>>(
  target: T,
  source: DeepPartial<T>,
): T {
  const result = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sv = source[key];
    if (sv === undefined) continue;
    const tv = target[key];
    if (
      sv !== null &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      tv !== null &&
      typeof tv === 'object' &&
      !Array.isArray(tv)
    ) {
      result[key] = deepMerge(tv, sv as any);
    } else {
      result[key] = sv as any;
    }
  }
  return result;
}
```

---

## 2. 顶层数组 CRUD（按需注入）

适用于 state 中顶层为数组的字段，如 `shelf: ShelfItem[]`、`contacts: Contact[]`、`readingRecords: ReadingRecord[]`。

### API

```typescript
insertItem('shelf', newItem)                                 // 尾部追加
insertItem('shelf', newItem, 'prepend')                      // 头部插入
removeItem('shelf', item => item.bookId === 'x')             // 按条件删除
updateItem('shelf', item => item.bookId === 'x', { isPrivate: true }) // 按条件更新
```

### 类型

```typescript
type ArrayKeys<S, Fields extends readonly (keyof S)[]> = Fields[number];

type ArrayElement<S, K extends keyof S> = S[K] extends (infer E)[] ? E : never;

type ArrayCRUD<S, Fields extends readonly (keyof S)[]> = {
  insertItem: <K extends ArrayKeys<S, Fields>>(
    field: K, item: ArrayElement<S, K>, position?: 'append' | 'prepend',
  ) => void;
  removeItem: <K extends ArrayKeys<S, Fields>>(
    field: K, predicate: (item: ArrayElement<S, K>) => boolean,
  ) => void;
  updateItem: <K extends ArrayKeys<S, Fields>>(
    field: K,
    predicate: (item: ArrayElement<S, K>) => boolean,
    updates: Partial<ArrayElement<S, K>>,
  ) => void;
};
```

`Fields` 由调用方显式声明（见下文 §5），避免给 Calculator 等无数组字段的 App 注入无用方法。

---

## 3. Record 数组 CRUD（按需注入）— 新增

覆盖 `Record<string, T[]>` 模式 — 这是原方案未解决但**样板最密集**的场景：

| App | 字段 | 当前样板行数 |
|-----|------|-------------|
| Reddit | `userCommentsByPostId: Record<string, UserComment[]>` | ~80 行（addComment / addReply / editComment / deleteOwnComment） |
| Reddit | `chatThreadsByUsername: Record<string, ChatMessage[]>` | ~40 行（sendChat / deleteChat / seedChat） |
| Wechat | 会话内消息操作 | ~60 行 |

### API

```typescript
insertRecord('chatThreadsByUsername', username, newMsg)
insertRecord('chatThreadsByUsername', username, newMsg, 'prepend')
removeRecord('chatThreadsByUsername', username, m => m.id === msgId)
updateRecord('userCommentsByPostId', postId, c => c.id === cid, { body: newBody })
```

### 类型

```typescript
type RecordArrayKeys<S, Fields extends readonly (keyof S)[]> = Fields[number];

type RecordArrayElement<S, K extends keyof S> =
  S[K] extends Record<string, (infer E)[]> ? E : never;

type RecordArrayCRUD<S, Fields extends readonly (keyof S)[]> = {
  insertRecord: <K extends RecordArrayKeys<S, Fields>>(
    field: K, key: string, item: RecordArrayElement<S, K>,
    position?: 'append' | 'prepend',
  ) => void;
  removeRecord: <K extends RecordArrayKeys<S, Fields>>(
    field: K, key: string, predicate: (item: RecordArrayElement<S, K>) => boolean,
  ) => void;
  updateRecord: <K extends RecordArrayKeys<S, Fields>>(
    field: K, key: string,
    predicate: (item: RecordArrayElement<S, K>) => boolean,
    updates: Partial<RecordArrayElement<S, K>>,
  ) => void;
};
```

### 实现

```typescript
insertRecord: (field, key, item, position = 'append') => {
  set(state => {
    const record = (state as any)[field] ?? {};
    const list = Array.isArray(record[key]) ? record[key] : [];
    return {
      [field]: {
        ...record,
        [key]: position === 'prepend' ? [item, ...list] : [...list, item],
      },
    } as any;
  });
},

removeRecord: (field, key, pred) => {
  set(state => {
    const record = (state as any)[field] ?? {};
    const list = Array.isArray(record[key]) ? record[key] : [];
    return { [field]: { ...record, [key]: list.filter((i: any) => !pred(i)) } } as any;
  });
},

updateRecord: (field, key, pred, updates) => {
  set(state => {
    const record = (state as any)[field] ?? {};
    const list = Array.isArray(record[key]) ? record[key] : [];
    return {
      [field]: {
        ...record,
        [key]: list.map((i: any) => pred(i) ? { ...i, ...updates } : i),
      },
    } as any;
  });
},
```

---

## 4. `defaults.json` 与 types 的一致性（不变）

**方案：`satisfies` 编译期校验**

```typescript
// data/index.ts — 有手写 types 的 App
import defaults from './defaults.json';
import type { WechatReadingState } from '../types';
export const WECHAT_READING_CONFIG = defaults satisfies WechatReadingState;

// data/index.ts — 简单 App，零类型定义
import defaults from './defaults.json';
export const SIMPLE_CONFIG = defaults;
// state.ts 中: typeof defaults 直接推导
```

---

## 5. 改造 `createAppStoreWithActions`

### 新签名

```typescript
export function createAppStoreWithActions<
  S extends Record<string, any>,
  A extends { [K in keyof A]: (...args: any[]) => any },
  AF extends readonly (keyof S)[] = [],    // arrayFields
  RF extends readonly (keyof S)[] = [],    // recordArrayFields
>(
  appId: string,
  initialState: S,
  actionCreator: (
    set: (partial: Partial<S & A> | ((state: S & A) => Partial<S & A>)) => void,
    get: () => S & A & { patch: (u: DeepPartial<S>) => void },
  ) => A,
  options?: {
    persistName?: string;
    partialize?: (state: S & A) => Partial<S>;
    afterHydration?: () => void;
    arrayFields?: AF;         // 声明哪些字段需要数组 CRUD
    recordArrayFields?: RF;   // 声明哪些字段需要 Record 数组 CRUD
  },
): UseBoundStore<StoreApi<
  S & A
  & { patch: (updates: DeepPartial<S>) => void }
  & (AF extends [] ? {} : ArrayCRUD<S, AF>)
  & (RF extends [] ? {} : RecordArrayCRUD<S, RF>)
>>;
```

### 实现核心逻辑

```typescript
const store = create<S & A & AutoActions>()(
  persist(
    (set, get) => {
      // --- patch（始终注入）---
      const patch = (updates: DeepPartial<S>) => {
        set(state => deepMerge(state, updates) as any);
      };

      // --- 数组 CRUD（按 arrayFields 注入）---
      const arrayCrud: Record<string, any> = {};
      if (options?.arrayFields?.length) {
        arrayCrud.insertItem = (field: any, item: any, position = 'append') => {
          set(state => ({
            [field]: position === 'prepend'
              ? [item, ...(state as any)[field]]
              : [...(state as any)[field], item],
          } as any));
        };
        arrayCrud.removeItem = (field: any, pred: any) => {
          set(state => ({ [field]: (state as any)[field].filter((i: any) => !pred(i)) } as any));
        };
        arrayCrud.updateItem = (field: any, pred: any, updates: any) => {
          set(state => ({
            [field]: (state as any)[field].map(
              (i: any) => pred(i) ? { ...i, ...updates } : i,
            ),
          } as any));
        };
      }

      // --- Record 数组 CRUD（按 recordArrayFields 注入）---
      const recordCrud: Record<string, any> = {};
      if (options?.recordArrayFields?.length) {
        // ... 同 §3 实现
      }

      const actions = actionCreator(set as any, get as any);

      return {
        ...initialState,
        ...actions,
        patch,
        ...arrayCrud,
        ...recordCrud,
      };
    },
    { name: persistName, storage, partialize },
  ),
);
```

**`set` 签名不变** — 现有 22 个 App 的所有 action 无需任何修改即可继续工作。

---

## 6. 运行时扩展字段（不变）

```typescript
// _temp：不持久化的 UI 临时状态
createAppStoreWithActions('wechat_reading',
  { ...defaults, _temp: { audioSubTab: 'audio' as const } },
  (set, get) => ({ ... }),
);

// 动态数据源
createAppStoreWithActions('reddit',
  { ...defaults, posts: getPostsSync() ?? [] },
  ...
);
```

---

## 7. 迁移示范：WechatReading

### Before（284 行，6 个样板 updater）

```typescript
// 6 个嵌套 shallow-merge 函数（第 91-119 行）
updateUserProfile: (updates) => { set({ user: { ...get().user, ...updates } }); },
updateSettings: (updates) => { set({ settings: { ...get().settings, ...updates } }); },
updatePrivacy: (updates) => { /* 3 层展开 */ },
updateProfilePrivacy: (updates) => { /* 4 层展开 */ },
updateNotifications: (updates) => { /* 3 层展开 */ },
updateReaderPrefs: (updates) => { set({ readerPrefs: { ...get().readerPrefs, ...updates } }); },

// 数组操作
removeFromShelf: (bookId) => { set({ shelf: shelf.filter(item => item.bookId !== bookId) }); },
togglePrivate: (bookIds, isPrivate) => { set({ shelf: shelf.map(item => ...) }); },
```

### After（约 80 行）

```typescript
export const useWechatReadingStore = createAppStoreWithActions(
  'wechat_reading',
  { ...defaults, _temp: { audioSubTab: 'audio' as const } },
  (set, get) => ({
    // 只保留框架 CRUD 覆盖不了的业务逻辑
    addToBookshelf: (bookId: string) => {
      if (get().shelf.some(i => i.bookId === bookId)) return;
      get().patch({
        bookProgress: {
          ...get().bookProgress,
          [bookId]: get().bookProgress[bookId] ?? {
            bookId, charOffset: 0, lastReadAt: TimeService.getISOString(),
          },
        },
      });
      get().insertItem('shelf', {
        bookId, isPrivate: false, addedAt: TimeService.getISOString(),
      }, 'prepend');
    },

    updateProgress: (bookId: string, charOffset: number) => {
      get().patch({
        bookProgress: {
          ...get().bookProgress,
          [bookId]: { bookId, charOffset, lastReadAt: TimeService.getISOString() },
        },
      });
    },

    addReadingRecord: (bookId: string, duration: number) => {
      if (duration <= 0) return;
      get().insertItem('readingRecords', {
        id: `record_${TimeService.now()}_${bookId}_${++localSeq}`,
        bookId, date: TimeService.getToday(), duration,
        timestamp: TimeService.getISOString(),
      });
    },

    toggleFollow: (userId: string) => {
      const { user } = get();
      const isFollowing = user.following.includes(userId);
      get().patch({
        user: {
          following: isFollowing
            ? user.following.filter((id: string) => id !== userId)
            : [...user.following, userId],
        },
      });
    },

    refreshRecommendedAudiobooks: () => { /* ... */ },
    setAudioSubTab: (tab) => set(s => ({ _temp: { ...s._temp, audioSubTab: tab } })),
  }),
  {
    arrayFields: ['shelf', 'readingRecords'] as const,
  },
);
```

### 组件调用变化

```typescript
// ── 嵌套设置更新 ──

// Before: 每种层级一个 updater
const updatePrivacy = useStore(s => s.updatePrivacy);
updatePrivacy({ requireFollowRequest: true });

// After: 统一 patch，任意深度
const patch = useStore(s => s.patch);
patch({ settings: { privacy: { requireFollowRequest: true } } });


// ── 数组操作 ──

// Before: 手写 filter
const { shelf } = useStore(s => s);
set({ shelf: shelf.filter(item => item.bookId !== 'x') });

// After: CRUD API
const removeItem = useStore(s => s.removeItem);
removeItem('shelf', i => i.bookId === 'x');


// ── 查询操作（不注入 store，按规范在组件内完成）──

// 在组件 selector 中直接派生
const isOnShelf = useStore(s => s.shelf.some(i => i.bookId === bookId));

// 命令式场景
const item = useWechatReadingStore.getState().shelf.find(i => i.bookId === 'x');
```

---

## 8. 迁移示范：Reddit（展示 Record CRUD 价值）

### Before: addComment（167-185 行）

```typescript
addComment: (postId, body) => {
  const trimmed = body.trim();
  if (!trimmed) return;
  const s = get();
  const newComment = { id: nextLocalId(), author: s.user.username, body: trimmed, score: 1, ... };
  const prevList = Array.isArray(s.userCommentsByPostId[postId]) ? s.userCommentsByPostId[postId] : [];
  set({
    userCommentsByPostId: {
      ...s.userCommentsByPostId,
      [postId]: [...prevList, newComment],
    },
  });
},
```

### After: 用 insertRecord

```typescript
addComment: (postId, body) => {
  const trimmed = body.trim();
  if (!trimmed) return;
  get().insertRecord('userCommentsByPostId', postId, {
    id: nextLocalId(),
    author: get().user.username,
    body: trimmed,
    score: 1,
    created_utc: Math.floor(TimeService.now() / 1000),
  });
},
```

### 同理

```typescript
// Before: editComment（6 行展开）
editComment: (postId, commentId, body) => {
  const s = get();
  const prevList = Array.isArray(s.userCommentsByPostId[postId]) ? s.userCommentsByPostId[postId] : [];
  const nextList = prevList.map(c => c.id === commentId ? { ...c, body: body.trim() } : c);
  set({ userCommentsByPostId: { ...s.userCommentsByPostId, [postId]: nextList } });
},

// After: 1 行
editComment: (postId, commentId, body) => {
  get().updateRecord('userCommentsByPostId', postId, c => c.id === commentId, { body: body.trim() });
},

// Before: deleteChatMessage（5 行展开）
deleteChatMessage: (username, messageId) => {
  const s = get();
  const list = Array.isArray(s.chatThreadsByUsername[username]) ? s.chatThreadsByUsername[username] : [];
  set({ chatThreadsByUsername: { ...s.chatThreadsByUsername, [username]: list.filter(m => m.id !== messageId) } });
},

// After: 1 行
deleteChatMessage: (username, messageId) => {
  get().removeRecord('chatThreadsByUsername', username, m => m.id === messageId);
},
```

Reddit state.ts 从 ~497 行可缩减约 120+ 行。

---

## 9. 不适合用 CRUD 的场景（保持手写）

以下场景业务逻辑复杂，框架 CRUD 无法覆盖，仍需手写 action：

| 场景 | 示例 | 原因 |
|------|------|------|
| 跨字段联动 | Reddit `deleteOwnComment` — 级联删除子评论 + 清理 commentVotes | 涉及 BFS 遍历 + 多字段原子更新 |
| 条件创建 + 多字段 | Bilibili `toggleFollow` — 同时更新 followingList/followingIds/following 计数 | 3 个字段联动 |
| 副作用 | Wechat `sendMessage` — 发消息 + 触发 AI 自动回复 | 含异步副作用 |
| 有返回值的 action | Bilibili `toggleCoin` — `{ success, msg }` | CRUD 无返回值 |
| 自定义 partialize | Reddit `afterHydration` 合并 posts | 框架无法泛化 |

**原则：CRUD 消灭模板，不消灭业务逻辑。**

---

## 10. 向后兼容

- **`set({ key: val })` 写法完全兼容** — 不引入 immer，`set` 签名不变
- **22 个 App 渐进迁移** — 未声明 `arrayFields` 的 App 不注入数组 CRUD，只有 `patch`
- **`partialize` 不受影响** — `patch`/CRUD 都是函数，`defaultPartialize` 已排除函数
- **`bench_env` 不受影响** — `__SIM__.setState()` 有自己的 deepMerge
- **组件无需改动** — 除非 App 主动将 `updateXxx` 替换为 `patch`，否则旧调用继续工作

---

## 11. 新增/修改文件清单

| 文件 | 操作 | 内容 |
|------|------|------|
| `os/deepMerge.ts` | **新增** | `deepMerge` 函数 + `DeepPartial` / `ArrayCRUD` / `RecordArrayCRUD` 类型 |
| `os/createAppStore.ts` | **修改** | `createAppStoreWithActions` 注入 `patch` + 按需注入 CRUD |
| `apps/WechatReading/state.ts` | **修改** | 示范迁移：删除 6 个 updater 样板 |
| 引用 updater 的组件 | **修改** | 改用 `patch` / CRUD |
| `docs/specs/APP_STATE_DATA_SPEC.md` | **修改** | 更新 action 模式章节 |

### 无需新增依赖

零外部依赖。不安装 immer。

---

## 12. 迁移优先级

按**样板密度**排序，优先迁移收益最大的 App：

| 优先级 | App | 样板行数（估计） | 可用 CRUD |
|--------|-----|-----------------|-----------|
| P0 | WechatReading | ~60 行 | patch + array |
| P0 | Reddit | ~120 行 | patch + array + record |
| P1 | Wechat | ~80 行 | patch + record |
| P1 | Bilibili | ~50 行 | patch + array |
| P1 | Contacts | ~40 行 | patch + array |
| P1 | Sms | ~30 行 | patch + record |
| P2 | Spotify / Railway12306 / X / RedBook / ... | 各 ~20 行 | patch |
| P3 | Calculator2 / Compass / Clock | <10 行 | 仅 patch（可跳过） |

---

## 13. 验证清单

- [ ] `deepMerge` 单测：原始值替换、对象递归、数组整体替换、null 替换、undefined 跳过、空对象不覆盖
- [ ] 类型测试：`patch` 参数类型推导正确、`insertItem` 字段名约束正确、`insertRecord` 元素类型匹配
- [ ] WechatReading 迁移后：所有设置页 toggle 正常、书架增删正常、阅读进度正常
- [ ] Reddit 迁移后：评论增删改正常、聊天收发正常、deleteOwnComment 级联删除正常
- [ ] `__SIM__.getState()` 输出不变（stateAdapter 不受影响）
- [ ] localStorage 持久化内容不变（CRUD 方法被 partialize 排除）
