import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { AppId, OSState } from './types';
import type { ActivityResult, AppIntentFilter, IntentPayload } from './types/manifest';
import { getStore, readPersistedAppState, writePersistedAppState } from './createAppStore';
import { flushAll, flushKey } from './debouncedPersist';
import { getTimeConfig, now, realNow, formatTime, formatDate, getDayOfWeek } from './TimeService';
import { getLocationConfig, getSimulatedCoords } from './LocationService';
import { isValidAppId, dataLoaderByAppId } from './data/appRegistry';
import { clearFileSystemDB, initFileSystem } from './FileSystemService';
import * as MediaService from './MediaService';
import { KeyboardService } from './keyboard/KeyboardService';
import { ClipboardService } from './ClipboardService';
import { NotificationService } from './NotificationService';
import { PermissionService } from './PermissionService';
import { QuickSettingsService } from './QuickSettingsService';
import { SystemShadeService } from './SystemShadeService';
import StatusBarService from './StatusBarService';
import localeApi from './locale';
import BroadcastBus, { ACTION_BOOT_COMPLETED, BROADCAST_ACTIONS } from './BroadcastBus';
import { osT } from './i18n';
import { LAUNCHER_STORAGE_KEY } from './launcher/types';
import { SmsGateway } from './SmsGateway';
import * as SkinService from './SkinService';
import {
  deriveIntentStack,
  deriveRunningApps,
  getActiveAppId,
  getActiveTask,
  getTaskTopActivity,
} from './taskUtils';
import PackageManagerService from './PackageManagerService';
import ContentResolver from './ContentResolver';
import { AppNavigatorRegistry } from './AppNavigatorRegistry';
import { AppLifecycle } from './AppLifecycle';
import { BackDispatcher } from './BackDispatcher';
import { TaskManager } from './TaskManager';
import { IntentResolver } from './IntentResolver';
import { PendingIntent } from './PendingIntent';
import { resetAllOsStores } from './createOsStore';
import { resetAllAppStores } from './createAppStore';
import { cancelAllPending as cancelAllPendingPersistWrites, beginPersistReset, endPersistReset } from './debouncedPersist';
import TextSelectionService from './TextSelectionService';
import { OsStateStore } from './OsStateStore';
import { ConnectivityManager } from './managers/ConnectivityManager';
import { routeGetPreference, routeSetPreference } from './managers/registry';
import {
  applyOsStatePatch,
  buildSimState,
} from './simState';
import { runAppDataLoaderModule } from './appDataLoaderReady';

/** 预加载所有 App 的 state.ts（eager: 打进主 bundle，页面加载即执行 createAppStore 副作用） */
const _eagerAppStateModules = import.meta.glob<unknown>(
  ['../apps/*/state.ts', '../system/*/state.ts'],
  { eager: true },
);
void _eagerAppStateModules; // 确保 tree-shaking 不会移除
// data loader map 来自 appRegistry，避免在 OSContext 和 appRegistry 两处独立 glob。
// appRegistry 的 lazy() 也用同一个 map，确保 cold-start 路径和 bench `waitForData`
// 路径覆盖完全一致的 app 集合。

// --- getState() cache for launcher (rarely changes, expensive to parse) ---
let _launcherCacheRaw: string | null | undefined = undefined;
let _launcherCacheParsed: any = null;

interface OSContextProps {
  state: OSState;
  launchApp: (id: AppId) => void;
  launchTaskById: (taskId: string) => void;
  goHome: () => void;
  showRecents: () => void;
  closeTask: (taskId: string) => void;
  closeApp: (id: AppId) => void;
  setBrightness: (value: number) => void;
  setVolume: (value: number) => void;
  intentChooser: {
    open: boolean;
    intent: IntentPayload | null;
    matches: { appId: AppId; filter: AppIntentFilter }[];
  };
  chooseIntentActivity: (appId: AppId) => void;
  cancelIntentChooser: () => void;
}

const OSContext = createContext<OSContextProps | undefined>(undefined);

function buildOsDebugStack(tag: string): string {
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

export const OSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const state = useSyncExternalStore(
    (onStoreChange) => TaskManager.subscribe(() => onStoreChange()),
    TaskManager.getState,
  );
  const intentChooser = useSyncExternalStore(
    (onStoreChange) => IntentResolver.subscribe(() => onStoreChange()),
    IntentResolver.getState,
  );
  const prevActiveAppIdRef = useRef<AppId | null>(getActiveAppId(state));
  const prevRunningAppsRef = useRef<AppId[]>(deriveRunningApps(state.tasks));

  useEffect(() => {
    initFileSystem().catch(console.error);
  }, []);

  useEffect(() => {
    BroadcastBus.sendBroadcast({
      action: ACTION_BOOT_COMPLETED,
      extras: { now: now() },
    });
  }, []);

  useEffect(() => {
    return () => {
      IntentResolver.cancelIntentChooser();
    };
  }, []);

  useEffect(() => {
    const previousActiveAppId = prevActiveAppIdRef.current;
    const currentActiveAppId = getActiveAppId(state);
    if (previousActiveAppId !== currentActiveAppId) {
      if (previousActiveAppId) AppLifecycle.emit(previousActiveAppId, 'background');
      if (currentActiveAppId) AppLifecycle.emit(currentActiveAppId, 'foreground');
      prevActiveAppIdRef.current = currentActiveAppId;
    }
  }, [state.activeTaskId, state.tasks]);

  useEffect(() => {
    const previousRunningApps = new Set(prevRunningAppsRef.current);
    const currentRunningApps = deriveRunningApps(state.tasks);
    const currentRunningSet = new Set(currentRunningApps);

    previousRunningApps.forEach((appId) => {
      if (!currentRunningSet.has(appId)) {
        AppLifecycle.emit(appId, 'destroy');
      }
    });

    prevRunningAppsRef.current = currentRunningApps;
  }, [state.tasks]);

  const navigateToActivity = useCallback(async (
    activityId: string,
    route: string,
    opts?: { fallbackAppId?: AppId; replace?: boolean },
  ) => {
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
      console.warn(`[OS] Navigate to ${route} timed out after 5000ms (activity=${activityId})`);
      return;
    }
    console.log(
      `[OSDBG] navigateToActivity activityId=${activityId} appId=${appId} route=${route} `
      + `replace=${opts?.replace != null ? String(opts.replace) : '-'} foreignTask=${String(isInForeignTask)}`,
    );
    nav(route, opts?.replace != null ? { replace: opts.replace } : undefined);
    console.log(`[OS] Navigate activity ${activityId} -> ${route} in ${realNow() - startTime}ms`);
  }, []);

  const finishTopActivity = useCallback((taskId: string, result?: ActivityResult) => {
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
  }, []);

  const closeTask = useCallback((taskId: string) => {
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
  }, []);

  const finishActivity = useCallback((result?: ActivityResult) => {
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
      // 模拟器之前 closeTask 是非真机行为；上面 line 287-290 已经把 App 的 MemoryRouter
      // 重置到 '/'，用户从 recents 重新进入会看到 App 主页。
      // 同时消费 launchedByTaskId 指针：它是"启动时记录的来源"，用过一次即作废。
      // 否则用户从 recents 重新进入此 task 后再 back，会沿原启动链回到旧 caller，
      // 而不是真机预期的"直接回桌面"。
      TaskManager.activateTask(activeTask.launchedByTaskId);
      TaskManager.consumeLaunchedBy(activeTask.taskId);
    } else {
      // 单 Activity in own task + 无 caller（如从桌面起的 App 调 finishActivity）：
      // 同样不销毁，回桌面让用户继续在 recents 看到此 task。
      // inline 调用 TaskManager.goHome (避免依赖下方还未定义的 goHome useCallback)。
      TaskManager.goHome();
    }

    if (callbackToRun) {
      requestAnimationFrame(() => callbackToRun?.(callbackPayload));
    }
  }, []);

  const launchApp = useCallback((appId: AppId) => {
    KeyboardService.hide();
    TaskManager.launchApp(appId);
  }, []);

  const launchTaskById = useCallback((taskId: string) => {
    KeyboardService.hide();
    TaskManager.activateTask(taskId);
  }, []);

  const goHome = useCallback(() => {
    KeyboardService.hide();
    TaskManager.goHome();
  }, []);

  const showRecents = useCallback(() => {
    KeyboardService.hide();
    TaskManager.showRecents();
  }, []);

  const closeApp = useCallback((appId: AppId) => {
    const latestState = TaskManager.getState();
    const task = latestState.tasks.find((t) => t.rootAppId === appId);
    if (!task) return;
    routeSetPreference('os_recents_closed_app', appId, { source: 'os' });
    closeTask(task.taskId);
  }, [closeTask]);

  const setBrightness = useCallback((value: number) => {
    routeSetPreference('brightness', value, { source: 'os' });
  }, []);

  const setVolume = useCallback((value: number) => {
    routeSetPreference('media_volume', value, { source: 'os' });
  }, []);

  const chooseIntentActivity = useCallback((appId: AppId) => {
    IntentResolver.chooseIntentActivity(appId);
  }, []);

  const cancelIntentChooser = useCallback(() => {
    IntentResolver.cancelIntentChooser();
  }, []);

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
  }, [finishActivity, goHome]);

  const handleSystemBack = useCallback(() => {
    BackDispatcher.handleBack();
  }, []);

  const startActivityForResult = useCallback((
    appIdOrIntent: AppId | string | IntentPayload,
    intentOrCallback?: IntentPayload | ((result: ActivityResult) => void),
    callbackOrUndefined?: (result: ActivityResult) => void,
  ): boolean => {
    return IntentResolver.startActivityForResult(appIdOrIntent, intentOrCallback, callbackOrUndefined, {
      getState: TaskManager.getState,
      nextActivityId: TaskManager.nextActivityId,
      allocRequestCode: TaskManager.allocRequestCode,
      pushActivity: TaskManager.pushActivity,
      navigateToActivity,
    });
  }, [navigateToActivity]);

  const startActivity = useCallback((
    appIdOrIntent: AppId | string | IntentPayload,
    intentOrOptions?: IntentPayload | { newTask?: boolean },
    options?: { newTask?: boolean },
  ): boolean => {
    return IntentResolver.startActivity(appIdOrIntent, intentOrOptions, options, {
      getState: TaskManager.getState,
      nextActivityId: TaskManager.nextActivityId,
      pushActivity: TaskManager.pushActivity,
      popActivity: TaskManager.popActivity,
      navigateToActivity,
      launchApp,
      markExternalRoute: TaskManager.markExternalRoute,
      setActivityIntent: TaskManager.setActivityIntent,
    });
  }, [navigateToActivity, launchApp]);

  const setResult = useCallback((result: ActivityResult) => {
    const activeTask = getActiveTask(TaskManager.getState());
    if (!activeTask) {
      console.warn('[OS] setResult: No active task');
      return;
    }

    const top = getTaskTopActivity(activeTask);
    if (!top) {
      console.warn('[OS] setResult: No active activity');
      return;
    }

    if (top.requestCode == null) {
      console.warn('[OS] setResult: Top activity is not started for result');
      return;
    }

    finishTopActivity(activeTask.taskId, result);
  }, [finishTopActivity]);

  const openApp = useCallback((appId: AppId | string, initialRoute?: string) => {
    if (!isValidAppId(appId)) {
      console.error(`[OS] Invalid appId: ${appId}`);
      return;
    }

    const latestState = TaskManager.getState();
    const taskExisted = latestState.tasks.some((t) => t.rootAppId === appId);
    const activeAppId = getActiveAppId(latestState);
    const activeRoute = activeAppId ? AppNavigatorRegistry.getAppRoute(activeAppId)?.path ?? '-' : '-';
    console.log(
      `[OSDBG] openApp appId=${appId} initialRoute=${initialRoute ?? '-'} taskExisted=${String(taskExisted)} `
      + `activeApp=${activeAppId ?? '-'} activeRoute=${activeRoute} stack=${buildOsDebugStack('openApp')}`,
    );
    launchApp(appId);
    if (!initialRoute) return;

    if (!taskExisted) {
      TaskManager.markExternalRoute(appId);
    }

    requestAnimationFrame(() => {
      const latestState = TaskManager.getState();
      const task = latestState.tasks.find((t) => t.rootAppId === appId);
      const activity = task
        ? [...task.stack].reverse().find((act) => act.appId === appId) ?? task.stack[task.stack.length - 1]
        : null;
      if (activity) {
        // 永远 push（不 replace）—— 对应真机 PendingIntent + TaskStackBuilder.addNextIntentWithParentStack 的"合成 back stack"语义：
        // - 未运行：root 启动于 '/'，push initialRoute → 历史 ['/', initialRoute]，返回回主页
        // - 已运行：保留用户当前页，push initialRoute → 用户能按返回回到原所在页
        // 旧逻辑 `replace: !taskExisted` 在 fresh task 场景会 clobber 掉根 '/'，导致按返回直接出 App，与真机不符。
        void navigateToActivity(activity.activityId, initialRoute, { replace: false });
      }
    });
  }, [launchApp, navigateToActivity]);

  const osStateForApi = useMemo(() => ({
    ...state,
    activeAppId: getActiveAppId(state),
  }), [state]);

  useEffect(() => {
    window.__OS__ = {
      state: osStateForApi,
      launchApp,
      launchTaskById,
      goHome,
      showRecents,
      closeTask,
      closeApp,
      finishActivity,
      setBrightness,
      setVolume,
      getSkin: () => SkinService.getActiveSkinId(),
      setSkin: (id: string) => {
        const next = id === 'neutral' ? 'neutral' : id === 'test_v1' ? 'test_v1' : 'default';
        SkinService.setSkin(next);
      },
      handleBack: handleSystemBack,
      getState: () => ({ ...TaskManager.getState(), activeAppId: getActiveAppId(TaskManager.getState()) }),
      getAppRoute: (appId?: AppId | string) => AppNavigatorRegistry.getAppRoute(appId),
      openApp,
      startActivity,
      startActivityForResult,
      setResult,
      hasActiveIntent: () => deriveIntentStack(TaskManager.getState().tasks).length > 0,
      resolveActivity: (intent: { action: string; scheme?: string; type?: string }) => {
        return PackageManagerService.resolveActivityAll(intent);
      },
      getIntentPayload: (appIdOrActivityId?: AppId | string) => {
        const latestState = TaskManager.getState();
        if (appIdOrActivityId) {
          for (const task of latestState.tasks) {
            for (const act of task.stack) {
              if (act.activityId === appIdOrActivityId && act.intent) return act.intent;
            }
          }

          const activeTask = getActiveTask(latestState);
          if (!activeTask) return null;
          for (let i = activeTask.stack.length - 1; i >= 0; i -= 1) {
            const act = activeTask.stack[i];
            if (act.appId === appIdOrActivityId && act.intent) return act.intent;
          }
          return null;
        }

        const top = getTaskTopActivity(getActiveTask(latestState));
        return top?.intent ?? null;
      },

      notifications: NotificationService,
      permissions: PermissionService,
      clipboard: ClipboardService,
      statusBar: StatusBarService,
      keyboard: KeyboardService,
      quickSettings: QuickSettingsService,
      shade: SystemShadeService,
      locale: localeApi,
      device: {
        getPreference: routeGetPreference,
        setPreference: routeSetPreference,
        setNearbyWifi: ConnectivityManager.setNearbyWifi,
        setNearbyBluetooth: ConnectivityManager.setNearbyBluetooth,
        connectWifi: ConnectivityManager.connectToAP,
        disconnectWifi: ConnectivityManager.disconnectWifi,
        connectBluetooth: ConnectivityManager.connectBluetooth,
        disconnectBluetooth: ConnectivityManager.disconnectBluetooth,
      },
      broadcast: {
        sendBroadcast: BroadcastBus.sendBroadcast,
        sendOrderedBroadcast: BroadcastBus.sendOrderedBroadcast,
        registerReceiver: BroadcastBus.registerReceiver,
        actions: BROADCAST_ACTIONS,
      },
      content: ContentResolver,
      pendingIntent: PendingIntent,
      sms: SmsGateway,
    } as any;
  }, [
    osStateForApi,
    launchApp,
    launchTaskById,
    goHome,
    showRecents,
    closeTask,
    closeApp,
    setBrightness,
    setVolume,
    handleSystemBack,
    openApp,
    startActivity,
    startActivityForResult,
    setResult,
  ]);

  useEffect(() => {
    const _resetStateCore = async () => {
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
    };
    window.__SIM__ = {
      /** Clear all state WITHOUT reloading. Use with Playwright page.reload(). */
      resetState: _resetStateCore,
      /** Clear all state AND reload (legacy). */
      reset: async () => {
        await _resetStateCore();
        window.location.reload();
      },
      warmUpAllApps: () => {
        const allApps = PackageManagerService.getInstalledPackages();
        for (const app of allApps) {
          TaskManager.launchApp(app.id);
        }
        TaskManager.goHome();
      },
      preloadAllAppStores: async () => { /* no-op: eager loaded */ },
      /** 定向预加载指定 app 的 state.ts — no-op: eager loaded */
      preloadAppStores: async (_appIds: string[]) => { /* no-op: eager loaded */ },
      waitForData: async (appIds?: string[]) => {
        const all = !appIds || appIds.length === 0;
        const has = (id: string) => all || appIds!.includes(id);

        const loadApp = async (importFn: () => Promise<any>) => {
          const mod = await importFn();
          await runAppDataLoaderModule(mod);
        };

        const entries: { appId: string; importFn: () => Promise<any> }[] = [];
        for (const [appId, importFn] of dataLoaderByAppId) {
          if (!has(appId)) continue;
          entries.push({ appId, importFn });
        }

        const results = await Promise.allSettled(
          entries.map(e => loadApp(e.importFn)),
        );

        const failedEntries = results
          .map((r, i) => r.status === 'rejected' ? entries[i] : null)
          .filter((e): e is typeof entries[number] => e !== null);

        if (failedEntries.length > 0) {
          console.warn(
            `[waitForData] ${failedEntries.length} app(s) failed, retrying:`,
            failedEntries.map(e => e.appId).join(', '),
          );
          await new Promise(r => setTimeout(r, 300));
          const retryResults = await Promise.allSettled(
            failedEntries.map(e => loadApp(e.importFn)),
          );
          const stillFailed = retryResults
            .map((r, i) => r.status === 'rejected' ? `${failedEntries[i].appId}: ${r.reason}` : null)
            .filter(Boolean);
          if (stillFailed.length > 0) {
            throw new Error(`waitForData failed for: ${stillFailed.join('; ')}`);
          }
        }
      },
      getState: () => {
        const latestState = TaskManager.getState();
        const timeConfig = getTimeConfig();
        const time = {
          mode: timeConfig.mode,
          timestamp: now(),
          formatted: formatTime(),
          date: formatDate(),
          dayOfWeek: getDayOfWeek(),
        };

        const locationConfig = getLocationConfig();
        const coords = getSimulatedCoords();
        const location = {
          mode: locationConfig.mode,
          coords: coords ? {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
          } : null,
        };

        const installedApps = PackageManagerService.getInstalledPackages().map((app) => ({
          id: app.id,
          name: osT(app.displayName),
          type: app.type,
        }));

        const clipboardState = ClipboardService.getState();
        const clipboard = clipboardState.current ? {
          type: clipboardState.current.type,
          content: clipboardState.current.content,
          timestamp: clipboardState.current.timestamp,
          source: clipboardState.current.source,
        } : null;

        flushKey(LAUNCHER_STORAGE_KEY);
        const rawLauncher = localStorage.getItem(LAUNCHER_STORAGE_KEY);
        let launcher: any = null;
        if (rawLauncher) {
          if (rawLauncher === _launcherCacheRaw) {
            launcher = _launcherCacheParsed;
          } else {
            try {
              const parsed = JSON.parse(rawLauncher);
              const items = parsed?.items ?? {};
              const hotseat = Array.isArray(parsed?.hotseat) ? parsed.hotseat : [];
              const folders = parsed?.folders ?? {};
              const screens = Array.isArray(parsed?.screens) ? parsed.screens : [];
              const summarizeItem = (item: any, slot: any) => {
                if (item?.kind === 'app') return { slot, kind: 'app', appId: item.appId };
                if (item?.kind === 'folder') return { slot, kind: 'folder', folderId: item.folderId };
                if (item?.kind === 'widget') {
                  const summary: any = { slot, kind: 'widget', widgetType: item.widgetType };
                  if (item.widgetType === 'wmr') {
                    summary.widgetId = item.widgetId;
                    summary.variant = item.variant;
                    summary.previewUrl = item.previewUrl;
                    if (item.xmlBaseUrl) summary.xmlBaseUrl = item.xmlBaseUrl;
                  }
                  return summary;
                }
                return { slot, kind: 'unknown' };
              };
              launcher = {
                version: parsed?.version,
                grid: parsed?.grid,
                wallpaper: parsed?.wallpaper,
                screensCount: screens.length,
                screens: screens.map((s: any) => ({
                  id: s?.id,
                  items: (Array.isArray(s?.placements) ? s.placements : [])
                    .slice()
                    .sort((a: any, b: any) => ((a?.cellY ?? 0) - (b?.cellY ?? 0)) || ((a?.cellX ?? 0) - (b?.cellX ?? 0)))
                    .map((p: any) => {
                      const item = items?.[p?.itemId];
                      const slot = { cellX: p?.cellX, cellY: p?.cellY };
                      return summarizeItem(item, slot);
                    }),
                })),
                hiddenApps: Array.isArray(parsed?.hiddenApps) ? parsed.hiddenApps : [],
                hotseat: hotseat
                  .slice()
                  .sort((a: any, b: any) => (a?.cellX ?? 0) - (b?.cellX ?? 0))
                  .map((p: any) => {
                    const item = items?.[p?.itemId];
                    return summarizeItem(item, p?.cellX);
                  }),
                folders: Object.values(folders).map((f: any) => ({
                  id: f?.id,
                  name: f?.name,
                  size: Array.isArray(f?.items) ? f.items.length : 0,
                  items: Array.isArray(f?.items) ? f.items : [],
                })),
              };
            } catch {
              launcher = null;
            }
            _launcherCacheRaw = rawLauncher;
            _launcherCacheParsed = launcher;
          }
        } else if (_launcherCacheRaw !== null) {
          _launcherCacheRaw = null;
          _launcherCacheParsed = null;
        }

        return buildSimState({
          tasks: latestState.tasks,
          activeTaskId: latestState.activeTaskId,
          isLauncherVisible: latestState.isLauncherVisible,
          isRecentsVisible: latestState.isRecentsVisible,
          runningApps: deriveRunningApps(latestState.tasks),
          activeAppId: getActiveAppId(latestState),
          locale: localeApi.getLocale(),
          time,
          location,
          installedApps,
          clipboard,
          notifications: NotificationService.getState(),
          shade: SystemShadeService.getState(),
          launcher,
        });
      },
      setState: (patch: { apps?: Record<string, any>; os?: Record<string, any> }, options?: { deep?: boolean; reload?: boolean }) => {
        // 外部脚本显式调 setState (state-builder snapshot restore / bench inject /
        // mem_microbench) 等场景, 意味着 reset 阶段已完成、应当接收新 state 写入。
        // 关闭 reset gate, 让后续 zustand persist 正常落盘 (主 bench 路径 page.goto
        // 之后新文档模块自然重置 flag, 这里只为非 reload 场景关 gate)。
        endPersistReset();
        const { deep = true, reload = false } = options || {};

        const ARRAY_MATCH_RE = /^(\w+)\[(\w+)=(.+)\]$/;
        const ARRAY_PUSH_RE = /^(\w+)\[\]$/;

        const deepMerge = (target: any, source: any): any => {
          if (source === undefined) return target;
          if (source === null) return null;
          if (typeof source !== 'object' || Array.isArray(source)) return source;
          if (typeof target !== 'object' || target === null || Array.isArray(target)) return source;

          const result = { ...target };
          for (const key of Object.keys(source)) {
            // arr[field=value] — update or delete matched array elements
            const matchM = key.match(ARRAY_MATCH_RE);
            if (matchM) {
              const [, arrKey, matchField, matchVal] = matchM;
              const arr = result[arrKey];
              if (Array.isArray(arr)) {
                const val = source[key];
                if (val === null || val === undefined) {
                  // DELETE: remove all matched elements
                  result[arrKey] = arr.filter(item =>
                    !(item && typeof item === 'object' && String(item[matchField]) === matchVal)
                  );
                } else {
                  // UPDATE: deepMerge into all matched elements
                  result[arrKey] = arr.map(item =>
                    item && typeof item === 'object' && String(item[matchField]) === matchVal
                      ? deepMerge(item, val)
                      : item
                  );
                }
              }
              continue;
            }

            // arr[] — append element(s)
            const pushM = key.match(ARRAY_PUSH_RE);
            if (pushM) {
              const arrKey = pushM[1];
              const existing = Array.isArray(result[arrKey]) ? result[arrKey] : [];
              const val = source[key];
              result[arrKey] = Array.isArray(val) ? [...existing, ...val] : [...existing, val];
              continue;
            }

            // Regular key — recursive deepMerge
            result[key] = deepMerge(target[key], source[key]);
          }
          return result;
        };

        if (patch.os && typeof patch.os === 'object') {
          applyOsStatePatch(patch.os, { source: 'external' });
        }

        if (patch.apps && typeof patch.apps === 'object') {
          for (const [appId, appPatch] of Object.entries(patch.apps)) {
            if (appPatch === undefined || appPatch === null) continue;
            const store = getStore(appId);
            if (store) {
              if (deep) {
                const current = store.getState();
                const currentData: Record<string, any> = {};
                for (const [k, v] of Object.entries(current)) {
                  if (typeof v !== 'function') currentData[k] = v;
                }
                store.setState(deepMerge(currentData, appPatch));
              } else {
                store.setState(appPatch as any);
              }
            } else {
              const current = readPersistedAppState(appId) ?? null;
              const merged = current === null
                ? appPatch
                : deep
                  ? deepMerge(current, appPatch)
                  : { ...current, ...appPatch };
              writePersistedAppState(appId, merged as Record<string, any>);
            }
          }
        }

        if (reload) {
          flushAll();
          window.location.reload();
        }
      },
    };
  }, [state, launchApp, launchTaskById, goHome, showRecents, closeTask, closeApp, finishActivity, setBrightness, setVolume, handleSystemBack, openApp, startActivity, startActivityForResult, setResult]);

  const contextValue = useMemo<OSContextProps>(() => ({
    state,
    launchApp,
    launchTaskById,
    goHome,
    showRecents,
    closeTask,
    closeApp,
    setBrightness,
    setVolume,
    intentChooser,
    chooseIntentActivity,
    cancelIntentChooser,
  }), [
    state,
    launchApp,
    launchTaskById,
    goHome,
    showRecents,
    closeTask,
    closeApp,
    setBrightness,
    setVolume,
    intentChooser,
    chooseIntentActivity,
    cancelIntentChooser,
  ]);

  return (
    <OSContext.Provider value={contextValue}>
      {children}
    </OSContext.Provider>
  );
};

export const useOS = () => {
  const context = useContext(OSContext);
  if (!context) throw new Error('useOS must be used within OSProvider');
  return context;
};
