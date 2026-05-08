import defaults from './defaults.json';
import { AVATAR_SOURCES } from './avatarSources';
import { SUBREDDIT_ICON_SOURCES } from './subredditIconSources';
import { getUserAvatar, normalizeUsername } from '../utils/userIdentity';
import type { RedditPost, RedditSettings, RedditCommunity } from '../types';
const asset = (r: unknown) => { const s = String(r ?? '').trim(); return (!s || s.startsWith('/') || s.startsWith('http')) ? s : `/@app-assets/Reddit/${s}`; };

export type { RedditPost, RedditSettings, RedditCommunity };

// ── Processing helpers ─────────────────────────────────────────────

const normalizeSubredditIconPath = (raw: unknown): string | undefined => {
  const s = String(raw ?? '').trim();
  if (!s) return undefined;
  const resolved = asset(s);
  return resolved !== s ? resolved : asset('basic/icon_comment.png');
};

const normalizeTimeAgo = (raw: unknown): string => {
  const s = String(raw ?? '').trim();
  if (!s) return s;

  if (/^\d+\s*(?:s|m|h|d|w|mo|y)$/i.test(s)) {
    return s.replace(/\s+/g, '').toLowerCase();
  }

  if (s === '刚刚') return 'now';

  let m = s.match(/^(\d+)\s*秒前$/);
  if (m) return `${m[1]}s`;
  m = s.match(/^(\d+)\s*分钟前$/);
  if (m) return `${m[1]}m`;
  m = s.match(/^(\d+)\s*小时前$/);
  if (m) return `${m[1]}h`;
  m = s.match(/^(\d+)\s*天前$/);
  if (m) return `${m[1]}d`;
  m = s.match(/^(\d+)\s*周前$/);
  if (m) return `${m[1]}w`;
  m = s.match(/^(\d+)\s*个月前$/);
  if (m) return `${m[1]}mo`;
  m = s.match(/^(\d+)\s*年前$/);
  if (m) return `${m[1]}y`;

  return s;
};

const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};

const normalizeCommunityKey = (raw: unknown): string => {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const lower = s.toLowerCase();
  return lower.startsWith('r/') ? lower : `r/${lower.replace(/^\/+/, '')}`;
};

const mulberry32 = (a: number) => {
  return () => {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const buildAvatarPool = (size: number, seed: string): string[] => {
  if (!AVATAR_SOURCES.length) return [];
  const arr = [...AVATAR_SOURCES];
  const rng = mulberry32(hashString(seed));
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.min(size, arr.length));
};

const COMMUNITY_AVATAR_POOL = buildAvatarPool(20, 'reddit:community-avatar-pool');

const pickFromPool = (pool: string[], seed: unknown): string | undefined => {
  if (!pool.length) return undefined;
  const s = String(seed ?? '').trim();
  if (!s) return pool[0];
  return pool[hashString(s) % pool.length];
};

const pickCommunityAvatar = (communityKey: unknown): string | undefined => {
  const key = normalizeCommunityKey(communityKey);
  const picked = pickFromPool(COMMUNITY_AVATAR_POOL, key);
  return picked ? asset(picked) : undefined;
};

const diversifyTimeAgo = (postId: string, normalized: string): string => {
  if (normalized !== 'now') return normalized;
  const roll = hashString(postId) % 10;
  if (roll < 3) return 'now';
  const candidates = ['8m', '45m', '1h', '5h', '16h', '1d', '3d', '6d'] as const;
  return candidates[hashString(`${postId}:time`) % candidates.length];
};

const interleaveBySubreddit = (posts: RedditPost[]): RedditPost[] => {
  const groups = new Map<string, RedditPost[]>();
  for (const p of posts) {
    const key = p.subreddit || 'unknown';
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }
  const keys = Array.from(groups.keys()).sort();
  const out: RedditPost[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const k of keys) {
      const arr = groups.get(k);
      if (!arr || arr.length === 0) continue;
      out.push(arr.shift()!);
      added = true;
    }
  }
  return out;
};

export const processPosts = (posts: any[]): RedditPost[] => {
  const normalized = posts.map(p => {
    const base = normalizeTimeAgo(p.timeAgo);
    const authorKey = p.author || p.authorId || p.id || '';
    const authorUsername = normalizeUsername(authorKey);
    const subredditKeyRaw = p.subreddit || p.subredditId || p.id || '';
    const subredditKey = normalizeCommunityKey(subredditKeyRaw);
    const subredditIcon = SUBREDDIT_ICON_SOURCES[subredditKey]
      ?? pickCommunityAvatar(subredditKey)
      ?? normalizeSubredditIconPath(p.subredditIcon);
    return {
      ...p,
      timeAgo: diversifyTimeAgo(String(p.id ?? ''), base),
      subredditIcon,
      comments: String(p.comments),
      upvotes: String(p.upvotes),
      isAd: p.isAd || false,
      image: p.image || undefined,
      authorAvatar: getUserAvatar(authorUsername),
    };
  });
  return interleaveBySubreddit(normalized);
};

// ── Export ──────────────────────────────────────────────────────────

const resolveAssetsDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(resolveAssetsDeep);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = resolveAssetsDeep(typeof v === 'string' && v.includes('/') ? asset(v) : v);
    }
    return out;
  }
  if (typeof value === 'string' && value.includes('/')) return asset(value);
  return value;
};

interface DefaultsExtensions {
  samplePosts?: any[];
  userPosts?: any[];
  chatThreads?: Record<string, any[]>;
  chatReplies?: Record<string, any[]>;
  userComments?: Record<string, any[]>;
}

const typedDefaults = defaults as typeof defaults & DefaultsExtensions;
const resolvedDefaults = resolveAssetsDeep(defaults) as typeof defaults;

const processSamplePosts = (raw: any[]): RedditPost[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    const authorKey = p.author || p.id || '';
    return {
      ...p,
      image: p.image || undefined,
      images: p.images || undefined,
      subredditIcon: undefined,
      authorAvatar: getUserAvatar(normalizeUsername(authorKey)),
      upvotes: String(p.upvotes ?? '0'),
      comments: String(p.comments ?? '0'),
    } as RedditPost;
  });
};

const processUserPosts = (raw: any[], username: string): RedditPost[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => ({
    ...p,
    author: username,
    image: p.image || undefined,
    images: p.images || undefined,
    subredditIcon: undefined,
    authorAvatar: getUserAvatar(username),
    upvotes: String(p.upvotes ?? '0'),
    comments: String(p.comments ?? '0'),
  } as RedditPost));
};

const processUserComments = (raw: Record<string, any[]>, username: string): Record<string, any[]> => {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, any[]> = {};
  for (const [postId, list] of Object.entries(raw)) {
    if (!Array.isArray(list)) continue;
    out[postId] = list.map((c) => ({ ...c, author: c.author || username }));
  }
  return out;
};

export const REDDIT_CONFIG = {
  user: {
    ...resolvedDefaults.user,
    avatar: getUserAvatar(resolvedDefaults.user.username) ?? '',
    bio: '',
    bannerImage: '',
  },

  communities: (resolvedDefaults.communities as RedditCommunity[]).map((c) => ({
    ...c,
    icon: pickCommunityAvatar(c.id || c.name) ?? (c.icon ? asset(c.icon) : undefined),
  })),

  settings: defaults.settings as RedditSettings,

  assets: resolvedDefaults.assets,

  samplePosts: processSamplePosts(typedDefaults.samplePosts ?? []),
  userPosts: processUserPosts(typedDefaults.userPosts ?? [], resolvedDefaults.user.username),
  chatThreads: (typedDefaults.chatThreads ?? {}) as Record<string, any[]>,
  chatReplies: (typedDefaults.chatReplies ?? {}) as Record<string, any[]>,
  userComments: processUserComments(typedDefaults.userComments ?? {}, resolvedDefaults.user.username),
};
