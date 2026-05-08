// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Globe,
  Home,
  Layers,
  MoreHorizontal,
  Plus,
  RotateCw,
  Search,
  Shield,
  X,
} from 'lucide-react';

// ── Navigation ────────────────────────────────────────────
export const IcNavBack = ChevronLeft;
export const IcNavForward = ChevronRight;
export const IcBack = ArrowLeft;
export const IcForward = ArrowRight;
export const IcClose = X;
export const IcHome = Home;

// ── Common actions ────────────────────────────────────────
export const IcSearch = Search;
export const IcAdd = Plus;
export const IcMore = MoreHorizontal;
export const IcMoreHoriz = MoreHorizontal;
export const IcRefresh = RotateCw;

// ── Browser specific ──────────────────────────────────────
export const IcGlobe = Globe;
export const IcShield = Shield;
export const IcTabs = Layers;

// ── App launcher ──────────────────────────────────────────
export const IcLauncher = Globe;

// ── Registry for dynamic lookup ───────────────────────────
export const ICON_REGISTRY: Record<string, any> = {
  IcNavBack,
  IcNavForward,
  IcBack,
  IcForward,
  IcClose,
  IcHome,
  IcSearch,
  IcAdd,
  IcMore,
  IcMoreHoriz,
  IcRefresh,
  IcGlobe,
  IcShield,
  IcTabs,
  IcLauncher,
};
