# P3 — 生态建设：SDK、Playground、Agent Protocol

> 优先级：**P3（生态建设）**
> 预计工作量：3 人 × 持续迭代
> 目标：形成可扩展的开发者生态

---

## 1. 核心包拆分：`@mobile-gym/core`

### 1.1 目标

将 OS 层从单体项目中抽取为独立可复用的 npm 包，使第三方开发者能基于此构建自定义模拟器。

### 1.2 包划分

```
packages/
├── core/                      # @mobile-gym/core
│   ├── src/
│   │   ├── TaskManager.ts
│   │   ├── BackDispatcher.ts
│   │   ├── IntentResolver.ts
│   │   ├── ServiceRegistry.ts
│   │   ├── createSystemService.ts
│   │   ├── AppNavigatorRegistry.ts
│   │   ├── AppLifecycle.ts
│   │   ├── BroadcastBus.ts
│   │   ├── services/           # 所有系统服务
│   │   ├── types/
│   │   └── index.ts            # 公开 API
│   ├── package.json
│   └── tsconfig.json
│
├── app-sdk/                   # @mobile-gym/app-sdk
│   ├── src/
│   │   ├── createAppStore.ts
│   │   ├── useAppNavigationHandler.ts
│   │   ├── useTriggerGestures.ts
│   │   ├── useAppStrings.ts
│   │   ├── components/
│   │   │   ├── AppErrorBoundary.tsx
│   │   │   └── CollapsingToolbar.tsx
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── shell/                     # @mobile-gym/shell
│   ├── src/
│   │   ├── SystemShell.tsx
│   │   ├── Launcher.tsx
│   │   ├── simInput.ts
│   │   ├── components/
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
└── simulator/                 # @mobile-gym/simulator (主应用)
    ├── src/
    │   ├── index.tsx
    │   └── app.css
    ├── apps/                  # 内置 App
    ├── package.json
    └── vite.config.ts
```

### 1.3 `@mobile-gym/core` 公开 API

```typescript
// packages/core/src/index.ts

// 类型
export type { AppId, OSState, DeviceConfig } from './types';
export type { AppManifest, IntentPayload, ActivityResult } from './types/manifest';
export type { SystemService, SystemServiceConfig } from './createSystemService';

// 核心模块
export { TaskManager } from './TaskManager';
export { BackDispatcher } from './BackDispatcher';
export { IntentResolver } from './IntentResolver';
export { ServiceRegistry } from './ServiceRegistry';
export { createSystemService } from './createSystemService';
export { AppNavigatorRegistry } from './AppNavigatorRegistry';
export { AppLifecycle } from './AppLifecycle';
export { BroadcastBus } from './BroadcastBus';

// 系统服务
export { NotificationService } from './services/NotificationService';
export { KeyboardService } from './services/KeyboardService';
export { ClipboardService } from './services/ClipboardService';
// ... 其余服务

// 工具
export { createOSProvider } from './OSProvider';
```

### 1.4 `@mobile-gym/app-sdk` 公开 API

```typescript
// packages/app-sdk/src/index.ts

// App 状态管理
export { createAppStore, createAppStoreWithActions, getStore } from './createAppStore';

// 导航
export { useAppNavigationHandler } from './useAppNavigationHandler';

// 手势/DOM 标记
export { useTriggerGestures } from './useTriggerGestures';

// 工具 hooks
export { useAppStrings } from './useAppStrings';
export { useDarkMode } from './useDarkMode';
export { useVirtualList } from './useVirtualList';

// 组件
export { AppErrorBoundary } from './components/AppErrorBoundary';
export { CollapsingToolbar } from './components/CollapsingToolbar';

// 类型
export type { TriggerGestureBindings } from './useTriggerGestures';
```

### 1.5 迁移策略

**不建议立即做 monorepo 迁移**，工作量过大。推荐分步：

1. **Phase 1**：在现有结构中定义 `packages/core/index.ts` 作为 barrel export
2. **Phase 2**：确保所有 App 通过 barrel export 导入 OS 层能力
3. **Phase 3**：使用 Turborepo / pnpm workspace 做物理拆分
4. **Phase 4**：发布到 npm

---

## 2. App SDK 与第三方 App 支持

### 2.1 App 接入协议

定义标准的 App 接入点：

```typescript
// @mobile-gym/app-sdk 导出的标准接口

interface AppModule {
  manifest: AppManifest;
  component: React.LazyExoticComponent<React.ComponentType>;
  store?: StoreApi<unknown>;
  dataLoader?: () => Promise<void>;
}

function defineApp(config: {
  manifest: AppManifest;
  component: () => Promise<{ default: React.ComponentType }>;
  store?: () => StoreApi<unknown>;
  dataLoader?: () => Promise<void>;
}): AppModule;
```

### 2.2 第三方 App 加载

```typescript
// 未来支持动态加载第三方 App
import { registerExternalApp } from '@mobile-gym/core';

// 方式 1：npm 包
registerExternalApp(import('@my-org/my-custom-app'));

// 方式 2：远程 URL（Module Federation 或 importmap）
registerExternalApp({
  manifest: { id: 'custom-app', ... },
  componentUrl: 'https://cdn.example.com/custom-app.js',
});
```

### 2.3 App 开发模板仓库

创建 `mobile-gym-app-template` 仓库：

```
mobile-gym-app-template/
├── src/
│   ├── manifest.ts
│   ├── MyApp.tsx
│   ├── navigation.declaration.ts
│   ├── navigation.ts
│   ├── state.ts
│   ├── data/
│   ├── res/
│   └── pages/
├── package.json           # 依赖 @mobile-gym/app-sdk
├── vite.config.ts         # 构建为 library
├── README.md
└── tsconfig.json
```

---

## 3. Agent Protocol 标准化

### 3.1 现状

5 种 Agent 格式各不相同：

| Agent | 输出格式 | 路由感知 | 状态感知 |
|-------|---------|---------|---------|
| autoglm | `do()/finish()` | 有 | 有 |
| gelab | Tab-separated KV | 无 | 有 |
| generic | JSON | 有 | 有 |
| generic_v2 | `<THINK><ANSWER>JSON</ANSWER>` | 无 | 无 |
| human | N/A | N/A | N/A |

### 3.2 统一 Agent Protocol

定义 `MobileGymProtocol`：

```json
{
  "$schema": "https://mobile-gym.dev/schemas/agent-protocol-v1.json",
  "version": "1.0",

  "observation": {
    "screenshot": "data:image/png;base64,...",
    "route": {
      "app": "wechat",
      "path": "/chat/wxid_alice"
    },
    "state": {
      "os": { "...": "..." },
      "apps": { "...": "..." }
    },
    "view_hierarchy": "optional XML-like structure"
  },

  "action": {
    "type": "CLICK | DOUBLE_TAP | LONG_PRESS | TYPE | SWIPE | BACK | HOME | WAIT | COMPLETE | ABORT",
    "params": {
      "x": 200,
      "y": 400,
      "text": "hello",
      "direction": "up",
      "duration": 300
    },
    "thinking": "Optional reasoning text",
    "info": "Optional agent message"
  }
}
```

### 3.3 Agent SDK（Python）

```python
# mobile_gym.agent (published to PyPI)

from mobile_gym.agent import BaseAgent, Action, Observation

class MyAgent(BaseAgent):
    """Custom agent implementation."""

    def act(self, observation: Observation) -> Action:
        screenshot = observation.screenshot
        route = observation.route

        # Your LLM/RL logic here
        response = self.llm.chat(...)

        return Action(
            type="CLICK",
            x=200,
            y=400,
            thinking="I need to click the send button",
        )
```

### 3.4 Agent SDK（TypeScript）

```typescript
// @mobile-gym/agent-sdk (published to npm)

import { BaseAgent, Action, Observation } from '@mobile-gym/agent-sdk';

class MyAgent extends BaseAgent {
  async act(observation: Observation): Promise<Action> {
    const { screenshot, route, state } = observation;

    // Your logic here
    return {
      type: 'CLICK',
      params: { x: 200, y: 400 },
      thinking: 'Clicking the send button',
    };
  }
}
```

---

## 4. Web Playground

### 4.1 概述

部署一个公开可访问的在线 demo，让用户无需安装即可体验模拟器。

### 4.2 架构

```
Playground 架构：

User Browser
  ├── Mobile-Gym Simulator (iframe or direct)
  ├── Agent Console (侧边栏)
  │   ├── Manual agent controls
  │   ├── API Explorer (试用 __SIM__/__OS__ API)
  │   └── State Inspector
  └── Task Runner (可选)
      ├── 选择预定义 Task
      ├── 观察 Agent 执行
      └── 查看评估结果
```

### 4.3 部署方案

#### 方案 A：静态站点（推荐初期）

```yaml
# .github/workflows/playground.yml
name: Deploy Playground

on:
  push:
    branches: [main]
    tags: ['v*']

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          # 使用受限的 API Key 或 mock 模式
          VITE_GOOGLE_MAPS_API_KEY: ${{ secrets.PLAYGROUND_MAPS_KEY }}
      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          cname: demo.mobile-gym.dev
```

#### 方案 B：容器化（支持 API Gateway）

```yaml
# docker-compose.playground.yml
services:
  playground:
    build: .
    ports:
      - "80:80"
    environment:
      - VITE_GOOGLE_MAPS_API_KEY=${PLAYGROUND_MAPS_KEY:-}
```

部署到 Vercel / Railway / Fly.io。

### 4.4 Playground 特性（增量）

| 阶段 | 特性 |
|------|------|
| V1 | 纯模拟器展示，可手动操作 |
| V2 | 添加 API Explorer 侧边栏 |
| V3 | 添加 State Inspector（实时显示 `__SIM__.getState()`） |
| V4 | 添加 Task Runner（运行预定义任务） |
| V5 | 添加 Agent 对接（用户输入 API Key，运行 Agent） |

### 4.5 API Explorer 组件

```typescript
// playground/ApiExplorer.tsx
function ApiExplorer() {
  const [code, setCode] = useState('window.__SIM__.getState()');
  const [result, setResult] = useState('');

  const run = async () => {
    try {
      const fn = new Function(`return ${code}`);
      const res = await fn();
      setResult(JSON.stringify(res, null, 2));
    } catch (err) {
      setResult(`Error: ${err.message}`);
    }
  };

  return (
    <div className="api-explorer">
      <textarea value={code} onChange={e => setCode(e.target.value)} />
      <button onClick={run}>Run</button>
      <pre>{result}</pre>
    </div>
  );
}
```

---

## 5. DevTools 扩展

### 5.1 概述

为开发者和研究者提供实时调试工具，作为浏览器内面板。

### 5.2 功能规划

```
Mobile-Gym DevTools Panel
├── State Tab
│   ├── OS State (TaskManager state, active task, activity stack)
│   ├── Service States (展开/折叠所有 SystemService 状态)
│   └── App States (per-app Zustand store state)
│
├── Events Tab
│   ├── Action Log (所有 __SIM_INPUT__ 调用记录)
│   ├── Navigation Log (所有 go()/back() 调用)
│   ├── Broadcast Log (所有 BroadcastBus 事件)
│   └── Intent Log (所有 Intent 解析过程)
│
├── Navigation Tab
│   ├── Route Tree (当前 App 的路由树)
│   ├── Transition History (导航历史)
│   └── DOM Triggers (当前页面的 data-trigger 元素)
│
└── Performance Tab
    ├── Mounted Apps Count
    ├── Activity Stack Depth
    └── localStorage Usage
```

### 5.3 实现方式

不做 Chrome Extension，而是作为模拟器内置面板（类似 React DevTools 的嵌入模式）：

```typescript
// os/devtools/DevToolsPanel.tsx
// 通过快捷键 Ctrl+Shift+D 或 URL 参数 ?devtools=1 打开

export function DevToolsPanel() {
  const [tab, setTab] = useState<'state' | 'events' | 'nav' | 'perf'>('state');

  return (
    <div className="fixed right-0 top-0 bottom-0 w-96 bg-gray-900 text-white z-[9999]">
      <TabBar tabs={['state', 'events', 'nav', 'perf']} active={tab} onChange={setTab} />
      {tab === 'state' && <StateTab />}
      {tab === 'events' && <EventsTab />}
      {tab === 'nav' && <NavigationTab />}
      {tab === 'perf' && <PerformanceTab />}
    </div>
  );
}
```

### 5.4 Action Logger

在 `simInput.ts` 中注入日志钩子：

```typescript
// os/devtools/ActionLogger.ts

interface ActionLogEntry {
  timestamp: number;
  type: 'tap' | 'swipe' | 'type' | 'back' | 'home';
  params: Record<string, unknown>;
  target?: string; // 命中的 DOM 元素选择器
}

const log: ActionLogEntry[] = [];
const MAX_LOG = 500;

export function logAction(entry: Omit<ActionLogEntry, 'timestamp'>) {
  log.push({ ...entry, timestamp: Date.now() });
  if (log.length > MAX_LOG) log.shift();
  listeners.forEach(l => l(log));
}

export function getActionLog(): readonly ActionLogEntry[] {
  return log;
}

export function onActionLog(listener: (log: readonly ActionLogEntry[]) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
```

---

## 6. Trajectory 可视化回放

### 6.1 概述

Agent 在 benchmark 中的执行轨迹，支持录制和回放，用于调试和论文展示。

### 6.2 录制格式

```json
{
  "version": 1,
  "task_id": "wechat:send_message_001",
  "agent": "generic_v2",
  "model": "gpt-4o",
  "timestamp": "2026-03-02T10:00:00Z",
  "steps": [
    {
      "step": 0,
      "observation": {
        "screenshot_path": "step_0.png",
        "route": { "app": "wechat", "path": "/" },
        "state_snapshot": "step_0_state.json"
      },
      "action": {
        "type": "CLICK",
        "params": { "x": 200, "y": 300 },
        "thinking": "I need to open the chat list"
      },
      "elapsed_ms": 2500
    }
  ],
  "result": {
    "success": true,
    "clean": true,
    "total_steps": 5,
    "total_time_ms": 12000
  }
}
```

### 6.3 回放组件

```typescript
// playground/TrajectoryPlayer.tsx
function TrajectoryPlayer({ trajectory }: { trajectory: Trajectory }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  return (
    <div className="flex gap-4">
      {/* 左侧：截图 + 动作标注 */}
      <div className="relative">
        <img src={trajectory.steps[step].observation.screenshot_path} />
        {/* 叠加点击/滑动标记 */}
        <ActionOverlay action={trajectory.steps[step].action} />
      </div>

      {/* 右侧：时间线 + 思考过程 */}
      <div>
        <Timeline steps={trajectory.steps} current={step} onSelect={setStep} />
        <ThinkingPanel text={trajectory.steps[step].action.thinking} />
        <Controls playing={playing} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      </div>
    </div>
  );
}
```

---

## 7. 发布到包管理器

### 7.1 npm

```json
// packages/core/package.json
{
  "name": "@mobile-gym/core",
  "version": "0.1.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist/"],
  "peerDependencies": {
    "react": "^18.0.0 || ^19.0.0"
  }
}
```

### 7.2 PyPI

```toml
# bench_env/pyproject.toml
[project]
name = "mobile-gym-bench"
version = "0.1.0"
description = "Benchmark environment for Mobile-Gym"
dependencies = [
    "playwright>=1.40.0",
    "openai>=1.0.0",
    "pillow>=10.0.0",
]

[project.scripts]
mobile-gym-bench = "bench_env.run:main"
```

### 7.3 Docker Hub

```bash
# 自动发布
docker build -t ghcr.io/<org>/mobile-gym:latest .
docker push ghcr.io/<org>/mobile-gym:latest
```

---

## 检查清单

### 近期（Phase 3 启动）
- [ ] 定义 `@mobile-gym/core` 的 barrel export
- [ ] 定义 `@mobile-gym/app-sdk` 的 barrel export
- [ ] 创建 App 开发模板仓库
- [ ] 定义 Agent Protocol v1 JSON Schema
- [ ] 部署 Web Playground（静态站点）

### 中期
- [ ] 使用 Turborepo/pnpm workspace 做 monorepo 拆分
- [ ] 发布 `@mobile-gym/core` 到 npm
- [ ] 发布 `@mobile-gym/app-sdk` 到 npm
- [ ] 发布 `mobile-gym-bench` 到 PyPI
- [ ] Playground V2（API Explorer）
- [ ] 实现 Action Logger
- [ ] 实现 DevTools Panel

### 长期
- [ ] 第三方 App 动态加载支持
- [ ] Agent SDK（TypeScript + Python）
- [ ] Trajectory 录制与回放
- [ ] Playground V5（Agent 对接）
- [ ] Docker Hub 自动发布
