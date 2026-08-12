import defaults from './defaults.json';
import type { XConversation, XNotification, XPost, XSearchHistory, XSettings, XTrend, XUser } from '../types';
import type { XMeUser } from '../state';

// 重新导出类型，保持历史 import 兼容
export * from '../types';

/** defaults.json 里的 me-user 形状：XUser + 关系/内容 id 列表（state 初始化时补默认值）。 */
export type XDefaultsUser = XUser &
  Partial<
    Pick<
      XMeUser,
      | 'postIds'
      | 'replyIds'
      | 'followedUserIds'
      | 'followerUserIds'
      | 'likedPostIds'
      | 'retweetedPostIds'
      | 'bookmarkedPostIds'
    >
  >;

/**
 * defaults.json 的数据 contract。JSON import 推断出的是宽化的字面量结构
 * （string 而非 union 等），这里做单点断言，替代原先散落的 (defaults as any).x。
 */
const typedDefaults = defaults as unknown as {
  user: XDefaultsUser;
  posts: Record<string, XPost>;
  trends: XTrend[];
  notifications: XNotification[];
  conversations: XConversation[];
  searchHistory: XSearchHistory[];
  settings: XSettings;
  suggestedFollowingIds?: string[];
};

export const currentUser = typedDefaults.user;
// 数据层 contract: 所有 id 已 case-sensitive 唯一, 不再做 .toLowerCase() 归一。
export const defaultFollowedUserIds: string[] = typedDefaults.user.followedUserIds ?? [];
export const defaultFollowerUserIds: string[] = typedDefaults.user.followerUserIds ?? [];
export const trends = typedDefaults.trends;
export const notifications = typedDefaults.notifications;
export const conversations = typedDefaults.conversations;
export const searchHistory = typedDefaults.searchHistory;
export const xSettings = typedDefaults.settings;

export const X_CONFIG = {
  user: currentUser,
  posts: typedDefaults.posts ?? {},
  trends,
  notifications,
  conversations,
  recentSearches: searchHistory,
  settings: xSettings,
};
