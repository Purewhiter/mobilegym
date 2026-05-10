export interface AppNavigator {
  navigate: (path: string, options?: { replace?: boolean }) => void;
  back: () => boolean;
  route: () => AppRouteInfo;
  /**
   * 把 MemoryRouter 历史回退到根 '/'（含 inclusive=false 语义：保留 '/'，删除其上方所有条目）。
   * 若历史中没有 '/'，则用 replace 模式把当前条目改成 '/'。供 OS 在 singleTask 启动模式下重置 App 历史使用。
   * 返回是否成功完成回退（无论用 popTo 还是 fallback）。
   */
  popToRoot?: () => boolean;
}

export interface ActivityNavigator {
  navigate: (path: string, options?: { replace?: boolean }) => void;
  back?: () => boolean;
}

const registry = new Map<string, AppNavigator>();
const backOverrideRegistry = new Map<string, () => boolean>();
const activityRegistry = new Map<string, ActivityNavigator>();

export const APP_NAVIGATOR_READY_EVENT = 'os:navigator-ready';
export const ACTIVITY_NAVIGATOR_READY_EVENT = 'os:activity-navigator-ready';

function emitNavigatorReady(detail: { appId?: string; activityId?: string }) {
  if (typeof window === 'undefined') return;
  if (detail.activityId) {
    window.dispatchEvent(new CustomEvent(ACTIVITY_NAVIGATOR_READY_EVENT, { detail }));
  }
  if (detail.appId) {
    window.dispatchEvent(new CustomEvent(APP_NAVIGATOR_READY_EVENT, { detail }));
  }
}

export const AppNavigatorRegistry = {
  register(appId: string, nav: AppNavigator) {
    registry.set(appId, nav);
    emitNavigatorReady({ appId });
  },

  unregister(appId: string) {
    registry.delete(appId);
    backOverrideRegistry.delete(appId);
  },

  get(appId: string) {
    return registry.get(appId);
  },

  getAppRoute(appId?: string): AppRouteInfo | null {
    if (appId) {
      return registry.get(appId)?.route() ?? null;
    }
    if (typeof window === 'undefined') return null;
    const activeAppId = window.__OS__?.state?.activeAppId;
    if (activeAppId && registry.has(activeAppId)) {
      return registry.get(activeAppId)?.route() ?? null;
    }
    return null;
  },

  getBackHandler(appId: string) {
    return backOverrideRegistry.get(appId) ?? registry.get(appId)?.back;
  },

  setBackOverride(appId: string, backHandler?: () => boolean) {
    if (backHandler) {
      backOverrideRegistry.set(appId, backHandler);
      return;
    }
    backOverrideRegistry.delete(appId);
  },

  getAll() {
    return registry;
  },

  registerActivity(activityId: string, nav: ActivityNavigator, appId?: string) {
    activityRegistry.set(activityId, nav);
    emitNavigatorReady({ activityId, appId });
  },

  unregisterActivity(activityId: string) {
    activityRegistry.delete(activityId);
  },

  getActivity(activityId: string) {
    return activityRegistry.get(activityId);
  },

  getActivityBackHandler(activityId: string) {
    return activityRegistry.get(activityId)?.back;
  },

  async waitForNavigator(opts: {
    appId?: string;
    activityId?: string;
    timeoutMs?: number;
  }): Promise<((path: string, options?: { replace?: boolean }) => void) | null> {
    const { appId, activityId, timeoutMs = 5000 } = opts;
    if (activityId) {
      const nav = activityRegistry.get(activityId)?.navigate;
      if (nav) return nav;
    }
    if (appId) {
      const nav = registry.get(appId)?.navigate;
      if (nav) return nav;
    }

    if (typeof window === 'undefined') return null;

    type NavFn = ((path: string, options?: { replace?: boolean }) => void) | null;
    return new Promise<NavFn>((resolve) => {
      let settled = false;

      const settle = (value: NavFn) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      };

      const tryResolve = () => {
        if (activityId) {
          const nav = activityRegistry.get(activityId)?.navigate;
          if (nav) {
            settle(nav);
            return;
          }
        }
        if (appId) {
          const nav = registry.get(appId)?.navigate;
          if (nav) {
            settle(nav);
          }
        }
      };

      const onAppReady = (event: Event) => {
        const detail = (event as CustomEvent<{ appId?: string }>).detail;
        if (appId && detail?.appId !== appId) return;
        tryResolve();
      };

      const onActivityReady = (event: Event) => {
        const detail = (event as CustomEvent<{ activityId?: string; appId?: string }>).detail;
        if (activityId && detail?.activityId !== activityId) return;
        if (!activityId && appId && detail?.appId !== appId) return;
        tryResolve();
      };

      const timeout = window.setTimeout(() => settle(null), timeoutMs);

      const cleanup = () => {
        window.clearTimeout(timeout);
        window.removeEventListener(APP_NAVIGATOR_READY_EVENT, onAppReady as EventListener);
        window.removeEventListener(ACTIVITY_NAVIGATOR_READY_EVENT, onActivityReady as EventListener);
      };

      window.addEventListener(APP_NAVIGATOR_READY_EVENT, onAppReady as EventListener);
      window.addEventListener(ACTIVITY_NAVIGATOR_READY_EVENT, onActivityReady as EventListener);

      tryResolve();
    });
  },
};
