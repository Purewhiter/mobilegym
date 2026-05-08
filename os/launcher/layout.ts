import type { AppManifest } from '../types/manifest';
import { now as timeNow } from '../TimeService';
import { getLocale } from '../locale';
import { resolveCdnUrl } from '../utils/cdn';
import launcherDefaults from './defaults.json';
import {
  LAUNCHER_LAYOUT_VERSION,
  type LauncherGrid,
  type LauncherFolder,
  type LauncherItem,
  type LauncherLayout,
  type LauncherPlacement,
  type LauncherScreen,
  type LauncherWallpaper,
} from './types';

export const DEFAULT_LAUNCHER_GRID: LauncherGrid = { columns: 4, rows: 6 };

export type LauncherWallpaperChoice = {
  id: string;
  labelZh: string;
  labelEn: string;
  isDark: boolean;
  wallpaper: LauncherWallpaper;
};

const launcherDefaultsData = launcherDefaults as any;
const EMPTY_WALLPAPER: LauncherWallpaper = { kind: 'image', imageUrl: '' };

function normalizeWallpaper(raw: any, fallback: LauncherWallpaper = EMPTY_WALLPAPER): LauncherWallpaper {
  if (!raw || typeof raw !== 'object') return fallback;
  if (raw.kind === 'image' && typeof raw.imageUrl === 'string' && raw.imageUrl) {
    // launcher 数据已带 themes/、wallpapers/ 顶级路径，不传 prefix
    return { kind: 'image', imageUrl: resolveCdnUrl(raw.imageUrl) };
  }
  return fallback;
}

function normalizeWallpaperChoices(raw: any): LauncherWallpaperChoice[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const wallpaper = normalizeWallpaper(item?.wallpaper);
      if (!item || typeof item !== 'object') return null;
      if (typeof item.id !== 'string' || !item.id) return null;
      if (typeof item.labelZh !== 'string' || !item.labelZh) return null;
      if (typeof item.labelEn !== 'string' || !item.labelEn) return null;
      if (!wallpaper.imageUrl) return null;
      return {
        id: item.id,
        labelZh: item.labelZh,
        labelEn: item.labelEn,
        isDark: item.isDark === true,
        wallpaper,
      };
    })
    .filter((item): item is LauncherWallpaperChoice => item !== null);
}

export const DEFAULT_WALLPAPER_CHOICES: LauncherWallpaperChoice[] = normalizeWallpaperChoices(
  launcherDefaultsData.wallpaperChoices,
);

export const DEFAULT_WALLPAPER: LauncherWallpaper = normalizeWallpaper(
  launcherDefaultsData.wallpaper,
  DEFAULT_WALLPAPER_CHOICES[0]?.wallpaper ?? EMPTY_WALLPAPER,
);

function getDefaultFolderName(): string {
  return getLocale() === 'en' ? 'Folder' : '文件夹';
}

function makeId(prefix: string): string {
  const cryptoAny = globalThis.crypto as any;
  if (cryptoAny?.randomUUID) return `${prefix}_${cryptoAny.randomUUID()}`;
  return `${prefix}_${timeNow().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

function keyOfPlacement(p: Pick<LauncherPlacement, 'cellX' | 'cellY'>): string {
  return `${p.cellX},${p.cellY}`;
}

type Occupancy = boolean[][];

function createOccupancy(grid: LauncherGrid): Occupancy {
  return Array.from({ length: grid.rows }, () => Array.from({ length: grid.columns }, () => false));
}

function canPlace(occ: Occupancy, grid: LauncherGrid, x: number, y: number, spanX: number, spanY: number): boolean {
  if (spanX < 1 || spanY < 1) return false;
  if (x < 0 || y < 0) return false;
  if (x + spanX > grid.columns) return false;
  if (y + spanY > grid.rows) return false;
  for (let dy = 0; dy < spanY; dy++) {
    for (let dx = 0; dx < spanX; dx++) {
      if (occ[y + dy]?.[x + dx]) return false;
    }
  }
  return true;
}

function occupy(occ: Occupancy, x: number, y: number, spanX: number, spanY: number): void {
  for (let dy = 0; dy < spanY; dy++) {
    for (let dx = 0; dx < spanX; dx++) {
      if (occ[y + dy] && typeof occ[y + dy][x + dx] === 'boolean') occ[y + dy][x + dx] = true;
    }
  }
}

function buildOccupancyFromPlacements(grid: LauncherGrid, placements: LauncherPlacement[]): Occupancy {
  const occ = createOccupancy(grid);
  for (const p of placements) {
    if (!canPlace(occ, grid, p.cellX, p.cellY, p.spanX, p.spanY)) continue;
    occupy(occ, p.cellX, p.cellY, p.spanX, p.spanY);
  }
  return occ;
}

function findVacantCell(grid: LauncherGrid, occ: Occupancy, spanX: number, spanY: number): { cellX: number; cellY: number } | null {
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.columns; x++) {
      if (canPlace(occ, grid, x, y, spanX, spanY)) return { cellX: x, cellY: y };
    }
  }
  return null;
}

function isValidAppIdFromRegistry(appId: string, registry: AppManifest[]): boolean {
  return registry.some(a => a.id === appId);
}

function createAppItem(appId: string): LauncherItem {
  return { id: makeId(`app_${appId}`), kind: 'app', appId };
}

function createWidgetItem(widgetType: 'clock' | 'weather'): LauncherItem {
  return { id: makeId(`widget_${widgetType}`), kind: 'widget', widgetType };
}

function normalizeGrid(raw: any): LauncherGrid {
  if (!raw || typeof raw !== 'object') return DEFAULT_LAUNCHER_GRID;
  const columns = Math.max(1, Math.floor(raw.columns ?? DEFAULT_LAUNCHER_GRID.columns));
  const rows = Math.max(1, Math.floor(raw.rows ?? DEFAULT_LAUNCHER_GRID.rows));
  return { columns, rows };
}

export function buildDefaultLauncherLayout(appRegistry: AppManifest[]): LauncherLayout {
  const grid = normalizeGrid(launcherDefaults.grid);
  const wallpaper = normalizeWallpaper(launcherDefaultsData.wallpaper, DEFAULT_WALLPAPER);
  const hotseatDesired = Array.isArray(launcherDefaults.hotseatApps)
    ? launcherDefaults.hotseatApps.map((appId) => String(appId || '').trim()).filter(Boolean)
    : [];
  const hotseatAppIds = hotseatDesired.filter(id => isValidAppIdFromRegistry(id, appRegistry));

  const items: Record<string, LauncherItem> = {};

  // --- Screen 1 (MIUI-like) ---
  const screen1Id = 'screen_1';
  const screen1Placements: LauncherPlacement[] = [];

  const widgets = Array.isArray(launcherDefaults.screen1?.widgets) ? launcherDefaults.screen1.widgets : [];
  for (const widget of widgets) {
    let widgetItem: LauncherItem;
    if (widget?.widgetType === 'maml' && widget.widgetId && widget.variant) {
      const xmlBaseUrl = typeof widget === 'object'
        && widget !== null
        && 'xmlBaseUrl' in widget
        && typeof widget.xmlBaseUrl === 'string'
        ? widget.xmlBaseUrl
        : undefined;
      widgetItem = {
        id: makeId('widget_maml'),
        kind: 'widget',
        widgetType: 'maml',
        widgetId: String(widget.widgetId),
        variant: String(widget.variant),
        previewUrl: String(widget.previewUrl ?? ''),
        ...(xmlBaseUrl ? { xmlBaseUrl } : {}),
      };
    } else {
      const widgetType = widget?.widgetType === 'weather' ? 'weather' : 'clock';
      widgetItem = createWidgetItem(widgetType);
    }
    items[widgetItem.id] = widgetItem;
    screen1Placements.push({
      itemId: widgetItem.id,
      container: 'workspace',
      screenId: screen1Id,
      cellX: Math.max(0, Math.floor(widget?.cellX ?? 0)),
      cellY: Math.max(0, Math.floor(widget?.cellY ?? 0)),
      spanX: Math.max(1, Math.floor(widget?.spanX ?? 1)),
      spanY: Math.max(1, Math.floor(widget?.spanY ?? 1)),
    });
  }

  const pinnedDesired: Array<{ appId: string; cellX: number; cellY: number }> = Array.isArray(launcherDefaults.screen1?.pinnedApps)
    ? launcherDefaults.screen1.pinnedApps
      .map((item) => ({
        appId: String(item?.appId || '').trim(),
        cellX: Math.max(0, Math.floor(item?.cellX ?? 0)),
        cellY: Math.max(0, Math.floor(item?.cellY ?? 0)),
      }))
      .filter((item) => item.appId)
    : [];
  const pinned = pinnedDesired.filter(p => isValidAppIdFromRegistry(p.appId, appRegistry));

  for (const p of pinned) {
    const appItem = createAppItem(p.appId);
    items[appItem.id] = appItem;
    screen1Placements.push({
      itemId: appItem.id,
      container: 'workspace',
      screenId: screen1Id,
      cellX: p.cellX,
      cellY: p.cellY,
      spanX: 1,
      spanY: 1,
    });
  }

  const usedAppIds = new Set<string>([
    ...hotseatAppIds,
    ...Object.values(items)
      .filter((i): i is Extract<LauncherItem, { kind: 'app' }> => i.kind === 'app')
      .map(i => i.appId),
  ]);

  // Remaining apps go to screen 2 sequentially.
  const remainingAppIds = appRegistry
    .map(a => a.id)
    .filter(id => !!id && isValidAppIdFromRegistry(id, appRegistry))
    .filter(id => !usedAppIds.has(id));

  const screen2Id = 'screen_2';
  const screen2Placements: LauncherPlacement[] = [];
  const occ2 = buildOccupancyFromPlacements(grid, screen2Placements);
  for (const appId of remainingAppIds) {
    const pos = findVacantCell(grid, occ2, 1, 1);
    if (!pos) break;
    const appItem = createAppItem(appId);
    items[appItem.id] = appItem;
    const placement: LauncherPlacement = {
      itemId: appItem.id,
      container: 'workspace',
      screenId: screen2Id,
      cellX: pos.cellX,
      cellY: pos.cellY,
      spanX: 1,
      spanY: 1,
    };
    screen2Placements.push(placement);
    occupy(occ2, pos.cellX, pos.cellY, 1, 1);
  }

  // Hotseat placements
  const hotseatPlacements: LauncherPlacement[] = [];
  for (let i = 0; i < hotseatAppIds.length; i++) {
    const appId = hotseatAppIds[i];
    const appItem = createAppItem(appId);
    items[appItem.id] = appItem;
    hotseatPlacements.push({
      itemId: appItem.id,
      container: 'hotseat',
      cellX: i,
      cellY: 0,
      spanX: 1,
      spanY: 1,
    });
  }

  const screens: LauncherScreen[] = [
    { id: screen1Id, placements: screen1Placements },
    { id: screen2Id, placements: screen2Placements },
  ];

  return normalizeLauncherLayout({
    version: LAUNCHER_LAYOUT_VERSION,
    grid,
    screens,
    hotseat: hotseatPlacements,
    items,
    folders: {},
    wallpaper,
    hiddenApps: [],
  }, appRegistry);
}

export function normalizeLauncherLayout(layout: LauncherLayout, appRegistry: AppManifest[]): LauncherLayout {
  const grid: LauncherGrid = {
    columns: Math.max(1, Math.floor(layout.grid?.columns ?? DEFAULT_LAUNCHER_GRID.columns)),
    rows: Math.max(1, Math.floor(layout.grid?.rows ?? DEFAULT_LAUNCHER_GRID.rows)),
  };

  const items: Record<string, LauncherItem> = { ...(layout.items ?? {}) };

  // 1) Drop invalid app items (removed from registry)
  for (const [id, item] of Object.entries(items)) {
    if (item.kind === 'app') {
      if (!isValidAppIdFromRegistry(item.appId, appRegistry)) {
        delete items[id];
      }
    }
  }

  const seenItemIds = new Set<string>();

  const normalizePlacement = (p: LauncherPlacement, screenId?: string): LauncherPlacement | null => {
    if (!p || typeof p !== 'object') return null;
    if (!p.itemId || typeof p.itemId !== 'string') return null;
    if (!items[p.itemId]) return null;

    // Ensure no duplicate placements of the same itemId (keep first)
    if (seenItemIds.has(p.itemId)) return null;
    seenItemIds.add(p.itemId);

    const spanX = Math.max(1, Math.floor(p.spanX ?? 1));
    const spanY = Math.max(1, Math.floor(p.spanY ?? 1));
    const cellX = Math.max(0, Math.floor(p.cellX ?? 0));
    const cellY = Math.max(0, Math.floor(p.cellY ?? 0));

    const base: LauncherPlacement = {
      itemId: p.itemId,
      container: p.container === 'hotseat' ? 'hotseat' : 'workspace',
      cellX,
      cellY,
      spanX,
      spanY,
    };

    if (base.container === 'workspace') {
      base.screenId = screenId ?? p.screenId;
    }

    return base;
  };

  const screens: LauncherScreen[] = Array.isArray(layout.screens) ? layout.screens : [];
  const normalizedScreens: LauncherScreen[] = [];
  for (const s of screens) {
    const id = typeof s?.id === 'string' && s.id ? s.id : makeId('screen');
    const rawPlacements = Array.isArray(s?.placements) ? s.placements : [];
    const placements: LauncherPlacement[] = [];
    for (const p of rawPlacements) {
      const np = normalizePlacement(p, id);
      if (!np) continue;
      if (np.container !== 'workspace') continue;
      np.screenId = id;
      placements.push(np);
    }
    normalizedScreens.push({ id, placements });
  }
  if (normalizedScreens.length === 0) {
    normalizedScreens.push({ id: 'screen_1', placements: [] });
  }

  const normalizedHotseat: LauncherPlacement[] = [];
  const rawHotseat = Array.isArray(layout.hotseat) ? layout.hotseat : [];
  for (const p of rawHotseat) {
    const np = normalizePlacement(p);
    if (!np) continue;
    if (np.container !== 'hotseat') continue;
    np.cellY = 0;
    np.spanX = 1;
    np.spanY = 1;
    // Keep within a reasonable range; UI can decide actual max
    np.cellX = Math.max(0, Math.min(7, np.cellX));
    delete (np as any).screenId;
    normalizedHotseat.push(np);
  }

  // 2) Fix collisions inside each screen by pushing items forward to next vacant cell.
  const fixScreenPlacements = (screenPlacements: LauncherPlacement[]) => {
    const occ = createOccupancy(grid);
    const fixed: LauncherPlacement[] = [];

    // Stable order: sort by y, then x
    const sorted = [...screenPlacements].sort((a, b) => {
      if (a.cellY !== b.cellY) return a.cellY - b.cellY;
      return a.cellX - b.cellX;
    });

    for (const p of sorted) {
      const spanX = Math.min(grid.columns, Math.max(1, p.spanX));
      const spanY = Math.min(grid.rows, Math.max(1, p.spanY));
      let cellX = Math.min(grid.columns - 1, Math.max(0, p.cellX));
      let cellY = Math.min(grid.rows - 1, Math.max(0, p.cellY));

      if (!canPlace(occ, grid, cellX, cellY, spanX, spanY)) {
        const pos = findVacantCell(grid, occ, spanX, spanY);
        if (!pos) continue; // no space
        cellX = pos.cellX;
        cellY = pos.cellY;
      }
      occupy(occ, cellX, cellY, spanX, spanY);
      fixed.push({ ...p, cellX, cellY, spanX, spanY });
    }
    return fixed;
  };

  const collisionFixedScreens = normalizedScreens.map(s => ({
    ...s,
    placements: fixScreenPlacements(s.placements),
  }));

  // 3) Wallpaper fallback
  const wallpaper = normalizeWallpaper((layout as any).wallpaper, DEFAULT_WALLPAPER);

  const foldersRaw = (layout.folders && typeof layout.folders === 'object') ? layout.folders : {};
  const folders: Record<string, LauncherFolder> = {};
  for (const [folderId, fAny] of Object.entries(foldersRaw as any)) {
    if (!folderId || typeof folderId !== 'string') continue;
    if (!fAny || typeof fAny !== 'object') continue;
    const name = typeof (fAny as any).name === 'string' && (fAny as any).name ? (fAny as any).name : getDefaultFolderName();
    const rawItems = Array.isArray((fAny as any).items) ? (fAny as any).items : [];
    const appIds = rawItems
      .filter((id: any) => typeof id === 'string' && isValidAppIdFromRegistry(id, appRegistry));
    folders[folderId] = {
      id: folderId,
      name,
      items: Array.from(new Set(appIds)),
    };
  }

  const hiddenApps = Array.isArray((layout as any).hiddenApps)
    ? (layout as any).hiddenApps.filter((id: any) => typeof id === 'string' && isValidAppIdFromRegistry(id, appRegistry))
    : [];

  return {
    version: LAUNCHER_LAYOUT_VERSION,
    grid,
    screens: collisionFixedScreens,
    hotseat: normalizedHotseat,
    items,
    folders,
    wallpaper,
    hiddenApps,
  };
}

/**
 * Ensure launcher contains all installed apps (apps missing from layout are appended).
 * This keeps the simulator resilient when new apps are added to APP_REGISTRY.
 */
export function reconcileLauncherLayoutWithRegistry(layout: LauncherLayout, appRegistry: AppManifest[]): LauncherLayout {
  const normalized = normalizeLauncherLayout(layout, appRegistry);
  const grid = normalized.grid;

  const presentAppIds = new Set<string>();
  for (const item of Object.values(normalized.items)) {
    if (item.kind === 'app') presentAppIds.add(item.appId);
  }
  for (const folder of Object.values(normalized.folders ?? {})) {
    for (const appId of folder.items) presentAppIds.add(appId);
  }

  const registryAppIds = appRegistry
    .map(a => a.id)
    .filter(id => isValidAppIdFromRegistry(id, appRegistry));

  const hidden = new Set(normalized.hiddenApps ?? []);
  const missing = registryAppIds.filter(id => !presentAppIds.has(id) && !hidden.has(id));
  if (missing.length === 0) return normalized;

  const screens = [...normalized.screens];
  const items = { ...normalized.items };

  for (const appId of missing) {
    // Find placement spot on last screen; if full, create a new screen.
    let screen = screens[screens.length - 1];
    let occ = buildOccupancyFromPlacements(grid, screen.placements);
    let pos = findVacantCell(grid, occ, 1, 1);
    if (!pos) {
      const newScreenId = `screen_${screens.length + 1}`;
      screen = { id: newScreenId, placements: [] };
      screens.push(screen);
      occ = buildOccupancyFromPlacements(grid, screen.placements);
      pos = findVacantCell(grid, occ, 1, 1);
      if (!pos) continue;
    }

    const appItem = createAppItem(appId);
    items[appItem.id] = appItem;
    screen.placements = [
      ...screen.placements,
      {
        itemId: appItem.id,
        container: 'workspace',
        screenId: screen.id,
        cellX: pos.cellX,
        cellY: pos.cellY,
        spanX: 1,
        spanY: 1,
      },
    ];
  }

  return normalizeLauncherLayout({
    ...normalized,
    items,
    screens,
  }, appRegistry);
}

export function getWorkspacePageLabel(currentIndex0: number, totalPages: number): string {
  const page = Math.max(1, Math.min(totalPages, currentIndex0 + 1));
  const total = Math.max(1, totalPages);
  return `第 ${page} 页共 ${total} 页`;
}

export function sortPlacementsReadingOrder(placements: LauncherPlacement[]): LauncherPlacement[] {
  return [...placements].sort((a, b) => {
    if (a.cellY !== b.cellY) return a.cellY - b.cellY;
    if (a.cellX !== b.cellX) return a.cellX - b.cellX;
    return a.itemId.localeCompare(b.itemId);
  });
}

export function placementsIndexByCell(placements: LauncherPlacement[]): Map<string, LauncherPlacement> {
  const m = new Map<string, LauncherPlacement>();
  for (const p of placements) {
    m.set(keyOfPlacement(p), p);
  }
  return m;
}
