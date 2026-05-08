import { createAppStoreWithActions, memoSelector } from '../../os/createAppStore';
import { BILIBILI_CONFIG } from './data';
import type { BilibiliUser, BilibiliSettings } from './types';
import { now as simNow } from '../../os/TimeService';

// ---- Helpers ----

function deepSet<T extends Record<string, unknown>>(
  obj: T,
  path: string,
  value: string | boolean,
): T {
  const keys = path.split('.');
  if (keys.length === 1) return { ...obj, [keys[0]!]: value } as T;
  const [head, ...rest] = keys;
  const next =
    obj[head!] != null &&
    typeof obj[head!] === 'object' &&
    !Array.isArray(obj[head!])
      ? (obj[head!] as Record<string, unknown>)
      : {};
  return {
    ...obj,
    [head!]: deepSet(next, rest.join('.'), value),
  } as T;
}

// ---- Types ----

interface BilibiliState {
  user: BilibiliUser;
  activeVideoId: string | null;
  settings: BilibiliSettings;
}

interface BilibiliActions {
  // User
  updateUser: (updates: Partial<BilibiliUser>) => void;

  // Settings (persisted with user)
  setSetting: (key: string, value: string | boolean) => void;

  // Active video
  setActiveVideoId: (id: string | null) => void;

  // Follow
  toggleFollow: (id: string | number) => void;

  // Video interactions
  toggleLike: (vid: string) => void;
  toggleDislike: (vid: string) => void;
  addCoin: (vid: string, count: number, alsoLike: boolean) => { success: boolean; msg: string };
  toggleFav: (vid: string) => void;
  /** 批量设置视频在哪些收藏夹中（selectedIds 为选中的收藏夹 id 集合） */
  setFavFolders: (vid: string, selectedIds: string[]) => void;
  /** 新建收藏夹，返回新建的 folder id */
  createFavFolder: (title: string, description?: string, isPublic?: boolean) => string;
  tripleAction: (vid: string) => { success: boolean; msg: string };

  // Anime/Drama subscription
  toggleAnime: (id: string, title?: string) => void;
  toggleDrama: (id: string, title?: string) => void;

  // Search history
  addSearchHistory: (keyword: string) => void;
  clearSearchHistory: () => void;
}

// ---- Initial state ----

const initialState: BilibiliState = {
  ...BILIBILI_CONFIG,
  activeVideoId: null,
  settings: BILIBILI_CONFIG.settings,
};

// ---- Store ----

export const useBilibiliStore = createAppStoreWithActions<BilibiliState, BilibiliActions>(
  'bilibili',
  initialState,
  (set, get) => ({
    // ---- User ----
    updateUser: (updates) => {
      set((state) => ({
        user: { ...state.user, ...updates },
      }));
    },

    // ---- Active video ----
    setActiveVideoId: (id) => {
      set({ activeVideoId: id });
    },

    // ---- Settings ----
    setSetting: (path, value) => {
      set((state) => ({
        settings: deepSet(
          state.settings as unknown as Record<string, unknown>,
          path,
          value,
        ) as unknown as BilibiliSettings,
      }));
    },

    // ---- Follow ----
    toggleFollow: (id) => {
      const mid = String(id);
      set((state) => {
        const currentList = state.user.followingList || [];
        const isFollowing = currentList.some((u) => String(u.mid) === mid);

        let newList;

        if (isFollowing) {
          newList = currentList.filter((u) => String(u.mid) !== mid);
        } else {
          const newEntry = {
            mid,
            name: `用户${mid}`,
            face: '',
            sign: '',
          };
          newList = [...currentList, newEntry];
        }

        return {
          user: {
            ...state.user,
            followingList: newList,
            following: newList.length,
          },
        };
      });
    },


    // ---- Interactions ----

    toggleLike: (vid) => {
      set((state) => {
        const liked = (state.user.likedVideoIds || []).includes(vid);
        const disliked = (state.user.dislikedVideoIds || []).includes(vid);

        let newLiked = [...(state.user.likedVideoIds || [])];
        let newDisliked = [...(state.user.dislikedVideoIds || [])];

        if (liked) {
          newLiked = newLiked.filter((id) => id !== vid);
        } else {
          newLiked.push(vid);
          if (disliked) newDisliked = newDisliked.filter((id) => id !== vid);
        }

        return {
          user: { ...state.user, likedVideoIds: newLiked, dislikedVideoIds: newDisliked },
        };
      });
    },

    toggleDislike: (vid) => {
      set((state) => {
        const liked = (state.user.likedVideoIds || []).includes(vid);
        const disliked = (state.user.dislikedVideoIds || []).includes(vid);

        let newLiked = [...(state.user.likedVideoIds || [])];
        let newDisliked = [...(state.user.dislikedVideoIds || [])];

        if (disliked) {
          newDisliked = newDisliked.filter((id) => id !== vid);
        } else {
          newDisliked.push(vid);
          if (liked) newLiked = newLiked.filter((id) => id !== vid);
        }

        return {
          user: { ...state.user, likedVideoIds: newLiked, dislikedVideoIds: newDisliked },
        };
      });
    },

    addCoin: (vid, count, alsoLike) => {
      const state = get();
      const existing = (state.user.coinedVideoCoins || {})[vid] || 0;

      if (existing + count > 2) {
        return { success: false, msg: '投硬币失败~超过投币上限啦~' };
      }
      if (state.user.coins < count) {
        return { success: false, msg: '硬币不足' };
      }

      set((s) => {
        const coinedVideoCoins = { ...(s.user.coinedVideoCoins || {}), [vid]: existing + count };
        const alreadyLiked = (s.user.likedVideoIds || []).includes(vid);
        return {
          user: {
            ...s.user,
            coins: s.user.coins - count,
            coinedVideoCoins,
            ...(alsoLike && !alreadyLiked ? {
              likedVideoIds: [...(s.user.likedVideoIds || []), vid],
              dislikedVideoIds: (s.user.dislikedVideoIds || []).filter(id => id !== vid),
            } : {}),
          },
        };
      });
      return { success: true, msg: '' };
    },

    toggleFav: (vid) => {
      set((state) => {
        const folders = state.user.favoritesFolders || [];
        const isFavored = folders.some(f => (f.videoIds || []).includes(vid));
        const updatedFolders = isFavored
          ? folders.map(f => ({
              ...f,
              videoIds: (f.videoIds || []).filter(id => id !== vid),
            }))
          : folders.map(f =>
              f.id === 'fav_default'
                ? { ...f, videoIds: [...(f.videoIds || []), vid] }
                : f,
            );

        return {
          user: { ...state.user, favoritesFolders: updatedFolders },
        };
      });
    },

    setFavFolders: (vid, selectedIds) => {
      set((state) => {
        const updatedFolders = (state.user.favoritesFolders || []).map((folder) => {
          const shouldContain = selectedIds.includes(folder.id);
          const currentIds = folder.videoIds || [];
          const alreadyIn = currentIds.includes(vid);
          if (shouldContain && !alreadyIn) {
            return { ...folder, videoIds: [...currentIds, vid] };
          }
          if (!shouldContain && alreadyIn) {
            return { ...folder, videoIds: currentIds.filter((id) => id !== vid) };
          }
          return folder;
        });
        return { user: { ...state.user, favoritesFolders: updatedFolders } };
      });
    },

    createFavFolder: (title, description, isPublic = true) => {
      const id = `fav_${simNow().toString(36)}`;
      set((state) => ({
        user: {
          ...state.user,
          favoritesFolders: [
            { id, title, isPublic, videoIds: [], ...(description ? { description } : {}) },
            ...(state.user.favoritesFolders || []),
          ],
        },
      }));
      return id;
    },

    tripleAction: (vid) => {
      let msg = '';
      const state = get();
      const liked = (state.user.likedVideoIds || []).includes(vid);
      const coinCount = (state.user.coinedVideoCoins || {})[vid] || 0;
      const isFavored = (state.user.favoritesFolders || []).some(
        (f) => (f.videoIds || []).includes(vid),
      );

      set((s) => {
        let newLiked = [...(s.user.likedVideoIds || [])];
        const newCoinedVideoCoins = { ...(s.user.coinedVideoCoins || {}) };
        let newCoins = s.user.coins;
        let newDisliked = (s.user.dislikedVideoIds || []).filter((id) => id !== vid);

        if (!liked) {
          newLiked.push(vid);
        }
        if (coinCount < 2) {
          if (s.user.coins >= 1) {
            newCoinedVideoCoins[vid] = coinCount + 1;
            newCoins -= 1;
          } else {
            msg = '硬币不足，仅点赞收藏';
          }
        }

        const updatedFolders = !isFavored
          ? (s.user.favoritesFolders || []).map((folder) => {
              if (folder.id === 'fav_default') {
                return { ...folder, videoIds: [...(folder.videoIds || []), vid] };
              }
              return folder;
            })
          : s.user.favoritesFolders;

        return {
          user: {
            ...s.user,
            likedVideoIds: newLiked,
            dislikedVideoIds: newDisliked,
            coinedVideoCoins: newCoinedVideoCoins,
            coins: newCoins,
            favoritesFolders: updatedFolders,
          },
        };
      });

      return { success: true, msg: msg || '三连成功' };
    },

    // ---- Anime/Drama ----
    toggleAnime: (id, title) => {
      set((state) => {
        const subscribed = (state.user.subscribedAnime || []).some((a) => a.id === id);
        return {
          user: {
            ...state.user,
            subscribedAnime: subscribed
              ? (state.user.subscribedAnime || []).filter((a) => a.id !== id)
              : [...(state.user.subscribedAnime || []), { id, title }],
          },
        };
      });
    },

    toggleDrama: (id, title) => {
      set((state) => {
        const subscribed = (state.user.subscribedDramas || []).some((d) => d.id === id);
        return {
          user: {
            ...state.user,
            subscribedDramas: subscribed
              ? (state.user.subscribedDramas || []).filter((d) => d.id !== id)
              : [...(state.user.subscribedDramas || []), { id, title }],
          },
        };
      });
    },

    // ---- Search history ----
    addSearchHistory: (keyword) => {
      const trimmed = keyword.trim();
      if (!trimmed) return;
      set((state) => {
        const history = state.user.searchHistory || [];
        const newHistory = [trimmed, ...history.filter((h) => h !== trimmed)].slice(0, 10);
        return {
          user: { ...state.user, searchHistory: newHistory },
        };
      });
    },

    clearSearchHistory: () => {
      set((state) => ({
        user: { ...state.user, searchHistory: [] },
      }));
    },
  }),
  {
    partialize: (state) => {
      const result: Record<string, any> = {};
      for (const [k, v] of Object.entries(state)) {
        if (typeof v === 'function') continue;
        if (k === 'activeVideoId') continue;
        result[k] = v;
      }
      return result as Partial<BilibiliState>;
    },
  },
);

// ---- Memoized Selectors ----

type BilibiliStore = BilibiliState & BilibiliActions;

export const selectUser = (s: BilibiliStore) => s.user;

export const selectSearchHistory = memoSelector(
  (s: BilibiliStore) => s.user.searchHistory,
  (history) => history || [],
);
