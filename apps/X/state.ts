import { createAppStoreWithActions, memoSelector, registerStateAdapter } from '../../os/createAppStore';
import { fromTimestamp, now as timeNow } from '../../os/TimeService';
import { X_CONFIG, currentUser, trends, notifications, conversations, searchHistory, defaultFollowedUserIds, defaultFollowerUserIds } from './data';
import { X_IDS } from './constants';
import { loadUsers, loadPosts, loadReplies, getRepliesSync } from './data/loader';
import type { XUser, XPost, XConversation, XMessage, XSettings } from './types';
import { getJustNowLabel, normalizeXPostTemporalFields } from './utils/formatTime';
import { resolveXRuntimePost, resolveXRuntimePosts, type XRuntimePostTable } from './utils/runtimePostResolver';

// ---- Helpers ----

const normalizeXId = (id: string): string => String(id || '').toLowerCase();
const hasNormalizedXId = (ids: string[], targetId: string): boolean =>
  ids.some((id) => normalizeXId(id) === targetId);
const withoutNormalizedXId = (ids: string[], targetId: string): string[] =>
  ids.filter((id) => normalizeXId(id) !== targetId);

const buildRetweetShell = (source: XPost): XPost => ({
  id: `retweet_${source.id}`,
  authorId: X_IDS.meUserId,
  content: '',
  time: getJustNowLabel(),
  stats: { ...source.stats },
  retweetedPostId: source.id,
});

const REPLY_ROOT_ID_PATTERN = /^r_(p_[0-9]+)/;

const hydrateInlinePost = (post: XPost | undefined, users: Record<string, XUser>, postIndex: Map<string, XPost>): any => {
  if (!post) return undefined;

  const normalizedPost = normalizeXPostTemporalFields(post);
  const authorId = normalizedPost.authorId.toLowerCase();
  const author = users[authorId] || users[normalizedPost.authorId];

  const quotedPost = normalizedPost.quotedPostId ? postIndex.get(normalizedPost.quotedPostId) : undefined;
  const quotedAuthor = quotedPost
    ? users[quotedPost.authorId.toLowerCase()] || users[quotedPost.authorId]
    : undefined;

  const parentPost = normalizedPost.threadId ? postIndex.get(normalizedPost.threadId) : undefined;
  const replyToUser = parentPost
    ? users[parentPost.authorId.toLowerCase()] || users[parentPost.authorId]
    : undefined;

  return {
    ...normalizedPost,
    author: {
      name: author?.name || author?.handle || 'Unknown',
      handle: author?.handle || '@unknown',
      avatar: author?.avatar,
      verified: author?.verified,
      banner: author?.banner,
      bio: author?.bio,
      location: author?.location,
      joinDate: author?.joinDate,
      following: author?.following,
      followers: author?.followers,
    },
    replyToHandle: replyToUser?.handle,
    quotedPost: quotedPost
      ? {
          ...normalizeXPostTemporalFields(quotedPost),
          author: {
            name: quotedAuthor?.name || 'Unknown',
            handle: quotedAuthor?.handle || '@unknown',
            verified: quotedAuthor?.verified,
          },
        }
      : undefined,
  };
};

const hydratePost = (post: XPost, users: Record<string, XUser>, postIndex: Map<string, XPost>): any => ({
  ...hydrateInlinePost(post, users, postIndex),
  retweetedPost: post.retweetedPostId
    ? hydrateInlinePost(postIndex.get(post.retweetedPostId), users, postIndex)
    : undefined,
});

const hydrateReplyTree = (post: XPost, allUsers: Record<string, XUser>): XPost => {
  const hydrate = (p: XPost): XPost => {
    const normalizedPost = normalizeXPostTemporalFields(p);
    const author = allUsers[p.authorId?.toLowerCase?.()] || allUsers[p.authorId];
    const nested = Array.isArray((p as any).replies) ? ((p as any).replies as XPost[]).map(hydrate) : undefined;
    return {
      ...normalizedPost,
      author: {
        name: author?.name || 'Unknown',
        handle: author?.handle || '@unknown',
        avatar: author?.avatar,
        verified: author?.verified,
      },
      replies: nested,
    } as any;
  };
  return hydrate(post);
};

// ---- Types ----

interface XState {
  // Persisted store state
  user: XUser & {
    postIds: string[];
    replyIds: string[];
    followedUserIds: string[];
    followerUserIds: string[];
    likedPostIds: string[];
    retweetedPostIds: string[];
    bookmarkedPostIds: string[];
  };
  posts: XRuntimePostTable;
  conversations: XConversation[];
  settings: XSettings;

  // Ephemeral state (excluded from persistence via partialize)
  currentSearchQuery: string;
  pendingQuotedPostId: string | null;
  _baseUsers: Record<string, XUser>;
  _basePosts: XPost[];
  _temp: {
    repliesLoaded: boolean;
    repliesLoading: boolean;
  };
}

interface XActions {
  // Toggle interactions
  toggleLike: (postId: string) => void;
  toggleRetweet: (postId: string) => void;
  toggleBookmark: (postId: string) => void;

  // Timeline settings
  updateSettings: (patch: Partial<XState['settings']>) => void;

  // Search
  setSearchQuery: (q: string) => void;

  // Quote tweet
  setPendingQuotedPostId: (id: string | null) => void;

  // Post / reply / message
  addPost: (content: string, image?: string, quotedPostId?: string) => void;
  addReply: (postId: string, content: string) => void;
  sendMessage: (conversationId: string, content: string) => void;

  // Follow
  toggleFollow: (userId: string) => void;

  // Replies (lazy loading)
  ensureRepliesLoaded: () => Promise<void>;

  _loadData: () => void;
}

// ---- Initial state ----

const initialState: XState = {
  user: {
    ...currentUser,
    postIds: currentUser.postIds ?? [],
    replyIds: currentUser.replyIds ?? [],
    followedUserIds: defaultFollowedUserIds,
    followerUserIds: defaultFollowerUserIds,
    likedPostIds: (currentUser.likedPostIds ?? []).map((id: string) => id.toLowerCase()),
    retweetedPostIds: (currentUser.retweetedPostIds ?? []).map((id: string) => id.toLowerCase()),
    bookmarkedPostIds: (currentUser.bookmarkedPostIds ?? []).map((id: string) => id.toLowerCase()),
  },
  posts: (X_CONFIG as any).posts ?? {},
  conversations: X_CONFIG.conversations ?? [],
  settings: X_CONFIG.settings,

  // Ephemeral
  currentSearchQuery: '',
  pendingQuotedPostId: null,
  _baseUsers: {},
  _basePosts: [],
  _temp: {
    repliesLoaded: !!getRepliesSync(),
    repliesLoading: false,
  },
};

// ---- Replies promise ref (module-level, like the Context used a ref) ----
let repliesEnsurePromise: Promise<void> | null = null;

// ---- Store ----

export const useXStore = createAppStoreWithActions<XState, XActions>(
  'x',
  initialState,
  (set, get) => ({
    // ---- Toggle interactions ----
    toggleLike: (postId) => {
      set((state) => {
        const targetId = normalizeXId(postId);
        const ids = state.user.likedPostIds;
        const alreadyLiked = hasNormalizedXId(ids, targetId);
        const nextLikedIds = alreadyLiked
          ? withoutNormalizedXId(ids, targetId)
          : [...ids, targetId];

        return {
          user: { ...state.user, likedPostIds: nextLikedIds },
        };
      });
    },

    toggleRetweet: (postId) => {
      set((state) => {
        const normalizedPostId = normalizeXId(postId.startsWith('retweet_') ? postId.slice('retweet_'.length) : postId);
        const postEntry = state.posts[postId] ?? state.posts[normalizedPostId];
        const resolvedPostId = postEntry && typeof postEntry === 'object'
          ? postEntry.retweetedPostId ?? normalizedPostId
          : normalizedPostId;
        const targetId = normalizeXId(resolvedPostId);
        const ids = state.user.retweetedPostIds;
        const alreadyRetweeted = hasNormalizedXId(ids, targetId);
        const nextRetweetedIds = alreadyRetweeted
          ? withoutNormalizedXId(ids, targetId)
          : [...ids, targetId];

        return {
          user: { ...state.user, retweetedPostIds: nextRetweetedIds },
        };
      });
    },

    toggleBookmark: (postId) => {
      set((state) => {
        const targetId = normalizeXId(postId);
        const ids = state.user.bookmarkedPostIds;
        return {
          user: {
            ...state.user,
            bookmarkedPostIds: hasNormalizedXId(ids, targetId)
              ? withoutNormalizedXId(ids, targetId)
              : [...ids, targetId],
          },
        };
      });
    },

    // ---- Timeline settings ----
    updateSettings: (patch) => set((state) => ({
      settings: { ...state.settings, ...patch },
    })),

    // ---- Search ----
    setSearchQuery: (q) => set({ currentSearchQuery: q }),

    // ---- Quote tweet ----
    setPendingQuotedPostId: (id) => set({ pendingQuotedPostId: id }),

    // ---- Post / reply / message ----
    addPost: (content, image, quotedPostId) => {
      // 如果调用方未显式传入 quotedPostId，则回退使用当前 store 中的 pendingQuotedPostId，
      // 确保通过“引用”入口进入发帖页时，最终帖子一定带上引用关系。
      const state = get();
      const effectiveQuotedPostId = quotedPostId ?? state.pendingQuotedPostId ?? undefined;
      const createdAt = fromTimestamp(timeNow()).toISOString();

      const newPost: XPost = {
        id: `new_${timeNow()}`,
        authorId: X_IDS.meUserId,
        content,
        createdAt,
        image,
        time: getJustNowLabel(),
        stats: { comments: 0, retweets: 0, likes: 0, views: 0 },
        quotedPostId: effectiveQuotedPostId ?? undefined,
      };
      set((s) => ({
        posts: { ...s.posts, [newPost.id]: newPost },
        user: { ...s.user, postIds: [newPost.id, ...s.user.postIds] },
      }));
    },

    addReply: (postId, content) => {
      const createdAt = fromTimestamp(timeNow()).toISOString();
      const reply: XPost = {
        id: `reply_${timeNow()}`,
        authorId: X_IDS.meUserId,
        content,
        createdAt,
        time: getJustNowLabel(),
        stats: { comments: 0, retweets: 0, likes: 0, views: 0 },
        threadId: postId,
      };
      set((state) => {
        return {
          posts: { ...state.posts, [reply.id]: reply },
          user: { ...state.user, replyIds: [reply.id, ...state.user.replyIds] },
        };
      });
    },

    sendMessage: (conversationId, content) => {
      set((state) => {
        const convs = state.conversations.map((conv) => {
          if (conv.id === conversationId) {
            const newMessage = {
              id: `msg_${timeNow()}`,
              senderId: X_IDS.meUserId,
              receiverId: conv.participantId,
              content,
              time: getJustNowLabel(),
              read: true,
            };
            return { ...conv, messages: [...conv.messages, newMessage], lastMessageId: newMessage.id };
          }
          return conv;
        });
        return { conversations: convs };
      });
    },

    // ---- Follow ----
    toggleFollow: (userId) => {
      const targetId = userId.toLowerCase();
      set((state) => ({
        user: {
          ...state.user,
          followedUserIds: state.user.followedUserIds.includes(targetId)
            ? state.user.followedUserIds.filter((id: string) => id !== targetId)
            : [...state.user.followedUserIds, targetId],
        },
      }));
    },

    // ---- Replies (lazy loading) ----
    ensureRepliesLoaded: async () => {
      if (getRepliesSync()) {
        const s = get();
        if (!s._temp.repliesLoaded) set({ _temp: { ...s._temp, repliesLoaded: true, repliesLoading: false } });
        return;
      }

      if (repliesEnsurePromise) return repliesEnsurePromise;

      set((s) => ({ _temp: { ...s._temp, repliesLoading: true } }));
      repliesEnsurePromise = loadReplies()
        .then(() => {
          set((s) => ({ _temp: { ...s._temp, repliesLoaded: true, repliesLoading: false } }));
        })
        .catch((e) => {
          set((s) => ({ _temp: { ...s._temp, repliesLoaded: false, repliesLoading: false } }));
          throw e;
        })
        .finally(() => {
          repliesEnsurePromise = null;
        });
      return repliesEnsurePromise;
    },

    _loadData: () => {
      (async () => {
        // 如果 benchmark 已设置过数据，跳过默认数据加载
        if ((window as any).__SIM__?._benchmarkPatchedApps?.has('x')) return;
        try {
          const [users, posts] = await Promise.all([loadUsers(), loadPosts()]);

          set({
            _baseUsers: (users && typeof users === 'object') ? users : {} as Record<string, XUser>,
            _basePosts: Array.isArray(posts) ? posts : [] as XPost[],
          });
        } catch (e) {
          console.error('Failed to load X data:', e);
        }
      })();
    },
  }),
  {
    partialize: (state) => {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(state)) {
        if (typeof v === 'function') continue;
        // Exclude ephemeral state
        if (
          k === 'currentSearchQuery' ||
          k === 'pendingQuotedPostId' ||
          k === '_baseUsers' ||
          k === '_basePosts' ||
          k === '_temp'
        ) continue;
        result[k] = v;
      }
      return result as Partial<XState>;
    },
  },
);

// ---- Internal helpers for derived state ----

function _postRecordValues(posts: XRuntimePostTable | undefined): Array<Partial<XPost> & { id: string }> {
  return Object.values(posts ?? {}).filter(
    (post): post is Partial<XPost> & { id: string } => !!post && typeof post.id === 'string',
  );
}

function _resolvePostSource(state: XState, postId: string): XPost | null {
  const postIndex = _buildPostIndex(state._basePosts, state.posts);
  const resolved = resolveXRuntimePost(state.posts, postIndex, postId);
  return resolved ?? _resolveRawReplyById(postId);
}

function _withRelationshipDerivedStats(post: XPost, input: Pick<XState, 'user' | 'posts'>): XPost {
  const stats = post.stats;
  if (!stats) return post;

  const postId = normalizeXId(post.id);
  const likesDelta = hasNormalizedXId(input.user.likedPostIds, postId) ? 1 : 0;
  const retweetsDelta = hasNormalizedXId(input.user.retweetedPostIds, postId) ? 1 : 0;
  const commentsDelta = _postRecordValues(input.posts).filter((p) => normalizeXId(p.threadId || '') === postId).length;

  if (!likesDelta && !retweetsDelta && !commentsDelta) return post;

  return {
    ...post,
    stats: {
      ...stats,
      likes: Math.max(0, (stats.likes ?? 0) + likesDelta),
      retweets: Math.max(0, (stats.retweets ?? 0) + retweetsDelta),
      comments: Math.max(0, (stats.comments ?? 0) + commentsDelta),
    },
  };
}

function _mergeLocalPosts(input: Pick<XState, 'posts' | 'user'> & { basePosts: XPost[] }): XPost[] {
  const combined = resolveXRuntimePosts(input.posts, input.basePosts);
  const seen = new Set<string>();
  const unique: XPost[] = [];

  for (const p of combined) {
    if (!p || typeof (p as any).id !== 'string') continue;
    if (!seen.has(p.id)) {
      seen.add(p.id);
      unique.push(_withRelationshipDerivedStats(p, input));
    }
  }

  const byId = new Map<string, XPost>();
  for (const p of unique) byId.set(p.id, p);
  for (const p of unique) byId.set(normalizeXId(p.id), p);

  const retweetShells: XPost[] = [];
  const retweetedIds = input.user?.retweetedPostIds || [];
  const emitted = new Set<string>();
  for (let i = retweetedIds.length - 1; i >= 0; i -= 1) {
    const sourceId = normalizeXId(retweetedIds[i]);
    if (!sourceId || emitted.has(sourceId)) continue;
    const source = byId.get(sourceId);
    if (!source) continue;
    retweetShells.push(buildRetweetShell(source));
    emitted.add(sourceId);
  }

  return [...retweetShells, ...unique];
}

function _getLocalPosts(state: XState): XPost[] {
  return _mergeLocalPosts({ posts: state.posts, user: state.user, basePosts: state._basePosts });
}

function _buildPostIndex(basePosts: XPost[], storePosts: XRuntimePostTable = {}): Map<string, XPost> {
  const m = new Map<string, XPost>();
  for (const p of resolveXRuntimePosts(storePosts, basePosts)) {
    m.set(p.id, p);
    m.set(p.id.toLowerCase(), p);
  }
  return m;
}

function _getAllUsers(state: XState): Record<string, XUser> {
  return state._baseUsers;
}

function _findReplyInTree(replies: XPost[] | undefined, targetId: string): XPost | null {
  if (!Array.isArray(replies)) return null;

  for (const reply of replies) {
    if (!reply) continue;
    if (reply.id === targetId) return reply;

    const nested = _findReplyInTree(reply.replies, targetId);
    if (nested) return nested;
  }

  return null;
}

function _resolveRawReplyById(postId: string): XPost | null {
  const match = REPLY_ROOT_ID_PATTERN.exec(postId);
  if (!match) return null;

  const rootPostId = match[1];
  const repliesMap = getRepliesSync();
  if (!repliesMap) return null;

  const rootReplies = repliesMap[rootPostId];
  if (!Array.isArray(rootReplies)) return null;

  return _findReplyInTree(rootReplies, postId);
}

function _resolveReplyById(postId: string, allUsers: Record<string, XUser>): XPost | null {
  const resolved = _resolveRawReplyById(postId);
  return resolved ? hydrateReplyTree(resolved, allUsers) : null;
}

// ---- Store type ----
type XStore = XState & XActions;

// ---- Memoized Selectors ----

// Derive hydrated user (the "me" user with following/followers counts)
export const selectUser = memoSelector(
  (s: XStore) => s.user,
  (user) => ({
    ...user,
    following: user.followedUserIds.length,
    followers: user.followerUserIds.length,
  }),
);

// Derive all users (base + current user, deduplicated by canonical handle)
export const selectAllUsers = memoSelector(
  (s: XStore) => ({ baseUsers: s._baseUsers, user: s.user }),
  ({ baseUsers, user: currentRuntimeUser }) => {
    const merged: Record<string, any> = {
      ...baseUsers,
      [currentRuntimeUser.id]: currentRuntimeUser,
    };
    const seen = new Map<string, string>();
    const result: Record<string, XUser> = {};
    for (const [id, user] of Object.entries(merged)) {
      const canonical = (user.screenName || user.handle?.replace('@', '') || '').toLowerCase();
      if (!canonical) { result[id] = user; continue; }
      const existingId = seen.get(canonical);
      if (!existingId) {
        seen.set(canonical, id);
        result[id] = user;
      } else if (id === currentRuntimeUser.id) {
        delete result[existingId];
        seen.set(canonical, id);
        result[id] = user;
      }
    }
    return result;
  },
);

// Derive local posts (merged runtime overlay + base posts)
export const selectLocalPosts = memoSelector(
  (s: XStore) => ({ posts: s.posts, basePosts: s._basePosts, user: s.user }),
  (input) => _mergeLocalPosts(input),
);

// Post index for quotedPost / threadId lookups
const selectPostIndex = memoSelector(
  (s: XStore) => ({ basePosts: s._basePosts, storePosts: s.posts }),
  ({ basePosts, storePosts }) => {
    return _buildPostIndex(basePosts, storePosts);
  },
);

// Hydrated "For You" posts (limited to 200)
export const selectHydratedPosts = memoSelector(
  (s: XStore) => ({
    localPosts: selectLocalPosts(s),
    allUsers: selectAllUsers(s),
    postIndex: selectPostIndex(s),
  }),
  (input) => input.localPosts.slice(0, 200).map((p) => hydratePost(p, input.allUsers, input.postIndex)),
);

// Hydrated "Following" posts
export const selectHydratedFollowingPosts = memoSelector(
  (s: XStore) => ({
    localPosts: selectLocalPosts(s),
    allUsers: selectAllUsers(s),
    postIndex: selectPostIndex(s),
    followedUserIds: s.user.followedUserIds,
  }),
  (input) => {
    const followSet = new Set(input.followedUserIds.map((id) => id.toLowerCase()));
    followSet.add(X_IDS.meUserId.toLowerCase());
    return input.localPosts
      .filter((p) => followSet.has(p.authorId.toLowerCase()))
      .slice(0, 100)
      .map((p) => hydratePost(p, input.allUsers, input.postIndex));
  },
);

// Resolve a post by ID from either localPosts or postIndex (for quoted posts)
export const selectResolvedPostById = (postId: string) =>
  memoSelector(
    (s: XStore) => ({
      localPosts: selectLocalPosts(s),
      postIndex: selectPostIndex(s),
      allUsers: selectAllUsers(s),
      repliesLoaded: s._temp.repliesLoaded,
    }),
    (input) => {
      const id = String(postId || '');
      if (!id) return null;

      // First try to find in localPosts (main timeline)
      const localPost = input.localPosts.find((p) => p.id === id);
      if (localPost) return hydratePost(localPost, input.allUsers, input.postIndex);

      // Then try postIndex (for quoted posts or imported posts)
      const indexedPost = input.postIndex.get(id);
      if (indexedPost) return hydratePost(indexedPost, input.allUsers, input.postIndex);

      // Finally try replies if loaded
      if (!input.repliesLoaded) return null;
      return _resolveReplyById(id, input.allUsers);
    },
  );

// Hydrated posts for a specific user's profile (filter-first, then hydrate)
export const selectUserProfilePosts = (userId: string, limit = 80) =>
  memoSelector(
    (s: XStore) => ({
      localPosts: selectLocalPosts(s),
      allUsers: selectAllUsers(s),
      postIndex: selectPostIndex(s),
    }),
    (input) => {
      const uid = userId.toLowerCase();
      const filtered: XPost[] = [];
      for (const p of input.localPosts) {
        if (p.authorId.toLowerCase() === uid) {
          filtered.push(p);
          if (filtered.length >= limit) break;
        }
      }
      return filtered.map((p) => hydratePost(p, input.allUsers, input.postIndex));
    },
  );

// Search over the full post pool (filter-first, hydrate only matches).
// Whitespace (incl. newlines) is collapsed on both sides so queries don't
// break across paragraph boundaries — matches the benchmark keyword sampler.
// `limit` is the match-pool cap, not the display cap — downstream tab sort/
// filter (hot, latest, video, photo) must happen on the full pool.
export const selectSearchPosts = (query: string, limit = 1000) =>
  memoSelector(
    (s: XStore) => ({
      localPosts: selectLocalPosts(s),
      allUsers: selectAllUsers(s),
      postIndex: selectPostIndex(s),
    }),
    (input) => {
      const q = query.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!q) return [];
      const hits: XPost[] = [];
      for (const p of input.localPosts) {
        const content = (p.content || '').toLowerCase().replace(/\s+/g, ' ');
        const author = input.allUsers[p.authorId.toLowerCase()] || input.allUsers[p.authorId];
        const name = (author?.name || '').toLowerCase();
        const handle = (author?.handle || '').toLowerCase();
        if (content.includes(q) || name.includes(q) || handle.includes(q)) {
          hits.push(p);
          if (hits.length >= limit) break;
        }
      }
      return hits.map((p) => hydratePost(p, input.allUsers, input.postIndex));
    },
  );

// Effective followed user IDs as a Set for O(1) lookups
export const selectEffectiveFollowedSet = memoSelector(
  (s: XStore) => s.user.followedUserIds,
  (ids) => new Set(ids.map((id) => id.toLowerCase())),
);

// Trends (static)
export const selectTrends = () => trends;

// Hydrated notifications
export const selectNotifications = memoSelector(
  (s: XStore) => selectAllUsers(s),
  (allUsers) =>
    notifications.map((n: any) => {
      const actor = allUsers[n.actorId] || allUsers[n.actorId?.toLowerCase?.() as any];
      return {
        ...n,
        actor: {
          name: actor?.name || 'Unknown',
          handle: actor?.handle || '@unknown',
          avatar: actor?.avatar,
        },
      };
    }),
);

// Mention notifications
export const selectMentionNotifications = memoSelector(
  (s: XStore) => selectNotifications(s),
  (notifications) => notifications.filter((n: any) => n.type === 'mention'),
);

// Hydrated conversations
export const selectConversations = memoSelector(
  (s: XStore) => ({ conversations: s.conversations, allUsers: selectAllUsers(s) }),
  (input) => {
    const localConversations = input.conversations.length > 0 ? input.conversations : conversations;
    return localConversations.map((c) => {
      const participant = input.allUsers[c.participantId] || input.allUsers[c.participantId?.toLowerCase?.()];
      const lastMsg = c.messages[c.messages.length - 1];
      return {
        ...c,
        participant: {
          name: participant?.name || 'Unknown',
          handle: participant?.handle || '@unknown',
          avatar: participant?.avatar,
          verified: participant?.verified,
        },
        lastMessage: {
          ...lastMsg,
          senderHandle: input.allUsers[lastMsg.senderId]?.handle,
          isMe: lastMsg.senderId === X_IDS.meUserId,
        },
        messages: c.messages.map((m: XMessage & { isMe?: boolean }) => ({
          ...m,
          senderHandle: input.allUsers[m.senderId]?.handle,
          isMe: m.senderId === X_IDS.meUserId,
        })),
      };
    });
  },
);

// Hydrated search history
export const selectRecentSearches = memoSelector(
  (s: XStore) => selectAllUsers(s),
  (allUsers) =>
    searchHistory.map((h: any) => {
      if (h.type === 'user' && h.userId) {
        const id = String(h.userId);
        return { ...h, user: allUsers[id] || allUsers[id.toLowerCase()] };
      }
      return h;
    }),
);

// Hydrated replies under a specific post
export const selectRepliesForPost = (postId: string) =>
  memoSelector(
    (s: XStore) => s._baseUsers,
    (baseUsers) => {
      const id = String(postId || '');
      if (!id) return [];
      const map = getRepliesSync();
      if (!map) return [];
      const raw = map[id] || [];
      if (!Array.isArray(raw)) return [];
      return raw.map((r) => hydrateReplyTree(r, baseUsers));
    },
  );

// Hydrated replies authored by a specific user
export const selectUserReplies = (userId: string, limit = 80) =>
  memoSelector(
    (s: XStore) => ({
      baseUsers: s._baseUsers,
      basePosts: s._basePosts,
      posts: s.posts,
      user: s.user,
      followedUserIds: s.user.followedUserIds,
      repliesLoaded: s._temp.repliesLoaded,
    }),
    (input) => {
      const uid = String(userId || '').toLowerCase();
      if (!uid || !input.repliesLoaded) return [];

      const map = getRepliesSync();
      if (!map) return [];

      const allUsers = input.baseUsers;
      const localPosts = _mergeLocalPosts(input);
      const postIdx = _buildPostIndex(input.basePosts, input.posts);
      const hydratedPosts = localPosts.slice(0, 200).map((p) => hydratePost(p, allUsers, postIdx));
      const followSet = new Set(input.followedUserIds.map((id) => id.toLowerCase()));
      const hydratedFollowing = localPosts
        .filter((p) => followSet.has(p.authorId.toLowerCase()))
        .slice(0, 100)
        .map((p) => hydratePost(p, allUsers, postIdx));

      const hydratedPostById = new Map<string, any>();
      for (const p of hydratedPosts) hydratedPostById.set(p.id, p);
      for (const p of hydratedFollowing) if (!hydratedPostById.has(p.id)) hydratedPostById.set(p.id, p);

      const items: { reply: XPost; parent?: any }[] = [];
      outer: for (const [parentId, replies] of Object.entries(map)) {
        if (!Array.isArray(replies)) continue;
        for (const r of replies as any[]) {
          if (!r) continue;
          const rid = String(r.authorId || '').toLowerCase();
          if (rid !== uid) continue;
          const parent = hydratedPostById.get(parentId);
          items.push({ reply: hydrateReplyTree(r as XPost, allUsers), parent });
          if (items.length >= limit) break outer;
        }
      }
      return items;
    },
  );

// ---- State adapter for bench_env ----
registerStateAdapter('x', (raw: any) => {
  const {
    _baseUsers,
    _basePosts,
    currentSearchQuery: _currentSearchQuery,
    pendingQuotedPostId: _pendingQuotedPostId,
    _temp,
    ...runtime
  } = raw;

  return {
    ...runtime,
    user: {
      ...runtime.user,
      following: (runtime.user?.followedUserIds ?? []).length,
      followers: (runtime.user?.followerUserIds ?? []).length,
    },
  };
});
