// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import React from 'react';
import {
  // Tab bar
  Home,
  Search,
  Bell,
  Mail,
  SquareSlash,

  // Navigation
  ArrowLeft,
  X,
  ChevronRight,
  ChevronDown,

  // User / Social
  User,
  Users,
  UserMinus,
  BadgeCheck,

  // Actions / Controls
  Plus,
  PlusCircle,
  Settings,
  HelpCircle,
  Download,
  Star,
  Bookmark,
  Clock,
  MoveUp,
  Send,
  Lock,
  Key,
  Check,
  MoreHorizontal,

  // Content
  Play,
  List,
  Globe,
  BarChart2,
  BarChart,
  Repeat2,
  Heart,
  HeartCrack,
  MessageCircle,
  Share,
  Info,
  FileText,
  LayoutList,
  ArrowUpDown,

  // Privacy / Security
  Eye,
  ShieldCheck,
  ShieldOff,
  Radio,
  Link,

  // Notification / Settings
  SlidersHorizontal,
  Cog,

  // Media
  Image,
  Camera,
  Mic,
  Paperclip,
  AlignLeft,
  PenSquare,

  // Emoji / Status
  Smile,
  FlaskConical,
  Balloon,

  // Location / Time
  MapPin,
  Calendar,

  // App identity
  Twitter,
} from 'lucide-react';
export type { LucideIcon } from 'lucide-react';

// === Tab Bar Icons ===
export const IcTabHome = Home;
export const IcTabSearch = Search;
export const IcTabGrok = SquareSlash;
export const IcTabNotifications = Bell;
export const IcTabMessages = Mail;

// === Navigation ===
export const IcNavBack = ArrowLeft;
export const IcClose = X;
export const IcChevronRight = ChevronRight;
export const IcChevronDown = ChevronDown;

// === User / Social ===
export const IcUser = User;
export const IcContacts = Users;
export const IcUserMinus = UserMinus;
export const IcBadgeCheck = BadgeCheck;

// === Actions / Controls ===
export const IcAdd = Plus;
export const IcAddCircle = PlusCircle;
export const IcSettings = Settings;
export const IcHelp = HelpCircle;
export const IcDownload = Download;
export const IcStar = Star;
export const IcBookmark = Bookmark;
export const IcClock = Clock;
export const IcSend = MoveUp;
export const IcSendArrow = Send;
export const IcLock = Lock;
export const IcKey = Key;
export const IcCheck = Check;
export const IcMore = MoreHorizontal;

// === Content ===
export const IcPlay = Play;
export const IcList = List;
export const IcGlobe = Globe;
export const IcChart = BarChart2;
export const IcBarChart = BarChart;
export const IcRepost = Repeat2;
export const IcHeart = Heart;
export const IcHeartCrack = HeartCrack;
export const IcMessage = MessageCircle;
export const IcShare = Share;
export const IcInfo = Info;
export const IcFileText = FileText;
export const IcLayoutList = LayoutList;
export const IcSort = ArrowUpDown;

// === Privacy / Security ===
export const IcEye = Eye;
export const IcShieldCheck = ShieldCheck;
export const IcShieldOff = ShieldOff;
export const IcRadio = Radio;
export const IcLink = Link;

// === Notification / Settings ===
export const IcSliders = SlidersHorizontal;
export const IcCog = Cog;

// === Media ===
export const IcImage = Image;
export const IcCamera = Camera;
export const IcMic = Mic;
export const IcAttach = Paperclip;
export const IcAlign = AlignLeft;
export const IcCompose = PenSquare;

// === Emoji / Status ===
export const IcSmile = Smile;
export const IcLab = FlaskConical;
export const IcBalloon = Balloon;

// === Location / Time ===
export const IcLocation = MapPin;
export const IcCalendar = Calendar;

// === Custom SVG Components ===
interface XLogoIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
}

export const XLogoIcon: React.FC<XLogoIconProps> = ({ size = 24, className, ...props }) => {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
};

// App launcher icon alias
export const IcLauncher = XLogoIcon;

// === ICON_REGISTRY for dynamic lookup ===
export const ICON_REGISTRY: Record<string, any> = {
  IcTabHome,
  IcTabSearch,
  IcTabGrok,
  IcTabNotifications,
  IcTabMessages,
  IcNavBack,
  IcClose,
  IcChevronRight,
  IcChevronDown,
  IcUser,
  IcContacts,
  IcUserMinus,
  IcBadgeCheck,
  IcAdd,
  IcAddCircle,
  IcSettings,
  IcHelp,
  IcDownload,
  IcStar,
  IcBookmark,
  IcClock,
  IcSend,
  IcSendArrow,
  IcLock,
  IcKey,
  IcCheck,
  IcMore,
  IcPlay,
  IcList,
  IcGlobe,
  IcChart,
  IcBarChart,
  IcRepost,
  IcHeart,
  IcHeartCrack,
  IcMessage,
  IcShare,
  IcInfo,
  IcFileText,
  IcLayoutList,
  IcSort,
  IcEye,
  IcShieldCheck,
  IcShieldOff,
  IcRadio,
  IcLink,
  IcSliders,
  IcCog,
  IcImage,
  IcCamera,
  IcMic,
  IcAttach,
  IcAlign,
  IcCompose,
  IcSmile,
  IcLab,
  IcBalloon,
  IcLocation,
  IcCalendar,
  XLogoIcon,
  IcLauncher,
};
