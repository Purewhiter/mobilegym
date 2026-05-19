# 底部系统栏统一协议（Bottom Chrome Unified Protocol）

> 状态：设计稿，待实施
> 目标：对齐真实 Android Window Insets 模型，统一手势条与三键导航栏，建立 App 层底部 chrome 的统一布局、避让、键盘行为、前景色契约。

---

## 一、背景与动机

当前系统只有手势模式，没有三键导航栏。各 App 底部 TabBar / 输入栏 / 浮层的实现方式各异：

- 定位方式混用：`absolute bottom-0`、`sticky`、`relative`、`flex-shrink-0` 四种并存
- 高度从 56px 到 85px 不等，内容区避让高度各自硬编码
- 键盘隐藏行为：有的用 `data-hide-on-keyboard`，有的不处理，有的自己监听键盘高度
- 底部前景色：GestureBar 有一套 DOM 扫描逻辑，无统一入口

这导致新增三键导航模式时，所有 App 都要单独适配。本方案建立统一协议，让 App 无需感知当前是手势模式还是三键模式。

---

## 二、真实 Android Window Insets 模型参考

Android 11+ 的关键 inset 类型：

| Inset 类型 | 手势模式 | 三键模式 | 说明 |
|---|---|---|---|
| `navigationBars` | 0dp | 48dp | 物理导航栏高度 |
| `systemGestures` bottom | ~66dp | 0dp | 手势识别排他区 |
| `ime` | 0 / 键盘高度 | 0 / 键盘高度 | 包含导航栏高度 |

**关键结论：**
1. 手势模式：无物理导航栏，但有 systemGestures 保护区
2. 三键模式：有物理导航栏（48dp），systemGestures = 0（由导航栏接管）
3. 两个值天然互补，取 max 即为底部可见保护区
4. IME inset 包含导航栏，input-bar dock 时实际推起高度 = `ime - navigationBars`

本方案的两变量模型与此对应。

---

## 三、不触碰的范围

- **Launcher** 和 **Recents** 的底部空间：已有足够留白，注入 inset 曾出问题，维持现状
- Launcher hotseat、Recents 清除按钮的底部避让不在本方案内

---

## 四、OS 层改动

### 4.1 新增导航模式字段

**文件：`os/OsStateStore.ts`**

在 preferences 初始值中加入：

```typescript
system_navigation_mode: 'gesture',  // 'gesture' | 'buttons'
```

读取方式：`useOsStateStore(s => s.preferences['system_navigation_mode'])`。设置页开关可后续独立迭代。

---

### 4.2 simulatorConfig 新增尺寸

**文件：`os/data/simulatorConfig.ts`**

```typescript
navigationBarHeight: 48,  // 三键模式导航栏高度（dp）
// bottomGestureHeight: 16 已有，不变
```

---

### 4.3 CSS 变量命名

相比旧草稿变量名缩短，语义与 Android 对齐：

| 变量 | 手势模式 | 三键模式 | 对应 Android |
|---|---|---|---|
| `--os-nav-bottom` | `0px` | `48px` | `navigationBars` bottom |
| `--os-system-bottom` | `16px` | `48px` | `max(navigationBars, systemGestures bottom)` |

**注入位置：只注入到每个 activity 容器**（Launcher / Recents 不注入）。

**文件：`os/SystemShell.tsx`**，在 activity-container div 上：

```typescript
style={{
  '--os-nav-bottom': navMode === 'buttons' ? `${navigationBarHeight}px` : '0px',
  '--os-system-bottom': navMode === 'buttons'
    ? `${navigationBarHeight}px`
    : `${bottomGestureHeight}px`,
}}
```

---

### 4.4 底部 chrome 渲染逻辑

**文件：`os/SystemShell.tsx`**

手势模式和三键模式互斥渲染：

```
gesture 模式 → <GestureBar /> + <EdgeGestures />
buttons 模式 → <NavigationButtons />
```

**GestureBar 抽离**：从 SystemShell.tsx（当前 832–1057 行，~225 行）提取到独立文件 `os/components/GestureBar.tsx`，逻辑不变。

**新建 NavigationButtons**：`os/components/NavigationButtons.tsx`

```
[←]  [○]  [□]
Back  Home  Recents
```

按钮触发：
- Back → `window.__OS__?.handleBack()`
- Home → `window.__OS__?.goHome()`
- Recents → `window.__OS__?.showRecents()`

样式：绝对定位在底部，高度 `navigationBarHeight`，前景色由 `useNavigationBarForeground` 决定。

---

### 4.5 底部前景色统一入口

**新建：`os/hooks/useNavigationBarForeground.ts`**

将 GestureBar 现有的前景色推断逻辑提取为共享 hook，GestureBar 和 NavigationButtons 共用。

优先级链（不变）：
```
data-navigation-bar-foreground
  → manifest.theme.colors.navigationBarForeground
    → data-status-bar-foreground
      → manifest.theme.colors.statusBarForeground
        → 'dark'（默认）
```

---

### 4.6 新增文件清单（OS 层）

| 文件 | 操作 |
|---|---|
| `os/components/GestureBar.tsx` | 新建（从 SystemShell.tsx 提取） |
| `os/components/NavigationButtons.tsx` | 新建 |
| `os/hooks/useNavigationBarForeground.ts` | 新建（从 GestureBar 提取） |
| `os/data/simulatorConfig.ts` | 修改：加 `navigationBarHeight` |
| `os/OsStateStore.ts` | 修改：加 `system_navigation_mode` 初始值 |
| `os/SystemShell.tsx` | 修改：inset 注入、互斥渲染逻辑、删除内联 GestureBar |

---

## 五、底部抽象组件

### 5.1 BottomChrome

**新建：`os/components/BottomChrome.tsx`**

用于"真正贴底的栏"：TabBar、Toolbar、输入栏。

```typescript
interface BottomChromeProps {
  kind: 'tabbar' | 'toolbar' | 'input-bar'
  keyboardBehavior?: 'hide' | 'dock' | 'keep'  // 各 kind 有默认值
  baseHeight?: number                           // 栏本体高度，用于内容区计算
  className?: string
  children: React.ReactNode
}
```

各 kind 默认键盘行为：

| kind | 默认 keyboardBehavior | 说明 |
|---|---|---|
| `tabbar` | `hide` | 键盘弹出时隐藏 |
| `toolbar` | `keep` | 键盘弹出时维持原状 |
| `input-bar` | `dock` | 键盘弹出时去掉系统保护区，贴键盘底部 |

`input-bar` 自动添加 `data-keep-keyboard="true"`，防止输入框失焦时键盘收起。

输出 DOM：

```html
<div
  data-os-bottom-chrome
  data-kind="tabbar|toolbar|input-bar"
  data-keyboard-behavior="hide|dock|keep"
>
  {children}
</div>
```

---

### 5.2 BottomOverlayAnchor

用于底部浮层：FAB、Toast、悬浮播放器等。

```typescript
interface BottomOverlayAnchorProps {
  baseOffset?: number                 // 距系统保护区的额外偏移
  keyboardBehavior?: 'hide' | 'dock'  // 默认 'hide'
  className?: string
  children: React.ReactNode
}
```

输出 DOM：

```html
<div
  data-os-bottom-overlay
  data-keyboard-behavior="hide|dock"
  style={{ '--base-offset': `${baseOffset}px` }}
>
  {children}
</div>
```

---

## 六、全局 CSS 契约

**文件：`app.css`**

### 6.1 BottomChrome 基础规则

```css
[data-os-bottom-chrome] {
  padding-bottom: var(--os-system-bottom, 0px);
}
```

### 6.2 键盘行为规则

```css
/* hide：键盘弹出时隐藏 */
[data-keyboard-active] [data-os-bottom-chrome][data-keyboard-behavior="hide"] {
  display: none !important;
}

/* dock：去掉系统保护区，贴键盘底部 */
[data-keyboard-active] [data-os-bottom-chrome][data-keyboard-behavior="dock"] {
  padding-bottom: 0px;
}

/* keep：不处理，维持原状 */
```

### 6.3 BottomOverlayAnchor 规则

```css
[data-os-bottom-overlay] {
  position: absolute;
  bottom: calc(var(--base-offset, 0px) + var(--os-system-bottom, 0px));
}

[data-keyboard-active] [data-os-bottom-overlay][data-keyboard-behavior="hide"] {
  display: none;
}

[data-keyboard-active] [data-os-bottom-overlay][data-keyboard-behavior="dock"] {
  bottom: var(--base-offset, 0px);
}
```

### 6.4 向后兼容

保留旧规则，迁移期间继续生效：

```css
/* 旧规则保留，迁移完成后可删除 */
[data-keyboard-active] [data-hide-on-keyboard] {
  display: none !important;
}
```

---

## 七、内容区避让统一规则

**当前问题**：页面自己手写 `calc(64px + var(--os-nav-bottom, 0px))`，栏高和变量两套来源。

**推荐做法**：如果页面底部有固定栏，内容区底部 padding 应为：

```css
/* 有固定栏时：内容避让 = 固定栏高度 + 导航栏物理高度 */
padding-bottom: calc(固定栏高度 + var(--os-nav-bottom, 0px));

/* 无固定栏时：内容避让 = 系统保护区 */
padding-bottom: var(--os-system-bottom, 0px);
```

区分两者的原因：三键模式下固定栏本身已覆盖导航栏区域，内容只需在固定栏之上留白；手势模式下手势条不占物理高度，固定栏直接贴底即可。

理想情况：通过 `BottomChrome` 的 `baseHeight` prop 自动向上层提供 `--os-chrome-height` 变量，内容区直接用 `calc(var(--os-chrome-height) + var(--os-nav-bottom, 0px))`，消除人工硬编码。此机制可在 BottomChrome 实现时一并引入。

---

## 八、App 迁移优先级

迁移不需要一次完成，按以下优先级分批进行：

### P0：聊天 / 回复输入栏（键盘行为最复杂）

迁移到 `BottomChrome kind="input-bar"`：
- Wechat ChatDetail 输入栏
- SMS ConversationDetail
- Reddit ChatThread / PostComments
- TencentMeeting MeetingPage
- Alipay ChatPage
- RedBook ChatPage
- X ChatPage / PostDetailsPage

### P1：主 TabBar（最显眼，影响所有 App 的视觉一致性）

迁移到 `BottomChrome kind="tabbar"`：
- Wechat、RedBook、Reddit、Alipay、Bilibili、Spotify
- WechatReading、Clock、FileManager、Contacts、Notes、Map
- Ebay、TencentMeeting、Railway12306、Browser、Gallery、Calendar

### P2：固定底部操作栏 / CTA

迁移到 `BottomChrome kind="toolbar"`：
- 详情页底部操作区、订单页 CTA、编辑页工具条等

### P3：底部浮层

迁移到 `BottomOverlayAnchor`：
- X 首页 FAB
- Spotify 底部播放器 / Toast
- Calendar 底部 anchor

---

## 九、与旧草稿的差异对比

| 项 | 旧草稿 | 本方案 |
|---|---|---|
| 变量名 | `--os-navigation-bottom-inset` / `--os-bottom-protection-inset` | `--os-nav-bottom` / `--os-system-bottom`（更简洁） |
| GestureBar | 内嵌 SystemShell.tsx | 抽离为独立文件 |
| Launcher/Recents inset 注入 | 计划注入（有问题） | **不注入**，维持现状 |
| 向后兼容 | 未提及 | 保留 `data-hide-on-keyboard` 规则 |
| `--base-offset` 机制 | 有 | 保留 |
| BottomChrome / BottomOverlayAnchor | 有 | 保留，API 基本一致 |
| 内容区避让 | 页面手算 | 提供指导规则 + `--os-chrome-height` 机制 |

---

## 十、验证方式

1. 切换导航模式：修改 preferences 的 `system_navigation_mode`，确认底部 chrome 正确切换
2. 三键模式下：`--os-nav-bottom = 48px`，TabBar 正确避让，内容区 padding 正确
3. 手势模式下：`--os-system-bottom = 16px`，TabBar 正确隐藏于键盘
4. 键盘弹出：
   - `input-bar` → dock（贴键盘底部）
   - `tabbar` → hide（消失）
   - `toolbar` → keep（不动）
5. 前景色：在深色背景页切换，GestureBar / NavigationButtons 图标颜色正确响应 `data-navigation-bar-foreground`
6. 旧 `data-hide-on-keyboard` 元素：键盘弹出时仍然隐藏（向后兼容验证）
