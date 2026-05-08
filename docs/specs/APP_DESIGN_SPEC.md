# App 设计规范 v3.0

> 本文档定义每个 App 的资源文件结构和使用规则。
> 简化版：只关注**图标、主题色、关键尺寸、字符串翻译**四个核心资源。

---

## 一、设计理念

本项目是手机操作 Agent 的训练/测试环境。资源文件的主要目的是：

1. **图标统一管理** — 所有图标通过 `res/icons.tsx` 导入，便于维护
2. **主题色可配置** — `manifest.ts` 定义 App 主题色，支持深色模式
3. **关键尺寸可调** — 少量重要布局尺寸通过 CSS 变量注入
4. **多语言支持** — 所有界面文字通过 `strings.ts` 管理

**不再强制要求**：

- ~~所有颜色必须抽取到 `colors.ts`~~ — 大部分 Tailwind 颜色保持内联
- ~~所有尺寸必须抽取到 `dimens.ts`~~ — 大部分布局尺寸保持内联
- ~~动画时长/曲线抽取到 `anim.ts`~~ — 不再要求
- ~~图标尺寸 `icSize*` 系列~~ — 图标 size 可直接硬编码

---

## 二、图标（`res/icons.tsx`）

### 2.1 规范

图标文件是 App 内**唯一允许**从 `lucide-react` 导入的文件。

```tsx
// ① 从 lucide-react 导入需要的图标
import { ChevronRight, CreditCard, Bus } from 'lucide-react';

// ② 所有图标必须用 Ic* 前缀命名
export const IcNavForward = ChevronRight;
export const IcCard = CreditCard;
export const IcBus = Bus;

// ③ ICON_REGISTRY 供数据驱动渲染使用
export const ICON_REGISTRY: Record<string, any> = {
  IcNavForward,
  IcCard,
  IcBus,
};
```

### 2.2 使用规则

| 场景                      | 正确写法                                        |
| ------------------------- | ----------------------------------------------- |
| JSX 中固定图标            | `<IcCard size={22} />`                        |
| 数据驱动（来自 map/JSON） | `<IconRenderer name={item.icon} size={22} />` |
| 数据文件中的图标名        | `"IcCard"`（必须 Ic* 前缀）                   |

```tsx
// ✅ 图标颜色 — 用 Tailwind 类或 CSS 变量
<IcCard className="text-app-primary" />
<IcCard className="text-gray-500" />
<IcCard style={{ color: 'var(--app-c-xxx)' }} />

// ❌ 禁止硬编码 hex
<IcCard style={{ color: '#2E7D32' }} />
```

---

## 三、主题色（`manifest.ts`）

### 3.1 规范

`manifest.ts` 的 `theme.colors` 定义 App 的整体主题色，会被注入为 CSS 变量：

```ts
// manifest.ts
theme: {
  colors: {
    primary: '#1677ff',        // → --app-primary
    primaryDark: '#0958d9',    // → --app-primary-dark
    onPrimary: '#ffffff',      // → --app-on-primary
    background: '#f5f5f5',     // → --app-bg
    surface: '#ffffff',        // → --app-surface
    textPrimary: '#333333',    // → --app-text
    textSecondary: '#666666',  // → --app-text-muted
    border: '#e5e7eb',         // → --app-border
  },
  // 深色模式覆盖（可选）
  colorsDark: {
    background: '#1a1a1a',
    surface: '#2a2a2a',
    textPrimary: '#e5e5e5',
  },
}
```

### 3.2 使用

```tsx
// ✅ 主题色 — Tailwind app-* 类
className="text-app-primary bg-app-surface border-app-border"

// ✅ 普通颜色 — Tailwind 标准类（允许保持内联）
className="text-gray-800 bg-white border-gray-200"
```

---

## 四、关键尺寸（`res/dimens.ts`）

### 4.1 何时使用

**只有多处复用的重要尺寸**才需要抽取到 `dimens.ts`，例如：

- 列表项高度
- 头像尺寸
- 弹窗宽度

**不需要抽取**：

- 一次性使用的尺寸 → 直接写 Tailwind 类或 style
- 图标 size → 直接硬编码 `size={22}`
- 间距/圆角/字体大小 → 用 Tailwind 类 `p-4 rounded-lg text-sm`

### 4.2 规范

```ts
// res/dimens.ts — 只放关键尺寸
export const dimens = {
  // 列表项高度（用于滚动计算）
  item_height: 56,           // → --app-item-height
  
  // 头像尺寸（多处复用）
  avatar_size: 48,           // → --app-avatar-size
  
  // 弹窗相关
  modal_width: 280,          // → --app-modal-width
} as const;
```

### 4.3 使用

```tsx
// JS 计算时直接引用
const scrollTop = index * dimens.item_height;

// CSS 中用变量
<div className="h-(--app-item-height)">
<div style={{ height: 'var(--app-item-height)' }}>

// 不需要抽取的尺寸 — 直接写
<div className="p-4 rounded-lg h-14">
<IcCard size={22} />
```

---

## 五、字符串（`res/strings.ts`）

### 5.1 规范

所有界面文字必须通过 strings 管理，支持多语言：

```ts
// res/strings.ts — 中文
export const strings = {
  app_name: '支付宝',
  nav_back: '返回',
  action_confirm: '确认',
  
  // 带参数的模板
  greeting: (name: string) => `你好，${name}`,
  unread_count: (n: number) => n === 0 ? '无未读' : `${n} 条未读`,
} as const;
```

```ts
// res/strings.en.ts — 英文覆盖
export const stringsEn: Partial<typeof strings> = {
  app_name: 'Alipay',
  nav_back: 'Back',
  greeting: (name: string) => `Hello, ${name}`,
};
```

### 5.2 使用

```tsx
const s = useAppStrings(strings, stringsEn);

// ✅ 正确
<span>{s.nav_back}</span>
<span>{s.greeting(user.name)}</span>

// ❌ 禁止直接写字符串
<span>返回</span>
```

---

## 六、组件颜色（`res/colors.ts`）— 可选

### 6.1 何时使用

**只有以下情况**才需要 `colors.ts`：

1. **特殊颜色无法用 Tailwind 表达** — 如品牌色、渐变色
2. **需要响应深色模式** — 浅色/深色不同的组件颜色
3. **已完成颜色迁移的 App** — 如 Wechat、WechatReading

**不需要抽取**：

- 标准 Tailwind 颜色 → 直接用 `text-gray-800 bg-white`
- 一次性使用的颜色 → 直接写 `bg-[#FF7D00]`

### 6.2 规范

```ts
// res/colors.ts — 只放特殊颜色
export const colors = {
  brand_orange: '#FF7D00',     // → --app-c-brand-orange
  forest_green: '#2E7D32',     // → --app-c-forest-green
} as const;

export const colorsDark: Partial<typeof colors> = {
  forest_green: '#66BB6A',
};
```

---

## 七、文件结构

```
apps/<AppName>/
├── manifest.ts                  # App 身份 + 主题色
├── <AppName>App.tsx             # 入口
├── res/
│   ├── icons.tsx                # 图标（必须）
│   ├── strings.ts               # 中文字符串（必须）
│   ├── strings.en.ts            # 英文翻译（必须）
│   ├── dimens.ts                # 关键尺寸（可选，按需）
│   └── colors.ts                # 特殊颜色（可选，按需）
├── pages/
└── components/
```
