import type { AppId } from './types';
import type { ActivityResult } from './types/manifest';
import { KeyboardService } from './keyboard/KeyboardService';
import { TaskManager } from './TaskManager';
import { IntentResolver } from './IntentResolver';
import { BackDispatcher } from './BackDispatcher';
import { AppNavigatorRegistry } from './AppNavigatorRegistry';
import { routeSetPreference } from './managers/registry';
import { realNow } from './TimeService';
import { getActiveTask, getTaskTopActivity } from './taskUtils';
import { recordNavError, clearNavError } from './osNavError';

/**
 * OS 动作门面：从 OSContext 提升出来的模块级命令函数。
 *
 * 提升依据（见 docs/pending/split-plans-2026-08-12.md 方案一）：这些函数原为
 * OSProvider 内 deps=[] 的 useCallback，闭包体不捕获任何 render 快照——状态
 * 一律经 TaskManager.getState() / IntentResolver.getState() 即时读取，因此
 * 提升为模块单例函数后单次会话内行为等价。
 *
 * 依赖约束：本模块不得 import osApi / sim/simApi / OSContext（组合根方向唯一）。
 */

export function buildOsDebugStack(tag: string): string {
  try {
    throw new Error(tag);
  } catch (error) {
    if (!(error instanceof Error) || !error.stack) return 'n/a';
    return error.stack
      .split('\n')
      .slice(1, 5)
      .map((line) => line.trim())
      .join(' <- ');
  }
}

export function launchApp(appId: AppId): void {
  KeyboardService.hide();
  TaskManager.launchApp(appId);
}

export function launchTaskById(taskId: string): void {
  KeyboardService.hide();
  TaskManager.activateTask(taskId);
}

export function goHome(): void {
  KeyboardService.hide();
  TaskManager.goHome();
}

export function showRecents(): void {
  KeyboardService.hide();
  TaskManager.showRecents();
}

export function setBrightness(value: number): void {
  routeSetPreference('brightness', value, { source: 'os' });
}

export function setVolume(value: number): void {
  routeSetPreference('media_volume', value, { source: 'os' });
}

export function chooseIntentActivity(appId: AppId): void {
  IntentResolver.chooseIntentActivity(appId);
}

export function cancelIntentChooser(): void {
  IntentResolver.cancelIntentChooser();
}

export function handleSystemBack(): void {
  BackDispatcher.handleBack();
}

export async function navigateToActivity(
  activityId: string,
  route: string,
  opts?: { fallbackAppId?: AppId; replace?: boolean },
): Promise<void> {
  const latestState = TaskManager.getState();
  let appId: AppId | undefined = opts?.fallbackAppId;
  let isInForeignTask = false;
  for (const task of latestState.tasks) {
    const found = task.stack.find((activity) => activity.activityId === activityId);
    if (found) {
      appId = found.appId;
      isInForeignTask = task.rootAppId !== found.appId;
      break;
    }
  }
  if (!appId) {
    console.warn(`[OS] navigateToActivity: activity not found (${activityId})`);
    return;
  }

  const startTime = realNow();
  const nav = await AppNavigatorRegistry.waitForNavigator({
    activityId,
    appId: isInForeignTask ? undefined : appId,
    timeoutMs: 5000,
  });
  if (!nav) {
    recordNavError(route, activityId);
    console.warn(`[OS] Navigate to ${route} timed out after 5000ms (activity=${activityId})`);
    return;
  }
  console.log(
    `[OSDBG] navigateToActivity activityId=${activityId} appId=${appId} route=${route} `
    + `replace=${opts?.replace != null ? String(opts.replace) : '-'} foreignTask=${String(isInForeignTask)}`,
  );
  nav(route, opts?.replace != null ? { replace: opts.replace } : undefined);
  clearNavError();
  console.log(`[OS] Navigate activity ${activityId} -> ${route} in ${realNow() - startTime}ms`);
}

export function finishTopActivity(taskId: string, result?: ActivityResult): void {
  const latestState = TaskManager.getState();
  const task = latestState.tasks.find((t) => t.taskId === taskId);
  if (!task || task.stack.length === 0) return;

  const top = task.stack[task.stack.length - 1];
  let callbackToRun: ((payload: ActivityResult) => void) | null = null;
  let callbackPayload: ActivityResult = { resultCode: 'CANCELED' };

  if (top.requestCode != null) {
    const pending = TaskManager.takePendingCallback(top.requestCode);
    if (pending) {
      callbackToRun = pending.callback;
      callbackPayload = result ?? { resultCode: 'CANCELED' };
    }
  }

  const isInForeignTask = task.rootAppId !== top.appId;

  if (!isInForeignTask) {
    const targetNav = AppNavigatorRegistry.get(top.appId)?.navigate;
    if (typeof targetNav === 'function') {
      try { targetNav('/'); } catch { /* ignore */ }
    }
  }

  const activityNav = AppNavigatorRegistry.getActivity(top.activityId)?.navigate;
  if (typeof activityNav === 'function') {
    try { activityNav('/'); } catch { /* ignore */ }
  }

  TaskManager.popActivity(taskId);

  if (callbackToRun) {
    requestAnimationFrame(() => callbackToRun?.(callbackPayload));
  }
}

export function finishActivity(result?: ActivityResult): void {
  KeyboardService.hide();
  const latestState = TaskManager.getState();
  const activeTask = getActiveTask(latestState);
  if (!activeTask || activeTask.stack.length === 0) return;

  const top = getTaskTopActivity(activeTask);
  if (!top) return;

  let callbackToRun: ((payload: ActivityResult) => void) | null = null;
  let callbackPayload: ActivityResult = { resultCode: 'CANCELED' };

  if (top.requestCode != null) {
    const pending = TaskManager.takePendingCallback(top.requestCode);
    if (pending) {
      callbackToRun = pending.callback;
      callbackPayload = result ?? { resultCode: 'CANCELED' };
    }
  }

  const isInForeignTask = activeTask.rootAppId !== top.appId;

  if (!isInForeignTask) {
    const targetNav = AppNavigatorRegistry.get(top.appId)?.navigate;
    if (typeof targetNav === 'function') {
      try { targetNav('/'); } catch { /* ignore */ }
    }
  }

  const activityNav = AppNavigatorRegistry.getActivity(top.activityId)?.navigate;
  if (typeof activityNav === 'function') {
    try { activityNav('/'); } catch { /* ignore */ }
  }

  if (activeTask.stack.length > 1) {
    // Foreign-task pop（如同 task 上叠加的 Activity finish）：弹掉这个 Activity，回到下层。
    TaskManager.popActivity(activeTask.taskId);
    if (top.launchedByTaskId && latestState.tasks.some((t) => t.taskId === top.launchedByTaskId)) {
      TaskManager.activateTask(top.launchedByTaskId);
    }
  } else if (activeTask.launchedByTaskId && latestState.tasks.some((t) => t.taskId === activeTask.launchedByTaskId)) {
    // 单 Activity in own task + 有 caller：activate caller，但**不销毁** target task。
    // Android 默认 task 在 recents 里持久保留（除非用户主动划掉或系统 OOM），
    // 模拟器之前 closeTask 是非真机行为；上面的 targetNav / activityNav 调用已经把
    // App 的 MemoryRouter 重置到 '/'，用户从 recents 重新进入会看到 App 主页。
    // 同时消费 launchedByTaskId 指针：它是"启动时记录的来源"，用过一次即作废。
    // 否则用户从 recents 重新进入此 task 后再 back，会沿原启动链回到旧 caller，
    // 而不是真机预期的"直接回桌面"。
    TaskManager.activateTask(activeTask.launchedByTaskId);
    TaskManager.consumeLaunchedBy(activeTask.taskId);
  } else {
    // 单 Activity in own task + 无 caller（如从桌面起的 App 调 finishActivity）：
    // 同样不销毁，回桌面让用户继续在 recents 看到此 task。
    TaskManager.goHome();
  }

  if (callbackToRun) {
    requestAnimationFrame(() => callbackToRun?.(callbackPayload));
  }
}

export function closeTask(taskId: string): void {
  KeyboardService.hide();
  const latestState = TaskManager.getState();
  const task = latestState.tasks.find((t) => t.taskId === taskId);
  if (!task) return;
  TaskManager.cancelPendingForTask(task);
  for (const activity of task.stack) {
    const nav = AppNavigatorRegistry.getActivity(activity.activityId)?.navigate;
    if (typeof nav === 'function') {
      try { nav('/'); } catch { /* ignore */ }
    }
  }
  TaskManager.closeTask(taskId);
}

export function closeApp(appId: AppId): void {
  const latestState = TaskManager.getState();
  const task = latestState.tasks.find((t) => t.rootAppId === appId);
  if (!task) return;
  routeSetPreference('os_recents_closed_app', appId, { source: 'os' });
  closeTask(task.taskId);
}
