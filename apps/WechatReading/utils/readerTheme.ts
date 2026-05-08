/**
 * 阅读器「颜色 / 背景」：页面底色、正文字色、顶栏/底栏/弹窗表面色统一由 pageBg 推导，
 * 避免只有正文区变色、Chrome 仍保持纯白。
 */

import type { ReaderThemeBackground, ReaderThemeColor } from '../data/types';

export interface ReaderThemeResolved {
  pageBg: string;
  /** 工具面板、按钮块等（相对 page 略提亮） */
  surface: string;
  /** 排版面板等次级表面 */
  surfaceMuted: string;
  /** 顶栏/底栏毛玻璃底色（与纸张同色相近） */
  chromeBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  sliderTrack: string;
  sliderFill: string;
  isDark: boolean;
}

const THEME_COLOR_PAGE: Record<ReaderThemeColor, string> = {
  /** 颜色第一项：纯白纸张 */
  white: '#ffffff',
  yellow: '#f6f2e5',
  green: '#e8f5e9',
  dark: '#1a1a1a',
};

const THEME_BG_PAGE: Record<Exclude<ReaderThemeBackground, 'matchTheme'>, string> = {
  bg1: '#faf9f4',
  bg2: '#f5f5f0',
  bg3: '#efefef',
  bg4: '#e0e0e0',
};

function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.trim();
  if (h.startsWith('#')) h = h.slice(1);
  if (h.length === 3) {
    h = h
      .split('')
      .map(c => c + c)
      .join('');
  }
  if (h.length !== 6) return { r: 250, g: 249, b: 244 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** t=0 → a，t=1 → b */
export function mixHex(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  return toHex({
    r: A.r + (B.r - A.r) * t,
    g: A.g + (B.g - A.g) * t,
    b: A.b + (B.b - A.b) * t,
  });
}

function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = parseHex(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function resolveLightChromeFromPage(pageBg: string): Omit<ReaderThemeResolved, 'pageBg' | 'isDark'> {
  // 弹窗/卡片：在纸张色上略混入白，仍保持同一色相
  const surface = mixHex(pageBg, '#ffffff', 0.22);
  // 排版面板：略偏灰一点，与 surface 区分
  const surfaceMuted = mixHex(mixHex(pageBg, '#e5e5e5', 0.18), '#ffffff', 0.12);
  // 顶栏底栏：与纸张一致略透明，毛玻璃叠在正文上时仍显「同一页」
  const chromeBg = hexToRgba(pageBg, 0.97);
  const border = mixHex(pageBg, '#000000', 0.07);
  const sliderTrack = mixHex(pageBg, '#a8a8a8', 0.32);
  const sliderFill = mixHex(pageBg, '#737373', 0.26);

  return {
    surface,
    surfaceMuted,
    chromeBg,
    textPrimary: '#1f2937',
    textSecondary: '#4b5563',
    textMuted: '#9ca3af',
    border,
    sliderTrack,
    sliderFill,
  };
}

export function resolveReaderTheme(
  themeColor: ReaderThemeColor,
  themeBg: ReaderThemeBackground,
): ReaderThemeResolved {
  const isDark = themeColor === 'dark';

  let pageBg: string;
  if (isDark) {
    pageBg = THEME_COLOR_PAGE.dark;
  } else {
    pageBg = themeBg === 'matchTheme' ? THEME_COLOR_PAGE[themeColor] : THEME_BG_PAGE[themeBg];
  }

  if (isDark) {
    return {
      pageBg,
      surface: '#2c2c2c',
      surfaceMuted: '#363636',
      chromeBg: 'rgba(38,38,38,0.96)',
      textPrimary: '#ececec',
      textSecondary: '#b4b4b4',
      textMuted: '#8a8a8a',
      border: 'rgba(255,255,255,0.12)',
      sliderTrack: '#404040',
      sliderFill: '#525252',
      isDark: true,
    };
  }

  const light = resolveLightChromeFromPage(pageBg);
  return {
    pageBg,
    ...light,
    isDark: false,
  };
}
