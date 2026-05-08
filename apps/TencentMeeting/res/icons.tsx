// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import {
  Video,
  BookUser,
  User,
  Settings,
  Scan,
  ChevronRight,
  Monitor,
  FileText,
  Bot,
  ShoppingBag,
  Info,
  Moon,
  Headset,
  ChevronDown,
  X,
  Check,
  AudioWaveform,
  MessageSquare,
  ChevronLeft,
  Hexagon,
  Copy,
  Search,
  UserPlus,
  Mail,
  Mic,
  MicOff,
  VideoOff,
  ScreenShare,
  Users,
  Menu,
  Volume2,
  Minimize2,
  Smile,
  ExternalLink,
  Subtitles,
  QrCode,
  Image,
  Pencil,
  MoreHorizontal,
  Clock,
  Download,
  Bell,
  Gift,
  Plus,
  Zap,
  Calendar,
  Cast,
  Laptop,
  Tablet,
  Globe,
  Smartphone,
  CalendarDays,
  Layout,
  Captions,
  Disc,
  Hand,
  UserCog,
  Share,
  StopCircle,
  Edit2,
} from 'lucide-react';

// ── Tab bar ───────────────────────────────────────────────
export const IcTabMeeting = Video;
export const IcTabContacts = BookUser;
export const IcTabMe = User;

// ── Navigation / chrome ──────────────────────────────────
export const IcNavBack = ChevronLeft;
export const IcNavForward = ChevronRight;
export const IcClose = X;
export const IcMore = MoreHorizontal;
export const IcExpand = ChevronDown;

// ── Common actions ───────────────────────────────────────
export const IcSearch = Search;
export const IcAdd = Plus;
export const IcScan = Scan;
export const IcQrCode = QrCode;
export const IcEdit = Pencil;
export const IcCopy = Copy;
export const IcDownload = Download;
export const IcCheck = Check;

// ── User / Account ───────────────────────────────────────
export const IcUser = User;
export const IcUserAdd = UserPlus;
export const IcContacts = BookUser;
export const IcBadge = Hexagon;

// ── Meeting actions ──────────────────────────────────────
export const IcMic = Mic;
export const IcMicOff = MicOff;
export const IcVideo = Video;
export const IcVideoOff = VideoOff;
export const IcScreenShare = ScreenShare;
export const IcParticipants = Users;
export const IcMenu = Menu;
export const IcVolume = Volume2;
export const IcMinimize = Minimize2;
export const IcSubtitles = Subtitles;
export const IcCast = Cast;

// ── Notifications / Status ───────────────────────────────
export const IcBell = Bell;
export const IcInfo = Info;
export const IcGift = Gift;
export const IcClock = Clock;

// ── Settings / Config ────────────────────────────────────
export const IcSettings = Settings;
export const IcMoon = Moon;
export const IcHeadset = Headset;
export const IcGlobe = Globe;

// ── Media / Content ──────────────────────────────────────
export const IcAudio = AudioWaveform;
export const IcMessage = MessageSquare;
export const IcFile = FileText;
export const IcImage = Image;
export const IcCalendar = Calendar;
export const IcCalendarDays = CalendarDays;

// ── Services ─────────────────────────────────────────────
export const IcBot = Bot;
export const IcShop = ShoppingBag;
export const IcMonitor = Monitor;
export const IcLaptop = Laptop;
export const IcTablet = Tablet;
export const IcPhone = Smartphone;
export const IcMail = Mail;
export const IcSmile = Smile;
export const IcExternalLink = ExternalLink;
export const IcFastPay = Zap;

// ── Meeting in-call extras ────────────────────────────────
export const IcLayout = Layout;
export const IcCaptions = Captions;
export const IcDisc = Disc;
export const IcHand = Hand;
export const IcUserCog = UserCog;
export const IcShare = Share;
export const IcStopCircle = StopCircle;
export const IcEdit2 = Edit2;

// ── App launcher ─────────────────────────────────────────
export const IcLauncher = Video;

// ── Registry for dynamic lookup (used by IconRenderer) ───
export const ICON_REGISTRY: Record<string, any> = {
  IcTabMeeting,
  IcTabContacts,
  IcTabMe,
  IcNavBack,
  IcNavForward,
  IcClose,
  IcMore,
  IcExpand,
  IcSearch,
  IcAdd,
  IcScan,
  IcQrCode,
  IcEdit,
  IcCopy,
  IcDownload,
  IcCheck,
  IcUser,
  IcUserAdd,
  IcContacts,
  IcBadge,
  IcMic,
  IcMicOff,
  IcVideo,
  IcVideoOff,
  IcScreenShare,
  IcParticipants,
  IcMenu,
  IcVolume,
  IcMinimize,
  IcSubtitles,
  IcCast,
  IcBell,
  IcInfo,
  IcGift,
  IcClock,
  IcSettings,
  IcMoon,
  IcHeadset,
  IcGlobe,
  IcAudio,
  IcMessage,
  IcFile,
  IcImage,
  IcCalendar,
  IcCalendarDays,
  IcBot,
  IcShop,
  IcMonitor,
  IcLaptop,
  IcTablet,
  IcPhone,
  IcMail,
  IcSmile,
  IcExternalLink,
  IcFastPay,
  IcLayout,
  IcCaptions,
  IcDisc,
  IcHand,
  IcUserCog,
  IcShare,
  IcStopCircle,
  IcEdit2,
  IcLauncher,
};
