// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import React from 'react';
import {
  Aperture,
  ArrowLeft,
  AtSign,
  BarChart2,
  Bell,
  Book,
  BookOpen,
  Bus,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Clock,
  Download,
  Eye,
  FileText,
  Flag,
  FlaskConical,
  Frown,
  Hash,
  Headphones,
  Heart,
  HelpCircle,
  Image,
  Info,
  Languages,
  LayoutGrid,
  Lightbulb,
  Link,
  ListFilter,
  Lock,
  MapPin,
  Menu,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Plus,
  PlusCircle,
  Quote,
  Reply,
  RotateCcw,
  ScanLine,
  Search,
  Send,
  Settings,
  Share2,
  ShoppingCart,
  SlidersHorizontal,
  Sliders,
  Smile,
  Star,
  Trash2,
  Umbrella,
  UserCircle,
  UserPlus,
  Users,
  Wallet,
  X,
} from 'lucide-react';

// ── Tab bar ──────────────────────────────────────────────
export const IcTabHome = Aperture;
export const IcTabSearch = Search;
export const IcTabPublish = PlusCircle;
export const IcTabMessage = MessageSquare;
export const IcTabMe = UserCircle;

// ── Navigation / chrome ──────────────────────────────────
export const IcNavBack = ChevronLeft;
export const IcNavBackArrow = ArrowLeft;
export const IcNavForward = ChevronRight;
export const IcClose = X;
export const IcMore = MoreHorizontal;
export const IcExpand = ChevronDown;
export const IcCollapse = ChevronUp;
export const IcMenu = Menu;

// ── Common actions ───────────────────────────────────────
export const IcSearch = Search;
export const IcAdd = Plus;
export const IcAddCircle = PlusCircle;
export const IcScan = ScanLine;
export const IcEdit = AtSign; // placeholder — AtSign used for mention/edit in publish
export const IcDelete = Trash2;
export const IcShare = Share2;
export const IcSend = Send;
export const IcRefresh = RotateCcw;
export const IcFilter = ListFilter;
export const IcSliders = Sliders;
export const IcSlidersH = SlidersHorizontal;
export const IcCheck = Check;
export const IcLink = Link;
export const IcFlag = Flag;
export const IcHash = Hash;
export const IcAt = AtSign;
export const IcQuote = Quote;
export const IcReply = Reply;
export const IcFrown = Frown;
export const IcSmile = Smile;

// ── User / Account ───────────────────────────────────────
export const IcUser = UserCircle;
export const IcUserAdd = UserPlus;
export const IcContacts = Users;
export const IcLock = Lock;
export const IcEye = Eye;

// ── Notifications ────────────────────────────────────────
export const IcBell = Bell;
export const IcInfo = Info;

// ── Social ────────────────────────────────────────────────
export const IcHeart = Heart;
export const IcStar = Star;
export const IcMessage = MessageSquare;
export const IcMessageCircle = MessageCircle;

// ── Media / Content ──────────────────────────────────────
export const IcCamera = Camera;
export const IcImage = Image;
export const IcDownload = Download;
export const IcFile = FileText;
export const IcClipboard = ClipboardList;

// ── Services ─────────────────────────────────────────────
export const IcClock = Clock;
export const IcCart = ShoppingCart;
export const IcWallet = Wallet;
export const IcHeadphone = Headphones;
export const IcLocation = MapPin;
export const IcGrid = LayoutGrid;
export const IcBookOpen = BookOpen;
export const IcLanguages = Languages;
export const IcUmbrella = Umbrella;
export const IcLab = FlaskConical;
export const IcLightbulb = Lightbulb;
export const IcBus = Bus;

// ── Settings / Config ────────────────────────────────────
export const IcSettings = Settings;
export const IcHelp = HelpCircle;
export const IcChart = BarChart2;

// ── App launcher ─────────────────────────────────────────
export const IcLauncher: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 1024 1024" fill="currentColor" {...props}>
    <text x="512" y="680" fontSize="400" fontWeight="900" fontFamily="sans-serif" textAnchor="middle" fill="currentColor">RED</text>
  </svg>
);

// ── Custom SVG components ────────────────────────────────

// Play triangle icon (video badge on note card)
export const RedBookPlayIcon: React.FC<{ size?: number; className?: string }> = ({ size = 12, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="white" stroke="none" className={className}>
        <path d="M5 3l14 9-14 9V3z" />
    </svg>
);

// Heart (liked state) — filled, colored via fill/stroke at usage site
export const RedBookHeartFilledIcon: React.FC<{ size?: number; className?: string }> = ({ size = 13, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor" stroke="currentColor" strokeWidth="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
);

// Heart (unliked state) — outline only
export const RedBookHeartOutlineIcon: React.FC<{ size?: number; className?: string }> = ({ size = 13, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="1.5" className={className}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
);

// Heart (stroke, currentColor — used in FollowFeed row)
export const RedBookHeartIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
);

// Comment bubble icon (FollowFeed row)
export const RedBookCommentIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
);

// People/group icon (empty follow state placeholder)
export const RedBookPeopleIcon: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className={className}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);

// Flame/trending icon (SearchPage hot section)
export const RedBookFlameIcon: React.FC<{ size?: number; className?: string }> = ({ size = 14, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} fill="currentColor" stroke="none">
        <path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a5.5 5.5 0 11-11 0c0-3.042 2.235-5.5 5.106-5.5h.056c.632 0 1.338.138 1.838.5z" />
    </svg>
);

// ── Registry for dynamic lookup ──────────────────────────
export const ICON_REGISTRY: Record<string, any> = {
  IcTabHome,
  IcTabSearch,
  IcTabPublish,
  IcTabMessage,
  IcTabMe,
  IcNavBack,
  IcNavBackArrow,
  IcNavForward,
  IcClose,
  IcMore,
  IcExpand,
  IcCollapse,
  IcMenu,
  IcSearch,
  IcAdd,
  IcAddCircle,
  IcScan,
  IcEdit,
  IcDelete,
  IcShare,
  IcSend,
  IcRefresh,
  IcFilter,
  IcSliders,
  IcSlidersH,
  IcCheck,
  IcLink,
  IcFlag,
  IcHash,
  IcAt,
  IcQuote,
  IcReply,
  IcFrown,
  IcSmile,
  IcUser,
  IcUserAdd,
  IcContacts,
  IcLock,
  IcEye,
  IcBell,
  IcInfo,
  IcHeart,
  IcStar,
  IcMessage,
  IcMessageCircle,
  IcCamera,
  IcImage,
  IcDownload,
  IcFile,
  IcClipboard,
  IcClock,
  IcCart,
  IcWallet,
  IcHeadphone,
  IcLocation,
  IcGrid,
  IcBookOpen,
  IcLanguages,
  IcUmbrella,
  IcLab,
  IcLightbulb,
  IcBus,
  IcSettings,
  IcHelp,
  IcChart,
  IcLauncher,
  RedBookPlayIcon,
  RedBookHeartFilledIcon,
  RedBookHeartOutlineIcon,
  RedBookHeartIcon,
  RedBookCommentIcon,
  RedBookPeopleIcon,
  RedBookFlameIcon,
};
