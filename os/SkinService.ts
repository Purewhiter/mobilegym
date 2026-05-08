import type { AppThemeColors } from './types/manifest';
import BroadcastBus, { ACTION_SKIN_CHANGED } from './BroadcastBus';

export type SkinId = 'default' | 'neutral' | 'test_v1';

export interface SkinState {
  id: SkinId;
  rotateHueDeg: number;
  imageFilter: string | null;
}

const SKINS: Record<SkinId, SkinState> = {
  default: { id: 'default', rotateHueDeg: 0, imageFilter: null },
  neutral: { id: 'neutral', rotateHueDeg: 137, imageFilter: 'hue-rotate(137deg)' },
  // 暂不实现数据集切换：test_v1 主题/滤镜等价于 neutral
  test_v1: { id: 'test_v1', rotateHueDeg: 137, imageFilter: 'hue-rotate(137deg)' },
};

let state: SkinState = SKINS.default;
const listeners = new Set<() => void>();

function emitChange(): void {
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): SkinState {
  return state;
}

export function getActiveSkinId(): SkinId {
  return state.id;
}

function normalizeSkinId(raw: string | null | undefined): SkinId {
  const id = (raw ?? '').trim();
  if (id === 'neutral') return 'neutral';
  if (id === 'test_v1') return 'test_v1';
  return 'default';
}

export function initFromUrl(): void {
  if (typeof window === 'undefined') return;
  const sp = new URLSearchParams(window.location.search);
  const next = normalizeSkinId(sp.get('skin'));
  // Avoid emitting change before any subscriber is registered; set silently.
  state = SKINS[next];
}

export function setSkin(id: SkinId, options?: { updateUrl?: boolean }): void {
  const next = SKINS[id] ?? SKINS.default;
  if (state.id === next.id) return;
  state = next;

  if (typeof window !== 'undefined' && (options?.updateUrl ?? true)) {
    const url = new URL(window.location.href);
    if (state.id === 'default') url.searchParams.delete('skin');
    else url.searchParams.set('skin', state.id);
    window.history.replaceState(null, '', url.toString());
  }

  BroadcastBus.sendBroadcast({
    action: ACTION_SKIN_CHANGED,
    extras: { ...state },
  });
  emitChange();
}

// ----------------------------------------------------------------------------
// Hue rotate utilities
// ----------------------------------------------------------------------------
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const s = hex.trim().toLowerCase();
  if (!s.startsWith('#')) return null;
  const raw = s.slice(1);
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  return null;
}

function rgbToHex(rgb: { r: number; g: number; b: number }): string {
  const to2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
  return `#${to2(rgb.r)}${to2(rgb.g)}${to2(rgb.b)}`;
}

function rgbToHsl(rgb: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };

  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  switch (max) {
    case r:
      h = ((g - b) / d) % 6;
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    case b:
      h = (r - g) / d + 4;
      break;
  }
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}

function hslToRgb(hsl: { h: number; s: number; l: number }): { r: number; g: number; b: number } {
  const h = ((hsl.h % 360) + 360) % 360;
  const s = clamp01(hsl.s);
  const l = clamp01(hsl.l);

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;

  let rp = 0, gp = 0, bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255,
  };
}

function rotateHexHue(hex: string, deg: number): string {
  const rgb = parseHexColor(hex);
  if (!rgb) return hex;
  const max = Math.max(rgb.r, rgb.g, rgb.b);
  const min = Math.min(rgb.r, rgb.g, rgb.b);
  // Keep near-neutral colors untouched to avoid tinting common grays / system neutrals.
  if (max - min <= 25) return hex.toLowerCase();

  const hsl = rgbToHsl(rgb);
  if (hsl.s < 0.08) return hex.toLowerCase();

  const next = hslToRgb({ ...hsl, h: (hsl.h + deg) % 360 });
  return rgbToHex(next).toLowerCase();
}

export function applySkinToThemeColors(colors: AppThemeColors): AppThemeColors {
  const deg = state.rotateHueDeg;
  if (!deg) return colors;

  const rot = (v: string | undefined): string | undefined => {
    if (!v) return v;
    return rotateHexHue(v, deg);
  };

  return {
    ...colors,
    primary: rotateHexHue(colors.primary, deg),
    primaryDark: rot(colors.primaryDark),
    onPrimary: rot(colors.onPrimary),
    secondary: rot(colors.secondary),
    accent: rot(colors.accent),
    background: rotateHexHue(colors.background, deg),
    surface: rot(colors.surface),
    onSurface: rot(colors.onSurface),
    textPrimary: rotateHexHue(colors.textPrimary, deg),
    textSecondary: rotateHexHue(colors.textSecondary, deg),
    border: rot(colors.border),
    tabBarBg: rot(colors.tabBarBg),
  };
}

export function getActiveImageFilter(): string | null {
  return state.imageFilter;
}
