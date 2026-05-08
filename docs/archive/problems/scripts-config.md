# 脚本与配置问题

## 1. 脚本问题

### 1.1 appState 条件未实现 [中]

7 个 app 的 `navigation.ts` 中 `resolveValue()` 函数对 `appState` ref 返回 null：

```typescript
// appState 未接入，默认返回 null
if (ref.ref === 'appState') return null;
```

**受影响 app**:
- Alipay
- Bilibili
- RedBook
- Spotify
- TencentMeeting
- Wechat
- WechatReading

**影响**: 任何依赖 appState 的 `cases` 条件静默失效。

---

### 1.2 Ebay navigation.ts 不完整 [高]

**位置**: `Ebay/navigation.ts:26-36`

注释: `// Simplified logic assuming simple transitions for now / For a real robust implementation, we should copy the full logic from Wechat/navigation.ts`

跳过：
- from 验证
- matchFrom
- chooseCase
- buildSearchParams
- replaceParams

直接导航到 `t.to`，参数化路由无法工作。

---

### 1.3 scripts/ 目录混乱 [低]

80+ 脚本，多为一次性迁移工具：
- `migrate_colors.mjs`
- `migrate_dimens_arbitrary.mjs`
- `fix_bilibili_icon_aliases.mjs`
- `revert_icon_sizes.mjs`
- 等等

无文档，累积过多。

**建议**: 归档或清理已完成的迁移脚本。

---

## 2. 配置问题

### 2.1 TypeScript strict 模式未启用 [高]

**位置**: `tsconfig.json`

当前只启用 "Phase 1":
```json
"noImplicitThis": true,
"noFallthroughCasesInSwitch": true,
"useUnknownInCatchVariables": true
```

**缺失关键设置**:
- `"strict": true` 或 `"noImplicitAny": true`
- `"strictNullChecks": true`
- `"strictFunctionTypes": true`

**影响**: 允许隐式 `any`（如 `Ebay/navigation.ts:20` 的 `transition: any`）。

---

### 2.2 window.__OS__ 用 as any 赋值 [中]

**位置**: `os/OSContext.tsx:426`
```typescript
} as any;
```

绕过 `OSApi` 类型检查，实现与 `globals.d.ts` 声明不匹配不会报错。

---

### 2.3 window.getSimLayoutHTML 声明位置不一致 [低]

**位置**: `index.tsx:57-62`

```typescript
declare global {
  interface Window {
    getSimLayoutHTML: () => string;
  }
}
```

应与其他全局类型一起放在 `os/types/globals.d.ts`。

---

### 2.4 scripts/ 目录未包含在 TypeScript 编译 [低]

**位置**: `tsconfig.json` include 数组

scripts/ 排除在外，80+ 脚本无类型检查。

---

## 3. 全局 API 问题

### 3.1 AgentBridge WebSocket URL 硬编码 [中]

**位置**: `os/AgentBridge.ts:62`
```typescript
ws://localhost:8765
```

无环境变量覆盖。

---

### 3.2 AgentBridge 初始化延迟 [低]

**位置**: `index.tsx` 导入触发 `setTimeout(() => initAgentBridge(), 1000)`

1 秒延迟确保 `__SIM_INPUT__` 就绪，但若 `index.tsx` 赋值 `getSimLayoutHTML` 与延迟竞态，可能未定义。

---

### 3.3 tap_element 文本搜索问题 [低]

**位置**: `os/AgentBridge.ts`

`tap_element` 和 `double_tap_element` 用 `document.createTreeWalker` 文本搜索，只找第一个匹配，可能命中不可见元素。

---

### 3.4 window.__OS__ 和 window.__SIM__ 生命周期 [中]

在 React `useEffect` 中赋值：
- 首次渲染前为 `undefined`
- 每次状态变化重新赋值

**对比**: `__SIM_TIME__`, `__SIM_LOCATION__`, `__SIM_AI__`, `__SIM_FS__`, `__SIM_MEDIA__` 在模块初始化时同步赋值，React 挂载前即可用。

---

## 4. Vite 配置问题

### 4.1 plugin middleware 无类型 [低]

**位置**: `vite.config.ts`

`req`, `res`, `next` 参数无类型（普通 JS 模式写在 .ts 文件）。

---

### 4.2 allowedHosts: true [低]

**位置**: `vite.config.ts` server 配置

允许任意 host，开发模拟器可接受但需注意。

---

### 4.3 无 build 配置 [信息]

设计如此 - `npm run build` 被禁止（内存不足）。

---

## 5. Tailwind 配置

### 5.1 hooks 目录排除 [信息]

**位置**: `app.css`

```css
@source not "./apps/**/hooks/**"
```

假设 hooks 无 Tailwind 类。若任何 hook 返回 JSX 带类名会被遗漏。当前安全。

---

## 6. 核心脚本质量

### 6.1 build_nav_artifacts.mjs [良好]

149 行，干净的 orchestrator，正确传播退出码。

### 6.2 check_navigation_declaration_consistency.mjs [良好]

1303 行，使用 TypeScript compiler API 做 AST 解析。错误分类清晰。

### 6.3 navigation_declaration_analyzer.mjs [良好]

2216 行，复杂但合理。顶部有选项文档。
