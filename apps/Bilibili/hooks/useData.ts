/**
 * Bilibili catalog read hooks.
 *
 * The catalog lives in the device server (apps/Bilibili/device). It is
 * read-only — the user's likes, coins and follows live in the store — so
 * these are catalog queries: fetched once per argument set and not re-run
 * when the user acts. While a query loads, `loading` is true and the data is
 * empty.
 */

import { useMemo } from 'react';

import { useDeviceQuery } from '../../../os/device/deviceStore';
import type { BilibiliVideo, CommentReply, RankingVideo, UserInfo } from '../types';

function useCatalogQuery<T>(name: string, args: Record<string, unknown>, enabled = true, keepPrevious = false) {
  return useDeviceQuery<T>('bilibili', name, args, enabled, { catalog: true, keepPrevious });
}

const EMPTY_VIDEOS: BilibiliVideo[] = [];

/**
 * Videos by id: `order: 'ids'` keeps the given order; `'catalog'` uses catalog
 * order (what filtering the full video list used to give). The id lists come
 * from the user's own lists (favorites, likes), so when they change the
 * previous result stays visible until the new one arrives.
 */
export function useVideosByIds(ids: readonly string[], order: 'ids' | 'catalog' = 'ids') {
  const enabled = ids.length > 0;
  const { data, loading } = useCatalogQuery<BilibiliVideo[]>('videos', { ids, order }, enabled, true);
  const videos = enabled ? (data ?? EMPTY_VIDEOS) : EMPTY_VIDEOS;
  const byId = useMemo(() => new Map(videos.map((video) => [video.id, video])), [videos]);
  return { videos, byId, loading: enabled && loading };
}

/** Catalog authors by mid; unknown mids are absent from the map. */
export function useAuthorsByMid(mids: readonly (string | number)[]) {
  const enabled = mids.length > 0;
  const { data, loading } = useCatalogQuery<Record<string, UserInfo>>(
    'authors',
    { mids: mids.map(String) },
    enabled,
  );
  return { authors: (enabled ? data : undefined) ?? EMPTY_AUTHORS, loading: enabled && loading };
}
const EMPTY_AUTHORS: Record<string, UserInfo> = {};

/** An author or commenter profile, with uploads merged with their full video records. */
export function useUserProfile(mid: string | undefined) {
  const { data, loading } = useCatalogQuery<{ user: UserInfo | null; videos: BilibiliVideo[] }>(
    'profile',
    { mid },
    Boolean(mid),
  );
  return { user: data?.user, videos: data?.videos ?? EMPTY_VIDEOS, loading };
}

export interface VideoDetail {
  /** The requested id (may differ from `video.id` when it is not in the catalog). */
  bvid: string;
  video: BilibiliVideo;
  related: BilibiliVideo[];
  tags: string[];
  online: string | null;
  comments: { comments: CommentReply[]; count: number } | null;
  author: UserInfo | null;
}

export function useVideoDetail(bvid: string | undefined) {
  const { data } = useCatalogQuery<VideoDetail>('videoDetail', { bvid }, Boolean(bvid));
  // Only a result for the current id counts; until then the page shows nothing.
  return data && data.bvid === bvid ? data : undefined;
}

export function usePartitionVideos(label: string, names: readonly string[]) {
  const { data, loading } = useCatalogQuery<BilibiliVideo[]>('partition', { label, names }, Boolean(label));
  return { videos: data ?? EMPTY_VIDEOS, loading };
}

/** Ranking lists for `keys`, with every listed video's full record. */
export function useRankings(keys: readonly string[]) {
  const { data, loading } = useCatalogQuery<{
    rankings: Record<string, RankingVideo[]>;
    videosById: Record<string, BilibiliVideo>;
  }>('rankings', { keys });
  const rankings = data?.rankings ?? EMPTY_RANKINGS;
  const videoById = useMemo(() => new Map(Object.entries(data?.videosById ?? {})), [data]);
  return { rankings, videoById, loading };
}
const EMPTY_RANKINGS: Record<string, RankingVideo[]> = {};

export interface SearchResult {
  videos: BilibiliVideo[];
  users: UserInfo[];
  animes: (RankingVideo & BilibiliVideo)[];
  movies: (RankingVideo & BilibiliVideo)[];
  /** Author avatar by name, for the authors of `videos`. */
  authorFaces: Record<string, string>;
  /** Full records of the top user's first uploads. */
  videosById: Record<string, BilibiliVideo>;
}

export function useSearch(q: string) {
  const { data, loading } = useCatalogQuery<SearchResult>('search', { q }, Boolean(q));
  return { result: q ? data : undefined, loading };
}
