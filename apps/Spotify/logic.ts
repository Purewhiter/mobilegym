/**
 * Spotify state transitions, shared by the device server (device/index.ts,
 * the authority) and the page store (state.ts, which applies the same
 * transition at once so a quick second tap sees the first). Pure: no clock,
 * no ids; callers pass `now` and any new record.
 */

import type { PlayHistoryEntry, PlaySource, SpotifyPlaylist, SpotifyTrack } from './types';
import type { SpotifyDeviceState } from './device';
import { songKey } from './utils/songKey';

type S = SpotifyDeviceState;
type Playlist = SpotifyPlaylist & { trackIds?: string[]; storedTracks?: SpotifyTrack[] };

export const playlistSubtitle = (count: number) => `歌单 • ${count} 首歌曲|en:Playlist • ${count} songs`;

const historyEntry = (track: SpotifyTrack, source: PlaySource | null | undefined, now: number): PlayHistoryEntry => ({
  sourceType: source?.type ?? 'standalone',
  sourceId: source?.id ?? 'standalone',
  sourceTitle: source?.title ?? '',
  sourceCover: source?.cover,
  track,
  timestamp: now,
});

export function playTrack(s: S, track: SpotifyTrack, source: PlaySource | null | undefined, now: number): Partial<S> {
  return {
    currentTrack: track,
    isPlaying: true,
    queue: s.queue.some((q) => q.id === track.id) ? s.queue : [track, ...s.queue],
    recentPlays: [track, ...s.recentPlays.filter((r) => r.id !== track.id)].slice(0, 20),
    playHistory: [historyEntry(track, source, now), ...s.playHistory].slice(0, 100),
  };
}

export function setQueueWithTracks(
  s: S, tracks: SpotifyTrack[], startIndex: number, source: PlaySource | null | undefined, now: number,
): Partial<S> {
  const safeIndex = Math.max(0, Math.min(startIndex, tracks.length - 1));
  const played = tracks[safeIndex] ?? null;
  return {
    queue: tracks.slice(),
    currentTrack: played,
    isPlaying: tracks.length > 0,
    recentPlays: played ? [played, ...s.recentPlays.filter((r) => r.id !== played.id)].slice(0, 20) : s.recentPlays,
    playHistory: [...(played && source ? [historyEntry(played, source, now)] : []), ...s.playHistory].slice(0, 100),
  };
}

export const togglePlay = (s: S): Partial<S> => ({ isPlaying: !s.isPlaying });

export function toggleShuffle(s: S): Partial<S> {
  const shuffle = !s.shuffle;
  // 互斥：开启随机播放则关闭循环模式
  return { shuffle, repeat: shuffle ? 'off' : s.repeat };
}

export function toggleRepeat(s: S): Partial<S> {
  const repeat = s.repeat === 'off' ? 'context' : s.repeat === 'context' ? 'track' : 'off';
  return { repeat, shuffle: repeat !== 'off' ? false : s.shuffle };
}

/** Unlike when the song is liked (`removed`), else like it, storing `record` (`added`). */
export function toggleLike(
  s: S, track: SpotifyTrack, record: SpotifyTrack | null,
): { patch: Partial<S>; removed?: SpotifyTrack; added?: SpotifyTrack } {
  const key = songKey(track);
  const isSameSong = (x: SpotifyTrack) => x.id === track.id || songKey(x) === key;
  const removed = s.likedSongs.filter(isSameSong);
  if (removed.length > 0) {
    return { patch: { likedSongs: s.likedSongs.filter((x) => !isSameSong(x)) }, removed: removed[0] };
  }
  const added = record ?? track;
  return { patch: { likedSongs: [added, ...s.likedSongs] }, added };
}

export function toggleFollowArtist(s: S, artistName: string): Partial<S> {
  const norm = artistName.trim().toLowerCase();
  const exists = s.followedArtists.some((a) => a.trim().toLowerCase() === norm);
  return {
    followedArtists: exists ? s.followedArtists.filter((a) => a.trim().toLowerCase() !== norm) : [artistName, ...s.followedArtists],
  };
}

export function addToQueue(s: S, track: SpotifyTrack): Partial<S> {
  return s.queue.some((q) => q.id === track.id) ? {} : { queue: [...s.queue, track] };
}

export function skip(s: S, step: 1 | -1): Partial<S> {
  if (!s.currentTrack || s.queue.length === 0) return {};
  const idx = s.queue.findIndex((t) => t.id === s.currentTrack?.id);
  return { currentTrack: s.queue[(idx + step + s.queue.length) % s.queue.length], isPlaying: true };
}

export function createPlaylist(s: S, playlist: Playlist): Partial<S> {
  return { customPlaylists: [playlist, ...(s.customPlaylists || [])] };
}

/** `newId`: id for the playlist when `name` does not exist yet. */
export function addTrackToPlaylist(s: S, name: string, track: SpotifyTrack, newId: string): Partial<S> {
  const playlists = [...(s.customPlaylists || [])] as Playlist[];
  let index = playlists.findIndex((p) => p.title === name);
  if (index === -1) {
    playlists.unshift({ id: newId, title: name, subtitle: playlistSubtitle(0), cover: '', type: 'playlist' } as Playlist);
    index = 0;
  }
  const pl = { ...playlists[index] };
  const trackIds = Array.isArray(pl.trackIds) ? [...pl.trackIds] : [];
  const storedTracks = Array.isArray(pl.storedTracks) ? [...pl.storedTracks] : [];
  const tNorm = track.title.trim().toLowerCase();
  const aNorm = track.artist.trim().toLowerCase();
  const dupById = trackIds.includes(track.id);
  const dupByName = storedTracks.some((x) => x.title.trim().toLowerCase() === tNorm && x.artist.trim().toLowerCase() === aNorm);
  if (!dupById && !dupByName) {
    trackIds.push(track.id);
    storedTracks.push(track);
  }
  pl.trackIds = trackIds;
  pl.storedTracks = storedTracks;
  if (!pl.cover && track.cover) pl.cover = track.cover;
  pl.subtitle = playlistSubtitle(trackIds.length);
  playlists[index] = pl;
  return { customPlaylists: playlists };
}

export function removeTrackFromPlaylist(s: S, name: string, trackId: string): Partial<S> {
  const playlists = [...(s.customPlaylists || [])] as Playlist[];
  const index = playlists.findIndex((p) => p.title === name);
  if (index === -1) return {};
  const pl = { ...playlists[index] };
  const trackIds = (Array.isArray(pl.trackIds) ? pl.trackIds : []).filter((id) => id !== trackId);
  const storedTracks = (Array.isArray(pl.storedTracks) ? pl.storedTracks : []).filter((x) => x.id !== trackId);
  pl.trackIds = trackIds;
  pl.storedTracks = storedTracks;
  pl.subtitle = playlistSubtitle(trackIds.length);
  // Cover: first remaining track's cover, or none.
  pl.cover = storedTracks.length > 0 ? (storedTracks[0].cover || '') : '';
  playlists[index] = pl;
  return { customPlaylists: playlists };
}

export function updateTrackCover(s: S, trackId: string, newCover: string): Partial<S> {
  const current = s.currentTrack;
  if (!current || current.id !== trackId) return {};
  return { currentTrack: { ...current, cover: newCover } };
}

export function updateSettings(s: S, category: string, patch: object): Partial<S> {
  const settings = s.settings as unknown as Record<string, Record<string, unknown>>;
  return { settings: { ...settings, [category]: { ...settings[category], ...patch } } as unknown as S['settings'] };
}

export function addAccount(s: S, user: S['currentUser']): Partial<S> {
  return { accounts: [...s.accounts, user], currentUser: user };
}

export function switchAccount(s: S, userId: string): Partial<S> {
  const user = s.accounts.find((u) => u.id === userId);
  return user ? { currentUser: user } : {};
}

export function setSearchResults(s: S, query: string, tracks: SpotifyTrack[]): Partial<S> {
  const history = [...s.searchHistory];
  const entry = { query, tracks };
  // 追加新搜索记录（同 query 则覆盖最后一条）
  if (history.length > 0 && history[history.length - 1].query === query) history[history.length - 1] = entry;
  else history.push(entry);
  return { searchHistory: history };
}
