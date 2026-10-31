/**
 * X on the device server.
 *
 * The base dataset (users, posts, reply trees: ~16MB of JSON) is loaded once
 * per server process and shared by every session. It is read-only; display
 * times depend on the page's clock and locale, so posts go out raw and the
 * page formats them.
 *
 * Session state is the user's own data (`user`, runtime `posts` overlay,
 * `conversations`, `settings`) in the same shape as before, so
 * `__SIM__.getState().apps.x` and every bench judge keep working unchanged.
 * Commands are the former store actions; new posts, replies and messages are
 * built on the page (ids and "just now" labels come from its clock), as before.
 * Pages read assembled views (`./views.ts`), never the whole catalog; the
 * `view*` queries below give judges and samplers the merged posts and users.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { AppContext, AppModule, Catalog } from '../../../device/engine';
import { mapStrings, mediaResolver } from '../../../device/media';
import type { XMeUser } from '../state';
import type { XConversation, XMessage, XPost, XSettings, XUser } from '../types';
import { createXViewQueries } from './views';
import {
  resolveXRuntimePost,
  resolveXRuntimePosts,
  runtimeCommentCounts,
  withRelationshipDerivedStats,
  type XRuntimeMeSlice,
  type XRuntimePostTable,
} from '../utils/runtimePostResolver';

export interface XDeviceState {
  user: XMeUser;
  posts: XRuntimePostTable;
  conversations: XConversation[];
  settings: XSettings;
}

export const X_STATE_KEYS = ['user', 'posts', 'conversations', 'settings'] as const satisfies readonly (keyof XDeviceState)[];

// ── Catalog ─────────────────────────────────────────────────────────

interface XCatalogExtras {
  users: Record<string, XUser>;
  posts: XPost[];
  postsById: Map<string, XPost>;
  replies: Record<string, XPost[]>;
}

function loadCatalog(root: string, cdnBase: string): Catalog {
  const dataDir = join(root, 'apps', 'X', 'data');
  const read = <T,>(name: string) => JSON.parse(readFileSync(join(dataDir, name), 'utf8')) as T;
  // Images were mirrored to the CDN (videos were not): avatars at 128px, the rest at 1080px.
  const local = mediaResolver(join(dataDir, 'media.json'), `${cdnBase}/x/media`);
  const localize = <T,>(value: T): T => mapStrings(value, (url, key) => local(url, key === 'avatar' ? 128 : 1080)!);
  const posts = localize(read<XPost[]>('posts.json'));
  const extras: XCatalogExtras = {
    users: localize(read('users.json')),
    posts,
    postsById: new Map(posts.filter(p => p?.id).map(p => [p.id, p])),
    replies: localize(read('replies.json')),
  };
  return { collections: new Map(), extras: extras as unknown as Record<string, unknown> };
}

// ── Commands (one per store action) ─────────────────────────────────

const toggleInArray = (ids: string[], id: string): string[] =>
  (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

type ToggleList = 'likedPostIds' | 'retweetedPostIds' | 'bookmarkedPostIds' | 'followedUserIds';

const toggle = (list: ToggleList): AppModule<XDeviceState>['commands'][string] => (ctx, [id]) => {
  const user = ctx.state.user;
  ctx.state = { ...ctx.state, user: { ...user, [list]: toggleInArray(user[list], String(id)) } };
};

const commands: AppModule<XDeviceState>['commands'] = {
  toggleLike: toggle('likedPostIds'),
  toggleRetweet: toggle('retweetedPostIds'),
  toggleBookmark: toggle('bookmarkedPostIds'),
  toggleFollow: toggle('followedUserIds'),

  updateSettings(ctx, [patch]) {
    ctx.state = { ...ctx.state, settings: { ...ctx.state.settings, ...(patch as Partial<XSettings>) } };
  },

  addPost(ctx, [post]) {
    const created = post as XPost;
    const { posts, user } = ctx.state;
    ctx.state = {
      ...ctx.state,
      posts: { ...posts, [created.id]: created },
      user: { ...user, postIds: [created.id, ...user.postIds] },
    };
  },

  addReply(ctx, [reply]) {
    const created = reply as XPost;
    const { posts, user } = ctx.state;
    ctx.state = {
      ...ctx.state,
      posts: { ...posts, [created.id]: created },
      user: { ...user, replyIds: [created.id, ...user.replyIds] },
    };
  },

  sendMessage(ctx, [conversationId, message]) {
    const newMessage = message as XMessage;
    ctx.state = {
      ...ctx.state,
      conversations: ctx.state.conversations.map((conv) =>
        (conv.id === String(conversationId)
          ? { ...conv, messages: [...conv.messages, newMessage], lastMessageId: newMessage.id }
          : conv)),
    };
  },
};

// ── Queries ─────────────────────────────────────────────────────────

const extras = (ctx: { catalog: Catalog }) => ctx.catalog.extras as unknown as XCatalogExtras;

type Ctx = AppContext<XDeviceState>;

const meSlice = (ctx: Ctx): XRuntimeMeSlice => {
  const user = (ctx.state.user ?? {}) as Partial<XMeUser>;
  return {
    id: user.id ?? '',
    likedPostIds: user.likedPostIds ?? [],
    retweetedPostIds: user.retweetedPostIds ?? [],
    followedUserIds: user.followedUserIds ?? [],
    followerUserIds: user.followerUserIds ?? [],
  };
};

/**
 * Posts as the user sees them: this session's posts and edits over the
 * catalog (null hides a catalog post), with the user's own likes, retweets
 * and replies counted in. The page timeline uses the same functions.
 */
function viewPosts(ctx: Ctx): XPost[] {
  const commentCounts = runtimeCommentCounts(ctx.state.posts);
  const me = meSlice(ctx);
  return resolveXRuntimePosts(ctx.state.posts, extras(ctx).posts)
    .map(post => withRelationshipDerivedStats(post, me, commentCounts));
}

const queries: AppModule<XDeviceState>['queries'] = {
  // What each page shows (apps/X/data/view.ts).
  ...createXViewQueries((ctx) => extras(ctx)),

  // Catalog merged with this session's state (judges and samplers).
  viewPosts,
  viewPost(ctx, args) {
    const id = String(args.id ?? '');
    const post = resolveXRuntimePost(ctx.state.posts, extras(ctx).postsById, id);
    return post ? withRelationshipDerivedStats(post, meSlice(ctx), runtimeCommentCounts(ctx.state.posts)) : null;
  },
  /** Catalog users plus the current user. */
  viewUsers(ctx) {
    const me = ctx.state.user;
    return me?.id ? { ...extras(ctx).users, [me.id]: me } : extras(ctx).users;
  },
  /** Which of `ids` are catalog posts. */
  catalogPostIds(ctx, args) {
    const byId = extras(ctx).postsById;
    return (Array.isArray(args.ids) ? args.ids.map(String) : []).filter(id => byId.has(id));
  },
};

export function createXModule(options: { cdnBase: string }): AppModule<XDeviceState> {
  return {
    appId: 'x',
    loadCatalog: root => loadCatalog(root, options.cdnBase),
    materialize() {},
    exportState: ctx => ctx.state,
    importState(raw) {
      if (!raw || typeof raw !== 'object') throw new Error('x state must be an object');
      const source = raw as Record<string, unknown>;
      const state: Record<string, unknown> = {};
      for (const key of X_STATE_KEYS) state[key] = source[key];
      return state as unknown as XDeviceState;
    },
    commands,
    queries,
  };
}
