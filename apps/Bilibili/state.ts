import { memoSelector } from '../../os/createAppStore';
import { createDeviceAppStore } from '../../os/device/deviceStore';
import { BILIBILI_CONFIG } from './data';
import type { BilibiliUser, BilibiliSettings } from './types';

// ---- Types ----

type BilibiliConfig = typeof BILIBILI_CONFIG;

interface BilibiliState extends Omit<BilibiliConfig, 'user' | 'settings'> {
  user: BilibiliUser;
  activeVideoId: string | null;
  settings: BilibiliSettings;
}

interface InteractionResult {
  success: boolean;
  msg: string;
}

interface BilibiliActions {
  // User
  updateUser: (updates: Partial<BilibiliUser>) => Promise<void>;

  // Settings (persisted with user)
  setSetting: (key: string, value: string | boolean) => Promise<void>;

  // Active video
  setActiveVideoId: (id: string | null) => void;

  // Follow
  toggleFollow: (id: string | number) => Promise<void>;

  // Video interactions
  toggleLike: (vid: string) => Promise<void>;
  toggleDislike: (vid: string) => Promise<void>;
  addCoin: (vid: string, count: number, alsoLike: boolean) => Promise<InteractionResult>;
  toggleFav: (vid: string) => Promise<void>;
  /** 批量设置视频在哪些收藏夹中（selectedIds 为选中的收藏夹 id 集合） */
  setFavFolders: (vid: string, selectedIds: string[]) => Promise<void>;
  /** 新建收藏夹，返回新建的 folder id */
  createFavFolder: (title: string, description?: string, isPublic?: boolean) => Promise<string>;
  tripleAction: (vid: string) => Promise<InteractionResult>;

  // Anime/Drama subscription
  toggleAnime: (id: string, title?: string) => Promise<void>;
  toggleDrama: (id: string, title?: string) => Promise<void>;

  // Search history
  addSearchHistory: (keyword: string) => Promise<void>;
  clearSearchHistory: () => Promise<void>;
}

// ---- Initial state ----

const initialState: BilibiliState = {
  ...BILIBILI_CONFIG,
  activeVideoId: null,
  settings: BILIBILI_CONFIG.settings,
};

// ---- Store ----
//
// `user` and `settings` live in the device server session
// (apps/Bilibili/device); this store mirrors them, so components and
// `__SIM__.getState().apps.bilibili` read the same shape as before. Actions
// run the matching server command. The structural config keys and
// `activeVideoId` are page-only and never leave the page.

const PAGE_ONLY_KEYS: (keyof BilibiliState)[] = [
  ...(Object.keys(BILIBILI_CONFIG).filter((k) => k !== 'user' && k !== 'settings') as (keyof BilibiliState)[]),
  'activeVideoId',
];

export const useBilibiliStore = createDeviceAppStore<BilibiliState, BilibiliActions>(
  'bilibili',
  initialState,
  { localKeys: PAGE_ONLY_KEYS },
  ({ command }, set) => {
    const run = (name: string) => async (...args: unknown[]) => {
      await command(name, ...args);
    };
    return {
      // `{ school: undefined }` clears a field; JSON drops undefined, so name those keys explicitly.
      updateUser: async (updates) => {
        const unset = Object.keys(updates).filter((k) => updates[k as keyof BilibiliUser] === undefined);
        await command('updateUser', updates, unset);
      },
      setSetting: run('setSetting'),
      setActiveVideoId: (id) => {
        set({ activeVideoId: id });
      },
      toggleFollow: run('toggleFollow'),
      toggleLike: run('toggleLike'),
      toggleDislike: run('toggleDislike'),
      // A reset can abandon a command (resolves undefined): report it as not done.
      addCoin: async (...args) =>
        ((await command('addCoin', ...args)) as InteractionResult | undefined) ?? { success: false, msg: '' },
      toggleFav: run('toggleFav'),
      setFavFolders: run('setFavFolders'),
      createFavFolder: async (...args) => ((await command('createFavFolder', ...args)) as string | undefined) ?? '',
      tripleAction: async (vid) =>
        ((await command('tripleAction', vid)) as InteractionResult | undefined) ?? { success: false, msg: '' },
      toggleAnime: run('toggleAnime'),
      toggleDrama: run('toggleDrama'),
      addSearchHistory: run('addSearchHistory'),
      clearSearchHistory: run('clearSearchHistory'),
    };
  },
);

// ---- Memoized Selectors ----

type BilibiliStore = BilibiliState & BilibiliActions;

export const selectUser = (s: BilibiliStore) => s.user;

export const selectSearchHistory = memoSelector(
  (s: BilibiliStore) => s.user.searchHistory,
  (history) => history || [],
);
