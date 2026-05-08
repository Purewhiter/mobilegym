// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import type { LucideIcon } from 'lucide-react';
export type { LucideIcon };
import type { IconProps } from '@/os/types/res';
export type { IconProps }; // 方便各 app 直接从 icons 导入

import {
  AlertCircle,
  AlertTriangle,
  Aperture,
  ArrowLeftRight,
  AtSign,
  AudioLines,
  Bell,
  BellOff,
  Banknote,
  Bookmark,
  Box,
  Bus,
  Camera,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  Compass,
  CreditCard,
  Crop,
  Delete,
  Disc,
  Droplet,
  Ear,
  FileText,
  Film,
  Folder,
  Gamepad2,
  Gift,
  Grid3X3,
  Heart,
  Infinity,
  KeyRound,
  Languages,
  Lightbulb,
  Lock,
  LockOpen,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  MessageSquareCode,
  Mic,
  MoreHorizontal,
  Music,
  PenTool,
  Phone,
  Plane,
  Play,
  Plus,
  PlusCircle,
  QrCode,
  Radio,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  ShieldOff,
  ShoppingBag,
  Smartphone,
  Smile,
  Sparkles,
  SquareUser,
  Tag,
  Ticket,
  Trash2,
  Type,
  User,
  UserCircle,
  UserPlus,
  Users,
  Video,
  Wallet,
  X,
  XCircle,
  Zap,
  Image,
  Bed,
  Coins,
} from 'lucide-react';

// ── Tab bar ──────────────────────────────────────────────
export const IcTabWechat = MessageSquare;
export const IcTabContacts = Users;
export const IcTabDiscover = Compass;
export const IcTabMe = User;

// ── Navigation / chrome ──────────────────────────────────
export const IcNavBack = ChevronLeft;
export const IcNavForward = ChevronRight;
export const IcClose = X;
export const IcMore = MoreHorizontal;
export const IcExpand = ChevronDown;
export const IcCollapse = ChevronUp;

// ── Common actions ───────────────────────────────────────
export const IcSearch = Search;
export const IcAdd = Plus;
export const IcAddCircle = PlusCircle;
export const IcScan = ScanLine;
export const IcQrCode = QrCode;
export const IcEdit = PenTool;
export const IcDelete = Delete;
export const IcCheck = Check;
export const IcRefresh = RefreshCw;
export const IcRotateCcw = RotateCcw;
export const IcRotateCw = RotateCw;

// ── User / Account ───────────────────────────────────────
export const IcUser = User;
export const IcUserCircle = UserCircle;
export const IcUserAdd = UserPlus;
export const IcContacts = Users;
export const IcAt = AtSign;
export const IcSquareUser = SquareUser;

// ── Notifications / Status ───────────────────────────────
export const IcBell = Bell;
export const IcBellOff = BellOff;
export const IcAlert = AlertCircle;
export const IcCircle = Circle;
export const IcEar = Ear;

// ── Settings / Config ────────────────────────────────────
export const IcSettings = Settings;
export const IcShieldCheck = ShieldCheck;
export const IcLightbulb = Lightbulb;
export const IcLanguages = Languages;
export const IcAccessibility = Sparkles;

// ── Media / Content ──────────────────────────────────────
export const IcCamera = Camera;
export const IcImage = Image;
export const IcVideo = Video;
export const IcPlay = Play;
export const IcMusic = Music;
export const IcDisc = Disc;
export const IcAperture = Aperture;
export const IcFile = FileText;
export const IcFolder = Folder;
export const IcFilm = Film;
export const IcGrid = Grid3X3;
export const IcCrop = Crop;
export const IcType = Type;
export const IcSmile = Smile;
export const IcAudioLines = AudioLines;
export const IcMic = Mic;
export const IcBookmark = Bookmark;

// ── Communication ────────────────────────────────────────
export const IcMessage = MessageCircle;
export const IcMessageSquare = MessageSquare;
export const IcMessageCode = MessageSquareCode;
export const IcMail = Mail;
export const IcPhone = Phone;

// ── Map / Location ───────────────────────────────────────
export const IcLocation = MapPin;
export const IcCompass = Compass;
export const IcInfinity = Infinity;

// ── Finance / Payment ────────────────────────────────────
export const IcWallet = Wallet;
export const IcCard = CreditCard;
export const IcBanknote = Banknote;
export const IcTransfer = ArrowLeftRight;
export const IcCoins = Coins;
export const IcZap = Zap;
export const IcDroplet = Droplet;
export const IcHeart = Heart;

// ── Services / Categories ────────────────────────────────
export const IcBus = Bus;
export const IcCar = Car;
export const IcPlane = Plane;
export const IcBed = Bed;
export const IcShoppingBag = ShoppingBag;
export const IcGift = Gift;
export const IcTicket = Ticket;
export const IcTag = Tag;
export const IcSmartphone = Smartphone;
export const IcBox = Box;
export const IcRadio = Radio;
export const IcGamepad = Gamepad2;
export const IcSparkles = Sparkles;

// ── Discovery items ──────────────────────────────────────
export const IcTrash = Trash2;

// ── Security Center ─────────────────────────────────────
export const IcKeyRound = KeyRound;
export const IcShieldOff = ShieldOff;
export const IcLock = Lock;
export const IcLockOpen = LockOpen;
export const IcAlertTriangle = AlertTriangle;
export const IcXCircle = XCircle;

// ── App launcher ─────────────────────────────────────────
export const IcLauncher: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M10.5 4C6.358 4 3 6.985 3 10.667c0 2.14 1.254 4.05 3.333 5.333L5 19l3.444-1.722A9.89 9.89 0 0 0 10.5 17.5c4.142 0 7.5-2.985 7.5-6.667S14.642 4 10.5 4zm-2.5 5.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zm5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z" />
    <path d="M17.5 11.5c-3.038 0-5.5 2.127-5.5 4.75 0 2.623 2.462 4.75 5.5 4.75a6.03 6.03 0 0 0 2.139-.396L22 22l-.917-2.292c1.464-1.083 2.417-2.73 2.417-4.458 0-2.623-2.462-4.75-5.5-4.75zm-1.5 3a1 1 0 1 1 0 2 1 1 0 0 1 0-2zm3 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2z" />
  </svg>
);

/** 面对面建群数字键盘退格键图标 */
export const BackspaceIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
    <line x1="18" y1="9" x2="12" y2="15" />
    <line x1="12" y1="9" x2="18" y2="15" />
  </svg>
);

// ── Registry for dynamic lookup ──────────────────────────
export const ICON_REGISTRY: Record<string, any> = {
  IcTabWechat,
  IcTabContacts,
  IcTabDiscover,
  IcTabMe,
  IcNavBack,
  IcNavForward,
  IcClose,
  IcMore,
  IcExpand,
  IcCollapse,
  IcSearch,
  IcAdd,
  IcAddCircle,
  IcScan,
  IcQrCode,
  IcEdit,
  IcDelete,
  IcCheck,
  IcRefresh,
  IcRotateCcw,
  IcRotateCw,
  IcUser,
  IcUserCircle,
  IcUserAdd,
  IcContacts,
  IcAt,
  IcSquareUser,
  IcBell,
  IcBellOff,
  IcAlert,
  IcCircle,
  IcEar,
  IcSettings,
  IcShieldCheck,
  IcLightbulb,
  IcLanguages,
  IcAccessibility,
  IcCamera,
  IcImage,
  IcVideo,
  IcPlay,
  IcMusic,
  IcDisc,
  IcAperture,
  IcFile,
  IcFolder,
  IcFilm,
  IcGrid,
  IcCrop,
  IcType,
  IcSmile,
  IcAudioLines,
  IcMic,
  IcBookmark,
  IcMessage,
  IcMessageSquare,
  IcMessageCode,
  IcMail,
  IcPhone,
  IcLocation,
  IcCompass,
  IcInfinity,
  IcWallet,
  IcCard,
  IcBanknote,
  IcTransfer,
  IcCoins,
  IcZap,
  IcDroplet,
  IcHeart,
  IcBus,
  IcCar,
  IcPlane,
  IcBed,
  IcShoppingBag,
  IcGift,
  IcTicket,
  IcTag,
  IcSmartphone,
  IcBox,
  IcRadio,
  IcGamepad,
  IcSparkles,
  IcTrash,
  IcKeyRound,
  IcShieldOff,
  IcLock,
  IcLockOpen,
  IcAlertTriangle,
  IcXCircle,
  IcLauncher,
  BackspaceIcon,
};
