/**
 * Emits AppLifecycle events as the task stack changes: background/foreground
 * when the active app changes, destroy when an app no longer runs in any task.
 */

import { useEffect, useRef } from 'react';
import { AppLifecycle } from '../AppLifecycle';
import { deriveRunningApps, getActiveAppId } from '../taskUtils';
import type { AppId, OSState } from '../types';

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
