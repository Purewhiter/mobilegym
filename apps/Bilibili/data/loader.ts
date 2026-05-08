/**
 * Bilibili 数据懒加载器
 *
 * 使用 fetch() + JSON.parse() 加载数据（避开 Vite ESM 转换管线，避免阻塞 dev server）。
 * 单例缓存：首次加载后后续调用直接返回缓存数据。
 */

import type { BilibiliVideo, CommentReply, RankingVideo, UserInfo } from '../types';
import { resolveBilibiliAssetsDeep } from '.';

// videoDetails.ts 中定义的 VideoComments（简化版，只有 comments + count）
interface VideoComments {
    comments: CommentReply[];
    count: number;
}

// JSON 数据仍随 App 本地加载；其中的 ./images/... 再统一解析到 /cdn/bilibili/images/...
const videosUrl = new URL('./videos.json', import.meta.url).href;
const tagsUrl = new URL('./videoTags.json', import.meta.url).href;
const onlineUrl = new URL('./videoOnline.json', import.meta.url).href;
const commentsUrl = new URL('./videoComments.json', import.meta.url).href;
const commentersUrl = new URL('./commenters.json', import.meta.url).href;
const authorsUrl = new URL('./authors.json', import.meta.url).href;
const rankingsUrl = new URL('./rankings.json', import.meta.url).href;

// 通用 fetch + 缓存模式（失败时清除 inflight promise 以允许重试）
function createLoader<T>(url: string) {
    let cache: T | null = null;
    let loading: Promise<T> | null = null;

    const load = (): Promise<T> => {
        if (cache) return Promise.resolve(cache);
        if (!loading) {
            loading = fetch(url)
                .then(r => {
                    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
                    return r.json();
                })
                .then(data => { cache = resolveBilibiliAssetsDeep(data) as T; return cache; })
                .catch(err => { loading = null; throw err; });
        }
        return loading;
    };

    const getSync = (): T | null => cache;

    return { load, getSync };
}

// ============ 各数据类型 ============

const videos = createLoader<BilibiliVideo[]>(videosUrl);
export const loadVideos = videos.load;
export const getVideosSync = videos.getSync;

const tags = createLoader<Record<string, string[]>>(tagsUrl);
export const loadVideoTags = tags.load;
export const getVideoTagsSync = tags.getSync;

const online = createLoader<Record<string, string>>(onlineUrl);
export const loadVideoOnline = online.load;
export const getVideoOnlineSync = online.getSync;

const comments = createLoader<Record<string, VideoComments>>(commentsUrl);
export const loadVideoComments = comments.load;
export const getVideoCommentsSync = comments.getSync;

const commenters = createLoader<Record<number, UserInfo>>(commentersUrl);
export const loadCommenters = commenters.load;
export const getCommentersSync = commenters.getSync;

const authors = createLoader<Record<number, UserInfo>>(authorsUrl);
export const loadAuthors = authors.load;
export const getAuthorsSync = authors.getSync;

const rankings = createLoader<Record<string, RankingVideo[]>>(rankingsUrl);
export const loadRankings = rankings.load;
export const getRankingsSync = rankings.getSync;

// ============ 批量预加载 ============

/**
 * 预加载所有 Bilibili 数据到缓存（供 bench waitForData 使用）
 */
export async function preload(): Promise<void> {
    await Promise.all([
        loadVideos(),
        loadVideoTags(),
        loadVideoOnline(),
        loadVideoComments(),
        loadCommenters(),
        loadAuthors(),
        loadRankings(),
    ]);
}

/** 标准化预加载入口（供 OS waitForData 自动发现） */
