// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import React from 'react';
import {
  Aperture,
  ArrowDownCircle,
  ArrowLeft,
  ArrowUpDown,
  BarChart2,
  Bell,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Crown,
  Disc,
  Download,
  Edit2,
  ExternalLink,
  Eye,
  EyeOff,
  Headphones,
  Heart,
  History,
  Home,
  Info,
  LayoutGrid,
  Library,
  ListMusic,
  Lock,
  Mail,
  MessageCircle,
  MinusCircle,
  MonitorSpeaker,
  MoreHorizontal,
  MoreVertical,
  Music,
  Music2,
  Pause,
  Pin,
  Play,
  Plus,
  QrCode,
  Radio,
  PlusCircle,
  Repeat,
  Search,
  Settings,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  Smartphone,
  Timer,
  TrendingUp,
  User,
  Users,
  Volume2,
  X,
  XCircle,
  SquarePen,
  Zap,
} from 'lucide-react';

// ── Tab bar ──────────────────────────────────────────────
export const IcTabHome = Home;
export const IcTabSearch = Search;
export const IcTabLibrary = Library;
export const IcTabPremium = Crown;
export const IcTabCreate = Plus;

// ── Navigation / chrome ──────────────────────────────────
export const IcNavBack = ChevronLeft;
export const IcNavBackArrow = ArrowLeft;
export const IcNavForward = ChevronRight;
export const IcClose = X;
export const IcCloseCircle = XCircle;
export const IcMore = MoreHorizontal;
export const IcMoreVertical = MoreVertical;
export const IcExpand = ChevronDown;

// ── Common actions ───────────────────────────────────────
export const IcSearch = Search;
export const IcAdd = Plus;
export const IcAddCircle = PlusCircle;
export const IcMinusCircle = MinusCircle;
export const IcCheck = Check;
export const IcCheckCircle = CheckCircle2;
export const IcEdit = Edit2;
export const IcDownload = Download;
export const IcDownloadCircle = ArrowDownCircle;
export const IcSort = ArrowUpDown;
export const IcPin = Pin;
export const IcExternalLink = ExternalLink;
export const IcTimer = Timer;
export const IcLyrics = MessageCircle;

// ── User / Account ───────────────────────────────────────
export const IcUser = User;
export const IcUsers = Users;
export const IcMail = Mail;
export const IcCamera = Camera;
export const IcEye = Eye;
export const IcEyeOff = EyeOff;
export const IcLock = Lock;

// ── Music / Playback ─────────────────────────────────────
export const IcPlay = Play;
export const IcPause = Pause;
export const IcSkipNext = SkipForward;
export const IcSkipPrev = SkipBack;
export const IcShuffle = Shuffle;
export const IcRepeat = Repeat;
export const IcVolume = Volume2;
export const IcHeadphone = Headphones;
export const IcMic = MonitorSpeaker;
export const IcQueue = ListMusic;
export const IcRadio = Radio;
export const IcQrCode = QrCode;
export const IcDisc = Disc;
export const IcMusic = Music;
export const IcMusicNote = Music2;

// ── Notifications / Settings ─────────────────────────────
export const IcBell = Bell;
export const IcSettings = Settings;
export const IcInfo = Info;
export const IcShield = Lock;
export const IcPhone = Smartphone;
export const IcTrend = TrendingUp;
export const IcChart = BarChart2;
export const IcHistory = History;
export const IcClock = Clock;
export const IcZap = Zap;
export const IcCompose = SquarePen;

// ── Social / Share ───────────────────────────────────────
export const IcHeart = Heart;
export const IcShare = Share2;
export const IcMessage = MessageCircle;

// ── Library / Browse ─────────────────────────────────────
export const IcGrid = LayoutGrid;
export const IcCard = CreditCard;
export const IcAperture = Aperture;

// ── Spotify liked indicator (solid green circle + white check) ────
export const IcLikedIndicator = ({ size = 24, className = '' }: { size?: number | string; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#1ED760" />
    <path d="M7.5 12.5l3 3 6-6.5" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

// ── Spotify brand icons (custom SVG) ─────────────────────
export const IcLauncher = ({ size = 24, className = '' }: { size?: number | string; className?: string }) => {
  const displaySize = typeof size === 'number' ? size * 1.35 : size;
  return (
    <svg
      width={displaySize}
      height={displaySize}
      viewBox="0 0 496 512"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fill="currentColor"
        d="M248 8C111.1 8 0 119.1 0 256s111.1 248 248 248 248-111.1 248-248S384.9 8 248 8Z"
      />
      <path
        fill="#000000"
        d="M406.6 231.1c-5.2 0-8.4-1.3-12.9-3.9-71.2-42.5-198.5-52.7-280.9-29.7-3.6 1-8.1 2.6-12.9 2.6-13.2 0-23.3-10.3-23.3-23.6 0-13.6 8.4-21.3 17.4-23.9 35.2-10.3 74.6-15.2 117.5-15.2 73 0 149.5 15.2 205.4 47.8 7.8 4.5 12.9 10.7 12.9 22.6 0 13.6-11 23.3-23.2 23.3zm-31 76.2c-5.2 0-8.7-2.3-12.3-4.2-62.5-37-155.7-51.9-238.6-29.4-4.8 1.3-7.4 2.6-11.9 2.6-10.7 0-19.4-8.7-19.4-19.4s5.2-17.8 15.5-20.7c27.8-7.8 56.2-13.6 97.8-13.6 64.9 0 127.6 16.1 177 45.5 8.1 4.8 11.3 11 11.3 19.7-.1 10.8-8.5 19.5-19.4 19.5zm-26.9 65.6c-4.2 0-6.8-1.3-10.7-3.6-62.4-37.6-135-39.2-206.7-24.5-3.9 1-9 2.6-11.9 2.6-9.7 0-15.8-7.7-15.8-15.8 0-10.3 6.1-15.2 13.6-16.8 81.9-18.1 165.6-16.5 237 26.2 6.1 3.9 9.7 7.4 9.7 16.5s-7.1 15.4-15.2 15.4z"
      />
    </svg>
  );
};

export const SpotifyLogoIcon = ({ size = 24, fill = 'currentColor', className = '' }: { size?: number; fill?: string; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 4.2-1.32 9.6-0.66 13.38 1.68.42.299.6.839.36 1.141zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 14.82 1.14.54.3.719.96.42 1.5-1.001.2-1.1.2-1.2.2z" />
  </svg>
);

// ── Registry for dynamic lookup (used by IconRenderer) ───
export const ICON_REGISTRY: Record<string, any> = {
  IcTabHome,
  IcTabSearch,
  IcTabLibrary,
  IcTabPremium,
  IcTabCreate,
  IcNavBack,
  IcNavBackArrow,
  IcNavForward,
  IcClose,
  IcCloseCircle,
  IcMore,
  IcMoreVertical,
  IcExpand,
  IcSearch,
  IcAdd,
  IcAddCircle,
  IcCheck,
  IcCheckCircle,
  IcEdit,
  IcDownload,
  IcDownloadCircle,
  IcSort,
  IcPin,
  IcExternalLink,
  IcTimer,
  IcLyrics,
  IcUser,
  IcUsers,
  IcMail,
  IcCamera,
  IcEye,
  IcEyeOff,
  IcLock,
  IcPlay,
  IcPause,
  IcSkipNext,
  IcSkipPrev,
  IcShuffle,
  IcRepeat,
  IcVolume,
  IcHeadphone,
  IcMic,
  IcQueue,
  IcRadio,
  IcQrCode,
  IcDisc,
  IcMusic,
  IcMusicNote,
  IcBell,
  IcSettings,
  IcInfo,
  IcShield,
  IcPhone,
  IcTrend,
  IcChart,
  IcHistory,
  IcClock,
  IcZap,
  IcCompose,
  IcHeart,
  IcShare,
  IcMessage,
  IcGrid,
  IcCard,
  IcAperture,
  IcLauncher,
  SpotifyLogoIcon,
};
