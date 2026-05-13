# bench reset 改用 page lifecycle 隔离

> 状态：待实施
> 日期：2026-05-12
> 范围：`bench_env/env/mobile_gym.py`、`os/OSContext.tsx`、`os/createAppStore.ts`、`os/debouncedPersist.ts`

## 1. 背景

当前 bench 主路径 reset 流程是 **同一 page 内的"页内 reset"**：

```
task1 end → __SIM__.resetState() → page.goto(url) → task2 start
```

`__SIM__.resetState()` 内部一连串协调：内存 reset (`resetAllAppStores` / `resetAllOsStores` / `OsStateStore.reset` / `TaskManager.reset`)、清 debounce pending、清 localStorage、清 IndexedDB。`page.goto` 之后新 document 复用 HTTP cache。

由于 storage isolation 的 namespace 在 `'tab'` 模式下通过 sessionStorage 持有，**同一 page 内 reload 复用同一 namespace**，task 之间共享 localStorage 命名空间。reset 必须显式清当前 namespace 内的所有 key，否则下个 task hydrate 时读到上个 task 的脏数据。

这条路径存在多个 race 窗口（详见 `os/OSContext.tsx:_resetStateCore` 注释），过去几轮针对 X bookmark cross-task 污染逐步加补丁：

- `resetAllAppStores`（`os/createAppStore.ts:185`）：storeRegistry 内所有 app store 强制 setState 回 initial
- 双 sweep（`os/OSContext.tsx:654-668`）：`cancelAllPendingPersistWrites` + `localStorage.clear` 在 `clearFileSystemDB` await 前后各一次，封 IndexedDB await 期间的 race
- reset gate（`os/debouncedPersist.ts:14-23`）：`beginPersistReset` 标志位，4 条 setItem 路径（debouncedSetItem timer / immediateSetItem / flushKey / flushAll）全部检查 gate
- `__SIM__.setState` 入口主动 `endPersistReset`：让 state-builder / mem_microbench 等 non-reload 场景仍能正常写盘

修完核心 X bookmark 问题已可靠，但留下两类 followup：

1. 直接 `localStorage.setItem` 绕过 gate 的 4 处（`os/managers/registry.ts:47` / `os/wmr/engine/variables.ts:1598` / `apps/Map/utils/offlineRouteStore.ts:126` / `apps/Map/utils/offlinePlaceStore.ts:172`），仍可能在 reset 期间污染（Codex 评估 Map L2 cache 中等风险）
2. gate 永久 true 副作用：非 reload 场景（state-builder snapshot restore / mem_microbench 单文档反复 reset）依赖 `__SIM__.setState` 主动重置 gate

## 2. 方案：销毁 page + 开新 page

利用 Playwright 的 page lifecycle，把 reset 从"同 page 内清状态"改为"销毁旧 page + 开新 page"。结合项目早就具备的 `os/storageIsolation.ts` namespace 机制，新 page 自动获得新 namespace（sessionStorage 在新 tab 中为空 → `getStorageNamespace()` 生成新 ns），物理上隔离旧 task 写入的 localStorage / IndexedDB key。

### 2.1 reset 流程

```python
# bench_env/env/mobile_gym.py:_reset_sim
async def _reset_sim(self, timeout_ms: int = 60000) -> None:
    # 1. 干掉旧 page (跳过 beforeunload, 立即 destroy 所有 timer/effect/listener)
    if self._page and not self._page.is_closed():
        await self._page.close(run_before_unload=False)

    # 2. 同 context 开新 page (复用 HTTP cache, 不会 cold-context 502)
    self._page = await self._context.new_page()

    # 3. about:blank 加载, 触发 storageIsolation 在新 tab 上生成新 namespace
    await self._page.goto("about:blank")

    # 4. 加载 sim, hydrate 时 storage 已是新 namespace, 读不到任何旧 task 写入
    await self._page.goto(self.url, wait_until="load", timeout=timeout_ms)
```

### 2.2 自动消除的问题

| 问题 | 原因 |
|---|---|
| reset gate 维护负担 | page kill 等于 JS heap / timer / effect / listener 全部销毁，无需协调 |
| beforeunload flushAll race | `page.close(run_before_unload=False)` 跳过 beforeunload；即使触发也是写到旧 namespace |
| `clearFileSystemDB` await race | 新 page 的 namespaced IndexedDB 是独立 DB，旧 DB 在 BrowserContext 内不影响 |
| Map / WMR / scenario 直写 localStorage | 写到旧 namespace 的 key，新 page 完全看不到 |
| `__SIM__.setState` gate 副作用 | 不再依赖 gate，state-builder 等可放心调 |

### 2.3 残留 trade-off

旧 namespace 的 key 物理上仍在 localStorage / IndexedDB 内（namespace 隔离不删除旧 key），跑很多 task 会堆积。需要定期 GC：

```python
# 每 N 次 reset 调一次, 在新 page 上跑
async def _gc_old_namespaces(self):
    await self._page.evaluate("""() => {
        const currentNs = sessionStorage.getItem('__MG_STORAGE_NS__');
        const currentPrefix = currentNs ? `mg:${currentNs}:` : null;
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || !k.startsWith('mg:')) continue;
            if (currentPrefix && k.startsWith(currentPrefix)) continue;
            toRemove.push(k);
        }
        toRemove.forEach(k => localStorage.removeItem(k));
    }""")
```

IndexedDB 类似 — `indexedDB.databases()` 列出所有 DB，删除非当前 namespace 的（DB 名带 `mg_{ns}__` 前缀）。

GC 频率：5MB localStorage quota + 每个 task 一个 namespace（K-MB 级），保守每 50 次 reset GC 一次足够。

### 2.4 性能

| 阶段 | 当前 (resetState+goto) | 新 (close+new+goto) |
|---|---|---|
| JS reset evaluate | ~50ms | — |
| page.close | — | ~10ms |
| new_page + about:blank goto | — | ~50ms |
| sim url goto | ~500ms | ~500ms |
| **总计** | ~550ms | ~560ms |

实际差异 < 20ms / reset，可接受。

## 3. 代码改造清单

### 3.1 bench_env/env/mobile_gym.py
- 改写 `_reset_sim()` 为 close+new+goto 流程
- 处理 `self._page` 引用替换：env 内可能有缓存 `self._page` 的下游对象（observation / action 派发等），确认全部走 `self._page` getter 不缓存旧 ref
- 加 `_gc_old_namespaces()` 周期清理（reset_count % 50 == 0 触发）
- retry 逻辑：close 失败 / new_page 失败 / goto 失败各自的 retry 策略

### 3.2 os/OSContext.tsx
- `_resetStateCore` 保留供 non-bench 工具（state-builder / mem_microbench）使用，行为不变
- 文档说明 bench 主路径不走 `__SIM__.resetState`，避免新手误解

### 3.3 可回滚的过度防护
确认 bench 完全切换到 close+new 路径、稳定运行一段后，可考虑回滚：

- `os/debouncedPersist.ts`: reset gate 机制（`beginPersistReset` / `endPersistReset` / 4 处 gate 检查）
- `os/createAppStore.ts`: `resetRegistry` / `resetAllAppStores`
- `os/OSContext.tsx`: 双 sweep / `beginPersistReset` 调用 / `setState` 入口 `endPersistReset`

但 **建议保留**，因为：
- `__SIM__.resetState` 仍被 state-builder / mem_microbench 等使用
- 单 page 内 reset 仍可能在某些 dev/debug 场景需要彻底干净
- 维护成本不高（不到 100 行），保留作为 belt-and-suspenders

### 3.4 namespace isolation 必须可靠
现状 `os/storageIsolation.ts` 默认 `'tab'` 模式 + sessionStorage 跨 page reload 持有 namespace。新方案前提：
- 销毁 page + 新建 page 后，新 page 的 sessionStorage 为空
- `getStorageNamespace()` 在 sessionStorage 空时生成新 namespace
- IndexedDB 通过 `getNamespacedIndexedDbName()` 自动使用新 namespace

需要写单测验证："new page in same context → namespace differs from prev page"。

## 4. 风险

1. **`page.close({run_before_unload: false})` 行为差异**：Playwright Python API `close(run_before_unload=False)`，Node API 是 `runBeforeUnload`，需确认参数名。
2. **HTTP cache 复用**：close+new 仍在同一 context，HTTP cache 共享，不会触发 cold-context 502。已验证 `bench_env/env/pool.py` 注释明确 "pages: 多 Page，共享 Context（最轻量，适用于 namespace 隔离的模拟器）"，bench 设计本来就是 namespace 隔离思路。
3. **storageIsolation `'off'` 模式下方案失效**：如果显式禁用了 namespace（`?storageIsolation=off`），新 page 跟旧 page 共享物理 localStorage。需要 bench 启动时强制 `?isolate=1` 或在 URL 上自动 append。
4. **WebSocket / SSE 长连接**：旧 page 的长连接被 abort，对 bench 无影响（每个 task 独立流量）。
5. **state-builder / mem_microbench 等非 bench 工具**：它们继续走 `__SIM__.resetState` + `__SIM__.setState` 路径，不受影响。

## 5. 验证计划

1. 单测：`new page in same context → namespace differs`
2. 复现用户实测场景：human agent + multi-task X suite（task1 SearchAndBookmark grok → task2 SearchMultipleKeywordsAndInteract grok）
3. 长跑：100+ task 序列验证 namespace GC 正确，localStorage 不超 quota
4. 并发：`--parallel 32` + `--isolation pages` 验证多 page 互不污染

## 6. 实施顺序

1. namespace 验证单测
2. `_reset_sim` 改造 + GC
3. 跑用户实测的 multi-task X 序列验证
4. 跑全 suite 验证无 regression
5. 文档更新（`docs/runbooks/` 或 `bench_env/README.md`）
6. （可选）回滚部分过度防护

---

## 附：当前已做的防护（不动）

X bookmark cross-task bug 已通过当前同 page reset 路径修复，落地于：

- `os/createAppStore.ts`：`resetRegistry` + `resetAllAppStores()`
- `os/debouncedPersist.ts`：reset gate + 4 路径检查
- `os/OSContext.tsx`：`_resetStateCore` 双 sweep + `setState` 入口重置 gate
- 验证：tsc 0 / pytest offline 95/95 / pytest live 22/22 / Codex 6 轮审计 LGTM

新方案落地后，这套防护仍作为非 bench 工具（state-builder / mem_microbench）的 reset 保障。
