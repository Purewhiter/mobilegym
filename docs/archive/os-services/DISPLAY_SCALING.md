# 显示缩放与字体大小调节 - 实现规范

## 1. 背景

Android 系统提供两种独立的缩放设置：
- **字体大小**：只影响文字
- **显示大小**：影响整个 UI（通过改变逻辑视口大小）

本项目需要模拟这两种行为。

---

## 2. Android 原理

Android 的缩放分为三个层次：系统字体大小、系统显示大小、App 内部缩放。

### 2.1 系统字体大小（设置 → 显示 → 字体大小）

- 系统维护一个 `fontScale` 值（默认 1.0）
- **只影响使用 `sp` 单位的文字**，布局尺寸（`dp` 单位）不受影响
- 视口大小不变

```
fontScale = 1.0  → 16sp = 48px
fontScale = 1.3  → 16sp = 62.4px

视口始终是 360×800dp
```

### 2.2 系统显示大小（设置 → 显示 → 显示大小）

- 系统通过修改 DPI 来改变逻辑视口大小
- 所有 dp/sp 单位都受影响
- 物理分辨率不变，逻辑视口变化

```
默认 DPI=480  → 逻辑视口 360×800dp
放大 DPI=560  → 逻辑视口 309×686dp（所有元素看起来更大）
缩小 DPI=420  → 逻辑视口 411×914dp（所有元素看起来更小）

公式：逻辑宽度 = 物理宽度 / (DPI / 160)
```

### 2.3 App 内部缩放（App 自行实现）

许多 App 有自己的「字体大小」设置，**独立于系统设置**，但不同 App 的实际行为差异很大：

- **微信**（设置 → 通用 → 字体大小）：虽然叫"字体大小"，但实际是**整体 UI 缩放**——文字、图标、气泡、间距都跟着变大，本质是对聊天区域容器做整体缩放
- **支付宝**（设置 → 通用 → 字体大小）：**只缩放文字**，图标和布局间距不变，是真正的 fontScale 行为
- **浏览器** WebView：`textZoom` 只缩文字；双指捏合整体缩放
- **相册/地图**：`ScaleGestureDetector` + `Canvas.scale()` 缩放视觉内容

App 内部缩放的实现方式各异，系统不介入。总结两种主流策略：

| 策略 | 代表 App | 影响范围 | 实现方式 |
|------|---------|---------|---------|
| 整体缩放 | 微信 | 文字 + 图标 + 间距 | 容器级 scale/zoom |
| 纯文字缩放 | 支付宝 | 仅文字 | 逐个调整文字 sp/fontSize |

### 2.4 三者对比

| 特性 | 系统字体大小 | 系统显示大小 | App 内部缩放 |
|------|------------|------------|-------------|
| 谁控制 | 系统设置 | 系统设置 | App 自己 |
| 影响范围 | 仅 sp 文字 | 整个 UI | App 自定义（可能整体缩放） |
| 视口变化 | 不变 | 改变 | 不变 |
| 实现原理 | 修改 sp→px 系数 | 修改系统 DPI | App 内部 scale/zoom |
| 典型值 | 0.85 / 1.0 / 1.15 / 1.3 | 0.85 / 1.0 / 1.15 | App 自定义 |

### 2.5 App 如何适配不同屏幕宽度

Android 中**不存在"App 声明设计宽度，系统帮它缩放"的机制**。App 通过响应式布局适配不同屏幕：

| 屏幕宽度 | App 的做法 |
|----------|-----------|
| 360dp 窄屏 | `match_parent` 自动变窄，列表项自动适配 |
| 412dp 宽屏 | 同样的布局自动变宽，多出空间被 flex/weight 分配 |
| 600dp 平板 | 触发 `layout-sw600dp` 资源限定符，切换到双栏布局 |

---

## 3. 实现状态

### ✅ 已实现：显示缩放（displayScale）

系统级 `displayScale` 通过 CSS `zoom` 在 `SystemShell` 层统一处理，一行代码影响所有 App。

### ⏳ 未实现：字体缩放（fontScale）

fontScale 要求"只缩文字不缩布局"。当前项目中文字和布局都大量使用 Tailwind 的 rem 类（`text-sm`、`p-4`、`h-10` 等），改根 `font-size` 会导致布局尺寸一起变化。要做到只缩文字，需要将所有 App 的文字单位和布局单位分离（文字用 rem/em，布局用 px），改造量极大，暂不实施。

---

## 4. 显示缩放实现（已完成）

### 4.1 配置

```typescript
// os/types.ts
export interface DeviceConfig {
  // ...
  viewportWidth?: number;   // 模拟器逻辑视口宽度，默认 360（用于 App 级 design zoom 计算）
  viewportHeight?: number;  // 模拟器逻辑视口高度，默认 800
  displayScale?: number;    // 可选，默认 1.0
}

// os/data/osConfig.ts
export const DEVICE_CONFIG = {
  // ...
  viewportWidth: 360,
  viewportHeight: 800,
  displayScale: 1.0,  // 1.0=默认, 1.15=更大, 0.85=更小
};
```

### 4.2 SystemShell 实现

在 SystemShell 的根容器内加一层 zoom wrapper，包裹所有内容（StatusBar、Launcher、App 容器、SystemShade 等）：

```tsx
// os/SystemShell.tsx

const displayScale: number = (DEVICE_CONFIG as any).displayScale ?? 1;

return (
  <div className="w-full h-full overflow-hidden bg-black font-sans select-none">
    <div
      className="relative w-full h-full"
      style={displayScale !== 1 ? { zoom: displayScale } : undefined}
    >
      {/* StatusBar, Launcher, App containers, SystemShade, etc. */}
    </div>
  </div>
);
```

当 `displayScale === 1` 时不注入 zoom 属性，零开销。

### 4.3 效果

```
displayScale = 1.0  → 不生效     → 视口 360×800，正常显示
displayScale = 1.15 → zoom: 1.15 → 逻辑视口 ~313×696，元素更大
displayScale = 0.85 → zoom: 0.85 → 逻辑视口 ~424×941，元素更小
```

### 4.4 为什么用 `zoom` 而不是 `transform: scale()`

| 特性 | `transform: scale()` | **`zoom`（采用）** |
|------|----------------------|-------------------|
| 渲染方式 | 位图缩放（先渲染再拉伸） | **重新光栅化**（按目标尺寸渲染） |
| 文字清晰度 | 非整数缩放时模糊 | **始终清晰** |
| 影响布局流 | 不影响（纯视觉缩放） | 影响（等效改变视口大小） |
| 坐标 API | `getBoundingClientRect()` 等需要手动换算 | **自动适配，无需额外处理** |
| 性能 | 创建 GPU 合成层，有额外开销 | **等价于更小/更大窗口的正常渲染** |
| 兼容性 | W3C 标准 | Chrome/Safari/Edge/Firefox 126+ |
| 与 Android 行为对比 | ❌ 位图缩放 | ✅ 等价于修改 DPI 重新渲染 |

`zoom` 的性能开销可忽略。浏览器对 `zoom: 1.15` 的处理等价于在更小窗口中正常渲染，不增加额外的渲染 pass 或合成层。

### 4.5 嵌套 zoom

CSS `zoom` 支持嵌套，效果直接相乘。系统级 displayScale 与 App 级 design zoom 叠加：

```
系统 displayScale: 1.15 × App design zoom: 360/412 ≈ 0.874 → 最终约 1.005
```

---

## 5. App 级设计视口适配（Manifest + OS 统一应用）

> **注意**：`designViewportWidth` 是**模拟器的适配层**，不是 Android 的标准能力。Android 中 App 通过响应式布局适配不同屏幕宽度（见 2.5 节），不存在"声明设计宽度让系统缩放"的机制。本项目引入此字段是因为部分 App 按非 360 宽度硬编码了大量尺寸，全部改成响应式成本过高，用 zoom 适配是务实的 workaround。

当某个 App 的 UI 是按**非 360** 的宽度设计的（如 412px），可在 **manifest** 中声明 `designViewportWidth`，由 **OS 在 SystemShell 层** 对该 App 的 Activity 容器统一应用 zoom，无需在 App 入口手写 zoom 包装。

### 5.1 Manifest 声明

```typescript
// os/types/manifest.ts
export interface AppManifest {
  // ...
  /** 设计视口宽度（逻辑 px）。设置后 OS 应用 zoom = viewportWidth / designViewportWidth */
  designViewportWidth?: number;
}
```

### 5.2 示例：Reddit（按 412 宽设计）

```typescript
// apps/Reddit/manifest.ts
export const manifest: AppManifest = {
  id: 'reddit',
  // ...
  designViewportWidth: 412,
  theme: { ... },
};
```

App 入口 **不再** 需要 zoom 包装，直接渲染内容即可。OS 会根据 `DEVICE_CONFIG.viewportWidth`（默认 360）与 `manifest.designViewportWidth` 计算 `zoom = 360/412` 并应用在该 Activity 的包裹层。

### 5.3 效果与扩展性

- **单一数据源**：设计视口只在 manifest 声明一次，OS 统一应用，避免各 App 重复写 zoom、用错分母。
- **与系统缩放解耦**：`displayScale` 负责「用户选的显示大小」；`designViewportWidth` 负责「该 App 的设计稿宽度」。二者相乘，后续做设置页「显示大小」滑块只需改 `displayScale`。
- **视口可配置**：若将来支持多种分辨率，只需在 `DEVICE_CONFIG` 中设置 `viewportWidth`/`viewportHeight`，各 App 的 design zoom 会自动按新视口重算。

### 5.4 三层缩放叠加

```
最终 zoom = 系统 displayScale
           × (viewportWidth / designViewportWidth)   -- 仅设置了 designViewportWidth 的 App
           × App 内部用户偏好 scale                    -- 如微信「字体大小」，App 自行实现
```

CSS `zoom` 天然支持嵌套相乘，三层互不干扰。

---

## 6. 字体缩放 / App 内缩放分析（未实施）

### 6.1 两种需求

| 需求 | Android 对标 | 影响范围 | 实现难度 |
|------|-------------|---------|---------|
| 系统 fontScale | 设置 → 字体大小 | 仅 sp 文字 | 高（需分离文字/布局单位） |
| App 内缩放 | 微信「字体大小」等 | 整体 UI（文字+图标+布局） | 低（容器加 zoom 即可） |

**App 内整体缩放**（如微信）在技术上很简单——对目标容器加一层 `zoom`，与 `designViewportWidth` 和 `displayScale` 叠加即可。各 App 可自行在 Context/Store 中维护用户偏好的缩放因子。

**系统 fontScale**（只缩文字不缩布局）则困难得多，分析如下。

### 6.2 系统 fontScale 的难点

Android 的 fontScale 只影响 `sp` 单位（文字），不影响 `dp` 单位（布局）。Web 中没有这种原生区分。

理论上可以通过改根 `font-size` 让 `rem` 单位响应 fontScale，但 Tailwind 的 rem 类同时用于文字和布局：

| Tailwind 类 | 计算值 | 类型 |
|-------------|-------|------|
| `text-sm` | 0.875rem | 文字 ✅ 应响应 |
| `text-base` | 1rem | 文字 ✅ 应响应 |
| `p-4` | 1rem | 布局 ❌ 不应响应 |
| `h-10` | 2.5rem | 布局 ❌ 不应响应 |
| `gap-2` | 0.5rem | 布局 ❌ 不应响应 |
| `rounded-lg` | 0.5rem | 布局 ❌ 不应响应 |

改根 `font-size` 后文字和布局一起缩放，等价于另一个 displayScale，不是 fontScale 的语义。

### 6.3 CSS 实现方案（供后续权衡）

#### 方案 A：CSS 变量

```typescript
// os/DisplayService.ts
export function injectCSSVariables() {
  const root = document.documentElement;
  const { fontScale, displayScale } = DEVICE_CONFIG;

  root.style.setProperty('--font-scale', String(fontScale));
  root.style.setProperty('--display-scale', String(displayScale));
  root.style.setProperty('--base-font-size', `${16 * fontScale}px`);
}
```

```css
/* 文字使用 CSS 变量缩放 */
.text-body {
  font-size: calc(14px * var(--font-scale));
}

.text-title {
  font-size: calc(18px * var(--font-scale));
}
```

#### 方案 B：rem 分离（推荐，但改造量大）

```css
/* 在根元素设置 font-size 后，1rem = 16px * fontScale */
html {
  font-size: var(--base-font-size, 16px);
}

/* 文字使用 rem，响应字体缩放 */
.text-body { font-size: 0.875rem; }   /* 14px @ 1x */
.text-title { font-size: 1.125rem; }  /* 18px @ 1x */

/* 布局使用 px，不响应字体缩放 */
.card { padding: 16px; border-radius: 12px; }
```

#### App 层使用

```tsx
// 普通 App - 完全响应系统设置
function NormalApp() {
  return (
    // rem 单位的文字响应 fontScale
    // px 布局不受影响
    <div className="p-[16px]">
      <h1 style={{ fontSize: '1.25rem' }}>标题</h1>
      <p style={{ fontSize: '1rem' }}>正文</p>
    </div>
  );
}

// 有自己字体设置的 App（如微信）— 覆盖策略
function WechatApp() {
  const appFontScale = useWechatSettings().fontScale;

  return (
    <div style={{ fontSize: `${16 * appFontScale}px` }}>
      <h1 style={{ fontSize: '1.25em' }}>标题</h1>
      <p style={{ fontSize: '1em' }}>正文</p>
    </div>
  );
}
```

#### Context 传递

```tsx
// os/DisplayContext.tsx
interface DisplayContextValue {
  logicalWidth: number;
  logicalHeight: number;
  fontScale: number;
  displayScale: number;
  scaledFontSize: (basePx: number) => number;
}

const DisplayContext = createContext<DisplayContextValue>(/* ... */);

function SomeApp() {
  const { fontScale, logicalWidth, scaledFontSize } = useDisplay();
  return (
    <span style={{ fontSize: scaledFontSize(14) }}>
      当前视口宽度：{logicalWidth}dp
    </span>
  );
}
```

### 6.4 改造要求

要让 fontScale 生效，需要将文字单位和布局单位分离：
- 所有文字尺寸使用 `rem` 或 `em`（响应根 font-size）
- 所有布局尺寸使用 `px`（不响应根 font-size）
- 即：全项目把 `p-4`→`p-[16px]`、`h-10`→`h-[40px]` 等布局类改为 px，只保留 `text-*` 用 rem

改造量：涉及所有 App 的所有文件，数千处修改。

### 6.5 建议

系统 fontScale 作为低优先级需求暂缓。如果后续需要：
1. 新增 App 可以从一开始就分离文字（rem）和布局（px）单位
2. 现有 App 按需逐步改造
3. 也可以用 `displayScale` 近似替代（文字和布局一起缩放，用户体验可接受）

App 内整体缩放（如微信「字体大小」）随时可做，只需在 App 内部加一层 zoom 容器，无需系统改造。

---

## 7. 预设值

| 显示大小 | displayScale |
|---------|-------------|
| 小 | 0.85 |
| 默认 | 1.0 |
| 大 | 1.15 |

---

## 8. 实施步骤

1. ~~**Phase 1**：添加配置项 `displayScale`~~ ✅ 已完成
2. ~~**Phase 2**：SystemShell 实现 `zoom: displayScale`~~ ✅ 已完成
3. ~~**Phase 2.5**：App 级 design zoom（manifest `designViewportWidth` + OS 统一应用）~~ ✅ 已完成
4. **Phase 3**：创建设置页面 UI（显示大小滑块）— 待实施
5. **Phase 4**：fontScale 实现 — 暂缓（见第 6 节分析）
