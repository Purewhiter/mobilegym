// Tier-2 drawable icons (matching AOSP res/drawable/*.xml vector drawables)
// - Use currentColor for single-color icons
// Props: size?: number; className?: string
import React from 'react';
import {
  ArrowLeft,
  Bell,
  BookCheck,
  BookOpen,
  BookPlus,
  BookX,
  Calendar,
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CircleDot,
  Disc,
  DownloadCloud,
  Edit3,
  Eye,
  EyeOff,
  FolderPlus,
  Ghost,
  Heart,
  Headphones,
  Infinity,
  Library,
  List,
  ListPlus,
  Mail,
  MessageCircle,
  MessageSquare,
  Monitor,
  MoreHorizontal,
  MoreVertical,
  Pin,
  PlayCircle,
  Plus,
  PlusCircle,
  ScanLine,
  Search,
  Share,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Tablet,
  Type,
  User,
  Users,
  X,
} from 'lucide-react';

// ── Tab bar ──────────────────────────────────────────────
export const IcTabReading = BookOpen;
export const IcTabBookshelf = Library;
export const IcTabAudiobooks = Headphones;
export const IcTabCommunity = Users;
export const IcTabMe = User;

// ── Navigation / chrome ──────────────────────────────────
export const IcNavBack = ChevronLeft;
export const IcNavBackArrow = ArrowLeft;
export const IcNavForward = ChevronRight;
export const IcClose = X;
export const IcMore = MoreHorizontal;
export const IcMoreVertical = MoreVertical;
export const IcExpand = ChevronDown;

// ── Common actions ───────────────────────────────────────
export const IcSearch = Search;
export const IcAdd = Plus;
export const IcAddCircle = PlusCircle;
export const IcScan = ScanLine;
export const IcCheck = Check;
export const IcCheckCircle = CheckCircle;
export const IcCheckCircle2 = CheckCircle2;
export const IcFilter = SlidersHorizontal;

// ── User / Account ───────────────────────────────────────
export const IcUser = User;
export const IcUsers = Users;
export const IcMail = Mail;
export const IcEye = Eye;
export const IcEyeOff = EyeOff;
export const IcEdit = Edit3;

// ── Notifications / Settings ─────────────────────────────
export const IcBell = Bell;
export const IcClock = Infinity;

// ── Social / Share ───────────────────────────────────────
export const IcHeart = Heart;
export const IcShare = Share2;
export const IcShareAlt = Share;

// ── Media / Devices ──────────────────────────────────────
export const IcHeadphone = Headphones;
export const IcPlay = PlayCircle;
export const IcMessage = MessageCircle;
export const IcMessageSquare = MessageSquare;
export const IcMonitor = Monitor;
export const IcTablet = Tablet;
export const IcDisc = Disc;
export const IcCircleDot = CircleDot;

// ── Books / Reading ──────────────────────────────────────
export const IcBook = BookOpen;
export const IcBookCheck = BookCheck;
export const IcBookPlus = BookPlus;
export const IcBookRemove = BookX;
export const IcList = List;
export const IcListPlus = ListPlus;
export const IcCalendar = Calendar;

// ── Library actions ──────────────────────────────────────
export const IcDownload = DownloadCloud;
export const IcFolderAdd = FolderPlus;
export const IcPin = Pin;
export const IcGhost = Ghost;

// ── Reader UI ────────────────────────────────────────────
export const IcSun = Sun;
export const IcFont = Type;
export const IcSparkles = Sparkles;

/** 阅读器底栏「进度」：两侧短横线 + 中间圆环（-〇- 造型），与微信读书一致 */
export const IcReaderProgressMark: React.FC<{ size?: number; className?: string; strokeWidth?: number }> = ({
  size = 24,
  className = '',
  strokeWidth = 2,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    className={className}
    aria-hidden
  >
    <line x1="3" y1="12" x2="7.5" y2="12" />
    <circle cx="12" cy="12" r="3.75" />
    <line x1="16.5" y1="12" x2="21" y2="12" />
  </svg>
);

// ── Custom SVG icons ─────────────────────────────────────

// Download-arrow icon (下载到本地)
export const WechatReadingDownloadIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
);

// Folder icon (移动到...)
export const WechatReadingFolderIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
);

// Book/shelf icon (移出书架) — red accent applied at usage site via className
export const WechatReadingBookshelfIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        <line x1="9" y1="7" x2="9" y2="7" />
        <line x1="9" y1="11" x2="9" y2="11" />
    </svg>
);

// WeChat (微信朋友) bubble icon used in FollowingPage
export const WechatReadingWechatBubbleIcon: React.FC<{ size?: number; className?: string }> = ({ size = 28, className = '' }) => (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className}>
        <path d="M8.5 13.5c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5zm7 0c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5zm.365-8.452c-4.148-.04-7.865 2.513-7.865 7.027 0 2.453 1.137 4.547 3.037 5.86-1.025.753-1.613 1.047-3.037 1.48.91.246 2.44-.319 3.9-.92 1.25.38 2.6.59 3.965.613 4.673.014 8.232-2.94 8.232-7.02s-3.559-7.027-8.232-7.04zm-.365 1.252c3.866 0 7 2.589 7 5.783s-3.134 5.783-7 5.783c-1.127 0-2.188-.22-3.131-.611l-2.155 1.12c.745-.63 1.147-1.163 1.341-1.74-1.884-.964-3.055-2.613-3.055-4.552 0-3.194 3.134-5.783 7-5.783z" />
    </svg>
);

// ── App launcher icon ─────────────────────────────────────
export const IcLauncher = BookOpen;

// ── Registry for dynamic lookup (used by IconRenderer) ───
export const ICON_REGISTRY: Record<string, any> = {
  IcTabReading,
  IcTabBookshelf,
  IcTabAudiobooks,
  IcTabCommunity,
  IcTabMe,
  IcNavBack,
  IcNavBackArrow,
  IcNavForward,
  IcClose,
  IcMore,
  IcMoreVertical,
  IcExpand,
  IcSearch,
  IcAdd,
  IcAddCircle,
  IcScan,
  IcCheck,
  IcCheckCircle,
  IcCheckCircle2,
  IcFilter,
  IcUser,
  IcUsers,
  IcMail,
  IcEye,
  IcEyeOff,
  IcEdit,
  IcBell,
  IcClock,
  IcHeart,
  IcShare,
  IcShareAlt,
  IcHeadphone,
  IcPlay,
  IcMessage,
  IcMessageSquare,
  IcMonitor,
  IcTablet,
  IcDisc,
  IcCircleDot,
  IcBook,
  IcBookCheck,
  IcBookPlus,
  IcBookRemove,
  IcList,
  IcListPlus,
  IcCalendar,
  IcDownload,
  IcFolderAdd,
  IcPin,
  IcGhost,
  IcSun,
  IcFont,
  IcSparkles,
  IcReaderProgressMark,
  IcLauncher,
  WechatReadingDownloadIcon,
  WechatReadingFolderIcon,
  WechatReadingBookshelfIcon,
  WechatReadingWechatBubbleIcon,
};
