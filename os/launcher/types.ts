import type { AppId } from '../types';

export const LAUNCHER_LAYOUT_VERSION = 1 as const;
export const LAUNCHER_STORAGE_KEY = 'launcher' as const;

export type LauncherGrid = {
  columns: number; // MIUI dump: 4
  rows: number;    // MIUI dump: 6
};

export type LauncherContainer = 'workspace' | 'hotseat';

export type LauncherWidgetType = 'clock' | 'weather' | 'wmr';

export type LauncherWallpaper = { kind: 'image'; imageUrl: string };

export type LauncherItem =
  | { id: string; kind: 'app'; appId: AppId }
  | { id: string; kind: 'folder'; folderId: string }
  | { id: string; kind: 'widget'; widgetType: 'clock' | 'weather' }
  | { id: string; kind: 'widget'; widgetType: 'wmr'; widgetId: string; variant: string; previewUrl: string; xmlBaseUrl?: string };

export type LauncherPlacement = {
  itemId: string;
  container: LauncherContainer;
  /** workspace only */
  screenId?: string;
  cellX: number;
  cellY: number;
  spanX: number;
  spanY: number;
};

export type LauncherScreen = {
  id: string;
  placements: LauncherPlacement[];
};

export type LauncherFolder = {
  id: string;
  name: string;
  /** Folder content (apps only, v1). */
  items: AppId[];
};

export type LauncherLayout = {
  version: typeof LAUNCHER_LAYOUT_VERSION;
  grid: LauncherGrid;

  /** All workspace pages */
  screens: LauncherScreen[];

  /** Hotseat placements (single row, separate container) */
  hotseat: LauncherPlacement[];

  /**
   * Item registry.
   * - Every placement references an itemId here.
   * - Folder items reference `folders[folderId]`.
   */
  items: Record<string, LauncherItem>;

  folders: Record<string, LauncherFolder>;

  wallpaper: LauncherWallpaper;

  /**
   * Apps intentionally hidden from the desktop (MIUI: apps can live only in app drawer).
   * We keep this to avoid reconcile re-adding icons the user removed.
   */
  hiddenApps: AppId[];
};
