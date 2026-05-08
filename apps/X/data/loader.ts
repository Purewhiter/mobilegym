import type { XPost, XUser } from '../types';
import { normalizeXPostTemporalFields } from '../utils/formatTime';

const USERS_URL = new URL('./users.json', import.meta.url).href;
const POSTS_URL = new URL('./posts.json', import.meta.url).href;
const REPLIES_URL = new URL('./replies.json', import.meta.url).href;

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
    return json;
  })().finally(() => { usersInFlight = null; });

  return usersInFlight;
}

export function getUsersSync(): Record<string, XUser> | null {
  return usersCached;
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
    return postsCached;
  })().finally(() => { postsInFlight = null; });

  return postsInFlight;
}

export function getPostsSync(): XPost[] | null {
  return postsCached;
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
    return json;
  })().finally(() => { repliesInFlight = null; });

  return repliesInFlight;
}

export function getRepliesSync(): Record<string, XPost[]> | null {
  return repliesCached;
}

// ============ Preload ============

export async function preload(): Promise<void> {
  await Promise.all([loadUsers(), loadPosts(), loadReplies()]);
}
