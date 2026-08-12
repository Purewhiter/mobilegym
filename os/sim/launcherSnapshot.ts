import { flushKey } from '../debouncedPersist';
import { LAUNCHER_STORAGE_KEY } from '../launcher/types';

/** launcher localStorage 摘要（`__SIM__.getState().os.launcher` 的形状，仅摘要透传，不做深校验） */
export type LauncherSummary = Record<string, unknown>;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/**
 * 把 launcher localStorage 的原始 JSON 字符串解析为 getState 摘要。
 * 纯函数：坏 JSON / 解析中任何抛错 → null。
 */
export function summarizeLauncherRaw(raw: string): LauncherSummary | null {
  try {
    // localStorage JSON 边界：unknown + isRecord 守卫；仅摘要透传，不做深校验
    const parsedRaw: unknown = JSON.parse(raw);
    const parsed = isRecord(parsedRaw) ? parsedRaw : {};
    const items = isRecord(parsed.items) ? parsed.items : {};
    const hotseat: unknown[] = Array.isArray(parsed.hotseat) ? parsed.hotseat : [];
    const folders = isRecord(parsed.folders) ? parsed.folders : {};
    const screens: unknown[] = Array.isArray(parsed.screens) ? parsed.screens : [];
    const cellOf = (p: unknown, key: 'cellX' | 'cellY'): number => {
      const v = isRecord(p) ? p[key] : undefined;
      return typeof v === 'number' ? v : 0;
    };
    const itemFor = (p: unknown): unknown =>
      isRecord(p) ? items[String(p.itemId)] : undefined;
    const summarizeItem = (itemRaw: unknown, slot: unknown): Record<string, unknown> => {
      const item = isRecord(itemRaw) ? itemRaw : null;
      if (item?.kind === 'app') return { slot, kind: 'app', appId: item.appId };
      if (item?.kind === 'folder') return { slot, kind: 'folder', folderId: item.folderId };
      if (item?.kind === 'widget') {
        const summary: Record<string, unknown> = { slot, kind: 'widget', widgetType: item.widgetType };
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
      version: parsed.version,
      grid: parsed.grid,
      wallpaper: parsed.wallpaper,
      screensCount: screens.length,
      screens: screens.map((s) => {
        const screen = isRecord(s) ? s : null;
        const placements: unknown[] =
          screen && Array.isArray(screen.placements) ? screen.placements : [];
        return {
          id: screen?.id,
          items: placements
            .slice()
            .sort((a, b) => (cellOf(a, 'cellY') - cellOf(b, 'cellY')) || (cellOf(a, 'cellX') - cellOf(b, 'cellX')))
            .map((p) => {
              const slot = { cellX: isRecord(p) ? p.cellX : undefined, cellY: isRecord(p) ? p.cellY : undefined };
              return summarizeItem(itemFor(p), slot);
            }),
        };
      }),
      hiddenApps: Array.isArray(parsed.hiddenApps) ? parsed.hiddenApps : [],
      hotseat: hotseat
        .slice()
        .sort((a, b) => cellOf(a, 'cellX') - cellOf(b, 'cellX'))
        .map((p) => summarizeItem(itemFor(p), isRecord(p) ? p.cellX : undefined)),
      folders: Object.values(folders).map((f) => {
        const folder = isRecord(f) ? f : null;
        const folderItems: unknown[] =
          folder && Array.isArray(folder.items) ? folder.items : [];
        return {
          id: folder?.id,
          name: folder?.name,
          size: folderItems.length,
          items: folderItems,
        };
      }),
    };
  } catch {
    return null;
  }
}

// --- getState() cache for launcher (rarely changes, expensive to parse) ---
let _launcherCacheRaw: string | null | undefined = undefined;
let _launcherCacheParsed: LauncherSummary | null = null;

/**
 * 读取 launcher localStorage 摘要（带解析缓存）：
 * flushKey 先落盘 pending 写入 → getItem → raw 未变则直接命中缓存；
 * raw 为空时清空缓存（含首次 undefined → null 的归一化）。
 */
export function readLauncherSummary(): LauncherSummary | null {
  flushKey(LAUNCHER_STORAGE_KEY);
  const rawLauncher = localStorage.getItem(LAUNCHER_STORAGE_KEY);
  if (rawLauncher) {
    if (rawLauncher === _launcherCacheRaw) return _launcherCacheParsed;
    const launcher = summarizeLauncherRaw(rawLauncher);
    _launcherCacheRaw = rawLauncher;
    _launcherCacheParsed = launcher;
    return launcher;
  }
  if (_launcherCacheRaw !== null) {
    _launcherCacheRaw = null;
    _launcherCacheParsed = null;
  }
  return null;
}
