// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import React from 'react';
import {
  Plus,
  MoreVertical,
  Play,
  Leaf,
  Navigation,
  AlertCircle,
  Shirt,
  Sun,
  Sunrise,
  Sunset,
  Dumbbell,
  Car,
  Umbrella,
  ThermometerSnowflake,
  Cloud,
  ChevronLeft,
  Check,
  ChevronsUpDown,
} from 'lucide-react';

// ── Navigation / chrome ──────────────────────────────────
export const IcNavBack = ChevronLeft;
export const IcMoreVert = MoreVertical;

// ── Common actions ───────────────────────────────────────
export const IcAdd = Plus;
export const IcPlay = Play;

// ── Weather specific ─────────────────────────────────────
export const IcSun = Sun;
export const IcSunrise = Sunrise;
export const IcSunset = Sunset;
export const IcCloud = Cloud;
export const IcRain = Umbrella;
export const IcSnow = ThermometerSnowflake;
export const IcAlert = AlertCircle;
export const IcLeaf = Leaf;
export const IcNavigation = Navigation;

// ── Life indices ─────────────────────────────────────────
export const IcClothing = Shirt;
export const IcFitness = Dumbbell;
export const IcDrive = Car;

// ── Picker / selection ───────────────────────────────────
export const IcCheck = Check;
export const IcChevronsUpDown = ChevronsUpDown;

// ── App launcher ─────────────────────────────────────────
export const IcLauncher = Cloud;

// ── Registry for dynamic lookup (used by IconRenderer) ───
export const ICON_REGISTRY: Record<string, any> = {
  IcNavBack,
  IcMoreVert,
  IcAdd,
  IcPlay,
  IcSun,
  IcSunrise,
  IcSunset,
  IcCloud,
  IcRain,
  IcSnow,
  IcAlert,
  IcLeaf,
  IcNavigation,
  IcClothing,
  IcFitness,
  IcDrive,
  IcCheck,
  IcChevronsUpDown,
  IcLauncher,
};
