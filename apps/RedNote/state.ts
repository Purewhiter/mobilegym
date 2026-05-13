import { createAppStoreWithActions } from '../../os/createAppStore';
import { REDNOTE_CONFIG } from './data';
import { selectBaseUserById } from './data/loader';
import * as TimeService from '../../os/TimeService';
import {
  getRedNoteFollowingIds,
  resolveRedNoteRuntimeUser,
  type RedNoteRuntimeComment,
  type RedNoteRuntimeCommentTable,
  type RedNoteRuntimeNoteTable,
  type RedNoteRuntimeUserTable,
} from './utils/runtimeResolvers';

import type {
  ChatConversation,
  ChatMessage,
  Comment,
  HotSearchItem,
  Note,
  Notification,
  RedNoteTempState,
  RedNotePublishDraft,
  RedNoteSettings,
  RedNoteStorage,
  User,
} from './types';

export type {
  ChatConversation,
  ChatMessage,
  Notification,
  RedNoteTempState,
  RedNotePublishDraft,
  RedNoteSettings,
  RedNoteStorage,
};

// ── State interface ─────────────────────────────────────────────────

export interface RedNoteStoreState {
  user: User;
  notes: RedNoteRuntimeNoteTable;
  comments: RedNoteRuntimeCommentTable;
  users: RedNoteRuntimeUserTable;
  chats: ChatConversation[];
  notifications: Notification[];
  history: string[];
  searchHistory: string[];
  hotSearch: HotSearchItem[];
  guessYouLike: string[];
  settings: RedNoteSettings;
  storage: RedNoteStorage;
  _temp: RedNoteTempState;
  publishDraft: RedNotePublishDraft;
}

// ── Actions interface ───────────────────────────────────────────────

export interface RedNoteActions {
  updateHomeState: (updates: Partial<RedNoteStoreState['_temp']>) => void;
  updatePublishDraft: (updates: Partial<RedNoteStoreState['publishDraft']>) => void;
  resetPublishDraft: () => void;
  toggleLike: (noteId: string) => void;
  toggleCollect: (noteId: string) => void;
  addComment: (noteId: string, content: string, replyToCommentId?: string) => void;
  toggleCommentLike: (noteId: string, commentId: string) => void;
  followUser: (userId: string) => void;
  addNote: (note: Pick<Note, 'title' | 'content' | 'images'>) => void;
  sendMessage: (toUserId: string, content: string) => void;
  logout: () => void;
  updateUser: (updates: RedNoteUserUpdates) => void;
  markNotificationsAsRead: (type?: Notification['type']) => void;
  addToHistory: (noteId: string) => void;
  clearHistory: () => void;
  addSearchHistory: (keyword: string) => void;
  removeSearchHistory: (keyword: string) => void;
  clearSearchHistory: () => void;
  clearCache: () => void;
  updateSettings: (category: keyof RedNoteSettings, updates: Partial<RedNoteSettings[keyof RedNoteSettings]> | string | null) => void;
}

type RedNoteUserUpdates = Omit<Partial<User>, 'following' | 'followers'>;

const sanitizeUserUpdates = (updates: RedNoteUserUpdates): RedNoteUserUpdates => {
  const {
    following: _following,
    followers: _followers,
    ...safeUpdates
  } = updates as any;
  return safeUpdates;
};

// Point-lookup base user (vs. the old full-dict materialization). Returns
// `null` if the user isn't in `base.sqlite` or the DB isn't ready yet —
// callers fall back to a synthesized record (see `sendMessage`).
const baseUserById = (id: string): User | null => {
  try {
    return selectBaseUserById(id);
  } catch {
    return null;
  }
};

// ── Initial state ───────────────────────────────────────────────────

const initialState: RedNoteStoreState = {
  user: { ...REDNOTE_CONFIG.user },
  notes: { ...REDNOTE_CONFIG.notes },
  comments: { ...REDNOTE_CONFIG.comments },
  users: { ...REDNOTE_CONFIG.users },
  chats: [...REDNOTE_CONFIG.chats],
  notifications: [...REDNOTE_CONFIG.notifications],
  history: [...REDNOTE_CONFIG.history],
  searchHistory: [...REDNOTE_CONFIG.searchHistory],
  hotSearch: [...REDNOTE_CONFIG.hotSearch],
  guessYouLike: [...REDNOTE_CONFIG.guessYouLike],
  settings: { ...REDNOTE_CONFIG.settings },
  storage: { ...REDNOTE_CONFIG.storage },
  // 见 apps/RedBook/state.ts 同名注释——`_temp` 不进 defaults.json。
  _temp: { activeCategory: 'recommend', citySubTab: 'recommend' },
  publishDraft: { ...REDNOTE_CONFIG.publishDraft },
};

// ── Store ──────────────────────────────────────────────────────────

export const useRedNoteStore = createAppStoreWithActions<RedNoteStoreState, RedNoteActions>(
  'rednote',
  initialState,
  (set, get) => ({

    // ── Home nav state ─────────────────────────────────────────
    // 见 apps/RedBook/state.ts 同名 action 注释（写到 `_temp`，名字保留供 bench dispatch）。
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
      const runtimeComment: RedNoteRuntimeComment = { ...newComment, noteId };
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
      const targetUser = resolveRedNoteRuntimeUser(s.users, baseUserById(userId), s.user, userId);
      if (!targetUser) return;
      const followingIds = getRedNoteFollowingIds(s.user);
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
        const targetUser = resolveRedNoteRuntimeUser(s.users, baseUserById(toUserId), s.user, toUserId) || { name: 'User ' + toUserId, avatar: '' };
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
