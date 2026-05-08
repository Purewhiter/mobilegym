// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import React from 'react';
import {
  X,
  SlidersHorizontal,
  Navigation,
  Phone,
  Share2,
  Bookmark,
  Check,
  Compass,
  PlusSquare,
  Map,
  MoreVertical,
  Plus,
  Flag,
  Star,
  PlusCircle,
  Edit3,
  Image,
  MessageSquare,
  ChevronRight,
  MapPin,
  Mic,
  Layers,
  Car,
  Bike,
  Footprints,
  Bus,
  MoreHorizontal,
  Utensils,
  Hotel,
  Mountain,
  Trees,
  ArrowLeft,
  ArrowRight,
  ArrowDownUp,
  Clock,
  Globe,
  User,
  Search,
  ShoppingBag,
  Shirt,
  Coffee,
  Settings,
  HelpCircle,
  Download,
  Bell,
  Shield,
  Info,
  Smartphone,
  CloudOff,
  Users,
  TriangleAlert,
  Sparkles,
  ExternalLink,
  ArrowUpRight,
  Home,
  Fuel,
  ShoppingBasket,
} from 'lucide-react';

// ── Navigation / chrome ──────────────────────────────────
export const IcNavBack = ArrowLeft;
export const IcNavForward = ChevronRight;
export const IcNavArrow = ArrowRight;
export const IcClose = X;
export const IcMore = MoreHorizontal;
export const IcMoreVert = MoreVertical;

// ── Common actions ───────────────────────────────────────
export const IcSearch = Search;
export const IcAdd = Plus;
export const IcAddCircle = PlusCircle;
export const IcAddSquare = PlusSquare;
export const IcEdit = Edit3;
export const IcCheck = Check;
export const IcFilter = SlidersHorizontal;
export const IcDownload = Download;
export const IcShare = Share2;
export const IcBookmark = Bookmark;
export const IcFlag = Flag;
export const IcMic = Mic;
export const IcExternalLink = ExternalLink;
export const IcArrowUpRight = ArrowUpRight;

// ── User / Account ───────────────────────────────────────
export const IcUser = User;
export const IcUsers = Users;

// ── Map / Location ───────────────────────────────────────
export const IcLocation = MapPin;
export const IcNavigation = Navigation;
export const IcCompass = Compass;
export const IcMap = Map;
export const IcLayers = Layers;
export const IcStar = Star;
export const IcImage = Image;
export const IcMessageSquare = MessageSquare;

// ── Transport ────────────────────────────────────────────
export const IcCar = Car;
export const IcBike = Bike;
export const IcWalk = Footprints;
export const IcBus = Bus;
/** 起终点交换 */
export const IcSwapVertical = ArrowDownUp;
export const IcPhone = Phone;

// ── POI categories ───────────────────────────────────────
export const IcHome = Home;
export const IcFuel = Fuel;
export const IcFood = Utensils;
export const IcHotel = Hotel;
export const IcMountain = Mountain;
export const IcNature = Trees;
export const IcShop = ShoppingBag;
export const IcClothing = Shirt;
export const IcCoffee = Coffee;
export const IcGrocery = ShoppingBasket;

// ── Notifications / Status ───────────────────────────────
export const IcBell = Bell;
export const IcInfo = Info;
export const IcWarning = TriangleAlert;
export const IcCloud = CloudOff;

// ── Settings / Config ────────────────────────────────────
export const IcSettings = Settings;
export const IcShield = Shield;
export const IcHelp = HelpCircle;
export const IcGlobe = Globe;
export const IcPhone2 = Smartphone;
export const IcFeature = Sparkles;

// ── Time ─────────────────────────────────────────────────
export const IcClock = Clock;

// ── Custom SVG icons ─────────────────────────────────────

/** 交通信息图标（路牌 + 方向组合） */
export const TrafficInfoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M16.5 3.5L16.5 14.5L11 14.5L11 16.5L18.5 16.5L18.5 3.5L16.5 3.5ZM7.5 7.5L7.5 20.5L9.5 20.5L9.5 7.5L7.5 7.5ZM4 7.5L4 9.5L6.5 9.5L6.5 20.5L2 20.5L2 22.5L22 22.5L22 20.5L10.5 20.5L10.5 9.5L13 9.5L13 7.5L4 7.5ZM15.5 1.5L15.5 12.5L21.5 12.5L21.5 1.5L15.5 1.5ZM17.5 3.5L19.5 3.5L19.5 10.5L17.5 10.5L17.5 3.5Z" />
    <path d="M15.41 16.59L10.83 12L15.41 7.41L14 6L8 12L14 18L15.41 16.59Z" fill="currentColor" transform="rotate(180 12 12)" />
  </svg>
);

/** 信息圆圈图标（个性化推荐入口） */
export const InfoCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
  </svg>
);

// ── App launcher ─────────────────────────────────────────
export const IcLauncher = Map;

// ── Registry for dynamic lookup (used by IconRenderer) ───
export const ICON_REGISTRY: Record<string, any> = {
  IcNavBack,
  IcNavForward,
  IcNavArrow,
  IcClose,
  IcMore,
  IcMoreVert,
  IcSearch,
  IcAdd,
  IcAddCircle,
  IcAddSquare,
  IcEdit,
  IcCheck,
  IcFilter,
  IcDownload,
  IcShare,
  IcBookmark,
  IcFlag,
  IcMic,
  IcExternalLink,
  IcArrowUpRight,
  IcUser,
  IcUsers,
  IcLocation,
  IcNavigation,
  IcCompass,
  IcMap,
  IcLayers,
  IcStar,
  IcImage,
  IcCar,
  IcBike,
  IcWalk,
  IcBus,
  IcSwapVertical,
  IcPhone,
  IcHome,
  IcFuel,
  IcFood,
  IcHotel,
  IcMountain,
  IcNature,
  IcShop,
  IcClothing,
  IcCoffee,
  IcGrocery,
  IcBell,
  IcInfo,
  IcWarning,
  IcCloud,
  IcSettings,
  IcShield,
  IcHelp,
  IcGlobe,
  IcPhone2,
  IcFeature,
  IcClock,
  TrafficInfoIcon,
  InfoCircleIcon,
  IcLauncher,
};
