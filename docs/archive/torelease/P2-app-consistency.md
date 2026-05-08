# P2 — App 层一致性统一

> 优先级：**P2（架构提升）**
> 预计工作量：2 人 × 3 周
> 涉及：26 个 App 的结构审计与规范化

---

## 1. 现状审计

### 1.1 一致性评分

| 维度 | 合规数 / 总数 | 缺失 App |
|------|-------------|---------|
| `manifest.ts` | 26/26 | 无 |
| `*App.tsx` with `export default` | 26/26 | 无 |
| `state.ts`（Zustand store） | 24/26 | Calculator, ThemeStore |
| `navigation.declaration.ts` | 18/26 | Browser, Calculator, Calendar, Clock, Gallery, Notes, Sms, ThemeStore |
| `navigation.ts`（useAppNavigate） | 18/26 | 同上 |
| `data/index.ts` | 20/26 | Browser, Calculator, FileManager, Gallery, ThemeStore, Notes（无标准格式） |
| `data/defaults.json` | 18/26 | 多个 App 使用内联数据或无数据 |
| `displayNameEn` in manifest | 25/26 | Alipay |
| 使用 `go()`/`back()` 而非 `navigate()` | ~14/18 | Wechat 部分页面、Settings、Notes、Calendar、Map |
| Navigation handler 位置一致 | 混合 | 内联 vs 独立组件 |
| `res/strings.en.ts` | ~18/26 | Map, FileManager, Gallery 等 |

### 1.2 主要不一致模式

| 模式 | 规范做法 | 偏离做法 | 偏离 App |
|------|---------|---------|---------|
| 页面导航 | `go(transitionId, params)` | `navigate('/path')` | Notes, Calendar, Map, Settings（部分） |
| 返回处理 | `back()` from navigation.ts | `navigate(-1)` | Wechat（部分）, Settings |
| Navigation handler | 内联于 `*App.tsx` | 独立 `*NavigationHandler.tsx` | Alipay, RedBook, Compass, Ebay, FileManager |
| 数据层 | `data/index.ts` + `defaults.json` | 自定义文件 | Settings（settingsConfig.ts）, FileManager |
| 图标导入 | 集中在 `res/icons.tsx` | 散落在组件中 | Alipay（`ICON_MAP`）|

---

## 2. 统一标准定义

### 2.1 App 必需文件清单

```
apps/<AppName>/
├── manifest.ts                    # 必须：App 身份标识
├── <AppName>App.tsx               # 必须：入口（export default）
├── state.ts                       # 必须（除纯展示 App）：Zustand store
├── navigation.declaration.ts      # 必须：导航声明
├── navigation.ts                  # 必须：useAppNavigate hook
├── constants.ts                   # 按需：结构常量
├── types.ts                       # 按需：App 级类型
├── data/
│   ├── index.ts                   # 必须：数据入口
│   └── defaults.json              # 必须：默认数据
├── res/
│   ├── colors.ts                  # 按需：特殊颜色
│   ├── colors.states.ts           # 按需：状态颜色
│   ├── dimens.ts                  # 按需：关键尺寸
│   ├── anim.ts                    # 按需：动画参数
│   ├── icons.tsx                  # 必须：图标注册表
│   ├── strings.ts                 # 必须：中文字符串
│   └── strings.en.ts              # 必须：英文字符串
└── pages/                         # 必须：页面组件
```

### 2.2 Navigation Handler 标准模式

统一为**内联于 `*App.tsx`** 模式（减少文件数，逻辑更集中）：

```typescript
// apps/<AppName>/<AppName>App.tsx

export default function AppNameApp() {
  const navigate = useNavigate();
  const navigator = useRef<NavigateFunction>(null);
  const historyIndexRef = useRef(0);

  useEffect(() => {
    navigator.current = navigate;
  }, [navigate]);

  // 统一监听 history index
  useEffect(() => {
    return () => { /* cleanup */ };
  }, []);

  const handleBackPress = useCallback((): boolean => {
    // 使用 back() 而非 navigate(-1)
    if (historyIndexRef.current > 0) {
      back();
      return true;
    }
    return false;
  }, [back]);

  useAppNavigationHandler(APP_ID, { onBack: handleBackPress });

  return (
    <MemoryRouter>
      <Routes>
        {/* ... */}
      </Routes>
    </MemoryRouter>
  );
}
```

### 2.3 manifest.ts 必填字段

```typescript
export const manifest: AppManifest = {
  id: 'appname',                           // 必须：唯一 ID
  packageName: 'com.example.appname',      // 必须：Android 风格包名
  displayName: '应用名称',                   // 必须：中文名
  displayNameEn: 'App Name',               // 必须：英文名
  aliases: [],                              // 可选：搜索别名
  version: '1.0.0',                        // 必须
  icon: () => <IcLauncher />,              // 必须
  theme: {                                 // 必须
    colorPrimary: '#...',
    colorOnPrimary: '#...',
  },
};
```

---

## 3. 缺失 App 的导航声明补齐计划

### 3.1 需补齐的 8 个 App

| App | 路由数（估计） | 复杂度 | 优先级 |
|-----|------------|--------|--------|
| **Sms** | 5-8 | 低 | 高（benchmark 需要） |
| **Contacts** | ※已有 | — | — |
| **Notes** | 6-10 | 中 | 高 |
| **Calendar** | 5-8 | 中 | 中 |
| **Clock** | 4-6 | 低 | 中 |
| **Gallery** | 6-10 | 中 | 中 |
| **Browser** | 3-5 | 低 | 低 |
| **Calculator** | 1-2 | 极低 | 低（纯工具，无导航） |
| **ThemeStore** | 3-5 | 低 | 低 |

### 3.2 补齐步骤（以 Sms 为例）

1. **分析现有路由**：
   ```bash
   rg "Route " apps/Sms/SmsApp.tsx
   rg "navigate\(" apps/Sms/ --type ts
   ```

2. **编写 `navigation.declaration.ts`**：
   - 列出所有路由节点
   - 定义每个路由的 `uiStates`
   - 定义所有 transitions（trigger type + target）
   - 定义所有 actions

3. **编写 `navigation.ts`**：
   - 实现 `useAppNavigate()` hook
   - 将所有 `navigate()` 调用替换为 `go()`

4. **运行一致性检查**：
   ```bash
   node scripts/build_nav_artifacts.mjs Sms
   ```

5. **生成 action tasks**：
   ```bash
   node scripts/generate_action_tasks_from_nav_graph.mjs Sms
   ```

### 3.3 时间估算

| App | 工作量 |
|-----|--------|
| Sms | 1 天 |
| Notes | 1.5 天 |
| Calendar | 1.5 天 |
| Clock | 0.5 天 |
| Gallery | 1.5 天 |
| Browser | 1 天 |
| Calculator | 0.5 天 |
| ThemeStore | 0.5 天 |
| **总计** | **~8 天** |

---

## 4. `go()`/`back()` 合规审计与迁移

### 4.1 自动化检测脚本

```bash
#!/bin/bash
# scripts/audit-navigate-usage.sh
# 检测 apps/*/pages/ 中直接使用 useNavigate/navigate 的文件

echo "=== Files using useNavigate directly in pages ==="
rg "useNavigate\(\)" apps/*/pages/ --type ts -l

echo ""
echo "=== Files using navigate() instead of go()/back() ==="
rg "navigate\(" apps/*/pages/ --type ts -l | while read f; do
  # 排除已使用 go() 的文件（可能是 false positive）
  if ! rg -q "go\(" "$f"; then
    echo "  VIOLATION: $f"
  fi
done
```

### 4.2 迁移模板

对于每个违规文件：

```typescript
// Before:
import { useNavigate } from 'react-router-dom';
const navigate = useNavigate();
navigate('/some-path');
navigate(-1);

// After:
import { useAppNavigate } from '../navigation';
const { go, back } = useAppNavigate();
go('transition.id', { param: value });
back();
```

### 4.3 ESLint 规则强制执行

参见 `P1-engineering-quality.md` 中的自定义 ESLint 规则 `no-direct-navigate`。配置在 `eslint.config.mjs` 中对 `apps/*/pages/` 路径生效。

---

## 5. 数据层标准化

### 5.1 Settings App 特殊处理

Settings 当前使用 `settingsConfig.ts` + `loader.ts` + `pages.json`。需要评估是否能迁移到标准 `data/index.ts` + `defaults.json` 模式。

由于 Settings 的数据结构（嵌套 preference screens）确实特殊，建议：
- 保留 `settingsConfig.ts` 但在 `data/index.ts` 中做 re-export
- `defaults.json` 中放置用户设置的默认值
- 添加注释说明偏离原因

```typescript
// apps/Settings/data/index.ts
export { SETTINGS_CONFIG } from './settingsConfig';
export { default as defaults } from './defaults.json';

// 合并后的统一导出
export const SETTINGS_APP_CONFIG = {
  ...SETTINGS_CONFIG,
  defaults,
};
```

### 5.2 缺少 data 层的 App

| App | 处理方案 |
|-----|---------|
| Browser | 创建 `defaults.json`（书签、历史、设置默认值） |
| Calculator | 无需数据层（纯计算器）或极简的 `defaults.json`（历史记录） |
| ThemeStore | 创建 `defaults.json`（主题列表、已安装主题） |
| FileManager | 创建 `data/index.ts`（文件系统依赖 OS FileSystemService） |

---

## 6. App 脚手架工具

### 6.1 `scripts/create-app.mjs`

```javascript
#!/usr/bin/env node

/**
 * 创建新 App 的脚手架
 * Usage: node scripts/create-app.mjs <AppName> [--id <appId>]
 */

import fs from 'fs';
import path from 'path';

const appName = process.argv[2];
const appId = process.argv.includes('--id')
  ? process.argv[process.argv.indexOf('--id') + 1]
  : appName.toLowerCase();

if (!appName) {
  console.error('Usage: node scripts/create-app.mjs <AppName> [--id <appId>]');
  process.exit(1);
}

const appDir = path.resolve('apps', appName);

if (fs.existsSync(appDir)) {
  console.error(`Directory already exists: ${appDir}`);
  process.exit(1);
}

const templates = {
  'manifest.ts': `
import type { AppManifest } from '@/os/types/manifest';

export const manifest: AppManifest = {
  id: '${appId}',
  packageName: 'com.example.${appId}',
  displayName: '${appName}',
  displayNameEn: '${appName}',
  aliases: [],
  version: '1.0.0',
  icon: () => null, // TODO: 替换为实际图标
  theme: {
    colorPrimary: '#2196F3',
    colorOnPrimary: '#FFFFFF',
  },
};
`.trim(),

  [`${appName}App.tsx`]: `
import { useCallback, useEffect, useRef } from 'react';
import { MemoryRouter, Routes, Route, useNavigate, type NavigateFunction } from 'react-router-dom';
import { useAppNavigationHandler } from '@/os/hooks/useAppNavigationHandler';
import { useAppNavigate } from './navigation';
import { manifest } from './manifest';
import HomePage from './pages/HomePage';

const APP_ID = manifest.id;

function AppContent() {
  const navigate = useNavigate();
  const { back } = useAppNavigate();
  const historyIndexRef = useRef(0);

  useEffect(() => {
    const unlisten = /* track history index */;
    return unlisten;
  }, []);

  const handleBackPress = useCallback((): boolean => {
    if (historyIndexRef.current > 0) {
      back();
      return true;
    }
    return false;
  }, [back]);

  useAppNavigationHandler(APP_ID, { onBack: handleBackPress });

  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
    </Routes>
  );
}

export default function ${appName}App() {
  return (
    <MemoryRouter>
      <AppContent />
    </MemoryRouter>
  );
}
`.trim(),

  'navigation.declaration.ts': `
export const NAVIGATION_DECLARATION = {
  appId: '${appId}',
  routes: [
    {
      id: 'home',
      path: '/',
      label: '首页',
    },
  ],
  transitions: [],
  actions: [],
};
`.trim(),

  'navigation.ts': `
import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { NAVIGATION_DECLARATION } from './navigation.declaration';

export function useAppNavigate() {
  const navigate = useNavigate();

  const go = useCallback((transitionId: string, params?: Record<string, string>) => {
    const transition = NAVIGATION_DECLARATION.transitions.find(t => t.id === transitionId);
    if (!transition) {
      console.warn(\`[${appId}] Unknown transition: \${transitionId}\`);
      return;
    }
    // TODO: implement navigation logic
  }, [navigate]);

  const back = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  return { go, back };
}
`.trim(),

  'state.ts': `
import { createAppStoreWithActions } from '@/os/createAppStore';
import { manifest } from './manifest';
import defaults from './data/defaults.json';

interface ${appName}State {
  // TODO: define state
}

export const use${appName}Store = createAppStoreWithActions<${appName}State>(
  manifest.id,
  () => ({
    ...defaults,
  }),
);
`.trim(),

  'types.ts': `
// ${appName} app types
`.trim(),

  'constants.ts': `
// ${appName} structural constants
`.trim(),

  'data/index.ts': `
import defaults from './defaults.json';

export const ${appId.toUpperCase()}_CONFIG = {
  ...defaults,
};
`.trim(),

  'data/defaults.json': `{
}
`,

  'res/icons.tsx': `
import { /* icons */ } from 'lucide-react';

export const IcLauncher = /* TODO */;

export const ICON_REGISTRY: Record<string, React.ComponentType<{ size?: number }>> = {
  IcLauncher,
};
`.trim(),

  'res/strings.ts': `
export default {
  app_name: '${appName}',
};
`.trim(),

  'res/strings.en.ts': `
export default {
  app_name: '${appName}',
};
`.trim(),

  'pages/HomePage.tsx': `
export default function HomePage() {
  return (
    <div className="h-full pt-10" data-status-bar-foreground="dark">
      <div className="px-4 py-3">
        <h1 className="text-xl font-semibold">${appName}</h1>
      </div>
    </div>
  );
}
`.trim(),
};

// 创建目录结构
const dirs = ['', 'data', 'res', 'pages'];
for (const dir of dirs) {
  fs.mkdirSync(path.join(appDir, dir), { recursive: true });
}

// 写入文件
for (const [filename, content] of Object.entries(templates)) {
  fs.writeFileSync(path.join(appDir, filename), content + '\\n');
}

console.log(\`✓ Created app scaffold at apps/${appName}/\`);
console.log('');
console.log('Next steps:');
console.log(\`  1. Update manifest.ts with proper icon and theme\`);
console.log(\`  2. Define state in state.ts\`);
console.log(\`  3. Add routes and transitions in navigation.declaration.ts\`);
console.log(\`  4. Run: node scripts/build_nav_artifacts.mjs ${appName}\`);
```

### 6.2 `package.json` 注册

```json
{
  "scripts": {
    "create-app": "node scripts/create-app.mjs"
  }
}
```

---

## 7. 独立 NavigationHandler 组件迁移

对于当前使用独立 `*NavigationHandler.tsx` 的 App（Alipay, RedBook, Compass, Ebay, FileManager），需要决定是否统一：

### 方案评估

| 方案 | 优点 | 缺点 |
|------|------|------|
| 全部内联 | 统一模式，减少文件 | Alipay 的 multi-activity 逻辑复杂 |
| 全部独立 | 关注点分离 | 多数 App 的 handler 很简单，不值得独立 |
| **简单内联 + 复杂独立** | 务实 | 需要定义"复杂"的标准 |

### 推荐策略

- **默认内联**：handler 逻辑 ≤ 30 行时，内联于 `*App.tsx`
- **允许独立**：handler 逻辑 > 30 行或涉及 multi-activity 时，可使用独立组件
- 在 `CLAUDE.md` 中明确记录此规则

---

## 8. res/ 目录标准化

### 8.1 Settings 的 `useSettingsStrings.ts`

应迁移为标准 `res/strings.ts` + `res/strings.en.ts` 模式：

```typescript
// apps/Settings/res/strings.ts（标准模式）
export default {
  app_name: '设置',
  wifi: '无线网络',
  bluetooth: '蓝牙',
  // ...
};
```

如果 Settings 需要动态字符串（如从 pages.json 加载），保留 `useSettingsStrings.ts` 但同时提供静态 `strings.ts` 作为 fallback。

### 8.2 缺失 `strings.en.ts` 的 App

| App | 状态 | 工作量 |
|-----|------|--------|
| Map | 缺失 | 低 |
| FileManager | 缺失 | 低 |
| Gallery | 缺失 | 低 |
| Calculator | 极简 | 极低 |
| Compass | 需确认 | 低 |

每个文件预计 15-30 行，半天可全部完成。

---

## 9. 质量保障自动化

### 9.1 结构一致性检查脚本

```bash
#!/bin/bash
# scripts/check-app-structure.sh
# 检查所有 App 是否符合标准文件结构

errors=0

for dir in apps/*/; do
  app=$(basename "$dir")
  echo "=== Checking $app ==="

  # 必须文件
  for f in "manifest.ts" "${app}App.tsx"; do
    if [ ! -f "$dir/$f" ]; then
      echo "  ERROR: Missing $f"
      errors=$((errors + 1))
    fi
  done

  # manifest 必须包含 displayNameEn
  if [ -f "$dir/manifest.ts" ]; then
    if ! grep -q "displayNameEn" "$dir/manifest.ts"; then
      echo "  WARN: Missing displayNameEn in manifest.ts"
    fi
  fi

  # navigation.declaration.ts
  if [ ! -f "$dir/navigation.declaration.ts" ]; then
    echo "  WARN: Missing navigation.declaration.ts"
  fi

  # res/strings.en.ts
  if [ ! -f "$dir/res/strings.en.ts" ]; then
    echo "  WARN: Missing res/strings.en.ts"
  fi
done

if [ $errors -gt 0 ]; then
  echo ""
  echo "Found $errors errors!"
  exit 1
fi
```

### 9.2 集成到 CI

```yaml
# .github/workflows/ci.yml
  app-structure:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check app structure consistency
        run: bash scripts/check-app-structure.sh
```

---

## 检查清单

- [ ] 8 个 App 的 `navigation.declaration.ts` 补齐
- [ ] 8 个 App 的 `navigation.ts` 编写
- [ ] 全量 App `go()`/`back()` 合规审计
- [ ] 违规页面迁移到 `useAppNavigate`
- [ ] Alipay `displayNameEn` 补充
- [ ] Settings data 层标准化
- [ ] 缺失 `strings.en.ts` 补齐
- [ ] `useSettingsStrings.ts` 评估是否迁移
- [ ] `scripts/create-app.mjs` 脚手架工具创建
- [ ] `scripts/check-app-structure.sh` 检查脚本创建
- [ ] ESLint `no-direct-navigate` 规则配置
- [ ] CLAUDE.md 更新 handler 模式规则（简单内联 + 复杂独立）
- [ ] CI 集成结构检查
