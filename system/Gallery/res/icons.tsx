// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Clipboard,
  FilePenLine,
  FileText,
  FileType,
  Film,
  Heart,
  Image,
  Info,
  LayoutGrid,
  ListChecks,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  PlusSquare,
  RotateCw,
  ScanText,
  Scissors,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TextCursorInput,
  Trash2,
  User,
  Wallpaper,
  X,
} from 'lucide-react';

// ── Navigation ────────────────────────────────────────────
export const IcNavBack = ChevronLeft;
export const IcNavForward = ChevronRight;
export const IcClose = X;

// ── Common actions ────────────────────────────────────────
export const IcSearch = Search;
export const IcMore = MoreHorizontal;
export const IcMoreVert = MoreVertical;
export const IcMoreHoriz = MoreHorizontal;
export const IcCheck = Check;
export const IcFilter = SlidersHorizontal;
export const IcSelectAll = ListChecks;
export const IcEdit = Pencil;
export const IcDelete = Trash2;
export const IcShare = Share2;
export const IcRefresh = RotateCw;

// ── Media ─────────────────────────────────────────────────
export const IcImage = Image;
export const IcVideo = Film;
export const IcCamera = Camera;
export const IcHeart = Heart;

// ── Gallery specific ──────────────────────────────────────
export const IcGrid = LayoutGrid;
export const IcAddPhoto = PlusSquare;
export const IcSparkles = Sparkles;
export const IcScissors = Scissors;
export const IcFile = FileText;
export const IcUser = User;

// ── More menu (photo viewer popup) ────────────────────────
export const IcAddTo = CirclePlus;
export const IcWallpaper = Wallpaper;
export const IcInfo = Info;
export const IcGeneratePdf = FileType;
export const IcExtract = ScanText;
export const IcDocEdit = FilePenLine;
export const IcWatermark = ShieldCheck;
export const IcClipboard = Clipboard;
export const IcRename = TextCursorInput;

// ── App launcher ──────────────────────────────────────────
export const IcLauncher = Image;

// ── Registry for dynamic lookup ───────────────────────────
export const ICON_REGISTRY: Record<string, any> = {
  IcNavBack,
  IcNavForward,
  IcClose,
  IcSearch,
  IcMore,
  IcMoreVert,
  IcMoreHoriz,
  IcCheck,
  IcFilter,
  IcSelectAll,
  IcEdit,
  IcDelete,
  IcShare,
  IcRefresh,
  IcImage,
  IcVideo,
  IcCamera,
  IcHeart,
  IcGrid,
  IcAddPhoto,
  IcSparkles,
  IcScissors,
  IcFile,
  IcUser,
  IcAddTo,
  IcWallpaper,
  IcInfo,
  IcGeneratePdf,
  IcExtract,
  IcDocEdit,
  IcWatermark,
  IcClipboard,
  IcRename,
  IcLauncher,
};
