import { createAppStoreWithActions, memoSelector, registerStateAdapter } from '../../os/createAppStore';
import { fromTimestamp, now as timeNow } from '../../os/TimeService';
import {
  X_CONFIG,
  currentUser,
  trends,
  defaultFollowedUserIds,
  defaultFollowerUserIds,
} from './data';
import { loadReplies, preload } from './data/loader';
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

  // Ephemeral state (excluded from persistence via partialize)
  currentSearchQuery: string;
  pendingQuotedPostId: string | null;
}

export interface XActions {
  toggleLike: (postId: string) => void;
  toggleRetweet: (postId: string) => void;
  toggleBookmark: (postId: string) => void;
  toggleFollow: (userId: string) => void;

  updateSettings: (patch: Partial<XSettings>) => void;
  setSearchQuery: (q: string) => void;
  setPendingQuotedPostId: (id: string | null) => void;

  addPost: (content: string, image?: string, quotedPostId?: string) => void;
  addReply: (postId: string, content: string) => void;
  sendMessage: (conversationId: string, content: string) => void;

  /** Lazy load replies.json (huge); loader 内部 in-flight 去重。 */
  ensureRepliesLoaded: () => Promise<void>;
  _loadData: () => void;
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

const toggleInArray = (ids: string[], id: string): string[] =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];

export const useXStore = createAppStoreWithActions<XState, XActions>(
  'x',
  initialState,
  (set, get) => ({
    toggleLike: (postId) => set((s) => ({
      user: { ...s.user, likedPostIds: toggleInArray(s.user.likedPostIds, postId) },
    })),
    toggleRetweet: (postId) => set((s) => ({
      user: { ...s.user, retweetedPostIds: toggleInArray(s.user.retweetedPostIds, postId) },
    })),
    toggleBookmark: (postId) => set((s) => ({
      user: { ...s.user, bookmarkedPostIds: toggleInArray(s.user.bookmarkedPostIds, postId) },
    })),
    toggleFollow: (userId) => set((s) => ({
      user: { ...s.user, followedUserIds: toggleInArray(s.user.followedUserIds, userId) },
    })),

    updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
    setSearchQuery: (q) => set({ currentSearchQuery: q }),
    setPendingQuotedPostId: (id) => set({ pendingQuotedPostId: id }),

    addPost: (content, image, quotedPostId) => {
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
      set((s) => ({
        posts: { ...s.posts, [newPost.id]: newPost },
        user: { ...s.user, postIds: [newPost.id, ...s.user.postIds] },
        pendingQuotedPostId: null,
      }));
    },

    addReply: (postId, content) => {
      const reply: XPost = {
        id: `reply_${timeNow()}`,
        authorId: currentUser.id,
        content,
        createdAt: fromTimestamp(timeNow()).toISOString(),
        time: getJustNowLabel(),
        stats: { comments: 0, retweets: 0, likes: 0, views: 0 },
        threadId: postId,
      };
      set((s) => ({
        posts: { ...s.posts, [reply.id]: reply },
        user: { ...s.user, replyIds: [reply.id, ...s.user.replyIds] },
      }));
    },

    sendMessage: (conversationId, content) => {
      set((s) => ({
        conversations: s.conversations.map((conv) => {
          if (conv.id !== conversationId) return conv;
          const newMessage = {
            id: `msg_${timeNow()}`,
            senderId: currentUser.id,
            receiverId: conv.participantId,
            content,
            time: getJustNowLabel(),
            read: true,
          };
          return { ...conv, messages: [...conv.messages, newMessage], lastMessageId: newMessage.id };
        }),
      }));
    },

    ensureRepliesLoaded: async () => {
      await loadReplies();
    },

    _loadData: () => {
      void preload();
    },
  }),
  {
    // 显式 allowlist: 只持久化用户运行态。新增字段默认不进 localStorage,
    // 避免无意把 ephemeral / 信号位 / base cache 写盘。
    partialize: (state) => ({
      user: stripDerivedUserCounts(state.user) as XMeUser,
      posts: state.posts,
      conversations: state.conversations,
      settings: state.settings,
    }),
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
