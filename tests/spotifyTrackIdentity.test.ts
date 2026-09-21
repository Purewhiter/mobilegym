import { describe, expect, it } from 'vitest';

import defaults from '@/apps/Spotify/data/defaults.json';

/**
 * A track's id must identify the song, not the list it was read from.
 *
 * `toggleLike` matches an existing entry by id *or* by title+artist, but
 * stores whichever object the caller handed it. So when the same song carried
 * `ls_8` in `likedSongs` and `rp5` in `recentPlays`, unliking it from the
 * Recently Played screen removed `ls_8` and re-liking it inserted `rp5`. The
 * library was unchanged to the eye, yet a state diff read one song deleted and
 * a different one added -- enough to fail a benchmark task that the agent had
 * otherwise completed.
 *
 * Reordering is not covered here. Re-liking a song legitimately moves it to
 * the top, because liked songs are ordered by when they were added, and that
 * is a real change the judge is meant to catch.
 */

type Track = { id?: string; title?: string; artist?: string };

const TRACK_LISTS = [
  'likedSongs',
  'recentPlays',
  'recommendedTracks',
  'startListening',
  'trendingForYou',
  'extraTracks',
] as const;

function identity(track: Track): string {
  return `${String(track.title ?? '').trim().toLowerCase()}||${String(track.artist ?? '').trim().toLowerCase()}`;
}

function allTracks(): Array<{ list: string; track: Track }> {
  const out: Array<{ list: string; track: Track }> = [];
  for (const list of TRACK_LISTS) {
    const entries = (defaults as Record<string, unknown>)[list];
    if (!Array.isArray(entries)) continue;
    for (const track of entries as Track[]) {
      if (track?.id && track?.title && track?.artist) out.push({ list, track });
    }
  }
  return out;
}

describe('Spotify track identity', () => {
  const tracks = allTracks();

  it('reads tracks from the seed lists', () => {
    expect(tracks.length).toBeGreaterThan(20);
  });

  it('gives one song exactly one id across every list', () => {
    const idsBySong = new Map<string, Map<string, string[]>>();
    for (const { list, track } of tracks) {
      const song = identity(track);
      const byId = idsBySong.get(song) ?? new Map<string, string[]>();
      byId.set(track.id!, [...(byId.get(track.id!) ?? []), list]);
      idsBySong.set(song, byId);
    }

    const collisions = [...idsBySong.entries()]
      .filter(([, byId]) => byId.size > 1)
      .map(([song, byId]) => ({
        song,
        ids: [...byId.entries()].map(([id, lists]) => `${id} (${lists.join(', ')})`),
      }));

    expect(collisions).toEqual([]);
  });

  it('does not reuse one id for two different songs', () => {
    const songsById = new Map<string, Set<string>>();
    for (const { track } of tracks) {
      const songs = songsById.get(track.id!) ?? new Set<string>();
      songs.add(identity(track));
      songsById.set(track.id!, songs);
    }

    const reused = [...songsById.entries()]
      .filter(([, songs]) => songs.size > 1)
      .map(([id, songs]) => ({ id, songs: [...songs] }));

    expect(reused).toEqual([]);
  });

  it('keeps a song identical apart from nothing when it appears twice', () => {
    // Two entries for one song should be the same record, not two records that
    // happen to share a name -- otherwise re-liking swaps cover art or runtime.
    const byId = new Map<string, Track[]>();
    for (const { track } of tracks) {
      byId.set(track.id!, [...(byId.get(track.id!) ?? []), track]);
    }

    const divergent = [...byId.entries()]
      .filter(([, entries]) => entries.length > 1)
      .filter(([, entries]) => {
        const [first, ...rest] = entries;
        return rest.some((other) => JSON.stringify(other) !== JSON.stringify(first));
      })
      .map(([id, entries]) => ({ id, entries }));

    expect(divergent).toEqual([]);
  });
});
