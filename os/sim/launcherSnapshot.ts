/**
 * Launcher summary for `__SIM__.getState().os.launcher`: the persisted launcher
 * layout (screens, hotseat, folders, widgets) reduced to what judges read.
 * Parsing is cached on the raw string, since the layout rarely changes.
 */

import { flushKey } from '../debouncedPersist';
import { LAUNCHER_STORAGE_KEY } from '../launcher/types';

/** Summary of a raw persisted launcher layout; `null` for malformed JSON. */
export function summarizeLauncherRaw(raw: string): any {
  try {
    const parsed = JSON.parse(raw);
    const items = parsed?.items ?? {};
    const hotseat = Array.isArray(parsed?.hotseat) ? parsed.hotseat : [];
    const folders = parsed?.folders ?? {};
    const screens = Array.isArray(parsed?.screens) ? parsed.screens : [];
    const summarizeItem = (item: any, slot: any) => {
      if (item?.kind === 'app') return { slot, kind: 'app', appId: item.appId };
      if (item?.kind === 'folder') return { slot, kind: 'folder', folderId: item.folderId };
      if (item?.kind === 'widget') {
        const summary: any = { slot, kind: 'widget', widgetType: item.widgetType };
        if (item.widgetType === 'wmr') {
          summary.widgetId = item.widgetId;
          summary.variant = item.variant;
          summary.previewUrl = item.previewUrl;
          if (item.xmlBaseUrl) summary.xmlBaseUrl = item.xmlBaseUrl;
        }
        return summary;
      }
      return { slot, kind: 'unknown' };
    };
    return {
      version: parsed?.version,
      grid: parsed?.grid,
      wallpaper: parsed?.wallpaper,
      screensCount: screens.length,
      screens: screens.map((s: any) => ({
        id: s?.id,
        items: (Array.isArray(s?.placements) ? s.placements : [])
          .slice()
          .sort((a: any, b: any) => ((a?.cellY ?? 0) - (b?.cellY ?? 0)) || ((a?.cellX ?? 0) - (b?.cellX ?? 0)))
          .map((p: any) => {
            const item = items?.[p?.itemId];
            const slot = { cellX: p?.cellX, cellY: p?.cellY };
            return summarizeItem(item, slot);
          }),
      })),
      hiddenApps: Array.isArray(parsed?.hiddenApps) ? parsed.hiddenApps : [],
      hotseat: hotseat
        .slice()
        .sort((a: any, b: any) => (a?.cellX ?? 0) - (b?.cellX ?? 0))
        .map((p: any) => {
          const item = items?.[p?.itemId];
          return summarizeItem(item, p?.cellX);
        }),
      folders: Object.values(folders).map((f: any) => ({
        id: f?.id,
        name: f?.name,
        size: Array.isArray(f?.items) ? f.items.length : 0,
        items: Array.isArray(f?.items) ? f.items : [],
      })),
    };
  } catch {
    return null;
  }
}

let cacheRaw: string | null | undefined = undefined;
let cacheParsed: any = null;

/** The current launcher summary, read from storage after flushing pending writes. */
export function readLauncherSummary(): any {
  flushKey(LAUNCHER_STORAGE_KEY);
  const raw = localStorage.getItem(LAUNCHER_STORAGE_KEY);
  if (!raw) {
    if (cacheRaw !== null) {
      cacheRaw = null;
      cacheParsed = null;
    }
    return null;
  }
  if (raw !== cacheRaw) {
    cacheParsed = summarizeLauncherRaw(raw);
    cacheRaw = raw;
  }
  return cacheParsed;
}
