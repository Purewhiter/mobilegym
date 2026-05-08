# Simulated Android OS Environment

这是一个基于 React + Vite 构建的轻量级 Android 操作系统模拟环境，旨在为手机操作 Agent 提供训练和评测平台。它提供了一个类 Android 的 Shell，支持多任务管理、手势交互和应用生命周期模拟。

## 🚀 快速开始

### 环境依赖
- Node.js (推荐 v18+)
- npm 或 yarn

参考https://nodejs.org/en/download

### 安装与运行

1. **安装依赖**
   ```bash
   npm install
   ```

2. **启动开发服务器**
   ```bash
   npm run dev
   ```
   启动后访问控制台输出的本地地址。

## 📂 项目结构

```
mobile-gym/
├── apps/                # 应用程序目录 (每个 App 一个文件夹)
│   ├── Wechat/          # 示例 App
│   ├── Bilibili/
│   └── ...
├── os/                  # 操作系统核心逻辑
│   ├── SystemShell.tsx  # 桌面、状态栏、多任务视窗
│   ├── AppStateRegistry.ts # 全局状态管理中心
│   ├── data/
│   │   ├── osConfig.ts  # 设备配置、时间/定位设置
│   │   └── appRegistry.tsx # ⭐ App 注册表（组件、图标、元数据）
│   ├── types.ts         # OS 类型定义（AppId 等）
│   ├── types/manifest.ts # AppManifest 类型定义
│   └── ...
├── .cursor/rules/
│   └── rules-for-mobile-gym.mdc  # ⭐ AI 开发助手必读规则
└── docs/
    └── PROJECT_SPEC_V2.md  # 详细的开发规范文档 (请务必阅读)
```

### App 目录结构（对齐 Android res/ 思路）

每个 App 建议遵循如下结构（渐进迁移中）：

```
apps/<AppName>/
├── manifest.ts                 # App 身份/图标/主题 Tier-1 色 + intentFilters
├── <AppName>App.tsx            # App 入口（MemoryRouter + NavigationHandler）
├── navigation.declaration.ts   # 导航声明（source of truth）
├── navigation.ts               # go/back（支持 popTo）
├── res/                        # 资源层（colors/strings/dimens 等）
├── assets/                     # 二进制资产（Vite import，自包含）
├── types.ts                    # App 类型定义（位置标准化）
├── constants.ts                # 结构性常量（tabs/配置等；资源类常量迁到 res/）
├── data/
│   ├── index.ts
│   └── defaults.json
├── pages/
└── components/
```

## 🤖 AI 开发助手须知

> **重要**：如果你是 AI 编程助手（如 Cursor、Copilot 等），在修改或添加 App 相关内容之前，**必须先阅读** `.cursor/rules/rules-for-mobile-gym.mdc`。该文件包含了声明式导航、手势打标、Actions 规范等必须遵循的开发约束。

## 🛠 开发新 App 流程

开发一个新的 App 需要遵循以下标准步骤。详细规范请参考 `docs/specs/PROJECT_SPEC_V2.md`。

### 1. 创建 App 目录结构
在 `apps/` 下创建你的 App 文件夹（例如 `Demo`），结构如下：
```
apps/Demo/
├── manifest.ts
├── DemoApp.tsx
├── navigation.declaration.ts
├── navigation.ts
├── res/
│   ├── colors.ts
│   ├── strings.ts
│   └── dimens.ts
├── assets/
│   └── images/
├── types.ts
├── constants.ts
├── context/
│   └── DemoContext.tsx
├── data/
│   ├── index.ts
│   └── defaults.json
└── pages/
    └── HomePage.tsx
```

## 🤖 使用 Agent 执行任务（bench_env）

项目提供了统一的评测框架 `bench_env`，支持多种 Agent（AutoGLM、Gelab 等）。

### 环境准备

```bash
# 1. 启动模拟器
npm run dev

# 2. 安装 Python 依赖
pip install -r bench_env/requirements.txt
playwright install chromium
```

### 查看可用任务

```bash
# 列出所有任务
python -m bench_env.run --list

# 按 App 筛选
python -m bench_env.run --list --app wechat
```

### 执行模式（--exec）

直接用自然语言让 Agent 执行任务，适合快速测试：

```bash
# 简单任务
python -m bench_env.run \
  --exec "打开微信设置页面" \
  --env-url http://localhost:5173 \
  --model-base-url "http://localhost:8001/v1" \
  --model-name autoglm-phone-9b \
  --agent autoglm
```

### 评测模式：运行任务并判定

```bash
# 单任务评测
python -m bench_env.run \
  --task-id wechat.OpenMyQRCode \
  --env-url http://localhost:5173 \
  --model-base-url "http://localhost:8001/v1" \
  --model-name autoglm-phone-9b \
  --agent autoglm

# 批量评测（某个 App 的所有任务）
python -m bench_env.run \
  --app wechat \
  --env-url http://localhost:5173 \
  --model-base-url "http://localhost:8001/v1" \
  --model-name autoglm-phone-9b \
  --agent autoglm

# 并行评测（2 个 worker）
python -m bench_env.run \
  --app wechat \
  --parallel 2 \
  --env-url http://localhost:5173 \
  --model-base-url "http://localhost:8001/v1" \
  --model-name autoglm-phone-9b \
  --agent autoglm
```

### 评测要点（简要）

- `--device real`：真机评测；`--judge-mode auto/vlm/state` 支持 VLM 视觉评估
- `--sample-n`/`--repeat-n`：参数采样与 Pass@k 统计（可配 `--pass-k`）
- `--parallel`/`--isolation`：并行评测与隔离级别

> 更完整的评测说明与示例参见 `bench_env/README.md`

### 支持的 Agent 类型

| Agent | 说明 |
|-------|------|
| `autoglm` | Open-AutoGLM 风格（中文提示词） |
| `gelab` | Gelab-Zero 风格 |
| `generic` | 通用 JSON 格式 |
| `generic_v2` | 通用 JSON（think/answer 结构） |
| `human` | 人工操作（调试用） |

> 详细说明见 `bench_env/README.md`

---

## 🧰 scripts/ 工具脚本

`scripts/` 目录提供了一组用于**导航声明一致性检查**、**生成导航图/数据图**、**生成 action tasks**，以及用 **最短路径** 对照验证导航图/任务轨迹的开发工具。
一般在项目根目录运行（先 `npm install`，需要 Vite 时先 `npm run dev`）。

> 重要：这些 Node 脚本里经常使用 `<AppName>`（对应 `apps/<AppName>/` 文件夹名，例如 `WechatReading`）。

### ✅ 一键生成导航产物（推荐）

用于把常见产物一次性保持同步：
- consistency check（transitions + actions）
- schema nav graph（以及 simplified graph）
- 可选 data graph（需要 `--data`）
- action tasks（可用 `--skip-tasks` 跳过）

```bash
# 生成 schema 图 + action tasks（输出到 public/）
node scripts/build_nav_artifacts.mjs WechatReading

# 生成 data 图（data-mode 展开 dataSource），并一并生成 data-mode tasks
node scripts/build_nav_artifacts.mjs WechatReading --data data/wechatReadingConfig.ts

# 只更新图，不生成 tasks（避免产生很大的 tasks diff）
node scripts/build_nav_artifacts.mjs WechatReading --skip-tasks
```

默认输出（以 `WechatReading` 为例）：
- `public/wechatreading_nav_graph.json`
- `public/wechatreading_data_graph.json`（仅当传入 `--data`）
- `public/wechatreading_action_tasks.json`
- `public/wechatreading_action_tasks_data.json`（仅当传入 `--data`）

### 🔎 导航声明一致性检查（拆分调试）

检查代码中使用的 `data-trigger` / `data-action` 是否与 `apps/<AppName>/navigation.declaration.ts` 一致，并做 best-effort 的 from/path 约束校验：

```bash
node scripts/check_navigation_declaration_consistency.mjs WechatReading --actions
```

常用参数：
- `--json`: 只输出 JSON
- `--actions-only`: 只检查 actions
- `--fail-on-warn`: 有 WARN 也退出非 0

### 🗺 生成导航图（schema/data）

从 `apps/<AppName>/navigation.declaration.ts` 生成 nav graph JSON（给 `public/*_nav_graph.json` / `public/*_data_graph.json` 这类产物提供来源）：

```bash
# schema mode（不做 dataSource 展开）
node scripts/navigation_declaration_analyzer.mjs WechatReading -o public/wechatreading_nav_graph.json

# data mode（展开 dataSource，需要指定 data config）
node scripts/navigation_declaration_analyzer.mjs WechatReading --data data/wechatReadingConfig.ts -o public/wechatreading_data_graph.json
```

### 👁 查看导航图（可视化）

项目提供了基于 Cytoscape.js 的图可视化工具：

1. **启动开发服务器**（如果还没启动）
   ```bash
   npm run dev
   ```

2. **访问 viewer 页面**
   - 导航图 viewer：http://localhost:5173/nav_graph_viewer.html

3. **选择图文件**
   在页面顶部下拉框中选择要查看的图 JSON，例如：
   - `wechat_nav_graph.json`（完整图）
   - `wechat_nav_graph_simplified.json`（简化图，合并同路由的 uiStates）
   - `wechat_data_graph.json`（data-mode 展开后的图）

> 提示：简化图（`*_simplified.json`）更适合快速浏览整体结构；完整图包含每个 uiState 作为独立节点，适合检查离散状态的细节。数据图暂时不需要关注。

### 🧾 从 nav graph 生成 action tasks（拆分调试）

从 `*_nav_graph.json` / `*_data_graph.json` 中枚举所有可达 action 轨迹，输出 JSONL tasks：

```bash
node scripts/generate_action_tasks_from_nav_graph.mjs \
  --graph public/wechatreading_nav_graph.json \
  --out public/wechatreading_action_tasks.json \
  --app WechatReading
```

### 🔍 nav_path_finder：最短路径验证（用于对照导航图 / AI 轨迹）

`scripts/nav_path_finder.py` 可以在 `public/*_nav_graph.json`（或 `*_data_graph.json`）上做“从 A 到 B”的**最短路径**搜索：
- **简单验证导航图正确性**：比如你期望“首页能到设置”，但找不到路径，可能是声明/图生成有问题。
- **对照验证 AI 生成的任务轨迹**：把 AI 的轨迹（或某个 action task 的 trajectories）与最短路径输出比对；不一致时可能是 **AI 轨迹不正确**，也可能是 **图不正确/不完整**。

```bash
python3 scripts/nav_path_finder.py \
  --graph public/wechat_nav_graph.json \
  --from "首页" \
  --to "设置" \

# 输出 JSON（便于程序化比对/测试）
python3 scripts/nav_path_finder.py \
  --graph public/wechat_nav_graph.json  \
  --from "首页" \
  --to "设置" \
  --json
```

### 📋 dump_app_state_schema：生成 App 状态 API 文档

`scripts/dump_app_state_schema.py` 从运行中的模拟器获取 `__SIM__.getState()` 的真实数据结构，自动生成 Markdown 格式的 API 文档。运行时会先 **`await __SIM__.preloadAllAppStores()`**（预加载全部 `state.ts`，不依赖 lazy 是否在 headless 里已经加载完）；可选 `--warm-ui` 再调用 `warmUpAllApps()`；可用 `--settle-ms` 调整收尾等待时间。

```bash
# 前提：先启动开发服务器；首次需安装 Playwright 浏览器（与 bench_env 相同）
npm run dev
# pip install -r bench_env/requirements.txt && python -m playwright install chromium

# 生成文档（默认输出到 docs/os-services/APP_STATE_API.md）
python scripts/dump_app_state_schema.py

# 指定输出路径
python scripts/dump_app_state_schema.py --out docs/os-services/APP_STATE_API.md

# 指定服务器地址
python scripts/dump_app_state_schema.py --url http://localhost:3000

# 预加载后再多等一会（persist 较慢时）
python scripts/dump_app_state_schema.py --settle-ms 3000

# 同时拉起全部 Task 视图（重，一般不必）
python scripts/dump_app_state_schema.py --warm-ui
```

## 🔌 可访问的调试/自动化接口（window 全局）

这些接口可在浏览器控制台直接调用，供调试与自动化脚本使用；更完整的说明见 `docs/specs/PROJECT_SPEC_V2.md`（“Agent API 参考”章节）。

### OS / SIM

- **`window.__OS__`**：系统层控制接口
  - `__OS__.getState()`：获取 OSState（也可直接读 `__OS__.state`）
  - `__OS__.openApp(appId, initialRoute?)`：打开 App（可选直达某个路由）
  - `__OS__.launchApp(appId)` / `__OS__.goHome()` / `__OS__.showRecents()`
  - `__OS__.closeApp(appId)`：关闭指定 App
  - `__OS__.handleBack()`：触发系统返回（通过 `BackDispatcher` 按优先级分发给各组件，否则回桌面）

- **`window.__SIM__`**：仿真/评测辅助接口
  - `__SIM__.getState()`：获取 `{ os, apps }` 系统及app状态
  - `__SIM__.reset(seed?)`：清空 localStorage 并刷新页面

### 路由观测 / App 导航

- **`window.__OS__.getAppRoute()`**：获取当前 App 的路由信息（由各 App 通过 `useAppNavigationHandler` + `AppNavigatorRegistry` 实时更新）

```js
window.__OS__.getAppRoute()
// { app: 'wechat', path: '/chat?tab=...' }
```

- **`window.__OS__.openApp(appId, initialRoute?)`**：打开 App 并可选直达某页（内部通过 `AppNavigatorRegistry` 分发导航指令）
- **`window.__OS__.handleBack()`**：系统返回时通过 `BackDispatcher` 按优先级分发（PermissionDialog > Shade > Keyboard > App > Home）

### 滚动观测

- **`window.__getScrollMeta__()`**：自动发现页面上所有带 `data-scroll-container="name"` 的可见滚动容器，读取其滚动状态

```js
window.__getScrollMeta__?.()
// {
//   main: { position: 120, max: 980, viewport: 600, total: 1580 },
//   ...
// }
```

### 查询/定位元素（按 id / selector / data-trigger）

- **`window.__SIM_QUERY__`**：只读查询接口（用于调试/评测/回放；常用于“查找某个入口控件的位置”）
  - `__SIM_QUERY__.getRectById(id)`：按 DOM `id` 查询元素矩形（等价于 `#id`）
  - `__SIM_QUERY__.getRectBySelector(selector)`：按 CSS selector 查询（返回首个可见元素）
  - `__SIM_QUERY__.getRectByTrigger(triggerId, params?)`：按 `data-trigger="..."`（可选再匹配 `data-trigger-params`）查询

```js
// 1) 按 id 查找元素矩形
window.__SIM_QUERY__?.getRectById?.('submit-btn')

// 2) 按 selector 查找（例如某个 transitionId 的入口）
window.__SIM_QUERY__?.getRectBySelector?.('[data-trigger="wechat.settings.open"]')

// 3) 按 triggerId + params 精确匹配（适合 tab switch / 列表项等复用同一 transitionId 的场景）
window.__SIM_QUERY__?.getRectByTrigger?.('wechat.tab.switch', { tab: 'me' })
```

### 输入注入（原子手势）

**`window.__SIM_INPUT__`** 是面向 Agent/自动化的统一手势注入接口，模拟人类能做的所有基本操作。

#### API 列表

| 方法 | 签名 | 说明 |
|------|------|------|
| `tap` | `(x, y)` | 单击（坐标为 CSS px） |
| `doubleTap` | `(x, y)` | 双击 |
| `longPress` | `(x, y, ms?)` | 长按（默认 800ms） |
| `type` | `(text, opts?)` | 在当前焦点输入框输入文字 |
| `swipe` | `(start, end, opts?)` | 滑动手势 |
| `back` | `()` | 返回（调用 `__OS__.handleBack()`） |
| `home` | `()` | 回到桌面（调用 `__OS__.goHome()`） |

#### 示例

```js
// 1) 点击坐标
__SIM_INPUT__.tap(200, 300)

// 2) 双击
__SIM_INPUT__.doubleTap(200, 300)

// 3) 长按 1.5 秒
await __SIM_INPUT__.longPress(200, 300, 1500)

// 4) 先点击输入框获取焦点，再输入文字
__SIM_INPUT__.tap(200, 400)
await __SIM_INPUT__.type('Hello World')
// 清空后输入
await __SIM_INPUT__.type('新内容', { clear: true })

// 5) 滑动（向上滑动列表）
await __SIM_INPUT__.swipe({ x: 200, y: 500 }, { x: 200, y: 200 })
// 也支持数组格式
await __SIM_INPUT__.swipe([200, 500], [200, 200])
// 自定义滑动速度和惯性
await __SIM_INPUT__.swipe([200, 500], [200, 200], { 
  ms: 200,           // 滑动时长（默认 300ms）
  steps: 8,          // 采样步数（默认 10）
  inertia: true,     // 松手惯性（默认 true）
  inertiaMs: 450,    // 惯性时长
  inertiaDecay: 0.86 // 惯性衰减系数
})

// 6) 返回上一页
__SIM_INPUT__.back()

// 7) 回到桌面
__SIM_INPUT__.home()
```

#### 组合使用：先定位再操作

```js
// 用 __SIM_QUERY__ 定位元素，再用 __SIM_INPUT__ 操作
const rect = __SIM_QUERY__.getRectByTrigger('wechat.tab.switch', { tab: 'me' })
if (rect) {
  __SIM_INPUT__.tap(rect.center.x, rect.center.y)
}

// 按 CSS selector 定位
const settingsBtn = __SIM_QUERY__.getRectBySelector('[data-trigger="settings.open"]')
if (settingsBtn) {
  __SIM_INPUT__.tap(settingsBtn.center.x, settingsBtn.center.y)
}
```

> 坐标说明：`__SIM_INPUT__` 默认使用 **CSS 像素（viewport 坐标）**。如需传入 **physical 像素**（例如 1080×2400 的坐标），请显式使用第三个参数：`__SIM_INPUT__.tap(x, y, { coords: 'physical' })`（不再按大小自动推断，避免在不同环境下误判）。

### 系统时间（可模拟）

- **`window.__SIM_TIME__`**：统一时间服务（用于 benchmark/测试可复现）
  - `__SIM_TIME__.now()`
  - `__SIM_TIME__.setSimulatedTime(tsOrString)` / `__SIM_TIME__.setRealTime()`
  - `__SIM_TIME__.getConfig()`

### 系统定位（可模拟）

- **`window.__SIM_LOCATION__`**：统一定位服务（默认模拟模式，避免浏览器权限弹窗）
  - `__SIM_LOCATION__.getCoords()`：获取当前坐标
  - `__SIM_LOCATION__.setSimulatedLocation('shanghai')` / `__SIM_LOCATION__.setSimulatedLocation({ latitude, longitude })`
  - `__SIM_LOCATION__.simulateError(1|2|3)`：模拟定位失败（1=权限拒绝,2=不可用,3=超时）
  - `__SIM_LOCATION__.clearError()` / `__SIM_LOCATION__.setRealLocation()`
  - `__SIM_LOCATION__.presets`：查看可用预设城市（beijing, shanghai, tokyo, newyork...）
  - `__SIM_LOCATION__.getConfig()`
