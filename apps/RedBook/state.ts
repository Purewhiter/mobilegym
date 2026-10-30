import { createDeviceAppStore } from '../../os/device/deviceStore';
import { REDBOOK_CONFIG } from './data';
import type {
  RedBookRuntimeCommentTable,
  RedBookRuntimeNoteTable,
  RedBookRuntimeUserTable,
} from './utils/runtimeResolvers';

import type {
  ChatConversation,
  ChatMessage,
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
  updatePublishDraft: (updates: Partial<RedBookStoreState['publishDraft']>) => Promise<void>;
  resetPublishDraft: () => Promise<void>;
  toggleLike: (noteId: string) => Promise<void>;
  toggleCollect: (noteId: string) => Promise<void>;
  addComment: (noteId: string, content: string, replyToCommentId?: string) => Promise<void>;
  toggleCommentLike: (noteId: string, commentId: string) => Promise<void>;
  followUser: (userId: string) => Promise<void>;
  addNote: (note: Pick<Note, 'title' | 'content' | 'images'>) => Promise<void>;
  sendMessage: (toUserId: string, content: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: RedBookUserUpdates) => Promise<void>;
  markNotificationsAsRead: (type?: Notification['type']) => Promise<void>;
  addToHistory: (noteId: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  addSearchHistory: (keyword: string) => Promise<void>;
  removeSearchHistory: (keyword: string) => Promise<void>;
  clearSearchHistory: () => Promise<void>;
  clearCache: () => Promise<void>;
  updateSettings: (category: keyof RedBookSettings, updates: Partial<RedBookSettings[keyof RedBookSettings]> | string | null) => Promise<void>;
}

type RedBookUserUpdates = Omit<Partial<User>, 'following' | 'followers'>;

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
//
// Data lives in the device server session (apps/RedBook/device). This store
// mirrors the session's exported state, so `useRedBookStore(s => s.user)` and
// `__SIM__.getState().apps.redbook` read the same shape as before. Actions
// call the matching server command; the mirror updates when it returns.
// `_temp` is page-only UI state and never leaves the page.

export const useRedBookStore = createDeviceAppStore<RedBookStoreState, RedBookActions>(
  'redbook',
  initialState,
  { localKeys: ['_temp'] },
  ({ command }, set, get) => {
    const run = (name: string) => async (...args: unknown[]) => {
      await command(name, ...args);
    };
    return {
      // 名字保留 `updateHomeState` 是为了不破坏 bench live test 的 dispatch 调用。
      // `_temp` 不进 server，bench 也忽略它的 diff（`apps.*._temp` 在 base.py 白名单里）。
      updateHomeState: (updates) => {
        set({ _temp: { ...get()._temp, ...updates } });
      },
      updatePublishDraft: run('updatePublishDraft'),
      resetPublishDraft: run('resetPublishDraft'),
      toggleLike: run('toggleLike'),
      toggleCollect: run('toggleCollect'),
      addComment: run('addComment'),
      toggleCommentLike: run('toggleCommentLike'),
      followUser: run('followUser'),
      addNote: run('addNote'),
      sendMessage: run('sendMessage'),
      logout: () => {
        console.log('Logging out...');
      },
      updateUser: run('updateUser'),
      markNotificationsAsRead: run('markNotificationsAsRead'),
      addToHistory: run('addToHistory'),
      clearHistory: run('clearHistory'),
      addSearchHistory: run('addSearchHistory'),
      removeSearchHistory: run('removeSearchHistory'),
      clearSearchHistory: run('clearSearchHistory'),
      clearCache: run('clearCache'),
      updateSettings: run('updateSettings'),
    };
  },
);
