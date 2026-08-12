import type { SimApi } from '../types/globals';
import { getStore, readPersistedAppState, writePersistedAppState } from '../createAppStore';
import { flushAll, endPersistReset } from '../debouncedPersist';
import { getTimeConfig, now, formatTime, formatDate, getDayOfWeek } from '../TimeService';
import { getLocationConfig, getSimulatedCoords } from '../LocationService';
import { dataLoaderByAppId } from '../data/appRegistry';
import { ClipboardService } from '../ClipboardService';
import { NotificationService } from '../NotificationService';
import { SystemShadeService } from '../SystemShadeService';
import localeApi from '../locale';
import { osT } from '../i18n';
import { deriveRunningApps, getActiveAppId } from '../taskUtils';
import PackageManagerService from '../PackageManagerService';
import { TaskManager } from '../TaskManager';
import { applyOsStatePatch, buildSimState } from '../simState';
import { deepMergeWithArrayOps } from '../utils/deepMergeWithArrayOps';
import { readLauncherSummary } from './launcherSnapshot';
import { resetStateCore } from './simResetCore';
import { getLastNavError } from '../osNavError';
import { runAppDataLoaderModule, type AppDataLoaderModule } from '../appDataLoaderReady';

/**
 * 组装 `window.__SIM__` 字面量：reset / warmUp / waitForData / getState / setState。
 *
 * - 显式 `: SimApi` 返回标注 = globals.d.ts 契约的静态校验点（tsc --noEmit 守卫），不可移除。
 * - 工厂必须无赋值以外的副作用（OSProvider 挂载 effect 调用；StrictMode 双 mount 幂等）。
 * - 全部成员经 TaskManager.getState() 等实时读取，不捕获任何 render 快照，
 *   因此 OSContext 挂载 effect 的 deps 为 []（每次页面加载组装一次）。
 */
export function buildSimApi(): SimApi {
  return {
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
}
