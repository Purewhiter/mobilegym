/**
 * Reddit on the device server.
 *
 * The catalog (`posts.json`: ~3k posts, ~16MB with their comment threads) is
 * loaded and processed once per server process and shared by every session.
 * Feed queries return posts without their comments; a post's comments are a
 * separate query, so the page never parses the whole file.
 *
 * Session state is the user's own data (votes, saves, own posts and comments,
 * chats, settings) in the same shape as before, so `__SIM__.getState().apps.reddit`
 * and every bench judge keep working unchanged. Commands are the former store
 * actions; ids of new records come from the page, as before.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AppContext, AppModule, Catalog } from '../../../device/engine';
import { mediaResolver } from '../../../device/media';
import { getUserAvatar, processPosts } from '../data/catalog';
import type { RedditUser } from '../state';
import type { Comment, RedditCommentsOverlay, RedditPost, RedditPostsOverlay, RedditSettings } from '../types';
import { collectRedditCommentDeletionIds } from '../utils/commentTree';
import {
  resolveRedditComment,
  resolveRedditComments,
  resolveRedditPost,
  resolveRedditPosts,
  searchRedditPosts,
} from '../utils/view';

export type ChatMessage = {
  id: string;
  from: 'me' | 'them';
  body: string;
  created_utc: number;
};

export interface RedditDeviceState {
  user: RedditUser;
  posts: RedditPostsOverlay;
  comments: RedditCommentsOverlay;
  chatThreads: Record<string, ChatMessage[]>;
  chatReplies: Record<string, ChatMessage[]>;
  settings: RedditSettings;
}

type Ctx = AppContext<RedditDeviceState>;

export const REDDIT_STATE_KEYS = [
  'user', 'posts', 'comments', 'chatThreads', 'chatReplies', 'settings',
] as const satisfies readonly (keyof RedditDeviceState)[];

const DEFAULT_USERNAME = 'Embarrassed_Fee8630';

// ── Catalog ─────────────────────────────────────────────────────────

interface RedditCatalogExtras {
  /** Feed order, without `commentsData`. */
  posts: RedditPost[];
  postsById: Map<string, RedditPost>;
  /** Post ids in `posts.json` order (before feed interleaving). */
  fileOrder: string[];
  /** Fixture comments per post, with `postId` filled in. */
  commentsByPost: Map<string, Comment[]>;
  commentById: Map<string, Comment>;
}

const APP_ASSETS = '/@app-assets/';

/** `/@app-assets/...` → the same URL under the deployment base (the page bundle gets this rewrite at build time). */
const rebase = (url: string | undefined, appAssetsBase: string) =>
  (url?.startsWith(APP_ASSETS) ? appAssetsBase + url.slice(APP_ASSETS.length) : url);

function loadCatalog(root: string, appAssetsBase: string, cdnBase: string): Catalog {
  const dataDir = join(root, 'apps', 'Reddit', 'data');
  const raw = (JSON.parse(readFileSync(join(dataDir, 'posts.json'), 'utf8')) as { posts: any[] }).posts;
  const localImage = mediaResolver(join(dataDir, 'media.json'), `${cdnBase}/reddit/media`);

  const commentsByPost = new Map<string, Comment[]>();
  const commentById = new Map<string, Comment>();
  const posts = processPosts(raw).map(({ commentsData, ...post }) => {
    const id = String(post.id);
    const comments = (Array.isArray(commentsData) ? commentsData : []).map((c) => ({ ...c, postId: id }) as Comment);
    commentsByPost.set(id, comments);
    for (const comment of comments) commentById.set(String(comment.id), comment);
    return {
      ...post,
      image: localImage(post.image),
      images: post.images?.map((url) => localImage(url)!),
      authorAvatar: rebase(post.authorAvatar, appAssetsBase),
      subredditIcon: rebase(post.subredditIcon, appAssetsBase),
    } as RedditPost;
  });

  const extras: RedditCatalogExtras = {
    posts,
    postsById: new Map(posts.map((post) => [String(post.id), post])),
    fileOrder: raw.map((post) => String(post.id)),
    commentsByPost,
    commentById,
  };
  return { collections: new Map(), extras: extras as unknown as Record<string, unknown> };
}

const extras = (ctx: Ctx) => ctx.catalog.extras as unknown as RedditCatalogExtras;

// ── Commands (one per store action) ─────────────────────────────────

const MAX_OWN_COMMENTS_PER_POST = 50;
const MAX_OWN_COMMENTS = 300;

const toggleId = (list: string[], id: string): string[] =>
  (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);

const nowSec = (now: number) => Math.floor(now / 1000);

const username = (ctx: Ctx) => ctx.state.user.username || DEFAULT_USERNAME;

function patch(ctx: Ctx, next: Partial<RedditDeviceState>): void {
  ctx.state = { ...ctx.state, ...next };
}

function toggleVote(votes: Record<string, 'up' | 'down'>, key: string, dir: 'up' | 'down') {
  const next = { ...votes };
  if (next[key] === dir) delete next[key];
  else next[key] = dir;
  return next;
}

/** Keep at most 50 own comments per post and 300 in all, dropping the oldest. */
function trimOwnComments(ctx: Ctx): void {
  const { comments, user } = ctx.state;
  const own = user.commentIds.map((id) => comments[id]).filter((c): c is Comment => Boolean(c));
  const remove = new Set<string>();

  const byPost: Record<string, Comment[]> = {};
  for (const comment of own) (byPost[comment.postId] ??= []).push(comment);
  for (const list of Object.values(byPost)) {
    list.sort((a, b) => (a.created_utc ?? 0) - (b.created_utc ?? 0));
    for (const comment of list.slice(0, Math.max(0, list.length - MAX_OWN_COMMENTS_PER_POST))) remove.add(comment.id);
  }
  const remaining = own
    .filter((comment) => !remove.has(comment.id))
    .sort((a, b) => (a.created_utc ?? 0) - (b.created_utc ?? 0));
  for (const comment of remaining.slice(0, Math.max(0, remaining.length - MAX_OWN_COMMENTS))) remove.add(comment.id);
  if (remove.size === 0) return;

  const nextComments = { ...comments };
  for (const id of remove) delete nextComments[id];
  patch(ctx, {
    comments: nextComments,
    user: { ...user, commentIds: user.commentIds.filter((id) => !remove.has(id)) },
  });
}

function addOwnComment(ctx: Ctx, comment: Comment): void {
  const { comments, user } = ctx.state;
  patch(ctx, {
    comments: { ...comments, [comment.id]: comment },
    user: { ...user, commentIds: [...user.commentIds, comment.id] },
  });
  trimOwnComments(ctx);
}

const chatList = (value: unknown): ChatMessage[] => (Array.isArray(value) ? value : []);

function createCommands(appAssetsBase: string): AppModule<RedditDeviceState>['commands'] {
  return {
  updateSettings(ctx, [settingsPatch]) {
    patch(ctx, { settings: { ...ctx.state.settings, ...(settingsPatch as Partial<RedditSettings>) } });
  },

  votePost(ctx, [postId, dir]) {
    const user = ctx.state.user;
    patch(ctx, { user: { ...user, postVotes: toggleVote(user.postVotes, String(postId), dir as 'up' | 'down') } });
  },

  voteComment(ctx, [commentKey, dir]) {
    const user = ctx.state.user;
    patch(ctx, { user: { ...user, commentVotes: toggleVote(user.commentVotes, String(commentKey), dir as 'up' | 'down') } });
  },

  toggleSave(ctx, [postId]) {
    const user = ctx.state.user;
    patch(ctx, { user: { ...user, savedPostIds: toggleId(user.savedPostIds, String(postId)) } });
  },

  toggleJoin(ctx, [communityId]) {
    const user = ctx.state.user;
    patch(ctx, { user: { ...user, joinedCommunityIds: toggleId(user.joinedCommunityIds, String(communityId)) } });
  },

  addComment(ctx, [postId, body, id], { now }) {
    const trimmed = String(body ?? '').trim();
    if (!trimmed) return;
    addOwnComment(ctx, {
      id: String(id),
      postId: String(postId),
      author: username(ctx),
      body: trimmed,
      score: 1,
      created_utc: nowSec(now),
    });
  },

  addReplyComment(ctx, [postId, parentCommentId, body, id], { now }) {
    const trimmed = String(body ?? '').trim();
    if (!trimmed) return;
    addOwnComment(ctx, {
      id: String(id),
      postId: String(postId),
      author: username(ctx),
      body: trimmed,
      score: 1,
      created_utc: nowSec(now),
      parentId: String(parentCommentId),
    });
  },

  editComment(ctx, [commentId, body]) {
    const id = String(commentId);
    const trimmed = String(body ?? '').trim();
    const current = ctx.state.comments[id];
    if (!trimmed || !current || !ctx.state.user.commentIds.includes(id)) return;
    patch(ctx, { comments: { ...ctx.state.comments, [id]: { ...current, body: trimmed } } });
  },

  deleteOwnComment(ctx, [commentId]) {
    const id = String(commentId);
    const { comments, user } = ctx.state;
    if (!user.commentIds.includes(id) || !comments[id]) return;
    const toDelete = new Set(collectRedditCommentDeletionIds(comments, id, String(username(ctx))));
    if (toDelete.size === 0) return;
    const rest = { ...comments };
    const commentVotes = { ...user.commentVotes };
    for (const deleted of toDelete) {
      const item = comments[deleted];
      if (item?.postId) delete commentVotes[`${item.postId}:${deleted}`];
      delete rest[deleted];
    }
    patch(ctx, {
      comments: rest,
      user: { ...user, commentIds: user.commentIds.filter((c) => !toDelete.has(c)), commentVotes },
    });
  },

  deleteOwnPost(ctx, [postId]) {
    const id = String(postId);
    const { posts, user } = ctx.state;
    if (!user.postIds.includes(id)) return;
    const { [id]: _deleted, ...rest } = posts;
    patch(ctx, { posts: rest, user: { ...user, postIds: user.postIds.filter((p) => p !== id) } });
  },

  updateOwnPost(ctx, [postId, postPatch]) {
    const id = String(postId);
    const current = ctx.state.posts[id];
    if (!current || !ctx.state.user.postIds.includes(id)) return;
    patch(ctx, { posts: { ...ctx.state.posts, [id]: { ...current, ...(postPatch as Partial<RedditPost>) } } });
  },

  createPost(ctx, [post]) {
    const created = post as RedditPost;
    const user = ctx.state.user;
    patch(ctx, {
      posts: { ...ctx.state.posts, [created.id]: created },
      user: {
        ...user,
        postIds: [...user.postIds, created.id],
        postVotes: { ...user.postVotes, [created.id]: 'up' },
      },
    });
  },

  saveProfile(ctx, [params]) {
    const { username: name, bio, bannerImage, avatarImage } = params as {
      username: string; bio: string; bannerImage: string; avatarImage: string;
    };
    const { user, posts, comments } = ctx.state;
    const oldUsername = user.username;
    const newUsername = String(name ?? '').trim();
    const renamed = <T extends { author?: string } | null>(item: T): T =>
      (item && item.author === oldUsername ? { ...item, author: newUsername } : item);

    patch(ctx, {
      user: {
        ...user,
        username: newUsername,
        avatar: avatarImage || rebase(getUserAvatar(newUsername), appAssetsBase) || user.avatar,
        bio: String(bio ?? '').trim(),
        bannerImage: bannerImage || user.bannerImage || '',
      },
      posts: Object.fromEntries(Object.entries(posts).map(([id, post]) => [id, renamed(post)])),
      comments: Object.fromEntries(Object.entries(comments).map(([id, comment]) => [id, renamed(comment)])),
    });
  },

  seedChatThread(ctx, [name, seedBody], { now }) {
    const key = String(name);
    if (chatList(ctx.state.chatThreads[key]).length > 0) return;
    patch(ctx, {
      chatThreads: {
        ...ctx.state.chatThreads,
        [key]: [{ id: `seed_${key}`, from: 'me', body: String(seedBody), created_utc: nowSec(now) - 86400 }],
      },
    });
  },

  sendChatMessage(ctx, [name, body, id], { now }) {
    const key = String(name);
    const trimmed = String(body ?? '').trim();
    if (!trimmed) return;
    const message: ChatMessage = { id: String(id), from: 'me', body: trimmed, created_utc: nowSec(now) };
    patch(ctx, {
      chatThreads: { ...ctx.state.chatThreads, [key]: [...chatList(ctx.state.chatThreads[key]), message] },
    });
  },

  deleteChatMessage(ctx, [name, messageId]) {
    const key = String(name);
    patch(ctx, {
      chatThreads: {
        ...ctx.state.chatThreads,
        [key]: chatList(ctx.state.chatThreads[key]).filter((m) => String(m.id) !== String(messageId)),
      },
    });
  },

  sendChatReply(ctx, [name, messageId, body, id], { now }) {
    const trimmed = String(body ?? '').trim();
    if (!trimmed) return;
    const key = `${name}:${messageId}`;
    const replies = ctx.state.chatReplies ?? {};
    const reply: ChatMessage = { id: String(id), from: 'me', body: trimmed, created_utc: nowSec(now) };
    patch(ctx, { chatReplies: { ...replies, [key]: [...chatList(replies[key]), reply] } });
  },
  };
}

// ── Queries ─────────────────────────────────────────────────────────

const catalogComment = (ctx: Ctx, id: string, postId?: string): Comment | undefined => (
  postId === undefined
    ? extras(ctx).commentById.get(id)
    : extras(ctx).commentsByPost.get(postId)?.find((comment) => String(comment.id) === id)
);

const optionalId = (value: unknown) => (value === undefined || value === null ? undefined : String(value));

const viewPosts = (ctx: Ctx) =>
  resolveRedditPosts(extras(ctx).posts, ctx.state.posts ?? {}, ctx.state.user?.postIds ?? []);

const queries: AppModule<RedditDeviceState>['queries'] = {
  // What the pages show: the feed a page at a time, search hits, posts by id.
  feedPage(ctx, args) {
    const posts = viewPosts(ctx);
    const offset = Math.max(0, Number(args.offset ?? 0) || 0);
    const limit = Math.max(0, Number(args.limit ?? 20) || 0);
    return { posts: posts.slice(offset, offset + limit), total: posts.length };
  },
  searchPosts(ctx, args) {
    return searchRedditPosts(viewPosts(ctx), String(args.query ?? ''), Number(args.limit ?? 50) || 50);
  },
  viewPostsByIds(ctx, args) {
    const byId = extras(ctx).postsById;
    const out: Record<string, RedditPost> = {};
    for (const id of Array.isArray(args.ids) ? args.ids.map(String) : []) {
      const post = resolveRedditPost(ctx.state.posts ?? {}, byId, id);
      if (post) out[id] = post;
    }
    return out;
  },

  // Catalog merged with this session's state (judges and samplers), through
  // the same functions as the page hooks.
  viewPosts,
  viewPost(ctx, args) {
    return resolveRedditPost(ctx.state.posts ?? {}, extras(ctx).postsById, String(args.id ?? ''));
  },
  viewComments(ctx, args) {
    const postId = String(args.postId ?? '');
    return resolveRedditComments(extras(ctx).commentsByPost.get(postId) ?? [], ctx.state.comments ?? {}, postId);
  },
  /** A comment by id; with `postId`, catalog comments of that post only. */
  viewComment(ctx, args) {
    const id = String(args.id ?? '');
    return resolveRedditComment(ctx.state.comments ?? {}, catalogComment(ctx, id, optionalId(args.postId)), id);
  },

  // Catalog only.
  catalogPost(ctx, args) {
    return extras(ctx).postsById.get(String(args.id ?? '')) ?? null;
  },
  catalogComment(ctx, args) {
    return catalogComment(ctx, String(args.id ?? ''), optionalId(args.postId)) ?? null;
  },
  /** Catalog post ids in feed order, or in `posts.json` order with `order: 'file'`. */
  catalogPostIds(ctx, args) {
    return args.order === 'file' ? extras(ctx).fileOrder : extras(ctx).posts.map((post) => String(post.id));
  },

  /** A catalog post's own comments (with `postId`). */
  postComments(ctx, args) {
    return extras(ctx).commentsByPost.get(String(args.postId ?? '')) ?? [];
  },

  /** Catalog comments by id, for showing what the user replied to. */
  commentsByIds(ctx, args) {
    const ids = Array.isArray(args.ids) ? args.ids.map(String) : [];
    const out: Record<string, Comment> = {};
    for (const id of ids) {
      const comment = extras(ctx).commentById.get(id);
      if (comment) out[id] = comment;
    }
    return out;
  },
};

export function createRedditModule(options: { appAssetsBase: string; cdnBase: string }): AppModule<RedditDeviceState> {
  return {
    appId: 'reddit',
    loadCatalog: root => loadCatalog(root, options.appAssetsBase, options.cdnBase),
    materialize() {},
    exportState: ctx => ctx.state,
    importState(raw) {
      if (!raw || typeof raw !== 'object') throw new Error('reddit state must be an object');
      const source = raw as Record<string, unknown>;
      const state: Record<string, unknown> = {};
      for (const key of REDDIT_STATE_KEYS) state[key] = source[key];
      return state as unknown as RedditDeviceState;
    },
    commands: createCommands(options.appAssetsBase),
    queries,
  };
}
