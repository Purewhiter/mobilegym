import BroadcastBus, { ACTION_BOOT_COMPLETED } from '../../os/BroadcastBus';
import { createAppStoreWithActions, memoSelector } from '../../os/createAppStore';
import MediaSessionService, { type ActiveMediaSession } from '../../os/MediaSessionService';
import { SPOTIFY_CONFIG } from './data';
import type { SpotifyTrack, SpotifyPlaylist, SpotifyArtist, PlaySource, PlayHistoryEntry, SearchHistoryEntry } from './types';
import * as TimeService from '../../os/TimeService';

let localSeq = 0;
function nextId(prefix: string): string {
  localSeq += 1;
  return `${prefix}_${TimeService.now()}_${localSeq}`;
}

// ── Types ──────────────────────────────────────────────────────────

export interface SpotifySettings {
  dataSaver: {
    saverMode: number;
    downloadCellular: boolean;
    downloadAudioOnly: boolean;
    streamAudioOnly: boolean;
  };
  mediaQuality: {
    wifiQuality: string;
    cellQuality: string;
    downloadQuality: string;
  };
  playback: {
    gapless: boolean;
    automix: boolean;
    crossfade: number;
    autoplay: boolean;
    monoAudio: boolean;
    broadcast: boolean;
    sleepTimer: number;
    sleepFade: boolean;
    lyricsEnabled: boolean;
  };
  privacy: {
    shareActivity: boolean;
    privateSession: boolean;
    recentArtists: boolean;
    publicPlaylists: boolean;
    profilePlaylists: boolean;
  };
  contentDisplay: {
    reduceMotion: boolean;
    canvas: boolean;
    explicit: boolean;
    unavailable: boolean;
    createBtn: boolean;
  };
  appsDevices: {
    voiceAssistant: boolean;
    connectControl: boolean;
    localVisibility: boolean;
    localFiles: boolean;
  };
}

export interface SpotifyState {
  currentUser: any;
  accounts: any[];
  currentTrack: SpotifyTrack | null;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: 'off' | 'context' | 'track';
  queue: SpotifyTrack[];
  recentPlays: SpotifyTrack[];
  likedSongs: SpotifyTrack[];
  followedArtists: string[];
  customPlaylists: (SpotifyPlaylist | SpotifyArtist)[];
  playHistory: PlayHistoryEntry[];
  settings: SpotifySettings;
  pendingPlaylistTrack: SpotifyTrack | null;
  searchHistory: SearchHistoryEntry[];
  _temp: {
    queueToast: SpotifyTrack | null;
    likedToast: SpotifyTrack | null;
  };
}

export interface SpotifyActions {
  playTrack: (track: SpotifyTrack, source?: PlaySource) => void;
  setQueueWithTracks: (tracks: SpotifyTrack[], startIndex?: number, source?: PlaySource) => void;
  togglePlay: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  toggleLike: (track: SpotifyTrack) => void;
  toggleFollowArtist: (artistName: string) => void;
  addToQueue: (track: SpotifyTrack) => void;
  createPlaylist: (name: string, initialTrack?: SpotifyTrack | null) => SpotifyPlaylist;
  skipToNext: () => void;
  skipToPrevious: () => void;
  updateTrackCover: (trackId: string, newCover: string) => void;
  addAccount: (name: string) => void;
  switchAccount: (userId: string) => void;
  addTrackToPlaylist: (name: string, track: SpotifyTrack) => void;
  removeTrackFromPlaylist: (name: string, trackId: string) => void;
  updateSettings: <K extends keyof SpotifySettings>(category: K, patch: Partial<SpotifySettings[K]>) => void;
  setSearchResults: (query: string, tracks: SpotifyTrack[]) => void;
  showQueueToast: (track: SpotifyTrack) => void;
  clearQueueToast: () => void;
  clearLikedToast: () => void;
}

// ── Initial State ──────────────────────────────────────────────────

const configUser = SPOTIFY_CONFIG.user as { id: string; name: string; initial: string; color: string };

const initialState: SpotifyState = {
  currentUser: configUser,
  accounts: [configUser],
  currentTrack: SPOTIFY_CONFIG.recentPlays.length > 0
    ? SPOTIFY_CONFIG.recentPlays[0]
    : SPOTIFY_CONFIG.recommendedTracks.length > 0
      ? SPOTIFY_CONFIG.recommendedTracks[0]
      : null,
  isPlaying: false,
  shuffle: false,
  repeat: 'off',
  queue: SPOTIFY_CONFIG.recommendedTracks,
  recentPlays: SPOTIFY_CONFIG.recentPlays as SpotifyTrack[],
  likedSongs: (SPOTIFY_CONFIG.likedSongs ?? []) as SpotifyTrack[],
  followedArtists: (() => {
    const fromConfig = (SPOTIFY_CONFIG.followedArtists ?? []) as string[];
    if (fromConfig.length > 0) return fromConfig;
    // Fallback: init from libraryArtists names
    const lib = (SPOTIFY_CONFIG as any).libraryArtists ?? [];
    return lib.map((a: any) => a.name).filter(Boolean);
  })(),
  customPlaylists: [],
  playHistory: [],
  settings: { ...SPOTIFY_CONFIG.settings },
  pendingPlaylistTrack: null,
  searchHistory: [],
  _temp: {
    queueToast: null,
    likedToast: null,
  },
};

// ── Store ──────────────────────────────────────────────────────────

export const useSpotifyStore = createAppStoreWithActions<SpotifyState, SpotifyActions>(
  'spotify',
  initialState,
  (set, get) => ({
    playTrack: (track, source) => {
      const s = get();
      const inQueue = s.queue.find(t => t.id === track.id);
      const newQueue = inQueue ? s.queue : [track, ...s.queue];
      const newRecent = [track, ...s.recentPlays.filter(t => t.id !== track.id)].slice(0, 20);
      const entry: PlayHistoryEntry = {
        sourceType: source?.type ?? 'standalone',
        sourceId: source?.id ?? 'standalone',
        sourceTitle: source?.title ?? '',
        sourceCover: source?.cover,
        track,
        timestamp: TimeService.now(),
      };
      const newHistory = [entry, ...s.playHistory].slice(0, 100);
      set({
        currentTrack: track,
        isPlaying: true,
        queue: newQueue,
        recentPlays: newRecent,
        playHistory: newHistory,
      });
    },

    setQueueWithTracks: (tracks, startIndex = 0, source) => {
      const s = get();
      const safeIndex = Math.max(0, Math.min(startIndex, tracks.length - 1));
      const playedTrack = tracks[safeIndex] ?? null;
      const historyEntries: PlayHistoryEntry[] = playedTrack && source ? [{
        sourceType: source.type,
        sourceId: source.id,
        sourceTitle: source.title,
        sourceCover: source.cover,
        track: playedTrack,
        timestamp: TimeService.now(),
      }] : [];
      const newRecent = playedTrack
        ? [playedTrack, ...s.recentPlays.filter(t => t.id !== playedTrack.id)].slice(0, 20)
        : s.recentPlays;
      set({
        queue: tracks.slice(),
        currentTrack: playedTrack,
        isPlaying: tracks.length > 0,
        recentPlays: newRecent,
        playHistory: [...historyEntries, ...s.playHistory].slice(0, 100),
      });
    },

    togglePlay: () => {
      set({ isPlaying: !get().isPlaying });
    },

    toggleShuffle: () => {
      const nextShuffle = !get().shuffle;
      // 互斥：开启随机播放则关闭循环模式
      set({ shuffle: nextShuffle, repeat: nextShuffle ? 'off' : get().repeat });
    },

    toggleRepeat: () => {
      const s = get();
      const next = s.repeat === 'off' ? 'context' : s.repeat === 'context' ? 'track' : 'off';
      set({ repeat: next, shuffle: next !== 'off' ? false : s.shuffle });
    },

    toggleLike: (track) => {
      const s = get();
      const titleNorm = track.title.trim().toLowerCase();
      const artistNorm = track.artist.trim().toLowerCase();
      const exists = s.likedSongs.some(t =>
        t.id === track.id || (t.title.trim().toLowerCase() === titleNorm && t.artist.trim().toLowerCase() === artistNorm)
      );
      const patch: Partial<SpotifyState> = {
        likedSongs: exists
          ? s.likedSongs.filter(t =>
              t.id !== track.id && !(t.title.trim().toLowerCase() === titleNorm && t.artist.trim().toLowerCase() === artistNorm)
            )
          : [track, ...s.likedSongs],
      };
      if (!exists) set({ _temp: { ...get()._temp, likedToast: track } });
      set(patch);
    },

    toggleFollowArtist: (artistName) => {
      const s = get();
      const artistNorm = artistName.trim().toLowerCase();
      const exists = s.followedArtists.some(name => name.trim().toLowerCase() === artistNorm);
      set({
        followedArtists: exists
          ? s.followedArtists.filter(name => name.trim().toLowerCase() !== artistNorm)
          : [artistName, ...s.followedArtists],
      });
    },

    addToQueue: (track) => {
      const s = get();
      if (s.queue.some(t => t.id === track.id)) return;
      set({ queue: [...s.queue, track] });
    },

    showQueueToast: (track) => {
      set({ _temp: { ...get()._temp, queueToast: track } });
    },
    clearQueueToast: () => {
      set({ _temp: { ...get()._temp, queueToast: null } });
    },
    clearLikedToast: () => {
      set({ _temp: { ...get()._temp, likedToast: null } });
    },

    skipToNext: () => {
      const s = get();
      if (!s.currentTrack || s.queue.length === 0) return;
      const idx = s.queue.findIndex(t => t.id === s.currentTrack?.id);
      const nextIdx = (idx + 1) % s.queue.length;
      set({ currentTrack: s.queue[nextIdx], isPlaying: true });
    },

    skipToPrevious: () => {
      const s = get();
      if (!s.currentTrack || s.queue.length === 0) return;
      const idx = s.queue.findIndex(t => t.id === s.currentTrack?.id);
      const prevIdx = (idx - 1 + s.queue.length) % s.queue.length;
      set({ currentTrack: s.queue[prevIdx], isPlaying: true });
    },

    createPlaylist: (name, initialTrack = null) => {
      const s = get();
      const trackIds = initialTrack ? [initialTrack.id] : [];
      const storedTracks = initialTrack ? [initialTrack] : [];
      const newPlaylist = {
        id: nextId('cp'),
        title: name,
        subtitle: `歌单 • ${trackIds.length} 首歌曲|en:Playlist • ${trackIds.length} songs`,
        cover: initialTrack?.cover || '',
        type: 'playlist' as const,
        trackIds,
        storedTracks,
      } as SpotifyPlaylist & { trackIds: string[]; storedTracks: SpotifyTrack[] };
      set({ customPlaylists: [newPlaylist, ...(s.customPlaylists || [])] });
      return newPlaylist;
    },

    addTrackToPlaylist: (name, track) => {
      const s = get();
      const playlists = [...(s.customPlaylists || [])];
      let pl = playlists.find(p => (p as any).title === name);
      if (!pl) {
        pl = {
          id: nextId('cp'),
          title: name,
          subtitle: '歌单 • 0 首歌曲|en:Playlist • 0 songs',
          cover: '',
          type: 'playlist' as const,
        } as any;
        playlists.unshift(pl!);
      }
      const trackIds: string[] = Array.isArray((pl as any).trackIds) ? [...(pl as any).trackIds] : [];
      const storedTracks: SpotifyTrack[] = Array.isArray((pl as any).storedTracks) ? [...(pl as any).storedTracks] : [];
      const tNorm = track.title.trim().toLowerCase();
      const aNorm = track.artist.trim().toLowerCase();
      const dupById = trackIds.includes(track.id);
      const dupByName = storedTracks.some(t => t.title.trim().toLowerCase() === tNorm && t.artist.trim().toLowerCase() === aNorm);
      if (!dupById && !dupByName) {
        trackIds.push(track.id);
        storedTracks.push(track);
      }
      (pl as any).trackIds = trackIds;
      (pl as any).storedTracks = storedTracks;
      if (!((pl as any).cover) && track.cover) {
        (pl as any).cover = track.cover;
      }
      const count = trackIds.length;
      (pl as any).subtitle = `歌单 • ${count} 首歌曲|en:Playlist • ${count} songs`;
      set({ customPlaylists: playlists });
    },

    removeTrackFromPlaylist: (name, trackId) => {
      const s = get();
      const playlists = [...(s.customPlaylists || [])];
      const pl = playlists.find(p => (p as any).title === name);
      if (!pl) return;
      const trackIds: string[] = Array.isArray((pl as any).trackIds) ? [...(pl as any).trackIds] : [];
      const storedTracks: SpotifyTrack[] = Array.isArray((pl as any).storedTracks) ? [...(pl as any).storedTracks] : [];
      const nextIds = trackIds.filter(id => id !== trackId);
      const nextStored = storedTracks.filter(t => t.id !== trackId);
      (pl as any).trackIds = nextIds;
      (pl as any).storedTracks = nextStored;
      const count = nextIds.length;
      (pl as any).subtitle = `歌单 • ${count} 首歌曲|en:Playlist • ${count} songs`;
      // Update cover: use first remaining track's cover, or clear
      (pl as any).cover = nextStored.length > 0 ? (nextStored[0].cover || '') : '';
      set({ customPlaylists: playlists });
    },

    updateTrackCover: (trackId, newCover) => {
      const s = get();
      set({
        currentTrack: s.currentTrack?.id === trackId ? { ...s.currentTrack, cover: newCover } : s.currentTrack,
      });
    },

    // ── Settings ──────────────────────────────────────────────

    updateSettings: (category, patch) => {
      set(state => ({
        settings: {
          ...state.settings,
          [category]: { ...(state.settings[category] as any), ...patch },
        },
      }));
    },

    // ── Accounts ──────────────────────────────────────────────

    addAccount: (name) => {
      const s = get();
      const colors = ['bg-pink-500', 'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-red-500'];
      const newColor = colors[s.accounts.length % colors.length];
      const newUser = {
        id: nextId('u'),
        name,
        initial: name.charAt(0).toUpperCase(),
        color: newColor,
      };
      set({ accounts: [...s.accounts, newUser], currentUser: newUser });
    },

    switchAccount: (userId) => {
      const s = get();
      const user = s.accounts.find(u => u.id === userId);
      if (!user) return;
      set({ currentUser: user });
    },

    setSearchResults: (query, tracks) => {
      const s = get();
      // 追加新搜索记录（同 query 则覆盖最后一条）
      const history = [...s.searchHistory];
      if (history.length > 0 && history[history.length - 1].query === query) {
        history[history.length - 1] = { query, tracks };
      } else {
        history.push({ query, tracks });
      }
      set({ searchHistory: history });
    },

  }),
);


// ── Memoized selectors (for derived arrays/objects) ───────────────

export const selectLikedSongs = memoSelector(
  (s: SpotifyState & SpotifyActions) => s.likedSongs,
  (likedSongs) => likedSongs,
);

export const selectLikedSongIds = memoSelector(
  (s: SpotifyState & SpotifyActions) => s.likedSongs,
  (likedSongs) => {
    const ids = new Set(likedSongs.map(t => t.id));
    const keys = new Set(likedSongs.map(t => `${t.title.trim().toLowerCase()}||${t.artist.trim().toLowerCase()}`));
    return {
      has(trackId: string, track?: { title: string; artist: string }) {
        if (ids.has(trackId)) return true;
        if (track) return keys.has(`${track.title.trim().toLowerCase()}||${track.artist.trim().toLowerCase()}`);
        return false;
      },
    };
  },
);

export const selectCustomPlaylists = memoSelector(
  (s: SpotifyState & SpotifyActions) => s.customPlaylists,
  (customPlaylists) => customPlaylists,
);

export const selectQueue = memoSelector(
  (s: SpotifyState & SpotifyActions) => s.queue,
  (queue) => queue,
);

export const selectRecentPlays = memoSelector(
  (s: SpotifyState & SpotifyActions) => s.recentPlays,
  (recentPlays) => recentPlays,
);

// ── MediaSession publisher ─────────────────────────────────────────
// Real Android: Spotify keeps an active MediaSession that lockscreen / widget
// / Bluetooth controls listen to via MediaSessionManager. mobile-gym mirrors
// this via os/MediaSessionService — subscribers consume "now playing" without
// importing Spotify code. Push on every change so the music widget stays
// in sync.

function parseTrackDurationMs(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const parts = value.split(':').map((part) => parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
  if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  return 0;
}

function publishMediaSession(state: SpotifyState & SpotifyActions): void {
  const track = state.currentTrack;
  if (!track) {
    MediaSessionService.clearActiveSession();
    return;
  }
  const session: ActiveMediaSession = {
    title: track.title ?? '',
    artist: track.artist ?? '',
    durationMs: Math.max(1, parseTrackDurationMs(track.duration)),
    positionMs: 0,
    isPlaying: Boolean(state.isPlaying),
    packageName: 'com.spotify.music',
    activityClass: 'com.spotify.music.MainActivity',
  };
  MediaSessionService.setActiveSession(session);
}

// Publish the initial session on module load (covers cold-start with a
// non-null currentTrack from SPOTIFY_CONFIG.recentPlays).
publishMediaSession(useSpotifyStore.getState());

useSpotifyStore.subscribe((state, prev) => {
  if (state.currentTrack === prev.currentTrack && state.isPlaying === prev.isPlaying) {
    return;
  }
  publishMediaSession(state);
});

// __SIM__.resetState() (no page reload) wipes the volatile MediaSession store
// after app stores re-init, so the music widget would read nothing until the
// next play-state change. OSContext re-emits BOOT_COMPLETED at the end of the
// reset; re-publish the (restored) now-playing state in response.
BroadcastBus.registerReceiver(ACTION_BOOT_COMPLETED, () => {
  publishMediaSession(useSpotifyStore.getState());
});
