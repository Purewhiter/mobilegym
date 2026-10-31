import React, { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { AppId, OSState } from './types';
import type { AppIntentFilter, IntentPayload } from './types/manifest';
import { now } from './TimeService';
import { initFileSystem } from './FileSystemService';
import BroadcastBus, { ACTION_BOOT_COMPLETED } from './BroadcastBus';
import { getActiveAppId } from './taskUtils';
import { TaskManager } from './TaskManager';
import { IntentResolver } from './IntentResolver';
import { useAppLifecycleSync } from './hooks/useAppLifecycleSync';
import { useOsBackHandlers } from './hooks/useOsBackHandlers';
import { buildOsApi } from './osApi';
import { buildSimApi } from './sim/simApi';
import { cancelIntentChooser, chooseIntentActivity, closeApp, closeTask, finishActivity, goHome, launchApp, launchTaskById, setBrightness, setVolume, showRecents } from './osActions';

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
    window.__OS__ = buildOsApi(osStateForApi);
  }, [osStateForApi]);

  useEffect(() => {
    window.__SIM__ = buildSimApi();
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
