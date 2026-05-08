/**
 * React hooks for lazy-loading Bilibili data.
 * Uses singleton cache from loader — data is instant after first load.
 */

import { useState, useEffect } from 'react';
import type { BilibiliVideo, CommentReply, RankingVideo, UserInfo } from '../types';
import {
    loadVideos, getVideosSync,
    loadVideoTags, getVideoTagsSync,
    loadVideoOnline, getVideoOnlineSync,
    loadVideoComments, getVideoCommentsSync,
    loadCommenters, getCommentersSync,
    loadAuthors, getAuthorsSync,
    loadRankings, getRankingsSync,
} from '../data/loader';

// VideoComments 类型（与 videoDetails.ts 中的定义一致）
interface VideoComments {
    comments: CommentReply[];
    count: number;
}

function useLazyData<T>(getSync: () => T | null, loadAsync: () => Promise<T>, fallback: T): T {
    const [data, setData] = useState<T>(() => getSync() ?? fallback);
    useEffect(() => {
        if (getSync() === null) {
            loadAsync().then(setData);
        }
    }, []);
    return data;
}

export function useVideos(): BilibiliVideo[] {
    return useLazyData(getVideosSync, loadVideos, []);
}

export function useVideoTags(): Record<string, string[]> {
    return useLazyData(getVideoTagsSync, loadVideoTags, {});
}

export function useVideoOnline(): Record<string, string> {
    return useLazyData(getVideoOnlineSync, loadVideoOnline, {});
}

export function useVideoComments(): Record<string, VideoComments> {
    return useLazyData(getVideoCommentsSync, loadVideoComments, {});
}

export function useCommenters(): Record<number, UserInfo> {
    return useLazyData(getCommentersSync, loadCommenters, {});
}

export function useAuthors(): Record<number, UserInfo> {
    return useLazyData(getAuthorsSync, loadAuthors, {});
}

export function useRankings(): Record<string, RankingVideo[]> {
    return useLazyData(getRankingsSync, loadRankings, {});
}
