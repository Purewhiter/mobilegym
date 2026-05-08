import { cdn } from '../utils/cdn';

const THEME_CDN = cdn('themes');

const AP15_SUPER_DEPTH_THEME_ID = '88f0097e-a5a4-47c5-82a6-c0eabbc784b9';
const YEBAN_THEME_ID = 'af0f7f90-04fb-417b-941e-ae7b549fe5e5';

export const THEME_IDS = {
  ap15SuperDepth: AP15_SUPER_DEPTH_THEME_ID,
  yeban: YEBAN_THEME_ID,
} as const;

export const THEME_CONFIG = {
  /** URL to the generated theme manifest. */
  manifestUrl: `${THEME_CDN}/manifest.json`,
  /** Base URL prefix for theme assets. */
  baseUrl: THEME_CDN,
  /** localStorage key for active theme config. */
  storageKey: 'theme.active.v2',
  /** Runtime default theme id. This is the source of truth over manifest.json. */
  defaultThemeId: AP15_SUPER_DEPTH_THEME_ID,
  /** Default mix-and-match components for a fresh active theme config. */
  defaultComponents: {
    icons: YEBAN_THEME_ID,
    statusbar: AP15_SUPER_DEPTH_THEME_ID,
    shade: AP15_SUPER_DEPTH_THEME_ID,
  },
} as const;
