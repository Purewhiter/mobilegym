export interface HotSearchItem {
  keyword: string;
  isHot?: boolean;
  isNew?: boolean;
  label?: string;
  heat?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  type: 'text' | 'image';
}

export interface ChatConversation {
  userId: string;
  username: string;
  avatar: string;
  lastMessage?: string;
  lastTime?: number;
  unreadCount: number;
  messages: ChatMessage[];
}

export interface Notification {
  id: string;
  type: 'like_note' | 'collect_note' | 'like_comment' | 'follow' | 'comment' | 'reply';
  userId: string;
  username: string;
  userAvatar: string;
  noteId?: string;
  noteCover?: string;
  content?: string;
  replyToContent?: string;
  timestamp: number;
  isRead: boolean;
}

export interface RedBookSettings {
  general: {
    useSystemFont: boolean;
    playAudio: boolean;
    autoRefresh: boolean;
    muteVideo: boolean;
    mobileDownload: boolean;
    videoHDR: boolean;
    imageHDR: boolean;
    mobileNetwork: boolean;
    history: boolean;
    videoInteraction: boolean;
    preUpload: boolean;
    teenMode: boolean;
  };
  notification: {
    receiveMsg: boolean;
    likeCollect: boolean;
    newFollow: boolean;
    comment: boolean;
    atMe: boolean;
    storeNotif: boolean;
    privateChat: boolean;
    groupChat: boolean;
    strangers: boolean;
    authorUpdates: string;
    liveReminder: string;
    contentRecommend: string;
    userRecommend: string;
    otherNotif: string;
    inAppBanner: string;
  };
  privacy: {
    oneClickProtect: boolean;
    showChatStatus: boolean;
    onlyFollowComment: boolean;
    onlyFollowDanmaku: boolean;
    onlyFollowAt: boolean;
    allowDownload: boolean;
    recommendPeople: boolean;
    onlineStatus: string;
    messagePermission: string;
    collectVisibility: string;
    commentVisibility: string;
  };
  language: string | null;
}

/**
 * 临时（ephemeral）UI 导航状态。**不持久化、不入 bench 期望 diff**。
 *
 * 放在 `_temp` 命名空间下，享受两条 framework 级豁免:
 *   - `createAppStoreWithActions` 默认 partialize 排除 `_temp` → 不写 localStorage
 *   - `bench_env/task/base.py` 的 `_DEFAULT_IGNORED_PATHS` 包含 `apps.*._temp` →
 *     state diff 自动忽略，agent 切 tab/分类不会产生 "非预期变化" 警告
 *
 * 仍可被 bench 任务读取（出现在 `__SIM__.getState()`/`apps.redbook._temp.*`），
 * 例如 `LikeFirstFeedNote` 判定用户是否真的切到了指定分类。
 */
export interface RedBookTempState {
  activeCategory: string;
  citySubTab: string;
}

export interface RedBookPublishDraft {
  text: string;
  templateId: string;
  /** Title entered in the publish confirmation page (used for task validation). */
  title: string;
  /** Already-baked or selected publish images (text cards rasterized on leaving the template page). */
  images: string[];
}

export interface RedBookStorage {
  cacheSizeBytes: number;
}

export interface RedBookConfig {
  user: User;
  notes: Record<string, Note>;
  comments: Record<string, Comment & { noteId: string }>;
  users: Record<string, User>;
  chats: ChatConversation[];
  notifications: Notification[];
  history: string[];
  searchHistory: string[];
  hotSearch: HotSearchItem[];
  guessYouLike: string[];
  settings: RedBookSettings;
  storage: RedBookStorage;
  publishDraft: RedBookPublishDraft;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  userCover?: string; // Cover image for profile
  following?: number | string;
  followers?: number | string;
  likesAndCollections?: number | string;
  intro?: string;
  location?: string;
  gender?: string;
  age?: string;
  birthday?: string;
  address?: string;
  userUrl?: string; // Original XHS User URL

  /**
   * ========= 当前用户专属的“真值”字段（解耦用户态/互动态） =========
   * - likedNotes/collectedNotes/followingIds 等才是“我做了什么”的源数据
   * - feed/users 里的 isLiked/isCollected/isFollowed 由这些字段派生，保证兼容现有 UI/评测
   */
  likedNotes?: string[]; // noteIds
  collectedNotes?: string[]; // noteIds
  followingIds?: string[]; // userIds (I follow)
  followerIds?: string[]; // userIds (follow me) - optional demo data
  /**
   * 我点过赞的评论（按 noteId 分桶，避免 commentId 不全局唯一的问题）
   */
  likedCommentsByNote?: Record<string, string[]>; // { [noteId]: commentIds[] }
  /** 我发出的评论 ID 索引；评论内容和归属只存在 comments[id] / view comment 中。 */
  commentIds?: string[];

  /**
   * 我发布过的笔记列表（noteIds）。
   * - 用于“我的主页/作品”快速索引与稳定排序
   * - 真值由 user 维护，不依赖扫描全量 notesById
   */
  publishedNoteIds?: string[];
}

export interface Comment {
    id: string;
    noteId?: string;
    userId: string;
    username: string;
    avatar: string;
    content: string;
    time: number;
    likes: number | string;
    replyToId?: string; // ID of the comment being replied to
    location?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  authorId: string;
  images: string[];
  video?: string;
  cover?: string;
  type?: 'video' | 'image';
  likes: number | string;
  collections: number | string;
  comments: number | string;
  commentList?: Comment[];
  createdAt: number;
  category?: string; // To support category filtering
  url?: string; // Original XHS URL
  tags?: string[];
  videoUrl?: string;
}

export interface RedBookState {
  user: User; // 当前登录用户（包含互动/关系真值字段）
  notes: Record<string, Note | null>;
  comments: Record<string, (Comment & { noteId: string }) | null>;
  users: Record<string, User | null>;
  history: string[]; // 浏览记录（noteIds）
  searchHistory: string[];
}
