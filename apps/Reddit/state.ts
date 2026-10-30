import { registerStateAdapter } from '../../os/createAppStore';
import { createDeviceAppStore } from '../../os/device/deviceStore';
import { REDDIT_CONFIG } from './data';
import type { RedditCommentsOverlay, RedditPost, RedditPostsOverlay, RedditSettings } from './types';
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
  updateSettings: (patch: Partial<RedditSettings>) => Promise<void>;
  votePost: (postId: string, dir: 'up' | 'down') => Promise<void>;
  voteComment: (commentKey: string, dir: 'up' | 'down') => Promise<void>;
  toggleSave: (postId: string) => Promise<void>;
  addComment: (postId: string, body: string) => Promise<void>;
  addReplyComment: (postId: string, parentCommentId: string, body: string) => Promise<void>;
  editComment: (commentId: string, body: string) => Promise<void>;
  deleteOwnComment: (commentId: string) => Promise<void>;
  deleteOwnPost: (postId: string) => Promise<void>;
  updateOwnPost: (postId: string, patch: Partial<RedditPost>) => Promise<void>;
  createPost: (post: RedditPost) => Promise<void>;
  toggleJoin: (communityId: string) => Promise<void>;
  toggleJoinCommunity: (communityId: string) => Promise<void>;
  selectCommunity: (community: CreateDraftCommunity) => void;
  addFlair: (flair: string) => void;
  resetCreateDraft: () => void;
  saveProfile: (params: {
    username: string;
    bio: string;
    bannerImage: string;
    avatarImage: string;
  }) => Promise<void>;
  seedChatThread: (username: string, seedBody: string) => Promise<void>;
  sendChatMessage: (username: string, body: string) => Promise<void>;
  deleteChatMessage: (username: string, messageId: string) => Promise<void>;
  sendChatReply: (username: string, messageId: string, body: string) => Promise<void>;
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

// ── Store ──────────────────────────────────────────────────────────
//
// Everything but `createDraft` lives in the device server session
// (apps/Reddit/device); this store mirrors it, so components and
// `__SIM__.getState().apps.reddit` read the same shape as before. Actions run
// the matching server command; ids of new records are made here, as before.

const PAGE_ONLY_KEYS: (keyof RedditState)[] = ['createDraft'];

const EMPTY_DRAFT: CreateDraft = { selectedCommunity: null, selectedFlairs: [] };

export const useRedditStore = createDeviceAppStore<RedditState, RedditActions>(
  'reddit',
  initialState,
  { localKeys: PAGE_ONLY_KEYS },
  ({ command, optimistic }, set, get) => {
    const run = (name: string) => async (...args: unknown[]) => {
      await command(name, ...args);
    };
    return {
      // Show the new value at once: a second tap before the server answers must
      // read it (`!settings.x`, or a switch's `!value`), and keep it when earlier answers arrive.
      updateSettings: async (settingsPatch) => {
        await optimistic((s) => ({ settings: { ...s.settings, ...settingsPatch } }), 'updateSettings', settingsPatch);
      },
      votePost: run('votePost'),
      voteComment: run('voteComment'),
      toggleSave: run('toggleSave'),
      addComment: async (postId, body) => {
        await command('addComment', postId, body, nextLocalId());
      },
      addReplyComment: async (postId, parentCommentId, body) => {
        await command('addReplyComment', postId, parentCommentId, body, nextLocalId());
      },
      editComment: run('editComment'),
      deleteOwnComment: run('deleteOwnComment'),
      deleteOwnPost: run('deleteOwnPost'),
      updateOwnPost: run('updateOwnPost'),
      createPost: async (post) => {
        set({ createDraft: EMPTY_DRAFT });
        await command('createPost', post);
      },
      toggleJoin: run('toggleJoin'),
      toggleJoinCommunity: (communityId) => get().toggleJoin(communityId),
      selectCommunity: (community) => {
        set({ createDraft: { ...get().createDraft, selectedCommunity: community, selectedFlairs: [] } });
      },
      addFlair: (flair) => {
        const draft = get().createDraft;
        set({ createDraft: { ...draft, selectedFlairs: [...draft.selectedFlairs, flair] } });
      },
      resetCreateDraft: () => {
        set({ createDraft: EMPTY_DRAFT });
      },
      saveProfile: run('saveProfile'),
      seedChatThread: run('seedChatThread'),
      sendChatMessage: async (username, body) => {
        await command('sendChatMessage', username, body, nextLocalId());
      },
      deleteChatMessage: run('deleteChatMessage'),
      sendChatReply: async (username, messageId, body) => {
        const id = `reply_${Math.floor(TimeService.now() / 1000)}_${++localSeq}`;
        await command('sendChatReply', username, messageId, body, id);
      },
    };
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
