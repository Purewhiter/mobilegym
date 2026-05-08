import { APP_REGISTRY } from '../data/appRegistry';
import type { AppManifest } from '../types/manifest';
import { debouncedSetItem, cancelPending } from '../debouncedPersist';
import {
  buildDefaultLauncherLayout,
  normalizeLauncherLayout,
  reconcileLauncherLayoutWithRegistry,
} from './layout';
import {
  LAUNCHER_LAYOUT_VERSION,
  LAUNCHER_STORAGE_KEY,
  type LauncherLayout,
} from './types';

function safeJsonParse(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadLauncherLayout(appRegistry: AppManifest[] = APP_REGISTRY): LauncherLayout {
  const raw = localStorage.getItem(LAUNCHER_STORAGE_KEY);
  if (!raw) {
    const layout = buildDefaultLauncherLayout(appRegistry);
    saveLauncherLayout(layout);
    return layout;
  }

  const parsed = safeJsonParse(raw);
  if (!parsed || parsed.version !== LAUNCHER_LAYOUT_VERSION) {
    const layout = buildDefaultLauncherLayout(appRegistry);
    saveLauncherLayout(layout);
    return layout;
  }

  // Normalize + reconcile against current registry (for forward compatibility).
  const normalized = normalizeLauncherLayout(parsed as LauncherLayout, appRegistry);
  const reconciled = reconcileLauncherLayoutWithRegistry(normalized, appRegistry);
  // Persist back if changed shape (best-effort).
  saveLauncherLayout(reconciled);
  return reconciled;
}

export function saveLauncherLayout(layout: LauncherLayout): void {
  debouncedSetItem(LAUNCHER_STORAGE_KEY, JSON.stringify(layout));
}

export function clearLauncherLayout(): void {
  cancelPending(LAUNCHER_STORAGE_KEY);
  try {
    localStorage.removeItem(LAUNCHER_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function resetLauncherLayout(appRegistry: AppManifest[] = APP_REGISTRY): LauncherLayout {
  const layout = buildDefaultLauncherLayout(appRegistry);
  saveLauncherLayout(layout);
  return layout;
}
