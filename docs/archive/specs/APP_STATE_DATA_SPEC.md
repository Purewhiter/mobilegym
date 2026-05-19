# App 状态与数据层规范 v1.1

> 本文档定义 App 的**状态管理、设置结构、数据分层**规则。
> 是 `CLAUDE.md` 中 "State and Data" 和 "App File Architecture" 的详细落地规范。

---

## 一、核心原则

本项目的每个 App 都需要被 `bench_env`（Python 评测框架）通过**状态路径**读写：

```python
# bench_env 通过点分隔路径访问 App 状态
app.get_by_path("settings.general.darkMode.mode")
app.get_by_path("settings.notifications.pushEnabled")
```

因此，状态结构不仅是前端实现细节，更是**外部 API 契约**。结构不一致会导致：

- bench_env 任务路径写错 → 评测结果错误
- 数据替换失败 → benchmark 无法初始化正确状态
- 维护者无法快速定位某个设置项的存储位置

---

## 二、文件职责与数据分层

> 详细的文件边界规则见 `CLAUDE.md` — "App File Architecture — Strict Boundaries"。
> 本节聚焦于**判断标准**，解决常见的灰色地带问题。

### 2.1 三层模型

```
constants.ts          ← 静态结构（应用固有，用户不可修改）
data/defaults.json    ← 可替换初始状态（bench_env 需要替换的数据）
state.ts              ← 运行时 store（读取 CONFIG，提供 actions）
```

### 2.2 判断标准：一个值应该放哪里？

| 问题                                                         | 如果"是"                              | 示例                                      |
| ------------------------------------------------------------ | ------------------------------------- | ----------------------------------------- |
| 用户能否通过 UI 修改它？                                     | `defaults.json`                     | 深色模式开关、推送通知开关                |
| bench_env 是否需要替换它来测试不同场景？                     | `defaults.json`                     | 用户余额、聊天记录、账单                  |
| 它是应用固有的结构定义吗（用户看得到但改不了）？             | `constants.ts`                      | Tab 列表、服务目录、城市列表              |
| 它是一个**数据结构**，其中嵌含 icon/color/label 属性？ | `constants.ts`                      | 服务目录 `[{ id, icon, color, label }]` |
| 它是一个**独立的颜色/尺寸资源**，多处复用？            | `res/colors.ts` / `res/dimens.ts` | 品牌色、渐变色、列表项高度                |
| 它只是 store 的运行时计算/派生逻辑？                         | `state.ts`                          | computed getters、actions                 |
| 它是纯运行时临时状态（不需要持久化或被 bench_env 读写）？    | `state.ts`（非持久化字段）          | 加载中标志、UI 交互中间态、弹窗开关       |

> **颜色归属说明**：独立颜色常量（品牌色、主题色变体）放 `res/colors.ts`（见 `APP_DESIGN_SPEC.md`）。但当颜色是**数据结构的一个属性**（如服务目录项的 `{ id, icon, color, label }`），整个结构放 `constants.ts`，color 不需要单独抽到 `colors.ts`——除非该颜色值在其他地方也需要独立引用。

### 2.3 常见错误

```ts
// ❌ 设置默认值硬编码在 state.ts
const DEFAULT_SETTINGS = { darkMode: false, fontSize: 14 };

// ❌ 设置默认值硬编码在 data/index.ts
export const REDDIT_CONFIG = {
  settings: { nsfw: false, autoplay: true }, // 应在 defaults.json
};

// ❌ 设置默认值硬编码在 types.ts
export const DEFAULT_CALENDAR_SETTINGS: CalendarSettings = { ... };

// ✅ 设置默认值在 defaults.json
// data/defaults.json
{ "settings": { "darkMode": false, "fontSize": 14 } }

// ✅ state.ts 从 <APPNAME>_CONFIG 读取（由 data/index.ts 导出）
const initialState = { settings: ALIPAY_CONFIG.settings };
```

```ts
// ❌ 服务目录（含 icon/color）放在 defaults.json
{ "mainServices": [{ "id": "pay", "icon": "IcPay", "color": "#1677ff" }] }

// ✅ 服务目录放在 constants.ts，defaults.json 只存 ID 列表
// constants.ts — icon 从 res/icons.tsx 导入（组件引用）
import { IcPay, IcScan } from './res/icons';
export const MAIN_SERVICES = [
  { id: "pay", icon: IcPay, color: "#1677ff", label: "付款" },
  { id: "scan", icon: IcScan, color: "#ff6600", label: "扫一扫" },
];

// constants.ts — 或用 icon 字符串名（数据驱动渲染，配合 IconRenderer）
export const MAIN_SERVICES = [
  { id: "pay", icon: "IcPay", color: "#1677ff", label: "付款" },
];

// defaults.json — 如果用户可配置"显示哪些服务"
{ "mainServiceIds": ["pay", "transfer", "scan"] }
```

> **icon 引用方式**：`constants.ts` 中的 icon 有两种合法写法：
>
> 1. **直接导入组件**（`import { IcPay } from './res/icons'`）— JSX 中直接 `<item.icon size={22} />`
> 2. **字符串名**（`"IcPay"`）— 需配合 `<IconRenderer name={item.icon} />` 渲染
>
> 两种方式的 icon 来源都**必须是 `res/icons.tsx` 中的 `Ic*` 别名**，禁止使用原始 Lucide 名。

---

## 三、Settings 规范

Settings（设置）是最容易出问题的领域，因为它横跨"静态结构"和"用户数据"。以下规则**强制执行**。

### 3.1 命名

| 规则                       | 说明                                                                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `defaults.json` 中的 key | **必须**叫 `settings`                                                                                                   |
| `state.ts` 中的字段      | **必须**叫 `settings`                                                                                                   |
| 类型名                     | `<App>Settings`（如 `AlipaySettings`、`MapSettings`）                                                                     |
| Store action               | 扁平：`updateSettings(patch)`；嵌套：分类 `updateXxx(patch)`。`setSettings(updater)` 函数式更新可接受但不推荐 — 见 §5.2 |

**唯一例外**：系统 Settings App 使用 `preferences`（对应 Android `SharedPreferences` 概念）。

```ts
// ❌ 混用命名
interface AlipayState {
  preferences: AlipayPreferences;  // 不叫 preferences
  setPreferences: (p: Partial<AlipayPreferences>) => void;
}

// ❌ 散落字段
interface XState {
  showInteractionCounts: boolean;  // 应归入 settings
  enablePostSwipeGesture: boolean;
}

// ✅ 统一命名
interface AlipayState {
  settings: AlipaySettings;
  updateGeneral: (patch: Partial<GeneralSettings>) => void;
}
```

### 3.2 结构：嵌套 vs 扁平

**规则**：设置项的嵌套层级**必须与设置页面的路由层级一一对应**。

判断标准：

- 如果 App 有 **1 个设置页面**（所有设置平铺在一页）→ `settings` 可以是扁平的
- 如果 App 有 **多级设置页面**（如"通用设置"→"深色模式"）→ `settings` 必须嵌套

**示例：Alipay 设置页面层级与数据结构的对应关系**

```
路由                              defaults.json 结构
─────────────────────             ──────────────────────
/settings                         settings
├── /settings/payment               ├── payment
│   ├── /settings/pay-order         │   ├── payOrder
│   └── /settings/fast-pay          │   └── fastPay
├── /settings/notifications         ├── notifications
│   └── (内容平铺)                  │   └── { tradeSecurity, ... }
└── /settings/general               └── general
    ├── /settings/dark-mode             ├── darkMode
    ├── /settings/font-size             ├── fontSizeLevel
    ├── /settings/speed-mode            ├── speedModeEnabled
    ├── /settings/home-manage           ├── homeManage
    └── /settings/my-manage             └── myManage
```

```json
// ✅ defaults.json — 嵌套结构与路由对应（摘自 Alipay 实际数据）
{
  "settings": {
    "payment": {
      "payOrder": { "mode": "system", "customOrderIds": ["yuebao", "balance", "ccb"] },
      "fastPay": { "enabled": false, "noPwdEnabled": false, "easterEggEnabled": true }
    },
    "notifications": {
      "tradeSecurity": true,
      "service": true,
      "activity": true,
      "sound": true,
      "vibration": true
    },
    "general": {
      "darkMode": { "followSystem": false, "mode": "light" },
      "fontSizeLevel": 2,
      "speedModeEnabled": false,
      "homeManage": { "searchBoxRecommendEnabled": true, "voiceFloatEnabled": false, "..." : "..." },
      "myManage": { "yuebao": true, "huabei": true, "..." : "..." }
    }
  }
}
```

```json
// ❌ 扁平结构 — 多级页面但所有字段平铺
{
  "settings": {
    "payOrderMode": "system",
    "fastPayEnabled": false,
    "fastPayNoPwd": false,
    "tradeSecurity": true,
    "darkModeMode": "light",
    "fontSizeLevel": 2,
    "speedModeEnabled": false,
    "searchBoxRecommendEnabled": true
  }
}
```

**示例：Reddit 只有一个设置页 → 扁平是合理的**

```json
{
  "settings": {
    "nsfw": false,
    "autoplay": true,
    "theme": "system",
    "reducedAnimations": false
  }
}
```

### 3.3 bench_env 路径约定

`bench_env` 通过 `settings.xxx.yyy` 路径访问设置项：

```python
# bench_env/task/<app>/tasks.py 或 bench_env/task/<app>/defs/<TaskName>.py
class ToggleDarkMode(CriteriaTask):
    criteria = {
        "settings.general.darkMode.mode": "dark"
    }
```

路径规则：

- 从 `settings` 开始（不需要 App 前缀）
- 用 `.` 分隔嵌套层级
- 叶子节点是设置项的实际值

因此，**修改设置结构后，必须检查 `bench_env/task/<app>/tasks.py` 与
`bench_env/task/<app>/defs/*.py` 中的路径是否需要同步更新**。

---

## 四、`data/index.ts` 导出模式

### 4.1 标准骨架

```ts
// data/index.ts — 标准模式
// 导出名统一为 <APPNAME>_CONFIG（如 ALIPAY_CONFIG、MAP_CONFIG）
import defaults from './defaults.json';
import { ALIPAY_CONSTANTS } from '../constants';

export const ALIPAY_CONFIG = {
  ...ALIPAY_CONSTANTS,
  ...defaults,
} as const;
```

### 4.2 允许的扩展

| 场景                                                    | 做法                     | 示例 App                      |
| ------------------------------------------------------- | ------------------------ | ----------------------------- |
| 需要合并 constants 中的服务目录与 defaults 中的 ID 列表 | `resolveById()`        | Alipay                        |
| 需要解析资产路径                                        | `resolveAssetsDeep()`  | Reddit¹, RedBook, Wechat     |
| 需要解析时间戳为当前时间的相对偏移                      | 时间戳解析函数²         | Wechat, TencentMeeting, Notes |
| 需要计算派生数据                                        | 在 spread 后添加计算字段 | WechatReading                 |

> ¹ Reddit 同时保留了 `import.meta.glob` 方案（`avatarSources.ts` / `subredditIconSources.ts`）处理头像和板块图标，属历史实现。两者共存，新 App 统一用 `resolveAssetsDeep` 即可。
>
> ² 各 App 的时间戳解析函数命名不统一（Wechat 叫 `resolveTimestamp`，TencentMeeting 也叫 `resolveTimestamp`，Notes 叫 `parseTimestamp`），但逻辑相同：将 `defaults.json` 中的绝对时间戳或相对偏移量（负数 = 距当前时间的毫秒偏移，如 `-86400000` = 1 天前）转为运行时绝对时间戳。这样 benchmark 每次运行时，数据中的时间都是"当前时间的相对值"，避免数据过期。

### 4.3 禁止在 `data/index.ts` 中做的事

```ts
// ❌ 硬编码默认值（settings 内容应在 defaults.json）
export const REDDIT_CONFIG = {
  settings: { darkMode: false, nsfw: false },
};

// ❌ 定义常量
const SEARCH_CATEGORIES = [...];  // 应在 constants.ts

// ❌ 定义类型
interface AppConfig { ... }  // 应在 types.ts
```

### 4.4 大数据分离与懒加载

当 App 有大量内容数据（爬取的帖子、视频、商品等），**不应**全部塞进 `defaults.json`——这会拖慢 Vite dev server 的 ESM 转换。应拆分为独立文件并通过 `loader.ts` 懒加载。

#### data 目录完整结构

```
data/
├── defaults.json           ← 初始状态（用户、设置、少量种子数据）
├── index.ts                ← 导出 <APP>_CONFIG（同步，只处理 defaults + constants）
├── loader.ts               ← 大数据懒加载器（异步 fetch）
└── <content>.json          ← 大型内容数据集（帖子、视频、商品等）
```

#### 两层数据的职责区分

| 层                 | 文件                     | 加载方式                    | 时机                   | bench_env 可访问          |
| ------------------ | ------------------------ | --------------------------- | ---------------------- | ------------------------- |
| **初始状态** | `defaults.json`        | ESM import（同步）          | App 代码加载时         | 是（通过 store 初始状态） |
| **大数据**   | `*.json` / `*.jsonl` | `loader.ts` fetch（异步） | App 首次渲染时按需加载 | 取决于消费模式*           |

> \* **bench_env 与大数据的访问关系**：`__SIM__.getState()` 返回的是所有 App 的 **Zustand store 快照**（`getAllStoreStates()`），完整数据流见 §六。因此：
>
> - **store action 模式**（X、RedBook）：loader 加载后通过 action `set` 进 store → **bench_env 可访问**
> - **hook 模式**（Bilibili、Ebay、Spotify）：数据只在 loader 模块级缓存中，不进 store → **bench_env 不可访问**
> - **service 模式**（Railway12306）：数据在 service 层，不进 store → **bench_env 不可访问**
>
> 如果某个大数据字段需要被 bench_env 的 task 读写，该 App 必须使用 **store action 模式**消费数据。

#### `loader.ts` 标准模式

> **关于 `fetch` 的使用**：`CLAUDE.md` 规定外部 HTTP 请求必须用 `NetworkService`（`netJson`/`netFetch`）以避免 CORS。但 `loader.ts` 加载的是**本地静态 JSON**（`new URL('./xxx.json', import.meta.url)`），走的是 Vite dev server 同源伺服，不存在 CORS 问题，因此直接 `fetch` 是正确做法。所有现有 App 的 loader 均使用原生 `fetch`。

```ts
// data/loader.ts
let cachedData: PostData[] | null = null;

export async function loadPosts(): Promise<PostData[]> {
  if (cachedData) return cachedData;
  const url = new URL('./posts.json', import.meta.url);
  const res = await fetch(url);  // 本地静态 JSON，无需 NetworkService
  const raw = await res.json();
  cachedData = processPosts(raw.posts);
  return cachedData;
}

export function getPostsSync(): PostData[] | null {
  return cachedData;
}

export async function preload(): Promise<void> {
  await loadPosts();
}
```

#### 什么时候拆分

| 条件                                       | 做法                      |
| ------------------------------------------ | ------------------------- |
| `defaults.json` < 100KB（~2000 行 JSON） | 不拆，全放 defaults       |
| 内容数据 > 100KB 或来自爬虫/生成器         | 拆出独立 JSON + loader.ts |

#### 图片资源引用

JSON 数据中引用的图片（头像、封面等）使用 `resolveAssetsDeep()` 统一处理。它递归遍历数据树，把相对路径转为 `/@app-assets/<AppName>/xxx`，由 Vite 插件 `serveAppAssetsPlugin` 静态伺服 `apps/<AppName>/assets/` 目录。

```ts
// data/index.ts — 标准图片资源处理
const asset = (r: unknown) => {
  const s = String(r ?? '').trim();
  return (!s || s.startsWith('http')) ? s : `/@app-assets/Wechat/${s}`;
};
const resolved = resolveAssetsDeep(defaults);
```

> Reddit 的 `import.meta.glob` 历史方案详见 §4.2 脚注¹。新 App 统一用 `resolveAssetsDeep` 即可。

#### 现有 App 的大数据模式

| App          | 大数据文件                                                                                                                                          | 加载方式     |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| RedBook      | `users.json`（167K 行）、`notes.json`（230K 行）                                                                                                | loader fetch |
| Bilibili     | `videos.json`、`videoComments.json`、`videoTags.json`、`videoOnline.json`、`commenters.json`、`authors.json`、`rankings.json`（7 个） | loader fetch |
| X            | `users.json`、`posts.json`、`replies.json`                                                                                                    | loader fetch |
| Reddit       | `posts.json`（276K 行）                                                                                                                           | loader fetch |
| Ebay         | `products.json`（224K 行）、`categories.json`                                                                                                   | loader fetch |
| Spotify      | `categories.json`、`playlistTracks.json`                                                                                                        | loader fetch |
| Railway12306 | `stationList.json`、`cityList.json`、`stationServices.json`、`cities.json`、`countries.json`（5 个）+ `seed/trainCatalog.json`（动态 import）                 | loader fetch |

#### 关键规则

1. **`index.ts` 不导入大数据文件**——`index.ts` 只处理 `defaults.json` + constants，保持同步
2. **`loader.ts` 与 `index.ts` 独立**——loader 由 store 或 hooks 调用，不参与 `<APP>_CONFIG` 构建
3. **大数据不影响 `<APP>_CONFIG` 类型**——CONFIG 只包含初始状态；大数据由 store 的 action（如 `_loadImportedData`）填充到运行时 state
4. **bench_env 只能访问 store 中的数据**——初始状态（来自 `defaults.json`）一定在 store 中；大数据是否可访问取决于消费模式（store action 模式可访问，hook/service 模式不可访问）。如果某个大数据字段需要被 bench_env task 读写，必须通过 store action 加载进 store

#### 数据文件命名规范

大数据 JSON 文件统一 **camelCase**，与 loader 函数中的内容类型一致：

| 推荐                                   | 不推荐                                         | 说明                                   |
| -------------------------------------- | ---------------------------------------------- | -------------------------------------- |
| `posts.json`                         | `reddit_data.json`                           | 单一大数据文件直接用内容类型           |
| `users.json`, `notes.json`         | `crawled-users.json`, `crawled-notes.json` | 不加来源前缀（crawled-、imported- 等） |
| `videoComments.json`                 | `video-comments.json`                        | 多词用 camelCase                       |
| `products.json`, `categories.json` | `catalog.products.json`                      | 不加命名空间前缀，按内容类型分文件     |

**新增文件必须遵循**：不加 App 名前缀、不加来源/类型前缀；多个文件时按内容类型（posts、users、products）命名。已有文件的重命名为低优先级，仅在有其他 data 层改动时顺带修正（见 §9 偏差表）。

#### loader.ts 导出规范

每个 `loader.ts` 统一导出三类函数：

```ts
// 异步加载（首次 fetch + 缓存）
export async function load<ContentType>(): Promise<T>

// 同步读取缓存（未加载返回 null）
export function get<ContentType>Sync(): T | null

// 预加载入口（统一签名）
export async function preload(): Promise<void>
```

命名规则：

- **load** + 内容类型（复数）：`loadPosts`, `loadVideos`, `loadProducts`；不加 App 名前缀（不用 `loadRedditPosts`）；不加 Map/Data 等后缀（不用 `loadCategoryDataMap`，用 `loadCategories`）
- **get** + 内容类型 + **Sync**：`getPostsSync`, `getVideosSync`
- **preload()**：统一返回 `Promise<void>`，内部依次调用所有 `load*`

多个数据集时，每组一对 `loadXxx` / `getXxxSync`；`preload()` 内部调用全部 `load*` 即可。

#### preload 统一接口

所有有 `loader.ts` 的 App **必须**导出 `preload()`，签名统一为 `() => Promise<void>`。OS 层通过此函数预加载数据（如 `waitForData`）。所有现有 App 的 loader 均已对齐此规范，见 §9「大数据与 loader 命名」。

#### 数据消费模式

大数据加载后如何让组件/逻辑消费，取决于两个判断条件：

```
数据在运行时会被修改吗？（用户点赞、发帖、删帖等）
  ├── 是 → 必须进 store（响应式，UI 自动更新）
  │         方式：store action 或 afterHydration
  └── 否（只读参考数据）
        ├── 有非 React 消费者？（其他 service、API 层等）
        │     └── 是 → service 层（提供纯函数 API + 派生索引）
        └── 否 → hook（最简单）
```

**推荐模式：**

| 模式                   | 何时使用                                                         | 做法                                                                       | 示例 App                |
| ---------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------- |
| **hook**         | 只读数据，仅 React 组件消费                                      | `useLazyData(getSyncFn, loadFn, fallback)` — loader 缓存即真相源        | Bilibili, Ebay, Spotify |
| **store action** | 数据在运行时会被用户操作修改                                     | App 入口 `useEffect` 调 store action，action 内调 loader 后 `setState` | X, RedBook              |
| **service 层**   | 需要派生索引（Map 等）或有非 React 消费者（其他 service/API 层） | service 调 loader 获取原始数据，自行构建派生结构，暴露纯函数 API           | Railway12306            |

> **afterHydration** 是 store action 的一个变体——在 zustand persist 恢复后触发，适合数据需与已持久化的用户数据合并的场景（如 Reddit 的帖子与用户发帖合并）。不是独立模式。

**hook 标准实现**（Bilibili `useLazyData`）：

```ts
function useLazyData<T>(getSync: () => T | null, loadAsync: () => Promise<T>, fallback: T): T {
  const [data, setData] = useState<T>(() => getSync() ?? fallback);
  useEffect(() => {
    if (getSync() === null) {
      loadAsync().then(setData);
    }
  }, []);
  return data;
}

// 使用
export function useVideos(): BilibiliVideo[] {
  return useLazyData(getVideosSync, loadVideos, []);
}
```

---

## 五、`state.ts` Store 规范

### 5.1 初始状态

```ts
// ✅ 从 data/index.ts 导出的 <APPNAME>_CONFIG 读取
import { ALIPAY_CONFIG } from './data';

const initialState: AlipayState = {
  settings: ALIPAY_CONFIG.settings,
  user: ALIPAY_CONFIG.user,
  // ...
};
```

```ts
// ❌ 硬编码默认值
const initialState: AppState = {
  settings: {
    darkMode: false,
    fontSize: 14,
  },
};
```

### 5.2 Settings Action 模式

按 settings 嵌套深度选择模式：

**扁平 settings（1 层）→ 浅 Partial spread**

适用于只有一个设置页面、所有设置项平铺的 App（如 Calendar、WechatReading、TencentMeeting、Railway12306）。

```ts
updateSettings: (patch: Partial<AppSettings>) => {
  set(state => ({ settings: { ...state.settings, ...patch } }));
},
```

调用方式：

```ts
updateSettings({ theme: 'dark' });
```

**嵌套 settings（2+ 层）→ 分类 updater**

适用于有多级设置页面的 App（如 Map、Alipay）。每个 updater 对应一个设置子类，类型精确到子类型。

```ts
updatePayOrder: (patch: Partial<PayOrderSettings>) => {
  set(state => ({
    settings: {
      ...state.settings,
      payment: { ...state.settings.payment, payOrder: { ...state.settings.payment.payOrder, ...patch } },
    },
  }));
},
updateDarkMode: (patch: Partial<DarkModeSettings>) => {
  set(state => ({
    settings: {
      ...state.settings,
      general: { ...state.settings.general, darkMode: { ...state.settings.general.darkMode, ...patch } },
    },
  }));
},
updateNotifications: (patch: Partial<NotificationSettings>) => {
  set(state => ({
    settings: { ...state.settings, notifications: { ...state.settings.notifications, ...patch } },
  }));
},
```

调用方式：

```ts
updateDarkMode({ mode: 'dark' });
updatePayOrder({ mode: 'custom' });
updateNotifications({ sound: false });
```

**可接受但不推荐的模式**：

```ts
// ⚠️ 函数式 updater — 灵活但实现复杂，调用者需要手动 spread
// Alipay 当前使用此模式，功能正确但推荐新 App 使用分类 updater
setSettings: (updater: AppSettings | ((prev: AppSettings) => AppSettings)) => void;
```

**不推荐的模式**：

```ts
// ❌ 为每个设置项写单独的 setter — 过于碎片化
setDarkMode: (mode: string) => void;
setFontSize: (size: number) => void;
setAutoplay: (enabled: boolean) => void;
// ... 20 个 setter

// ❌ 纯整体替换 setter（要求调用者传完整对象，非函数式）— 容易丢失字段
setSettings: (settings: AppSettings) => void;
```

### 5.3 禁止在 store actions 中定义查询型 getter

> ⛔ **此规则已导致多个 App 出现"交互后 UI 不更新"的严重 bug，务必遵守。**

Zustand 的 action 是在 `create()` 时通过闭包创建的**普通函数**，引用在 store 创建后永远不变。组件通过 `useStore(s => s.isLiked)` 订阅一个函数引用时，Zustand 的 `Object.is` 比较永远返回 `true`，**组件不会因底层数据变化而重渲染**。

```ts
// ❌ 禁止：在 store actions 中定义查询型 getter
interface MyActions {
  isLiked: (postId: string) => boolean;       // 查询函数
  isFollowing: (userId: string) => boolean;   // 查询函数
  getEventById: (id: string) => Event;        // 查询函数
  checkInteractions: (vid: string) => { liked: boolean; coined: boolean };
  toggleLike: (postId: string) => void;       // ✅ 这是 mutation，没问题
}
```

```tsx
// ❌ 禁止：组件订阅 store 中的函数引用
const isLiked = useStore(s => s.isLiked);     // 永远是同一个引用，不触发重渲染
const isFollowing = useStore(s => s.isFollowing);
```

**正确做法**：组件直接订阅数据，在本地派生查询结果。

```tsx
// ✅ 订阅数据数组 → 数据变化时引用变 → 触发重渲染
const likedPostIds = useStore(s => s.likedPostIds);
const isLiked = (id: string) => likedPostIds.includes(id);

// ✅ 或使用 memoSelector 派生 Set（适合列表场景，O(1) 查找）
export const selectLikedSongIds = memoSelector(
  (s: Store) => s.likedSongs,
  (songs) => new Set(songs.map(t => t.id)),
);
// 组件中：
const likedIds = useStore(selectLikedSongIds);
const isLiked = (id: string) => likedIds.has(id);

// ✅ 订阅 events 数组，本地 .find()
const events = useStore(s => s.events);
const event = events.find(e => e.id === eventId);
```

**判断原则**：store 的 `actions` 只应包含 **mutation**（修改状态的操作），不应包含 **query**（只读取不修改的操作）。Query 逻辑应在组件内、`memoSelector` 或独立工具函数中完成。

### 5.4 localStorage key 与 persist 配置

必须与 `manifest.id` 一致（即 `appId`），在 `CLAUDE.md` 中已有规定。

使用 `createAppStoreWithActions` 时，第一个参数 `appId` 即为 persist name，无需额外配置：

```ts
// ✅ appId 'alipay' 自动用作 localStorage key
export const useAlipayStore = createAppStoreWithActions<AlipayState, AlipayActions>(
  'alipay',       // ← 必须与 manifest.id 一致
  initialState,
  (set, get) => ({ /* actions */ }),
);
```

```ts
// ❌ persistName 与 manifest.id 不一致
export const useAlipayStore = createAppStoreWithActions<AlipayState, AlipayActions>(
  'alipay-store',  // manifest.id 是 'alipay'，这里不应加后缀
  initialState,
  (set, get) => ({ /* actions */ }),
);
```

---

## 六、`getState()` 与 bench_env 状态访问

§一指出 bench_env 通过路径读写 App 状态。本节说明底层机制——store 状态如何流向 bench_env，以及开发者需要遵守的约定。

### 6.1 数据流

```
[JS 端]
window.__SIM__.getState()
  → getAllAppStates()                      // os/AppStateRegistry.ts
    → getAllStoreStates()                  // os/createAppStore.ts
      → 遍历 storeRegistry 中每个 store
        1. store.getState()                // zustand 原始状态（含 action 函数）
        2. stateAdapter(raw)               // 如注册了适配器，变形/补齐
        3. 过滤 typeof v !== 'function'    // 排除 action 函数
      → { [appId]: { ...数据字段 } }

[Python 端]
env._get_state()                           // bench_env/env/mobile_gym.py
  → page.evaluate("window.__SIM__.getState()")
  → { "os": {...}, "apps": { "wechat": {...}, "alipay": {...}, ... } }
  → BaseApp(state["apps"]["wechat"]).get("settings.general.darkMode.mode")
```

bench_env task 通过 `app.get(path)` / `app.get_list(path)` 按点分路径遍历 App dict。**在 `BaseApp(appState)` 语境下，路径起点就是 store 的顶层 key**。

### 6.2 暴露规则

`getAllStoreStates()` 返回 store 的**纯数据快照**：

| 类型                             | 是否暴露 | diff 检查     | 说明                                                                                    |
| -------------------------------- | -------- | ------------- | --------------------------------------------------------------------------------------- |
| 数据字段（对象、数组、基本类型） | ✅ 暴露  | ✅ 检查       | `user`, `settings`, `conversations` 等                                            |
| Action 函数                      | ❌ 排除  | —            | `updateSettings`, `toggleXxx` 等（`typeof === 'function'`）                       |
| Getter 函数                      | ❌ 排除  | —            | 同上，函数值一律过滤                                                                    |
| `_temp` 临时状态               | ✅ 暴露  | ❌ 默认不告警 | `_temp.queryLoading` 等——可读取；diff 后在过滤阶段按 `apps.*._temp` 忽略（§6.6） |

**关键推论**：

- 如果需要某个**派生值**对 bench_env 可见，不能用 store getter 函数（会被过滤），要么作为 state 字段存储，要么通过 `registerStateAdapter` 补齐（§6.4）
- 运行时 UI 临时状态统一归入 `_temp` 字段（§6.6），最终不会出现在 unexpected warnings 中（通过 `always_ignore` + `filter_unexpected_changes` 过滤）

### 6.3 Store 字段与 bench_env 路径的映射

在 `BaseApp(appState)` / `app.get(...)` 语境下，store 的顶层 key **就是**路径的第一段（全局根路径对应 `apps.<appId>.<key>`）：

```
Store state                          bench_env 路径
──────────                           ────────────
{ user: { name: "张三" } }          app.get("user.name")
{ settings: { general: {...} } }     app.get("settings.general.darkMode.mode")
{ conversations: [...] }             app.get("conversations")
{ transferRecords: [...] }           app.get("transferRecords")
```

因此：

- `defaults.json` 的 key 命名（§七）**直接决定** bench_env 的访问路径
- 大数据通过 store action 注入的字段（如 X 的 `posts`、`users`）也成为路径的一部分
- **修改 store 顶层字段名 = 修改 bench_env 外部 API**，必须同步更新 task 定义文件（`tasks.py` / `defs/*.py`）中的路径和 `bench_env/task/<app>/app.py` 中的 property

### 6.4 `registerStateAdapter` — 状态适配器

当 store 内部结构不适合直接暴露给 bench_env 时，使用 `registerStateAdapter` 在 `getState()` 输出时变形/补齐：

```ts
// state.ts 底部
import { registerStateAdapter } from '../../os/createAppStore';

registerStateAdapter('railway12306', (state) => ({
  ...state,
  // 补齐派生字段，让 bench_env 能直接按预期路径读取
  searchForm: {
    from: state.from,
    to: state.to,
    date: state.date,
  },
}));
```

**使用场景**：

- Store 内部用扁平字段，但 bench_env 期望嵌套结构（如上例）
- 需要从运行时数据计算派生字段（如 Clock 补齐 `alarms`）
- 保持 `getState()` 向后兼容（内部重构不影响外部路径）

**规则**：

- Adapter **只影响 `getState()` 外部视图**，不影响 store 内部读写
- 放在 `state.ts` 底部，紧跟 store 创建之后
- Adapter 应保持轻量——`getState()` 每次调用都会执行（有引用缓存优化，store 状态引用不变时跳过重算，但仍避免昂贵计算）
- 如果 adapter 依赖了 store 之外的状态变化，需调用 `invalidateStateCache(appId)` 使缓存失效

**现有使用**：X、Railway12306、Clock、WechatReading、Compass

### 6.5 bench_env `BaseApp` 子类

每个 App 可在 `bench_env/task/<app>/app.py` 中定义 `BaseApp` 子类，提供 property 快捷访问器：

```python
class Wechat(BaseApp):
    @property
    def user_name(self) -> str:
        return self.user.get("name", "")

    @property
    def settings(self) -> dict:
        return self.get("settings", {})

    def find_contact(self, name: str) -> dict | None:
        for c in self.contacts:
            if c.get("name") == name:
                return c
        return None
```

这些 property 与 store 字段**紧密耦合**——修改 store 结构后，对应的 `app.py` 也需要同步更新。

### 6.6 `_temp` — 运行时临时状态

Store 中部分字段是运行时临时状态（加载标志、查询中间态、UI 导航状态等）。这些字段：

- **不持久化**：`createAppStoreWithActions` 的 `defaultPartialize` 自动排除 `_temp`
- **对 bench_env 可见**：`getState()` 正常返回，task 可按需通过 `app.get("_temp.xxx")` 读取
- **diff 默认不告警**：`StateComparator.diff_states()` 仍会产出 `_temp` 相关差异，但 `BaseTask.always_ignore` 中的 `apps.*._temp` 会在 `StateComparator.filter_unexpected_changes()` 阶段过滤掉，不产生 unexpected warnings

#### 规则

所有运行时临时字段统一归入 store 的 **`_temp` 顶层字段**：

```ts
interface XState {
  // 持久化业务数据
  posts: XPost[];
  settings: { showInteractionCounts: boolean; enablePostSwipeGesture: boolean };

  // 运行时临时状态（不持久化，diff 不检查）
  _temp: {
    currentSearchQuery: string;
    repliesLoading: boolean;
    repliesLoaded: boolean;
  };
}
```

#### 判断标准：一个字段该放顶层还是 `_temp`？

| 条件                                             | 放顶层 | 放 `_temp` |
| ------------------------------------------------ | ------ | ------------ |
| bench_env task 可能需要检查其变化（任务目标）    | ✅     |              |
| bench_env 需要替换其初始值（场景参数化）         | ✅     |              |
| 是用户操作产生的有意义业务数据（草稿、选中项等） | ✅     |              |
| 仅影响 UI 渲染，不影响业务状态                   |        | ✅           |
| 是加载/查询的中间态（loading, error, ready）     |        | ✅           |
| 是 UI 交互的中间态（焦点、拖拽位置、弹窗开关）   |        | ✅           |

**常见易错判断**：

```ts
// ❌ createDraft 放 _temp — 草稿是业务数据，task 可能检查"用户是否开始写帖子"
_temp: { createDraft: { title: '', body: '' } }

// ✅ createDraft 放顶层
createDraft: { title: '', body: '' }

// ❌ queryLoading 放顶层 — 加载态是纯 UI 状态，diff 变化无业务含义
queryLoading: boolean;

// ✅ queryLoading 放 _temp
_temp: { queryLoading: boolean }
```

#### 实现细节

**JS 端**：`createAppStoreWithActions` 的 `defaultPartialize` 自动排除 `_temp`（与排除 function 同级处理），App 无需在自定义 `partialize` 中重复排除。

**Python 端**：通过 `always_ignore` 通配符机制实现。`BaseTask.always_ignore` 包含 `apps.*._temp`，`StateComparator.filter_unexpected_changes` 的 `_is_expected()` 支持 `*` 匹配任意路径段：

```python
# bench_env/task/base.py
always_ignore: ClassVar[list[str]] = [
    "os.time",
    "os.isLauncherVisible",
    "os.runningApps",
    "os.activeAppId",
    "apps.*._temp",      # * 匹配任意 appId
]
```

`*` 通配符的匹配规则：

- `apps.*._temp` 精确匹配 `apps.wechat._temp`（`*` → `wechat`）
- `apps.*._temp` 前缀匹配 `apps.wechat._temp.queryLoading`（路径更具体）
- 可与 `[]` 组合使用，如 `apps.*.items[].status`

Task 仍可主动读取临时字段：

```python
is_loading = app.get("_temp.queryLoading", False)
```

#### 待迁移的现有 App

> **注意**：`X.currentSearchQuery` 和 `Bilibili.activeVideoId` 虽为非持久化字段，但被 bench_env 任务用于目标判定，属于业务状态，保留在顶层。

`importedUsers`/`importedPosts`（X）、`entities`/`feedIds`（RedBook）等大数据字段**不属于临时状态**——它们是 store action 模式加载的业务数据，bench_env 需要访问。保留在顶层，排除出持久化在各自 `partialize` 中单独处理。

---

## 七、`defaults.json` Key 命名

### 7.1 顶层 Key 命名约定

| Key                      | 含义                 | 示例                                           |
| ------------------------ | -------------------- | ---------------------------------------------- |
| `user`                 | 当前用户信息         | `{ name, avatar, phone }`                    |
| `settings`             | 用户设置             | `{ general, notifications, ... }`            |
| `<contentType>`        | 内容数据（复数形式） | `conversations`, `posts`, `transactions` |
| `<contentType>History` | 历史记录             | `searchHistory`, `browseHistory`           |

### 7.2 禁止的变体

| ❌ 错误             | ✅ 正确        | 原因                  |
| ------------------- | -------------- | --------------------- |
| `initialSettings` | `settings`   | 避免 `initial` 前缀 |
| `preferences`     | `settings`   | 统一术语              |
| `defaultAlarms`   | `alarms`     | 避免 `default` 前缀 |
| `config`          | （按类型拆分） | 太笼统                |

---

## 八、跨层一致性检查清单

修改 App 的状态结构后，按此清单检查：

- [ ] `defaults.json` 的设置字段叫 `settings`
- [ ] `settings` 的嵌套层级与设置页面路由对应
- [ ] `state.ts` 的 `initialState.settings` 从 `APP_CONFIG.settings` 读取，无硬编码默认值
- [ ] `state.ts` 的 action 命名遵循 §5.2 模式（浅 `updateSettings` 或分类 `updateXxx`；`setSettings(updater)` 函数式更新可接受）
- [ ] `state.ts` 的 actions 中**不含查询型 getter**（`isLiked`、`isFollowing`、`getXxxById` 等只读函数），查询逻辑在组件内或 `memoSelector` 中完成（§5.3）
- [ ] `constants.ts` 中无用户可修改的设置默认值
- [ ] `defaults.json` 中无带 icon/color/label 的静态结构定义
- [ ] `data/index.ts` 不包含硬编码默认值或常量定义
- [ ] `bench_env/task/<app>/tasks.py` / `defs/*.py` 中的路径与新结构一致
- [ ] `bench_env/task/<app>/app.py` 中的 BaseApp 子类 property 与新结构一致
- [ ] 需要 bench_env 访问的派生值已通过 state 字段或 `registerStateAdapter` 暴露（getter 函数会被过滤，见 §6.2）
- [ ] 运行时临时字段（loading、error、UI 中间态等）已归入 `_temp`，不散落在顶层（§6.6）
- [ ] 页面组件中的 store selector 路径与新结构一致

---

## 九、现有 App 合规状态
