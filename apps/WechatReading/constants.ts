import type {
  ReaderPrefs,
  ReaderThemeBackground,
  ReaderThemeColor,
  ReaderTypographyIndex,
} from './data/types';

/** 字体大小离散档位（与真机一致，共 12 档） */
export const FONT_SIZE_STOPS = [16, 17, 18, 19, 20, 22, 24, 27, 30, 33, 36, 40] as const;

/** 行距倍数，7 档，index 0–6 */
export const LINE_HEIGHT_VALUES = [1.2, 1.4, 1.6, 1.8, 2.0, 2.3, 2.6] as const;

/** 水平边距 px，7 档，index 0–6 */
export const MARGIN_PX_VALUES = [4, 8, 16, 24, 32, 40, 48] as const;

export const READER_THEME_COLOR_VALUES = ['white', 'yellow', 'green', 'dark'] as const satisfies readonly ReaderThemeColor[];

export const READER_THEME_BACKGROUND_VALUES = ['matchTheme', 'bg1', 'bg2', 'bg3', 'bg4'] as const satisfies readonly ReaderThemeBackground[];

export const DEFAULT_READER_PREFS = {
  fontSize: 19,
  themeColor: 'white',
  themeBg: 'matchTheme',
  margin: 3,
  lineHeight: 3,
} as const satisfies ReaderPrefs;

const MAX_READER_TYPOGRAPHY_INDEX = MARGIN_PX_VALUES.length - 1;

function clampReaderTypographyIndex(value: number): ReaderTypographyIndex {
  return Math.max(0, Math.min(MAX_READER_TYPOGRAPHY_INDEX, Math.trunc(value))) as ReaderTypographyIndex;
}

export function isReaderThemeColor(value: unknown): value is ReaderThemeColor {
  return typeof value === 'string' && READER_THEME_COLOR_VALUES.includes(value as ReaderThemeColor);
}

export function isReaderThemeBackground(value: unknown): value is ReaderThemeBackground {
  return typeof value === 'string' && READER_THEME_BACKGROUND_VALUES.includes(value as ReaderThemeBackground);
}

export function isReaderTypographyIndex(value: unknown): value is ReaderTypographyIndex {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= MAX_READER_TYPOGRAPHY_INDEX;
}

export function isReaderFontSize(value: unknown): value is ReaderPrefs['fontSize'] {
  return typeof value === 'number' && FONT_SIZE_STOPS.includes(value as typeof FONT_SIZE_STOPS[number]);
}

export function normalizeMarginIndex(value: number | undefined): ReaderTypographyIndex {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampReaderTypographyIndex(value);
  }
  return DEFAULT_READER_PREFS.margin;
}

export function normalizeLineHeightIndex(value: number | undefined): ReaderTypographyIndex {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return clampReaderTypographyIndex(value);
  }
  return DEFAULT_READER_PREFS.lineHeight;
}

export function sanitizeReaderPrefs(raw: unknown): ReaderPrefs {
  const next = raw && typeof raw === 'object' ? raw as Partial<Record<keyof ReaderPrefs, unknown>> : {};
  return {
    fontSize: isReaderFontSize(next.fontSize) ? next.fontSize : DEFAULT_READER_PREFS.fontSize,
    themeColor: isReaderThemeColor(next.themeColor) ? next.themeColor : DEFAULT_READER_PREFS.themeColor,
    themeBg: isReaderThemeBackground(next.themeBg) ? next.themeBg : DEFAULT_READER_PREFS.themeBg,
    margin: isReaderTypographyIndex(next.margin) ? next.margin : DEFAULT_READER_PREFS.margin,
    lineHeight: isReaderTypographyIndex(next.lineHeight) ? next.lineHeight : DEFAULT_READER_PREFS.lineHeight,
  };
}

export const WECHAT_READING_CONSTANTS = {
};

export const BADGE_COLOR_MAP: Record<string, string> = {
  神作爱好者: 'bg-amber-100 text-amber-600',
  神作研习生: 'bg-orange-100 text-orange-600',
  阅读天数: 'bg-green-100 text-green-600',
  阅读时长: 'bg-cyan-100 text-cyan-600',
};

export const BOOK_BADGE_COLOR_MAP: Record<string, string> = {
  好评如潮: 'text-red-500 border-red-300',
  脍炙人口: 'text-blue-500 border-blue-300',
  值得一读: 'text-blue-500 border-blue-300',
};
