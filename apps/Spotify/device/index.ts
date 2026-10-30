/**
 * Spotify on the device server.
 *
 * Session state is the user's library and player (accounts, current track,
 * queue, likes, follows, playlists, history, settings) in the same shape as
 * before, so `__SIM__.getState().apps.spotify` and every bench judge keep
 * working unchanged. Commands are the former store actions; the transitions
 * themselves live in ../logic.ts, which the page store also applies at once.
 * Records that need the page (new ids, which record a re-like restores) are
 * built there.
 *
 * The catalog (~1.8MB: categories, album / artist / playlist tracks, search
 * results) stays a lazy page loader for now: it is small and read-only.
 */

import type { AppContext, AppModule } from '../../../device/engine';
import * as logic from '../logic';
import type { SpotifyState } from '../state';
import type { PlaySource, SpotifyPlaylist, SpotifyTrack } from '../types';

export type SpotifyDeviceState = Omit<SpotifyState, '_temp' | 'pendingPlaylistTrack'>;

export const SPOTIFY_STATE_KEYS = [
  'currentUser', 'accounts', 'currentTrack', 'isPlaying', 'shuffle', 'repeat', 'queue', 'recentPlays',
  'likedSongs', 'followedArtists', 'customPlaylists', 'playHistory', 'settings', 'searchHistory',
] as const satisfies readonly (keyof SpotifyDeviceState)[];

type Ctx = AppContext<SpotifyDeviceState>;

const apply = (ctx: Ctx, patch: Partial<SpotifyDeviceState>) => {
  ctx.state = { ...ctx.state, ...patch };
};

const commands: AppModule<SpotifyDeviceState>['commands'] = {
  playTrack(ctx, [track, source], { now }) {
    apply(ctx, logic.playTrack(ctx.state, track as SpotifyTrack, source as PlaySource | null, now));
  },
  setQueueWithTracks(ctx, [tracks, startIndex, source], { now }) {
    apply(ctx, logic.setQueueWithTracks(
      ctx.state, (tracks as SpotifyTrack[]) ?? [], Number(startIndex ?? 0), source as PlaySource | null, now,
    ));
  },
  togglePlay: (ctx) => apply(ctx, logic.togglePlay(ctx.state)),
  toggleShuffle: (ctx) => apply(ctx, logic.toggleShuffle(ctx.state)),
  toggleRepeat: (ctx) => apply(ctx, logic.toggleRepeat(ctx.state)),
  /** Returns `{ removed }` or `{ added }`; the page picks `record` (which record a re-like restores). */
  toggleLike(ctx, [track, record]) {
    const { patch, removed, added } = logic.toggleLike(ctx.state, track as SpotifyTrack, record as SpotifyTrack | null);
    apply(ctx, patch);
    return removed ? { removed } : { added };
  },
  toggleFollowArtist: (ctx, [name]) => apply(ctx, logic.toggleFollowArtist(ctx.state, String(name))),
  addToQueue: (ctx, [track]) => apply(ctx, logic.addToQueue(ctx.state, track as SpotifyTrack)),
  skipToNext: (ctx) => apply(ctx, logic.skip(ctx.state, 1)),
  skipToPrevious: (ctx) => apply(ctx, logic.skip(ctx.state, -1)),
  createPlaylist(ctx, [playlist]) {
    apply(ctx, logic.createPlaylist(ctx.state, playlist as SpotifyPlaylist));
    return playlist;
  },
  addTrackToPlaylist: (ctx, [name, track, newId]) =>
    apply(ctx, logic.addTrackToPlaylist(ctx.state, String(name), track as SpotifyTrack, String(newId))),
  removeTrackFromPlaylist: (ctx, [name, trackId]) =>
    apply(ctx, logic.removeTrackFromPlaylist(ctx.state, String(name), String(trackId))),
  updateTrackCover: (ctx, [trackId, cover]) => apply(ctx, logic.updateTrackCover(ctx.state, String(trackId), String(cover))),
  updateSettings: (ctx, [category, patch]) => apply(ctx, logic.updateSettings(ctx.state, String(category), patch as object)),
  addAccount: (ctx, [user]) => apply(ctx, logic.addAccount(ctx.state, user as SpotifyDeviceState['currentUser'])),
  switchAccount: (ctx, [userId]) => apply(ctx, logic.switchAccount(ctx.state, String(userId))),
  setSearchResults: (ctx, [query, tracks]) =>
    apply(ctx, logic.setSearchResults(ctx.state, String(query), tracks as SpotifyTrack[])),
};

export function createSpotifyModule(): AppModule<SpotifyDeviceState> {
  return {
    appId: 'spotify',
    loadCatalog: () => ({ collections: new Map(), extras: {} }),
    materialize() {},
    exportState: ctx => ctx.state,
    importState(raw) {
      if (!raw || typeof raw !== 'object') throw new Error('spotify state must be an object');
      const source = raw as Record<string, unknown>;
      const state: Record<string, unknown> = {};
      for (const key of SPOTIFY_STATE_KEYS) state[key] = source[key];
      return state as unknown as SpotifyDeviceState;
    },
    commands,
    queries: {},
  };
}
