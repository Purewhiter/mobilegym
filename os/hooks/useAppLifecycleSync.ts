import { useEffect, useRef } from 'react';
import type { AppId, OSState } from '../types';
import { AppLifecycle } from '../AppLifecycle';
import { deriveRunningApps, getActiveAppId } from '../taskUtils';

/**
 * App 前后台 / destroy 生命周期同步：对比上一次 render 的活跃 App 与运行集合，
 * 变化时经 AppLifecycle 广播 background / foreground / destroy 事件。
 * 唯一依赖 render 快照（state）的 OS 编排逻辑，因此保持为 hook。
 */
export function useAppLifecycleSync(state: OSState): void {
  const prevActiveAppIdRef = useRef<AppId | null>(getActiveAppId(state));
  const prevRunningAppsRef = useRef<AppId[]>(deriveRunningApps(state.tasks));

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
}
