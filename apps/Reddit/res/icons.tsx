// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import {
  Home,
  Plus,
  PlusCircle,
  MessageCircle,
  MessageSquare,
  MessageSquarePlus,
  Bell,
  BellOff,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ChevronsDown,
  ArrowLeft,
  ArrowUpRight,
  Send,
  X,
  Link2,
  Link,
  Image,
  Sticker,
  PlayCircle,
  Search,
  Share2,
  MoreHorizontal,
  MoreVertical,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Reply,
  Medal,
  ArrowBigUp,
  ArrowBigDown,
  Bookmark,
  Languages,
  Settings,
  Copy,
  UserX,
  UserCheck,
  User,
  Flag,
  Trash2,
  Pencil,
  Pen,
  Menu,
  Play,
  Sparkles,
  Newspaper,
  Heart,
  TrendingUp,
  Shield,
  Coins,
  ListFilter,
  List,
  ListOrdered,
  ScrollText,
  FileText,
  HandHeart,
  Gamepad2,
  Lock,
  Telescope,
  HelpCircle,
  Mail,
  Tag,
  Clock,
  Shirt,
  SquareAsterisk,
  Info,
  Cookie,
  Megaphone,
  Moon,
  Sun,
  Monitor,
  AtSign,
  Globe,
  Type,
  SortDesc,
  Bug,
  Volume2,
  VolumeX,
  Wifi,
  Radio,
  Accessibility,
  AlertTriangle,
  Palette,
  ArrowDown,
} from 'lucide-react';
import { RedditPngIcon } from '../RedditPngIcon';

// ── Tab bar ──────────────────────────────────────────────
export const IcTabHome = Home;
export const IcTabChat = MessageCircle;
export const IcTabInbox = Bell;
export const IcTabCreate = Plus;

// ── Navigation / chrome ──────────────────────────────────
export const IcNavBack = ChevronLeft;
export const IcNavForward = ChevronRight;
export const IcClose = X;
export const IcMore = MoreHorizontal;
export const IcMoreVert = MoreVertical;
export const IcExpand = ChevronDown;
export const IcCollapse = ChevronUp;
export const IcExpandAll = ChevronsDown;
export const IcMenu = Menu;
export const IcExternalLink = ArrowUpRight;

// ── Common actions ───────────────────────────────────────
export const IcSearch = Search;
export const IcAdd = Plus;
export const IcAddCircle = PlusCircle;
export const IcAddPost = MessageSquarePlus;
export const IcEdit = Pencil;
export const IcPen = Pen;
export const IcDelete = Trash2;
export const IcCopy = Copy;
export const IcShare = Share2;
export const IcSend = Send;
export const IcReply = Reply;
export const IcBookmark = Bookmark;
export const IcFilter = SlidersHorizontal;
export const IcListFilter = ListFilter;
export const IcList = List;
export const IcListOrdered = ListOrdered;
export const IcLink = Link2;
export const IcLinkSimple = Link;
export const IcImage = Image;
export const IcSticker = Sticker;
export const IcPlay = Play;
export const IcPlayCircle = PlayCircle;
export const IcTag = Tag;
export const IcClock = Clock;

// ── User / Community ─────────────────────────────────────
export const IcUser = User;
export const IcUserBlock = UserX;
export const IcUserCheck = UserCheck;
export const IcFlag = Flag;
export const IcMedal = Medal;
export const IcShield = Shield;
export const IcLock = Lock;
export const IcShirt = Shirt;
export const IcSquareAsterisk = SquareAsterisk;

// ── Voting / Reactions ───────────────────────────────────
export const IcUpvote = ArrowBigUp;
export const IcDownvote = ArrowBigDown;
export const IcHeart = Heart;

// ── Notifications / Status ───────────────────────────────
export const IcBell = Bell;
export const IcBellOff = BellOff;
export const IcEye = Eye;
export const IcEyeOff = EyeOff;

// ── Settings / Config ────────────────────────────────────
export const IcSettings = Settings;
export const IcLanguage = Languages;
export const IcFeature = Sparkles;
export const IcInfo = Info;
export const IcCookie = Cookie;
export const IcMegaphone = Megaphone;
export const IcAccessibility = Accessibility;

// ── Theme ─────────────────────────────────────────────────
export const IcMoon = Moon;
export const IcSun = Sun;
export const IcMonitor = Monitor;

// ── Media / Content ──────────────────────────────────────
export const IcNews = Newspaper;
export const IcScrollText = ScrollText;
export const IcFile = FileText;
export const IcGamepad = Gamepad2;
export const IcTelescope = Telescope;
export const IcType = Type;
export const IcSortDesc = SortDesc;
export const IcBug = Bug;

// ── Network / Connectivity ────────────────────────────────
export const IcGlobe = Globe;
export const IcAtSign = AtSign;
export const IcWifi = Wifi;
export const IcRadio = Radio;
export const IcVolume = Volume2;
export const IcVolumeOff = VolumeX;

// ── Finance / Rewards ────────────────────────────────────
export const IcCoins = Coins;
export const IcHandHeart = HandHeart;

// ── Miscellaneous ────────────────────────────────────────
export const IcAlertTriangle = AlertTriangle;
export const IcPalette = Palette;
export const IcArrowDown = ArrowDown;
export const IcTrend = TrendingUp;
export const IcHelp = HelpCircle;
export const IcMail = Mail;
export const IcMessage = MessageCircle;
export const IcComment = MessageSquare;

// ── Navigation (alternate back style) ───────────────────
export const IcArrowBack = ArrowLeft;

// ── App launcher ─────────────────────────────────────────
export const IcLauncher = RedditPngIcon;

// ── Registry for dynamic lookup (used by IconRenderer) ───
export const ICON_REGISTRY: Record<string, any> = {
  IcTabHome,
  IcTabChat,
  IcTabInbox,
  IcTabCreate,
  IcNavBack,
  IcNavForward,
  IcClose,
  IcMore,
  IcMoreVert,
  IcExpand,
  IcCollapse,
  IcExpandAll,
  IcMenu,
  IcExternalLink,
  IcSearch,
  IcAdd,
  IcAddCircle,
  IcAddPost,
  IcEdit,
  IcPen,
  IcDelete,
  IcCopy,
  IcShare,
  IcSend,
  IcReply,
  IcBookmark,
  IcFilter,
  IcListFilter,
  IcList,
  IcListOrdered,
  IcLink,
  IcLinkSimple,
  IcImage,
  IcSticker,
  IcPlay,
  IcPlayCircle,
  IcTag,
  IcClock,
  IcUser,
  IcUserBlock,
  IcUserCheck,
  IcFlag,
  IcMedal,
  IcShield,
  IcLock,
  IcShirt,
  IcSquareAsterisk,
  IcUpvote,
  IcDownvote,
  IcHeart,
  IcBell,
  IcBellOff,
  IcEye,
  IcEyeOff,
  IcSettings,
  IcLanguage,
  IcFeature,
  IcInfo,
  IcCookie,
  IcMegaphone,
  IcAccessibility,
  IcMoon,
  IcSun,
  IcMonitor,
  IcNews,
  IcScrollText,
  IcFile,
  IcGamepad,
  IcTelescope,
  IcType,
  IcSortDesc,
  IcBug,
  IcGlobe,
  IcAtSign,
  IcWifi,
  IcRadio,
  IcVolume,
  IcVolumeOff,
  IcCoins,
  IcHandHeart,
  IcAlertTriangle,
  IcPalette,
  IcArrowDown,
  IcTrend,
  IcHelp,
  IcMail,
  IcMessage,
  IcComment,
  IcArrowBack,
  IcLauncher,
};
