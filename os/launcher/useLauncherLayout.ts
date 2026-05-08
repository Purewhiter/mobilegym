import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeLauncherLayout, reconcileLauncherLayoutWithRegistry } from './layout';
import { loadLauncherLayout, resetLauncherLayout, saveLauncherLayout } from './storage';
import type { LauncherLayout, LauncherWallpaper } from './types';
import { APP_REGISTRY } from '../data/appRegistry';

type LayoutUpdater = LauncherLayout | ((prev: LauncherLayout) => LauncherLayout);

/**
 * Launcher layout state with localStorage persistence.
 * - Loads once on mount
 * - Debounced persistence on changes
 */
export function useLauncherLayout() {
  const [layout, setLayoutState] = useState<LauncherLayout>(() => loadLauncherLayout(APP_REGISTRY));
  const saveTimerRef = useRef<number | null>(null);

  const setLayout = useCallback((updater: LayoutUpdater) => {
    setLayoutState(prev => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      const normalized = normalizeLauncherLayout(next, APP_REGISTRY);
      return reconcileLauncherLayoutWithRegistry(normalized, APP_REGISTRY);
    });
  }, []);

  const reset = useCallback(() => {
    setLayoutState(resetLauncherLayout(APP_REGISTRY));
  }, []);

  const setWallpaper = useCallback((wallpaper: LauncherWallpaper) => {
    setLayout(prev => ({ ...prev, wallpaper }));
  }, [setLayout]);

  // Debounced persistence.
  useEffect(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveLauncherLayout(layout);
      saveTimerRef.current = null;
    }, 80);
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [layout]);

  return {
    layout,
    setLayout,
    reset,
    setWallpaper,
  };
}

