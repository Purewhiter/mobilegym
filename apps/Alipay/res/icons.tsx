// Tier-2 drawable icons — 对应 AOSP res/drawable/*.xml
// 单色图标使用 currentColor，多色图标引用 res/colors.ts
import {
  AppWindow,
  ArrowLeftRight,
  ArrowRight,
  AtSign,
  Baby,
  Bell,
  Bike,
  Briefcase,
  Building2,
  Bus,
  Calendar,
  Camera,
  CarTaxiFront,
  BrushCleaning,
  Check,
  CheckCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Circle,
  CircleDollarSign,
  CircleHelp,
  Clapperboard,
  ClipboardCopy,
  Clock,
  Cog,
  Coins,
  Contact,
  CreditCard,
  Delete,
  Dot,
  Droplet,
  Ellipsis,
  Eye,
  EyeOff,
  FileText,
  Flame,
  FlaskConical,
  Gift,
  Globe,
  GraduationCap,
  HandCoins,
  Handshake,
  Headphones,
  Heart,
  History,
  House,
  IdCard,
  Image,
  Info,
  Landmark,
  LayoutGrid,
  MapPin,
  MessageCircle,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Palette,
  PenLine,
  PieChart,
  PiggyBank,
  PlaySquare,
  Plus,
  QrCode,
  RefreshCw,
  ScanLine,
  Search,
  Settings,
  Shield,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Smartphone,
  Smile,
  Sofa,
  Sparkles,
  Sprout,
  Stethoscope,
  Tag,
  Ticket,
  TrendingUp,
  User,
  UserPlus,
  Users,
  Utensils,
  Wallet,
  WalletCards,
  PawPrint,
  X,
  Zap,
} from 'lucide-react';

// ── Tab bar ──────────────────────────────────────────────
export const IcTabHome = House;
export const IcTabFinance = CircleDollarSign;
export const IcTabVideo = PlaySquare;
export const IcTabMessage = MessageCircle;
export const IcTabMe = User;

// ── Navigation / chrome ──────────────────────────────────
export const IcNavBack = ChevronLeft;
export const IcNavForward = ChevronRight;
export const IcClose = X;
export const IcMore = Ellipsis;
export const IcExpand = ChevronDown;
export const IcCollapse = ChevronUp;

// ── Common actions ───────────────────────────────────────
export const IcSearch = Search;
export const IcAdd = Plus;
export const IcScan = ScanLine;
export const IcQrCode = QrCode;
export const IcEdit = PenLine;
export const IcDelete = Delete;

// ── User / Account ───────────────────────────────────────
export const IcUser = User;
export const IcUserAdd = UserPlus;
export const IcContacts = Users;
export const IcContact = Contact;
export const IcAt = AtSign;

// ── Payment / Finance ────────────────────────────────────
export const IcPay = CircleDollarSign;
export const IcCard = CreditCard;
export const IcWallet = Wallet;
export const IcWalletCards = WalletCards;
export const IcTransfer = ArrowLeftRight;
export const IcReceive = HandCoins;
export const IcCoins = Coins;
export const IcPiggyBank = PiggyBank;
export const IcTrend = TrendingUp;
export const IcChart = PieChart;
export const IcSavings = Handshake;

// ── Notifications / Status ───────────────────────────────
export const IcBell = Bell;
export const IcInfo = Info;
export const IcBroom = BrushCleaning;
export const IcCheck = Check;
export const IcCheckAll = CheckCheck;
export const IcCheckCircle = CheckCircle2;
export const IcDot = Dot;
export const IcCircle = Circle;
export const IcSuccess = CheckCircle2;

// ── Settings / Config ────────────────────────────────────
export const IcSettings = Settings;
export const IcCog = Cog;
export const IcShield = Shield;
export const IcSecureCheck = ShieldCheck;
export const IcTheme = Palette;
export const IcFeature = Sparkles;
export const IcFastPay = Zap;

// ── Media / Content ──────────────────────────────────────
export const IcVideo = PlaySquare;
export const IcCamera = Camera;
export const IcImage = Image;
export const IcFile = FileText;
export const IcCalendar = Calendar;
export const IcClock = Clock;
export const IcHistory = History;

// ── Services ─────────────────────────────────────────────
export const IcBus = Bus;
export const IcTaxi = CarTaxiFront;
export const IcTicket = Ticket;
export const IcGift = Gift;
export const IcPhone = Smartphone;
export const IcGrid = LayoutGrid;
export const IcApp = AppWindow;
export const IcLocation = MapPin;
export const IcTag = Tag;
export const IcHeadphone = Headphones;
export const IcMic = Mic;
export const IcSmile = Smile;
export const IcGrow = Sprout;
export const IcBank = Landmark;
export const IcBuilding = Building2;
export const IcBusiness = Briefcase;
export const IcMedical = Stethoscope;
export const IcDroplet = Droplet;
export const IcEducation = GraduationCap;
export const IcLab = FlaskConical;
export const IcSecurity = Shield;
export const IcMessage = MessageCircle;
export const IcMessageSquare = MessageSquare;
export const IcArrow = ArrowRight;
export const IcHelp = CircleHelp;
export const IcHeart = Heart;
export const IcClipboard = ClipboardCopy;
export const IcEye = Eye;
export const IcEyeOff = EyeOff;
export const IcMovie = Clapperboard;
export const IcLoan = PiggyBank;
export const IcMoreHorizontal = MoreHorizontal;
export const IcIdCard = IdCard;
export const IcBike = Bike;
export const IcFood = Utensils;
export const IcFlame = Flame;
export const IcRefresh = RefreshCw;
export const IcGlobe = Globe;
export const IcShirt = Shirt;
export const IcShoppingBag = ShoppingBag;
export const IcSofa = Sofa;
export const IcBaby = Baby;
export const IcPawPrint = PawPrint;

// ── App launcher ─────────────────────────────────────────
export const IcLauncher: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M5 7h14" />
    <path d="M12 3v9" />
    <path d="M7 13h9" />
    <path d="M12 13c0 4.5-3 7.5-6 9" />
    <path d="M10 15c3 3 6 5 9 6" />
  </svg>
);

// ── Registry for dynamic lookup (used by IconRenderer) ───
export const ICON_REGISTRY: Record<string, any> = {
  IcTabHome,
  IcTabFinance,
  IcTabVideo,
  IcTabMessage,
  IcTabMe,
  IcNavBack,
  IcNavForward,
  IcClose,
  IcMore,
  IcExpand,
  IcCollapse,
  IcSearch,
  IcAdd,
  IcScan,
  IcQrCode,
  IcEdit,
  IcDelete,
  IcUser,
  IcUserAdd,
  IcContacts,
  IcContact,
  IcAt,
  IcPay,
  IcCard,
  IcWallet,
  IcWalletCards,
  IcTransfer,
  IcReceive,
  IcCoins,
  IcPiggyBank,
  IcTrend,
  IcChart,
  IcSavings,
  IcBell,
  IcInfo,
  IcBroom,
  IcCheck,
  IcCheckAll,
  IcCheckCircle,
  IcDot,
  IcCircle,
  IcSuccess,
  IcSettings,
  IcCog,
  IcShield,
  IcSecureCheck,
  IcTheme,
  IcFeature,
  IcFastPay,
  IcVideo,
  IcCamera,
  IcImage,
  IcFile,
  IcCalendar,
  IcClock,
  IcHistory,
  IcBus,
  IcTaxi,
  IcTicket,
  IcGift,
  IcPhone,
  IcGrid,
  IcApp,
  IcLocation,
  IcTag,
  IcHeadphone,
  IcMic,
  IcSmile,
  IcGrow,
  IcBank,
  IcBuilding,
  IcBusiness,
  IcMedical,
  IcDroplet,
  IcEducation,
  IcLab,
  IcSecurity,
  IcMessage,
  IcMessageSquare,
  IcArrow,
  IcHelp,
  IcHeart,
  IcClipboard,
  IcEye,
  IcEyeOff,
  IcMovie,
  IcLoan,
  IcMoreHorizontal,
  IcIdCard,
  IcBike,
  IcFood,
  IcFlame,
  IcRefresh,
  IcGlobe,
  IcShirt,
  IcShoppingBag,
  IcSofa,
  IcBaby,
  IcPawPrint,
  IcLauncher,
};
