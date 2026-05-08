// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import React from 'react';
import {
  // Navigation
  ChevronLeft,
  ChevronRight,
  X,

  // Actions / Controls
  Check,
  Search,
  RefreshCw,
  Pencil,

  // Connectivity
  Wifi,
  Lock,
  Unlock,
  Bluetooth,
  Link2,
  Link2Off,

  // Storage / Files
  HardDrive,
  File,
  Image,
  Film,
  Music,
  FileText,

  // App identity
  Settings,
} from 'lucide-react';
export type { LucideIcon } from 'lucide-react';

// === Navigation ===
export const IcNavBack = ChevronLeft;
export const IcNavForward = ChevronRight;
export const IcClose = X;

// === Actions / Controls ===
export const IcCheck = Check;
export const IcSearch = Search;
export const IcRefresh = RefreshCw;
export const IcEdit = Pencil;

// === Connectivity ===
export const IcWifi = Wifi;
export const IcLock = Lock;
export const IcUnlock = Unlock;
export const IcBluetooth = Bluetooth;
export const IcLink = Link2;
export const IcLinkOff = Link2Off;

// === Storage / Files ===
export const IcStorage = HardDrive;
export const IcFile = File;
export const IcImage = Image;
export const IcFilm = Film;
export const IcMusic = Music;
export const IcFileText = FileText;

// === Custom SVG Components ===
/** 列表行右侧 chevron 箭头（向右） */
export const ChevronRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" {...props}>
    <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// App launcher icon alias
export const IcLauncher = Settings;

// === ICON_REGISTRY for dynamic lookup ===
export const ICON_REGISTRY: Record<string, any> = {
  IcNavBack,
  IcNavForward,
  IcClose,
  IcCheck,
  IcSearch,
  IcRefresh,
  IcEdit,
  IcWifi,
  IcLock,
  IcUnlock,
  IcBluetooth,
  IcLink,
  IcLinkOff,
  IcStorage,
  IcFile,
  IcImage,
  IcFilm,
  IcMusic,
  IcFileText,
  ChevronRightIcon,
  IcLauncher,
};
