import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_WALLPAPER, DEFAULT_WALLPAPER_CHOICES, normalizeLauncherLayout } from '../os/launcher/layout';
import type { LauncherLayout } from '../os/launcher/types';

const layoutSource = readFileSync('os/launcher/layout.ts', 'utf8');
const defaultsSource = readFileSync('os/launcher/defaults.json', 'utf8');

describe('launcher theme wallpaper source', () => {
  it('keeps concrete default wallpaper choices in defaults.json instead of layout code', () => {
    for (const id of ['aurora_night', 'lake_morning', 'light_sky']) {
      expect(layoutSource).not.toContain(id);
      expect(defaultsSource).toContain(id);
    }
  });

  it('uses the Night theme wallpaper as the default launcher image wallpaper', () => {
    expect(DEFAULT_WALLPAPER).toEqual({
      kind: 'image',
      imageUrl: '/cdn/themes/af0f7f90-04fb-417b-941e-ae7b549fe5e5/wallpaper/default.jpg',
    });
  });

  it('keeps default wallpaper choices as image URL values', () => {
    expect(DEFAULT_WALLPAPER_CHOICES.map((item) => item.wallpaper.kind)).toEqual(['image', 'image', 'image']);
    expect(DEFAULT_WALLPAPER_CHOICES.map((item) => item.wallpaper.imageUrl)).toEqual([
      '/cdn/wallpapers/default/aurora_night.svg',
      '/cdn/wallpapers/default/lake_morning.svg',
      '/cdn/wallpapers/default/light_sky.svg',
    ]);
  });

  it('falls back to the default wallpaper for non-image persisted values', () => {
    const layout = {
      version: 1,
      grid: { columns: 4, rows: 6 },
      screens: [],
      hotseat: [],
      items: {},
      folders: {},
      wallpaper: { kind: 'unknown' },
      hiddenApps: [],
    } as any;

    expect(normalizeLauncherLayout(layout, []).wallpaper).toEqual(DEFAULT_WALLPAPER);
  });

  it('keeps explicit image wallpapers unchanged', () => {
    const layout: LauncherLayout = {
      version: 1,
      grid: { columns: 4, rows: 6 },
      screens: [],
      hotseat: [],
      items: {},
      folders: {},
      wallpaper: {
        kind: 'image',
        imageUrl: '/cdn/wallpapers/default/light_sky.svg',
      },
      hiddenApps: [],
    };

    expect(normalizeLauncherLayout(layout, []).wallpaper).toEqual({
      kind: 'image',
      imageUrl: '/cdn/wallpapers/default/light_sky.svg',
    });
  });
});
