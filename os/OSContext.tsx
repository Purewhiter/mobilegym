import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { AppId, OSState } from './types';
import type { AppIntentFilter, IntentPayload } from './types/manifest';
import { getStateSetter, getStore, readPersistedAppState, writePersistedAppState } from './createAppStore';
import { idleState, waitForIdle } from './idle';
import { flushAll } from './debouncedPersist';
import { getTimeConfig, now, formatTime, formatDate, getDayOfWeek } from './TimeService';
import * as RandomService from './RandomService';
import { getLocationConfig, getSimulatedCoords } from './LocationService';
import { dataLoaderByAppId } from './data/appRegistry';
import { initFileSystem } from './FileSystemService';
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
import { readLauncherSummary } from './sim/launcherSnapshot';
import { resetStateCore } from './sim/simResetCore';
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
import { TaskManager } from './TaskManager';
import { IntentResolver } from './IntentResolver';
import { PendingIntent } from './PendingIntent';
import { endPersistReset } from './debouncedPersist';
import { ConnectivityManager } from './managers/ConnectivityManager';
import { routeGetPreference, routeSetPreference } from './managers/registry';
import {
  applyOsStatePatch,
  buildSimState,
} from './simState';
import { runAppDataLoaderModule } from './appDataLoaderReady';
import { useAppLifecycleSync } from './hooks/useAppLifecycleSync';
import { useOsBackHandlers } from './hooks/useOsBackHandlers';
import {
  cancelIntentChooser,
  chooseIntentActivity,
  closeApp,
  closeTask,
  finishActivity,
  goHome,
  handleSystemBack,
  launchApp,
  launchTaskById,
  openApp,
  setBrightness,
  setResult,
  setVolume,
  showRecents,
  startActivity,
  startActivityForResult,
} from './osActions';

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

  useAppLifecycleSync(state);

  useOsBackHandlers(finishActivity, goHome);

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
  }, [osStateForApi]);

  useEffect(() => {
    window.__SIM__ = {
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
      /** Resolve once the screen has caught up with the last input (see os/idle.ts). */
      waitForIdle,
      /** Seed every RandomService draw of this episode (os/RandomService.ts). */
      setRandomSeed: (seed: number) => RandomService.setSeed(seed),
      getRandomSeed: () => RandomService.getSeed(),
      idleState,
      // No list = every app; an empty list = none (home-screen tasks).
      waitForData: async (appIds?: string[]) => {
        const all = !appIds;
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

        const launcher = readLauncherSummary();

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

        // Device-backed apps apply patches asynchronously (sync, merge, push to the server).
        const pending: Promise<void>[] = [];

        if (patch.apps && typeof patch.apps === 'object') {
          for (const [appId, appPatch] of Object.entries(patch.apps)) {
            if (appPatch === undefined || appPatch === null) continue;
            const store = getStore(appId);
            if (store) {
              const applyPatch = (currentData: Record<string, any>) =>
                deep ? deepMerge(currentData, appPatch) : { ...currentData, ...appPatch };
              const setter = getStateSetter(appId);
              if (setter) {
                const done = setter(applyPatch);
                if (done) pending.push(done);
                continue;
              }
              const current = store.getState();
              const currentData: Record<string, any> = {};
              for (const [k, v] of Object.entries(current)) {
                if (typeof v !== 'function') currentData[k] = v;
              }
              if (deep) store.setState(applyPatch(currentData));
              else store.setState(appPatch as any);
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

        // Resolves once every app (device-backed ones included) holds the patch;
        // a reload waits for that so the restored state survives it.
        return Promise.all(pending).then(() => {
          if (reload) {
            flushAll();
            window.location.reload();
          }
        });
      },
    };
  }, [state]);

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
  }), [state, intentChooser]);

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
