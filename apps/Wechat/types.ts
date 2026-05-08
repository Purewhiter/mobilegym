import type { LucideIcon } from './res/icons';

export type Tab = 'chat' | 'contacts' | 'discover' | 'me';

export interface Address {
  id: string;
  name: string;
  phone: string;
  region: string;
  detail: string;
}

export interface Invoice {
  id: string;
  type: '个人' | '单位';
  name: string;
  taxId?: string;
}

export interface AuthorizedApp {
  id: string;
  name: string;
  icon: string;
  type: '移动应用' | '小程序';
  permissions: string[];
}

export interface UserSettings {
  security: { voiceprint: boolean };
  modes: { care: boolean; minor: boolean };
  notifications: {
    message: boolean;
    voiceVideo: boolean;
    displayMode: 'count' | 'name' | 'full';
    notificationSound: string;
    incomingRingtone: string;
  };
  chat: { speakerMode: boolean; sendButton: boolean };
  general: {
    darkMode: boolean;
    followSystem: boolean;
    landscape: boolean;
    nfc: boolean;
    autoDownload: string;
    translationLanguage: string;
    autoTranslate: boolean;
    mediaAutoDownload: boolean;
    savePhotos: boolean;
    saveVideos: boolean;
    imageSearch: boolean;
    keepOriginal: boolean;
    mobileAutoPlay: boolean;
    mobileVoiceQuality: boolean;
    personalizedAudio: boolean;
    losslessAudio: boolean;
    showAudioInRecent: boolean;
  };
  privacy: {
    friendConfirmation: boolean;
    recommendAddressBook: boolean;
    addMeMethods: {
      searchByWxid: boolean;
      searchByPhone: boolean;
      addByGroup: boolean;
      addByQrCode: boolean;
      addByCard: boolean;
      addByOther: boolean;
    };
    momentsStrangerTen: boolean;
    momentsRange: '最近三天' | '最近一个月' | '最近半年' | '全部';
  };
  discover: {
    moments: { visible: boolean; notify?: boolean };
    channels: { visible: boolean; notify?: boolean };
    live: { visible: boolean; notify?: boolean };
    scan: { visible: boolean };
    listen: { visible: boolean; notify?: boolean };
    topStories: { visible: boolean; notify?: boolean };
    search: { visible: boolean };
    nearby: { visible: boolean; notify?: boolean; showNearbyPeople?: boolean };
    games: { visible: boolean; notify?: boolean };
  };
  accessibility: {
    tencentNews: { enabled: boolean; sticky?: boolean; dnd?: boolean };
    broadcast: { enabled: boolean; sticky?: boolean; dnd?: boolean };
    qqMail: { enabled: boolean };
    wechatSports: { enabled: boolean; sticky?: boolean; dnd?: boolean; joinLeaderboard?: boolean; recvLeaderboardMsg?: boolean; recvLikeMsg?: boolean };
    wechatPay: { enabled: boolean };
    wechatGames: { enabled: boolean };
  };
}

export interface User {
  wxid: string;
  name: string;
  avatar: string;
  region: string;
  currentLocation?: string;
  gender: '男' | '女' | '';
  phone: string;
  signature: string;
  pat?: string;
  qqId?: string;
  accountStatus?: 'active' | 'cancelled';
  addresses: Address[];
  invoices: Invoice[];
  beans: number;
  steps?: number;
  likes?: number;
}

export interface Message {
  id: string;
  type: 'text' | 'image' | 'time' | 'system' | 'file';
  content: string;
  senderId: string;
  timestamp: number;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}

export interface ChatSession {
  id: string; // This matches the wxid of the conversation partner
  user: { wxid: string; name: string; avatar: string; };
  isMuted?: boolean;
  isSticky?: boolean;
  isAlert?: boolean;
  isOfficial?: boolean;
  messages: Message[];
}

/** AI 回复配置 
 * 大部分设置使用系统默认值（SIMULATOR_CONFIG.ai），此处仅配置联系人特定的覆盖项
 */
export interface AIConfig {
  enabled: boolean;                    // 是否启用AI回复
  systemPrompt?: string;               // 人格/角色设定（系统提示词）
  // 以下为可选覆盖项，不设置则使用 SIMULATOR_CONFIG.ai 中的系统默认值
  model?: string;                      // 覆盖模型名称
  apiEndpoint?: string;                // 覆盖API端点
  apiKey?: string;                     // 覆盖API密钥
  replyDelay?: number;                 // 覆盖回复延迟（毫秒）
  temperature?: number;                // 覆盖温度参数 (0-1)
  maxContextMessages?: number;         // 覆盖最大上下文消息数
}

export interface ContactItem {
  wxid: string;
  name: string;
  avatar: string;
  icon?: LucideIcon;
  iconColor?: string;
  category?: string;
  signature?: string;
  alias?: string;
  region?: string;
  gender?: '男' | '女' | '';
  source?: string;
  addedTime?: string;
  commonGroups?: number;
  memo?: string;
  isBlacklisted?: boolean;
  isStarred?: boolean;
  steps?: number;
  likes?: number;
  permissionMode?: 'all' | 'chatOnly';
  hideMyMoments?: boolean;
  hideTheirMoments?: boolean;
  aiConfig?: AIConfig;                 // AI回复配置
}

// 附近的人 - 继承联系人结构，加好友前只能看到部分信息
export interface NearbyPerson extends ContactItem {
  distance: string;                    // 附近的人特有字段：距离
}

export interface ChatItem {
  id: string;
  name: string;
  avatar: string;
  lastMessage: string;
  timestamp: string;
  isOfficial?: boolean;
}

export interface DiscoverItem {
  id: string;
  name: string;
  icon: LucideIcon;
  iconColor: string;
  notificationAvatar?: string;
  extraText?: string;
  isNew?: boolean;
}

export interface Moment {
  id: string;
  wxid: string;
  userName: string;
  userAvatar: string;
  content: string;
  images?: string[];
  location?: string;
  timestamp: number;
}

export interface MomentDraft {
  content: string;
  location: string | null;
  selectedImages: string[];
  tempCapturedImage?: string;
}

export interface TextMomentDraft {
  content: string;
  location: string | null;
}

export type WechatVerificationCode = {
  id: string;
  phone: string;
  code: string;
  issuedAt: number;
  expiresInSec: number;
  invalidatedByNewer?: boolean;
  used?: boolean;
};

export type WechatVerificationAttempt = {
  id: string;
  phone: string;
  code: string;
  at: number;
  ok: boolean;
  reason?: 'ok' | 'wrong' | 'expired' | 'superseded' | 'used' | 'no_active';
};

export type WechatLoginAttempt = {
  id: string;
  phone: string;
  password: string;
  code?: string;
  captchaPassed?: boolean;
  at: number;
  ok: boolean;
  reason?: 'ok' | 'no_account' | 'wrong_password' | 'locked' | 'captcha_required' | 'untrusted_device' | 'code_wrong' | 'code_expired' | 'code_superseded' | 'code_used' | 'code_no_active';
  deviceId?: string;
};

export type WechatTrustedDevice = {
  deviceId: string;
  deviceName: string;
  trustedAt: number;
};

export type WechatAccount = {
  phone: string;
  password: string;
  createdAt: number;
  activated: boolean;
  realName?: string;
  idNumber?: string;
  failedAttempts?: number;
  lockedUntil?: number;
  requireCaptcha?: boolean;
};

export type WechatAuthState = {
  accounts: WechatAccount[];
  session: {
    loggedIn: boolean;
    phone: string | null;
    token?: string;
    expiresAt?: number | null;
    lastExpiredAt?: number;
    currentDeviceId?: string;
  };
  trustedDevicesByPhone: Record<string, WechatTrustedDevice[]>;
  verificationCodes: WechatVerificationCode[];
  verificationAttempts: WechatVerificationAttempt[];
  loginAttempts: WechatLoginAttempt[];
  verificationCodeLength: number;
  verificationCodeExpirySec: number;
  captcha: {
    requiredAfterFailures: number;
  };
  nextVerificationCodeOverride?: string | null;
  pendingTrustDevice?: {
    phone: string;
    deviceId: string;
    shownAt: number;
  } | null;
  /** 登录因环境异常失效时弹出通知框，确定/取消后置为 false */
  showLoginExpiredModal?: boolean;
};

export interface ServiceItem {
  label: string;
  icon: LucideIcon;
  color: string;
}

export interface ServiceGroup {
  title: string;
  items: ServiceItem[];
}

export type WechatSubscription = {
  id: string;
  membershipType: string;
  price: number;
  billingCycle: string;
  autoRenew: boolean;
  createdAt: number;
  source: string;
};

export interface AppData {
  user: User;
  settings: UserSettings;
  contacts: ContactItem[];
  chats: ChatSession[];
  moments: Moment[];
  authorizedApps: AuthorizedApp[];
  nearbyPeople: NearbyPerson[];        // 附近的人列表
  momentDraft: MomentDraft;
  textMomentDraft: TextMomentDraft;
  auth: WechatAuthState;
  subscriptions: WechatSubscription[];
}
