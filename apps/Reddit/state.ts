import { createAppStoreWithActions, registerStateAdapter } from '../../os/createAppStore';
import { REDDIT_CONFIG } from './data';
import type { RedditPost, RedditSettings } from './types';
import { loadPosts, getPostsSync } from './data/loader';
import { getUserAvatar } from './utils/userIdentity';
import * as TimeService from '../../os/TimeService';

// ── Types ──────────────────────────────────────────────────────────

export interface CreateDraftCommunity {
  id: string;
  name: string;
  iconBg: string;
  iconText: string;
  iconTextColor: string;
}

export interface CreateDraft {
  selectedCommunity: CreateDraftCommunity | null;
  selectedFlairs: string[];
}

type ChatMessage = {
  id: string;
  from: 'me' | 'them';
  body: string;
  created_utc: number;
};

type UserComment = {
  id: string;
  author: string;
  body: string;
  score: number;
  created_utc?: number;
  parentId?: string;
};

// ── State & Actions interfaces ─────────────────────────────────────

export interface RedditState {
  user: typeof REDDIT_CONFIG.user;
  communities: typeof REDDIT_CONFIG.communities;
  posts: RedditPost[];
  joinedCommunityIds: string[];
  postVotes: Record<string, 'up' | 'down'>;
  commentVotes: Record<string, 'up' | 'down'>;
  chatThreadsByUsername: Record<string, ChatMessage[]>;
  chatThreadRepliesByKey: Record<string, ChatMessage[]>;
  userCommentsByPostId: Record<string, UserComment[]>;
  userPosts: RedditPost[];
  createDraft: CreateDraft;
  settings: RedditSettings;
}

export interface RedditActions {
  // Settings
  updateSettings: (patch: Partial<RedditSettings>) => void;

  // Post votes
  votePost: (postId: string, dir: 'up' | 'down') => void;

  // Comment votes
  voteComment: (postId: string, commentId: string, dir: 'up' | 'down') => void;

  // Comments
  addComment: (postId: string, body: string) => void;
  addReplyComment: (postId: string, parentCommentId: string, body: string) => void;
  editComment: (postId: string, commentId: string, body: string) => void;
  deleteOwnComment: (postId: string, comment: UserComment) => void;

  // Posts
  deletePost: (postId: string) => void;
  createPost: (params: {
    title: string;
    body: string;
    imageUris: string[];
  }) => void;

  // Communities
  toggleJoin: (communityId: string) => void;

  // Create draft
  selectCommunity: (community: CreateDraftCommunity) => void;
  addFlair: (flair: string) => void;
  resetCreateDraft: () => void;

  // Profile
  saveProfile: (params: {
    username: string;
    bio: string;
    bannerImage: string;
    avatarImage: string;
  }) => void;

  // Chat
  seedChatThread: (username: string, seedBody: string) => void;
  sendChatMessage: (username: string, body: string) => void;
  deleteChatMessage: (username: string, messageId: string) => void;
  sendChatReply: (username: string, messageId: string, body: string) => void;

  // Comment storage trimming
  trimUserComments: () => void;
}

// ── Initial state ──────────────────────────────────────────────────

const initialState: RedditState = {
  user: REDDIT_CONFIG.user,
  communities: REDDIT_CONFIG.communities,
  posts: [...REDDIT_CONFIG.samplePosts, ...(getPostsSync() ?? [])],
  joinedCommunityIds: [],
  postVotes: {},
  commentVotes: {},
  chatThreadsByUsername: REDDIT_CONFIG.chatThreads as Record<string, ChatMessage[]>,
  chatThreadRepliesByKey: REDDIT_CONFIG.chatReplies as Record<string, ChatMessage[]>,
  userCommentsByPostId: REDDIT_CONFIG.userComments as Record<string, UserComment[]>,
  userPosts: REDDIT_CONFIG.userPosts as RedditPost[],
  createDraft: {
    selectedCommunity: null,
    selectedFlairs: [],
  },
  settings: REDDIT_CONFIG.settings,
};

// ── Local sequence counter for generating unique IDs ───────────────
let localSeq = 0;
function nextLocalId(): string {
  const nowSec = Math.floor(TimeService.now() / 1000);
  localSeq += 1;
  return `local_${nowSec}_${localSeq}`;
}

// ── Store ──────────────────────────────────────────────────────────

export const useRedditStore = createAppStoreWithActions<RedditState, RedditActions>(
  'reddit',
  initialState,
  (set, get) => ({
    // ── Settings ──────────────────────────────────────────────
    updateSettings: (patch) => {
      set(state => ({ settings: { ...state.settings, ...patch } }));
    },

    // ── Post votes ────────────────────────────────────────────
    votePost: (postId, dir) => {
      const current = get().postVotes[postId];
      const next = current === dir ? undefined : dir;
      const nextMap = { ...get().postVotes };
      if (!next) delete nextMap[postId];
      else nextMap[postId] = next;
      set({ postVotes: nextMap });
    },

    // ── Comment votes ─────────────────────────────────────────
    voteComment: (postId, commentId, dir) => {
      const key = `${postId}:${commentId}`;
      const current = get().commentVotes[key];
      const next = current === dir ? undefined : dir;
      const nextMap = { ...get().commentVotes };
      if (!next) delete nextMap[key];
      else nextMap[key] = next;
      set({ commentVotes: nextMap });
    },

    // ── Comments ──────────────────────────────────────────────
    addComment: (postId, body) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const s = get();
      const newComment: UserComment = {
        id: nextLocalId(),
        author: s.user.username || 'Embarrassed_Fee8630',
        body: trimmed,
        score: 1,
        created_utc: Math.floor(TimeService.now() / 1000),
      };
      const prevList = Array.isArray(s.userCommentsByPostId[postId]) ? s.userCommentsByPostId[postId] : [];
      set({
        userCommentsByPostId: {
          ...s.userCommentsByPostId,
          [postId]: [...prevList, newComment],
        },
      });
    },

    addReplyComment: (postId, parentCommentId, body) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const s = get();
      const newComment: UserComment = {
        id: nextLocalId(),
        author: s.user.username || 'Embarrassed_Fee8630',
        body: trimmed,
        score: 1,
        created_utc: Math.floor(TimeService.now() / 1000),
        parentId: parentCommentId,
      };
      const prevList = Array.isArray(s.userCommentsByPostId[postId]) ? s.userCommentsByPostId[postId] : [];
      set({
        userCommentsByPostId: {
          ...s.userCommentsByPostId,
          [postId]: [...prevList, newComment],
        },
      });
    },

    editComment: (postId, commentId, body) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const s = get();
      const prevList = Array.isArray(s.userCommentsByPostId[postId]) ? s.userCommentsByPostId[postId] : [];
      const nextList = prevList.map((c) => (c.id === commentId ? { ...c, body: trimmed } : c));
      set({
        userCommentsByPostId: { ...s.userCommentsByPostId, [postId]: nextList },
      });
    },

    deleteOwnComment: (postId, comment) => {
      const s = get();
      const list = Array.isArray(s.userCommentsByPostId[postId]) ? s.userCommentsByPostId[postId] : [];
      // Cascade delete: remove this comment and any user-generated descendants
      const toDelete = new Set<string>([comment.id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const item of list) {
          if (item.parentId && toDelete.has(String(item.parentId)) && !toDelete.has(item.id)) {
            toDelete.add(item.id);
            changed = true;
          }
        }
      }
      const nextList = list.filter((x) => !toDelete.has(x.id));
      const nextVotes = { ...s.commentVotes };
      for (const id of toDelete) {
        delete nextVotes[`${postId}:${id}`];
      }
      set({
        userCommentsByPostId: { ...s.userCommentsByPostId, [postId]: nextList },
        commentVotes: nextVotes,
      });
    },

    // ── Posts ──────────────────────────────────────────────────
    deletePost: (postId) => {
      const s = get();
      set({
        posts: s.posts.filter((p) => p.id !== postId),
        userPosts: s.userPosts.filter((p) => p.id !== postId),
      });
    },

    createPost: ({ title, body, imageUris }) => {
      const s = get();
      const newId = `user_post_${TimeService.now()}`;
      const communityName = s.createDraft.selectedCommunity?.name ?? 'r/self';
      const newPost: RedditPost = {
        id: newId,
        subreddit: communityName,
        subredditIcon: undefined,
        author: s.user.username,
        authorAvatar: getUserAvatar(s.user.username),
        timeAgo: 'now',
        title: title.trim(),
        content: body.trim(),
        image: imageUris[0],
        images: imageUris.length > 0 ? imageUris : undefined,
        upvotes: '1',
        comments: '0',
        shares: 0,
        isAd: false,
        commentsData: [],
      };
      set({
        posts: [newPost, ...s.posts],
        userPosts: [newPost, ...s.userPosts],
        postVotes: { ...s.postVotes, [newId]: 'up' as const },
        createDraft: { selectedCommunity: null, selectedFlairs: [] },
      });
    },

    // ── Communities ────────────────────────────────────────────
    toggleJoin: (communityId) => {
      const s = get();
      const has = s.joinedCommunityIds.includes(communityId);
      set({
        joinedCommunityIds: has
          ? s.joinedCommunityIds.filter((x) => x !== communityId)
          : [...s.joinedCommunityIds, communityId],
      });
    },

    // ── Create draft ──────────────────────────────────────────
    selectCommunity: (community) => {
      set({
        createDraft: {
          ...get().createDraft,
          selectedCommunity: community,
          selectedFlairs: [],
        },
      });
    },

    addFlair: (flair) => {
      const s = get();
      set({
        createDraft: {
          ...s.createDraft,
          selectedFlairs: [...s.createDraft.selectedFlairs, flair],
        },
      });
    },

    resetCreateDraft: () => {
      set({
        createDraft: { selectedCommunity: null, selectedFlairs: [] },
      });
    },

    // ── Profile ───────────────────────────────────────────────
    saveProfile: ({ username, bio, bannerImage, avatarImage }) => {
      const s = get();
      const oldUsername = s.user.username;
      const newUsername = username.trim();
      const newBio = bio.trim();

      const updatedUser = {
        ...s.user,
        username: newUsername,
        avatar: avatarImage || getUserAvatar(newUsername) || s.user.avatar,
        bio: newBio,
        bannerImage: bannerImage || s.user.bannerImage || '',
      };

      const updatedPosts = s.posts.map((p) =>
        p.author === oldUsername ? { ...p, author: newUsername } : p,
      );
      const updatedUserPosts = s.userPosts.map((p) =>
        p.author === oldUsername ? { ...p, author: newUsername } : p,
      );

      const updatedComments: typeof s.userCommentsByPostId = {};
      for (const [postId, list] of Object.entries(s.userCommentsByPostId)) {
        if (!Array.isArray(list)) continue;
        updatedComments[postId] = list.map((c) =>
          c.author === oldUsername ? { ...c, author: newUsername } : c,
        );
      }

      set({
        user: updatedUser,
        posts: updatedPosts,
        userPosts: updatedUserPosts,
        userCommentsByPostId: updatedComments,
      });
    },

    // ── Chat ──────────────────────────────────────────────────
    seedChatThread: (username, seedBody) => {
      const s = get();
      const existing = s.chatThreadsByUsername[username];
      if (Array.isArray(existing) && existing.length > 0) return;
      const nowSec = Math.floor(TimeService.now() / 1000);
      const initial: ChatMessage[] = [
        { id: `seed_${username}`, from: 'me', body: seedBody, created_utc: nowSec - 86400 },
      ];
      set({
        chatThreadsByUsername: { ...s.chatThreadsByUsername, [username]: initial },
      });
    },

    sendChatMessage: (username, body) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const s = get();
      const msg: ChatMessage = {
        id: nextLocalId(),
        from: 'me',
        body: trimmed,
        created_utc: Math.floor(TimeService.now() / 1000),
      };
      const list = Array.isArray(s.chatThreadsByUsername[username]) ? s.chatThreadsByUsername[username] : [];
      set({
        chatThreadsByUsername: {
          ...s.chatThreadsByUsername,
          [username]: [...list, msg],
        },
      });
    },

    deleteChatMessage: (username, messageId) => {
      const s = get();
      const list = Array.isArray(s.chatThreadsByUsername[username]) ? s.chatThreadsByUsername[username] : [];
      const next = list.filter((m) => String(m.id) !== String(messageId));
      set({
        chatThreadsByUsername: {
          ...s.chatThreadsByUsername,
          [username]: next,
        },
      });
    },

    sendChatReply: (username, messageId, body) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const s = get();
      const k = `${username}:${messageId}`;
      const reply: ChatMessage = {
        id: `reply_${Math.floor(TimeService.now() / 1000)}_${++localSeq}`,
        from: 'me',
        body: trimmed,
        created_utc: Math.floor(TimeService.now() / 1000),
      };
      const prevList = Array.isArray(s.chatThreadRepliesByKey?.[k]) ? s.chatThreadRepliesByKey[k] : [];
      set({
        chatThreadRepliesByKey: {
          ...(s.chatThreadRepliesByKey ?? {}),
          [k]: [...prevList, reply],
        },
      });
    },

    // ── Comment trimming ──────────────────────────────────────
    trimUserComments: () => {
      const MAX_PER_POST = 50;
      const MAX_TOTAL = 300;
      const s = get();
      const entries = Object.entries(s.userCommentsByPostId);
      if (entries.length === 0) return;

      let total = 0;
      let needsTrim = false;
      for (const [, list] of entries) {
        const len = Array.isArray(list) ? list.length : 0;
        total += len;
        if (len > MAX_PER_POST) needsTrim = true;
      }
      if (!needsTrim && total <= MAX_TOTAL) return;

      // 1) Trim per post
      const perPostTrimmed: typeof s.userCommentsByPostId = {};
      for (const [postId, list] of entries) {
        const arr = Array.isArray(list) ? list.slice(-MAX_PER_POST) : [];
        if (arr.length) perPostTrimmed[postId] = arr;
      }

      // 2) If still too many, trim globally
      const flat = Object.entries(perPostTrimmed).flatMap(([pid, arr]) =>
        arr.map((c, idx) => ({ pid, c, idx })),
      );
      if (flat.length > MAX_TOTAL) {
        flat.sort((a, b) => ((a.c.created_utc ?? 0) - (b.c.created_utc ?? 0)) || (a.idx - b.idx));
        const keep = flat.slice(flat.length - MAX_TOTAL);
        const regroup: typeof s.userCommentsByPostId = {};
        for (const item of keep) {
          (regroup[item.pid] ??= []).push(item.c);
        }
        set({ userCommentsByPostId: regroup });
        return;
      }

      set({ userCommentsByPostId: perPostTrimmed });
    },
  }),
  {
    partialize: (state) => {
      const result: Record<string, any> = {};
      const EXCLUDE = new Set(['createDraft', 'posts', 'communities']);
      for (const [k, v] of Object.entries(state)) {
        if (typeof v === 'function') continue;
        if (EXCLUDE.has(k)) continue;
        result[k] = v;
      }
      return result as Partial<RedditState>;
    },
    afterHydration: () => {
      // Defer to avoid TDZ when persist hydration completes synchronously.
      // In some boot paths (e.g. benchmark runner), zustand persist may call afterHydration
      // before this module finishes initializing `useRedditStore`.
      const defer = (fn: () => void) => {
        if (typeof queueMicrotask === 'function') queueMicrotask(fn);
        else Promise.resolve().then(fn);
      };

      defer(() => {
        if ((window as any).__SIM__?._benchmarkPatchedApps?.has('reddit')) return;

        const samplePosts = REDDIT_CONFIG.samplePosts;
        const sampleIds = new Set(samplePosts.map((p) => p.id));

        const merge = (configPosts: RedditPost[]) => {
          const { userPosts } = useRedditStore.getState();
          const configWithoutSamples = configPosts.filter((p) => !sampleIds.has(p.id));

          if (userPosts.length > 0) {
            const configPostIds = new Set(configWithoutSamples.map((p) => p.id));
            const uniqueUserPosts = userPosts.filter((p) => !configPostIds.has(p.id) && !sampleIds.has(p.id));
            useRedditStore.setState({ posts: [...uniqueUserPosts, ...samplePosts, ...configWithoutSamples] });
          } else {
            useRedditStore.setState({ posts: [...samplePosts, ...configWithoutSamples] });
          }
        };

        const cached = getPostsSync();
        if (cached) {
          merge(cached);
        } else {
          loadPosts().then(merge);
        }
      });
    },
  },
);

// bench_env getState() 快照时剥掉每个帖子的 commentsData（10MB+），
// 仅保留 id/title/subreddit 等元数据。UI 内存里的原始数据不受影响。
// judge 只需要 userCommentsByPostId，不需要预加载的 commentsData。
registerStateAdapter('reddit', (raw: RedditState) => ({
  ...raw,
  posts: (raw.posts ?? []).map(({ commentsData: _cd, ...rest }) => rest),
  userPosts: (raw.userPosts ?? []).map(({ commentsData: _cd, ...rest }) => rest),
}));
