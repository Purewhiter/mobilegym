import { createAppStoreWithActions, registerStateAdapter, memoSelector } from '../../os/createAppStore';
import { WECHAT_READING_CONFIG } from './data';
import type {
  ShelfItem,
  ReadingRecord,
  BookProgress,
  Settings,
  ReaderPrefs,
  PrivacySettings,
  PrivacyProfileSettings,
  NotificationSettings,
  Book,
  LikedListBookEntry,
} from './data/types';
import * as TimeService from '../../os/TimeService';
import { sanitizeReaderPrefs } from './constants';

// --- Static lookup ---
const STORE_BY_ID = new Map((WECHAT_READING_CONFIG.store ?? []).map((b: any) => [String(b.id), b]));
const USERS_BY_ID = new Map((WECHAT_READING_CONFIG.users ?? []).map((u: any) => [String(u.id), u]));

export const getWechatReadingBookById = (bookId: string): Book | undefined =>
  STORE_BY_ID.get(String(bookId));

export const getWechatReadingUserById = (
  currentUser: typeof WECHAT_READING_CONFIG.user,
  userId: string,
): any => {
  const id = String(userId || '');
  if (!id) return undefined;
  if (id === currentUser.id || id === 'user_me') return currentUser;
  return USERS_BY_ID.get(id);
};

let localSeq = 0;

function hasSameReaderPrefs(a: ReaderPrefs, b: ReaderPrefs) {
  return a.fontSize === b.fontSize
    && a.themeColor === b.themeColor
    && a.themeBg === b.themeBg
    && a.margin === b.margin
    && a.lineHeight === b.lineHeight;
}

// --- Helpers ---
function getTotalWords(bookId: string) {
  const book = STORE_BY_ID.get(String(bookId));
  return typeof book?.totalWords === 'number' ? book.totalWords : null;
}

function isFinishedByProgress(bookId: string, bookProgress: Record<string, BookProgress>) {
  const totalWords = getTotalWords(bookId);
  const progress = bookProgress[String(bookId)];
  if (!progress || totalWords === null) return false;
  return Number(progress.charOffset) >= Number(totalWords);
}

// --- State shape ---
interface WechatReadingState {
  // Persisted data
  user: typeof WECHAT_READING_CONFIG.user;
  shelf: ShelfItem[];
  store: typeof WECHAT_READING_CONFIG.store;
  bookProgress: Record<string, BookProgress>;
  readingRecords: ReadingRecord[];
  settings: Settings;
  readerPrefs: ReaderPrefs;
  recommendedAudiobooks: string[];
  likedListBooks: LikedListBookEntry[];
  likedListSyncToHome: boolean;

  _temp: {
    audioSubTab: 'audio' | 'community';
  };
}

// --- Actions ---
interface WechatReadingActions {
  updateUserProfile: (updates: Partial<typeof WECHAT_READING_CONFIG.user>) => void;
  updateSettings: (updates: Partial<Omit<Settings, 'privacy' | 'notifications'>>) => void;
  updatePrivacy: (updates: Partial<Omit<PrivacySettings, 'profile'>>) => void;
  updateProfilePrivacy: (updates: Partial<PrivacyProfileSettings>) => void;
  updateNotifications: (updates: Partial<NotificationSettings>) => void;
  updateReaderPrefs: (updates: Partial<ReaderPrefs>) => void;
  addToBookshelf: (bookId: string) => void;
  removeFromShelf: (bookId: string) => void;
  togglePrivate: (bookIds: string[], isPrivate: boolean) => void;
  updateProgress: (bookId: string, charOffset: number) => void;
  addReadingRecord: (bookId: string, duration: number) => void;
  refreshRecommendedAudiobooks: () => void;
  toggleFollow: (userId: string) => void;
  setAudioSubTab: (tab: 'audio' | 'community') => void;
  addBooksToLikedList: (bookIds: string[]) => void;
  removeBookFromLikedList: (bookId: string) => void;
  updateLikedListRecommendation: (bookId: string, recommendation: string) => void;
  toggleLikedListSyncToHome: () => void;
}

// --- Initial state ---
const initialState: WechatReadingState = {
  user: WECHAT_READING_CONFIG.user,
  shelf: WECHAT_READING_CONFIG.shelf as ShelfItem[],
  store: WECHAT_READING_CONFIG.store,
  bookProgress: WECHAT_READING_CONFIG.bookProgress as Record<string, BookProgress>,
  readingRecords: WECHAT_READING_CONFIG.readingRecords as ReadingRecord[],
  settings: WECHAT_READING_CONFIG.settings as Settings,
  readerPrefs: sanitizeReaderPrefs((WECHAT_READING_CONFIG as any).readerPrefs),
  recommendedAudiobooks: WECHAT_READING_CONFIG.recommendedAudiobooks as string[],
  likedListBooks: [],
  likedListSyncToHome: false,
  _temp: { audioSubTab: 'audio' },
};

// --- Store ---
const wechatReadingStore = createAppStoreWithActions<WechatReadingState, WechatReadingActions>(
  'wechat_reading',
  initialState,
  (set, get) => ({
    updateUserProfile: (updates) => {
      const { user } = get();
      set({ user: { ...user, ...updates } });
    },

    updateSettings: (updates) => {
      const { settings } = get();
      set({ settings: { ...settings, ...updates } });
    },

    updatePrivacy: (updates) => {
      const { settings } = get();
      set({ settings: { ...settings, privacy: { ...settings.privacy, ...updates } } });
    },

    updateProfilePrivacy: (updates) => {
      const { settings } = get();
      set({ settings: { ...settings, privacy: { ...settings.privacy, profile: { ...settings.privacy.profile, ...updates } } } });
    },

    updateNotifications: (updates) => {
      const { settings } = get();
      set({ settings: { ...settings, notifications: { ...settings.notifications, ...updates } } });
    },

    updateReaderPrefs: (updates) => {
      const { readerPrefs } = get();
      set({ readerPrefs: sanitizeReaderPrefs({ ...readerPrefs, ...updates }) });
    },

    addToBookshelf: (bookId) => {
      const { shelf, bookProgress } = get();
      if (shelf.some(item => item.bookId === bookId)) return;

      const newItem: ShelfItem = {
        bookId,
        isPrivate: false,
        addedAt: TimeService.getISOString(),
      };

      const newProgress = { ...bookProgress };
      if (!newProgress[bookId]) {
        newProgress[bookId] = {
          bookId,
          charOffset: 0,
          lastReadAt: TimeService.getISOString(),
        };
      }

      set({ shelf: [newItem, ...shelf], bookProgress: newProgress });
    },

    removeFromShelf: (bookId) => {
      const { shelf } = get();
      set({ shelf: shelf.filter(item => item.bookId !== bookId) });
    },

    togglePrivate: (bookIds, isPrivate) => {
      const { shelf } = get();
      set({
        shelf: shelf.map(item =>
          bookIds.includes(item.bookId) ? { ...item, isPrivate } : item,
        ),
      });
    },

    updateProgress: (bookId, charOffset) => {
      const { bookProgress } = get();
      set({
        bookProgress: {
          ...bookProgress,
          [bookId]: {
            bookId,
            charOffset,
            lastReadAt: TimeService.getISOString(),
          },
        },
      });
    },

    addReadingRecord: (bookId, duration) => {
      if (duration <= 0) return;
      const today = TimeService.getToday();
      const newRecord: ReadingRecord = {
        id: `record_${TimeService.now()}_${bookId}_${++localSeq}`,
        bookId,
        date: today,
        duration,
        timestamp: TimeService.getISOString(),
      };
      const { readingRecords } = get();
      set({ readingRecords: [...readingRecords, newRecord] });
    },

    refreshRecommendedAudiobooks: () => {
      const all = WECHAT_READING_CONFIG.audiobooks;
      const shuffled = [...all].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 6).map(b => b.id);
      set({ recommendedAudiobooks: selected });
    },

    toggleFollow: (userId) => {
      const { user } = get();
      const isFollowing = user.following.includes(userId);
      const newFollowing = isFollowing
        ? user.following.filter((id: string) => id !== userId)
        : [...user.following, userId];
      set({ user: { ...user, following: newFollowing } });
    },

    setAudioSubTab: (tab) => set((s) => ({ _temp: { ...s._temp, audioSubTab: tab } })),

    addBooksToLikedList: (bookIds) => {
      const { likedListBooks } = get();
      const existing = new Set(likedListBooks.map(e => e.bookId));
      const toAdd = bookIds.filter(id => !existing.has(id));
      if (toAdd.length === 0) return;
      set({
        likedListBooks: [
          ...likedListBooks,
          ...toAdd.map((bookId): LikedListBookEntry => ({ bookId })),
        ],
      });
    },

    removeBookFromLikedList: (bookId) => {
      const { likedListBooks } = get();
      set({ likedListBooks: likedListBooks.filter(e => e.bookId !== bookId) });
    },

    updateLikedListRecommendation: (bookId, recommendation) => {
      const { likedListBooks } = get();
      set({
        likedListBooks: likedListBooks.map(e =>
          e.bookId === bookId ? { ...e, recommendation } : e,
        ),
      });
    },

    toggleLikedListSyncToHome: () => {
      const { likedListSyncToHome } = get();
      set({ likedListSyncToHome: !likedListSyncToHome });
    },
  }),
  {
    partialize: (state) => {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(state)) {
        // Exclude functions and ephemeral state
        if (typeof v === 'function') continue;
        if (k === '_temp') continue;
        result[k] = v;
      }
      return result as Partial<WechatReadingState>;
    },
    afterHydration: () => {
      queueMicrotask(() => {
        const { readerPrefs } = wechatReadingStore.getState();
        const sanitized = sanitizeReaderPrefs(readerPrefs);
        if (hasSameReaderPrefs(readerPrefs, sanitized)) return;
        wechatReadingStore.setState({ readerPrefs: sanitized });
      });
    },
  },
);

export const useWechatReadingStore = wechatReadingStore;

// --- Memoized selectors for derived arrays ---
export const selectAllProgressBookIds = memoSelector(
  (s: WechatReadingState & WechatReadingActions) => s.bookProgress,
  (bookProgress) => Object.keys(bookProgress).map(String),
);

export const selectReadingBookIds = memoSelector(
  (s: WechatReadingState & WechatReadingActions) => s.bookProgress,
  (bookProgress) => Object.keys(bookProgress).filter(id => !isFinishedByProgress(id, bookProgress)),
);

export const selectFinishedBookIds = memoSelector(
  (s: WechatReadingState & WechatReadingActions) => s.bookProgress,
  (bookProgress) => Object.keys(bookProgress).filter(id => isFinishedByProgress(id, bookProgress)),
);

/**
 * homeFinishedBookIds depends on both bookProgress and shelf,
 * so we use a compound input tuple. memoSelector uses Object.is on the input,
 * so we need a two-level approach: extract a stable key, then compute.
 */
export const selectHomeFinishedBookIds = memoSelector(
  (s: WechatReadingState & WechatReadingActions) => ({ bookProgress: s.bookProgress, shelf: s.shelf }),
  ({ bookProgress, shelf }) => {
    const shelfByBookId = new Map(shelf.map(i => [String(i.bookId), i]));
    return Object.keys(bookProgress)
      .filter(id => isFinishedByProgress(id, bookProgress))
      .filter(bookId => {
        const item = shelfByBookId.get(String(bookId));
        return !(item && item.isPrivate === true);
      });
  },
);

// --- State adapter for external access (bench_env) ---
registerStateAdapter('wechat_reading', (state) => {
  const bookProgress: Record<string, any> = state.bookProgress ?? {};
  const shelf: ShelfItem[] = state.shelf ?? [];
  const storeCatalog: any[] = state.store ?? WECHAT_READING_CONFIG.store ?? [];

  const storeById = new Map(storeCatalog.map((b: any) => [String(b.id), b]));
  const allProgressBookIds = Object.keys(bookProgress);

  const isFinished = (id: string) => {
    const book = storeById.get(String(id));
    const total = typeof book?.totalWords === 'number' ? book.totalWords : null;
    const p = bookProgress[String(id)];
    if (!p || total === null) return false;
    return Number(p.charOffset) >= Number(total);
  };

  const readingBookIds = allProgressBookIds.filter(id => !isFinished(id));
  const finishedBookIds = allProgressBookIds.filter(id => isFinished(id));
  const shelfByBookId = new Map(shelf.map((i: any) => [String(i.bookId), i]));
  const homeFinishedBookIds = finishedBookIds.filter(bookId => {
    const item = shelfByBookId.get(String(bookId));
    return !(item && (item as any).isPrivate === true);
  });

  return {
    ...state,
    allProgressBookIds,
    readingBookIds,
    finishedBookIds,
    homeFinishedBookIds,
    hotSearch: WECHAT_READING_CONFIG.hotSearch,
    audiobooks: WECHAT_READING_CONFIG.audiobooks,
    users: WECHAT_READING_CONFIG.users,
  };
});
