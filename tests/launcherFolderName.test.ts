import { describe, expect, it } from 'vitest';
import type { LauncherLayout } from '../os/launcher/types';
import { renameLauncherFolder } from '../os/launcher/folderNameModel';
import { DEFAULT_WALLPAPER } from '../os/launcher/layout';

function makeLayout(): LauncherLayout {
  return {
    version: 1,
    grid: { columns: 4, rows: 6 },
    screens: [],
    hotseat: [],
    items: {},
    folders: {
      folder_1: { id: 'folder_1', name: '文件夹', items: ['notes', 'calendar'] },
    },
    wallpaper: DEFAULT_WALLPAPER,
    hiddenApps: [],
  };
}

describe('launcher folder name editing', () => {
  it('updates folder name from the current draft without waiting for blur or Enter', () => {
    const next = renameLauncherFolder(makeLayout(), 'folder_1', ' 摸鱼专区 ');

    expect(next.folders.folder_1.name).toBe('摸鱼专区');
  });

  it('keeps the previous name when the draft is blank', () => {
    const layout = makeLayout();
    const next = renameLauncherFolder(layout, 'folder_1', '   ');

    expect(next).toBe(layout);
    expect(next.folders.folder_1.name).toBe('文件夹');
  });
});
