// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import {
  Home,
  User,
  Search,
  Bell,
  Tag,
  ShoppingBag,
  ArrowLeft,
  ShoppingCart,
  Mail,
  ChevronRight,
  Heart,
  RotateCcw,
  X,
  Package,
  Gavel,
  History,
  ThumbsUp,
  ThumbsDown,
  Info,
  Camera,
  ReceiptText,
  ArrowUpDown,
  Filter,
  Check,
  Grid,
  List,
  Monitor,
  Settings,
  ChevronDown,
  Zap,
  ShieldCheck,
  Share2,
  MoreHorizontal,
  Minus,
  Plus,
  MessageSquare,
  Star,
  Truck,
} from 'lucide-react';

// ── Tab bar ───────────────────────────────────────────────
export const IcTabHome = Home;
export const IcTabMe = User;
export const IcTabSearch = Search;
export const IcTabBell = Bell;
export const IcTabSell = Tag;

// ── Navigation / chrome ──────────────────────────────────
export const IcNavBack = ArrowLeft;
export const IcNavForward = ChevronRight;
export const IcClose = X;
export const IcExpand = ChevronDown;

// ── Common actions ───────────────────────────────────────
export const IcSearch = Search;
export const IcCamera = Camera;
export const IcFilter = Filter;
export const IcSort = ArrowUpDown;
export const IcCheck = Check;
export const IcGrid = Grid;
export const IcList = List;

// ── User / Account ───────────────────────────────────────
export const IcUser = User;
export const IcMail = Mail;

// ── Commerce / Shopping ──────────────────────────────────
export const IcCart = ShoppingCart;
export const IcShop = ShoppingBag;
export const IcHeart = Heart;
export const IcTag = Tag;
export const IcPackage = Package;
export const IcReceipt = ReceiptText;
export const IcGavel = Gavel;
export const IcHistory = History;
export const IcLike = ThumbsUp;
export const IcDislike = ThumbsDown;

// ── Notifications / Status ───────────────────────────────
export const IcBell = Bell;
export const IcInfo = Info;

// ── Settings / Config ────────────────────────────────────
export const IcSettings = Settings;
export const IcMonitor = Monitor;
export const IcShield = ShieldCheck;
export const IcRefresh = RotateCcw;
export const IcFastPay = Zap;
export const IcShare = Share2;
export const IcMore = MoreHorizontal;
export const IcMinus = Minus;
export const IcPlus = Plus;
export const IcMessage = MessageSquare;
export const IcStar = Star;
export const IcTruck = Truck;

// ── App launcher ─────────────────────────────────────────
export const IcLauncher = ShoppingBag;

// ── Registry for dynamic lookup (used by IconRenderer) ───
export const ICON_REGISTRY: Record<string, any> = {
  IcTabHome,
  IcTabMe,
  IcTabSearch,
  IcTabBell,
  IcTabSell,
  IcNavBack,
  IcNavForward,
  IcClose,
  IcExpand,
  IcSearch,
  IcCamera,
  IcFilter,
  IcSort,
  IcCheck,
  IcGrid,
  IcList,
  IcUser,
  IcMail,
  IcCart,
  IcShop,
  IcHeart,
  IcTag,
  IcPackage,
  IcReceipt,
  IcGavel,
  IcHistory,
  IcLike,
  IcDislike,
  IcBell,
  IcInfo,
  IcSettings,
  IcMonitor,
  IcShield,
  IcRefresh,
  IcFastPay,
  IcShare,
  IcMore,
  IcMinus,
  IcPlus,
  IcMessage,
  IcStar,
  IcTruck,
  IcLauncher,
};
