import defaults from './defaults.json';
import { asset, getUserAvatar, normalizeUsername, pickCommunityAvatar } from './catalog';
import { REDDIT_COMMUNITY_DEFAULTS } from '../constants';
import type { Comment, RedditPost, RedditSettings, RedditCommunity } from '../types';

export { processPosts } from './catalog';
export type { Comment, RedditPost, RedditSettings, RedditCommunity };

// ── Static app-owned resources ─────────────────────────────────────

export const REDDIT_ASSETS = {
  chatWelcome: asset('others/chat_welcome.png'),
  emptyInbox: asset('others/inbox_empty.png'),
};

const processUserPost = (post: any, username: string): RedditPost => ({
  ...post,
  author: post.author || username,
  image: post.image || undefined,
  images: post.images || undefined,
  subredditIcon: post.subredditIcon || undefined,
  authorAvatar: getUserAvatar(normalizeUsername(post.author || username)),
  upvotes: String(post.upvotes ?? '0'),
  comments: String(post.comments ?? '0'),
});

export const REDDIT_COMMUNITIES = REDDIT_COMMUNITY_DEFAULTS.map((c) => ({
  ...c,
  icon: pickCommunityAvatar(c.id || c.name) ?? (c.icon ? asset(c.icon) : undefined),
  spotlightImage: c.spotlightImage ? asset(c.spotlightImage) : undefined,
}));

const typedDefaults = defaults as typeof defaults & {
  user: typeof defaults.user & { bio?: string };
  posts?: Record<string, any>;
  comments?: Record<string, Comment>;
};

const username = String(typedDefaults.user.username || 'Embarrassed_Fee8630');

export const REDDIT_CONFIG = {
  user: {
    ...typedDefaults.user,
    avatar: getUserAvatar(username) ?? '',
    bio: typedDefaults.user.bio ?? '',
    bannerImage: '',
  },
  posts: Object.fromEntries(
    Object.entries(typedDefaults.posts ?? {}).map(([id, post]) => [id, processUserPost(post, username)]),
  ) as Record<string, RedditPost>,
  comments: (typedDefaults.comments ?? {}) as Record<string, Comment>,
  chatThreads: typedDefaults.chatThreads as Record<string, any[]>,
  chatReplies: typedDefaults.chatReplies as Record<string, any[]>,
  settings: typedDefaults.settings as RedditSettings,
  assets: REDDIT_ASSETS,
};
