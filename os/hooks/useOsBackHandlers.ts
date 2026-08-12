import { useEffect } from 'react';
import { BackDispatcher } from '../BackDispatcher';
import { IntentResolver } from '../IntentResolver';
import { TaskManager } from '../TaskManager';
import { AppNavigatorRegistry } from '../AppNavigatorRegistry';
import * as MediaService from '../MediaService';
import { getActiveAppId, getActiveTask, getTaskTopActivity } from '../taskUtils';
import { finishActivity, goHome } from '../osActions';

/**
 * OS 级 BackDispatcher 注册：7 个系统 back handler（优先级 900/600/100/50/25/12/0）。
 * 全部经 TaskManager.getState() / IntentResolver.getState() 即时读取，不依赖 render 快照；
 * mount 时注册、unmount 时注销。
 */
export function useOsBackHandlers(): void {
  useEffect(() => {
    const unregisters = [
      BackDispatcher.register('os.intentChooser', () => {
        if (!IntentResolver.getState().open) return false;
        IntentResolver.cancelIntentChooser();
        return true;
      }, 900),
      BackDispatcher.register('os.mediaPicker', () => {
        if (!MediaService.isPickerActive()) return false;
        MediaService.cancelSelection();
        return true;
      }, 600),
      BackDispatcher.register('os.appBack', () => {
        const activeAppId = getActiveAppId(TaskManager.getState());
        if (!activeAppId) return false;
        const handler = AppNavigatorRegistry.getBackHandler(activeAppId);
        return !!handler?.();
      }, 100),
      BackDispatcher.register('os.activityBack', () => {
        const activeTask = getActiveTask(TaskManager.getState());
        const topActivity = getTaskTopActivity(activeTask);
        if (!topActivity) return false;
        const handler = AppNavigatorRegistry.getActivityBackHandler(topActivity.activityId);
        return !!handler?.();
      }, 50),
      BackDispatcher.register('os.finishTopActivity', () => {
        const activeTask = getActiveTask(TaskManager.getState());
        if (!activeTask || activeTask.stack.length <= 1) return false;
        finishActivity();
        return true;
      }, 25),
      BackDispatcher.register('os.returnToLauncherTask', () => {
        const latestState = TaskManager.getState();
        const activeTask = getActiveTask(latestState);
        if (!activeTask || activeTask.stack.length > 1) return false;
        const { launchedByTaskId } = activeTask;
        if (!launchedByTaskId) return false;
        if (!latestState.tasks.some((t) => t.taskId === launchedByTaskId)) return false;
        // 重置 App MemoryRouter 到 '/'，让用户从 recents 重新进入时看到 App 主页（如 SMS inbox）
        // 而不是上次离开时的子页（如 /new compose）。
        const top = getTaskTopActivity(activeTask);
        if (top) {
          const activityNav = AppNavigatorRegistry.getActivity(top.activityId)?.navigate;
          try { activityNav?.('/'); } catch { /* ignore */ }
        }
        // 不 closeTask —— Android 默认 task 持久保留在 recents，模拟器跟齐这一行为。
        // 同时消费 launchedByTaskId 指针（一次性）：用户从 recents 重新进入此 task 再 back 时，
        // 会走 goHomeFallback 回桌面，而非沿原启动链跳回旧 caller。
        TaskManager.activateTask(launchedByTaskId);
        TaskManager.consumeLaunchedBy(activeTask.taskId);
        return true;
      }, 12),
      BackDispatcher.register('os.goHomeFallback', () => {
        const latestState = TaskManager.getState();
        const activeTask = getActiveTask(latestState);
        // 同 returnToLauncherTask：不 closeTask，只重置 App 到 '/' 并回桌面。
        if (activeTask) {
          const top = getTaskTopActivity(activeTask);
          if (top) {
            const activityNav = AppNavigatorRegistry.getActivity(top.activityId)?.navigate;
            try { activityNav?.('/'); } catch { /* ignore */ }
          }
        }
        goHome();
        return true;
      }, 0),
    ];
    return () => {
      unregisters.forEach((unregister) => unregister());
    };
  }, []);
}
