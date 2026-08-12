import React, { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { AppId, OSState } from './types';
import type { AppIntentFilter, IntentPayload } from './types/manifest';
import { getStore, readPersistedAppState, writePersistedAppState } from './createAppStore';
import { flushAll, endPersistReset } from './debouncedPersist';
import { getTimeConfig, now, formatTime, formatDate, getDayOfWeek } from './TimeService';
import { getLocationConfig, getSimulatedCoords } from './LocationService';
import { dataLoaderByAppId } from './data/appRegistry';
import { initFileSystem } from './FileSystemService';
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
import { ConnectivityManager } from './managers/ConnectivityManager';
import { routeGetPreference, routeSetPreference } from './managers/registry';
import {
  applyOsStatePatch,
  buildSimState,
} from './simState';
import { deepMergeWithArrayOps } from './utils/deepMergeWithArrayOps';
import { readLauncherSummary } from './sim/launcherSnapshot';
import { resetStateCore } from './sim/simResetCore';
import { getLastNavError } from './osNavError';
import {
  launchApp,
  launchTaskById,
  goHome,
  showRecents,
  setBrightness,
  setVolume,
  chooseIntentActivity,
  cancelIntentChooser,
  handleSystemBack,
  finishActivity,
  closeTask,
  closeApp,
  startActivity,
  startActivityForResult,
  setResult,
  openApp,
} from './osActions';
import { runAppDataLoaderModule, type AppDataLoaderModule } from './appDataLoaderReady';
import type { OSApi, SimApi } from './types/globals';

/** 预加载所有 App 的 state.ts（eager: 打进主 bundle，页面加载即执行 createAppStore 副作用） */
const _eagerAppStateModules = import.meta.glob<unknown>(
  ['../apps/*/state.ts', '../system/*/state.ts'],
  { eager: true },
);
void _eagerAppStateModules; // 确保 tree-shaking 不会移除
// data loader map 来自 appRegistry，避免在 OSContext 和 appRegistry 两处独立 glob。
// appRegistry 的 lazy() 也用同一个 map，确保 cold-start 路径和 bench `waitForData`
// 路径覆盖完全一致的 app 集合。

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

  const osStateForApi = useMemo(() => ({
    ...state,
    activeAppId: getActiveAppId(state),
  }), [state]);

  useEffect(() => {
    // 显式标注 OSApi，让 tsc 校验对象与 globals.d.ts 契约一致（此前 as any 绕过了检查）
    const api: OSApi = {
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
    };
    window.__OS__ = api;
  }, [osStateForApi]);

  useEffect(() => {
    // 显式标注 SimApi，与 window.__OS__ 一致地走 globals.d.ts 契约校验
    const simApi: SimApi = {
      /** Clear all state WITHOUT reloading. Use with Playwright page.reload(). */
      resetState: resetStateCore,
      /** Clear all state AND reload (legacy). */
      reset: async () => {
        await resetStateCore();
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

        const loadApp = async (importFn: () => Promise<AppDataLoaderModule>) => {
          const mod = await importFn();
          await runAppDataLoaderModule(mod);
        };

        const entries: { appId: string; importFn: () => Promise<AppDataLoaderModule> }[] = [];
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

        const launcher = readLauncherSummary();

        const simState = buildSimState({
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
        // 最近一次 navigateToActivity 超时记录（成功导航后为 null），供 bench 检测栈与 UI 不一致
        simState.os.lastNavError = getLastNavError();
        return simState;
      },
      setState: (patch: { apps?: Record<string, unknown>; os?: Record<string, unknown> }, options?: { deep?: boolean; reload?: boolean }) => {
        // 外部脚本显式调 setState (state-builder snapshot restore / bench inject /
        // mem_microbench) 等场景, 意味着 reset 阶段已完成、应当接收新 state 写入。
        // 关闭 reset gate, 让后续 zustand persist 正常落盘 (主 bench 路径 page.goto
        // 之后新文档模块自然重置 flag, 这里只为非 reload 场景关 gate)。
        endPersistReset();
        const { deep = true, reload = false } = options || {};

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
                const currentData: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(current)) {
                  if (typeof v !== 'function') currentData[k] = v;
                }
                store.setState(deepMergeWithArrayOps(currentData, appPatch));
              } else {
                // 外部注入边界：patch 形状由调用方（bench / snapshot restore）保证
                store.setState(appPatch as never);
              }
            } else {
              const current = readPersistedAppState(appId) ?? null;
              const merged = current === null
                ? appPatch
                : deep
                  ? deepMergeWithArrayOps(current, appPatch)
                  : { ...current, ...appPatch };
              writePersistedAppState(appId, merged as Record<string, unknown>);
            }
          }
        }

        if (reload) {
          flushAll();
          window.location.reload();
        }
      },
    };
    window.__SIM__ = simApi;
    // 依赖数组不含 state：闭包内全部经 TaskManager.getState() 等实时读取，
    // 不依赖渲染快照；带上 state 会导致每次任务栈变化都无谓重建 __SIM__。
    // Step 4 闭包提升后所有动作回调已是模块函数，deps 收敛为 []（挂载一次）。
  }, []);

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
    intentChooser,
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
