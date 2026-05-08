// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import {
  ArrowLeft,
  ChevronRight,
  Compass,
  Home,
  MoreVertical,
  Plus,
} from 'lucide-react';

// ── Navigation / chrome ──────────────────────────────────
export const IcNavBack = ArrowLeft;
export const IcNavForward = ChevronRight;
export const IcMoreVert = MoreVertical;

// ── Common actions ───────────────────────────────────────
export const IcAdd = Plus;
export const IcHome = Home;

// ── Compass specific ─────────────────────────────────────
export const IcCompass = Compass;

// ── App launcher ─────────────────────────────────────────
export const IcLauncher = Compass;

// ── Registry for dynamic lookup (used by IconRenderer) ───
export const ICON_REGISTRY: Record<string, any> = {
  IcNavBack,
  IcNavForward,
  IcMoreVert,
  IcAdd,
  IcHome,
  IcCompass,
  IcLauncher,
};
