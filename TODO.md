# TODO

## ~~Recents 多任务视图渲染问题~~ ✅ 已解决（V1）

### 原始问题

Recents（多任务视图）需要显示每个运行中 App 的当前界面预览。如果在 Recents 中重新渲染 App 组件，会导致 React 状态不一致（因为同一个 App 被挂载了两份）。

### 解决方案

**Live DOM Repositioning**：App 容器始终只挂载一份，进入 Recents 时通过 `position: absolute` + 动态 `left/top/width/height` 将容器直接定位到卡片槽位，配合 `transform: scale()` 缩放内容。Chrome card 上移滑动手势同步到 app container 的 `translateY`。

已弃用的方案：CSS Transform 纯缩放（z-index 层叠上下文问题）、截图、路由同步、Portal。

---

## Recents V2 — 动画与性能优化

### V1 状态

✅ 已完成。基础 Live DOM Repositioning 全部实现并已修复 chrome card swipe sync。

### 关键发现

`#root` 始终被 `DeviceEffects` 设置了 `filter`（至少 `brightness(1)`）。根据 CSS 规范，`filter !== none` 在祖先上会为 `position: fixed` 子元素创建新的包含块。因此 app 容器的 `position: fixed` 实际上相对于 `#root`（手机框架），而非真实 viewport。这意味着 `getBoundingClientRect()` 在 `position: absolute` 和 `position: fixed` 两种模式间值是一致的，可以直接用 FLIP。

### V2-1: 开合动画（FLIP + WAAPI）

#### 原理

使用 FLIP（First-Last-Invert-Play）技术 + Web Animations API：

1. 捕获动画前的 bounding rect（"First"）
2. React 重渲染后 DOM 已是目标布局（"Last"）
3. 用 `getBoundingClientRect()` 取得新 rect
4. 计算逆变换（"Invert"）：`translate(dx, dy) scale(sw, sh)`
5. 用 WAAPI `element.animate()` 从逆变换过渡到 `transform: none`（"Play"）

FLIP 不需要改变 position 类型，不需要 CSS transition，不受 absolute 与 fixed 切换限制。

#### 动画场景

| 场景                     | 触发                  | 动画目标      | 效果                        |
| ------------------------ | --------------------- | ------------- | --------------------------- |
| 进入 Recents             | `showRecents()`     | 当前活跃 app  | 全屏 → 卡片（缩小）        |
| 退出 Recents（点击卡片） | `launchApp(rootId)` | 被点击的 app  | 卡片 → 全屏（放大）        |
| 退出 Recents（回桌面）   | `goHome()`          | 无            | 无 FLIP（直接隐藏即可）     |
| 后台 app 进入 Recents    | —                    | 后台 app 容器 | 渐显（opacity 0→1, 200ms） |

#### 实现：`os/SystemShell.tsx`

新增模块级 FLIP 工具函数：

```typescript
function flipAnimate(
  appId: AppId,
  firstRect: DOMRect,
  direction: 'shrink' | 'expand',
): void {
  const el = document.getElementById(`app-container-${appId}`);
  if (!el) return;
  const lastRect = el.getBoundingClientRect();

  const dx = firstRect.left - lastRect.left;
  const dy = firstRect.top - lastRect.top;
  const sw = firstRect.width / lastRect.width;
  const sh = firstRect.height / lastRect.height;

  // 无显著差异则跳过
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sw - 1) < 0.01) return;

  const fromBR = direction === 'shrink' ? '0px' : `${DEVICE_CONFIG.recentsCardBorderRadius}px`;
  const toBR = direction === 'shrink' ? `${DEVICE_CONFIG.recentsCardBorderRadius}px` : '0px';

  el.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sw}, ${sh})`, borderRadius: fromBR },
      { transform: 'none', borderRadius: toBR },
    ],
    {
      duration: DEVICE_CONFIG.pageTransitionDuration, // 300ms
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',        // Material Design standard
    },
  );
}
```

SystemShell 组件内新增 FLIP refs + effects：

```typescript
// ---- FLIP animation state ----
const prevActiveRectRef = useRef<DOMRect | null>(null);
const prevActiveIdRef = useRef<AppId | null>(null);
const cardRectsRef = useRef<Map<AppId, DOMRect>>(new Map());
const prevRecentsVisibleRef = useRef(state.isRecentsVisible);

// 持续捕获 "first" rect（每次 commit 后、paint 前）
useLayoutEffect(() => {
  if (!state.isRecentsVisible && state.activeAppId) {
    // 非 Recents 时：记录活跃 app 的全屏 rect
    const el = document.getElementById(`app-container-${state.activeAppId}`);
    if (el) {
      prevActiveRectRef.current = el.getBoundingClientRect();
      prevActiveIdRef.current = state.activeAppId;
    }
  }
  if (state.isRecentsVisible) {
    // Recents 时：记录所有卡片的 rect（用于退出时 FLIP）
    cardRectsRef.current.clear();
    state.runningApps.forEach(appId => {
      const el = document.getElementById(`app-container-${appId}`);
      if (el) cardRectsRef.current.set(appId, el.getBoundingClientRect());
    });
  }
});

// 检测 isRecentsVisible 变化 → 触发 FLIP
useLayoutEffect(() => {
  const wasRecents = prevRecentsVisibleRef.current;
  prevRecentsVisibleRef.current = state.isRecentsVisible;

  if (!wasRecents && state.isRecentsVisible) {
    // ---- 进入 Recents ----
    const appId = prevActiveIdRef.current;
    const firstRect = prevActiveRectRef.current;
    if (appId && firstRect) {
      flipAnimate(appId, firstRect, 'shrink');
    }
    // 后台 app 渐显
    state.runningApps.forEach(id => {
      if (id === appId) return;
      const el = document.getElementById(`app-container-${id}`);
      if (el && recents?.slotByPreviewAppId.has(id)) {
        el.animate(
          [{ opacity: '0' }, { opacity: '1' }],
          { duration: 200, easing: 'ease-out' },
        );
      }
    });
  }

  if (wasRecents && !state.isRecentsVisible && state.activeAppId) {
    // ---- 退出 Recents（点击卡片） ----
    const firstRect = cardRectsRef.current.get(state.activeAppId);
    if (firstRect) {
      flipAnimate(state.activeAppId, firstRect, 'expand');
    }
  }
}, [state.isRecentsVisible]);
```

#### Intent 链说明

FLIP 通过 `state.activeAppId` 定位容器。Intent 场景中：

1. 进入 Recents 前 `activeAppId = alipay`（intent target）→ 捕获 alipay 的全屏 rect
2. 进入 Recents 后 alipay 的容器位于 12306 的卡片槽位 → FLIP 自动计算 delta
3. 退出时点击 12306 卡片 → `launchApp(12306)` → OS 恢复 intent 链顶部 → `activeAppId = alipay` → FLIP 从卡片 rect 展开

无需特殊处理，FLIP 基于实际 DOM rect 计算，自动适配。

### V2-2: 关闭卡片后剩余卡片滑动动画

#### 原理

FLIP 同样适用。关闭一张卡片后，后续卡片的 slot index 减 1，`left` 值左移 `cardStride`(224px)。用 FLIP 在 DOM 更新前后捕获 rect 差异，用 WAAPI 做 `translateX` 动画。

需要同时 FLIP 两层元素：

- App containers（z:205，`#app-container-{previewAppId}`）
- Chrome cards（z:210，`[data-recents-card="{rootAppId}"]`）

#### 实现：`os/SystemShell.tsx` — RecentsChrome 内部

```typescript
// Pending slide animation rects
const pendingSlideRef = useRef<Map<AppId, { appRect?: DOMRect; chromeRect?: DOMRect }> | null>(null);

// handleCardTouchEnd 修改（在 closeApp 之前捕获 rects）：
const handleCardTouchEnd = () => {
  const rootAppId = swipingRootAppId.current;
  if (!rootAppId) return;

  const previewAppId = recents.previewByRootAppId.get(rootAppId) ?? rootAppId;
  const offset = swipeOffset.current;

  if (offset > DEVICE_CONFIG.recentsSwipeThreshold) {
    // ---- 捕获剩余卡片的当前 rects ----
    const rects = new Map<AppId, { appRect?: DOMRect; chromeRect?: DOMRect }>();
    recents.visibleRootApps.forEach(id => {
      if (id === rootAppId) return; // 跳过被关闭的
      const pid = recents.previewByRootAppId.get(id) ?? id;
      const appEl = document.getElementById(`app-container-${pid}`);
      const escaped = CSS?.escape?.(id) ?? id;
      const chromeEl = document.querySelector(`[data-recents-card="${escaped}"]`);
      rects.set(id, {
        appRect: appEl?.getBoundingClientRect() ?? undefined,
        chromeRect: (chromeEl as HTMLElement)?.getBoundingClientRect() ?? undefined,
      });
    });
    pendingSlideRef.current = rects;

    closeApp(rootAppId);
    if (recents.visibleRootApps.length === 1) goHome();
  } else {
    syncSwipeToAppContainer(previewAppId, rootAppId, 0);
  }

  swipingRootAppId.current = null;
  swipeOffset.current = 0;
};

// 新增 useLayoutEffect：重渲染后 FLIP 滑动
useLayoutEffect(() => {
  const pending = pendingSlideRef.current;
  if (!pending || !state.isRecentsVisible) return;
  pendingSlideRef.current = null;

  const animOpts: KeyframeAnimationOptions = { duration: 250, easing: 'ease-out' };

  recents.visibleRootApps.forEach(rootId => {
    const old = pending.get(rootId);
    if (!old) return;

    // FLIP app container
    const previewId = recents.previewByRootAppId.get(rootId) ?? rootId;
    const appEl = document.getElementById(`app-container-${previewId}`);
    if (appEl && old.appRect) {
      const dx = old.appRect.left - appEl.getBoundingClientRect().left;
      if (Math.abs(dx) > 1) {
        appEl.animate([
          { transform: `translateX(${dx}px)` },
          { transform: 'none' },
        ], animOpts);
      }
    }

    // FLIP chrome card
    const escaped = CSS?.escape?.(rootId) ?? rootId;
    const chromeEl = document.querySelector(`[data-recents-card="${escaped}"]`) as HTMLElement | null;
    if (chromeEl && old.chromeRect) {
      const dx = old.chromeRect.left - chromeEl.getBoundingClientRect().left;
      if (Math.abs(dx) > 1) {
        chromeEl.animate([
          { transform: `translateX(${dx}px)` },
          { transform: 'none' },
        ], animOpts);
      }
    }
  });
}, [recents.visibleRootApps]);
```

#### 时序保证

1. `handleCardTouchEnd`（同步）→ 设置 `pendingSlideRef` → 调用 `closeApp()`（同步 dispatch）
2. React 同步处理 reducer → 重渲染 RecentsChrome（新的 `recents.visibleRootApps`）
3. `useLayoutEffect` 触发 → 检测到 `pendingSlideRef` 非空 → FLIP → 清空 ref
4. 浏览器 paint → 用户看到滑动动画

`useLayoutEffect` 在 DOM commit 之后、paint 之前执行，保证 FLIP 的 "Last" rect 准确且动画从第一帧开始。

### V2-3: `content-visibility: hidden` 性能优化

#### 原理

`content-visibility: hidden` = `visibility: hidden` 的视觉效果 + 跳过内容 layout/paint 计算。相当于告诉浏览器"这个元素的内容完全不需要处理"。

| 属性                           | 保留滚动位置 | 跳过内容 layout | 跳过内容 paint |   元素盒子占位   |
| ------------------------------ | :----------: | :-------------: | :------------: | :--------------: |
| `display: none`              |      ✗      |       ✓       |       ✓       |        ✗        |
| `visibility: hidden`         |      ✓      |       ✗       |       ✓       |        ✓        |
| `content-visibility: hidden` |      ✓      |       ✓       |       ✓       | ✓（需显式尺寸） |
| 两者叠加                       |      ✓      |       ✓       |       ✓       |        ✓        |

需要叠加使用：`content-visibility: hidden` 跳过 layout（性能）；`visibility: hidden` 隐藏元素盒子本身（视觉，否则 `bg-white` 背景会显示）。

#### 兼容性

Chrome 85+, Edge 85+, Firefox 125+, Safari 18+。本项目主要在 Chromium 中运行，无兼容性问题。

#### TypeScript

`contentVisibility` 不在 `@types/react@19.2.13` 的 `CSSProperties` 中。两种方案：

- **方案 A（推荐）**：模块增强，在 `os/types.ts` 顶部添加：

```typescript
declare module 'react' {
  interface CSSProperties {
    contentVisibility?: 'visible' | 'hidden' | 'auto';
  }
}
```

- **方案 B**：直接 `as any` cast（项目已有此模式）。

#### 实现：`os/SystemShell.tsx` — `computeAppContainerStyle`

Background 模式改为：

```typescript
const isVisible = args.isActive && !args.isRecentsVisible;
return {
  containerStyle: {
    position: 'absolute',
    inset: 0,
    zIndex: DEVICE_CONFIG.zIndexApp,
    visibility: isVisible ? 'visible' : 'hidden',
    contentVisibility: isVisible ? 'visible' : 'hidden', // 新增
    pointerEvents: isVisible ? 'auto' : 'none',
  },
  innerStyle: { width: '100%', height: '100%' },
};
```

#### scrollMeta.ts

无需修改。`isElementVisible` 已检查 `computedStyle.visibility === 'hidden'`，后台 app 仍被正确过滤。`content-visibility: hidden` 不影响 `getComputedStyle().visibility` 的返回值（它们是独立属性）。

### 修改文件清单（V2）

| 文件                   | 改动                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `os/SystemShell.tsx` | FLIP 动画逻辑（~60 行新增）+ 关闭卡片滑动（~40 行修改）+`contentVisibility` 一行 |
| `os/types.ts`        | 可选：`CSSProperties` 模块增强（2 行）                                           |

---

## dataSource 配置

### 现状

以下 App 的 `navigation.declaration.ts` 中带动态 path params 的 transition **未配置 dataSource**：

- **Bilibili**：`video.open`、`user.open`、`partition.open` 等 transition 需要从不同来源页面获取不同的数据（如推荐视频、热门视频、用户投稿等），dataSource 配置复杂度较高
- **小红书（RedBook）**：类似情况，帖子/用户等动态参数的数据源因来源页面而异

### 决定

**暂不配置 dataSource，不生成 data 图**。

原因：

1. 不同 `from` 页面进入同一目标的数据源各不相同，需要为每个 `from` 单独配置
2. 配置工作量大，且对当前任务生成/路径分析的价值有限
3. schema 模式的导航图已足够支持一致性检查和基本任务生成

### 后续

如需启用 data-mode 展开，需要：

1. 为每个带 path params 的 transition 配置完整的 `dataSource[]`，按 `from` 区分数据引用
2. 确保 `*Config.ts` 中导出的数据结构与 `paramMapping` 对应

---

---

## 小红书 entities 修改在 reload 后丢失

### 问题

RedBook 的 `entities`（notesById、usersById）和 `feedIds`、`userIds` 因体积过大（~16MB）无法写入 localStorage，已通过 `partialize` 排除持久化。但用户交互会同时修改 `user.*`（已持久化）和 `entities.*`（未持久化），reload 后两者不一致：

| 用户动作 | user 侧（持久化）         | entity 侧（reload 后丢失） |
| -------- | ------------------------- | -------------------------- |
| 点赞     | `user.likedNotes`       | `note.likes ± 1`        |
| 收藏     | `user.collectedNotes`   | `note.collections ± 1`  |
| 评论     | `user.commentList`      | `note.comments[]` 追加   |
| 删评     | `user.commentList`      | `note.comments[]` 删除   |
| 关注     | `user.followings`       | `user.followers ± 1`    |
| 发布     | `user.publishedNoteIds` | `notesById` 新增         |

### 旧代码已有的 tradeoff

迁移前的 Context 手动持久化就有同样问题，原注释：

```
// We lose 'likes' persistence on refresh for crawled notes, but this is necessary for large datasets
```

### 推荐方案：派生渲染（不修改 entities）

将 entities 视为**只读快照**（纯 JSON 原始数据），用户操作结果全部存在 `user.*`，渲染时派生显示值：

```tsx
// 不改 note.likes，渲染时派生
const baseLikes = parseCount(note.likes);  // JSON 原始值
const isLiked = user.likedNotes.includes(note.id);
const displayLikes = baseLikes + (isLiked ? 1 : 0);
```

优点：entities 永不可变，无需 reconcile，user 是唯一真相源。
缺点：需要修改所有渲染 likes/collections/comments 的组件，改动量较大。

### 优先级

低（bench_env 在单次 page load 内完成任务，不受影响；仅影响开发时手动刷新场景）
