import { beforeEach, describe, expect, it, vi } from 'vitest';

import albumTracks from '@/apps/Spotify/data/albumTracks.json';
import artistTracks from '@/apps/Spotify/data/artistTracks.json';
import playlistTracks from '@/apps/Spotify/data/playlistTracks.json';
import searchResults from '@/apps/Spotify/data/searchResults.json';

/**
 * Unliking a song and liking it again must restore the same record, whichever
 * screen each tap happens on.
 *
 * The same song carries a different id in every catalog the app reads (seed
 * lists, search results, album pages, artist pages). `toggleLike` used to
 * store whatever record the calling screen handed it, so unlike + re-like from
 * search results replaced `ls_8` with `it_403037877`. To a benchmark state
 * diff that is one song deleted and a different one added -- a side-effect
 * failure for an agent that changed nothing the user can see.
 *
 * `tests/spotifyTrackIdentity.test.ts` keeps the seed lists self-consistent.
 * That cannot extend to the catalogs (one song legitimately appears on several
 * albums under several ids), so the invariant is enforced here, on behavior.
 */

type Track = { id: string; title: string; artist: string; cover: string; duration: string; coverLarge?: string };

function createLocalStorageMock(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
}

function songKey(t: { title: string; artist: string }): string {
  return `${t.title.trim().toLowerCase()}||${t.artist.trim().toLowerCase()}`;
}

/** Every record in the non-seed catalogs, as a screen would hand it to `toggleLike`. */
function catalogTracks(): Track[] {
  const out: Track[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    if (typeof o.id === 'string' && typeof o.title === 'string' && typeof o.artist === 'string') {
      out.push({ cover: '', duration: '0:00', ...(o as object) } as Track);
    }
    Object.values(o).forEach(walk);
  };
  [albumTracks, artistTracks, playlistTracks, searchResults].forEach(walk);
  return out;
}

describe('Spotify unlike + re-like', () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(globalThis, 'localStorage', { value: createLocalStorageMock(), configurable: true });
  });

  it('restores the identical record from every catalog that lists the song', async () => {
    const { useSpotifyStore } = await import('@/apps/Spotify/state');
    const initial = useSpotifyStore.getState().likedSongs;
    const likedKeys = new Set(initial.map(songKey));
    const variants = catalogTracks().filter((t) => likedKeys.has(songKey(t)));

    // Guard against the test going vacuous if the catalogs are reshuffled.
    expect(variants.length).toBeGreaterThan(10);
    expect(variants.some((v) => !initial.some((t) => t.id === v.id))).toBe(true);

    const changed: Array<{ via: string; before: unknown; after: unknown }> = [];
    for (const variant of variants) {
      useSpotifyStore.setState({ likedSongs: initial });
      const before = initial.find((t) => songKey(t) === songKey(variant));

      useSpotifyStore.getState().toggleLike(variant);
      expect(useSpotifyStore.getState().likedSongs.some((t) => songKey(t) === songKey(variant))).toBe(false);

      useSpotifyStore.getState().toggleLike(variant);
      const after = useSpotifyStore.getState().likedSongs;
      const restored = after.filter((t) => songKey(t) === songKey(variant));

      if (restored.length !== 1 || JSON.stringify(restored[0]) !== JSON.stringify(before)) {
        changed.push({ via: variant.id, before, after: restored });
      }
      // Same set of records overall; only the order may differ (re-like goes on top).
      expect(after.map((t) => t.id).sort()).toEqual(initial.map((t) => t.id).sort());
    }
    expect(changed).toEqual([]);
  });

  it('restores an injected record that is not in the seed data', async () => {
    // Benchmark scenarios can inject their own likedSongs; the guarantee must
    // not depend on the record being one the app shipped with.
    const { useSpotifyStore } = await import('@/apps/Spotify/state');
    const injected: Track = { id: 'custom_42', title: 'Hello', artist: 'Adele', cover: '/x.jpg', duration: '4:55' };
    const fromSearch: Track = { id: 'it_1051332387', title: 'Hello', artist: 'Adele', cover: '/y.jpg', duration: '4:56' };
    useSpotifyStore.setState({ likedSongs: [injected] });

    useSpotifyStore.getState().toggleLike(fromSearch);
    useSpotifyStore.getState().toggleLike(fromSearch);

    expect(useSpotifyStore.getState().likedSongs).toEqual([injected]);
  });

  it('after a reload, falls back to the seed record rather than the caller\'s', async () => {
    const { useSpotifyStore } = await import('@/apps/Spotify/state');
    const initial = useSpotifyStore.getState().likedSongs;
    const seed = initial.find((t) => t.title === 'Rolling In the Deep')!;
    const fromSearch: Track = { ...seed, id: 'it_403037877', cover: '/other.jpg' };

    useSpotifyStore.getState().toggleLike(fromSearch);
    // `_temp` is not persisted, so a reload between the two taps loses it.
    useSpotifyStore.setState({ _temp: { queueToast: null, likedToast: null, unlikedTracks: {} } });
    useSpotifyStore.getState().toggleLike(fromSearch);

    expect(useSpotifyStore.getState().likedSongs[0]).toEqual(seed);
  });

  it('stores a never-before-liked song as given', async () => {
    const { useSpotifyStore } = await import('@/apps/Spotify/state');
    const fresh: Track = { id: 'it_999', title: 'A Song Nobody Shipped', artist: 'Nobody', cover: '/z.jpg', duration: '1:00' };
    useSpotifyStore.getState().toggleLike(fresh);
    expect(useSpotifyStore.getState().likedSongs[0]).toEqual(fresh);
  });
});
