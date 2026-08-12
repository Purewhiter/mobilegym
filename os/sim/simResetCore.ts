import BroadcastBus, { ACTION_BOOT_COMPLETED } from '../BroadcastBus';
import { now } from '../TimeService';
import { clearFileSystemDB } from '../FileSystemService';
import { resetAllOsStores } from '../createOsStore';
import { resetAllAppStores } from '../createAppStore';
import { cancelAllPending as cancelAllPendingPersistWrites, beginPersistReset } from '../debouncedPersist';
import TextSelectionService from '../TextSelectionService';
import { OsStateStore } from '../OsStateStore';
import { TaskManager } from '../TaskManager';
import { clearNavError } from '../osNavError';

/**
 * `__SIM__.resetState()` 的核心编排：清空全部持久化与运行时状态但不 reload。
 * `__SIM__.reset()` 在此之上追加 window.location.reload()。
 */
export async function resetStateCore(): Promise<void> {
  // 顺序很关键 — 解释见 createAppStore.ts:resetAllAppStores 注释。
  //   0) beginPersistReset: 翻开 reset gate。即便有 effect 在后续异步窗口触发
  //      setState 排进 pending, 之后 page.goto 触发的 beforeunload → flushAll
  //      看到 gate 已开 → 直接 clear timer 不写 localStorage。模块级 flag, page
  //      reload 后新文档重新加载本模块自动回到 false。
  //   1) 内存 reset: app + OS stores 全部回到 initialState。setState 会触发
  //      persist 写入排到 debounce 队列。
  //   2) cancelAllPending: 把 step 1 的 pending 写入丢掉, 否则 page.goto 时
  //      的 beforeunload → flushAll 会把这些"reset 后的 initial"写入 localStorage,
  //      同时 X store 在 reset 前残留的 task 末态 setState (如 toggleBookmark)
  //      若仍在 debounce 队列里也会被一起 flush。
  //   3) localStorage.clear: 清掉旧持久化, 让新 page hydrate 时拿到 initialState。
  //   4) clearFileSystemDB 是 await IndexedDB transaction, 期间旧 page 仍存活,
  //      React effect cleanup / 用户操作可能再次 setState 排入 pending。
  //      所以在它后面再清一次 pending + localStorage 兜底, 把 await 期间的脏写
  //      也丢掉。
  //   5) 第二次 sweep 之后到 Python page.goto 之间仍有 effect 窗口, 但 gate 已开,
  //      beforeunload flushAll 会跳过。
  beginPersistReset();
  resetAllAppStores();
  resetAllOsStores();
  OsStateStore.reset();
  TaskManager.reset();
  clearNavError();

  cancelAllPendingPersistWrites();
  localStorage.clear();

  // TextSelectionService is opted out of the registry (DOM refs in state),
  // so reset it manually to avoid stale targetElement / menu state.
  TextSelectionService.hideSelectionMenu();
  try {
    await clearFileSystemDB();
  } catch (error) {
    console.error('[SIM] clearFileSystemDB failed (non-fatal, reload will reinit):', error);
  }

  // Second sweep: 关闭 clearFileSystemDB await 窗口期内任何新的 persist 排队。
  cancelAllPendingPersistWrites();
  localStorage.clear();

  // resetAllOsStores() wiped the volatile derived services (AlarmManager /
  // MediaSession) AFTER resetAllAppStores() re-published into them, leaving
  // them empty. Re-emit BOOT_COMPLETED (as a soft reboot would) so the app
  // publishers re-publish from their now-default stores. Mirrors how
  // Android apps re-register alarms / sessions on BOOT_COMPLETED. The
  // reload() variant gets a fresh BOOT_COMPLETED from the mount effect, so
  // this only matters for the no-reload resetState() path.
  BroadcastBus.sendBroadcast({
    action: ACTION_BOOT_COMPLETED,
    extras: { now: now() },
  });
}
