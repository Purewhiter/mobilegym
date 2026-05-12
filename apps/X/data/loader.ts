import type { XPost, XUser } from '../types';
import { normalizeXPostTemporalFields } from '../utils/formatTime';

const USERS_URL = new URL('./users.json', import.meta.url).href;
const POSTS_URL = new URL('./posts.json', import.meta.url).href;
const REPLIES_URL = new URL('./replies.json', import.meta.url).href;

/**
 * X base dataset (静态 JSON 表):
 *   - users:   全平台用户表 (case-sensitive id 主键)
 *   - posts:   所有可见推文 (排好序的 base feed)
 *   - replies: 按根 post id 索引的回复树
 *
 * 这套数据是只读的, 不属于 state, 不进 zustand store。
 * 组件通过 `useXBaseDataset()` (apps/X/data/view.ts) 订阅, 数据通过
 * `subscribeBaseDataset` + `getXBaseDataset` 这对原语驱动 useSyncExternalStore。
 */
export interface XBaseDataset {
  users: Record<string, XUser>;
  posts: XPost[];
  replies: Record<string, XPost[]>;
}

// 空 dataset 作为初始 snapshot, freeze 防意外 mutate。
const EMPTY_BASE: XBaseDataset = Object.freeze({
  users: Object.freeze({}) as Record<string, XUser>,
  posts: Object.freeze([]) as readonly XPost[] as XPost[],
  replies: Object.freeze({}) as Record<string, XPost[]>,
}) as XBaseDataset;

let baseSnapshot: XBaseDataset = EMPTY_BASE;
const subscribers = new Set<() => void>();

// Notify batching: 在 preload() 这种 "并行加载多份数据" 的场景里, 我们希望
// users + posts 同时到位后再 notify 一次, 避免组件先看到 "posts 已有 / users 为空"
// 的中间态而 hydrate 出 Unknown author。
let batchDepth = 0;
let pendingNotify = false;

function notifySubscribers(): void {
  for (const fn of subscribers) {
    try { fn(); } catch { /* swallow listener errors */ }
  }
}

function rebuildSnapshot(): void {
  baseSnapshot = {
    users: usersCached ?? EMPTY_BASE.users,
    posts: postsCached ?? EMPTY_BASE.posts,
    replies: repliesCached ?? EMPTY_BASE.replies,
  };
  if (batchDepth > 0) {
    pendingNotify = true;
    return;
  }
  notifySubscribers();
}

async function batchLoadNotify<T>(work: () => Promise<T>): Promise<T> {
  batchDepth += 1;
  try {
    return await work();
  } finally {
    batchDepth -= 1;
    if (batchDepth === 0 && pendingNotify) {
      pendingNotify = false;
      notifySubscribers();
    }
  }
}

/** useSyncExternalStore: getSnapshot 必须返回稳定引用 (snapshot 整体仅在 bump 时换). */
export function getXBaseDataset(): XBaseDataset {
  return baseSnapshot;
}

export function subscribeBaseDataset(listener: () => void): () => void {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

// ============ Users ============

let usersCached: Record<string, XUser> | null = null;
let usersInFlight: Promise<Record<string, XUser>> | null = null;

export async function loadUsers(): Promise<Record<string, XUser>> {
  if (usersCached) return usersCached;
  if (usersInFlight) return usersInFlight;

  usersInFlight = (async () => {
    const res = await fetch(USERS_URL);
    if (!res.ok) throw new Error(`Failed to fetch users.json: ${res.status}`);
    const json = (await res.json()) as Record<string, XUser>;
    usersCached = json;
    rebuildSnapshot();
    return json;
  })().finally(() => { usersInFlight = null; });

  return usersInFlight;
}

// ============ Posts ============

let postsCached: XPost[] | null = null;
let postsInFlight: Promise<XPost[]> | null = null;

export async function loadPosts(): Promise<XPost[]> {
  if (postsCached) return postsCached;
  if (postsInFlight) return postsInFlight;

  postsInFlight = (async () => {
    const res = await fetch(POSTS_URL);
    if (!res.ok) throw new Error(`Failed to fetch posts.json: ${res.status}`);
    const json = (await res.json()) as XPost[];
    postsCached = json.map((post) => normalizeXPostTemporalFields(post));
    rebuildSnapshot();
    return postsCached;
  })().finally(() => { postsInFlight = null; });

  return postsInFlight;
}

// ============ Replies ============

let repliesCached: Record<string, XPost[]> | null = null;
let repliesInFlight: Promise<Record<string, XPost[]>> | null = null;

export async function loadReplies(): Promise<Record<string, XPost[]>> {
  if (repliesCached) return repliesCached;
  if (repliesInFlight) return repliesInFlight;

  repliesInFlight = (async () => {
    const res = await fetch(REPLIES_URL);
    if (!res.ok) throw new Error(`Failed to fetch replies.json: ${res.status}`);
    const json = (await res.json()) as Record<string, XPost[]>;
    for (const [postId, replies] of Object.entries(json)) {
      json[postId] = replies.map((reply) => normalizeXPostTemporalFields(reply));
    }
    repliesCached = json;
    rebuildSnapshot();
    return json;
  })().finally(() => { repliesInFlight = null; });

  return repliesInFlight;
}

// ============ Preload ============
// 只预加载 users + posts; replies.json 体量大, 仅在 PostDetailsPage / UserProfilePage
// 进入时通过 store.ensureRepliesLoaded() 懒加载。
//
// 用 batchLoadNotify 包住并行加载, 让单次 notify 在两份数据都就绪后才触发, 避免组件
// 先看到 "posts 已有但 users 为空" 的中间态闪 Unknown author。
export async function preload(): Promise<void> {
  await batchLoadNotify(() => Promise.all([loadUsers(), loadPosts()]));
}
