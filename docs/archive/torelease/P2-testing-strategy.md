# P2 — 测试策略

> 优先级：**P2（架构提升）**
> 预计工作量：2 人 × 4 周
> 目标覆盖率：核心 OS 层 ≥ 80%，App 层 ≥ 40%，整体 ≥ 60%

---

## 1. 测试基础设施搭建

### 1.1 安装 Vitest

```bash
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom jsdom
```

### 1.2 `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: [
      'os/**/*.test.ts',
      'os/**/*.test.tsx',
      'apps/**/*.test.ts',
      'apps/**/*.test.tsx',
    ],
    exclude: ['node_modules', 'dist', 'bench_env'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['os/**/*.ts', 'os/**/*.tsx'],
      exclude: [
        'os/types/**',
        'os/keyboard/pinyinLargeDict.ts',
        '**/*.d.ts',
        '**/*.test.*',
      ],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
    },
  },
});
```

### 1.3 `test/setup.ts`

```typescript
import '@testing-library/jest-dom';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  get length() { return Object.keys(store).length; },
  key: (index: number) => Object.keys(store)[index] ?? null,
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock import.meta.glob（Vitest 支持，但某些模式需要 mock）
// 如果测试中需要 glob 结果，在各测试文件中单独 mock

// Reset global APIs before each test
beforeEach(() => {
  window.__OS__ = undefined;
  window.__SIM__ = undefined;
  window.__SIM_INPUT__ = undefined;
  window.__SIM_QUERY__ = undefined;
  localStorageMock.clear();
});
```

### 1.4 `package.json` scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest --run",
    "test:coverage": "vitest --run --coverage",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui"
  }
}
```

---

## 2. 核心 OS 模块测试计划

### 2.1 ServiceRegistry（优先级：最高）

```typescript
// os/__tests__/ServiceRegistry.test.ts

import { ServiceRegistry } from '../ServiceRegistry';
import { createSystemService } from '../createSystemService';

describe('ServiceRegistry', () => {
  beforeEach(() => {
    // 清理 registry（需要暴露 reset 方法或使用 internal API）
  });

  describe('register / get', () => {
    it('should register a service and retrieve it by name', () => {
      const service = createSystemService({
        name: 'test-service',
        defaultState: { count: 0 },
      });
      expect(ServiceRegistry.get('test-service')).toBe(service);
    });

    it('should throw for unknown service name', () => {
      expect(() => ServiceRegistry.get('nonexistent')).toThrow();
    });

    it('should ignore service with empty name', () => {
      // 确保不崩溃
    });
  });

  describe('resetAll', () => {
    it('should reset all registered services to defaults', () => {
      const svc = createSystemService({
        name: 'counter',
        defaultState: { count: 0 },
      });
      svc.set({ count: 42 });
      ServiceRegistry.resetAll();
      expect(svc.getState().count).toBe(0);
    });

    it('should continue resetting even if one service throws', () => {
      // 注册一个 reset 会抛错的服务
      // 验证其他服务仍被 reset
    });
  });

  describe('snapshot', () => {
    it('should return state snapshot of all services', () => {
      createSystemService({ name: 'a', defaultState: { x: 1 } });
      createSystemService({ name: 'b', defaultState: { y: 2 } });
      const snap = ServiceRegistry.snapshot();
      expect(snap.a).toEqual({ x: 1 });
      expect(snap.b).toEqual({ y: 2 });
    });
  });
});
```

### 2.2 createSystemService（优先级：最高）

```typescript
// os/__tests__/createSystemService.test.ts

describe('createSystemService', () => {
  describe('basic state management', () => {
    it('should initialize with default state', () => { /* ... */ });
    it('should update state with set()', () => { /* ... */ });
    it('should reset to default state', () => { /* ... */ });
    it('should not emit if set() produces no actual change', () => { /* ... */ });
  });

  describe('localStorage persistence', () => {
    it('should persist to localStorage when storageKey is set', () => { /* ... */ });
    it('should load from localStorage on creation', () => { /* ... */ });
    it('should handle corrupted localStorage gracefully', () => { /* ... */ });
    it('should skip persistence when storageKey is not set', () => { /* ... */ });
  });

  describe('validation', () => {
    it('should validate loaded state with validate function', () => { /* ... */ });
    it('should fall back to defaults if validation fails', () => { /* ... */ });
  });

  describe('subscribe', () => {
    it('should call listener immediately with current state', () => { /* ... */ });
    it('should call listener on state changes', () => { /* ... */ });
    it('should return unsubscribe function', () => { /* ... */ });
    it('should not call listener after unsubscribe', () => { /* ... */ });
  });

  describe('broadcast', () => {
    it('should send broadcast on state change when broadcastAction is set', () => {
      // Mock BroadcastBus
    });
  });

  describe('_replaceState', () => {
    it('should replace entire state and persist', () => { /* ... */ });
  });
});
```

### 2.3 BackDispatcher（优先级：高）

```typescript
// os/__tests__/BackDispatcher.test.ts

describe('BackDispatcher', () => {
  beforeEach(() => {
    // 清理 handlers
  });

  it('should execute handlers in priority order (highest first)', () => {
    const order: string[] = [];
    BackDispatcher.register('low', () => { order.push('low'); return false; }, 10);
    BackDispatcher.register('high', () => { order.push('high'); return false; }, 100);
    BackDispatcher.register('mid', () => { order.push('mid'); return false; }, 50);

    BackDispatcher.handleBack();
    expect(order).toEqual(['high', 'mid', 'low']);
  });

  it('should stop at first handler that returns true', () => {
    const lowCalled = vi.fn(() => true);
    BackDispatcher.register('high', () => true, 100);
    BackDispatcher.register('low', lowCalled, 10);

    BackDispatcher.handleBack();
    expect(lowCalled).not.toHaveBeenCalled();
  });

  it('should unregister handler via returned function', () => { /* ... */ });

  it('should handle handler errors gracefully', () => {
    BackDispatcher.register('err', () => { throw new Error('boom'); }, 100);
    BackDispatcher.register('ok', () => true, 10);

    expect(BackDispatcher.handleBack()).toBe(true);
  });

  it('should return false if no handler handles back', () => { /* ... */ });

  it('should ignore invalid handler registration', () => {
    const unsub = BackDispatcher.register('', null as any, 0);
    expect(typeof unsub).toBe('function');
  });
});
```

### 2.4 TaskManager（优先级：高）

```typescript
// os/__tests__/TaskManager.test.ts

describe('TaskManager', () => {
  describe('launchApp', () => {
    it('should create a new task for the app', () => { /* ... */ });
    it('should bring existing task to foreground if app already running', () => { /* ... */ });
    it('should set activeTaskId to the new task', () => { /* ... */ });
  });

  describe('closeTask', () => {
    it('should remove task from stack', () => { /* ... */ });
    it('should activate previous task after closing', () => { /* ... */ });
    it('should show launcher if no tasks remain', () => { /* ... */ });
  });

  describe('pushActivity', () => {
    it('should push new activity onto active task stack', () => { /* ... */ });
    it('should handle intent payload', () => { /* ... */ });
  });

  describe('popActivity', () => {
    it('should remove top activity from stack', () => { /* ... */ });
    it('should close task when last activity is popped', () => { /* ... */ });
  });

  describe('state persistence', () => {
    it('should persist to localStorage', () => { /* ... */ });
    it('should restore from localStorage on init', () => { /* ... */ });
  });

  describe('reset', () => {
    it('should clear all tasks and show launcher', () => { /* ... */ });
  });
});
```

### 2.5 BroadcastBus（优先级：中）

```typescript
// os/__tests__/BroadcastBus.test.ts

describe('BroadcastBus', () => {
  describe('sendBroadcast', () => {
    it('should deliver to all registered receivers for the action', () => { /* ... */ });
    it('should not deliver to receivers of different actions', () => { /* ... */ });
  });

  describe('sendOrderedBroadcast', () => {
    it('should deliver in priority order', () => { /* ... */ });
    it('should stop if receiver calls abort', () => { /* ... */ });
  });

  describe('registerReceiver', () => {
    it('should return unregister function', () => { /* ... */ });
    it('should handle duplicate registrations', () => { /* ... */ });
  });
});
```

### 2.6 IntentResolver（优先级：中）

```typescript
// os/__tests__/IntentResolver.test.ts

describe('IntentResolver', () => {
  describe('explicit intent', () => {
    it('should launch target app with intent payload', () => { /* ... */ });
    it('should return false for invalid appId', () => { /* ... */ });
  });

  describe('implicit intent', () => {
    it('should resolve to apps matching intent filter', () => { /* ... */ });
    it('should show chooser for multiple matches', () => { /* ... */ });
    it('should auto-launch for single match', () => { /* ... */ });
    it('should return false for no matches', () => { /* ... */ });
  });

  describe('result callback', () => {
    it('should invoke callback when setResult is called', () => { /* ... */ });
  });
});
```

### 2.7 simInput（优先级：高）

```typescript
// os/__tests__/simInput.test.ts

describe('SimInput', () => {
  describe('tap', () => {
    it('should dispatch click at CSS coordinates', () => { /* ... */ });
    it('should convert physical coordinates to CSS', () => { /* ... */ });
    it('should throw for non-finite coordinates', () => { /* ... */ });
  });

  describe('swipe', () => {
    it('should dispatch touchstart, touchmove, touchend sequence', () => { /* ... */ });
    it('should respect duration parameter', () => { /* ... */ });
    it('should handle directional shortcuts (up/down/left/right)', () => { /* ... */ });
  });

  describe('type', () => {
    it('should focus element and dispatch input events', () => { /* ... */ });
    it('should handle empty string', () => { /* ... */ });
  });

  describe('coordinate conversion', () => {
    it('should correctly convert between CSS and physical pixels', () => { /* ... */ });
    it('should handle devicePixelRatio', () => { /* ... */ });
  });
});
```

---

## 3. App 层测试计划

### 3.1 navigation.ts 测试模板

每个有 `navigation.ts` 的 App 应有对应测试：

```typescript
// apps/Wechat/__tests__/navigation.test.ts

import { NAVIGATION_DECLARATION } from '../navigation.declaration';

describe('Wechat Navigation Declaration', () => {
  it('should have valid routes with unique IDs', () => {
    const ids = new Set<string>();
    for (const route of NAVIGATION_DECLARATION.routes) {
      expect(ids.has(route.id)).toBe(false);
      ids.add(route.id);
    }
  });

  it('should have valid transitions referencing existing routes', () => {
    const routeIds = new Set(NAVIGATION_DECLARATION.routes.map(r => r.id));
    for (const t of NAVIGATION_DECLARATION.transitions ?? []) {
      if (t.from) expect(routeIds.has(t.from)).toBe(true);
      if (t.to) expect(routeIds.has(t.to)).toBe(true);
    }
  });

  it('should have no duplicate transition IDs', () => {
    const ids = new Set<string>();
    for (const t of NAVIGATION_DECLARATION.transitions ?? []) {
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
    }
  });
});
```

### 3.2 App State 测试模板

```typescript
// apps/Wechat/__tests__/state.test.ts

import { useWechatStore } from '../state';

describe('Wechat Store', () => {
  beforeEach(() => {
    useWechatStore.getState().reset?.();
  });

  it('should initialize with default state', () => {
    const state = useWechatStore.getState();
    expect(state).toBeDefined();
    // 检查关键字段
  });

  it('should persist and restore from localStorage', () => {
    // set state → verify localStorage → create new store → verify restored
  });
});
```

---

## 4. E2E Smoke Test

### 4.1 Playwright 前端 E2E

创建一个轻量级 E2E 测试（使用 Playwright Node.js 而非 Python bench_env）：

```bash
npm install -D @playwright/test
npx playwright install chromium
```

`playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 393, height: 851 },
  },
});
```

`e2e/smoke.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('Simulator Smoke Tests', () => {
  test('should load and show launcher', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="launcher"]', { timeout: 10000 });
    await expect(page.locator('[data-testid="launcher"]')).toBeVisible();
  });

  test('should expose __SIM__ API', async ({ page }) => {
    await page.goto('/');
    const hasSim = await page.evaluate(() => !!window.__SIM__);
    expect(hasSim).toBe(true);
  });

  test('should expose __OS__ API', async ({ page }) => {
    await page.goto('/');
    const hasOS = await page.evaluate(() => !!window.__OS__);
    expect(hasOS).toBe(true);
  });

  test('should launch and close an app', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__OS__!.launchApp('settings'));
    await page.waitForTimeout(500);

    const route = await page.evaluate(() => window.__OS__!.getAppRoute('settings'));
    expect(route).toBeTruthy();
    expect(route!.app).toBe('settings');

    await page.evaluate(() => window.__OS__!.closeApp('settings'));
    await page.waitForTimeout(300);
  });

  test('should reset via __SIM__.reset()', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.__OS__!.launchApp('settings'));
    // reset 会触发 reload，需要等待
    await page.evaluate(() => window.__SIM__!.reset());
    await page.waitForLoadState('domcontentloaded');
    const hasSim = await page.evaluate(() => !!window.__SIM__);
    expect(hasSim).toBe(true);
  });

  test('__SIM_INPUT__.tap should work', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);
    const result = await page.evaluate(() => {
      try {
        window.__SIM_INPUT__!.tap(200, 400);
        return true;
      } catch {
        return false;
      }
    });
    expect(result).toBe(true);
  });
});
```

### 4.2 CI 中运行 E2E

在 `.github/workflows/ci.yml` 添加：

```yaml
  e2e:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

---

## 5. Benchmark 测试

### 5.1 bench_env 单元测试

```bash
pip install pytest pytest-asyncio pytest-cov
```

`bench_env/conftest.py`:

```python
import pytest

@pytest.fixture
def sample_observation():
    """提供一个标准的 Observation 示例"""
    return {
        "image_data_url": "data:image/png;base64,...",
        "route": {"app": "wechat", "path": "/"},
        "state": {"apps": {}, "os": {}},
    }
```

`bench_env/task/test_judge.py`:

```python
import pytest
from bench_env.task.judge import StateComparator, JudgeInput, JudgeResult

class TestStateComparator:
    def test_diff_states_no_change(self):
        """相同状态应返回空 diff"""
        s1 = {"apps": {"wechat": {"chats": []}}, "os": {}}
        diff = StateComparator.diff_states(s1, s1)
        assert len(diff) == 0

    def test_diff_states_detects_change(self):
        """不同状态应返回 diff"""
        s1 = {"apps": {"wechat": {"unread": 0}}, "os": {}}
        s2 = {"apps": {"wechat": {"unread": 5}}, "os": {}}
        diff = StateComparator.diff_states(s1, s2)
        assert len(diff) > 0

    def test_filter_unexpected_changes(self):
        """应正确过滤预期内的变更"""
        # ...
```

`bench_env/agent/test_agents.py`:

```python
import pytest
from bench_env.agent.generic_v2 import GenericV2Agent
from bench_env.env.base import Observation

class TestGenericV2Agent:
    def test_parse_response_valid(self):
        """合法响应应正确解析"""
        agent = GenericV2Agent(config={})
        response = '<THINK>I need to click</THINK><ANSWER>{"action": "CLICK", "x": 100, "y": 200}</ANSWER>'
        action = agent.parse_response(response)
        assert action.action_type.value == "CLICK"

    def test_parse_response_invalid(self):
        """非法响应应返回 NOOP 或抛出"""
        # ...
```

---

## 6. 测试覆盖率目标

### 阶段性目标

| 阶段 | OS 层 | App 层 | bench_env | 整体 |
|------|-------|--------|-----------|------|
| Phase 1（2 周） | 50% | 0% | 20% | 30% |
| Phase 2（4 周） | 80% | 20% | 40% | 50% |
| Phase 3（8 周） | 80% | 40% | 60% | 60% |

### 必须覆盖的关键路径

| 模块 | 关键路径 | 目标覆盖率 |
|------|---------|-----------|
| `createSystemService` | create → set → persist → restore → reset | 95% |
| `ServiceRegistry` | register → get → resetAll → snapshot | 95% |
| `BackDispatcher` | register → handleBack（优先级排序） | 90% |
| `TaskManager` | launch → push → pop → close → reset | 85% |
| `IntentResolver` | explicit → implicit → chooser → result callback | 80% |
| `simInput` | tap → swipe → type → coordinate conversion | 85% |
| `BroadcastBus` | send → ordered → abort | 80% |
| `AppNavigatorRegistry` | register → getAppRoute → waitForNavigator | 80% |

---

## 7. 持续集成中的测试策略

```
PR 提交
  ├── tsc --noEmit        (必须通过)
  ├── eslint              (必须通过)
  ├── vitest --run        (必须通过)
  └── nav-consistency     (必须通过)

合并到 main
  ├── 以上全部
  ├── vitest --coverage   (覆盖率不可低于阈值)
  └── playwright e2e      (smoke test 必须通过)

发布 tag
  ├── 以上全部
  ├── docker build 验证
  └── bench_env pytest
```

---

## 检查清单

- [ ] 安装 Vitest + Testing Library
- [ ] 创建 `vitest.config.ts`
- [ ] 创建 `test/setup.ts`
- [ ] 编写 `ServiceRegistry` 单元测试
- [ ] 编写 `createSystemService` 单元测试
- [ ] 编写 `BackDispatcher` 单元测试
- [ ] 编写 `TaskManager` 单元测试
- [ ] 编写 `BroadcastBus` 单元测试
- [ ] 编写 `IntentResolver` 单元测试
- [ ] 编写 `simInput` 单元测试
- [ ] 编写 Navigation Declaration 结构验证测试（模板化）
- [ ] 安装 Playwright（Node.js）
- [ ] 编写 E2E smoke test
- [ ] 配置 CI 中的测试步骤
- [ ] 配置覆盖率阈值
- [ ] bench_env pytest 基础设施
- [ ] bench_env judge 单元测试
- [ ] bench_env agent 解析测试
