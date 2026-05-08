// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import React from 'react';
import {
  Accessibility,
  AlertCircle,
  ArrowLeftRight,
  ArrowRightLeft,
  Bell,
  Building2,
  Bus,
  CalendarClock,
  CalendarDays,
  Car,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  CirclePlus,
  ClipboardList,
  Clock,
  Clock3,
  Coins,
  Copy,
  CreditCard,
  FileSearch,
  FileText,
  Filter,
  Fingerprint,
  Gift,
  Globe,
  GraduationCap,
  Heart,
  HeartHandshake,
  HelpCircle,
  Info,
  Loader,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Monitor,
  MoreHorizontal,
  Mountain,
  Navigation,
  PencilLine,
  Phone,
  Plane,
  Receipt,
  Repeat,
  RotateCw,
  ScanLine,
  Search,
  Settings,
  Shield,
  ShieldPlus,
  Ship,
  ShoppingBag,
  Smartphone,
  Ticket,
  TicketX,
  Timer,
  Train,
  Truck,
  UserCheck,
  UserPlus,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
} from 'lucide-react';

// ── Tab bar ───────────────────────────────────────────────
export const IcTabHome = Monitor;          // 首页 tab (uses app bitmap; lucide fallback)
export const IcTabTravel = Car;            // 出行服务 tab
export const IcTabOrders = FileText;       // 订单 tab
export const IcTabMember = Train;          // 铁路会员 tab
export const IcTabMe = Users;              // 我的 tab

// ── Navigation / chrome ───────────────────────────────────
export const IcNavBack = ChevronLeft;
export const IcNavForward = ChevronRight;
export const IcClose = X;
export const IcMore = MoreHorizontal;
export const IcExpand = ChevronDown;
export const IcCollapse = ChevronUp;

// ── Common actions ────────────────────────────────────────
export const IcSearch = Search;
export const IcAdd = CirclePlus;
export const IcScan = ScanLine;
export const IcFilter = Filter;
export const IcCopy = Copy;
export const IcEdit = PencilLine;
export const IcCheck = Check;
export const IcCheckCircle = CheckCircle;
export const IcRefresh = RotateCw;
export const IcRepeat = Repeat;
export const IcSwap = ArrowLeftRight;
export const IcSwapAlt = ArrowRightLeft;
export const IcLoader = Loader;

// ── User / Account ────────────────────────────────────────
export const IcUser = Users;
export const IcUserAdd = UserPlus;
export const IcUserCheck = UserCheck;
export const IcFingerprint = Fingerprint;
export const IcLock = Lock;
export const IcPhone = Smartphone;
export const IcPhoneDevice = Smartphone;      // alias used in constants.ts icon strings
export const IcPhoneCall = Phone;

// ── Travel / Transport ────────────────────────────────────
export const IcTrain = Train;
export const IcFlight = Plane;
export const IcBus = Bus;
export const IcCar = Car;
export const IcShip = Ship;
export const IcTruck = Truck;
export const IcNavigation = Navigation;

// ── Finance / Payment ─────────────────────────────────────
export const IcCard = CreditCard;
export const IcWallet = Wallet;
export const IcCoins = Coins;
export const IcPay = CircleDollarSign;
export const IcDollar = CircleDollarSign;     // alias used in constants.ts icon strings
export const IcReceipt = Receipt;
export const IcTransfer = ArrowLeftRight;

// ── Booking / Orders ──────────────────────────────────────
export const IcTicket = Ticket;
export const IcTicketX = TicketX;
export const IcTicketCancel = TicketX;        // alias used in constants.ts icon strings
export const IcClipboard = ClipboardList;
export const IcFile = FileText;

// ── Notifications / Status ────────────────────────────────
export const IcBell = Bell;
export const IcInfo = Info;
export const IcWarning = AlertCircle;

// ── Settings / Config ─────────────────────────────────────
export const IcSettings = Settings;
export const IcShield = Shield;
export const IcShieldPlus = ShieldPlus;
export const IcGlobe = Globe;

// ── Date / Time ───────────────────────────────────────────
export const IcClock = Clock;
export const IcClock3 = Clock3;
export const IcTimer = Timer;
export const IcCalendar = CalendarDays;
export const IcCalendarClock = CalendarClock;

// ── Location ──────────────────────────────────────────────
export const IcLocation = MapPin;
export const IcMapPin = MapPin;               // alias used in constants.ts icon strings

// ── Services / Places ─────────────────────────────────────
export const IcBuilding = Building2;
export const IcMonitor = Monitor;
export const IcHeart = Heart;
export const IcHeartHandshake = HeartHandshake;
export const IcGift = Gift;
export const IcMountain = Mountain;
export const IcFood = UtensilsCrossed;
export const IcShoppingBag = ShoppingBag;
export const IcShopping = ShoppingBag;        // alias used in constants.ts icon strings
export const IcEducation = GraduationCap;
export const IcGraduation = GraduationCap;    // alias used in constants.ts icon strings
export const IcAccessibility = Accessibility;
export const IcHelp = HelpCircle;

// ── Messaging ─────────────────────────────────────────────
export const IcMessage = MessageSquare;
export const IcMessageCircle = MessageCircle;
export const IcChat = MessageCircle;          // alias used in constants.ts icon strings
export const IcMail = Mail;

// ── Media / Content ───────────────────────────────────────
export const IcFileSearch = FileSearch;

// ── App launcher ──────────────────────────────────────────
export const IcLauncher = Train;

// ── Custom SVG icons ─────────────────────────────────────

/** 省略号（三点）图标，用于查询结果页更多操作按钮 */
export const EllipsisIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" {...props}>
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
);

/** 直达/旗帜路线图标，用于查询结果 Tab 直达标签 */
export const DirectRouteIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

// ── Registry for dynamic lookup (ICON_MAP in ServiceGrid / constants.ts icon strings) ──
// Keys must match the string values in constants.ts "icon" fields (all Ic* prefixed)
export const ICON_REGISTRY: Record<string, any> = {
  // Tab icons
  IcTabHome,
  IcTabTravel,
  IcTabOrders,
  IcTabMember,
  IcTabMe,
  // Navigation
  IcNavBack,
  IcNavForward,
  IcClose,
  IcMore,
  IcExpand,
  IcCollapse,
  // Actions
  IcSearch,
  IcAdd,
  IcScan,
  IcFilter,
  IcCopy,
  IcEdit,
  IcCheck,
  IcCheckCircle,
  IcRefresh,
  IcRepeat,
  IcSwap,
  IcSwapAlt,
  IcLoader,
  // User
  IcUser,
  IcUserAdd,
  IcUserCheck,
  IcFingerprint,
  IcLock,
  IcPhone,
  IcPhoneDevice,
  IcPhoneCall,
  // Transport
  IcTrain,
  IcFlight,
  IcBus,
  IcCar,
  IcShip,
  IcTruck,
  IcNavigation,
  // Finance
  IcCard,
  IcWallet,
  IcCoins,
  IcPay,
  IcDollar,
  IcReceipt,
  IcTransfer,
  // Orders
  IcTicket,
  IcTicketX,
  IcTicketCancel,
  IcClipboard,
  IcFile,
  // Notifications
  IcBell,
  IcInfo,
  IcWarning,
  // Settings
  IcSettings,
  IcShield,
  IcShieldPlus,
  IcGlobe,
  // Date/Time
  IcClock,
  IcClock3,
  IcTimer,
  IcCalendar,
  IcCalendarClock,
  // Location
  IcLocation,
  IcMapPin,
  // Services
  IcBuilding,
  IcMonitor,
  IcHeart,
  IcHeartHandshake,
  IcGift,
  IcMountain,
  IcFood,
  IcShoppingBag,
  IcShopping,
  IcEducation,
  IcGraduation,
  IcAccessibility,
  IcHelp,
  // Messaging
  IcMessage,
  IcMessageCircle,
  IcChat,
  IcMail,
  // Media
  IcFileSearch,
  // Launcher
  IcLauncher,
};
