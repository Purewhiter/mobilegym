// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import {
  ChevronLeft,
  Loader2,
  Palette,
} from 'lucide-react';

// ── Navigation ────────────────────────────────────────────
export const IcNavBack = ChevronLeft;

// ── Common actions ────────────────────────────────────────
export const IcLoading = Loader2;

// ── Theme specific ────────────────────────────────────────
export const IcTheme = Palette;

// ── App launcher ──────────────────────────────────────────
export const IcLauncher = Palette;

// ── Registry for dynamic lookup ───────────────────────────
export const ICON_REGISTRY: Record<string, any> = {
  IcNavBack,
  IcLoading,
  IcTheme,
  IcLauncher,
};
