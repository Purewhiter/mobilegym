/**
 * Reddit 数据懒加载器
 *
 * 使用 fetch() + JSON.parse() 加载数据（绕过 Vite ESM 转换管线，避免阻塞 dev server）。
 * 单例缓存：首次加载后后续调用直接返回缓存数据。
 */

import type { RedditPost } from '../types';
import { processPosts } from './index';

const postsUrl = new URL('./posts.json', import.meta.url).href;

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
        .then(data => { cache = data as T; return cache; })
        .catch(err => { loading = null; throw err; });
    }
    return loading;
  };

  const getSync = (): T | null => cache;

  return { load, getSync };
}

interface RawRedditData {
  posts: any[];
}

const rawData = createLoader<RawRedditData>(postsUrl);

let processedCache: RedditPost[] | null = null;
let processedLoading: Promise<RedditPost[]> | null = null;

export function loadPosts(): Promise<RedditPost[]> {
  if (processedCache) return Promise.resolve(processedCache);
  if (!processedLoading) {
    processedLoading = rawData.load().then(data => {
      processedCache = processPosts(data.posts);
      return processedCache;
    });
  }
  return processedLoading;
}

export function getPostsSync(): RedditPost[] | null {
  return processedCache;
}

export async function preload(): Promise<void> {
  await loadPosts();
}
