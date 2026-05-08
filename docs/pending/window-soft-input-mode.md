# Window Soft Input Mode（adjustPan / IME Action 协议）

> 状态：设计稿，暂不实施
> 来源：分享面板（Wechat `/share/forward`）评审中暴露的两个偏差
> 关键词：adjustResize / adjustPan、imeOptions、键盘回车语义

---

## 一、背景

mobile-gym OS 当前对**所有 Activity 强制 `adjustResize`**——`SystemShell.tsx` 里的 `data-adjust-resize` wrapper 把 Activity 容器高度从 `100%` 改成 `100% - keyboardHeight` 并设 `overflow: hidden`，没有 per-Activity / per-Window 的 soft input mode 配置。

这导致两类常见交互无法用真 Android 的语义实现：

1. **底部按钮被键盘"盖住"**：分享面板、评论 sheet、底部弹层等 BottomSheetDialog 风格 UI，期望键盘弹起时底部确认按钮被键盘遮住（不在 layout 中被挤上去），目前只能用 `data-hide-on-keyboard` 这种 `display: none` 的 hack 假装。
2. **键盘回车键的语义动作**：搜索框希望回车显示"搜索"、发送框希望显示"发送"、表单希望显示"完成 / 下一项"。当前 `KeyboardOverlay` 的回车永远是箭头图标，统一派发合成 `Enter` KeyDown 事件——能用，但视觉上没有 imeOptions 概念。

---

## 二、真实 Android 参考

### 2.1 `android:windowSoftInputMode`

`AndroidManifest.xml` 里给 Activity（或 Window）声明，三种主要 adjust 模式：

| 模式 | 行为 | 典型场景 |
|---|---|---|
| `adjustResize`（mobile-gym 当前唯一实现） | Activity 窗口被键盘"挤短"，content area 高度变小，layout 自动重排，按钮被挤上去 | 长滚动表单、聊天页正文 |
| `adjustPan` | Activity 窗口高度**不变**，整个 window content 向上**平移**刚好让 focused input 可见，输入框下方内容自然滑到键盘后面被盖住 | 分享面板、底部 sheet、固定底栏的输入态 |
| `adjustNothing` | 键盘直接覆盖窗口，焦点输入框可能被压在键盘下面，业务自己处理 | 全屏视频、自定义 IME |

WeChat 真实分享面板（Android 端）实际上是 `adjustResize` + `imeOptions="actionSend"`：sheet 高度可变，键盘弹起后 sheet 内 layout 重排到只留"输入框 + 顶部信息"，原本在底部的发送按钮**确实被裁掉看不见**（落到 sheet 容器外了），同时键盘回车自带"发送"。视觉效果近似 adjustPan，但机制是 resize。

### 2.2 `android:imeOptions`

EditText 上声明本字段在 IME 上的语义动作：

| imeOption | 标签（中/英） | 触发 |
|---|---|---|
| `actionGo` | 前往 / Go | 跳转 / 提交 |
| `actionSearch` | 搜索 / Search | 搜索 |
| `actionSend` | 发送 / Send | 发送消息 |
| `actionNext` | 下一项 / Next | 焦点移到下一个 input |
| `actionDone` | 完成 / Done | 收起键盘 / 完成 |
| `actionNone`（默认） | 回车箭头 | 普通换行 |

IME 读 EditText 的 imeOptions 决定回车键的图标 / 文字，按下时回调 `onEditorAction(actionId)`。

---

## 三、mobile-gym 落地方案

### 3.1 adjustPan 支持

**Activity 声明**：在 manifest 或路由声明里加 `softInputMode: 'resize' | 'pan' | 'nothing'`，默认 `'resize'`（向后兼容）。

**OS 改动**（`SystemShell.tsx::AdjustResizeContainer`）：

- `resize`（现状）：`height: calc(100% - kbHeight); overflow: hidden`
- `pan`：高度不变，对 focused input 的 `getBoundingClientRect().bottom` 做计算，给 wrapper 加 `transform: translateY(-Δ)` 平移，刚好让输入框露出键盘上方；`overflow: visible` 防止下方按钮被裁
- `nothing`：wrapper 不做任何变化

**注意点**：

- pan 模式下，`transform` 与 `designViewportWidth`（CSS zoom）的坐标换算需要小心——CSS zoom 缩放 CSS 像素，`getBoundingClientRect()` 返回的是 device pixel 单位，要除以 zoom 比例
- pan 模式下，`overflow: visible` 会让被推出去的内容继续吃事件，需要在 wrapper 外加一个遮罩或者 `pointer-events: none` 区
- 状态栏前景色检测、scroll 锁等都要兼容平移后坐标

### 3.2 IME Action 协议

**输入元素声明**：DOM 属性 `data-ime-action="search" | "send" | "done" | "next" | "go"`，未声明视为默认（回车箭头）。

**KeyboardOverlay 改动**：

```ts
// 现有：focusin 时 KeyboardService.show()
// 新增：focusin 时读 target.dataset.imeAction，写入 KeyboardService 状态
const ACTION_LABELS = {
  search: { zh: '搜索', en: 'Search' },
  send:   { zh: '发送', en: 'Send' },
  done:   { zh: '完成', en: 'Done' },
  next:   { zh: '下一项', en: 'Next' },
  go:     { zh: '前往', en: 'Go' },
};
```

回车键渲染时，根据当前 `imeAction` 选 label / icon，无 action 退化为现有箭头图标。

点击行为不变：仍统一派发合成 `Enter` KeyDown，业务方自己在 `<input onKeyDown>` 里监听 Enter 处理对应动作（搜索 / 发送 / 提交 / focus next）。这样 KeyboardOverlay 只管"显示什么"和"派发 Enter"，业务逻辑解耦。

i18n 走 OS 现有 locale。

### 3.3 替代方案：Dialog/Sheet 渲到 Activity 外

BottomSheetDialog 这类覆盖层在真 Android 里本来就是 `Window` 级别的，不受 Activity adjustResize 影响。可以让分享面板等用 React portal 渲到 SystemShell 顶层（或者引入 `__OS__.dialog.show(<Sheet />)` 这样的 OS API），自带独立的 adjust 行为配置。

这条路更符合"Dialog 是窗口而非 View"的语义，但要重做 z-index 层级 + 主题 CSS var 透传 + Dialog API 设计，工作量更大。建议作为 3.1 的后续优化考虑。

---

## 四、当前 workaround

在本协议落地前，有底部按钮被键盘"盖住"需求的页面（如 [apps/Wechat/pages/share/ShareForwardPage.tsx](../../apps/Wechat/pages/share/ShareForwardPage.tsx) 的确认浮层）暂时使用 `data-hide-on-keyboard`：键盘弹起时底部按钮 `display: none`，发送动作改由键盘回车触发。

视觉接近，但有偏差：

- DOM tree 里按钮真消失了，对 pure-vision Agent 训练数据无影响，但给非视觉测试 / DOM 分析工具带来"按钮不在了"的状态噪声
- 不能模拟 adjustPan 下"按钮在 layout 里但视觉被盖"这种状态

---

## 五、实施优先级

P2（不阻塞当前迭代）。等到第二个底部 sheet 类需求出现，或者要做 imeOptions=search 的搜索框时，再合并实施 3.1 + 3.2。
