import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Search, Cloud, Sun, CloudSun, CloudRain, Snowflake, CloudLightning, CloudFog } from 'lucide-react';
import { getStore } from '../createAppStore';
import { useOS } from '../OSContext';
import BackDispatcher from '../BackDispatcher';
import { SIMULATOR_CONFIG } from '../data';

const {
  appIconSize, appIconBorderRadius, statusBarHeight,
} = SIMULATOR_CONFIG.framework;
import { APP_REGISTRY, getAppManifest, getLocalizedAppName } from '../data/appRegistry';
import { AppIcon } from '../components/AppIcon';
import type { AppId } from '../types';
import type { AppManifest } from '../types/manifest';
import NotificationService from '../NotificationService';
import { useOsStateStore } from '../OsStateStore';
import * as TimeService from '../TimeService';
import { cdn } from '../utils/cdn';
import { useLauncherLayout } from './useLauncherLayout';
import { shouldStartWorkspaceMouseDrag } from './workspaceGesture';

const THEME_CDN = cdn('themes');
import {
  DEFAULT_WALLPAPER_CHOICES,
  getWorkspacePageLabel,
  sortPlacementsReadingOrder,
} from './layout';
import { renameLauncherFolder } from './folderNameModel';
import { getLocale, useLocale } from '../locale';
import type {
  LauncherFolder,
  LauncherGrid,
  LauncherItem,
  LauncherLayout,
  LauncherPlacement,
  LauncherScreen,
  LauncherWallpaper,
} from './types';
import { listWmrWidgets, getWidgetPreviewUrl, getWidgetXmlBaseUrl } from '../wmr/WmrWidgetService';
import type { WmrWidgetMeta } from '../wmr/WmrWidgetService';
import { WmrRenderer } from '../wmr/WmrRenderer';

function imageWallpaperStyle(imageUrl: string): React.CSSProperties {
  return {
    backgroundImage: `url(${imageUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
}

function wallpaperStyle(wp: LauncherWallpaper): React.CSSProperties {
  return imageWallpaperStyle(wp.imageUrl);
}

function getWallpaperIsDark(wp: LauncherWallpaper): boolean {
  return DEFAULT_WALLPAPER_CHOICES.find((item) => item.wallpaper.imageUrl === wp.imageUrl)?.isDark ?? true;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

const HOTSEAT_SLOTS = 4;
const WORKSPACE_MOUSE_SNAP_THRESHOLD_RATIO = 0.15;
const WORKSPACE_MOUSE_DRAG_START_PX = 8;
const WORKSPACE_MOUSE_SNAP_RESTORE_MS = 360;

function launcherText(zh: string, en: string): string {
  return getLocale() === 'en' ? en : zh;
}

function getDefaultFolderName(): string {
  return launcherText('文件夹', 'Folder');
}

function makeId(prefix: string): string {
  const cryptoAny = globalThis.crypto as any;
  if (cryptoAny?.randomUUID) return `${prefix}_${cryptoAny.randomUUID()}`;
  return `${prefix}_${TimeService.now().toString(16)}_${Math.random().toString(16).slice(2)}`;
}

type Cell = { cellX: number; cellY: number };

function cellKey(cellX: number, cellY: number): string {
  return `${cellX},${cellY}`;
}

function buildOccupancy(grid: LauncherGrid, placements: LauncherPlacement[], ignoreItemId?: string): boolean[][] {
  const occ = Array.from({ length: grid.rows }, () => Array.from({ length: grid.columns }, () => false));
  for (const p of placements) {
    if (ignoreItemId && p.itemId === ignoreItemId) continue;
    for (let dy = 0; dy < p.spanY; dy++) {
      for (let dx = 0; dx < p.spanX; dx++) {
        const x = p.cellX + dx;
        const y = p.cellY + dy;
        if (x < 0 || y < 0 || x >= grid.columns || y >= grid.rows) continue;
        occ[y][x] = true;
      }
    }
  }
  return occ;
}

function findFirstVacantRect(grid: LauncherGrid, placements: LauncherPlacement[], spanX: number, spanY: number): Cell | null {
  const occ = buildOccupancy(grid, placements);
  const maxX = grid.columns - spanX;
  const maxY = grid.rows - spanY;
  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= maxX; x++) {
      let ok = true;
      for (let dy = 0; dy < spanY && ok; dy++) {
        for (let dx = 0; dx < spanX; dx++) {
          if (occ[y + dy]?.[x + dx]) {
            ok = false;
            break;
          }
        }
      }
      if (ok) return { cellX: x, cellY: y };
    }
  }
  return null;
}

function isCellInsidePlacement(cellX: number, cellY: number, p: LauncherPlacement): boolean {
  return (
    cellX >= p.cellX &&
    cellX < p.cellX + p.spanX &&
    cellY >= p.cellY &&
    cellY < p.cellY + p.spanY
  );
}

function removePlacementEverywhere(layout: LauncherLayout, itemId: string): { screens: LauncherLayout['screens']; hotseat: LauncherLayout['hotseat'] } {
  return {
    screens: layout.screens.map(s => ({ ...s, placements: s.placements.filter(p => p.itemId !== itemId) })),
    hotseat: layout.hotseat.filter(p => p.itemId !== itemId),
  };
}

function computeBlockedCellKeys(grid: LauncherGrid, placements: LauncherPlacement[], items: Record<string, LauncherItem>): Set<string> {
  const blocked = new Set<string>();
  for (const p of placements) {
    const item = items[p.itemId];
    if (!item) continue;
    const isWidgetLike = item.kind === 'widget' || p.spanX > 1 || p.spanY > 1;
    if (!isWidgetLike) continue;
    for (let dy = 0; dy < p.spanY; dy++) {
      for (let dx = 0; dx < p.spanX; dx++) {
        const x = p.cellX + dx;
        const y = p.cellY + dy;
        if (x < 0 || y < 0 || x >= grid.columns || y >= grid.rows) continue;
        blocked.add(cellKey(x, y));
      }
    }
  }
  return blocked;
}

function listAvailableCells(grid: LauncherGrid, blocked: Set<string>): { cells: Cell[]; indexByKey: Map<string, number> } {
  const cells: Cell[] = [];
  const indexByKey = new Map<string, number>();
  for (let y = 0; y < grid.rows; y++) {
    for (let x = 0; x < grid.columns; x++) {
      const k = cellKey(x, y);
      if (blocked.has(k)) continue;
      indexByKey.set(k, cells.length);
      cells.push({ cellX: x, cellY: y });
    }
  }
  return { cells, indexByKey };
}

function pickEmptyIndex(emptyIndices: number[], targetIndex: number, originIndex: number | null): number | null {
  if (emptyIndices.length === 0) return null;
  const after = emptyIndices.filter(i => i >= targetIndex).sort((a, b) => a - b);
  const before = emptyIndices.filter(i => i <= targetIndex).sort((a, b) => b - a);
  if (originIndex != null) {
    if (targetIndex < originIndex) return after[0] ?? before[0] ?? null;
    if (targetIndex > originIndex) return before[0] ?? after[0] ?? null;
  }
  return after[0] ?? before[0] ?? null;
}

function computeWorkspacePlacementsAfterInsert(args: {
  grid: LauncherGrid;
  screenId: string;
  placements: LauncherPlacement[];
  items: Record<string, LauncherItem>;
  draggedItemId: string;
  targetCellX: number;
  targetCellY: number;
  originCell: Cell | null;
}): LauncherPlacement[] | null {
  const {
    grid,
    screenId,
    placements,
    items,
    draggedItemId,
    targetCellX,
    targetCellY,
    originCell,
  } = args;

  const blocked = computeBlockedCellKeys(grid, placements, items);
  const targetKey = cellKey(targetCellX, targetCellY);
  if (blocked.has(targetKey)) return null;

  const widgetPlacements = placements.filter(p => {
    const item = items[p.itemId];
    return item?.kind === 'widget' || p.spanX > 1 || p.spanY > 1;
  });

  const { cells: availableCells, indexByKey } = listAvailableCells(grid, blocked);
  const targetIndex = indexByKey.get(targetKey);
  if (targetIndex == null) return null;

  const cellToItem: Array<string | null> = Array.from({ length: availableCells.length }, () => null);

  // Fill current icons (apps/folders only, 1x1). Ignore dragged item (we'll insert it later).
  for (const p of placements) {
    const item = items[p.itemId];
    if (!item) continue;
    if (p.spanX !== 1 || p.spanY !== 1) continue;
    if (item.kind !== 'app' && item.kind !== 'folder') continue;
    const idx = indexByKey.get(cellKey(p.cellX, p.cellY));
    if (idx == null) continue;
    if (p.itemId === draggedItemId) continue;
    cellToItem[idx] = p.itemId;
  }

  // Remove dragged item if present anywhere due to inconsistent state.
  for (let i = 0; i < cellToItem.length; i++) {
    if (cellToItem[i] === draggedItemId) cellToItem[i] = null;
  }

  const originIndex = originCell && originCell.cellX >= 0 && originCell.cellY >= 0
    ? (indexByKey.get(cellKey(originCell.cellX, originCell.cellY)) ?? null)
    : null;

  const emptyIndices: number[] = [];
  for (let i = 0; i < cellToItem.length; i++) {
    if (cellToItem[i] == null) emptyIndices.push(i);
  }

  // If no empty cell, we can't do "push" reorder on this screen.
  const emptyIndex = pickEmptyIndex(emptyIndices, targetIndex, originIndex);
  if (emptyIndex == null) return null;

  // Shift icons towards the empty slot, freeing target cell.
  if (emptyIndex > targetIndex) {
    for (let i = emptyIndex; i > targetIndex; i--) {
      cellToItem[i] = cellToItem[i - 1];
    }
  } else if (emptyIndex < targetIndex) {
    for (let i = emptyIndex; i < targetIndex; i++) {
      cellToItem[i] = cellToItem[i + 1];
    }
  }
  cellToItem[targetIndex] = draggedItemId;

  const iconPlacements: LauncherPlacement[] = [];
  for (let i = 0; i < cellToItem.length; i++) {
    const itemId = cellToItem[i];
    if (!itemId) continue;
    const cell = availableCells[i];
    iconPlacements.push({
      itemId,
      container: 'workspace',
      screenId,
      cellX: cell.cellX,
      cellY: cell.cellY,
      spanX: 1,
      spanY: 1,
    });
  }

  return [...widgetPlacements, ...iconPlacements];
}

function computeHotseatPlacementsAfterInsert(args: {
  placements: LauncherPlacement[];
  items: Record<string, LauncherItem>;
  draggedItemId: string;
  targetSlot: number;
  originSlot: number | null;
}): LauncherPlacement[] | null {
  const { placements, items, draggedItemId, targetSlot, originSlot } = args;
  const slot = clamp(targetSlot, 0, HOTSEAT_SLOTS - 1);

  const slots: Array<string | null> = Array.from({ length: HOTSEAT_SLOTS }, () => null);
  for (const p of placements) {
    const item = items[p.itemId];
    if (!item || item.kind !== 'app') continue;
    const x = clamp(p.cellX, 0, HOTSEAT_SLOTS - 1);
    slots[x] = p.itemId;
  }

  // Remove dragged from hotseat slots.
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] === draggedItemId) slots[i] = null;
  }
  if (originSlot != null && originSlot >= 0 && originSlot < slots.length) {
    // Ensure origin is treated as empty while dragging within hotseat.
    if (slots[originSlot] === draggedItemId) slots[originSlot] = null;
  }

  const emptyIndices: number[] = [];
  for (let i = 0; i < slots.length; i++) {
    if (slots[i] == null) emptyIndices.push(i);
  }

  const originIndex = originSlot != null ? clamp(originSlot, 0, HOTSEAT_SLOTS - 1) : null;
  const emptyIndex = pickEmptyIndex(emptyIndices, slot, originIndex);
  if (emptyIndex == null) return null;

  if (emptyIndex > slot) {
    for (let i = emptyIndex; i > slot; i--) slots[i] = slots[i - 1];
  } else if (emptyIndex < slot) {
    for (let i = emptyIndex; i < slot; i++) slots[i] = slots[i + 1];
  }
  slots[slot] = draggedItemId;

  const next: LauncherPlacement[] = [];
  for (let i = 0; i < slots.length; i++) {
    const itemId = slots[i];
    if (!itemId) continue;
    const item = items[itemId];
    if (!item || item.kind !== 'app') continue;
    next.push({ itemId, container: 'hotseat', cellX: i, cellY: 0, spanX: 1, spanY: 1 });
  }
  return next;
}

function createFolderFromTwoApps(layout: LauncherLayout, appItemIdA: string, appItemIdB: string, target: { screenId: string; cellX: number; cellY: number }): LauncherLayout {
  const a = layout.items[appItemIdA];
  const b = layout.items[appItemIdB];
  if (!a || a.kind !== 'app') return layout;
  if (!b || b.kind !== 'app') return layout;

  const folderId = makeId('folder');
  const folderItemId = makeId('folderItem');

  const folder: LauncherFolder = {
    id: folderId,
    name: getDefaultFolderName(),
    items: Array.from(new Set([b.appId, a.appId])),
  };

  const { screens: screensA, hotseat: hotseatA } = removePlacementEverywhere(layout, appItemIdA);
  const { screens: screensB, hotseat: hotseatB } = removePlacementEverywhere({ ...layout, screens: screensA, hotseat: hotseatA }, appItemIdB);

  const items = { ...layout.items };
  delete items[appItemIdA];
  delete items[appItemIdB];
  items[folderItemId] = { id: folderItemId, kind: 'folder', folderId };

  const folders = { ...(layout.folders ?? {}), [folderId]: folder };
  const hiddenApps = (layout.hiddenApps ?? []).filter(id => id !== a.appId && id !== b.appId);

  const screens = screensB.map(s => {
    if (s.id !== target.screenId) return s;
    return {
      ...s,
      placements: [
        ...s.placements,
        { itemId: folderItemId, container: 'workspace', screenId: s.id, cellX: target.cellX, cellY: target.cellY, spanX: 1, spanY: 1 },
      ],
    };
  });

  const hasTarget = screens.some(s => s.id === target.screenId);
  if (!hasTarget) return layout;

  return {
    ...layout,
    screens: screens as LauncherScreen[],
    hotseat: hotseatB,
    items,
    folders,
    hiddenApps,
  };
}

function addAppItemToFolder(layout: LauncherLayout, appItemId: string, folderItemId: string): LauncherLayout {
  const appItem = layout.items[appItemId];
  const folderItem = layout.items[folderItemId];
  if (!appItem || appItem.kind !== 'app') return layout;
  if (!folderItem || folderItem.kind !== 'folder') return layout;

  const folderId = folderItem.folderId;
  const existing = layout.folders?.[folderId] ?? { id: folderId, name: getDefaultFolderName(), items: [] as AppId[] };
  const itemsInFolder = existing.items.includes(appItem.appId)
    ? existing.items
    : [...existing.items, appItem.appId];

  const folders = {
    ...(layout.folders ?? {}),
    [folderId]: { ...existing, id: folderId, items: itemsInFolder },
  };

  const { screens, hotseat } = removePlacementEverywhere(layout, appItemId);
  const items = { ...layout.items };
  delete items[appItemId];
  const hiddenApps = (layout.hiddenApps ?? []).filter(id => id !== appItem.appId);

  return {
    ...layout,
    screens,
    hotseat,
    items,
    folders,
    hiddenApps,
  };
}

function removeAppFromFolderAndMaybeDissolve(layout: LauncherLayout, folderId: string, appId: AppId): LauncherLayout {
  const folder = layout.folders?.[folderId];
  if (!folder) return layout;
  const nextItems = (folder.items ?? []).filter(id => id !== appId);
  if (nextItems.length === (folder.items ?? []).length) return layout;

  // Find the folder "icon" item on the desktop.
  let folderItemId: string | null = null;
  for (const [id, item] of Object.entries(layout.items)) {
    if (item.kind === 'folder' && item.folderId === folderId) {
      folderItemId = id;
      break;
    }
  }

  // 2+ apps: keep folder
  if (nextItems.length >= 2 || !folderItemId) {
    return {
      ...layout,
      folders: {
        ...(layout.folders ?? {}),
        [folderId]: { ...folder, id: folderId, items: nextItems },
      },
    };
  }

  // 1 app: dissolve into that app (reuse the folder itemId to keep placement stable)
  if (nextItems.length === 1) {
    const remainingAppId = nextItems[0];
    const folders = { ...(layout.folders ?? {}) };
    delete folders[folderId];

    const items: Record<string, LauncherItem> = {
      ...layout.items,
      [folderItemId]: { id: folderItemId, kind: 'app', appId: remainingAppId },
    };

    const hiddenApps = (layout.hiddenApps ?? []).filter(id => id !== remainingAppId);
    return { ...layout, items, folders, hiddenApps };
  }

  // 0 app: remove folder item entirely
  const folders = { ...(layout.folders ?? {}) };
  delete folders[folderId];
  const stripped = removePlacementEverywhere(layout, folderItemId);
  const items = { ...layout.items };
  delete items[folderItemId];
  return { ...layout, ...stripped, items, folders };
}

function gridSpanStyle(p: Pick<LauncherPlacement, 'cellX' | 'cellY' | 'spanX' | 'spanY'>): React.CSSProperties {
  return {
    gridColumnStart: p.cellX + 1,
    gridColumnEnd: p.cellX + 1 + p.spanX,
    gridRowStart: p.cellY + 1,
    gridRowEnd: p.cellY + 1 + p.spanY,
  };
}

const LauncherAppIcon = React.memo(function LauncherAppIcon(props: {
  manifest: AppManifest;
  onClick: () => void;
  onLongPress?: (anchorEl: HTMLElement) => void;
  onLongPressDrag?: (args: { anchorEl: HTMLElement; pointerId: number; clientX: number; clientY: number }) => void;
  showLabel?: boolean;
  size?: number;
  badgeCount?: number;
}) {
  const {
    manifest,
    onClick,
    onLongPress,
    onLongPressDrag,
    showLabel = true,
    size = appIconSize,
    badgeCount = 0,
  } = props;
  const locale = useLocale();
  const btnRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClickRef = useRef(false);
  const longPressedRef = useRef(false);
  const dragTriggeredRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startLongPress = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!onLongPress && !onLongPressDrag) return;
    // Only primary button (mouse) / touch / pen.
    if (typeof (e as any).button === 'number' && (e as any).button !== 0) return;

    suppressNextClickRef.current = false;
    longPressedRef.current = false;
    dragTriggeredRef.current = false;
    activePointerIdRef.current = e.pointerId;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    const isTrustedEvent = !!(e as any).isTrusted;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      longPressedRef.current = true;
      suppressNextClickRef.current = true;
      if (isTrustedEvent) {
        try {
          const el = btnRef.current;
          const pid = activePointerIdRef.current;
          if (pid != null && el) el.setPointerCapture(pid);
        } catch { /* ignore */ }
      }
      const el = btnRef.current;
      if (el && onLongPress) onLongPress(el);
    }, 420);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointerIdRef.current != null && e.pointerId !== activePointerIdRef.current) return;
    if (!startPosRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    const dist = Math.hypot(dx, dy);
    if (timerRef.current && dist > 10) clearTimer();

    if (longPressedRef.current && !dragTriggeredRef.current && onLongPressDrag && dist > 12) {
      dragTriggeredRef.current = true;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch { /* ignore */ }
      const el = btnRef.current;
      if (el) {
        onLongPressDrag({ anchorEl: el, pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY });
      }
    }
  };

  const endLongPress = () => {
    clearTimer();
    startPosRef.current = null;
    // Best-effort: release pointer capture if we took it
    try {
      const pid = activePointerIdRef.current;
      const el = btnRef.current as any;
      if (pid != null && el?.releasePointerCapture) {
        el.releasePointerCapture(pid);
      }
    } catch {
      // ignore
    }
    longPressedRef.current = false;
    dragTriggeredRef.current = false;
    activePointerIdRef.current = null;
  };

  return (
    <button
      ref={btnRef}
      type="button"
      aria-label={locale === 'en' ? `Open ${getLocalizedAppName(manifest.id)}` : `打开 ${getLocalizedAppName(manifest.id)}`}
      className="w-full flex flex-col items-center gap-2 active:scale-95 transition-transform bg-transparent border-0 p-0 cursor-pointer"
      style={{ touchAction: 'pan-x' }}
      onPointerDown={startLongPress}
      onPointerMove={handlePointerMove}
      onPointerUp={endLongPress}
      onPointerCancel={endLongPress}
      onPointerLeave={endLongPress}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick();
      }}
    >
      <div className="relative" style={{ width: `${size}px`, height: `${size}px` }}>
        <AppIcon
          manifest={manifest}
          size={size}
          radius={appIconBorderRadius}
          showShadow
        />
        {badgeCount > 0 ? (
          <div
            className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF3B30] text-white text-[11px] font-semibold flex items-center justify-center shadow"
            aria-label={locale === 'en' ? `Unread ${badgeCount}` : `未读 ${badgeCount}`}
          >
            {badgeCount > 99 ? '99+' : String(badgeCount)}
          </div>
        ) : null}
      </div>
      {showLabel && (
        <span
          className="block w-full max-w-[84px] truncate text-center text-white text-xs font-medium leading-[1.05rem] tracking-wide drop-shadow-sm"
        >
          {getLocalizedAppName(manifest.id)}
        </span>
      )}
    </button>
  );
});

const FolderIcon = React.memo(function FolderIcon(props: {
  folder: LauncherFolder;
  onClick: () => void;
  onLongPress?: (anchorEl: HTMLElement) => void;
  onLongPressDrag?: (args: { anchorEl: HTMLElement; pointerId: number; clientX: number; clientY: number }) => void;
  badgeCount?: number;
  size?: number;
}) {
  const { folder, onClick, onLongPress, onLongPressDrag, badgeCount = 0, size = appIconSize } = props;
  const locale = useLocale();
  const previewAppIds = folder.items.slice(0, 9);
  const previewIconSize = Math.max(10, Math.min(14, Math.round(size * 0.28)));
  const btnRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClickRef = useRef(false);
  const longPressedRef = useRef(false);
  const dragTriggeredRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const startLongPress = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!onLongPress && !onLongPressDrag) return;
    if (typeof (e as any).button === 'number' && (e as any).button !== 0) return;

    suppressNextClickRef.current = false;
    longPressedRef.current = false;
    dragTriggeredRef.current = false;
    activePointerIdRef.current = e.pointerId;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    clearTimer();
    const isTrustedEvent = !!(e as any).isTrusted;
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      longPressedRef.current = true;
      suppressNextClickRef.current = true;
      if (isTrustedEvent) {
        try {
          const el = btnRef.current;
          const pid = activePointerIdRef.current;
          if (pid != null && el) el.setPointerCapture(pid);
        } catch { /* ignore */ }
      }
      const el = btnRef.current;
      if (el && onLongPress) onLongPress(el);
    }, 420);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (activePointerIdRef.current != null && e.pointerId !== activePointerIdRef.current) return;
    if (!startPosRef.current) return;
    const dx = e.clientX - startPosRef.current.x;
    const dy = e.clientY - startPosRef.current.y;
    const dist = Math.hypot(dx, dy);
    if (timerRef.current && dist > 10) clearTimer();

    if (longPressedRef.current && !dragTriggeredRef.current && onLongPressDrag && dist > 12) {
      dragTriggeredRef.current = true;
      try {
        e.preventDefault();
        e.stopPropagation();
      } catch { /* ignore */ }
      const el = btnRef.current;
      if (el) {
        onLongPressDrag({ anchorEl: el, pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY });
      }
    }
  };

  const endLongPress = () => {
    clearTimer();
    startPosRef.current = null;
    try {
      const pid = activePointerIdRef.current;
      const el = btnRef.current as any;
      if (pid != null && el?.releasePointerCapture) {
        el.releasePointerCapture(pid);
      }
    } catch {
      // ignore
    }
    longPressedRef.current = false;
    dragTriggeredRef.current = false;
    activePointerIdRef.current = null;
  };

  return (
    <button
      ref={btnRef}
      type="button"
      aria-label={locale === 'en' ? `Open folder ${folder.name}` : `打开文件夹 ${folder.name}`}
      className="flex flex-col items-center gap-2 active:scale-95 transition-transform bg-transparent border-0 p-0 cursor-pointer"
      style={{ touchAction: 'pan-x' }}
      onPointerDown={startLongPress}
      onPointerMove={handlePointerMove}
      onPointerUp={endLongPress}
      onPointerCancel={endLongPress}
      onPointerLeave={endLongPress}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick();
      }}
    >
      <div className="relative" style={{ width: `${size}px`, height: `${size}px` }}>
        <div
          className="bg-white/15 backdrop-blur-sm shadow-sm flex items-center justify-center overflow-hidden"
          style={{
            width: '100%',
            height: '100%',
            borderRadius: `${appIconBorderRadius}px`,
            padding: 6,
          }}
        >
          <div className="grid grid-cols-3 grid-rows-3 gap-[2px] w-full h-full">
            {Array.from({ length: 9 }).map((_, i) => {
              const appId = previewAppIds[i];
              if (!appId) {
                return <div key={i} className="bg-white/10 rounded-[4px]" />;
              }
              const manifest = getAppManifest(appId);
              const Icon = (manifest?.icon as any) ?? null;
              return (
                <div key={i} className="bg-white/10 rounded-[4px] flex items-center justify-center">
                  {Icon ? (
                    <Icon className="text-white/90" size={previewIconSize} />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
        {badgeCount > 0 ? (
          <div
            className="absolute -right-1 -top-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#FF3B30] text-white text-[11px] font-semibold flex items-center justify-center shadow"
            aria-label={locale === 'en' ? `Unread ${badgeCount}` : `未读 ${badgeCount}`}
          >
            {badgeCount > 99 ? '99+' : String(badgeCount)}
          </div>
        ) : null}
      </div>
      <span className="text-white text-xs font-medium tracking-wide drop-shadow-sm">
        {folder.name}
      </span>
    </button>
  );
});

function LauncherClockWidget(props: { onClick: () => void; onLongPress?: (anchorEl: HTMLElement) => void }) {
  const { onClick, onLongPress } = props;
  const locale = useLocale();
  const [timeStr, setTimeStr] = useState(TimeService.formatTime());
  const [dateStr, setDateStr] = useState(TimeService.formatDate());
  const [dayOfWeek, setDayOfWeek] = useState(TimeService.getDayOfWeek());
  const btnRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClickRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    const t = window.setInterval(() => {
      setTimeStr(TimeService.formatTime());
      setDateStr(TimeService.formatDate());
      setDayOfWeek(TimeService.getDayOfWeek());
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    setDateStr(TimeService.formatDate());
    setDayOfWeek(TimeService.getDayOfWeek());
  }, [locale]);

  return (
    <button
      ref={btnRef}
      type="button"
      aria-label={locale === 'en' ? 'Open Clock' : '打开时钟'}
      className="w-full h-full min-h-0 flex flex-col items-center justify-center text-center px-4 py-3 active:scale-[0.99] transition-transform"
      style={{ touchAction: onLongPress ? 'pan-x' : undefined }}
      onPointerDown={(e) => {
        if (!onLongPress) return;
        if (typeof (e as any).button === 'number' && (e as any).button !== 0) return;
        suppressNextClickRef.current = false;
        startPosRef.current = { x: e.clientX, y: e.clientY };
        clearTimer();
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          suppressNextClickRef.current = true;
          const el = btnRef.current;
          if (el) onLongPress(el);
        }, 420);
      }}
      onPointerMove={(e) => {
        if (!timerRef.current || !startPosRef.current) return;
        const dx = e.clientX - startPosRef.current.x;
        const dy = e.clientY - startPosRef.current.y;
        if (Math.hypot(dx, dy) > 10) clearTimer();
      }}
      onPointerUp={() => {
        clearTimer();
        startPosRef.current = null;
      }}
      onPointerCancel={() => {
        clearTimer();
        startPosRef.current = null;
      }}
      onPointerLeave={() => {
        clearTimer();
        startPosRef.current = null;
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick();
      }}
    >
      <div className="flex-shrink-0 text-white/80 text-base">{dateStr} {dayOfWeek}</div>
      <div className="flex-shrink-0 text-white font-extralight leading-none" style={{ fontSize: 80 }}>
        {timeStr}
      </div>
    </button>
  );
}

type WeatherSnapshot = {
  cityId: string;
  cityName: string;
  temp: string;
  text: string;
  tempMax: string;
  tempMin: string;
  aqi: string;
} | null;

const WEATHER_CITY_NAME_MAP: Record<string, { zh: string; en: string }> = {
  beijing: { zh: '北京市', en: 'Beijing' },
  shanghai: { zh: '上海市', en: 'Shanghai' },
  guangzhou: { zh: '广州市', en: 'Guangzhou' },
  shenzhen: { zh: '深圳市', en: 'Shenzhen' },
  zhuhai: { zh: '珠海市', en: 'Zhuhai' },
  foshan: { zh: '佛山市', en: 'Foshan' },
  nanjing: { zh: '南京市', en: 'Nanjing' },
  suzhou: { zh: '苏州市', en: 'Suzhou' },
  xiamen: { zh: '厦门市', en: 'Xiamen' },
  nanning: { zh: '南宁市', en: 'Nanning' },
  kunming: { zh: '昆明市', en: 'Kunming' },
  chengdu: { zh: '成都市', en: 'Chengdu' },
  changsha: { zh: '长沙市', en: 'Changsha' },
  fuzhou: { zh: '福州市', en: 'Fuzhou' },
  hangzhou: { zh: '杭州市', en: 'Hangzhou' },
  wuhan: { zh: '武汉市', en: 'Wuhan' },
  qingdao: { zh: '青岛市', en: 'Qingdao' },
  xian: { zh: '西安市', en: "Xi'an" },
  taiyuan: { zh: '太原市', en: 'Taiyuan' },
  shijiazhuang: { zh: '石家庄市', en: 'Shijiazhuang' },
  shenyang: { zh: '沈阳市', en: 'Shenyang' },
  chongqing: { zh: '重庆市', en: 'Chongqing' },
  tianjin: { zh: '天津市', en: 'Tianjin' },
};

function titleCaseLauncherWord(word: string): string {
  if (!word) return word;
  return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
}

function formatLauncherPinyinLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'Weather';
  return trimmed
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(titleCaseLauncherWord)
    .join(' ');
}

function getLocalizedLauncherWeatherCityName(
  cityId: string,
  rawCityName: string,
  locale: ReturnType<typeof getLocale>,
): string {
  if (locale !== 'en') {
    return rawCityName || '天气';
  }
  if (cityId === 'located') {
    return 'Current Location';
  }
  const mapped = WEATHER_CITY_NAME_MAP[cityId];
  if (mapped) return mapped.en;
  if (/^[A-Za-z0-9\s,./_-]+$/.test(rawCityName)) return rawCityName;
  return formatLauncherPinyinLabel(cityId || rawCityName);
}

function getLocalizedLauncherWeatherText(
  text: string | undefined,
  locale: ReturnType<typeof getLocale>,
): string {
  const raw = String(text ?? '').trim();
  if (!raw) return '';
  if (locale !== 'en') return raw;

  const normalized = raw.toLowerCase();
  if (/^[A-Za-z0-9\s\-_/]+$/.test(raw)) {
    if (normalized.includes('blizzard') || normalized.includes('storm snow')) return 'Blizzard';
    if (normalized.includes('snow')) return normalized.includes('heavy') ? 'Heavy Snow' : normalized.includes('moderate') ? 'Moderate Snow' : 'Light Snow';
    if (normalized.includes('torrential') || normalized.includes('storm rain') || normalized.includes('thunder')) return 'Torrential Rain';
    if (normalized.includes('rain')) return normalized.includes('heavy') ? 'Heavy Rain' : normalized.includes('moderate') ? 'Moderate Rain' : 'Light Rain';
    if (normalized.includes('fog') || normalized.includes('mist')) return 'Fog';
    if (normalized.includes('haze')) return normalized.includes('heavy') ? 'Heavy Haze' : normalized.includes('moderate') ? 'Moderate Haze' : 'Light Haze';
    if (normalized.includes('dust')) return 'Dust';
    if (normalized.includes('sand')) return 'Sandstorm';
    if (normalized.includes('wind')) return 'Gale';
    if (normalized.includes('overcast') || normalized.includes('cloudy')) return normalized.includes('partly') ? 'Partly Cloudy' : 'Overcast';
    if (normalized.includes('partly')) return 'Partly Cloudy';
    if (normalized.includes('clear') || normalized.includes('sunny')) return 'Clear';
    return formatLauncherPinyinLabel(raw);
  }

  if (raw.includes('雷') && raw.includes('雨')) return 'Torrential Rain';
  if (raw.includes('暴雨') || raw.includes('大雨')) return 'Heavy Rain';
  if (raw.includes('中雨')) return 'Moderate Rain';
  if (raw.includes('阵雨') || raw.includes('小雨') || raw.includes('毛毛雨')) return 'Light Rain';
  if (raw.includes('暴雪') || raw.includes('大雪')) return 'Heavy Snow';
  if (raw.includes('中雪')) return 'Moderate Snow';
  if (raw.includes('阵雪') || raw.includes('小雪')) return 'Light Snow';
  if (raw.includes('雾') || raw.includes('浓雾')) return 'Fog';
  if (raw.includes('重度雾霾') || (raw.includes('重度') && raw.includes('霾'))) return 'Heavy Haze';
  if (raw.includes('中度雾霾') || (raw.includes('中度') && raw.includes('霾'))) return 'Moderate Haze';
  if (raw.includes('轻度雾霾') || raw.includes('雾霾') || raw.includes('霾')) return 'Light Haze';
  if (raw.includes('浮尘') || raw.includes('扬尘')) return 'Dust';
  if (raw.includes('沙尘')) return 'Sandstorm';
  if (raw.includes('大风')) return 'Gale';
  if (raw.includes('阴')) return 'Overcast';
  if (raw.includes('多云') || raw.includes('少云')) return 'Partly Cloudy';
  if (raw.includes('晴')) return 'Clear';
  return formatLauncherPinyinLabel(raw);
}

function deriveWeatherSnapshot(store: ReturnType<typeof getStore>): WeatherSnapshot {
  if (!store) return null;
  const s = store.getState() as any;
  const cityId = s?.selectedCityId ?? '';
  const bundle = s?.bundlesByCityId?.[cityId];
  if (!bundle?.bundle?.now) return null;
  const savedCities: any[] = s?.savedCities ?? [];
  let cityName = '--';
  if (cityId === 'located') cityName = bundle.locationName ?? '定位中';
  else {
    const city = savedCities.find((c: any) => c.id === cityId);
    cityName = city?.name ?? '--';
  }
  const now = bundle.bundle.now;
  const daily = bundle.bundle.daily ?? [];
  return {
    cityId,
    cityName,
    temp: now.temp ?? '--',
    text: now.text ?? '',
    tempMax: daily[0]?.tempMax ?? '',
    tempMin: daily[0]?.tempMin ?? '',
    aqi: bundle.bundle?.airQuality?.aqi ?? '',
  };
}

function snapshotsEqual(a: WeatherSnapshot, b: WeatherSnapshot): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.cityId === b.cityId && a.cityName === b.cityName && a.temp === b.temp && a.text === b.text
    && a.tempMax === b.tempMax && a.tempMin === b.tempMin
    && a.aqi === b.aqi;
}

function useWeatherData(): WeatherSnapshot {
  const store = getStore('weather');
  const cacheRef = useRef<WeatherSnapshot>(null);

  const subscribe = useMemo(() => {
    if (!store) return (cb: () => void) => { void cb; return () => {}; };
    return (cb: () => void) => store.subscribe(cb);
  }, [store]);

  const getSnapshot = useMemo(() => {
    return () => {
      const next = deriveWeatherSnapshot(store);
      if (snapshotsEqual(cacheRef.current, next)) return cacheRef.current;
      cacheRef.current = next;
      return next;
    };
  }, [store]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

const subscribeNotifications = (onChange: () => void) => NotificationService.subscribe(() => onChange());

function getAqiLevel(aqi: string | undefined): string {
  const n = parseInt(aqi ?? '', 10);
  if (isNaN(n)) return '';
  if (n <= 50) return '优';
  if (n <= 100) return '良';
  if (n <= 150) return '轻度';
  if (n <= 200) return '中度';
  return '重度';
}

function getWeatherLucideIcon(text: string) {
  if (text.includes('雷')) return CloudLightning;
  if (text.includes('雪') || text.includes('冰')) return Snowflake;
  if (text.includes('雨')) return CloudRain;
  if (text.includes('雾') || text.includes('霾')) return CloudFog;
  if (text.includes('阴') || text.includes('多云')) return CloudSun;
  if (text.includes('晴')) return Sun;
  return Cloud;
}

function getLocalizedWeatherWidgetAqiLevel(aqi: string | undefined, locale: ReturnType<typeof getLocale>): string {
  const n = parseInt(aqi ?? '', 10);
  if (Number.isNaN(n)) return '';
  if (locale === 'en') {
    if (n <= 50) return 'Good';
    if (n <= 100) return 'Fair';
    if (n <= 150) return 'Moderate';
    if (n <= 200) return 'Unhealthy';
    return 'Severe';
  }
  if (n <= 50) return '优';
  if (n <= 100) return '良';
  if (n <= 150) return '轻度';
  if (n <= 200) return '中度';
  return '重度';
}

function getLocalizedWeatherWidgetIcon(text: string) {
  const normalized = String(text ?? '').toLowerCase();
  if (text.includes('雷') || normalized.includes('thunder')) return CloudLightning;
  if (text.includes('雪') || text.includes('冰') || normalized.includes('snow') || normalized.includes('sleet') || normalized.includes('ice')) return Snowflake;
  if (text.includes('雨') || normalized.includes('rain') || normalized.includes('drizzle') || normalized.includes('shower')) return CloudRain;
  if (text.includes('雾') || text.includes('霾') || normalized.includes('fog') || normalized.includes('haze') || normalized.includes('mist')) return CloudFog;
  if (text.includes('阴') || text.includes('多云') || normalized.includes('cloud')) return CloudSun;
  if (text.includes('晴') || normalized.includes('clear') || normalized.includes('sun')) return Sun;
  return Cloud;
}

function LauncherWeatherWidget(props: { onClick: () => void; onLongPress?: (anchorEl: HTMLElement) => void }) {
  const { onClick, onLongPress } = props;
  const locale = useLocale();
  const btnRef = useRef<HTMLButtonElement>(null);
  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const suppressNextClickRef = useRef(false);
  const weather = useWeatherData();
  const localizedCityName = weather
    ? getLocalizedLauncherWeatherCityName(weather.cityId, weather.cityName, locale)
    : (locale === 'en' ? 'Weather' : '天气');
  const localizedWeatherText = weather
    ? getLocalizedLauncherWeatherText(weather.text, locale)
    : '';
  const localizedAqiLevel = weather
    ? getLocalizedWeatherWidgetAqiLevel(weather.aqi, locale)
    : '';

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const IconComp = weather ? getLocalizedWeatherWidgetIcon(weather.text) : Cloud;

  return (
    <button
      ref={btnRef}
      type="button"
      aria-label={locale === 'en' ? 'Open Weather' : '打开天气'}
      className="w-full h-full min-h-0 text-left rounded-2xl bg-gradient-to-b from-white/[0.09] to-white/[0.04] border border-white/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] px-4 py-3.5 active:scale-[0.99] transition-transform flex flex-col overflow-hidden"
      style={{ touchAction: onLongPress ? 'pan-x' : undefined }}
      onPointerDown={(e) => {
        if (!onLongPress) return;
        if (typeof (e as any).button === 'number' && (e as any).button !== 0) return;
        suppressNextClickRef.current = false;
        startPosRef.current = { x: e.clientX, y: e.clientY };
        clearTimer();
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null;
          suppressNextClickRef.current = true;
          const el = btnRef.current;
          if (el) onLongPress(el);
        }, 420);
      }}
      onPointerMove={(e) => {
        if (!timerRef.current || !startPosRef.current) return;
        const dx = e.clientX - startPosRef.current.x;
        const dy = e.clientY - startPosRef.current.y;
        if (Math.hypot(dx, dy) > 10) clearTimer();
      }}
      onPointerUp={() => {
        clearTimer();
        startPosRef.current = null;
      }}
      onPointerCancel={() => {
        clearTimer();
        startPosRef.current = null;
      }}
      onPointerLeave={() => {
        clearTimer();
        startPosRef.current = null;
      }}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClick();
      }}
    >
      <div className="flex-shrink-0">
        <div className="text-white/90 text-sm font-medium">{localizedCityName}</div>
        <div className="text-white/70 text-sm">{localizedWeatherText}</div>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-between gap-2">
        <div className="text-white font-light leading-none min-w-0" style={{ fontSize: 42 }}>
          {weather ? `${weather.temp}\u00B0` : `--\u00B0`}
        </div>
        <IconComp className="text-white/90 flex-shrink-0" size={44} />
      </div>
      {weather && (
        <div className="flex-shrink-0 text-white/70 text-sm mt-0.5 space-y-0.5">
          <div>
            {locale === 'en'
              ? `High ${weather.tempMax}\u00B0 Low ${weather.tempMin}\u00B0`
              : `最高${weather.tempMax}\u00B0 最低${weather.tempMin}\u00B0`}
          </div>
          {localizedAqiLevel && (
            <div>
              {locale === 'en'
                ? `AQI ${localizedAqiLevel} ${weather.aqi}`
                : `空气${localizedAqiLevel} ${weather.aqi}`}
            </div>
          )}
        </div>
      )}
    </button>
  );
}

/** Derive xmlBaseUrl from widgetId + variant when the field is absent. */
function inferXmlBaseUrl(widgetId: string, variant: string): string {
  // Theme clock: widgetId = "<themeId>_clock_2x4", variant = "clock_2x4"
  // → <THEME_CDN>/<themeId>/clock_2x4/
  if (widgetId.endsWith('_' + variant)) {
    const themeId = widgetId.slice(0, -(variant.length + 1));
    return `${THEME_CDN}/${themeId}/${variant}/`;
  }
  // Standalone: widgetId is the directory name
  return `${THEME_CDN}/${widgetId}/${variant}/`;
}

const WorkspaceGrid = React.memo(function WorkspaceGrid(props: {
  grid: LauncherGrid;
  screen: LauncherScreen;
  active: boolean;
  shouldLoadWmr: boolean;
  previewPlacements?: LauncherPlacement[] | null;
  items: Record<string, LauncherItem>;
  folders: Record<string, LauncherFolder>;
  badgeCountByAppId: Partial<Record<AppId, number>>;
  iconSizePx: number;
  onLaunchApp: (id: AppId) => void;
  onOpenFolder: (folderId: string) => void;
  onLongPressItem: (itemId: string, anchorEl: HTMLElement) => void;
  draggingItemId: string | null;
  dragHighlight: { screenId: string; cellX: number; cellY: number } | null;
  onGridMount: (screenId: string, el: HTMLDivElement | null) => void;
  onStartDrag: (args: {
    itemId: string;
    placement: LauncherPlacement;
    screenId: string;
    container: 'workspace';
    anchorEl: HTMLElement;
    pointerId: number;
    clientX: number;
    clientY: number;
  }) => void;
}) {
  const {
    grid,
    screen,
    active,
    shouldLoadWmr,
    previewPlacements,
    items,
    folders,
    badgeCountByAppId,
    iconSizePx,
    onLaunchApp,
    onOpenFolder,
    onLongPressItem,
    draggingItemId,
    dragHighlight,
    onGridMount,
    onStartDrag,
  } = props;
  const widgetPlacements = useMemo(
    () => sortPlacementsReadingOrder(screen.placements).filter((p) => items[p.itemId]?.kind === 'widget'),
    [items, screen.placements],
  );
  const iconPlacements = useMemo(
    () => sortPlacementsReadingOrder(previewPlacements ?? screen.placements).filter((p) => items[p.itemId]?.kind !== 'widget'),
    [items, previewPlacements, screen.placements],
  );
  const gridRef = useCallback((el: HTMLDivElement | null) => {
    onGridMount(screen.id, el);
  }, [onGridMount, screen.id]);

  return (
    <div
      ref={gridRef}
      className="w-full h-full grid gap-x-3 gap-y-4"
      style={{
        gridTemplateColumns: `repeat(${grid.columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
      }}
    >
      {dragHighlight && dragHighlight.screenId === screen.id ? (
        <div
          key="drag-highlight"
          style={gridSpanStyle({ cellX: dragHighlight.cellX, cellY: dragHighlight.cellY, spanX: 1, spanY: 1 })}
          className="pointer-events-none rounded-[22px] bg-white/12 ring-2 ring-white/25"
        />
      ) : null}

      {widgetPlacements.map(p => {
        const item = items[p.itemId];
        if (!item) return null;
        if (item.kind !== 'widget') return null;

        return (
          <div key={p.itemId} style={gridSpanStyle(p)}>
            {item.widgetType === 'clock' ? (
              <LauncherClockWidget
                onClick={() => onLaunchApp('clock')}
                onLongPress={(el) => onLongPressItem(p.itemId, el)}
              />
            ) : item.widgetType === 'wmr' ? (
              <WmrRenderer
                xmlBaseUrl={item.xmlBaseUrl ?? inferXmlBaseUrl(item.widgetId, item.variant)}
                previewUrl={item.previewUrl}
                preferredAspectRatio={p.spanX / p.spanY}
                spanX={p.spanX}
                spanY={p.spanY}
                className="w-full h-full"
                persistNamespace={`launcher:${p.itemId}`}
                active={active}
                shouldLoad={shouldLoadWmr}
                onClick={item.variant.startsWith('clock_') ? () => onLaunchApp('clock') : undefined}
                onLongPress={(el) => onLongPressItem(p.itemId, el)}
              />
            ) : (
              <LauncherWeatherWidget
                onClick={() => onLaunchApp('weather')}
                onLongPress={(el) => onLongPressItem(p.itemId, el)}
              />
            )}
          </div>
        );
      })}

      {iconPlacements.map(p => {
        const item = items[p.itemId];
        if (!item) return null;
        if (item.kind === 'widget') return null;

        const isDragged = draggingItemId === p.itemId;

        if (item.kind === 'folder') {
          const folder = folders[item.folderId] ?? { id: item.folderId, name: getDefaultFolderName(), items: [] };
          const folderBadge = (folder.items ?? []).reduce((acc, appId) => acc + (badgeCountByAppId[appId] || 0), 0);
          return (
            <div
              key={p.itemId}
              style={gridSpanStyle(p)}
              className={`flex items-center justify-center relative z-10 ${isDragged ? 'opacity-0' : ''}`}
            >
              <FolderIcon
                folder={folder}
                badgeCount={folderBadge}
                size={iconSizePx}
                onClick={() => onOpenFolder(item.folderId)}
                onLongPress={(el) => onLongPressItem(p.itemId, el)}
                onLongPressDrag={({ anchorEl, pointerId, clientX, clientY }) => {
                  onStartDrag({
                    itemId: p.itemId,
                    placement: p,
                    screenId: screen.id,
                    container: 'workspace',
                    anchorEl,
                    pointerId,
                    clientX,
                    clientY,
                  });
                }}
              />
            </div>
          );
        }

        // app
        const manifest = getAppManifest(item.appId);
        if (!manifest) return null;
        return (
          <div
            key={p.itemId}
            style={gridSpanStyle(p)}
            className={`flex items-center justify-center relative z-10 ${isDragged ? 'opacity-0' : ''}`}
          >
            <LauncherAppIcon
              manifest={manifest}
              badgeCount={badgeCountByAppId[item.appId] || 0}
              size={iconSizePx}
              onClick={() => onLaunchApp(item.appId)}
              onLongPress={(el) => onLongPressItem(p.itemId, el)}
              onLongPressDrag={({ anchorEl, pointerId, clientX, clientY }) => {
                onStartDrag({
                  itemId: p.itemId,
                  placement: p,
                  screenId: screen.id,
                  container: 'workspace',
                  anchorEl,
                  pointerId,
                  clientX,
                  clientY,
                });
              }}
            />
          </div>
        );
      })}
    </div>
  );
});

const HotseatBar = React.memo(function HotseatBar(props: {
  placements: LauncherPlacement[];
  items: Record<string, LauncherItem>;
  badgeCountByAppId: Partial<Record<AppId, number>>;
  iconSizePx: number;
  onLaunchApp: (id: AppId) => void;
  onLongPressItem: (itemId: string, anchorEl: HTMLElement) => void;
  draggingItemId: string | null;
  highlightCellX: number | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onStartDrag: (args: {
    itemId: string;
    placement: LauncherPlacement;
    container: 'hotseat';
    anchorEl: HTMLElement;
    pointerId: number;
    clientX: number;
    clientY: number;
  }) => void;
}) {
  const {
    placements,
    items,
    badgeCountByAppId,
    iconSizePx,
    onLaunchApp,
    onLongPressItem,
    draggingItemId,
    highlightCellX,
    containerRef,
    onStartDrag,
  } = props;

  const bySlot = useMemo(() => {
    const m = new Map<number, LauncherPlacement>();
    for (const p of placements) {
      m.set(p.cellX, p);
    }
    return m;
  }, [placements]);

  return (
    <div className="w-full px-6 pb-10 pt-2">
      <div ref={containerRef} className="w-full grid grid-cols-4 gap-x-6 items-center">
        {Array.from({ length: 4 }).map((_, slot) => {
          const p = bySlot.get(slot);
          const isHighlighted = highlightCellX === slot;

          if (!p) {
            return (
              <div
                key={`empty_${slot}`}
                className={`h-[56px] rounded-[22px] ${isHighlighted ? 'bg-white/10 ring-2 ring-white/25' : ''}`}
              />
            );
          }

          const item = items[p.itemId];
          if (!item || item.kind !== 'app') return <div key={p.itemId} />;
          const manifest = getAppManifest(item.appId);
          if (!manifest) return <div key={p.itemId} />;

          const isDragged = draggingItemId === p.itemId;

          return (
            <div
              key={p.itemId}
              className={`flex items-center justify-center relative ${isDragged ? 'opacity-0' : ''} ${isHighlighted ? 'rounded-[22px] bg-white/10 ring-2 ring-white/25' : ''}`}
            >
              <LauncherAppIcon
                manifest={manifest}
                badgeCount={badgeCountByAppId[item.appId] || 0}
                onClick={() => onLaunchApp(item.appId)}
                onLongPress={(el) => onLongPressItem(p.itemId, el)}
                onLongPressDrag={({ anchorEl, pointerId, clientX, clientY }) => {
                  onStartDrag({
                    itemId: p.itemId,
                    placement: p,
                    container: 'hotseat',
                    anchorEl,
                    pointerId,
                    clientX,
                    clientY,
                  });
                }}
                showLabel={false}
                size={Math.round(iconSizePx * 0.92)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

let _lastPage = 0;

export const Launcher: React.FC = () => {
  const { launchApp } = useOS();
  const locale = useLocale();
  const { layout, setLayout, reset, setWallpaper } = useLauncherLayout();
  const preferences = useOsStateStore((state) => state.preferences);
  const notifications = useSyncExternalStore(
    subscribeNotifications,
    NotificationService.getState,
  );
  const badgeCountByAppId = useMemo(() => {
    const prefs = preferences as Record<string, any>;
    const map: Partial<Record<AppId, number>> = {};
    for (const it of notifications.items) {
      const appId = it.appId;
      if (!appId) continue;
      if (it.read) continue;
      const enabledKey = `notif.app.${appId}.enabled`;
      const badgeKey = `notif.app.${appId}.badge`;
      const enabled = typeof prefs[enabledKey] === 'boolean' ? prefs[enabledKey] : true;
      const badgeEnabled = typeof prefs[badgeKey] === 'boolean' ? prefs[badgeKey] : true;
      if (!enabled || !badgeEnabled) continue;
      map[appId] = (map[appId] || 0) + 1;
    }
    return map;
  }, [preferences, notifications.items]);

  const iconSizePct = useMemo(() => {
    const raw = (preferences as any).icon_size;
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n)) return 100;
    return Math.max(80, Math.min(120, Math.round(n)));
  }, [preferences]);
  const iconSizePx = useMemo(() => {
    const scale = iconSizePct / 100;
    return Math.max(28, Math.round(appIconSize * scale));
  }, [iconSizePct]);

  const preferredGrid = useMemo(() => {
    const raw = (preferences as any).home_screen_layout;
    if (typeof raw !== 'string' || !raw.trim()) return null;
    const s = raw.trim().toLowerCase().replace('×', 'x').replace(/\s+/g, '');
    const m = s.match(/^(\d{1,2})x(\d{1,2})$/);
    if (!m) return null;
    const columns = Math.max(3, Math.min(8, Math.floor(Number(m[1]))));
    const rows = Math.max(4, Math.min(9, Math.floor(Number(m[2]))));
    if (!Number.isFinite(columns) || !Number.isFinite(rows)) return null;
    return { columns, rows };
  }, [preferences]);

  useEffect(() => {
    if (!preferredGrid) return;
    if (layout.grid.columns === preferredGrid.columns && layout.grid.rows === preferredGrid.rows) return;
    setLayout((prev) => ({ ...prev, grid: preferredGrid }));
  }, [layout.grid.columns, layout.grid.rows, preferredGrid, setLayout]);

  const [currentPage, setCurrentPage] = useState(() => Math.min(_lastPage, Math.max(0, layout.screens.length - 1)));
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isPaging, setIsPaging] = useState(false);
  const pagingTimerRef = useRef<number | null>(null);

  const mouseDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startScrollLeft: number;
    active: boolean;
    moved: boolean;
  } | null>(null);
  const suppressClickAfterDragRef = useRef(false);
  const snapRestoreTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const clearSnapRestoreTimer = () => {
      if (snapRestoreTimerRef.current) {
        window.clearTimeout(snapRestoreTimerRef.current);
        snapRestoreTimerRef.current = null;
      }
    };
    const restoreSnapAfterSettle = (el: HTMLDivElement) => {
      clearSnapRestoreTimer();
      snapRestoreTimerRef.current = window.setTimeout(() => {
        snapRestoreTimerRef.current = null;
        el.style.scrollSnapType = 'x mandatory';
      }, WORKSPACE_MOUSE_SNAP_RESTORE_MS);
    };
    const finishMouseDrag = (e: PointerEvent | null) => {
      const md = mouseDragRef.current;
      if (!md) return;
      if (md.moved) suppressClickAfterDragRef.current = true;
      mouseDragRef.current = null;
      const el = scrollContainerRef.current;
      if (!el) return;
      try {
        if (el.hasPointerCapture?.(md.pointerId)) el.releasePointerCapture(md.pointerId);
      } catch {
        // ignore
      }
      if (!md.active) return;
      clearSnapRestoreTimer();
      el.style.scrollSnapType = 'none';
      const pageWidth = el.clientWidth;
      if (!pageWidth) {
        el.style.scrollSnapType = 'x mandatory';
        return;
      }
      const maxPage = Math.max(0, Math.ceil(el.scrollWidth / pageWidth) - 1);
      const startPage = clamp(Math.round(md.startScrollLeft / pageWidth), 0, maxPage);
      const dragDelta = e ? md.startX - e.clientX : el.scrollLeft - md.startScrollLeft;
      const threshold = pageWidth * WORKSPACE_MOUSE_SNAP_THRESHOLD_RATIO;
      // 鼠标拖拽没有原生惯性，降低释放阈值让轻扫更接近真机桌面。
      const targetPage = Math.abs(dragDelta) >= threshold
        ? clamp(startPage + (dragDelta > 0 ? 1 : -1), 0, maxPage)
        : startPage;
      el.scrollTo({ left: targetPage * pageWidth, behavior: 'smooth' });
      restoreSnapAfterSettle(el);
    };
    const onMove = (e: PointerEvent) => {
      const md = mouseDragRef.current;
      if (!md) return;
      // 多指/混合输入：只处理与按下时同一 pointer 的 move，避免第二指干扰 startX/startY 锚点。
      if (e.pointerId !== md.pointerId) return;
      // 有些环境里点击取消/指针捕获丢失后不会可靠送达 pointerup；
      // 一旦按钮已松开，立即收尾，避免后续 move 继续“沾手”拖动。
      if (e.pointerType === 'mouse' && e.buttons === 0) {
        finishMouseDrag(e);
        return;
      }
      const el = scrollContainerRef.current;
      if (!el) return;
      const dx = e.clientX - md.startX;
      const dy = e.clientY - md.startY;
      if (!md.active) {
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (absX < WORKSPACE_MOUSE_DRAG_START_PX && absY < WORKSPACE_MOUSE_DRAG_START_PX) return;
        if (absX <= absY) {
          mouseDragRef.current = null;
          return;
        }
        md.active = true;
        md.moved = true;
        clearSnapRestoreTimer();
        el.style.scrollSnapType = 'none';
        try {
          el.setPointerCapture?.(md.pointerId);
        } catch {
          // 兜底靠 document 监听。
        }
      }
      el.style.scrollSnapType = 'none';
      el.scrollLeft = md.startScrollLeft - dx;
    };
    const onUp = (e: PointerEvent) => {
      const md = mouseDragRef.current;
      if (md && e.pointerId !== md.pointerId) return;
      finishMouseDrag(e);
    };
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
    document.addEventListener('pointercancel', onUp, true);
    return () => {
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onUp, true);
      clearSnapRestoreTimer();
    };
  }, []);

  const totalPages = Math.max(1, layout.screens.length);
  const pageLabel = useMemo(() => getWorkspacePageLabel(currentPage, totalPages), [currentPage, totalPages]);

  useEffect(() => { _lastPage = currentPage; }, [currentPage]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || _lastPage <= 0) return;
    const target = clamp(_lastPage, 0, totalPages - 1);
    el.scrollLeft = target * el.clientWidth;
  }, []);

  const isDark = getWallpaperIsDark(layout.wallpaper);

  type MenuAnchor = { left: number; top: number; width: number; height: number };
  type MenuState =
    | null
    | { kind: 'icon'; itemId: string; anchor: MenuAnchor }
    | { kind: 'home' };

  const [menu, setMenu] = useState<MenuState>(null);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [folderNameEditing, setFolderNameEditing] = useState<{ folderId: string; draft: string; original: string } | null>(null);
  const folderNameInputRef = useRef<HTMLInputElement | null>(null);
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  const [wmrWidgets, setWmrWidgets] = useState<WmrWidgetMeta[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return APP_REGISTRY;
    return APP_REGISTRY.filter((m) => {
      const targets = [
        m.displayName,
        m.displayNameEn ?? '',
        m.id,
        ...(m.aliases ?? []),
      ];
      return targets.some((t) => t.toLowerCase().includes(q));
    });
  }, [searchQuery]);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
  }, []);

  // Register back handler so edge-swipe / bottom-swipe closes search
  useEffect(() => {
    if (!searchOpen) return;
    return BackDispatcher.register('launcher.search', () => {
      closeSearch();
      return true;
    }, 650);
  }, [searchOpen, closeSearch]);

  useEffect(() => {
    let cancelled = false;
    listWmrWidgets().then(w => { if (!cancelled) setWmrWidgets(w); });
    return () => { cancelled = true; };
  }, []);
  const [appInfoOpen, setAppInfoOpen] = useState<{ appId: AppId } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  type DragOver =
    | { container: 'workspace'; screenId: string; cellX: number; cellY: number }
    | { container: 'hotseat'; cellX: number }
    | { container: 'dropTarget'; target: 'remove' | 'info' };

  type DragState = {
    itemId: string;
    pointerId: number;
    origin: DragOver;
    over: DragOver | null;
    offsetX: number;
    offsetY: number;
    ghostW: number;
    ghostH: number;
    clientX: number;
    clientY: number;
    /** Dragging an app that isn't on the desktop yet (e.g. dragged out of a folder). */
    transientItem?: LauncherItem;
    transientSource?: { kind: 'folder'; folderId: string; appId: AppId };
  };

  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const ghostElRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef(layout);
  const currentPageRef = useRef(currentPage);
  const workspaceGridRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const onGridMount = useCallback((screenId: string, el: HTMLDivElement | null) => {
    workspaceGridRefs.current[screenId] = el;
  }, []);
  const hotseatRef = useRef<HTMLDivElement | null>(null);
  const autoFlipTimerRef = useRef<number | null>(null);
  const autoFlipDirRef = useRef<'left' | 'right' | null>(null);
  const [previewScreensById, setPreviewScreensById] = useState<Record<string, LauncherPlacement[]> | null>(null);
  const [previewHotseat, setPreviewHotseat] = useState<LauncherPlacement[] | null>(null);
  const lastPreviewKeyRef = useRef<string>('');
  const lastPreviewFolderIntentRef = useRef<boolean>(false);

  type FolderDragState = {
    folderId: string;
    appId: AppId;
    pointerId: number;
    offsetX: number;
    offsetY: number;
    ghostW: number;
    ghostH: number;
    clientX: number;
    clientY: number;
    anchorEl: HTMLElement;
  };
  const [folderDrag, setFolderDrag] = useState<FolderDragState | null>(null);
  const folderDragRef = useRef<FolderDragState | null>(null);
  const folderGhostElRef = useRef<HTMLDivElement>(null);
  const [folderPreviewItems, setFolderPreviewItems] = useState<AppId[] | null>(null);
  const folderPreviewItemsRef = useRef<AppId[] | null>(null);
  const folderPanelRef = useRef<HTMLDivElement | null>(null);
  const folderGridRef = useRef<HTMLDivElement | null>(null);
  const lastFolderOverIndexRef = useRef<number>(-1);

  // In Chrome DevTools device emulation, a "long press" often triggers a browser context menu.
  // Block it inside the launcher so users can test long-press interactions.
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (!target.closest?.('[data-launcher="true"]')) return;
      if (target.closest?.('input, textarea, [contenteditable="true"]')) return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('contextmenu', onContextMenu, true);
    return () => document.removeEventListener('contextmenu', onContextMenu, true);
  }, []);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);
  useEffect(() => {
    folderDragRef.current = folderDrag;
  }, [folderDrag]);
  useEffect(() => {
    folderPreviewItemsRef.current = folderPreviewItems;
  }, [folderPreviewItems]);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    // Reset folder edit/preview state when closing or switching folders
    setFolderNameEditing(null);
    setFolderPreviewItems(null);
    folderPreviewItemsRef.current = null;
    lastFolderOverIndexRef.current = -1;
    setFolderDrag(null);
    folderDragRef.current = null;
  }, [openFolderId]);

  useEffect(() => {
    return () => {
      if (pagingTimerRef.current) {
        window.clearTimeout(pagingTimerRef.current);
        pagingTimerRef.current = null;
      }
    };
  }, []);

  const bgTimerRef = useRef<number | null>(null);
  const bgStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const clearBgTimer = useCallback(() => {
    if (bgTimerRef.current) {
      window.clearTimeout(bgTimerRef.current);
      bgTimerRef.current = null;
    }
  }, []);

  const showIconMenu = useCallback((itemId: string, anchorEl: HTMLElement) => {
    mouseDragRef.current = null;
    const r = anchorEl.getBoundingClientRect();
    setMenu({
      kind: 'icon',
      itemId,
      anchor: { left: r.left, top: r.top, width: r.width, height: r.height },
    });
  }, []);

  const removeItemFromDesktop = (itemId: string) => {
    setLayout(prev => {
      const item = prev.items[itemId];
      if (!item) return prev;

      const screens = prev.screens.map(s => ({
        ...s,
        placements: s.placements.filter(p => p.itemId !== itemId),
      }));
      const hotseat = prev.hotseat.filter(p => p.itemId !== itemId);

      const items = { ...prev.items };
      delete items[itemId];

      let hiddenApps = prev.hiddenApps ?? [];
      let folders = prev.folders ?? {};

      // Important: removing a folder should not orphan its contained apps.
      // We disband the folder: delete folder record; apps will be reconciled back onto desktop.
      if (item.kind === 'folder') {
        const folderId = item.folderId;
        const contained = folders[folderId]?.items ?? [];
        const nextFolders = { ...folders };
        delete nextFolders[folderId];
        folders = nextFolders;
        // Ensure contained apps are not forced-hidden.
        if (contained.length > 0) {
          const containedSet = new Set(contained);
          hiddenApps = hiddenApps.filter(id => !containedSet.has(id));
        }
      }

      if (item.kind === 'app') {
        const stillPresentOnDesktop = Object.values(items).some(i => i.kind === 'app' && i.appId === item.appId);
        const stillPresentInFolder = Object.values(prev.folders ?? {}).some(f => (f.items ?? []).includes(item.appId));
        const stillPresent = stillPresentOnDesktop || stillPresentInFolder;
        if (!stillPresent) hiddenApps = Array.from(new Set([...hiddenApps, item.appId]));
      }

      return { ...prev, screens, hotseat, items, hiddenApps, folders };
    });
    setMenu(null);
  };

  const setDefaultWallpaper = (wallpaper: LauncherWallpaper) => {
    setWallpaper(wallpaper);
    setMenu(null);
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Show page dots while swiping between screens (MIUI-like behavior).
    if (pagingTimerRef.current) {
      window.clearTimeout(pagingTimerRef.current);
      pagingTimerRef.current = null;
    }
    if (!isPaging) setIsPaging(true);
    pagingTimerRef.current = window.setTimeout(() => {
      pagingTimerRef.current = null;
      setIsPaging(false);
    }, 650);

    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const pageWidth = container.clientWidth;
    if (!pageWidth) return;
    const newPage = Math.round(scrollLeft / pageWidth);
    if (newPage !== currentPage) setCurrentPage(clamp(newPage, 0, totalPages - 1));
  };

  // (drag mode doesn't allow switching pages yet; keep scroll logic via swipe)

  const draggingItemId = drag?.itemId ?? null;
  const workspaceHighlight = useMemo(() =>
    drag?.over && drag.over.container === 'workspace'
      ? { screenId: drag.over.screenId, cellX: drag.over.cellX, cellY: drag.over.cellY }
      : null,
    [drag]);
  const hotseatHighlightCellX =
    drag?.over && drag.over.container === 'hotseat'
      ? drag.over.cellX
      : null;
  const dropTargetOver =
    drag?.over && drag.over.container === 'dropTarget'
      ? drag.over.target
      : null;

  const startDrag = useCallback((args: {
    itemId: string;
    placement: LauncherPlacement;
    container: 'workspace' | 'hotseat';
    screenId?: string;
    anchorEl: HTMLElement;
    pointerId: number;
    clientX: number;
    clientY: number;
  }) => {
    const item = layoutRef.current.items[args.itemId];
    if (!item || item.kind === 'widget') return;
    if (args.placement.spanX !== 1 || args.placement.spanY !== 1) return;

    mouseDragRef.current = null;
    clearBgTimer();
    setMenu(null);
    setOpenFolderId(null);
    setPreviewScreensById(null);
    setPreviewHotseat(null);
    lastPreviewKeyRef.current = '';
    lastPreviewFolderIntentRef.current = false;

    const rect = args.anchorEl.getBoundingClientRect();
    const origin: DragOver = args.container === 'workspace'
      ? {
        container: 'workspace',
        screenId: args.screenId ?? layoutRef.current.screens[currentPageRef.current]?.id ?? 'screen_1',
        cellX: args.placement.cellX,
        cellY: args.placement.cellY,
      }
      : {
        container: 'hotseat',
        cellX: args.placement.cellX,
      };

    const d: DragState = {
      itemId: args.itemId,
      pointerId: args.pointerId,
      origin,
      over: origin,
      offsetX: args.clientX - rect.left,
      offsetY: args.clientY - rect.top,
      ghostW: rect.width,
      ghostH: rect.height,
      clientX: args.clientX,
      clientY: args.clientY,
    };

    dragRef.current = d;
    setDrag(d);
  }, [clearBgTimer]);

  const startDragFromFolderApp = (args: {
    folderId: string;
    appId: AppId;
    anchorEl: HTMLElement;
    pointerId: number;
    clientX: number;
    clientY: number;
  }) => {
    const tempItemId = makeId(`folder_app_${args.appId}`);
    const transientItem: LauncherItem = { id: tempItemId, kind: 'app', appId: args.appId };

    clearBgTimer();
    setMenu(null);
    setOpenFolderId(null);
    setPreviewScreensById(null);
    setPreviewHotseat(null);
    lastPreviewKeyRef.current = '';
    lastPreviewFolderIntentRef.current = false;

    const rect = args.anchorEl.getBoundingClientRect();
    const screenId = layoutRef.current.screens[currentPageRef.current]?.id ?? 'screen_1';
    const origin: DragOver = { container: 'workspace', screenId, cellX: -1, cellY: -1 };
    const over = computeDragOver(args.clientX, args.clientY);

    const d: DragState = {
      itemId: tempItemId,
      pointerId: args.pointerId,
      origin,
      over,
      offsetX: args.clientX - rect.left,
      offsetY: args.clientY - rect.top,
      ghostW: rect.width,
      ghostH: rect.height,
      clientX: args.clientX,
      clientY: args.clientY,
      transientItem,
      transientSource: { kind: 'folder', folderId: args.folderId, appId: args.appId },
    };

    dragRef.current = d;
    setDrag(d);
  };

  const computeDragOver = (clientX: number, clientY: number): DragOver | null => {
    // Drag drop-target bar (e.g. remove/info) should take priority.
    const hit = (typeof document !== 'undefined' ? document.elementFromPoint(clientX, clientY) : null) as HTMLElement | null;
    const dropEl = hit?.closest?.('[data-drop-target]') as HTMLElement | null;
    const target = dropEl?.getAttribute('data-drop-target');
    if (target === 'remove' || target === 'info') {
      return { container: 'dropTarget', target };
    }

    const l = layoutRef.current;
    const screen = l.screens[currentPageRef.current];
    if (screen) {
      const gridEl = workspaceGridRefs.current[screen.id];
      if (gridEl) {
        const r = gridEl.getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
          const relX = clientX - r.left;
          const relY = clientY - r.top;
          const cellW = r.width / l.grid.columns;
          const cellH = r.height / l.grid.rows;
          const cellX = clamp(Math.floor(relX / cellW), 0, l.grid.columns - 1);
          const cellY = clamp(Math.floor(relY / cellH), 0, l.grid.rows - 1);
          return { container: 'workspace', screenId: screen.id, cellX, cellY };
        }
      }
    }

    const hotseatEl = hotseatRef.current;
    if (hotseatEl) {
      const r = hotseatEl.getBoundingClientRect();
      if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
        const relX = clientX - r.left;
        const slotW = r.width / HOTSEAT_SLOTS;
        const cellX = clamp(Math.floor(relX / slotW), 0, HOTSEAT_SLOTS - 1);
        return { container: 'hotseat', cellX };
      }
    }

    return null;
  };

  const computeFolderIntentInWorkspace = (args: {
    screenId: string;
    cellX: number;
    cellY: number;
    clientX: number;
    clientY: number;
    draggedItemId: string;
    layoutLike: LauncherLayout;
  }): { hit: LauncherPlacement; hitItem: LauncherItem } | null => {
    const { screenId, cellX, cellY, clientX, clientY, draggedItemId, layoutLike } = args;
    const gridEl = workspaceGridRefs.current[screenId];
    if (!gridEl) return null;

    const screen = layoutLike.screens.find(s => s.id === screenId);
    if (!screen) return null;

    const hit = screen.placements.find(p => p.itemId !== draggedItemId && isCellInsidePlacement(cellX, cellY, p));
    if (!hit) return null;
    const hitItem = layoutLike.items[hit.itemId];
    if (!hitItem) return null;
    if (hitItem.kind === 'widget' || hit.spanX !== 1 || hit.spanY !== 1) return null;
    if (hitItem.kind !== 'app' && hitItem.kind !== 'folder') return null;

    const r = gridEl.getBoundingClientRect();
    const cellW = r.width / layoutLike.grid.columns;
    const cellH = r.height / layoutLike.grid.rows;
    const centerX = r.left + (cellX + 0.5) * cellW;
    const centerY = r.top + (cellY + 0.5) * cellH;
    const dist = Math.hypot(clientX - centerX, clientY - centerY);
    const radius = Math.min(appIconSize * 0.55, Math.min(cellW, cellH) * 0.35);
    if (dist <= radius) return { hit, hitItem };
    return null;
  };

  const applyDrop = (prev: LauncherLayout, d: DragState): LauncherLayout => {
    const draggedFromLayout = prev.items[d.itemId];
    const dragged = draggedFromLayout ?? d.transientItem;
    if (!dragged || dragged.kind === 'widget') return prev;
    if (!d.over) return prev;

    const base: LauncherLayout =
      draggedFromLayout || !d.transientItem
        ? prev
        : { ...prev, items: { ...prev.items, [d.itemId]: d.transientItem } };

    const sourceFolder = d.transientSource?.kind === 'folder' ? d.transientSource : null;
    const finalize = (next: LauncherLayout, moved: boolean) => {
      if (!sourceFolder || !moved) return next;
      return removeAppFromFolderAndMaybeDissolve(next, sourceFolder.folderId, sourceFolder.appId);
    };

    const over = d.over;

    if (over.container === 'dropTarget') {
      if (over.target !== 'remove') return prev;

      // Remove action:
      // - transient (dragged from folder): delete from folder only
      // - normal: remove from desktop/hotseat and optionally mark as hidden
      if (sourceFolder && !draggedFromLayout) {
        return removeAppFromFolderAndMaybeDissolve(prev, sourceFolder.folderId, sourceFolder.appId);
      }
      if (!draggedFromLayout) return prev;

      const stripped = removePlacementEverywhere(prev, d.itemId);
      const items = { ...prev.items };
      delete items[d.itemId];

      let folders = prev.folders ?? {};
      let hiddenApps = prev.hiddenApps ?? [];

      if (draggedFromLayout.kind === 'folder') {
        const folderId = draggedFromLayout.folderId;
        const contained = folders[folderId]?.items ?? [];
        const nextFolders = { ...folders };
        delete nextFolders[folderId];
        folders = nextFolders;
        if (contained.length > 0) {
          const containedSet = new Set(contained);
          hiddenApps = hiddenApps.filter(id => !containedSet.has(id));
        }
      } else if (draggedFromLayout.kind === 'app') {
        const stillPresentOnDesktop = Object.values(items).some(i => i.kind === 'app' && i.appId === draggedFromLayout.appId);
        const stillPresentInFolder = Object.values(folders).some(f => (f.items ?? []).includes(draggedFromLayout.appId));
        const stillPresent = stillPresentOnDesktop || stillPresentInFolder;
        if (!stillPresent) hiddenApps = Array.from(new Set([...hiddenApps, draggedFromLayout.appId]));
      }

      return { ...prev, ...stripped, items, folders, hiddenApps };
    }

    if (over.container === 'workspace') {
      const originCell = (d.origin.container === 'workspace' && d.origin.screenId === over.screenId)
        ? { cellX: d.origin.cellX, cellY: d.origin.cellY }
        : null;

      const folderIntent = computeFolderIntentInWorkspace({
        screenId: over.screenId,
        cellX: over.cellX,
        cellY: over.cellY,
        clientX: d.clientX,
        clientY: d.clientY,
        draggedItemId: d.itemId,
        layoutLike: base,
      });

      if (folderIntent) {
        const { hit, hitItem } = folderIntent;
        if (dragged.kind === 'app' && hitItem.kind === 'app') {
          const next = createFolderFromTwoApps(base, d.itemId, hit.itemId, { screenId: over.screenId, cellX: hit.cellX, cellY: hit.cellY });
          return finalize(next, next !== base);
        }
        if (dragged.kind === 'app' && hitItem.kind === 'folder') {
          const next = addAppItemToFolder(base, d.itemId, hit.itemId);
          return finalize(next, next !== base);
        }
        return prev;
      }

      const stripped = removePlacementEverywhere(base, d.itemId);
      const targetScreen = stripped.screens.find(s => s.id === over.screenId);
      if (!targetScreen) return prev;

      const placements = computeWorkspacePlacementsAfterInsert({
        grid: base.grid,
        screenId: over.screenId,
        placements: targetScreen.placements,
        items: base.items,
        draggedItemId: d.itemId,
        targetCellX: over.cellX,
        targetCellY: over.cellY,
        originCell,
      });

      if (!placements) {
        // No empty cell (or blocked). Fallback to swap with 1x1 icon when possible.
        const hit = targetScreen.placements.find(p => isCellInsidePlacement(over.cellX, over.cellY, p));
        if (!hit) return prev;
        const hitItem = base.items[hit.itemId];
        if (!hitItem || hitItem.kind === 'widget' || hit.spanX !== 1 || hit.spanY !== 1) return prev;
        if (!originCell) return prev;

        const screens: LauncherScreen[] = stripped.screens.map(s => {
          if (s.id !== over.screenId) return s;
          const next = s.placements.map(p => p.itemId === hit.itemId
            ? { ...p, cellX: originCell.cellX, cellY: originCell.cellY }
            : p
          );
          return {
            ...s,
            placements: [
              ...next,
              { itemId: d.itemId, container: 'workspace' as const, screenId: s.id, cellX: hit.cellX, cellY: hit.cellY, spanX: 1, spanY: 1 },
            ],
          };
        });
        const hiddenApps = dragged.kind === 'app'
          ? (base.hiddenApps ?? []).filter(id => id !== dragged.appId)
          : (base.hiddenApps ?? []);
        return finalize({ ...base, screens, hotseat: stripped.hotseat, hiddenApps }, true);
      }

      const screens: LauncherScreen[] = stripped.screens.map(s => s.id === over.screenId ? { ...s, placements } : s);
      const hiddenApps = dragged.kind === 'app'
        ? (base.hiddenApps ?? []).filter(id => id !== dragged.appId)
        : (base.hiddenApps ?? []);
      return finalize({ ...base, screens, hotseat: stripped.hotseat, hiddenApps }, true);
    }

    // hotseat
    // NOTE: Hotseat currently only supports app icons (matches our UI rendering).
    if (dragged.kind !== 'app') return prev;

    const slot = clamp(over.cellX, 0, HOTSEAT_SLOTS - 1);
    const originSlot = d.origin.container === 'hotseat' ? d.origin.cellX : null;

    const stripped = removePlacementEverywhere(base, d.itemId);
    const hiddenApps = (base.hiddenApps ?? []).filter(id => id !== dragged.appId);

    // Prefer "push" reordering whenever there is an empty slot (including origin slot when dragging inside hotseat).
    const pushed = computeHotseatPlacementsAfterInsert({
      placements: base.hotseat,
      items: base.items,
      draggedItemId: d.itemId,
      targetSlot: slot,
      originSlot,
    });
    if (pushed) {
      return finalize({ ...base, screens: stripped.screens, hotseat: pushed, hiddenApps }, true);
    }

    // Hotseat is full (no space to push into).
    // Only allow swap when we have a valid origin cell on workspace.
    const originScreenId = (d.origin as any).screenId;
    const originCellX = Number((d.origin as any).cellX);
    const originCellY = Number((d.origin as any).cellY);
    const originCanReceive =
      d.origin.container === 'workspace' &&
      typeof originScreenId === 'string' &&
      Number.isFinite(originCellX) &&
      Number.isFinite(originCellY) &&
      originCellX >= 0 &&
      originCellY >= 0;

    if (!originCanReceive) return prev;

    const occupant = base.hotseat.find(p => p.cellX === slot && p.itemId !== d.itemId) ?? null;
    if (!occupant) return prev;

    const hotseat: LauncherPlacement[] = [
      ...stripped.hotseat.filter(p => p.itemId !== occupant.itemId),
      { itemId: d.itemId, container: 'hotseat', cellX: slot, cellY: 0, spanX: 1, spanY: 1 },
    ];

    const screens = stripped.screens.map(s => {
      if (s.id !== originScreenId) return s;
      return {
        ...s,
        placements: [
          ...s.placements,
          { itemId: occupant.itemId, container: 'workspace' as const, screenId: s.id, cellX: originCellX, cellY: originCellY, spanX: 1, spanY: 1 },
        ],
      };
    });

    return finalize({ ...base, screens, hotseat, hiddenApps }, true);
  };

  useEffect(() => {
    const clearAutoFlip = () => {
      if (autoFlipTimerRef.current) {
        window.clearTimeout(autoFlipTimerRef.current);
        autoFlipTimerRef.current = null;
      }
      autoFlipDirRef.current = null;
    };

    const maybeScheduleAutoFlip = (clientX: number, clientY: number) => {
      const container = scrollContainerRef.current;
      const total = Math.max(1, layoutRef.current.screens.length);
      if (!container || total <= 1) {
        clearAutoFlip();
        return;
      }

      const r = container.getBoundingClientRect();
      if (clientY < r.top || clientY > r.bottom) {
        clearAutoFlip();
        return;
      }

      const EDGE_PX = 28;
      const dir: 'left' | 'right' | null =
        clientX <= r.left + EDGE_PX
          ? 'left'
          : clientX >= r.right - EDGE_PX
            ? 'right'
            : null;

      if (!dir) {
        clearAutoFlip();
        return;
      }

      // Already scheduled same direction
      if (autoFlipTimerRef.current && autoFlipDirRef.current === dir) return;

      clearAutoFlip();
      autoFlipDirRef.current = dir;
      autoFlipTimerRef.current = window.setTimeout(() => {
        autoFlipTimerRef.current = null;
        const cur = currentPageRef.current;
        const next = clamp(cur + (dir === 'right' ? 1 : -1), 0, total - 1);
        if (next === cur) return;

        // Keep ref in sync even before React state flush.
        currentPageRef.current = next;

        const pageW = container.clientWidth || window.innerWidth || 360;
        container.scrollTo({ left: next * pageW, behavior: 'smooth' });
        setCurrentPage(next);

        // Recompute drop target for the new page even if the pointer is stationary.
        requestAnimationFrame(() => {
          const d = dragRef.current;
          if (!d) return;
          const over = computeDragOver(d.clientX, d.clientY);
          updatePreview(over, d.clientX, d.clientY);
          setDrag(prev => {
            if (!prev) return prev;
            const updated = { ...prev, over };
            dragRef.current = updated;
            return updated;
          });

          // If still at the edge, keep auto-flipping across multiple pages.
          maybeScheduleAutoFlip(d.clientX, d.clientY);
        });
      }, 380);
    };

    const updatePreview = (over: DragOver | null, clientX: number, clientY: number) => {
      // Compute preview reordering (MIUI-like "push" behavior)
      const d0 = dragRef.current;
      const key =
        !over ? 'none' :
          over.container === 'workspace'
            ? `w:${over.screenId}:${over.cellX},${over.cellY}`
            : over.container === 'hotseat'
              ? `h:${over.cellX}`
              : `d:${over.target}`;

      const base = layoutRef.current;
      const folderIntentActive = !!(
        over &&
        d0 &&
        over.container === 'workspace' &&
        computeFolderIntentInWorkspace({
          screenId: over.screenId,
          cellX: over.cellX,
          cellY: over.cellY,
          clientX,
          clientY,
          draggedItemId: d0.itemId,
          layoutLike: base,
        })
      );

      const shouldUpdatePreview =
        key !== lastPreviewKeyRef.current ||
        (over?.container === 'workspace' && folderIntentActive !== lastPreviewFolderIntentRef.current);

      if (!shouldUpdatePreview) return;

      lastPreviewKeyRef.current = key;
      if (over?.container === 'workspace') lastPreviewFolderIntentRef.current = folderIntentActive;

      if (!over) {
        setPreviewScreensById(null);
        setPreviewHotseat(null);
        return;
      }

      if (over.container === 'workspace') {
        setPreviewHotseat(null);
        const screen = base.screens.find(s => s.id === over.screenId);
        if (!screen || !d0) {
          setPreviewScreensById(null);
          return;
        }

        const originCell = (d0.origin.container === 'workspace' && d0.origin.screenId === over.screenId)
          ? { cellX: d0.origin.cellX, cellY: d0.origin.cellY }
          : null;

        if (folderIntentActive) {
          // Keep base placements to allow folder drop.
          setPreviewScreensById(null);
          return;
        }

        const previewPlacements = computeWorkspacePlacementsAfterInsert({
          grid: base.grid,
          screenId: over.screenId,
          placements: screen.placements,
          items: base.items,
          draggedItemId: d0.itemId,
          targetCellX: over.cellX,
          targetCellY: over.cellY,
          originCell,
        });
        setPreviewScreensById(previewPlacements ? { [over.screenId]: previewPlacements } : null);
        return;
      }

      if (over.container === 'hotseat') {
        // hotseat
        setPreviewScreensById(null);
        if (!d0) {
          setPreviewHotseat(null);
          return;
        }
        const originSlot = d0.origin.container === 'hotseat' ? d0.origin.cellX : null;
        const pushed = computeHotseatPlacementsAfterInsert({
          placements: base.hotseat,
          items: base.items,
          draggedItemId: d0.itemId,
          targetSlot: over.cellX,
          originSlot,
        });
        setPreviewHotseat(pushed);
        return;
      }

      // dropTarget (remove/info): clear previews
      setPreviewScreensById(null);
      setPreviewHotseat(null);
    };

    const serializeOver = (o: DragOver | null) =>
      !o ? '' : o.container === 'workspace'
        ? `ws:${o.screenId}:${o.cellX}:${o.cellY}`
        : o.container === 'hotseat' ? `hs:${o.cellX}` : `dt:${o.target}`;

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (e.pointerId !== d.pointerId) return;
      maybeScheduleAutoFlip(e.clientX, e.clientY);
      const over = computeDragOver(e.clientX, e.clientY);
      updatePreview(over, e.clientX, e.clientY);

      const prevOverKey = serializeOver(d.over);
      dragRef.current = { ...d, clientX: e.clientX, clientY: e.clientY, over };

      const el = ghostElRef.current;
      if (el) {
        el.style.left = `${e.clientX - d.offsetX}px`;
        el.style.top = `${e.clientY - d.offsetY}px`;
      }

      if (serializeOver(over) !== prevOverKey) {
        setDrag(prev => prev ? { ...prev, over } : prev);
      }
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (e.pointerId !== d.pointerId) return;
      clearAutoFlip();
      setPreviewScreensById(null);
      setPreviewHotseat(null);
      lastPreviewKeyRef.current = '';
      lastPreviewFolderIntentRef.current = false;
      dragRef.current = null;
      setDrag(null);
      if (!d.over) return;
      if (d.over.container === 'dropTarget' && d.over.target === 'info') {
        const item = layoutRef.current.items[d.itemId] ?? d.transientItem;
        if (item?.kind === 'app') {
          openAppInfo(item.appId);
        }
        return;
      }
      setLayout(prev => applyDrop(prev, d));
    };

    const onBlur = () => {
      // If the window loses focus mid-drag, end the drag to avoid a stuck ghost.
      const d = dragRef.current;
      if (!d) return;
      clearAutoFlip();
      setPreviewScreensById(null);
      setPreviewHotseat(null);
      lastPreviewKeyRef.current = '';
      lastPreviewFolderIntentRef.current = false;
      dragRef.current = null;
      setDrag(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      clearAutoFlip();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const openFolder = useCallback((folderId: string) => {
    setOpenFolderId(folderId);
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    toastTimerRef.current = window.setTimeout(() => {
      toastTimerRef.current = null;
      setToast(null);
    }, 1600);
  };

  const addWidgetToCurrentScreen = (
    widgetType: 'clock' | 'weather',
  ) => {
    const span = widgetType === 'clock' ? { spanX: 4, spanY: 2 } : { spanX: 2, spanY: 2 };
    placeWidgetItem({ id: makeId(`widget_${widgetType}`), kind: 'widget', widgetType }, span);
  };

  const addWmrWidgetToCurrentScreen = (
    widgetId: string,
    variant: string,
    spanX: number,
    spanY: number,
    previewUrl: string,
    xmlBaseUrl?: string,
  ) => {
    placeWidgetItem(
      { id: makeId('widget_wmr'), kind: 'widget', widgetType: 'wmr', widgetId, variant, previewUrl, xmlBaseUrl },
      { spanX, spanY },
    );
  };

  const placeWidgetItem = (
    item: LauncherItem,
    span: { spanX: number; spanY: number },
  ) => {
    const current = layoutRef.current;
    const currentScreen = current.screens[currentPageRef.current];
    if (!currentScreen) return;
    setLayout(prev => {
      const screen = prev.screens[currentPageRef.current];
      if (!screen) return prev;
      const pos = findFirstVacantRect(prev.grid, screen.placements, span.spanX, span.spanY);
      if (!pos) return prev;
      const items: Record<string, LauncherItem> = {
        ...prev.items,
        [item.id]: item,
      };
      const screens = prev.screens.map(s => {
        if (s.id !== screen.id) return s;
        return {
          ...s,
          placements: [
            ...s.placements,
            {
              itemId: item.id,
              container: 'workspace' as const,
              screenId: s.id,
              cellX: pos.cellX,
              cellY: pos.cellY,
              spanX: span.spanX,
              spanY: span.spanY,
            },
          ],
        };
      });
      return { ...prev, items, screens };
    });

    const pos = findFirstVacantRect(current.grid, currentScreen.placements, span.spanX, span.spanY);
    if (!pos) showToast(locale === 'en' ? 'Not enough space on this page for the widget' : '当前页面没有足够空间放置小部件');
  };

  const openAppInfo = (appId: AppId) => {
    setAppInfoOpen({ appId });
  };

  const commitFolderName = (folderId: string, name: string) => {
    setLayout(prev => renameLauncherFolder(prev, folderId, name));
  };

  const cancelFolderNameEdit = (folderId: string, originalName: string) => {
    setLayout(prev => renameLauncherFolder(prev, folderId, originalName));
    setFolderNameEditing(null);
  };

  const startFolderReorderDrag = (args: {
    folderId: string;
    appId: AppId;
    anchorEl: HTMLElement;
    pointerId: number;
    clientX: number;
    clientY: number;
  }) => {
    if (dragRef.current) return; // already dragging on desktop
    const folder = layoutRef.current.folders?.[args.folderId];
    if (!folder) return;
    if (!folder.items.includes(args.appId)) return;

    const rect = args.anchorEl.getBoundingClientRect();
    const fd: FolderDragState = {
      folderId: args.folderId,
      appId: args.appId,
      pointerId: args.pointerId,
      offsetX: args.clientX - rect.left,
      offsetY: args.clientY - rect.top,
      ghostW: rect.width,
      ghostH: rect.height,
      clientX: args.clientX,
      clientY: args.clientY,
      anchorEl: args.anchorEl,
    };

    // Initialize preview with current order.
    setFolderPreviewItems(folder.items.slice());
    folderPreviewItemsRef.current = folder.items.slice();
    lastFolderOverIndexRef.current = folder.items.indexOf(args.appId);

    setMenu(null);
    setFolderNameEditing(null);
    folderDragRef.current = fd;
    setFolderDrag(fd);
  };

  const computeFolderOverIndex = (clientX: number, clientY: number, itemsLen: number): number | null => {
    const hit = (typeof document !== 'undefined' ? document.elementFromPoint(clientX, clientY) : null) as HTMLElement | null;
    const hitItem = hit?.closest?.('[data-folder-item-index]') as HTMLElement | null;
    if (hitItem) {
      const raw = hitItem.getAttribute('data-folder-item-index');
      const idx = raw ? Number(raw) : NaN;
      if (Number.isFinite(idx)) return clamp(idx, 0, Math.max(0, itemsLen - 1));
    }

    const grid = folderGridRef.current;
    if (!grid) return null;
    const r = grid.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;

    const cols = 4;
    const relX = clamp(clientX - r.left, 0, r.width - 1);
    const relY = clamp(clientY - r.top, 0, r.height - 1);
    const cellW = r.width / cols;
    const col = clamp(Math.floor(relX / cellW), 0, cols - 1);
    const row = Math.max(0, Math.floor(relY / cellW));
    const idx = row * cols + col;
    return clamp(idx, 0, Math.max(0, itemsLen - 1));
  };

  useEffect(() => {
    const reorder = <T,>(arr: T[], from: number, to: number): T[] => {
      const next = arr.slice();
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    };

    const clearFolderDrag = () => {
      setFolderDrag(null);
      folderDragRef.current = null;
      setFolderPreviewItems(null);
      folderPreviewItemsRef.current = null;
      lastFolderOverIndexRef.current = -1;
    };

    const onMove = (e: PointerEvent) => {
      const fd = folderDragRef.current;
      if (!fd) return;
      if (e.pointerId !== fd.pointerId) return;

      const panel = folderPanelRef.current;
      if (panel) {
        const r = panel.getBoundingClientRect();
        const margin = 8;
        const outside =
          e.clientX < r.left - margin ||
          e.clientX > r.right + margin ||
          e.clientY < r.top - margin ||
          e.clientY > r.bottom + margin;
        if (outside) {
          // Transition: drag out of folder → close folder and start desktop drag.
          const folderId = fd.folderId;
          const appId = fd.appId;
          const anchorEl = fd.anchorEl;
          const pointerId = fd.pointerId;
          clearFolderDrag();
          startDragFromFolderApp({ folderId, appId, anchorEl, pointerId, clientX: e.clientX, clientY: e.clientY });
          return;
        }
      }

      const fd0 = folderDragRef.current!;
      folderDragRef.current = { ...fd0, clientX: e.clientX, clientY: e.clientY };

      const fel = folderGhostElRef.current;
      if (fel) {
        fel.style.left = `${e.clientX - fd0.offsetX}px`;
        fel.style.top = `${e.clientY - fd0.offsetY}px`;
      }

      const items = folderPreviewItemsRef.current;
      if (!items || items.length === 0) return;
      const overIdx = computeFolderOverIndex(e.clientX, e.clientY, items.length);
      if (overIdx == null) return;
      if (overIdx === lastFolderOverIndexRef.current) return;

      const fromIdx = items.indexOf(fd.appId);
      if (fromIdx < 0) return;
      const nextItems = reorder(items, fromIdx, overIdx);
      lastFolderOverIndexRef.current = overIdx;
      folderPreviewItemsRef.current = nextItems;
      setFolderPreviewItems(nextItems);
    };

    const onUp = (e: PointerEvent) => {
      const fd = folderDragRef.current;
      if (!fd) return;
      if (e.pointerId !== fd.pointerId) return;

      const nextItems = folderPreviewItemsRef.current;
      const folderId = fd.folderId;
      clearFolderDrag();
      if (!nextItems) return;
      setLayout(prev => {
        const folder = prev.folders?.[folderId];
        if (!folder) return prev;
        // Ensure only existing appIds remain.
        const filtered = nextItems.filter(id => folder.items.includes(id));
        if (filtered.length !== folder.items.length) {
          // If apps changed due to external ops, fallback to current order.
          return prev;
        }
        return {
          ...prev,
          folders: {
            ...prev.folders,
            [folderId]: { ...folder, id: folderId, items: filtered },
          },
        };
      });
    };

    const onBlur = () => {
      const fd = folderDragRef.current;
      if (!fd) return;
      clearFolderDrag();
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onBlur);
    };

  }, []);

  return (
    <div
      className="h-full w-full relative overflow-hidden"
      data-launcher="true"
      data-status-bar-foreground={isDark ? 'light' : 'dark'}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Wallpaper */}
      <div className="absolute inset-0" style={wallpaperStyle(layout.wallpaper)} />
      {/* Scrims for readability (status bar + hotseat) */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/5 to-black/40" />

      {/* Toast */}
      {toast ? (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-[120] px-4 py-2 rounded-full bg-black/55 text-white text-xs font-medium shadow-lg border border-white/10"
          style={{ top: `${statusBarHeight + 56}px` }}
          role="status"
          aria-label="提示"
        >
          {toast}
        </div>
      ) : null}

      {/* Drag drop targets (MIUI-like) */}
      {drag ? (
        <div
          className="absolute left-0 right-0 z-[85] pointer-events-none"
          style={{ top: `${statusBarHeight + 10}px` }}
          aria-label="拖拽目标栏"
        >
          <div className="mx-auto w-full px-6 flex justify-center gap-3 pointer-events-auto">
            <div
              data-drop-target="remove"
              className={`h-10 px-5 rounded-full flex items-center justify-center text-sm font-semibold shadow-lg border ${
                dropTargetOver === 'remove'
                  ? 'bg-red-500/90 text-white border-red-400/40'
                  : 'bg-white/18 text-white border-white/15'
              }`}
            >
              移除
            </div>
            <div
              data-drop-target="info"
              className={`h-10 px-5 rounded-full flex items-center justify-center text-sm font-semibold shadow-lg border ${
                dropTargetOver === 'info'
                  ? 'bg-white/30 text-white border-white/20'
                  : 'bg-white/18 text-white/80 border-white/15'
              }`}
            >
              信息
            </div>
          </div>
        </div>
      ) : null}

      <div
        className="h-full w-full flex flex-col relative"
        style={{ paddingTop: `${statusBarHeight}px` }}
      >
        {/* Workspace */}
        <div className="flex-1 overflow-hidden">
          <div
            ref={scrollContainerRef}
            className={`h-full flex overflow-y-hidden no-scrollbar ${drag ? 'overflow-x-hidden' : 'overflow-x-auto'}`}
            style={{
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              touchAction: drag ? 'none' : 'pan-x',
            }}
            onScroll={handleScroll}
            onClickCapture={(e) => {
              if (suppressClickAfterDragRef.current) {
                suppressClickAfterDragRef.current = false;
                e.stopPropagation();
                e.preventDefault();
              }
            }}
            onPointerDownCapture={(e) => {
              suppressClickAfterDragRef.current = false;
              if (e.button === 0 && !drag) {
                if (shouldStartWorkspaceMouseDrag(e.pointerType)) {
                  mouseDragRef.current = {
                    pointerId: e.pointerId,
                    startX: e.clientX,
                    startY: e.clientY,
                    startScrollLeft: scrollContainerRef.current?.scrollLeft ?? 0,
                    active: false,
                    moved: false,
                  };
                }
              }
            }}
            onPointerDown={(e) => {
              const target = e.target as HTMLElement | null;
              if (target?.closest('button, [role="button"], [data-desktop-interactive="true"]')) return;
              if (typeof (e as any).button === 'number' && (e as any).button !== 0) return;
              bgStartPosRef.current = { x: e.clientX, y: e.clientY };
              clearBgTimer();
              bgTimerRef.current = window.setTimeout(() => {
                bgTimerRef.current = null;
                setMenu({ kind: 'home' });
              }, 520);
            }}
            onPointerMove={(e) => {
              if (mouseDragRef.current?.moved) clearBgTimer();
              if (!bgTimerRef.current || !bgStartPosRef.current) return;
              const dx = e.clientX - bgStartPosRef.current.x;
              const dy = e.clientY - bgStartPosRef.current.y;
              if (Math.hypot(dx, dy) > 12) clearBgTimer();
            }}
            onPointerUp={() => {
              clearBgTimer();
              bgStartPosRef.current = null;
            }}
            onPointerCancel={() => {
              clearBgTimer();
              bgStartPosRef.current = null;
            }}
            onPointerLeave={() => {
              clearBgTimer();
              bgStartPosRef.current = null;
            }}
          >
            {layout.screens.map((screen, screenIdx) => (
              <div
                key={screen.id}
                className="min-w-full w-full flex-shrink-0 py-6 px-4"
                style={{ scrollSnapAlign: 'start' }}
              >
                {/** Use preview placements while dragging (push reorder). */}
                {/** Note: preview is only for the current hovered screen. */}
                <WorkspaceGrid
                  grid={layout.grid}
                  active={screenIdx === currentPage}
                  shouldLoadWmr={Math.abs(screenIdx - currentPage) <= 1}
                  screen={screen}
                  previewPlacements={previewScreensById?.[screen.id] ?? null}
                  items={layout.items}
                  folders={layout.folders}
                  badgeCountByAppId={badgeCountByAppId}
                  iconSizePx={iconSizePx}
                  onLaunchApp={launchApp}
                  onOpenFolder={openFolder}
                  onLongPressItem={showIconMenu}
                  draggingItemId={draggingItemId}
                  dragHighlight={workspaceHighlight}
                  onGridMount={onGridMount}
                  onStartDrag={startDrag}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Search capsule (default) / Page dots (while dragging or paging) */}
        <div className="relative w-full px-6 pb-2" style={{ height: 64 }}>
          {(drag || isPaging) ? (
            <div
              className="absolute left-1/2 -translate-x-1/2 top-6 flex items-center gap-2"
              aria-label={pageLabel}
            >
              {Array.from({ length: totalPages }).map((_, idx) => {
                const active = idx === currentPage;
                return (
                  <div
                    key={idx}
                    className={`rounded-full transition-all ${active ? 'bg-white w-2.5 h-2.5' : 'bg-white/35 w-1.5 h-1.5'}`}
                  />
                );
              })}
            </div>
          ) : (
            <button
              type="button"
              aria-label={locale === 'en' ? 'Search' : '搜索'}
              className="absolute left-1/2 -translate-x-1/2 top-4 bg-black/25 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2 text-white/80 text-sm border border-white/10 active:scale-95 transition-transform"
              onClick={() => {
                setSearchOpen(true);
                setSearchQuery('');
                requestAnimationFrame(() => searchInputRef.current?.focus());
              }}
            >
              <Search size={16} />
              <span>{locale === 'en' ? 'Search' : '搜索'}</span>
            </button>
          )}
        </div>

        {/* Hotseat */}
        <HotseatBar
          placements={previewHotseat ?? layout.hotseat}
          items={layout.items}
          badgeCountByAppId={badgeCountByAppId}
          iconSizePx={iconSizePx}
          onLaunchApp={launchApp}
          onLongPressItem={showIconMenu}
          draggingItemId={draggingItemId}
          highlightCellX={hotseatHighlightCellX}
          containerRef={hotseatRef}
          onStartDrag={startDrag}
        />
      </div>

      {/* App search overlay */}
      {searchOpen ? (
        <div className="absolute inset-0 z-[101] flex flex-col" data-status-bar-foreground="dark">
          <button
            type="button"
            aria-label={locale === 'en' ? 'Close Search' : '关闭搜索'}
            className="absolute inset-0 bg-white/95 backdrop-blur-xl"
            onClick={closeSearch}
          />
          <div className="relative flex flex-col h-full" style={{ paddingTop: `${statusBarHeight}px` }}>
            {/* Search bar */}
            <div className="shrink-0 px-4 py-3 flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5">
                <Search size={18} className="text-gray-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="search"
                  placeholder={locale === 'en' ? 'Search apps' : '搜索应用'}
                  className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder-gray-400"
                  value={searchQuery}
                  autoFocus
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="text-sm text-blue-500 font-medium shrink-0 active:opacity-60"
                onClick={closeSearch}
              >
                {locale === 'en' ? 'Cancel' : '取消'}
              </button>
            </div>
            {/* Results */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {searchResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center pt-20 text-gray-400 text-sm">
                  {locale === 'en' ? 'No apps found' : '未找到应用'}
                </div>
              ) : (
                <div className="flex flex-col">
                  {searchResults.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="flex items-center gap-3 px-2 py-2.5 rounded-xl active:bg-gray-100 transition-colors"
                      onClick={() => {
                        closeSearch();
                        launchApp(m.id);
                      }}
                    >
                      <AppIcon manifest={m} size={44} radius={appIconBorderRadius} showShadow={false} />
                      <div className="flex flex-col items-start min-w-0">
                        <span className="text-sm text-gray-900 font-medium truncate max-w-full">
                          {getLocalizedAppName(m.id)}
                        </span>
                        {m.displayNameEn && locale !== 'en' ? (
                          <span className="text-xs text-gray-400 truncate max-w-full">{m.displayNameEn}</span>
                        ) : m.displayName && locale === 'en' ? (
                          <span className="text-xs text-gray-400 truncate max-w-full">{m.displayName}</span>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Drag ghost — position updated via DOM in onMove for 60fps without React re-render */}
      {drag ? (() => {
        const item = layout.items[drag.itemId] ?? drag.transientItem;
        if (!item) return null;
        const d = dragRef.current ?? drag;
        const left = d.clientX - d.offsetX;
        const top = d.clientY - d.offsetY;

        const renderGhost = () => {
          if (item.kind === 'app') {
            const manifest = getAppManifest(item.appId);
            if (!manifest) return null;
            return (
              <div className="flex flex-col items-center gap-2">
                <div className="shadow-xl" style={{ borderRadius: appIconBorderRadius, overflow: 'hidden' }}>
                  <AppIcon manifest={manifest} size={iconSizePx} radius={appIconBorderRadius} showShadow={false} />
                </div>
                <span className="text-white text-xs font-medium tracking-wide drop-shadow-sm">
                  {getLocalizedAppName(item.appId)}
                </span>
              </div>
            );
          }

          if (item.kind === 'folder') {
            const folder = layout.folders[item.folderId];
            return (
              <FolderIcon
                folder={folder ?? { id: item.folderId, name: getDefaultFolderName(), items: [] }}
                size={iconSizePx}
                onClick={() => {}}
              />
            );
          }

          return null;
        };

        return (
          <div
            ref={ghostElRef}
            className="fixed z-[90] pointer-events-none"
            style={{ left, top, width: drag.ghostW, height: drag.ghostH }}
          >
            <div className="w-full h-full scale-[1.06] origin-top-left">
              {renderGhost()}
            </div>
          </div>
        );
      })() : null}

      {/* Folder drag ghost — position updated via DOM in onMove */}
      {folderDrag ? (() => {
        const manifest = getAppManifest(folderDrag.appId);
        const fd = folderDragRef.current ?? folderDrag;
        const left = fd.clientX - fd.offsetX;
        const top = fd.clientY - fd.offsetY;
        return (
          <div
            ref={folderGhostElRef}
            className="fixed z-[96] pointer-events-none"
            style={{ left, top, width: folderDrag.ghostW, height: folderDrag.ghostH }}
          >
            <div className="w-full h-full scale-[1.06] origin-top-left">
              <div className="flex flex-col items-center gap-2">
                {manifest ? (
                  <div className="shadow-xl" style={{ borderRadius: appIconBorderRadius, overflow: 'hidden' }}>
                    <AppIcon manifest={manifest} size={appIconSize} radius={appIconBorderRadius} showShadow={false} />
                  </div>
                ) : null}
                <span className="text-white text-xs font-medium tracking-wide drop-shadow-sm">
                  {getLocalizedAppName(folderDrag.appId)}
                </span>
              </div>
            </div>
          </div>
        );
      })() : null}

      {/* Folder overlay */}
      {openFolderId ? (() => {
        const folder = layout.folders[openFolderId];
        if (!folder) return null;
        const items = folderPreviewItems ?? folder.items;
        return (
          <div className="absolute inset-0 z-[95]">
            <button
              type="button"
              aria-label={locale === 'en' ? 'Close Folder' : '关闭文件夹'}
              className="absolute inset-0 bg-black/25 backdrop-blur-sm"
              onClick={() => setOpenFolderId(null)}
            />
            <div
              ref={folderPanelRef}
              className="absolute left-1/2 -translate-x-1/2 top-24 w-[320px] bg-white/12 backdrop-blur-md rounded-[26px] overflow-hidden border border-white/15 shadow-2xl"
            >
              <div className="px-6 py-4">
                {folderNameEditing?.folderId === folder.id ? (
                  <input
                    ref={folderNameInputRef}
                    value={folderNameEditing.draft}
                    className="w-full bg-white/10 border border-white/15 rounded-xl px-3 py-2 text-white text-base outline-none"
                    onChange={(e) => {
                      const draft = e.target.value;
                      setFolderNameEditing({
                        folderId: folder.id,
                        draft,
                        original: folderNameEditing.original,
                      });
                      commitFolderName(folder.id, draft);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        commitFolderName(folder.id, folderNameEditing.draft);
                        setFolderNameEditing(null);
                      } else if (e.key === 'Escape') {
                        cancelFolderNameEdit(folder.id, folderNameEditing.original);
                      }
                    }}
                    onBlur={() => {
                      commitFolderName(folder.id, folderNameEditing.draft);
                      setFolderNameEditing(null);
                    }}
                    autoFocus
                  />
                ) : (
                  <button
                    type="button"
                    className="text-white font-semibold text-lg text-left w-full active:opacity-80"
                    onClick={() => {
                      setFolderNameEditing({
                        folderId: folder.id,
                        draft: folder.name,
                        original: folder.name,
                      });
                      requestAnimationFrame(() => folderNameInputRef.current?.focus());
                    }}
                  >
                    {folder.name}
                  </button>
                )}
              </div>

              <div ref={folderGridRef} className="px-5 pb-5 grid grid-cols-4 gap-x-4 gap-y-5">
                {items.map((appId, idx) => {
                  const manifest = getAppManifest(appId);
                  if (!manifest) return null;
                  const isDragged = folderDrag?.folderId === folder.id && folderDrag.appId === appId;
                  return (
                    <div
                      key={appId}
                      data-folder-item-index={idx}
                      className={isDragged ? 'opacity-0 pointer-events-none' : ''}
                    >
                      <LauncherAppIcon
                        manifest={manifest}
                        badgeCount={badgeCountByAppId[appId] || 0}
                        size={iconSizePx}
                        onClick={() => {
                          setOpenFolderId(null);
                          launchApp(appId);
                        }}
                        onLongPressDrag={({ anchorEl, pointerId, clientX, clientY }) => {
                          startFolderReorderDrag({
                            folderId: folder.id,
                            appId,
                            anchorEl,
                            pointerId,
                            clientX,
                            clientY,
                          });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })() : null}

      {/* Widget picker */}
      {widgetPickerOpen ? (
        <div className="absolute inset-0 z-[102]">
          <button
            type="button"
            aria-label={locale === 'en' ? 'Close Widget Picker' : '关闭小部件选择器'}
            className="absolute inset-0 bg-black/25 backdrop-blur-sm"
            onClick={() => setWidgetPickerOpen(false)}
          />
          <div className="absolute left-1/2 -translate-x-1/2 bottom-28 w-[320px] max-h-[70%] bg-white/92 backdrop-blur-md rounded-[26px] overflow-hidden shadow-xl border border-white/30 flex flex-col">
            <div className="px-6 py-4 text-gray-900 font-semibold text-base shrink-0">{locale === 'en' ? 'Widgets' : '小部件'}</div>
            <div className="px-4 pb-4 flex flex-col gap-2 overflow-y-auto">
              <button
                type="button"
                className="w-full h-14 rounded-2xl bg-black/5 hover:bg-black/10 active:scale-[0.99] transition-transform px-4 flex items-center justify-between shrink-0"
                onClick={() => {
                  const l = layoutRef.current;
                  const s = l.screens[currentPageRef.current];
                  const canPlace = !!(s && findFirstVacantRect(l.grid, s.placements, 4, 2));
                  addWidgetToCurrentScreen('clock');
                  if (canPlace) setWidgetPickerOpen(false);
                }}
              >
                <div className="text-left">
                  <div className="text-gray-900 font-semibold">{locale === 'en' ? 'Clock' : '时钟'}</div>
                  <div className="text-gray-600 text-xs mt-0.5">4×2</div>
                </div>
                <div className="text-gray-500 text-xs">{locale === 'en' ? 'Add' : '添加'}</div>
              </button>

              <button
                type="button"
                className="w-full h-14 rounded-2xl bg-black/5 hover:bg-black/10 active:scale-[0.99] transition-transform px-4 flex items-center justify-between shrink-0"
                onClick={() => {
                  const l = layoutRef.current;
                  const s = l.screens[currentPageRef.current];
                  const canPlace = !!(s && findFirstVacantRect(l.grid, s.placements, 2, 2));
                  addWidgetToCurrentScreen('weather');
                  if (canPlace) setWidgetPickerOpen(false);
                }}
              >
                <div className="text-left">
                  <div className="text-gray-900 font-semibold">{locale === 'en' ? 'Weather' : '天气'}</div>
                  <div className="text-gray-600 text-xs mt-0.5">2×2</div>
                </div>
                <div className="text-gray-500 text-xs">{locale === 'en' ? 'Add' : '添加'}</div>
              </button>

              {wmrWidgets.map(w => w.variants.map(v => (
                <button
                  key={`${w.id}_${v.entry}`}
                  type="button"
                  className="w-full rounded-2xl bg-black/5 hover:bg-black/10 active:scale-[0.99] transition-transform overflow-hidden shrink-0"
                  onClick={() => {
                    const l = layoutRef.current;
                    const s = l.screens[currentPageRef.current];
                    const canPlace = !!(s && findFirstVacantRect(l.grid, s.placements, v.spanX, v.spanY));
                    addWmrWidgetToCurrentScreen(w.id, v.entry, v.spanX, v.spanY, getWidgetPreviewUrl(w.id, v), getWidgetXmlBaseUrl(w, v));
                    if (canPlace) setWidgetPickerOpen(false);
                  }}
                >
                  <img
                    src={getWidgetPreviewUrl(w.id, v)}
                    className="w-full object-cover"
                    style={{ aspectRatio: `${v.spanX} / ${v.spanY}` }}
                    alt={w.title}
                    loading="lazy"
                  />
                  <div className="px-4 py-2 flex items-center justify-between">
                    <div className="text-left">
                      <div className="text-gray-900 font-semibold text-sm">{w.title}</div>
                      <div className="text-gray-600 text-xs">{v.spanX}×{v.spanY}</div>
                    </div>
                    <div className="text-gray-500 text-xs">{locale === 'en' ? 'Add' : '添加'}</div>
                  </div>
                </button>
              )))}
            </div>
          </div>
        </div>
      ) : null}

      {/* App info sheet */}
      {appInfoOpen ? (() => {
        const manifest = getAppManifest(appInfoOpen.appId);
        return (
          <div className="absolute inset-0 z-[103]">
            <button
              type="button"
              aria-label={locale === 'en' ? 'Close App Info' : '关闭应用信息'}
              className="absolute inset-0 bg-black/25 backdrop-blur-sm"
              onClick={() => setAppInfoOpen(null)}
            />
            <div className="absolute left-1/2 -translate-x-1/2 bottom-24 w-[320px] bg-white/92 backdrop-blur-md rounded-[26px] overflow-hidden shadow-xl border border-white/30">
              <div className="px-6 py-4 text-gray-900 font-semibold text-base">
                {getLocalizedAppName(appInfoOpen.appId)}
              </div>
              <div className="px-6 pb-2 text-gray-600 text-xs">
                AppId：{appInfoOpen.appId}
              </div>
              <div className="px-4 pb-4 flex flex-col gap-2">
                <button
                  type="button"
                  className="w-full h-11 rounded-2xl bg-black/5 hover:bg-black/10 active:scale-[0.99] transition-transform text-gray-900 font-medium"
                  onClick={() => {
                    setAppInfoOpen(null);
                    launchApp(appInfoOpen.appId);
                  }}
                >
                  {locale === 'en' ? 'Open' : '打开'}
                </button>
                <button
                  type="button"
                  className="w-full h-11 rounded-2xl bg-black/5 hover:bg-black/10 active:scale-[0.99] transition-transform text-gray-700"
                  onClick={() => setAppInfoOpen(null)}
                >
                  {locale === 'en' ? 'Close' : '关闭'}
                </button>
              </div>
            </div>
          </div>
        );
      })() : null}

      {/* Menus */}
      {menu ? (
        <div className="absolute inset-0 z-[100]">
          <button
            type="button"
            aria-label={locale === 'en' ? 'Close Menu' : '关闭菜单'}
            className="absolute inset-0 bg-black/25 backdrop-blur-sm"
            onClick={() => setMenu(null)}
          />

          {menu.kind === 'home' ? (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-28 w-[280px] bg-white/90 backdrop-blur-md rounded-[22px] overflow-hidden shadow-xl border border-white/30">
              <div className="px-5 py-3 text-sm font-semibold text-gray-900">{locale === 'en' ? 'Home Settings' : '桌面设置'}</div>
              <div className="px-4 pb-3 flex flex-col gap-2">
                <div className="text-xs text-gray-600 px-1">{locale === 'en' ? 'Wallpaper' : '壁纸'}</div>
                <div className="flex gap-2">
                  {DEFAULT_WALLPAPER_CHOICES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="flex-1 h-10 rounded-xl bg-cover bg-center text-xs active:scale-95 transition-transform shadow-inner"
                      style={imageWallpaperStyle(item.wallpaper.imageUrl)}
                      onClick={() => setDefaultWallpaper(item.wallpaper)}
                    >
                      <span className={item.isDark ? 'text-white drop-shadow-sm' : 'text-gray-900'}>
                        {locale === 'en' ? item.labelEn : item.labelZh}
                      </span>
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="w-full h-11 rounded-xl bg-black/5 text-gray-900 text-sm font-medium active:scale-[0.99] transition-transform"
                  onClick={() => {
                    setWidgetPickerOpen(true);
                    setMenu(null);
                  }}
                >
                  {locale === 'en' ? 'Widgets' : '小部件'}
                </button>

                <button
                  type="button"
                  className="w-full h-11 rounded-xl bg-black/5 text-gray-900 text-sm font-medium active:scale-[0.99] transition-transform"
                  onClick={() => {
                    reset();
                    setMenu(null);
                  }}
                >
                  {locale === 'en' ? 'Reset Home Layout' : '重置桌面布局'}
                </button>
              </div>
            </div>
          ) : null}

          {menu.kind === 'icon' ? (() => {
            const item = layout.items[menu.itemId];
            if (!item) return null;

            const title =
              item.kind === 'app'
                ? getLocalizedAppName(item.appId)
                : item.kind === 'folder'
                  ? (layout.folders[item.folderId]?.name ?? getDefaultFolderName())
                  : (item.widgetType === 'clock' ? (locale === 'en' ? 'Clock' : '时钟')
                    : item.widgetType === 'wmr' ? (wmrWidgets.find(w => w.id === item.widgetId)?.title ?? (locale === 'en' ? 'Widget' : '小组件'))
                    : (locale === 'en' ? 'Weather' : '天气'));

            const actions: Array<{ id: string; label: string; onClick: () => void }> = [];
            if (item.kind === 'app') {
              actions.push(
                {
                  id: 'info',
                  label: locale === 'en' ? 'App Info' : '应用信息',
                  onClick: () => {
                    openAppInfo(item.appId);
                    setMenu(null);
                  },
                },
                {
                  id: 'remove',
                  label: locale === 'en' ? 'Remove from Home' : '从桌面移除',
                  onClick: () => removeItemFromDesktop(menu.itemId),
                },
              );
            } else if (item.kind === 'folder') {
              actions.push(
                {
                  id: 'remove',
                  label: locale === 'en' ? 'Remove from Home' : '从桌面移除',
                  onClick: () => removeItemFromDesktop(menu.itemId),
                },
              );
            } else if (item.kind === 'widget') {
              actions.push(
                {
                  id: 'remove',
                  label: locale === 'en' ? 'Remove Widget' : '移除小部件',
                  onClick: () => removeItemFromDesktop(menu.itemId),
                },
                {
                  id: 'resize',
                  label: locale === 'en' ? 'Resize (Placeholder)' : '调整大小（占位）',
                  onClick: () => {
                    console.log('[Launcher] resizeWidget', item.widgetType);
                    setMenu(null);
                  },
                },
              );
            } else {
              actions.push(
                {
                  id: 'remove',
                  label: locale === 'en' ? 'Remove from Home' : '从桌面移除',
                  onClick: () => removeItemFromDesktop(menu.itemId),
                },
              );
            }

            const viewportW = typeof window !== 'undefined' ? window.innerWidth : 360;
            const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
            const menuW = 240;
            // Best-effort measurement for above/below placement.
            // Tailwind sizes used below:
            // - header: py-3 + text ~= 44px
            // - each row: py-3 + text ~= 44px
            // - gap-1 between rows ~= 4px
            // - pb-2 for container ~= 8px
            const headerH = 44;
            const rowH = 44;
            const gapH = 4;
            const rows = actions.length + 1; // +1 for "取消"
            const menuH = headerH + rows * rowH + Math.max(0, rows - 1) * gapH + 8 + 4; // +buffer
            const anchorCenterX = menu.anchor.left + menu.anchor.width / 2;
            const margin = 12;
            const safeTop = statusBarHeight + 8;
            const safeBottom = viewportH - 12;
            const aboveTop = menu.anchor.top - margin - menuH;
            const belowTop = menu.anchor.top + menu.anchor.height + margin;
            const canAbove = aboveTop >= safeTop;
            const canBelow = (belowTop + menuH) <= safeBottom;
            const top = canAbove
              ? aboveTop
              : canBelow
                ? belowTop
                : clamp(belowTop, safeTop, safeBottom - menuH);
            const left = clamp(anchorCenterX - menuW / 2, 12, viewportW - menuW - 12);

            return (
              <div
                className="absolute bg-white/92 backdrop-blur-md rounded-[22px] overflow-hidden shadow-xl border border-white/30"
                style={{ width: menuW, left, top }}
                role="menu"
                aria-label={locale === 'en' ? 'Shortcut Menu' : '快捷菜单'}
              >
                <div className="px-5 py-3 text-sm font-semibold text-gray-900">{title}</div>
                <div className="px-2 pb-2 flex flex-col gap-1">
                  {actions.map(a => (
                    <button
                      key={a.id}
                      type="button"
                      className="w-full text-left px-4 py-3 rounded-2xl hover:bg-black/5 active:bg-black/10 text-gray-900 text-sm"
                      onClick={a.onClick}
                    >
                      {a.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="w-full text-left px-4 py-3 rounded-2xl hover:bg-black/5 active:bg-black/10 text-gray-700 text-sm"
                    onClick={() => setMenu(null)}
                  >
                    {locale === 'en' ? 'Cancel' : '取消'}
                  </button>
                </div>
              </div>
            );
          })() : null}
        </div>
      ) : null}
    </div>
  );
};
