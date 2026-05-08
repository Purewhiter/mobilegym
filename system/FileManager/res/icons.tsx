// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import React from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Cloud,
  File,
  FileText,
  Film,
  Folder,
  FolderOpen,
  FolderPlus,
  Image,
  ListChecks,
  Music,
  Search,
  SlidersHorizontal,
  MoreVertical,
  X,
} from 'lucide-react';

// ── Navigation ────────────────────────────────────────────
export const IcNavBack = ChevronLeft;
export const IcNavForward = ChevronRight;
export const IcClose = X;
export const IcExpand = ChevronDown;
export const IcCollapse = ChevronUp;

// ── Common actions ────────────────────────────────────────
export const IcSearch = Search;
export const IcMore = MoreVertical;
export const IcMoreVert = MoreVertical;
export const IcCheck = Check;
export const IcFilter = SlidersHorizontal;
export const IcList = ListChecks;

// ── File / Folder ─────────────────────────────────────────
export const IcFolder = Folder;
export const IcFolderOpen = FolderOpen;
export const IcFolderAdd = FolderPlus;
export const IcFile = File;
export const IcFileText = FileText;
export const IcImage = Image;
export const IcVideo = Film;
export const IcMusic = Music;
export const IcCloud = Cloud;
export const IcClock = Clock;

// ── App launcher ──────────────────────────────────────────
export const IcLauncher = Folder;

// ──────────────────────────────────────────────────────────
// Custom SVG components
// ──────────────────────────────────────────────────────────

// Share/send icon (发送) — upload arrow
export const IcShare: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
);

/** @deprecated Use IcShare instead */
export const FileManagerShareIcon = IcShare;

// Move icon (移动) — folder with arrow
export const IcMove: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
        <polyline points="14 10 17 13 14 16" />
        <line x1="9" y1="13" x2="17" y2="13" />
    </svg>
);

/** @deprecated Use IcMove instead */
export const FileManagerMoveIcon = IcMove;

// Trash/delete icon (删除)
export const IcDelete: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M3 6h18" />
        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
);

/** @deprecated Use IcDelete instead */
export const FileManagerTrashIcon = IcDelete;

// More icon (更多) — circle with dots
export const IcMoreCircle: React.FC<{ size?: number; className?: string }> = ({ size = 24, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="16" cy="12" r="1" />
        <circle cx="8" cy="12" r="1" />
    </svg>
);

/** @deprecated Use IcMoreCircle instead */
export const FileManagerMoreIcon = IcMoreCircle;

// Clipboard icon (已复制/已剪切 indicator)
export const IcClipboard: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
);

/** @deprecated Use IcClipboard instead */
export const FileManagerClipboardIcon = IcClipboard;

// ── Registry for dynamic lookup ───────────────────────────
export const ICON_REGISTRY: Record<string, any> = {
  IcNavBack,
  IcNavForward,
  IcClose,
  IcExpand,
  IcCollapse,
  IcSearch,
  IcMore,
  IcMoreVert,
  IcCheck,
  IcFilter,
  IcList,
  IcFolder,
  IcFolderOpen,
  IcFolderAdd,
  IcFile,
  IcFileText,
  IcImage,
  IcVideo,
  IcMusic,
  IcCloud,
  IcClock,
  IcLauncher,
  IcShare,
  IcMove,
  IcDelete,
  IcMoreCircle,
  IcClipboard,
};
