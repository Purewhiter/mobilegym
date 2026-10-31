import { describe, expect, it, vi } from 'vitest';

vi.mock('../os/debouncedPersist', () => ({ flushKey: () => {} }));

import { summarizeLauncherRaw } from '../os/sim/launcherSnapshot';

describe('summarizeLauncherRaw', () => {
  it('summarizes screens (sorted by row, then column), hotseat, folders and widgets', () => {
    const raw = JSON.stringify({
      version: 3,
      grid: { cols: 4, rows: 6 },
      wallpaper: 'w1',
      items: {
        a: { kind: 'app', appId: 'wechat' },
        f: { kind: 'folder', folderId: 'f1' },
        w: { kind: 'widget', widgetType: 'wmr', widgetId: 'clock', variant: '2x2', previewUrl: 'p.png' },
        c: { kind: 'widget', widgetType: 'weather' },
        x: { kind: 'mystery' },
      },
      screens: [{ id: 's1', placements: [
        { itemId: 'w', cellX: 1, cellY: 1 },
        { itemId: 'a', cellX: 2, cellY: 0 },
        { itemId: 'x', cellX: 0, cellY: 1 },
      ] }],
      hotseat: [{ itemId: 'c', cellX: 1 }, { itemId: 'f', cellX: 0 }],
      folders: { f1: { id: 'f1', name: 'Tools', items: ['calc', 'notes'] } },
    });
    expect(summarizeLauncherRaw(raw)).toEqual({
      version: 3,
      grid: { cols: 4, rows: 6 },
      wallpaper: 'w1',
      screensCount: 1,
      screens: [{ id: 's1', items: [
        { slot: { cellX: 2, cellY: 0 }, kind: 'app', appId: 'wechat' },
        { slot: { cellX: 0, cellY: 1 }, kind: 'unknown' },
        { slot: { cellX: 1, cellY: 1 }, kind: 'widget', widgetType: 'wmr', widgetId: 'clock', variant: '2x2', previewUrl: 'p.png' },
      ] }],
      hiddenApps: [],
      hotseat: [
        { slot: 0, kind: 'folder', folderId: 'f1' },
        { slot: 1, kind: 'widget', widgetType: 'weather' },
      ],
      folders: [{ id: 'f1', name: 'Tools', size: 2, items: ['calc', 'notes'] }],
    });
  });

  it('returns null for malformed JSON', () => {
    expect(summarizeLauncherRaw('{not json')).toBeNull();
  });
});
