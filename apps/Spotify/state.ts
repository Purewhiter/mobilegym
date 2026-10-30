import BroadcastBus, { ACTION_BOOT_COMPLETED } from '../../os/BroadcastBus';
import { memoSelector } from '../../os/createAppStore';
import { createDeviceAppStore } from '../../os/device/deviceStore';
import MediaSessionService, { type ActiveMediaSession } from '../../os/MediaSessionService';
import { SPOTIFY_CONFIG } from './data';
import type { SpotifyTrack, SpotifyPlaylist, SpotifyArtist, PlaySource, PlayHistoryEntry, SearchHistoryEntry } from './types';
import * as TimeService from '../../os/TimeService';
import { songKey } from './utils/songKey';
import * as logic from './logic';
import type { SpotifyDeviceState } from './device';

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
    /** Records removed by unliking this session, keyed by `songKey`. See `toggleLike`. */
    unlikedTracks: Record<string, SpotifyTrack>;
  };
}

export interface SpotifyActions {
  playTrack: (track: SpotifyTrack, source?: PlaySource) => Promise<void>;
  setQueueWithTracks: (tracks: SpotifyTrack[], startIndex?: number, source?: PlaySource) => Promise<void>;
  togglePlay: () => Promise<void>;
  toggleShuffle: () => Promise<void>;
  toggleRepeat: () => Promise<void>;
  toggleLike: (track: SpotifyTrack) => Promise<void>;
  toggleFollowArtist: (artistName: string) => Promise<void>;
  addToQueue: (track: SpotifyTrack) => Promise<void>;
  createPlaylist: (name: string, initialTrack?: SpotifyTrack | null) => Promise<SpotifyPlaylist | null>;
  skipToNext: () => Promise<void>;
  skipToPrevious: () => Promise<void>;
  updateTrackCover: (trackId: string, newCover: string) => Promise<void>;
  addAccount: (name: string) => Promise<void>;
  switchAccount: (userId: string) => Promise<void>;
  addTrackToPlaylist: (name: string, track: SpotifyTrack) => Promise<void>;
  removeTrackFromPlaylist: (name: string, trackId: string) => Promise<void>;
  updateSettings: <K extends keyof SpotifySettings>(category: K, patch: Partial<SpotifySettings[K]>) => Promise<void>;
  setSearchResults: (query: string, tracks: SpotifyTrack[]) => Promise<void>;
  showQueueToast: (track: SpotifyTrack) => void;
  clearQueueToast: () => void;
  clearLikedToast: () => void;
}

// ── Track identity ─────────────────────────────────────────────────

export { songKey };

/** The seed record for each song in `data/defaults.json`, first occurrence wins. */
const SEED_TRACK_BY_SONG: ReadonlyMap<string, SpotifyTrack> = (() => {
  const config = SPOTIFY_CONFIG as unknown as Record<string, unknown>;
  const bySong = new Map<string, SpotifyTrack>();
  for (const list of ['likedSongs', 'recentPlays', 'recommendedTracks', 'startListening', 'trendingForYou', 'extraTracks']) {
    const tracks = config[list];
    if (!Array.isArray(tracks)) continue;
    for (const track of tracks as SpotifyTrack[]) {
      if (!track?.id || !track.title || !track.artist) continue;
      const key = songKey(track);
      if (!bySong.has(key)) bySong.set(key, track);
    }
  }
  return bySong;
})();

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
    unlikedTracks: {},
  },
};

// ── Store ──────────────────────────────────────────────────────────

// Everything but `_temp` and `pendingPlaylistTrack` lives in the device server
// session (apps/Spotify/device); this store mirrors it, so components and
// `__SIM__.getState().apps.spotify` read the same shape as before. Actions run
// the matching server command; new ids and the record a re-like restores are
// decided here, as before.

const PAGE_ONLY_KEYS: (keyof SpotifyState)[] = ['_temp', 'pendingPlaylistTrack'];

export const useSpotifyStore = createDeviceAppStore<SpotifyState, SpotifyActions>(
  'spotify',
  initialState,
  { localKeys: PAGE_ONLY_KEYS },
  ({ optimistic }, set, get) => {
    // Every action shows its transition at once (the same ../logic.ts function
    // the server runs), so a quick second tap sees the first one's result.
    const act = (name: string, transition: (s: SpotifyState) => Partial<SpotifyState>, ...args: unknown[]) =>
      optimistic((s: SpotifyState) => transition(s), name, ...args);
    const S = (s: SpotifyState) => s as unknown as SpotifyDeviceState;

    return {
      playTrack: async (track, source) => {
        const now = TimeService.now();
        await act('playTrack', (s) => logic.playTrack(S(s), track, source, now), track, source);
      },
      setQueueWithTracks: async (tracks, startIndex = 0, source) => {
        const now = TimeService.now();
        await act('setQueueWithTracks', (s) => logic.setQueueWithTracks(S(s), tracks, startIndex, source, now), tracks, startIndex, source);
      },
      togglePlay: async () => {
        await act('togglePlay', (s) => logic.togglePlay(S(s)));
      },
      toggleShuffle: async () => {
        await act('toggleShuffle', (s) => logic.toggleShuffle(S(s)));
      },
      toggleRepeat: async () => {
        await act('toggleRepeat', (s) => logic.toggleRepeat(S(s)));
      },

      // Unliking a song and liking it again must put back the *same record*, no
      // matter which screen each tap happened on. The caller's `track` comes from
      // whatever catalog that screen reads, so storing it verbatim would swap the
      // record's id and cover art on a re-like from, say, search results -- and a
      // benchmark state diff would read that as one song deleted and a different
      // one added. So a like stores, in order of preference: the record this
      // session's unlike removed, the seed record for the song, the caller's.
      // (Position is not restored: liked songs are ordered by when they were
      // added, and re-liking genuinely moves the song to the top.)
      toggleLike: async (track) => {
        const key = songKey(track);
        const record = get()._temp.unlikedTracks?.[key] ?? SEED_TRACK_BY_SONG.get(key) ?? track;
        await act('toggleLike', (s) => {
          const { patch, removed, added } = logic.toggleLike(S(s), track, record);
          const temp = s._temp;
          if (removed) return { ...patch, _temp: { ...temp, unlikedTracks: { ...temp.unlikedTracks, [key]: removed } } };
          const { [key]: _restored, ...unlikedTracks } = temp.unlikedTracks ?? {};
          return { ...patch, _temp: { ...temp, likedToast: added ?? null, unlikedTracks } };
        }, track, record);
      },

      toggleFollowArtist: async (artistName) => {
        await act('toggleFollowArtist', (s) => logic.toggleFollowArtist(S(s), artistName), artistName);
      },
      addToQueue: async (track) => {
        await act('addToQueue', (s) => logic.addToQueue(S(s), track), track);
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

      skipToNext: async () => {
        await act('skipToNext', (s) => logic.skip(S(s), 1));
      },
      skipToPrevious: async () => {
        await act('skipToPrevious', (s) => logic.skip(S(s), -1));
      },

      /** Resolves to the new playlist, or `null` if a reset abandoned the command. */
      createPlaylist: async (name, initialTrack = null) => {
        const trackIds = initialTrack ? [initialTrack.id] : [];
        const newPlaylist = {
          id: nextId('cp'),
          title: name,
          subtitle: logic.playlistSubtitle(trackIds.length),
          cover: initialTrack?.cover || '',
          type: 'playlist' as const,
          trackIds,
          storedTracks: initialTrack ? [initialTrack] : [],
        } as SpotifyPlaylist & { trackIds: string[]; storedTracks: SpotifyTrack[] };
        const created = await act('createPlaylist', (s) => logic.createPlaylist(S(s), newPlaylist), newPlaylist);
        return created === undefined ? null : newPlaylist;
      },

      addTrackToPlaylist: async (name, track) => {
        const newId = nextId('cp');
        await act('addTrackToPlaylist', (s) => logic.addTrackToPlaylist(S(s), name, track, newId), name, track, newId);
      },
      removeTrackFromPlaylist: async (name, trackId) => {
        await act('removeTrackFromPlaylist', (s) => logic.removeTrackFromPlaylist(S(s), name, trackId), name, trackId);
      },
      updateTrackCover: async (trackId, newCover) => {
        await act('updateTrackCover', (s) => logic.updateTrackCover(S(s), trackId, newCover), trackId, newCover);
      },
      updateSettings: async (category, patch) => {
        await act('updateSettings', (s) => logic.updateSettings(S(s), category, patch), category, patch);
      },

      addAccount: async (name) => {
        const colors = ['bg-pink-500', 'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-red-500'];
        const user = {
          id: nextId('u'),
          name,
          initial: name.charAt(0).toUpperCase(),
          color: colors[get().accounts.length % colors.length],
        };
        await act('addAccount', (s) => logic.addAccount(S(s), user), user);
      },
      switchAccount: async (userId) => {
        await act('switchAccount', (s) => logic.switchAccount(S(s), userId), userId);
      },
      setSearchResults: async (query, tracks) => {
        await act('setSearchResults', (s) => logic.setSearchResults(S(s), query, tracks), query, tracks);
      },
    };
  },
);

// Sync right away, not only when Spotify opens: the music widget and
// `__SIM__.getState()` read this store after a reload too.
void useSpotifyStore.ensureSynced().catch(() => {});


// ── Memoized selectors (for derived arrays/objects) ───────────────

export const selectLikedSongs = memoSelector(
  (s: SpotifyState & SpotifyActions) => s.likedSongs,
  (likedSongs) => likedSongs,
);

export const selectLikedSongIds = memoSelector(
  (s: SpotifyState & SpotifyActions) => s.likedSongs,
  (likedSongs) => {
    const ids = new Set(likedSongs.map(t => t.id));
    const keys = new Set(likedSongs.map(songKey));
    return {
      has(trackId: string, track?: { title: string; artist: string }) {
        if (ids.has(trackId)) return true;
        if (track) return keys.has(songKey(track));
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
