// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import React from 'react';
import {
  AlignLeft,
  Aperture,
  ArrowUpDown,
  Award,
  Baby,
  BadgeCheck,
  Ban,
  BarChart2,
  BatteryCharging,
  BookOpen,
  Calendar,
  Calculator,
  Camera,
  Car,
  Cast,
  Cat,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clapperboard,
  Clock,
  Coffee,
  Coins,
  Cpu,
  Download,
  Dumbbell,
  Eye,
  Film,
  Flame,
  Forward,
  Gamepad2,
  GraduationCap,
  Grid,
  Headphones,
  Heart,
  HeartPulse,
  History,
  Home,
  Image,
  LayoutList,
  Lightbulb,
  ListFilter,
  Mail,
  MapPin,
  Medal,
  Menu,
  MessageCircle,
  MessageSquare,
  MessageSquareText,
  Mic,
  MonitorPlay,
  Moon,
  MoreHorizontal,
  MoreVertical,
  Music,
  Newspaper,
  Palette,
  Pause,
  CirclePause,
  PencilLine,
  Plane,
  Play,
  PlayCircle,
  PlaySquare,
  Plus,
  PlusCircle,
  QrCode,
  Radio,
  RefreshCw,
  Scan,
  Scissors,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Sprout,
  SquarePen,
  Star,
  Store,
  Tent,
  ThumbsDown,
  ThumbsUp,
  Ticket,
  Trash2,
  TrendingUp,
  Trophy,
  Tv,
  Upload,
  User,
  Utensils,
  VenetianMask,
  Video,
  Volume2,
  VolumeX,
  Wallet,
  Wrench,
  X,
  Zap,
  ZapOff,
} from 'lucide-react';

// ── Tab bar ──────────────────────────────────────────────
export const IcTabHome = Home;
export const IcTabFollowing = Aperture;
export const IcTabPublish = PlusCircle;
export const IcTabShop = ShoppingBag;
export const IcTabMe = User;

// ── Navigation / chrome ──────────────────────────────────
export const IcNavBack = ChevronLeft;
export const IcNavForward = ChevronRight;
export const IcClose = X;
export const IcMore = MoreHorizontal;
export const IcMoreVertical = MoreVertical;
export const IcExpand = ChevronDown;
export const IcMenu = Menu;

// ── Common actions ───────────────────────────────────────
export const IcSearch = Search;
export const IcSearchInput = Mail; // mail icon reused for "inbox" style search results area
export const IcAdd = Plus;
export const IcAddCircle = PlusCircle;
export const IcEdit = PencilLine;
export const IcEditSquare = SquarePen;
export const IcDelete = Trash2;
export const IcShare = Share2;
export const IcSend = Send;
export const IcRefresh = RefreshCw;
export const IcFilter = ListFilter;
export const IcSortUpDown = ArrowUpDown;
export const IcAlignLeft = AlignLeft;
export const IcCheck = Check;
export const IcCheckCircle = CheckCircle2;
export const IcBadgeCheck = BadgeCheck;

// ── User / Account ───────────────────────────────────────
export const IcUser = User;
export const IcQrCode = QrCode;
export const IcScan = Scan;
export const IcMail = Mail;

// ── Media / Content ──────────────────────────────────────
export const IcPlay = Play;
export const IcPlayCircle = PlayCircle;
export const IcPlaySquare = PlaySquare;
export const IcMonitorPlay = MonitorPlay;
export const IcPause = Pause;
export const IcPauseCircle = CirclePause;
export const IcVideo = Video;
export const IcFilm = Film;
export const IcCamera = Camera;
export const IcImage = Image;
export const IcMusic = Music;
export const IcMic = Mic;
export const IcVolume = Volume2;
export const IcMute = VolumeX;
export const IcClapperboard = Clapperboard;
export const IcMovie = Clapperboard;
export const IcMessageSquareText = MessageSquareText;
export const IcForward = Forward;
export const IcUpload = Upload;
export const IcDownload = Download;
export const IcEye = Eye;

// ── Social ────────────────────────────────────────────────
export const IcLike = ThumbsUp;
export const IcDislike = ThumbsDown;
export const IcHeart = Heart;
export const IcHeartPulse = HeartPulse;
export const IcMessage = MessageSquare;
export const IcMessageCircle = MessageCircle;

// ── Services ─────────────────────────────────────────────
export const IcHistory = History;
export const IcClock = Clock;
export const IcCalendar = Calendar;
export const IcStar = Star;
export const IcBookOpen = BookOpen;
export const IcWallet = Wallet;
export const IcCoins = Coins;
export const IcCart = ShoppingCart;
export const IcGrid = Grid;
export const IcTicket = Ticket;
export const IcGift = Award;
export const IcAward = Award;
export const IcTrophy = Trophy;
export const IcTrend = TrendingUp;
export const IcChart = BarChart2;
export const IcMedal = Medal;
export const IcLocation = MapPin;
export const IcHeadphone = Headphones;
export const IcRadio = Radio;
export const IcStore = Store;
export const IcBan = Ban;
export const IcCalculator = Calculator;

// ── Settings / Config ────────────────────────────────────
export const IcSettings = Settings;
export const IcShield = Shield;
export const IcLightning = Zap;
export const IcLightningOff = ZapOff;
export const IcMoon = Moon;

// ── Partition categories (app-specific) ──────────────────
export const IcAnime = Tv;
export const IcVariety = Mic;
export const IcEntertainment = Zap;
export const IcDance = VenetianMask;
export const IcPainting = Palette;
export const IcGaming = Gamepad2;
export const IcNews = Newspaper;
export const IcKnowledge = GraduationCap;
export const IcGraduationCap = GraduationCap;
export const IcAI = Cpu;
export const IcTech = Cpu;
export const IcCar = Car;
export const IcSkin = Shirt;
export const IcHome = Home;
export const IcOutdoor = Tent;
export const IcFitness = Dumbbell;
export const IcSports = Trophy;
export const IcHandcraft = Scissors;
export const IcFood = Utensils;
export const IcMaskDance = VenetianMask;
export const IcTravel = Plane;
export const IcRural = Sprout;
export const IcPets = Cat;
export const IcParenting = Baby;
export const IcVlog = Camera;
export const IcLifestyle = Coffee;
export const IcLifeExp = Wrench;
export const IcList = LayoutList;
export const IcBroadcast = Cast;
export const IcBatteryCharge = BatteryCharging;
export const IcFlame = Flame;
export const IcLightbulb = Lightbulb;
export const IcCircleDollarSign = CircleDollarSign;
export const IcShoppingBag = ShoppingBag;

// ── App launcher ─────────────────────────────────────────
export const IcLauncher: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="3" y="7" width="18" height="13" rx="4" ry="4" />
    <path d="M8 3l3 4" />
    <path d="M16 3l-3 4" />
    <line x1="9" y1="12" x2="9.01" y2="12" strokeWidth="3" />
    <line x1="15" y1="12" x2="15.01" y2="12" strokeWidth="3" />
    <path d="M10 15c1 1 3 1 4 0" />
  </svg>
);

// ── Custom SVG components ────────────────────────────────
export const BilibiliDanmakuIcon: React.FC<{ size?: number; className?: string }> = ({ size = 12, className = '' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M2 6C2 4.34315 3.34315 3 5 3H19C20.6569 3 22 4.34315 22 6V15C22 16.6569 20.6569 18 19 18H13L9 22V18H5C3.34315 18 2 16.6569 2 15V6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 8H17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M7 13H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
);

// ── Registry for dynamic lookup ──────────────────────────
export const ICON_REGISTRY: Record<string, any> = {
  IcTabHome,
  IcTabFollowing,
  IcTabPublish,
  IcTabShop,
  IcTabMe,
  IcNavBack,
  IcNavForward,
  IcClose,
  IcMore,
  IcMoreVertical,
  IcExpand,
  IcMenu,
  IcSearch,
  IcSearchInput,
  IcAdd,
  IcAddCircle,
  IcEdit,
  IcEditSquare,
  IcDelete,
  IcShare,
  IcSend,
  IcRefresh,
  IcFilter,
  IcSortUpDown,
  IcAlignLeft,
  IcCheck,
  IcCheckCircle,
  IcBadgeCheck,
  IcUser,
  IcQrCode,
  IcScan,
  IcMail,
  IcPlay,
  IcPlayCircle,
  IcPlaySquare,
  IcMonitorPlay,
  IcPause,
  IcPauseCircle,
  IcVideo,
  IcFilm,
  IcCamera,
  IcImage,
  IcMusic,
  IcMic,
  IcVolume,
  IcMute,
  IcClapperboard,
  IcMovie,
  IcMessageSquareText,
  IcForward,
  IcUpload,
  IcDownload,
  IcEye,
  IcLike,
  IcDislike,
  IcHeart,
  IcHeartPulse,
  IcMessage,
  IcMessageCircle,
  IcHistory,
  IcClock,
  IcCalendar,
  IcStar,
  IcBookOpen,
  IcWallet,
  IcCoins,
  IcCart,
  IcGrid,
  IcTicket,
  IcGift,
  IcAward,
  IcTrophy,
  IcTrend,
  IcChart,
  IcMedal,
  IcLocation,
  IcHeadphone,
  IcRadio,
  IcStore,
  IcBan,
  IcCalculator,
  IcSettings,
  IcShield,
  IcLightning,
  IcLightningOff,
  IcMoon,
  IcAnime,
  IcVariety,
  IcEntertainment,
  IcDance,
  IcPainting,
  IcGaming,
  IcNews,
  IcKnowledge,
  IcGraduationCap,
  IcAI,
  IcTech,
  IcCar,
  IcSkin,
  IcHome,
  IcOutdoor,
  IcFitness,
  IcSports,
  IcHandcraft,
  IcFood,
  IcMaskDance,
  IcTravel,
  IcRural,
  IcPets,
  IcParenting,
  IcVlog,
  IcLifestyle,
  IcLifeExp,
  IcList,
  IcBroadcast,
  IcBatteryCharge,
  IcFlame,
  IcLightbulb,
  IcCircleDollarSign,
  IcShoppingBag,
  IcLauncher,
  BilibiliDanmakuIcon,
};
