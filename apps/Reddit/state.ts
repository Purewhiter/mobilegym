import { createAppStoreWithActions, registerStateAdapter } from '../../os/createAppStore';
import { REDDIT_CONFIG } from './data';
import type { Comment, RedditCommentsOverlay, RedditPost, RedditPostsOverlay, RedditSettings } from './types';
import { getUserAvatar } from './utils/userIdentity';
import * as TimeService from '../../os/TimeService';
import { collectRedditCommentDeletionIds } from './utils/commentTree';

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

export interface RedditUser {
  username: string;
  isOnline: boolean;
  bio?: string;
  avatar?: string;
  bannerImage?: string;
  postIds: string[];
  commentIds: string[];
  savedPostIds: string[];
  joinedCommunityIds: string[];
  postVotes: Record<string, 'up' | 'down'>;
  commentVotes: Record<string, 'up' | 'down'>;
}

// ── State & Actions interfaces ─────────────────────────────────────

export interface RedditState {
  user: RedditUser;
  posts: RedditPostsOverlay;
  comments: RedditCommentsOverlay;
  chatThreads: Record<string, ChatMessage[]>;
  chatReplies: Record<string, ChatMessage[]>;
  settings: RedditSettings;
  createDraft: CreateDraft;
}

export interface RedditActions {
  updateSettings: (patch: Partial<RedditSettings>) => void;
  votePost: (postId: string, dir: 'up' | 'down') => void;
  voteComment: (commentKey: string, dir: 'up' | 'down') => void;
  toggleSave: (postId: string) => void;
  addComment: (postId: string, body: string) => void;
  addReplyComment: (postId: string, parentCommentId: string, body: string) => void;
  editComment: (commentId: string, body: string) => void;
  deleteOwnComment: (commentId: string) => void;
  deleteOwnPost: (postId: string) => void;
  updateOwnPost: (postId: string, patch: Partial<RedditPost>) => void;
  createPost: (post: RedditPost) => void;
  toggleJoin: (communityId: string) => void;
  toggleJoinCommunity: (communityId: string) => void;
  selectCommunity: (community: CreateDraftCommunity) => void;
  addFlair: (flair: string) => void;
  resetCreateDraft: () => void;
  saveProfile: (params: {
    username: string;
    bio: string;
    bannerImage: string;
    avatarImage: string;
  }) => void;
  seedChatThread: (username: string, seedBody: string) => void;
  sendChatMessage: (username: string, body: string) => void;
  deleteChatMessage: (username: string, messageId: string) => void;
  sendChatReply: (username: string, messageId: string, body: string) => void;
  trimUserComments: () => void;
}

// ── Initial state ──────────────────────────────────────────────────

const initialState: RedditState = {
  user: {
    ...REDDIT_CONFIG.user,
    postIds: [...(REDDIT_CONFIG.user.postIds ?? [])],
    commentIds: [...(REDDIT_CONFIG.user.commentIds ?? [])],
    savedPostIds: [...(REDDIT_CONFIG.user.savedPostIds ?? [])],
    joinedCommunityIds: [...(REDDIT_CONFIG.user.joinedCommunityIds ?? [])],
    postVotes: { ...(REDDIT_CONFIG.user.postVotes ?? {}) },
    commentVotes: { ...(REDDIT_CONFIG.user.commentVotes ?? {}) },
  },
  posts: { ...REDDIT_CONFIG.posts },
  comments: { ...REDDIT_CONFIG.comments },
  chatThreads: REDDIT_CONFIG.chatThreads as Record<string, ChatMessage[]>,
  chatReplies: REDDIT_CONFIG.chatReplies as Record<string, ChatMessage[]>,
  settings: REDDIT_CONFIG.settings,
  createDraft: {
    selectedCommunity: null,
    selectedFlairs: [],
  },
};

// ── Local sequence counter for generating unique IDs ───────────────

let localSeq = 0;
function nextLocalId(): string {
  const nowSec = Math.floor(TimeService.now() / 1000);
  localSeq += 1;
  return `local_${nowSec}_${localSeq}`;
}

function toggleId(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

// ── Store ──────────────────────────────────────────────────────────

export const useRedditStore = createAppStoreWithActions<RedditState, RedditActions>(
  'reddit',
  initialState,
  (set, get) => ({
    updateSettings: (patch) => {
      set(state => ({ settings: { ...state.settings, ...patch } }));
    },

    votePost: (postId, dir) => {
      const s = get();
      const current = s.user.postVotes[postId];
      const nextVotes = { ...s.user.postVotes };
      if (current === dir) delete nextVotes[postId];
      else nextVotes[postId] = dir;
      set({ user: { ...s.user, postVotes: nextVotes } });
    },

    voteComment: (commentKey, dir) => {
      const s = get();
      const current = s.user.commentVotes[commentKey];
      const nextVotes = { ...s.user.commentVotes };
      if (current === dir) delete nextVotes[commentKey];
      else nextVotes[commentKey] = dir;
      set({ user: { ...s.user, commentVotes: nextVotes } });
    },

    toggleSave: (postId) => {
      const s = get();
      set({
        user: {
          ...s.user,
          savedPostIds: toggleId(s.user.savedPostIds, postId),
        },
      });
    },

    addComment: (postId, body) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const s = get();
      const newComment: Comment = {
        id: nextLocalId(),
        postId,
        author: s.user.username || 'Embarrassed_Fee8630',
        body: trimmed,
        score: 1,
        created_utc: Math.floor(TimeService.now() / 1000),
      };
      set({
        comments: {
          ...s.comments,
          [newComment.id]: newComment,
        },
        user: {
          ...s.user,
          commentIds: [...s.user.commentIds, newComment.id],
        },
      });
    },

    addReplyComment: (postId, parentCommentId, body) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const s = get();
      const newComment: Comment = {
        id: nextLocalId(),
        postId,
        author: s.user.username || 'Embarrassed_Fee8630',
        body: trimmed,
        score: 1,
        created_utc: Math.floor(TimeService.now() / 1000),
        parentId: parentCommentId,
      };
      set({
        comments: {
          ...s.comments,
          [newComment.id]: newComment,
        },
        user: {
          ...s.user,
          commentIds: [...s.user.commentIds, newComment.id],
        },
      });
    },

    editComment: (commentId, body) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      const s = get();
      const current = s.comments[commentId];
      if (!current || !s.user.commentIds.includes(commentId)) return;
      set({
        comments: {
          ...s.comments,
          [commentId]: { ...current, body: trimmed },
        },
      });
    },

    deleteOwnComment: (commentId) => {
      const s = get();
      if (!s.user.commentIds.includes(commentId)) return;
      const current = s.comments[commentId];
      if (!current) return;
      const toDelete = collectRedditCommentDeletionIds(
        s.comments,
        commentId,
        String(s.user.username || 'Embarrassed_Fee8630'),
      );
      if (toDelete.length === 0) return;
      const deleteSet = new Set(toDelete);
      const rest = { ...s.comments };
      for (const id of deleteSet) {
        delete rest[id];
      }
      const nextVotes = { ...s.user.commentVotes };
      for (const id of deleteSet) {
        const item = s.comments[id];
        if (item?.postId) delete nextVotes[`${item.postId}:${id}`];
      }
      set({
        comments: rest,
        user: {
          ...s.user,
          commentIds: s.user.commentIds.filter((id) => !deleteSet.has(id)),
          commentVotes: nextVotes,
        },
      });
    },

    deleteOwnPost: (postId) => {
      const s = get();
      if (!s.user.postIds.includes(postId)) return;
      const { [postId]: _deleted, ...rest } = s.posts;
      set({
        posts: rest,
        user: {
          ...s.user,
          postIds: s.user.postIds.filter((id) => id !== postId),
        },
      });
    },

    updateOwnPost: (postId, patch) => {
      const s = get();
      const current = s.posts[postId];
      if (!current || !s.user.postIds.includes(postId)) return;
      set({
        posts: {
          ...s.posts,
          [postId]: { ...current, ...patch },
        },
      });
    },

    createPost: (post) => {
      const s = get();
      set({
        posts: { ...s.posts, [post.id]: post },
        user: {
          ...s.user,
          postIds: [...s.user.postIds, post.id],
          postVotes: { ...s.user.postVotes, [post.id]: 'up' as const },
        },
        createDraft: { selectedCommunity: null, selectedFlairs: [] },
      });
    },

    toggleJoin: (communityId) => {
      const s = get();
      set({
        user: {
          ...s.user,
          joinedCommunityIds: toggleId(s.user.joinedCommunityIds, communityId),
        },
      });
    },

    toggleJoinCommunity: (communityId) => {
      get().toggleJoin(communityId);
    },

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

    saveProfile: ({ username, bio, bannerImage, avatarImage }) => {
      const s = get();
      const oldUsername = s.user.username;
      const newUsername = username.trim();
      const newBio = bio.trim();

      const updatedUser: RedditUser = {
        ...s.user,
        username: newUsername,
        avatar: avatarImage || getUserAvatar(newUsername) || s.user.avatar,
        bio: newBio,
        bannerImage: bannerImage || s.user.bannerImage || '',
      };

      const updatedPosts = Object.fromEntries(
        Object.entries(s.posts).map(([id, post]) => [
          id,
          post && post.author === oldUsername ? { ...post, author: newUsername } : post,
        ]),
      );

      const updatedComments = Object.fromEntries(
        Object.entries(s.comments).map(([id, comment]) => [
          id,
          comment && comment.author === oldUsername ? { ...comment, author: newUsername } : comment,
        ]),
      );

      set({
        user: updatedUser,
        posts: updatedPosts,
        comments: updatedComments,
      });
    },

    seedChatThread: (username, seedBody) => {
      const s = get();
      const existing = s.chatThreads[username];
      if (Array.isArray(existing) && existing.length > 0) return;
      const nowSec = Math.floor(TimeService.now() / 1000);
      const initial: ChatMessage[] = [
        { id: `seed_${username}`, from: 'me', body: seedBody, created_utc: nowSec - 86400 },
      ];
      set({
        chatThreads: { ...s.chatThreads, [username]: initial },
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
      const list = Array.isArray(s.chatThreads[username]) ? s.chatThreads[username] : [];
      set({
        chatThreads: {
          ...s.chatThreads,
          [username]: [...list, msg],
        },
      });
    },

    deleteChatMessage: (username, messageId) => {
      const s = get();
      const list = Array.isArray(s.chatThreads[username]) ? s.chatThreads[username] : [];
      const next = list.filter((m) => String(m.id) !== String(messageId));
      set({
        chatThreads: {
          ...s.chatThreads,
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
      const prevList = Array.isArray(s.chatReplies?.[k]) ? s.chatReplies[k] : [];
      set({
        chatReplies: {
          ...(s.chatReplies ?? {}),
          [k]: [...prevList, reply],
        },
      });
    },

    trimUserComments: () => {
      const MAX_PER_POST = 50;
      const MAX_TOTAL = 300;
      const s = get();
      const own = s.user.commentIds
        .map((id) => s.comments[id])
        .filter((comment): comment is Comment => Boolean(comment));
      if (own.length <= MAX_TOTAL) {
        const perPostCounts = own.reduce<Record<string, number>>((acc, comment) => {
          acc[comment.postId] = (acc[comment.postId] ?? 0) + 1;
          return acc;
        }, {});
        if (Object.values(perPostCounts).every((count) => count <= MAX_PER_POST)) return;
      }

      const remove = new Set<string>();
      const byPost: Record<string, Comment[]> = {};
      for (const comment of own) {
        (byPost[comment.postId] ??= []).push(comment);
      }
      for (const comments of Object.values(byPost)) {
        comments.sort((a, b) => (a.created_utc ?? 0) - (b.created_utc ?? 0));
        for (const comment of comments.slice(0, Math.max(0, comments.length - MAX_PER_POST))) {
          remove.add(comment.id);
        }
      }

      const remainingOwn = own
        .filter((comment) => !remove.has(comment.id))
        .sort((a, b) => (a.created_utc ?? 0) - (b.created_utc ?? 0));
      for (const comment of remainingOwn.slice(0, Math.max(0, remainingOwn.length - MAX_TOTAL))) {
        remove.add(comment.id);
      }
      if (remove.size === 0) return;

      const nextComments = { ...s.comments };
      for (const id of remove) {
        delete nextComments[id];
      }
      set({
        comments: nextComments,
        user: {
          ...s.user,
          commentIds: s.user.commentIds.filter((id) => !remove.has(id)),
        },
      });
    },
  }),
  {
    partialize: (state) => {
      const result: Record<string, any> = {};
      const EXCLUDE = new Set(['createDraft']);
      for (const [k, v] of Object.entries(state)) {
        if (typeof v === 'function') continue;
        if (EXCLUDE.has(k)) continue;
        result[k] = v;
      }
      return result as Partial<RedditState>;
    },
  },
);

registerStateAdapter('reddit', (raw: RedditState) => ({
  ...raw,
  posts: Object.fromEntries(
    Object.entries(raw.posts ?? {}).map(([id, post]) => {
      if (post === null) return [id, null];
      const { commentsData: _cd, ...rest } = post;
      return [id, rest];
    }),
  ),
}));
