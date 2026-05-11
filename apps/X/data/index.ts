import defaults from './defaults.json';
import type { XConversation, XSettings } from '../types';

// 重新导出类型，保持历史 import 兼容
export * from '../types';

export const currentUser = (defaults as any).user;
export const defaultFollowedUserIds = (((defaults as any).user?.followedUserIds ?? []) as string[]).map((id: string) => id.toLowerCase());
export const defaultFollowerUserIds = (((defaults as any).user?.followerUserIds ?? []) as string[]).map((id: string) => id.toLowerCase());
export const trends = (defaults as any).trends as any[];
export const notifications = (defaults as any).notifications as any[];
export const conversations = (defaults as any).conversations as XConversation[];
export const searchHistory = (defaults as any).searchHistory as any[];
export const xSettings = (defaults as any).settings as XSettings;

export const X_CONFIG = {
  user: currentUser,
  posts: (defaults as any).posts ?? {},
  trends,
  notifications,
  conversations,
  recentSearches: searchHistory,
  settings: xSettings,
};
