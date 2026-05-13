import { createAppStoreWithActions } from '../../os/createAppStore';
import { REDBOOK_CONFIG } from './data';
import { getBaseDataset } from './data/loader';
import * as TimeService from '../../os/TimeService';
import {
  getRedBookFollowingIds,
  resolveRedBookRuntimeUser,
  type RedBookRuntimeComment,
  type RedBookRuntimeCommentTable,
  type RedBookRuntimeNoteTable,
  type RedBookRuntimeUserTable,
} from './utils/runtimeResolvers';

import type {
  ChatConversation,
  ChatMessage,
  Comment,
  HotSearchItem,
  Note,
  Notification,
  RedBookTempState,
  RedBookPublishDraft,
  RedBookSettings,
  RedBookStorage,
  User,
} from './types';

export type {
  ChatConversation,
  ChatMessage,
  Notification,
  RedBookTempState,
  RedBookPublishDraft,
  RedBookSettings,
  RedBookStorage,
};

// ── State interface ─────────────────────────────────────────────────

export interface RedBookStoreState {
  user: User;
  notes: RedBookRuntimeNoteTable;
  comments: RedBookRuntimeCommentTable;
  users: RedBookRuntimeUserTable;
  chats: ChatConversation[];
  notifications: Notification[];
  history: string[];
  searchHistory: string[];
  hotSearch: HotSearchItem[];
  guessYouLike: string[];
  settings: RedBookSettings;
  storage: RedBookStorage;
  _temp: RedBookTempState;
  publishDraft: RedBookPublishDraft;
}

// ── Actions interface ───────────────────────────────────────────────

export interface RedBookActions {
  updateHomeState: (updates: Partial<RedBookStoreState['_temp']>) => void;
  updatePublishDraft: (updates: Partial<RedBookStoreState['publishDraft']>) => void;
  resetPublishDraft: () => void;
  toggleLike: (noteId: string) => void;
  toggleCollect: (noteId: string) => void;
  addComment: (noteId: string, content: string, replyToCommentId?: string) => void;
  toggleCommentLike: (noteId: string, commentId: string) => void;
  followUser: (userId: string) => void;
  addNote: (note: Pick<Note, 'title' | 'content' | 'images'>) => void;
  sendMessage: (toUserId: string, content: string) => void;
  logout: () => void;
  updateUser: (updates: RedBookUserUpdates) => void;
  markNotificationsAsRead: (type?: Notification['type']) => void;
  addToHistory: (noteId: string) => void;
  clearHistory: () => void;
  addSearchHistory: (keyword: string) => void;
  removeSearchHistory: (keyword: string) => void;
  clearSearchHistory: () => void;
  clearCache: () => void;
  updateSettings: (category: keyof RedBookSettings, updates: Partial<RedBookSettings[keyof RedBookSettings]> | string | null) => void;
}

type RedBookUserUpdates = Omit<Partial<User>, 'following' | 'followers'>;

const sanitizeUserUpdates = (updates: RedBookUserUpdates): RedBookUserUpdates => {
  const {
    following: _following,
    followers: _followers,
    ...safeUpdates
  } = updates as any;
  return safeUpdates;
};

const baseUsersById = (): Record<string, User> => getBaseDataset()?.usersById ?? {};

// ── Initial state ───────────────────────────────────────────────────

const initialState: RedBookStoreState = {
  user: { ...REDBOOK_CONFIG.user },
  notes: { ...REDBOOK_CONFIG.notes },
  comments: { ...REDBOOK_CONFIG.comments },
  users: { ...REDBOOK_CONFIG.users },
  chats: [...REDBOOK_CONFIG.chats],
  notifications: [...REDBOOK_CONFIG.notifications],
  history: [...REDBOOK_CONFIG.history],
  searchHistory: [...REDBOOK_CONFIG.searchHistory],
  hotSearch: [...REDBOOK_CONFIG.hotSearch],
  guessYouLike: [...REDBOOK_CONFIG.guessYouLike],
  settings: { ...REDBOOK_CONFIG.settings },
  storage: { ...REDBOOK_CONFIG.storage },
  // `_temp` 直接在 TS 里初始化，不进 defaults.json——
  // 它是 ephemeral 运行时导航状态，不属于"可替换 base data"。
  _temp: { activeCategory: 'recommend', citySubTab: 'recommend' },
  publishDraft: { ...REDBOOK_CONFIG.publishDraft },
};

// ── Store ──────────────────────────────────────────────────────────

export const useRedBookStore = createAppStoreWithActions<RedBookStoreState, RedBookActions>(
  'redbook',
  initialState,
  (set, get) => ({

    // ── Home nav state ─────────────────────────────────────────
    // 名字保留 `updateHomeState` 是为了不破坏 bench live test 的 dispatch 调用
    // （test_redbook_live.py 按 action 名调）。内部写到 `_temp` 而非历史的 `homeState`：
    //   - 不持久化（默认 partialize 排除 `_temp`）
    //   - bench 自动忽略 diff（`apps.*._temp` 在 base.py 白名单里）
    updateHomeState: (updates) => {
      set({ _temp: { ...get()._temp, ...updates } });
    },

    // ── Publish draft ──────────────────────────────────────────
    updatePublishDraft: (updates) => {
      set({ publishDraft: { ...get().publishDraft, ...updates } });
    },
    resetPublishDraft: () => {
      set({ publishDraft: { text: '', templateId: 'basic', title: '', images: [] } });
    },

    // ── Like / Collect ─────────────────────────────────────────
    toggleLike: (noteId) => {
      const s = get();
      const likedNotes = s.user.likedNotes || [];
      const wasLiked = likedNotes.includes(noteId);
      const nextLikedNotes = wasLiked ? likedNotes.filter(id => id !== noteId) : [...likedNotes, noteId];
      set({
        user: { ...s.user, likedNotes: nextLikedNotes },
      });
    },

    toggleCollect: (noteId) => {
      const s = get();
      const collectedNotes = s.user.collectedNotes || [];
      const wasCollected = collectedNotes.includes(noteId);
      const nextCollectedNotes = wasCollected ? collectedNotes.filter(id => id !== noteId) : [...collectedNotes, noteId];
      set({
        user: { ...s.user, collectedNotes: nextCollectedNotes },
      });
    },

    // ── Comments ───────────────────────────────────────────────
    addComment: (noteId, content, replyToCommentId) => {
      const s = get();
      const nowTs = TimeService.now();
      const newComment: Comment = {
        id: `c_${nowTs}`,
        userId: s.user.id,
        username: s.user.name,
        avatar: s.user.avatar,
        content,
        time: nowTs,
        likes: 0,
        replyToId: replyToCommentId,
        location: s.user.location || '上海',
      };
      const runtimeComment: RedBookRuntimeComment = { ...newComment, noteId };
      const nextUserCommentIds = [...(s.user.commentIds || []), newComment.id];
      set({
        user: { ...s.user, commentIds: nextUserCommentIds },
        comments: { ...s.comments, [newComment.id]: runtimeComment },
      });
    },

    toggleCommentLike: (noteId, commentId) => {
      const s = get();
      const likedByNote = s.user.likedCommentsByNote || {};
      const current = likedByNote[noteId] || [];
      const wasLiked = current.includes(commentId);
      const nextForNote = wasLiked ? current.filter(id => id !== commentId) : [...current, commentId];
      const nextLikedByNote = { ...likedByNote, [noteId]: nextForNote };
      set({
        user: { ...s.user, likedCommentsByNote: nextLikedByNote },
      });
    },

    // ── Follow ─────────────────────────────────────────────────
    followUser: (userId) => {
      const s = get();
      const targetUser = resolveRedBookRuntimeUser(s.users, baseUsersById(), s.user, userId);
      if (!targetUser) return;
      const followingIds = getRedBookFollowingIds(s.user);
      const isFollowing = followingIds.includes(userId);
      const nextFollowingIds = isFollowing ? followingIds.filter(id => id !== userId) : [...followingIds, userId];
      set({
        user: {
          ...s.user,
          followingIds: nextFollowingIds,
        },
      });
    },

    // ── Add note ───────────────────────────────────────────────
    addNote: (noteData) => {
      const s = get();
      const nowTs = TimeService.now();
      const newNote: Note = {
        id: `note_${nowTs}`,
        ...noteData,
        authorId: s.user.id,
        likes: 0,
        collections: 0,
        comments: 0,
        commentList: [],
        createdAt: nowTs,
      };
      set({
        user: {
          ...s.user,
          publishedNoteIds: [newNote.id, ...(s.user.publishedNoteIds || [])],
        },
        notes: { ...s.notes, [newNote.id]: newNote },
      });
    },

    // ── Chat ───────────────────────────────────────────────────
    sendMessage: (toUserId, content) => {
      const s = get();
      const chats = [...s.chats];
      const chatIndex = chats.findIndex(c => c.userId === toUserId);
      const nowTs = TimeService.now();
      const newMessage: ChatMessage = {
        id: `msg_${nowTs}`,
        senderId: s.user.id,
        content,
        timestamp: nowTs,
        type: 'text',
      };
      if (chatIndex === -1) {
        const targetUser = resolveRedBookRuntimeUser(s.users, baseUsersById(), s.user, toUserId) || { name: 'User ' + toUserId, avatar: '' };
        chats.unshift({
          userId: toUserId,
          username: targetUser.name,
          avatar: targetUser.avatar,
          unreadCount: 0,
          lastMessage: content,
          lastTime: nowTs,
          messages: [newMessage],
        });
      } else {
        const chat = { ...chats[chatIndex] };
        chat.messages = [...chat.messages, newMessage];
        chat.lastMessage = content;
        chat.lastTime = nowTs;
        chats.splice(chatIndex, 1);
        chats.unshift(chat);
      }
      set({ chats });
    },

    // ── Auth ───────────────────────────────────────────────────
    logout: () => {
      console.log('Logging out...');
    },

    // ── User ───────────────────────────────────────────────────
    updateUser: (updates) => {
      set({ user: { ...get().user, ...sanitizeUserUpdates(updates) } });
    },

    // ── Notifications ──────────────────────────────────────────
    markNotificationsAsRead: (type?) => {
      const s = get();
      set({
        notifications: s.notifications.map(n => {
          if (!type || n.type === type || (type === 'like_note' && (n.type === 'collect_note' || n.type === 'like_comment'))) {
            return { ...n, isRead: true };
          }
          return n;
        }),
      });
    },

    // ── History ────────────────────────────────────────────────
    addToHistory: (noteId) => {
      const s = get();
      set({ history: [noteId, ...s.history.filter(id => id !== noteId)] });
    },
    clearHistory: () => {
      set({ history: [] });
    },
    addSearchHistory: (keyword) => {
      const trimmed = keyword.trim();
      if (!trimmed) return;
      const current = get().searchHistory || [];
      set({ searchHistory: [trimmed, ...current.filter(item => item !== trimmed)] });
    },
    removeSearchHistory: (keyword) => {
      set({ searchHistory: (get().searchHistory || []).filter(item => item !== keyword) });
    },
    clearSearchHistory: () => {
      set({ searchHistory: [] });
    },
    clearCache: () => {
      set({ storage: { cacheSizeBytes: 0 } });
    },

    // ── Settings ───────────────────────────────────────────────
    updateSettings: (category, updates) => {
      const s = get();
      if (category === 'language' && (typeof updates === 'string' || updates === null)) {
        set({ settings: { ...s.settings, language: updates } });
        return;
      }
      if (typeof updates === 'object' && !Array.isArray(updates) && category !== 'language') {
        set({
          settings: {
            ...s.settings,
            [category]: {
              ...(s.settings[category] as object),
              ...updates,
            },
          },
        });
      }
    },
  }),
);
