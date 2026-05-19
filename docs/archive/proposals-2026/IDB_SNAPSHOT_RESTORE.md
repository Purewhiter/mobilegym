# IDB Snapshot / Restore — Fast Reset Path for RL Training

> Goal: drop env reset latency from current ~3s (full pipeline) to **~50ms** by replacing page reload + waitForData with in-memory state snapshot/restore, including IndexedDB-backed virtual filesystem.

## 背景

当前 `bench_env.env.MobileGymEnv.reset()` 走的是：

```
__SIM__.resetState()              # JS 内存清 stores       — ~5 ms
+ page.goto(url)                  # Chromium reload         — ~25 ms
+ _wait_ready                     # 轮询 __SIM__ 就绪
+ waitForData(app_ids)            # 重 import + parse 28 个 defaults.json — ~500-2500 ms
─────────────────────────────────
median 0.9 s（eval, par=4, 子集 app_ids）
median 3.0 s（all-app, microbench）
```

GRPO 训练在每个 step 跑 96 trajectory × N step；reset 占总训练时间 **数小时到数百小时**（按 10K step / 96 万 trajectory 算，当前 reset 路径累计 ~850 小时）。

## 设计

新增**两条 OS API**：

```ts
__SIM__.snapshotFull(): Promise<SimSnapshot>     // 一次性拿全状态快照（含 IDB blobs）
__SIM__.restoreFull(snap: SimSnapshot): Promise<void>   // 从快照恢复，跳过 page reload
```

`SimSnapshot` 结构：

```ts
type SimSnapshot = {
  apps: Record<AppId, any>;                  // 所有 App store state（来自 getAllAppStates）
  os: {
    build: any; telephony: any;
    settings: any; hardware: any;
    permissions: any; preferences: any;
    providers: Record<string, any>;          // contacts, sms, media, ...
  };
  fileSystem: {
    metadata: FSNode[];                      // 所有目录与文件 metadata
    blobs: Map<string, Blob>;                // IDB STORE_FILES 的全量 dump（key=file id）
  };
};
```

### restoreFull 行为

```ts
async function restoreFull(snap: SimSnapshot) {
  localStorage.clear();
  await resetAllOsStores();
  await clearFileSystemDB();

  // 1. 通过现有 setState API 写回 stores（已支持）
  __SIM__.setState({ apps: snap.apps, os: snap.os }, { deep: false });

  // 2. 写回 IDB（新增）
  const db = await ensureDb();
  const tx = db.transaction([STORE_FILES, STORE_METADATA], 'readwrite');
  const fs = tx.objectStore(STORE_FILES);
  const ms = tx.objectStore(STORE_METADATA);
  for (const [id, blob] of snap.fileSystem.blobs) fs.put({ id, content: blob });
  for (const m of snap.fileSystem.metadata) ms.put(m);
  await new Promise((res, rej) => { tx.oncomplete = res; tx.onerror = rej; });

  // 3. 重建 in-memory FileSystemState（从 IDB 重读）
  await reloadFileSystemState();
}
```

**关键性质：**

- `Map<string, Blob>` 跨 IDB transaction **共享 blob backing**，restore 不复制 binary（已用 `scripts/dev/idb_blob_sharing_test.py` 实测验证：S2 - S1 = 0 MB）
- 不 reload page → 不重 mount React → 不重新 import App data loader → 没有 dynamic import 的 fetch 开销
- 不需要 `window.location.reload()`，所以 React tree 整体保留，只是 stores 内容被覆盖

## 内存代价

| 维度 | 单 browser context | n=64 并行 |
|---|---|---|
| `apps` snapshot（JSON）| ~10-30 MB | ~640 MB-1.9 GB |
| `os` snapshot（含 providers）| ~1-5 MB | ~60-320 MB |
| `fileSystem.metadata`（JSON 节点）| ~100 KB-1 MB | <100 MB |
| `fileSystem.blobs`（Blob refs，共享 backing）| **0 额外**（与 IDB 共占同一份）| 0 额外 |

每条 trajectory 的 reset 不产生新内存分配，仅做引用复制 + setState。

**唯一大头：每个 browser context 自己的 IDB blob storage**，等于 `public/sdcard/` 的 binary 总量（当前估 ~200 MB）。n=64 时是 ~12.8 GB —— 这是 per-context 写隔离的固有代价（参见后文"为什么不能跨 context 共享"）。

## 实测预期

基于 `scripts/bench/perf/mem_microbench.py` 的 `snapshot_restore` 路径（不含 IDB）：

| 路径 | median | 含义 |
|---|---|---|
| `resetState_js_only` | 4.5 ms | 仅清 stores |
| `snapshot_restore`（仅 stores）| 5.3 ms | clear + setState |
| `env.reset` E2E（全 App）| 3254 ms | 当前 bench 路径 |

加上 IDB restore 的预估：

```
clear IDB: ~5 ms
put N=O(100) records: ~20-40 ms（按 100 个 file metadata + 50 个 binary blob 引用）
reload FS state from IDB: ~5 ms
─────────────────────────────────
total ~30-50 ms
```

**端到端 reset：约 50 ms**（vs 当前 0.9-3.0 s）—— **~60× 加速**。

## API 兼容性

不破坏现有 `__SIM__.reset()` 与 `env.reset()`。新增并行路径：

```python
# Python 侧
class MobileGymEnv:
    async def reset(self, app_ids=None, *, fast_path=False, snapshot=None) -> None:
        if fast_path and snapshot is not None:
            await self._reset_via_snapshot(snapshot)
        else:
            await self._reset_legacy(app_ids)
```

Bench runner 在 `start()` 后调用一次 `await env.snapshot()` 缓存到 worker 内存，之后每个 task 调 `await env.reset(fast_path=True, snapshot=cached)`。

任务声明 `requires_filesystem` 字段控制是否需要 IDB restore：

```python
class BaseTask:
    requires_filesystem: bool = True   # 默认安全：full restore

class SettingsOnlyTask(BaseTask):
    requires_filesystem = False         # 不动 sdcard，跳过 IDB restore
```

## 为什么不能跨 context 共享

n=64 并行 browser × 200 MB sdcard = 12.8 GB —— 这是 OS 隔离的固有代价。可选项：

| 方案 | 单 browser FS | n=64 总占 | 写隔离 | 字节级一致 reset |
|---|---|---|---|---|
| Android emulator | ~4 GB | 256 GB | ✓ | ✗ ADB 难精确 rollback |
| **本方案：per-context IDB + snapshot** | ~200 MB | ~12.8 GB | ✓ | ✓ |
| 静态 `public/sdcard/` 共享 | 0 | 0 | **✗** | N/A |
| 真机 + 多设备 | ~10 GB | 不可行 | ✓ | ✗ 数据漂移 |

写隔离是 RL 批量 rollout 的硬要求：每条 trajectory 可以独立创建/删除/重命名文件而不互相覆盖。无写隔离 → 文件相关任务（笔记附件、相册管理、文件管理、微信文件、`organize_*` hard 任务）整批退出 RL 训练循环。**12.8 GB / 64 路 = 每路 200 MB 的代价换 RL 全任务覆盖，是值得的 tradeoff。**

## 实施步骤

### Phase 1：OS 层 API（~4 小时）

`os/FileSystemService.ts`：

- [ ] 新增 `snapshotFileSystem(): Promise<{ metadata: FSNode[]; blobs: Map<string, Blob> }>`
  - 遍历 `state.nodes` 收集 metadata
  - `getAllRecords(STORE_FILES)` 拿 blob refs
- [ ] 新增 `restoreFileSystem(snap)`
  - `clearFilesAndMetadataStores()` 清空 IDB
  - 批量 put metadata + blobs（单事务）
  - 重建 `state.nodes` 与 `pathIndex`
  - 清空 `blobUrlCache`（旧 URL 失效）

`os/OSContext.tsx`：

- [ ] 在 `window.__SIM__` 上加 `snapshotFull()` / `restoreFull()`
  - `snapshotFull` 调 `getState()` + `snapshotFileSystem()` 拼起来
  - `restoreFull` 调 `setState()` + `restoreFileSystem()`，**不 reload page**

### Phase 2：bench_env 集成（~3 小时）

`bench_env/env/mobile_gym.py`：

- [ ] `MobileGymEnv.snapshot()` —— 调用 page-side `__SIM__.snapshotFull()`，序列化为 Python 对象（`metadata` 通过 JSON，`blobs` 通过 ID 列表 + 让 page 持有原 Blob refs，不跨进程传输）
- [ ] `MobileGymEnv.reset(fast_path=True, snapshot_id)` —— 调 page-side `__SIM__.restoreFull(stash[snapshot_id])`，page 端有缓存 stash 避免重复传输
- [ ] 添加 `_wait_ready_after_restore`（不需要等 page goto，只需等 `__SIM__` 仍在）

`bench_env/runner/parallel.py`:

- [ ] 在 `EnvPool` setup 后对每个 env 调 `await env.snapshot()` 缓存
- [ ] 每个 task 之间调 `await env.reset(fast_path=True, snapshot_id=cached_id)`
- [ ] 任务声明 `requires_filesystem=True` 时 fall back 到 legacy `env.reset()`

### Phase 3：验证（~1 小时）

- [ ] 扩 `scripts/bench/perf/mem_microbench.py` 的 `snapshot_restore` 路径，加 `--with-idb` 选项，覆盖 OS 完整路径，实测端到端时延
- [ ] 跑一组 par=64 的 GRPO mini-batch 模拟，对比 reset 时间总和与峰值内存
- [ ] 跨任务串跑 10 个 task，confirm 文件状态、App store 状态、OS settings 都正确恢复（与每次完整 reset 的状态做 diff）

### Phase 4：论文 / 论证（~30 分钟）

- 把"<50 ms reset"改为实测数字（带 microbench 链接）
- 资源对比表加一行 `n=64 并行下文件系统总占用`，跟 Android emulator 对比
- §6.5 在线 RL 训练那一节补一段说"每个 batch reset 累计耗时从 5 分钟降到 5 秒"

## 不在本方案范围

- **运行时 service 状态**（NotificationService 通知队列、ClipboardService 历史等）：当前 reset 后这些都是空的；如果未来任务要测"通知不被清除的 reset 语义"，再扩 setState 接 services patch
- **跨任务 stash 共享**：当前每个 worker 自己持有一份 snapshot；跨 worker 共享 snapshot 内存可以再优化（共享 SharedArrayBuffer），但需要 cross-origin isolation header，复杂度 vs 收益（最多省一份 snapshot 内存）不划算
- **任务定制 filesystem patch**：任务在 reset 时注入"我假设用户已下载了 X 文件"。可以作为 `restoreFull(snap, extra_patch)` 的扩展，留作后续

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| Blob 跨 IDB 写入是否真的不复制 | 已 `scripts/dev/idb_blob_sharing_test.py` 实测验证，S2-S1=0 MB |
| `setState` 不接 `os.providers` | **已确认接**（`applyOsStatePatch` line 248-253） |
| `restoreFull` 后 React tree 状态错乱 | 不 reload，依赖 Zustand 订阅自动 re-render；需要测 launcher / status bar / shade 等 OS UI 是否正确刷新 |
| Blob URL 缓存（`blobUrlCache`）失效 | restore 时清空缓存，应用代码下次 `getFileBlobUrl` 重新生成 |
| 任务标注 `requires_filesystem` 错误 | 默认 `True`（保守），逐个任务审查 + 加 lint 检查"任务实现里是否调用 FS API" |

## 度量目标

- `snapshot_restore + idb` median 时延 ≤ **50 ms**（n=1 pages）
- n=64 browser 并行下，平均 reset 时延 ≤ 100 ms（含 RPC overhead）
- 跨 100 task 顺序执行，最终 `__SIM__.getState()` 与第 1 个 task 起点的 deep diff 应为空集
