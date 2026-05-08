// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import {
  Bookmark,
  Cake,
  Calendar,
  CalendarDays,
  ChevronRight,
  MoreVertical,
  Plus,
  Timer,
} from 'lucide-react';

// ── Navigation ────────────────────────────────────────────
export const IcNavForward = ChevronRight;

// ── Common actions ────────────────────────────────────────
export const IcAdd = Plus;
export const IcMore = MoreVertical;
export const IcMoreVert = MoreVertical;

// ── Calendar specific ─────────────────────────────────────
export const IcCalendar = Calendar;
export const IcCalendarDays = CalendarDays;
export const IcBookmark = Bookmark;
export const IcCake = Cake;
export const IcTimer = Timer;

// ── App launcher ──────────────────────────────────────────
export const IcLauncher = Calendar;

// ── Registry for dynamic lookup ───────────────────────────
export const ICON_REGISTRY: Record<string, any> = {
  IcNavForward,
  IcAdd,
  IcMore,
  IcMoreVert,
  IcCalendar,
  IcCalendarDays,
  IcBookmark,
  IcCake,
  IcTimer,
  IcLauncher,
};

// ── HyperOS symbols (public/icons/hyperos-symbols/*.svg) ───
export const HYPEROS_SYMBOLS_PATH = '/icons/hyperos-symbols';

/** URL for a HyperOS symbol by file name (without .svg). Use version for cache bust (e.g. ?v=2). */
export function getHyperosSymbolUrl(name: string, version?: string): string {
  const base = `${HYPEROS_SYMBOLS_PATH}/${name}.svg`;
  return version ? `${base}?v=${version}` : base;
}

// Symbol names used by this app
export const IcSymbolClear = 'clear';
export const IcSymbolImport = 'import';
export const IcSymbolMonths = 'months';
export const IcSymbolTheme = 'theme';
export const IcSymbolTune = 'tune';
export const IcSymbolWeeks = 'weeks';
export const IcSymbolYears = 'years';

/** Day-of-month icon name (th_1 … th_31) for bottom nav. */
export function getHyperosDayIconName(day: number): string {
  const d = Math.max(1, Math.min(31, Math.floor(day)));
  return `th_${d}`;
}
