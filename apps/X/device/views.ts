/**
 * X view queries: what each page shows, assembled on the device server so the
 * page fetches tens of posts instead of the whole 15k-post catalog.
 *
 * Each query is the server side of one hook in `apps/X/data/view.ts` and runs
 * the same pure functions (`utils/hydrate.ts`). Results carry raw times; the
 * page fills in display times (its clock and locale) and passes the "just now"
 * label for retweet shells.
 */

import type { AppContext } from '../../../device/engine';
import type { XPost, XUser } from '../types';
import {
  buildPostIndex,
  hydratePost,
  hydrateReplyTree,
  mergeLocalPosts,
  resolveReplyById,
  type XRuntimeMeSlice,
} from '../utils/hydrate';
import type { XDeviceState } from './index';

type Ctx = AppContext<XDeviceState>;

export interface XViewCatalog {
  users: Record<string, XUser>;
  posts: XPost[];
  replies: Record<string, XPost[]>;
}

const HYDRATED_FOR_YOU_LIMIT = 200;
const HYDRATED_FOLLOWING_LIMIT = 100;

interface Derived {
  users: Record<string, XUser>;
  postIndex: Map<string, XPost>;
  localPosts: Map<string, XPost[]>;
}

// Per state object: commands replace the state, so a new state gets new views.
const derivedByState = new WeakMap<object, Derived>();

function meSlice(state: XDeviceState): XRuntimeMeSlice {
  const user = state.user;
  return {
    id: user?.id ?? '',
    likedPostIds: user?.likedPostIds ?? [],
    retweetedPostIds: user?.retweetedPostIds ?? [],
    followedUserIds: user?.followedUserIds ?? [],
    followerUserIds: user?.followerUserIds ?? [],
  };
}

/** The current user as a user-table entry (what the page's profile header shows). */
function meUserEntry(state: XDeviceState): XUser {
  const u = state.user;
  return {
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    banner: u.banner,
    verified: u.verified,
    bio: u.bio,
    location: u.location,
    website: u.website,
    birthDate: u.birthDate,
    joinDate: u.joinDate,
    restId: u.restId,
    following: (u.followedUserIds ?? []).length,
    followers: (u.followerUserIds ?? []).length,
  } as XUser;
}

function derived(ctx: Ctx, catalog: XViewCatalog): Derived {
  let d = derivedByState.get(ctx.state);
  if (!d) {
    const users = ctx.state.user?.id
      ? { ...catalog.users, [ctx.state.user.id]: meUserEntry(ctx.state) }
      : catalog.users;
    d = { users, postIndex: buildPostIndex(catalog.posts, ctx.state.posts), localPosts: new Map() };
    derivedByState.set(ctx.state, d);
  }
  return d;
}

/** Catalog + session posts with the user's own likes/retweets/replies counted, retweet shells first. */
function localPosts(ctx: Ctx, catalog: XViewCatalog, justNow: string): XPost[] {
  const d = derived(ctx, catalog);
  let posts = d.localPosts.get(justNow);
  if (!posts) {
    posts = mergeLocalPosts(ctx.state.posts, meSlice(ctx.state), catalog.posts, justNow);
    d.localPosts.set(justNow, posts);
  }
  return posts;
}

const str = (value: unknown) => String(value ?? '');
const limitOf = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

function forYou(ctx: Ctx, catalog: XViewCatalog, justNow: string): any[] {
  const { users, postIndex } = derived(ctx, catalog);
  return localPosts(ctx, catalog, justNow)
    .slice(0, HYDRATED_FOR_YOU_LIMIT)
    .map((p) => hydratePost(p, users, postIndex));
}

function following(ctx: Ctx, catalog: XViewCatalog, justNow: string, includeMe: boolean): any[] {
  const { users, postIndex } = derived(ctx, catalog);
  const followSet = new Set(ctx.state.user?.followedUserIds ?? []);
  if (includeMe && ctx.state.user?.id) followSet.add(ctx.state.user.id);
  return localPosts(ctx, catalog, justNow)
    .filter((p) => followSet.has(p.authorId))
    .slice(0, HYDRATED_FOLLOWING_LIMIT)
    .map((p) => hydratePost(p, users, postIndex));
}

export function createXViewQueries(catalogOf: (ctx: Ctx) => XViewCatalog) {
  return {
    /** Home: "For you" and "Following" timelines. */
    homeTimelines(ctx: Ctx, args: Record<string, unknown>) {
      const catalog = catalogOf(ctx);
      const justNow = str(args.justNow);
      return { forYou: forYou(ctx, catalog, justNow), following: following(ctx, catalog, justNow, true) };
    },

    /** The first "For you" posts (pages that look posts up among them). */
    hydratedPosts(ctx: Ctx, args: Record<string, unknown>) {
      return forYou(ctx, catalogOf(ctx), str(args.justNow));
    },

    /** One post by id: timeline post, any indexed post, or a reply from the reply trees. */
    resolvedPost(ctx: Ctx, args: Record<string, unknown>) {
      const catalog = catalogOf(ctx);
      const id = str(args.id);
      if (!id) return null;
      const { users, postIndex } = derived(ctx, catalog);
      const local = localPosts(ctx, catalog, str(args.justNow)).find((p) => p.id === id);
      if (local) return hydratePost(local, users, postIndex);
      const indexed = postIndex.get(id);
      if (indexed) return hydratePost(indexed, users, postIndex);
      return resolveReplyById(catalog.replies, id, users);
    },

    /** Timeline posts replying to `id` (the user's own replies; raw, as the timeline holds them). */
    threadPosts(ctx: Ctx, args: Record<string, unknown>) {
      const id = str(args.id);
      return localPosts(ctx, catalogOf(ctx), str(args.justNow)).filter((p) => p.threadId === id);
    },

    userProfilePosts(ctx: Ctx, args: Record<string, unknown>) {
      const catalog = catalogOf(ctx);
      const userId = str(args.userId);
      if (!userId) return [];
      const limit = limitOf(args.limit, 80);
      const { users, postIndex } = derived(ctx, catalog);
      const out: XPost[] = [];
      for (const p of localPosts(ctx, catalog, str(args.justNow))) {
        if (p.authorId !== userId) continue;
        out.push(p);
        if (out.length >= limit) break;
      }
      return out.map((p) => hydratePost(p, users, postIndex));
    },

    /** Posts whose text, author name or handle contains the query (case-insensitive). */
    searchPosts(ctx: Ctx, args: Record<string, unknown>) {
      const catalog = catalogOf(ctx);
      const q = str(args.query).trim().toLowerCase().replace(/\s+/g, ' ').replace(/^@/, '');
      if (!q) return [];
      const limit = limitOf(args.limit, 1000);
      const { users, postIndex } = derived(ctx, catalog);
      const hits: XPost[] = [];
      for (const p of localPosts(ctx, catalog, str(args.justNow))) {
        const content = (p.content || '').toLowerCase().replace(/\s+/g, ' ');
        const author = users[p.authorId];
        const name = (author?.name || '').toLowerCase();
        const handle = (author?.id || '').toLowerCase();
        if (content.includes(q) || name.includes(q) || handle.includes(q)) {
          hits.push(p);
          if (hits.length >= limit) break;
        }
      }
      return hits.map((p) => hydratePost(p, users, postIndex));
    },

    /** Users by id (the current user included). */
    usersByIds(ctx: Ctx, args: Record<string, unknown>) {
      const { users } = derived(ctx, catalogOf(ctx));
      const out: Record<string, XUser> = {};
      for (const id of Array.isArray(args.ids) ? args.ids.map(String) : []) {
        if (users[id]) out[id] = users[id];
      }
      return out;
    },

    /** People search: name, handle or rest id contains the (lowercased) query; best 20. */
    matchUsers(ctx: Ctx, args: Record<string, unknown>) {
      const query = str(args.query);
      if (!query) return [];
      const normalizedQuery = query.replace(/^@/, '');
      const scored: Array<{ user: XUser; score: number }> = [];
      for (const user of Object.values(derived(ctx, catalogOf(ctx)).users)) {
        const name = (user.name || '').toLowerCase();
        const id = (user.id || '').toLowerCase();
        const restId = (str((user as any).restId)).toLowerCase();
        const hit = name.includes(query) || id.includes(normalizedQuery) || restId.includes(query);
        if (!hit) continue;
        const exactId = id === normalizedQuery;
        const starts = id.startsWith(normalizedQuery) || name.startsWith(query);
        scored.push({ user, score: (exactId ? 300 : 0) + (starts ? 50 : 0) });
      }
      scored.sort((a, b) => b.score - a.score || (b.user.followers ?? 0) - (a.user.followers ?? 0));
      return scored.slice(0, 20).map((item) => item.user);
    },

    /**
     * Following / followers list of `id`. Other users' lists are simulated as
     * fixed slices of the user table; the current user's following list is real.
     */
    connections(ctx: Ctx, args: Record<string, unknown>) {
      const { users } = derived(ctx, catalogOf(ctx));
      const id = str(args.id);
      if (!id) return [];
      const meId = ctx.state.user?.id ?? '';
      const followedSet = new Set(ctx.state.user?.followedUserIds ?? []);
      const all = Object.values(users);
      if (args.type === 'following') {
        return id === meId ? all.filter((item) => followedSet.has(item.id)) : all.slice(0, 15);
      }
      if (id === meId) return all.slice(5, 20);
      const simulated = all.slice(10, 25);
      if (followedSet.has(id)) {
        const me = users[meId];
        if (me && !simulated.find((item) => item.id === me.id)) simulated.unshift(me);
      } else {
        const index = simulated.findIndex((item) => item.id === meId);
        if (index !== -1) simulated.splice(index, 1);
      }
      return simulated;
    },

    /** Reply trees under a post, with authors from the catalog user table. */
    repliesForPost(ctx: Ctx, args: Record<string, unknown>) {
      const catalog = catalogOf(ctx);
      const raw = catalog.replies[str(args.postId)];
      return Array.isArray(raw) ? raw.map((r) => hydrateReplyTree(r, catalog.users)) : [];
    },

    /** A user's replies across reply trees, each with its parent post when it is on a timeline. */
    userReplies(ctx: Ctx, args: Record<string, unknown>) {
      const catalog = catalogOf(ctx);
      const userId = str(args.userId);
      if (!userId) return [];
      const limit = limitOf(args.limit, 80);
      const justNow = str(args.justNow);
      const parents = new Map<string, any>();
      for (const p of forYou(ctx, catalog, justNow)) parents.set(p.id, p);
      for (const p of following(ctx, catalog, justNow, false)) if (!parents.has(p.id)) parents.set(p.id, p);
      const { users } = derived(ctx, catalog);
      const items: Array<{ reply: XPost; parent?: any }> = [];
      outer: for (const [parentId, replies] of Object.entries(catalog.replies)) {
        if (!Array.isArray(replies)) continue;
        for (const r of replies) {
          if (!r || r.authorId !== userId) continue;
          items.push({ reply: hydrateReplyTree(r, users), parent: parents.get(parentId) });
          if (items.length >= limit) break outer;
        }
      }
      return items;
    },
  };
}
