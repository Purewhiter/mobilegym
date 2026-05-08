# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. You should response in Chinese.

## Project Overview

mobile-gym is a **simulated Android OS environment** built with React + Vite + TypeScript + Tailwind CSS v4. It serves as a training and benchmarking platform for **pure-vision** mobile phone operation Agents (VLM agents that control phone UIs via screenshots only). The simulator runs in a browser and exposes JavaScript APIs (`__SIM__`, `__OS__`, `__SIM_INPUT__`, `__SIM_QUERY__`) for **task management, trajectory data synthesis, and benchmark orchestration** — these are NOT part of the Agent's observation space; the Agent only sees screenshots.

The project is primarily documented in **Chinese (中文)**. Follow existing conventions for labels, descriptions, and comments.

## Build and Dev Commands

如果要运行 python，优先使用 conda 环境，本机理应安装过。

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server (port 3000, host 0.0.0.0)
npm run preview      # Preview production build
```

**Do NOT run `npm run build`** 除非显式指出；

### 类型检查策略

- **小修改**（改几个文件、改样式、加数据等）— 不应该跑 `tsc --noEmit`，依赖 IDE 实时检查即可
- **大修改**— 完成后跑一次 `tsc --noEmit` 确认无类型错误

### ESLint

```bash
npm run lint          # 检查 os/ 和 apps/ 下的运行时代码
```

当前规则：禁止裸 `Date.now()` 和任何形式的 `new Date(...)`（含带参形式，必须通过 `TimeService`）。配置见 `eslint.config.js`。

### Navigation Artifact Generation (run after modifying navigation declarations)

```bash
# One-shot: consistency check + schema nav graph + action tasks
node scripts/build_nav_artifacts.mjs <AppName>

# With data graph generation
node scripts/build_nav_artifacts.mjs <AppName> --data data/index.ts

# Skip tasks, only update graphs
node scripts/build_nav_artifacts.mjs <AppName> --skip-tasks
```

### Consistency Checking

```bash
node scripts/check_navigation_declaration_consistency.mjs <AppName> --actions
```

### Benchmark Environment (Python)

```bash
pip install playwright aiohttp
playwright install chromium

python -m bench_env.run --list                    # List all tasks
python -m bench_env.run --list --suite wechat      # Filter by suite
python -m bench_env.run --task-id <id> --env-url http://localhost:3000 --agent <type>
```

Supported agent types: `autoglm`, `gelab`, `generic`, `generic_v2`, `human`, `venus`, `gui_owl`, `uitars`.

## Architecture

The project has three main layers plus dev tooling. It is a single Vite project (not a monorepo). Path alias: `@/*` maps to the project root.

### OS Layer (`os/`)

The simulated Android system:

- **`OSContext.tsx`** — Thin React Context Provider; delegates to TaskManager, BackDispatcher, IntentResolver; exposes `window.__OS__` and `window.__SIM__` global APIs
- **`TaskManager.ts`** — Task/Activity stack management (osReducer, sequence generators, pendingCallbacks). Uses `createVolatileOsStore` — **not persisted** (browser refresh = reboot, task stack resets to empty). Runtime state is always readable via `__SIM__.getState()`. Each `Task` holds a `stack: ActivityInstance[]` supporting **multiple Activities per Task** — e.g. an existing WeChat task can have a payment Activity pushed on top. `LAUNCH_APP` tracks `launchedByTaskId` (set on create, conditionally cleared on reactivate from Launcher; preserved for `wasExternallyRouted` tasks). `PUSH_ACTIVITY`/`POP_ACTIVITY` manage Activity-level stack changes. `finishActivity()` pops the top Activity (if stack > 1) or closes the Task (if stack = 1), automatically activating the caller Task via `launchedByTaskId`. `MARK_EXTERNAL_ROUTE` sets `wasExternallyRouted` flag for tasks whose initial route was set by external `openApp(appId, route)`
- **`BackDispatcher.ts`** — Priority-based back key handler. Components register with priority (e.g., PermissionDialog:1000, Shade:800, Keyboard:700, App:100). Includes frame-level deduplication to prevent double-back when edge-swipe gesture and backdrop click fire in the same frame
- **`IntentResolver.ts`** — Intent matching, chooser state management, startActivityForResult
- **`AppNavigatorRegistry.ts`** — Event-driven app/activity navigator registration. Uses CustomEvent + Promise pattern (replaces polling). Navigator `navigate(path, options?)` accepts optional `{ replace?: boolean }` — OS uses this to control push (existing tasks) vs replace (new tasks) when routing via `openApp`
- **`SystemShell.tsx`** — Desktop, status bar, gesture handling, app rendering container. Apps stay mounted when backgrounded (hidden via `display:none`), preserving React state. Implements **adjustResize**: wraps each Activity in a `data-adjust-resize` div that shrinks by keyboard height when keyboard is visible, so App flex layouts auto-adapt. When keyboard is active, the container gets `data-keyboard-active` attribute — elements with `data-hide-on-keyboard` are automatically hidden via global CSS
- **`AppStateRegistry.ts`** — Dual-layer state: runtime registry (from mounted apps) + persistent readers (localStorage fallback). External access via `getAllAppStates()`
- **`types.ts`** — Core type definitions (`AppId = string`). `AppId` is a plain string alias — apps are auto-discovered, no manual type union needed
- **`types/manifest.ts`** — `AppManifest` type definition (id, packageName, displayName, displayNameEn, aliases, version, icon, theme, etc.)
- **`data/appRegistry.tsx`** — App registry: auto-discovers manifests (`apps/*/manifest.ts`, `system/*/manifest.ts`) and entry components (`apps/*/*App.tsx`, `system/*/*App.tsx`) via `import.meta.glob`. **New apps do NOT need to register here**
- **`hooks/useTriggerGestures.ts`** — Unified gesture hook producing `data-trigger-*` / `data-action-*` DOM attributes for task definition, trajectory synthesis, and navigation graph generation (NOT for Agent observation — Agent is pure-vision, screenshot only). **Globally intercepts `system.back`** triggers and routes them to `window.__OS__?.handleBack()` — individual app gesture hooks must NOT handle `system.back` themselves
- **`hooks/useAppNavigationHandler.ts`** — Unified hook for App navigation registration. Replaces manual `window.__APP_ROUTE__`/`__APP_BACK_HANDLER__`/`__APP_NAVIGATE__` setup. Registers navigator with `AppNavigatorRegistry`, back handler with `BackDispatcher`, and lifecycle events with `AppLifecycle`. **Also syncs the shadow HistoryTracker** (`utils/memoryHistoryTracker.ts`) on every location change, enabling reliable `popTo` navigation. For `openApp`, the OS passes `{ replace }` through the navigator: `replace=true` for newly created tasks, `replace=false` for existing tasks (MemoryRouter-level push). For `startActivity({ newTask: true })` on existing tasks, the OS pushes a **new Activity** onto the Task stack (OS-level `pushActivity`), not just a MemoryRouter route — the target Activity gets its own `activityId` and `launchedByTaskId`, and can be independently finished via `finishActivity()`. **App `onNavigate` handlers should use the provided `navigate` function directly** — the OS controls replace vs push mode. **Foreign task isolation**: when an App instance is rendered inside another App's Task (e.g. `startActivityForResult` pushes Alipay into 12306's Task), the hook detects `task.rootAppId !== appId` and **skips** app-level navigator/BackDispatcher/lifecycle registration to avoid overwriting the background instance's registrations — only the activity-level navigator (registered separately in the App's NavigationHandler) is used for routing
- **`utils/memoryHistoryTracker.ts`** — Shadow history stack for MemoryRouter. `react-router-dom@7` 的 MemoryHistory 不暴露 `entries`，本模块维护一份与 MemoryHistory 同步的影子栈（`HistoryTracker` class），通过 `useAppNavigationHandler` 中的 `useEffect` 监听 location 变化并调用 `syncTracker()` 保持同步。`findPopToDelta()` 从当前位置向前搜索目标路径并返回需要 `go(-delta)` 的步数
- **`utils/memoryHistoryPopTo.ts`** — `popTo` 实现（对应 Android `popUpTo`）。利用 `HistoryTracker` 搜索目标路径，调用 `navigator.go(-delta)` 回退到目标位置。调用方通常紧接着执行 `navigate(targetUrl)` 完成 push/replace
- **`createOsStore.ts`** — OS 层 Zustand store 工厂。提供 `createOsStore`（持久化）和 `createVolatileOsStore`（非持久化）两个工厂函数，内置 store registry（`resetAllOsStores()` / `snapshotOsStores()`），供 `__SIM__.reset()` 和 `__SIM__.getState()` 使用。通过 `registerToServiceRegistry: false` 可选退出注册（如 OsStateStore、Providers）
- **`OsStateStore.ts`** — 统一的 Android 数据模型 store，持有 `settings`（global/system/secure/app-specific）、`hardware`（battery/wifi/cellular/sensors）、`permissions`、`preferences`。持久化到 `os_state` localStorage key。`build` 和 `telephony` 信息通过 `managers/registry.ts` 的 override 机制管理（支持 bench_env 场景注入）
- **Managers (`os/managers/`)** — `ConnectivityManager`、`BatteryManager`、`AudioManager`、`DisplayManager` 是 OsStateStore 特定域的写入 facade，封装约束逻辑（如飞行模式级联关闭 WiFi/BT/蜂窝、音量 clamp、亮度范围）和副作用（broadcast 通知）。取代了已删除的 `DeviceService`。`managers/registry.ts` 管理 preference key → Manager 路由、build/telephony overrides
- **System Services** — `StatusBarService`、`QuickSettingsService` 为 OsStateStore 的只读 facade（selector 派生）；`ClipboardService` 使用 `createOsStore`（持久化）；`NotificationService`、`KeyboardService`、`SystemShadeService`、`PermissionService` 使用 `createVolatileOsStore`（不持久化，刷新后重置）；`LocationService` 使用 volatile store 管理定位模式与模拟坐标；`locale.ts` 提供语言 utility；其余独立服务包括 `TimeService.ts`、`NetworkService.ts` 等。**持久化原则：数据持久化，UI/会话/运行态不持久化（浏览器刷新 = 设备重启）。** **Apps must use these instead of native browser APIs** (`Date.now()` → `TimeService.now()`/`realNow()`, `navigator.geolocation` → `LocationService`, direct `fetch` → `NetworkService`). Services accessible via `window.__OS__` sub-properties (e.g., `__OS__.notifications`, `__OS__.device`, `__OS__.keyboard`)
- **System Providers** — 联系人/短信/媒体等共享数据位于 `os/providers/*Provider.ts`，使用 `createOsStore` 独立持久化（`registerToServiceRegistry: false`，不进入 `os.services` 快照）；App 通过 `ContentResolver.query/insert/update/delete` 访问。`__SIM__.getState()` 在 `os.providers.*` 显式暴露 Provider 快照

### Apps Layer (`apps/<AppName>/`, `system/<AppName>/`)

Each app follows a standard structure:

- **`manifest.ts`** — App identity (AndroidManifest-like): id, displayName, displayNameEn, aliases, icon, theme Tier-1 colors, `intentFilters` (deep links). **This is the only file needed to register an app with the OS**
- **`<AppName>App.tsx`** — Entry point with `MemoryRouter`, `useAppNavigationHandler` hook (registers navigator, back handler, and lifecycle events with the OS via `AppNavigatorRegistry` + `BackDispatcher` + `AppLifecycle`), and the "main tabs persistent + subpages exclusive" layout. **Must have `export default` — the OS discovers it via `import.meta.glob(['apps/*/*App.tsx', 'system/*/*App.tsx'])`**
- **`navigation.declaration.ts`** — Declarative navigation: all routes, transitions, actions, UI states. **Source of truth** for static analysis, graph generation, and task generation
- **`navigation.ts`** — Navigation hook (`useAppNavigate` with `go`/`back`). Supports `go(id, params, { mode, popTo, popToInclusive, state })`. **Business pages must NOT use `useNavigate()` directly**
- **`hooks/use<AppName>Gestures.ts`** — App-specific gesture hook wrapping `useTriggerGestures`
- **`context/<AppName>Context.tsx`** — State management via React Context; registers with `AppStateRegistry` on mount
- **`res/`** — App resources aligned with Android `res/values/*`:
  - `colors.ts`, `strings.ts`, `dimens.ts` (and optional `colors.states.ts`, `icons.tsx`)
- **`assets/`** — App-owned binary assets (images/icons/raw/fonts, etc.) loaded via Vite `import` (avoid `public/<appName>/...` URLs)
- **`types.ts`** — App-level types (standard location)
- **`constants.ts`** — Structural constants only (tabs, service grids, config flags). Resource-like constants should live in `res/`
- **`data/index.ts`** — Data entry point: merges constants + `defaults.json`, exports `<APPNAME>_CONFIG`
- **`data/defaults.json`** — Default data (users, content, history) as replaceable JSON
- **`pages/`** — Page components

### Benchmark Layer (`bench_env/`)

Python-based evaluation framework using Playwright. Tasks are defined per-app with state-based judging, VLM evaluation, parameter sampling, and Pass@k statistics.

**编写或修改任务前，必须先阅读 `bench_env/docs/TASK_DESIGN_SPEC.md`（任务设计规范）、`bench_env/docs/TASK_TEST_SPEC.md`（测试规范）和 `bench_env/README.md`。**

### Scripts (`scripts/`)

- **`build_nav_artifacts.mjs`** — One-shot: consistency check + nav graph + action tasks
- **`check_navigation_declaration_consistency.mjs`** — Validates declaration-to-source-code consistency
- **`navigation_declaration_analyzer.mjs`** — Generates nav graph JSON (schema and data modes)
- **`generate_action_tasks_from_nav_graph.mjs`** — Enumerates action trajectories from nav graphs
- **`nav_path_finder.py`** — Shortest path search on nav graphs for verification
- **`ime/build_pinyin_dict.mjs`** — Generates IME pinyin dictionary from Rime dict sources
- **`lint_store_getters.mjs`** — Detects query getter functions in store actions and consumer subscriptions to them (§5.3 violation). Usage: `node scripts/lint_store_getters.mjs [AppName...]`

## Key Development Rules

**`docs/specs/PROJECT_SPEC_V2.md` is the authoritative specification.** When conflicts arise, flag them rather than silently overriding. Before navigation/actions/condition changes, review the relevant proposal docs in `docs/navigation/`.

### Navigation

- Every app maintains `navigation.declaration.ts` with routes (including `uiStates`, `queryParams`, `scrollContainers`) and transitions
- All discrete UI state changes (tabs, modals, menus) must go through `go()` + URL update — never purely via React setState
- Main TabBar tabs use separate pathname routes (`/`, `/contacts`, `/me`), not query params
- Tab/subtab switching uses `mode: 'replace'`; modals/drawers use `mode: 'push'` (closed via `back()`)
- **弹窗/Dialog 默认通过 URL 驱动**（对应 Android 的 DialogFragment / Navigation dialog destination），除非用户明确指定其他方式：
  - 用 `searchParams` push 进 history stack（如 `setSearchParams(p => { p.set('myDialog', 'open'); return p; })`），弹窗可见性由 `searchParams.get('myDialog') === 'open'` 派生
  - 关闭弹窗统一用 `navigate(-1)` 回退 history entry；系统返回键自动 pop 栈顶关闭弹窗，无需额外处理
  - **禁止用 `useState` 控制弹窗显隐** — 返回键无法感知 React local state，会穿透弹窗直接返回上一页
  - **禁止在 App 层直接导入 `BackDispatcher`** — 那是 OS 内部模块，App 通过 URL + navigation stack 间接获得返回键支持
- Business pages must never use `useNavigate()`/`navigate()` directly — only the app's `go()`/`back()`
- New route paths must be registered in the app's `<Routes>` in `<AppName>App.tsx`

### Adding a New App

新增 App **不需要修改 OS 层任何文件**。OS 通过 `import.meta.glob` 自动发现。普通第三方 App 放 `apps/`，系统应用放 `system/`。只需：

1. **`apps/<AppDir>/manifest.ts`** 或 **`system/<AppDir>/manifest.ts`** — 必须 `export const manifest: AppManifest`，声明 `id`、`displayName`、`displayNameEn`、图标、主题等
2. **`apps/<AppDir>/<Name>App.tsx`** 或 **`system/<AppDir>/<Name>App.tsx`** — 入口组件，文件名必须匹配 `*App.tsx`，**必须 `export default`**
3. **`apps/<AppDir>/state.ts`** / **`system/<AppDir>/state.ts`**（可选）— Zustand store，通过 `import.meta.glob(['./apps/*/state.ts', './system/*/state.ts'])` 自动注册

约定细节：

- `manifest.id` 即为 `appId`（如 `'wechat'`），同时也是 localStorage key
- `displayNameEn` 自动注入 OS i18n 字典（`patchAppNames`），无需编辑 `os/i18n/en.ts`
- `aliases` 数组自动注入 AgentBridge 名称映射（如 `['通讯录', '联系人']`），无需编辑 `os/AgentBridge.ts`
- 目录名（如 `Wechat`）与 `appId`（如 `'wechat'`）不必相同 — OS 通过 manifest 路径自动建立映射

### DOM Tagging

- All navigation triggers must produce `data-trigger` + `data-trigger-type` attributes via gesture hooks
- All action triggers must produce `data-action` + `data-action-type` attributes
- Transition/Action IDs must be **string literals** at bind sites (no dynamic concatenation/variables)
- Return/close buttons must use `bindBack()` (`system.back`), not custom transitions
- Only tag controls that actually do something — no tags on unimplemented placeholders
- Scrollable containers need `data-scroll-container` + `data-scroll-direction` attributes matching `scrollContainers` declarations

### State and Data

> **完整状态与数据层规范见 `docs/specs/APP_STATE_DATA_SPEC.md`**（settings 命名、嵌套结构、数据分层判断标准、Store action 模式、bench_env 路径约定均在其中）。

- Config-first: constants in `constants.ts`, default data in `data/defaults.json`, unified export via `data/index.ts` as `<APPNAME>_CONFIG`
- localStorage key must exactly match `manifest.id`（即 `appId`）
- **禁止任何形式的 `new Date(...)` 和裸 `Date.now()`**，必须通过 `TimeService` 调用：
  - `TimeService.now()` / `TimeService.getDate()` — **模拟时间**：显示时钟、数据时间戳、benchmark 状态判定
  - `TimeService.realNow()` — **真实挂钟时间**：防抖、动画、手势检测、缓存 TTL 等测量真实物理时间间隔的场景
  - `TimeService.fromTimestamp(ts)` — 替代 `new Date(timestamp)`
  - `TimeService.fromLocalParts(year, month, day, ...)` — 替代 `new Date(year, month, day, ...)`
  - `TimeService.parseToTimestamp(str)` — 解析日期字符串为时间戳（配合 `fromTimestamp` 替代 `new Date(dateString)`）
- Use `LocationService` instead of `navigator.geolocation`
- Use `NetworkService` (`netJson`/`netFetch`) for HTTP requests to avoid CORS
- **禁止在 store actions 中定义查询型 getter（`isLiked`、`isFollowing`、`getXxxById` 等），也禁止在组件中订阅 store 函数引用**。Zustand action 是普通闭包，引用在 store 创建后永远不变。`useStore(s => s.isLiked)` 返回的函数引用不随底层数据变化，`Object.is` 始终为 `true`，组件不会重渲染。正确做法：**组件直接订阅数据**（`s.likedPostIds`、`s.user.following`），在组件内用 `.includes()` / `Set.has()` 派生布尔值；或通过 `memoSelector` 创建派生 selector（如 `selectLikedSongIds` 返回 `Set`）。同理，`useShallow` 选 getter 函数再包 `useMemo` 也无效——`useMemo` deps 中的函数引用永远不变，不会重算

### UI

- Every page must reserve status bar space at top with `pt-10`
- Pages should explicitly declare `data-status-bar-foreground="dark|light"` on the outermost page container when the chrome foreground is not the default dark text; the OS no longer does DOM-based auto-detection fallback
- When bottom gesture bar foreground differs from the status bar, explicitly declare `data-navigation-bar-foreground="dark|light"`; GestureBar reads declarative/manifest signals only
- Keyboard-attached UI (chat input bars, send buttons) needs `data-keep-keyboard="true"`
- OS implements `adjustResize`: keyboard shrinks the Activity container automatically. Form pages need no extra handling
- **拖拽/滑动/slider/跟手拖动等连续交互必须统一使用 `PointerEvent`**（`onPointerDown / onPointerMove / onPointerUp / onPointerCancel`，必要时配合 `setPointerCapture`）；**禁止**并行维护 `touch*` 与 `mouse*` 两套逻辑，也**禁止**用 `touchmove + click` 兜底鼠标拖拽
- **聊天页/底部操作栏禁止 `position: fixed`**：必须使用 flex 布局（`flex-shrink-0`），让 adjustResize 自动处理。`position: fixed + bottom: keyboardHeight` 在有 `designViewportWidth`（CSS zoom）的 App 中会导致键盘遮挡输入框（zoom 缩放 CSS 像素导致 fixed 定位偏移）
- **键盘弹出时隐藏元素**：在元素上加 `data-hide-on-keyboard` 属性，键盘弹出时 OS 自动隐藏（通过 `data-adjust-resize` 容器上的 `data-keyboard-active` + 全局 CSS `display:none`）。典型场景：底部 TabBar 不应在键盘弹出时被顶起，加此属性即可自动隐藏

### Validation

After modifying navigation declarations or adding pages, always run:

```bash
node scripts/build_nav_artifacts.mjs <AppName>
```

If the output has `ERROR` or `WARN`, include the specific IDs and file locations — not just summary counts.

---

## App File Architecture — Strict Boundaries

每个文件只有一个职责。违反边界会导致维护困难，且会越来越混乱。以下规则**强制执行**。

### `constants.ts` — 静态结构配置

如果需要以下类型的常量，应放在此文件：

- Tab 定义（id, route, label, icon component ref）
- 服务/功能目录（id, name, icon, color）—— 应用固有结构，用户不可修改
- 布局参数（grid columns count, visible item count）
- Feature flags

**禁止包含：**

- 用户数据（账号信息、消息、账单记录）→ `data/defaults.json`
- **原始 Lucide 图标名**（如 `"CreditCard"`、`"Bus"`）→ 必须使用 `Ic*` 别名（`"IcCard"`、`"IcBus"`）

### `data/defaults.json` — 可替换的初始状态

**必须包含：**

- 用户信息（name, avatar, phone, balance）
- 内容数据（聊天记录、账单流水、帖子、历史）
- 用户可配置的布局（主页显示的服务 ID 列表、排序）
- 用户设置值（language, theme, notification prefs）

**禁止包含：**

- 服务/功能的静态属性（icon, color, label）→ 这些是固定的，属于 `constants.ts`
- 图标字符串名 —— 若必须出现（数据驱动渲染），必须使用 `Ic*` 前缀

### `res/colors.ts` — 特殊颜色（可选）

只有以下情况才需要 `colors.ts`：

- 特殊颜色无法用 Tailwind 表达（品牌色、渐变色等）
- 需要响应深色模式的组件颜色

**不需要抽取**：

- 标准 Tailwind 颜色 → 直接用 `text-gray-800 bg-white`
- 一次性使用的颜色 → 直接写 `bg-[#FF7D00]`

### `res/dimens.ts` — 关键尺寸（可选）

**只有多处复用的重要尺寸**才需要抽取到 `dimens.ts`（如列表项高度、头像尺寸）。

**不需要抽取**：

- 一次性使用的尺寸 → 直接写 Tailwind 类或 style
- 图标 size → 直接硬编码 `size={22}`
- 间距/圆角/字体大小 → 用 Tailwind 类 `p-4 rounded-lg text-sm`

#### ⚠️ JS 像素计算必须用 CSS var，禁用 Tailwind rem 类

当 JS 做 `scrollTop = index * itemHeight` 等基于元素高度的像素运算时，该元素高度**必须**使用 CSS var（`h-(--app-xxx)`）或任意值像素（`h-[Npx]`），**禁止**使用 `h-10 / h-14` 等 rem 类（因浏览器默认字体大小非 16px，rem 与 JS 硬编码像素值会产生累积偏移）。

### `res/icons.tsx` — 图标定义

**规则：**

1. 所有图标别名以 `Ic` 前缀开头（`IcCard`、`IcBus`、`IcNavBack`）
2. `ICON_REGISTRY` 的 key 必须与导出名完全一致（全部以 `Ic` 开头）
3. **禁止**将原始 Lucide 名加入 `ICON_REGISTRY` 作为 workaround —— 应修复数据层（改 `constants.ts`/`defaults.json` 中的字符串）
4. 只导入应用实际使用的图标

### 图标使用规则

| 场景                      | 正确写法                                        |
| ------------------------- | ----------------------------------------------- |
| JSX 中固定图标            | `<IcCard size={22} />`                        |
| 数据驱动（来自 map/JSON） | `<IconRenderer name={item.icon} size={22} />` |
| 数据文件中的图标名        | `"IcCard"`（必须 Ic* 前缀）                   |

> **完整资源规范见 `docs/specs/APP_DESIGN_SPEC.md`**。
