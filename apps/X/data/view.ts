/**
 * X view layer: the device server assembles each page's posts and users
 * (`apps/X/device/views.ts`, one query per hook here); the page fetches only
 * what it shows instead of the whole catalog.
 *
 * Display times follow this page's clock and locale, so the server returns raw
 * times: hooks fill them in (`withDisplayTimes`) and pass the "just now" label
 * used by retweet shells. Results refresh when the X session's state changes.
 */
import { useMemo } from 'react';

import { useDeviceQuery } from '../../../os/device/deviceStore';
import { getJustNowLabel, normalizeXPostTemporalFields } from '../utils/formatTime';
import { conversations as baseConversations, notifications as baseNotifications, searchHistory as baseSearchHistory, currentUser } from './';
import { useXStore, type XStore } from '../state';
import type { XMessage, XPost, XUser } from '../types';

const EMPTY: any[] = Object.freeze([]) as unknown as any[];
const EMPTY_USERS = Object.freeze({}) as Record<string, XUser>;

/** Display times on a hydrated post and everything nested in it (quoted, retweeted, replies). */
function withDisplayTimes<T>(post: T): T {
  if (!post || typeof post !== 'object') return post;
  const p = post as any;
  const out: any = normalizeXPostTemporalFields(p);
  if (p.quotedPost) out.quotedPost = withDisplayTimes(p.quotedPost);
  if (p.retweetedPost) out.retweetedPost = withDisplayTimes(p.retweetedPost);
  if (Array.isArray(p.replies)) out.replies = p.replies.map(withDisplayTimes);
  return out;
}

const timed = new WeakMap<object, any>();

/** `withDisplayTimes` over a query result, once per result object. */
function useTimed<T extends object>(data: T | undefined, map: (data: T) => any): any {
  return useMemo(() => {
    if (!data) return undefined;
    let out = timed.get(data);
    if (!out) timed.set(data, (out = map(data)));
    return out;
  }, [data, map]);
}

const timeList = (list: any[]) => list.map(withDisplayTimes);

/** A view query; `keepPrevious` keeps the last answer on screen while new args load (typing). */
function useXView<T>(name: string, args: Record<string, unknown>, enabled = true, keepPrevious = false) {
  return useDeviceQuery<T>('x', name, args, enabled, { keepPrevious });
}

// ---- Users ----

/** Users by id (the current user included). */
export function useXUsers(ids: string[]): Record<string, XUser> {
  const key = useMemo(() => [...new Set(ids.filter(Boolean))].sort(), [ids]);
  const { data } = useXView<Record<string, XUser>>('usersByIds', { ids: key }, key.length > 0, true);
  return data ?? EMPTY_USERS;
}

/** One user; `loading` until the first answer for this id. */
export function useXUserQuery(id: string): { user: XUser | undefined; loading: boolean } {
  const { data, loading } = useXView<Record<string, XUser>>('usersByIds', { ids: id ? [id] : [] }, Boolean(id));
  return { user: id ? data?.[id] : undefined, loading: Boolean(id) && loading && data === undefined };
}

export function useXUser(id: string): XUser | undefined {
  return useXUserQuery(id).user;
}

/** People search (`query` already lowercased and trimmed). */
export function useXMatchUsers(query: string): XUser[] {
  const { data } = useXView<XUser[]>('matchUsers', { query }, Boolean(query), true);
  return query ? data ?? EMPTY : EMPTY;
}

/** Following / followers list shown on a profile. */
export function useXConnections(id: string, type: 'following' | 'followers'): XUser[] {
  const { data } = useXView<XUser[]>('connections', { id, type }, Boolean(id));
  return data ?? EMPTY;
}

// ---- Timelines ----

const justNowArgs = () => ({ justNow: getJustNowLabel() });

export function useXHydratedPosts(): any[] {
  const { data } = useXView<any[]>('hydratedPosts', justNowArgs());
  return useTimed(data, timeList) ?? EMPTY;
}

/** Home: "For you" + "Following". */
export function useXHomeTimelines(): { forYou: any[]; following: any[] } {
  const { data } = useXView<{ forYou: any[]; following: any[] }>('homeTimelines', justNowArgs());
  const mapTimelines = useMemo(
    () => (d: { forYou: any[]; following: any[] }) => ({ forYou: timeList(d.forYou), following: timeList(d.following) }),
    [],
  );
  return useTimed(data, mapTimelines) ?? { forYou: EMPTY, following: EMPTY };
}

// ---- Single-post resolvers ----

/** One post by id (timeline post, indexed post, or a reply); `loading` until the first answer. */
export function useXResolvedPostQuery(postId: string): { post: any | null; loading: boolean } {
  const { data, loading } = useXView<any | null>('resolvedPost', { id: postId, ...justNowArgs() }, Boolean(postId));
  const post = useTimed(data ?? undefined, withDisplayTimes);
  return { post: postId ? post ?? null : null, loading: Boolean(postId) && loading && data === undefined };
}

export function useXResolvedPost(postId: string): any | null {
  return useXResolvedPostQuery(postId).post;
}

/** The user's own replies to `postId` on the timeline (raw posts, as the timeline holds them). */
export function useXThreadPosts(postId: string): XPost[] {
  const { data } = useXView<XPost[]>('threadPosts', { id: postId, ...justNowArgs() }, Boolean(postId));
  return postId ? data ?? EMPTY : EMPTY;
}

export function useXUserProfilePosts(userId: string, limit = 80): any[] {
  const { data } = useXView<any[]>('userProfilePosts', { userId, limit, ...justNowArgs() }, Boolean(userId));
  const posts = useTimed(data, timeList);
  return userId ? posts ?? EMPTY : EMPTY;
}

/**
 * 用户输入搜索 — case-insensitive fuzzy match 是合法例外,
 * id 也走 lowercase 让 "openai" 匹中 id=OpenAI。
 */
export function useXSearchPosts(query: string, limit = 1000): any[] {
  const q = query.trim();
  const { data } = useXView<any[]>('searchPosts', { query: q, limit, ...justNowArgs() }, Boolean(q), true);
  const posts = useTimed(data, timeList);
  return q ? posts ?? EMPTY : EMPTY;
}

// ---- Notifications / Conversations / Search history ----

export function useXNotifications(): any[] {
  const users = useXUsers(useMemo(() => baseNotifications.map((n: any) => String(n.actorId)), []));
  return useMemo(
    () =>
      baseNotifications.map((n: any) => {
        const actor = users[n.actorId];
        return {
          ...n,
          actor: {
            id: actor?.id ?? n.actorId,
            name: actor?.name || 'Unknown',
            avatar: actor?.avatar,
          },
        };
      }),
    [users],
  );
}

export function useXMentionNotifications(): any[] {
  const notifications = useXNotifications();
  return useMemo(() => notifications.filter((n) => n.type === 'mention'), [notifications]);
}

const selectConversationsSlice = (s: XStore) => s.conversations;

export function useXConversations(): any[] {
  const conversations = useXStore(selectConversationsSlice);
  const list = conversations.length > 0 ? conversations : baseConversations;
  const users = useXUsers(useMemo(() => list.map((c) => c.participantId), [list]));
  return useMemo(() => {
    return list.map((c) => {
      const participant = users[c.participantId];
      const lastMsg = c.messages[c.messages.length - 1];
      return {
        ...c,
        participant: {
          id: participant?.id ?? c.participantId,
          name: participant?.name || 'Unknown',
          avatar: participant?.avatar,
          verified: participant?.verified,
        },
        lastMessage: {
          ...lastMsg,
          senderUserId: lastMsg.senderId,
          isMe: lastMsg.senderId === currentUser.id,
        },
        messages: c.messages.map((m: XMessage & { isMe?: boolean }) => ({
          ...m,
          senderUserId: m.senderId,
          isMe: m.senderId === currentUser.id,
        })),
      };
    });
  }, [list, users]);
}

export function useXRecentSearches(): any[] {
  const users = useXUsers(useMemo(
    () => baseSearchHistory.filter((h: any) => h.type === 'user' && h.userId).map((h: any) => String(h.userId)),
    [],
  ));
  return useMemo(
    () =>
      baseSearchHistory.map((h: any) => {
        if (h.type === 'user' && h.userId) {
          return { ...h, user: users[String(h.userId)] };
        }
        return h;
      }),
    [users],
  );
}

// ---- Replies ----

/** Reply trees under a post; `loading` until the first answer for this post. */
export function useXRepliesForPost(postId: string): { replies: XPost[]; loading: boolean } {
  const { data, loading } = useDeviceQuery<XPost[]>('x', 'repliesForPost', { postId }, Boolean(postId), { catalog: true });
  const replies = useTimed(data, timeList);
  return { replies: postId ? replies ?? EMPTY : EMPTY, loading: Boolean(postId) && loading && !data };
}

/**
 * 用户 profile -> Replies tab: 该 user 在所有 replies 树里的回复,
 * 同时附上 hydrated parent post (从 timeline / 关注流里查).
 */
export function useXUserReplies(
  userId: string,
  limit = 80,
  enabled = true,
): { items: Array<{ reply: XPost; parent?: any }>; loading: boolean } {
  const on = Boolean(userId) && enabled;
  const { data, loading } = useXView<Array<{ reply: XPost; parent?: any }>>(
    'userReplies', { userId, limit, ...justNowArgs() }, on,
  );
  const mapItems = useMemo(
    () => (list: Array<{ reply: XPost; parent?: any }>) =>
      list.map((item) => ({ reply: withDisplayTimes(item.reply), parent: withDisplayTimes(item.parent) })),
    [],
  );
  const items = useTimed(data, mapItems);
  return { items: on ? items ?? EMPTY : EMPTY, loading: on && loading && !data };
}
