import { describe, expect, it } from 'vitest';
import { summarizeLauncherRaw } from '../os/sim/launcherSnapshot';

const FIXTURE = {
  version: 3,
  grid: { columns: 4, rows: 6 },
  wallpaper: 'wp-default',
  items: {
    'i-app': { kind: 'app', appId: 'settings' },
    'i-folder': { kind: 'folder', folderId: 'f1' },
    'i-wmr': {
      kind: 'widget',
      widgetType: 'wmr',
      widgetId: 'clock',
      variant: 'large',
      previewUrl: '/preview.png',
      xmlBaseUrl: '/xml/',
    },
    'i-plain-widget': { kind: 'widget', widgetType: 'weather' },
    'i-unknown': { kind: 'mystery' },
  },
  screens: [
    {
      id: 's1',
      placements: [
        // 故意乱序：排序应先 cellY 后 cellX
        { itemId: 'i-wmr', cellX: 0, cellY: 2 },
        { itemId: 'i-app', cellX: 1, cellY: 0 },
        { itemId: 'i-folder', cellX: 0, cellY: 0 },
        { itemId: 'i-unknown', cellX: 3, cellY: 0 },
      ],
    },
    { id: 's2', placements: [{ itemId: 'i-plain-widget', cellX: 0, cellY: 0 }] },
  ],
  hotseat: [
    { itemId: 'i-folder', cellX: 2 },
    { itemId: 'i-app', cellX: 0 },
  ],
  folders: {
    f1: { id: 'f1', name: '工具', items: ['a', 'b', 'c'] },
  },
  hiddenApps: ['hidden-app'],
};

describe('summarizeLauncherRaw', () => {
  it('summarizes app/folder/widget(wmr)/plain-widget/unknown items with sorted screens and hotseat', () => {
    const summary = summarizeLauncherRaw(JSON.stringify(FIXTURE));
    expect(summary).not.toBeNull();
    const s = summary!;

    expect(s.version).toBe(3);
    expect(s.grid).toEqual({ columns: 4, rows: 6 });
    expect(s.wallpaper).toBe('wp-default');
    expect(s.screensCount).toBe(2);
    expect(s.hiddenApps).toEqual(['hidden-app']);

    const screens = s.screens as { id: unknown; items: Record<string, unknown>[] }[];
    expect(screens[0].id).toBe('s1');
    // cellY asc → cellX asc
    expect(screens[0].items.map((i) => i.kind)).toEqual(['folder', 'app', 'unknown', 'widget']);
    expect(screens[0].items[0]).toEqual({ slot: { cellX: 0, cellY: 0 }, kind: 'folder', folderId: 'f1' });
    expect(screens[0].items[1]).toEqual({ slot: { cellX: 1, cellY: 0 }, kind: 'app', appId: 'settings' });
    expect(screens[0].items[2]).toEqual({ slot: { cellX: 3, cellY: 0 }, kind: 'unknown' });
    // wmr widget 携带 widgetId/variant/previewUrl/xmlBaseUrl
    expect(screens[0].items[3]).toEqual({
      slot: { cellX: 0, cellY: 2 },
      kind: 'widget',
      widgetType: 'wmr',
      widgetId: 'clock',
      variant: 'large',
      previewUrl: '/preview.png',
      xmlBaseUrl: '/xml/',
    });
    // 非 wmr widget 只保留 widgetType
    expect(screens[1].items[0]).toEqual({
      slot: { cellX: 0, cellY: 0 },
      kind: 'widget',
      widgetType: 'weather',
    });

    // hotseat 按 cellX 排序，slot 为 cellX 标量
    const hotseat = s.hotseat as Record<string, unknown>[];
    expect(hotseat.map((i) => i.kind)).toEqual(['app', 'folder']);
    expect(hotseat[0]).toEqual({ slot: 0, kind: 'app', appId: 'settings' });
    expect(hotseat[1]).toEqual({ slot: 2, kind: 'folder', folderId: 'f1' });

    const folders = s.folders as Record<string, unknown>[];
    expect(folders).toEqual([{ id: 'f1', name: '工具', size: 3, items: ['a', 'b', 'c'] }]);
  });

  it('returns null on bad JSON', () => {
    expect(summarizeLauncherRaw('{not json')).toBeNull();
  });

  it('tolerates non-record JSON payloads (falls back to empty structure)', () => {
    const summary = summarizeLauncherRaw('42');
    expect(summary).not.toBeNull();
    expect(summary!.screensCount).toBe(0);
    expect(summary!.screens).toEqual([]);
    expect(summary!.hotseat).toEqual([]);
    expect(summary!.folders).toEqual([]);
    expect(summary!.hiddenApps).toEqual([]);
  });

  it('placement without matching item summarizes as unknown; missing cell coords sort as 0', () => {
    const summary = summarizeLauncherRaw(JSON.stringify({
      screens: [{ id: 's', placements: [{ itemId: 'ghost' }, { itemId: 'ghost2', cellX: 1, cellY: 0 }] }],
    }));
    const screens = summary!.screens as { items: Record<string, unknown>[] }[];
    expect(screens[0].items).toEqual([
      { slot: { cellX: undefined, cellY: undefined }, kind: 'unknown' },
      { slot: { cellX: 1, cellY: 0 }, kind: 'unknown' },
    ]);
  });
});
