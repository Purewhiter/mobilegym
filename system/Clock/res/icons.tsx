// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import {
  AlarmClock,
  ArrowLeft,
  Check,
  ChevronRight,
  Clock,
  Flag,
  Globe2,
  GripVertical,
  Hourglass,
  ListChecks,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Search,
  Square,
  Sun,
  Timer,
  Trash2,
  X,
} from 'lucide-react';

// ── Navigation ────────────────────────────────────────────
export const IcNavBack = ArrowLeft;
export const IcNavForward = ChevronRight;
export const IcClose = X;

// ── Common actions ────────────────────────────────────────
export const IcSearch = Search;
export const IcAdd = Plus;
export const IcMore = MoreVertical;
export const IcMoreVert = MoreVertical;
export const IcCheck = Check;
export const IcDelete = Trash2;
export const IcList = ListChecks;

// ── Playback ──────────────────────────────────────────────
export const IcPlay = Play;
export const IcPause = Pause;
export const IcStop = Square;

// ── Clock specific ────────────────────────────────────────
export const IcClock = Clock;
export const IcAlarm = AlarmClock;
export const IcTimer = Timer;
export const IcStopwatch = Hourglass;
export const IcGlobe = Globe2;
export const IcFlag = Flag;
export const IcSun = Sun;
export const IcGripVertical = GripVertical;

// ── App launcher ──────────────────────────────────────────
export const IcLauncher = Clock;

// ── Registry for dynamic lookup ───────────────────────────
export const ICON_REGISTRY: Record<string, any> = {
  IcNavBack,
  IcNavForward,
  IcClose,
  IcSearch,
  IcAdd,
  IcMore,
  IcMoreVert,
  IcCheck,
  IcDelete,
  IcList,
  IcPlay,
  IcPause,
  IcStop,
  IcClock,
  IcAlarm,
  IcTimer,
  IcStopwatch,
  IcGlobe,
  IcFlag,
  IcSun,
  IcGripVertical,
  IcLauncher,
};
