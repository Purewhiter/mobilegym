import type { SpotifyTrack } from '../types';

export type CategoryDataMap = Record<string, any>;
export type PlaylistTracksMap = Record<string, SpotifyTrack[]>;

// ─── 离线 iTunes 数据类型 ─────────────────────────────────────────────────────

export interface ArtistTrackEntry extends SpotifyTrack {
  album?: string;
}
export type ArtistTracksMap = Record<string, ArtistTrackEntry[]>;   // key: lowercase artist name
export interface SearchResultEntry {
  songs: SpotifyTrack[];
  artists: { artistId: string; artistName: string; artworkUrl100: string }[];
  albums: { collectionId: string; collectionName: string; artistName: string; artworkUrl100: string }[];
}
export type SearchResultsMap = Record<string, SearchResultEntry>;    // key: lowercase search term
export interface AlbumCacheEntry {
  playlist: { id: string; title: string; subtitle: string; cover: string; type: string };
  tracks: SpotifyTrack[];
  albumInfo: { title: string; trackCount: number; year: string };
}
export type AlbumTracksMap = Record<string, AlbumCacheEntry>;        // key: iTunes collectionId string

let categoryCache: CategoryDataMap | null = null;
let categoryInflight: Promise<CategoryDataMap> | null = null;

let playlistTracksCache: PlaylistTracksMap | null = null;
let playlistTracksInflight: Promise<PlaylistTracksMap> | null = null;

export async function loadCategories(): Promise<CategoryDataMap> {
  if (categoryCache) return categoryCache;
  if (categoryInflight) return categoryInflight;

  categoryInflight = (async () => {
    const url = new URL('./categories.json', import.meta.url).href;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`[Spotify] 加载 categories.json 失败：${res.status} ${res.statusText}`);
    const json = (await res.json()) as CategoryDataMap;
    categoryCache = json;
    return json;
  })().catch(err => { categoryInflight = null; throw err; });

  return categoryInflight;
}

export function getCategoriesSync(): CategoryDataMap | null {
  return categoryCache;
}

export async function loadPlaylistTracks(): Promise<PlaylistTracksMap> {
  if (playlistTracksCache) return playlistTracksCache;
  if (playlistTracksInflight) return playlistTracksInflight;

  playlistTracksInflight = (async () => {
    const url = new URL('./playlistTracks.json', import.meta.url).href;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`[Spotify] 加载 playlistTracks.json 失败：${res.status} ${res.statusText}`);
    const json = (await res.json()) as PlaylistTracksMap;
    playlistTracksCache = json;
    return json;
  })().catch(err => { playlistTracksInflight = null; throw err; });

  return playlistTracksInflight;
}

export function getPlaylistTracksSync(): PlaylistTracksMap | null {
  return playlistTracksCache;
}

export function clearCache() {
  categoryCache = null;
  categoryInflight = null;
  playlistTracksCache = null;
  playlistTracksInflight = null;
  artistTracksCache = null;
  artistTracksInflight = null;
  searchResultsCache = null;
  searchResultsInflight = null;
  albumTracksCache = null;
  albumTracksInflight = null;
}

// ─── 离线 iTunes 数据加载 ─────────────────────────────────────────────────────

let artistTracksCache: ArtistTracksMap | null = null;
let artistTracksInflight: Promise<ArtistTracksMap> | null = null;

export async function loadArtistTracks(): Promise<ArtistTracksMap> {
  if (artistTracksCache) return artistTracksCache;
  if (artistTracksInflight) return artistTracksInflight;
  artistTracksInflight = (async () => {
    const url = new URL('./artistTracks.json', import.meta.url).href;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`[Spotify] 加载 artistTracks.json 失败：${res.status}`);
    artistTracksCache = await res.json() as ArtistTracksMap;
    return artistTracksCache;
  })().catch(err => { artistTracksInflight = null; throw err; });
  return artistTracksInflight;
}

let searchResultsCache: SearchResultsMap | null = null;
let searchResultsInflight: Promise<SearchResultsMap> | null = null;

export async function loadSearchResults(): Promise<SearchResultsMap> {
  if (searchResultsCache) return searchResultsCache;
  if (searchResultsInflight) return searchResultsInflight;
  searchResultsInflight = (async () => {
    const url = new URL('./searchResults.json', import.meta.url).href;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`[Spotify] 加载 searchResults.json 失败：${res.status}`);
    searchResultsCache = await res.json() as SearchResultsMap;
    return searchResultsCache;
  })().catch(err => { searchResultsInflight = null; throw err; });
  return searchResultsInflight;
}

let albumTracksCache: AlbumTracksMap | null = null;
let albumTracksInflight: Promise<AlbumTracksMap> | null = null;

export async function loadAlbumTracks(): Promise<AlbumTracksMap> {
  if (albumTracksCache) return albumTracksCache;
  if (albumTracksInflight) return albumTracksInflight;
  albumTracksInflight = (async () => {
    const url = new URL('./albumTracks.json', import.meta.url).href;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`[Spotify] 加载 albumTracks.json 失败：${res.status}`);
    albumTracksCache = await res.json() as AlbumTracksMap;
    return albumTracksCache;
  })().catch(err => { albumTracksInflight = null; throw err; });
  return albumTracksInflight;
}

export async function preload(): Promise<void> {
  await Promise.all([loadCategories(), loadPlaylistTracks()]);
}
