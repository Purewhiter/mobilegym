import { memoSelector, registerStateAdapter } from '../../os/createAppStore';
import { createDeviceAppStore } from '../../os/device/deviceStore';
import { fromTimestamp, now as timeNow } from '../../os/TimeService';
import {
  X_CONFIG,
  currentUser,
  trends,
  defaultFollowedUserIds,
  defaultFollowerUserIds,
} from './data';
import type { XUser, XPost, XConversation, XSettings } from './types';
import { getJustNowLabel } from './utils/formatTime';
import type { XRuntimePostTable } from './utils/runtimePostResolver';

// ---- Helpers ----
// 所有 id (user / post) 在 base 数据里都已规范化, case-sensitive 唯一。
// 运行时写入 (toggleFollow / toggleLike 等) 直接用上游传入的 id, 不做任何归一。
// user 没有 handle 字段, 组件显示 @xxx 时一律 `@${user.id}` 拼接。

const stripDerivedUserCounts = (user: Record<string, any>): Record<string, any> => {
  const { following: _following, followers: _followers, ...rest } = user;
  return rest;
};

// ---- Types ----

export type XMeUser = XUser & {
  postIds: string[];
  replyIds: string[];
  followedUserIds: string[];
  followerUserIds: string[];
  likedPostIds: string[];
  retweetedPostIds: string[];
  bookmarkedPostIds: string[];
};

export interface XState {
  // Persisted store state
  user: XMeUser;
  posts: XRuntimePostTable;
  conversations: XConversation[];
  settings: XSettings;

  // Page-only state (never sent to the device server)
  currentSearchQuery: string;
  pendingQuotedPostId: string | null;
}

export interface XActions {
  toggleLike: (postId: string) => Promise<void>;
  toggleRetweet: (postId: string) => Promise<void>;
  toggleBookmark: (postId: string) => Promise<void>;
  toggleFollow: (userId: string) => Promise<void>;

  updateSettings: (patch: Partial<XSettings>) => Promise<void>;
  setSearchQuery: (q: string) => void;
  setPendingQuotedPostId: (id: string | null) => void;

  addPost: (content: string, image?: string, quotedPostId?: string) => Promise<void>;
  addReply: (postId: string, content: string) => Promise<void>;
  sendMessage: (conversationId: string, content: string) => Promise<void>;
}

// ---- Initial state ----

const initialState: XState = {
  user: {
    ...(stripDerivedUserCounts(currentUser) as XUser),
    postIds: currentUser.postIds ?? [],
    replyIds: currentUser.replyIds ?? [],
    followedUserIds: defaultFollowedUserIds,
    followerUserIds: defaultFollowerUserIds,
    likedPostIds: currentUser.likedPostIds ?? [],
    retweetedPostIds: currentUser.retweetedPostIds ?? [],
    bookmarkedPostIds: currentUser.bookmarkedPostIds ?? [],
  },
  posts: (X_CONFIG as any).posts ?? {},
  conversations: X_CONFIG.conversations ?? [],
  settings: X_CONFIG.settings,

  currentSearchQuery: '',
  pendingQuotedPostId: null,
};

// ---- Store ----
//
// `user`, `posts`, `conversations` and `settings` live in the device server
// session (apps/X/device); this store mirrors them, so components and
// `__SIM__.getState().apps.x` read the same shape as before. Actions run the
// matching server command; new posts, replies and messages are built here
// (ids and "just now" labels follow this page's clock), as before.

const PAGE_ONLY_KEYS: (keyof XState)[] = ['currentSearchQuery', 'pendingQuotedPostId'];

export const useXStore = createDeviceAppStore<XState, XActions>(
  'x',
  initialState,
  { localKeys: PAGE_ONLY_KEYS },
  ({ command, optimistic }, set, get) => {
    const run = (name: string) => async (...args: unknown[]) => {
      await command(name, ...args);
    };
    return {
      toggleLike: run('toggleLike'),
      toggleRetweet: run('toggleRetweet'),
      toggleBookmark: run('toggleBookmark'),
      toggleFollow: run('toggleFollow'),

      // Show the new value at once: a second tap before the server answers must
      // read it (`!settings.x`, or a switch's `!value`), and keep it when earlier answers arrive.
      updateSettings: async (patch) => {
        await optimistic((s) => ({ settings: { ...s.settings, ...patch } }), 'updateSettings', patch);
      },
      setSearchQuery: (q) => set({ currentSearchQuery: q }),
      setPendingQuotedPostId: (id) => set({ pendingQuotedPostId: id }),

      addPost: async (content, image, quotedPostId) => {
        // 调用方未传 quotedPostId 时回退到 pendingQuotedPostId, 保证"引用"入口拼出引用关系。
        const effectiveQuotedPostId = quotedPostId ?? get().pendingQuotedPostId ?? undefined;
        const createdAt = timeNow();
        const newPost: XPost = {
          id: `new_${createdAt}`,
          authorId: currentUser.id,
          content,
          createdAt: fromTimestamp(createdAt).toISOString(),
          image,
          time: getJustNowLabel(),
          stats: { comments: 0, retweets: 0, likes: 0, views: 0 },
          quotedPostId: effectiveQuotedPostId,
        };
        set({ pendingQuotedPostId: null });
        await command('addPost', newPost);
      },

      addReply: async (postId, content) => {
        const reply: XPost = {
          id: `reply_${timeNow()}`,
          authorId: currentUser.id,
          content,
          createdAt: fromTimestamp(timeNow()).toISOString(),
          time: getJustNowLabel(),
          stats: { comments: 0, retweets: 0, likes: 0, views: 0 },
          threadId: postId,
        };
        await command('addReply', reply);
      },

      sendMessage: async (conversationId, content) => {
        const conv = get().conversations.find((c) => c.id === conversationId);
        if (!conv) return;
        await command('sendMessage', conversationId, {
          id: `msg_${timeNow()}`,
          senderId: currentUser.id,
          receiverId: conv.participantId,
          content,
          time: getJustNowLabel(),
          read: true,
        });
      },
    };
  },
);

export type XStore = XState & XActions;

// ---- Pure-runtime selectors (不依赖 base dataset; base-依赖 view 在 data/view.ts) ----

export const selectUser = memoSelector(
  (s: XStore) => s.user,
  (user) => ({
    ...user,
    following: user.followedUserIds.length,
    followers: user.followerUserIds.length,
  }),
);

export const selectEffectiveFollowedSet = memoSelector(
  (s: XStore) => s.user.followedUserIds,
  (ids) => new Set(ids),
);

/** Trends 是 static, 不需要 selector wrapper, 直接用 import 即可。保留为 hook-like 兼容。 */
export const selectTrends = () => trends;

// ---- State adapter for bench_env ----
// 剥离 ephemeral 字段, 让 bench 看到的 state 等同于 partialize 持久化 schema。
registerStateAdapter('x', (raw: any) => {
  const {
    currentSearchQuery: _currentSearchQuery,
    pendingQuotedPostId: _pendingQuotedPostId,
    ...runtime
  } = raw;
  return {
    ...runtime,
    user: runtime.user ? stripDerivedUserCounts(runtime.user) : runtime.user,
  };
});
