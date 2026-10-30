/**
 * RedBook read hooks.
 *
 * Notes and users come from the device server (apps/RedBook/device), already
 * merged with this session's likes, collects, follows and comments — pages
 * render them as-is. Each hook re-queries when RedBook data changes.
 *
 * Note cards need their author; every notes query also returns the authors of
 * its notes, which prime a shared user cache read by `useRedBookAuthor`.
 * Authors missing from the cache are fetched in one batched request.
 */

import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { DeviceClient } from '../../../os/device/DeviceClient';
import { subscribeDeviceData, useDeviceQuery } from '../../../os/device/deviceStore';
import { useRedBookStore } from '../state';
import type { Note, User } from '../types';

// ── Author cache ───────────────────────────────────────────────────

const userCache = new Map<string, User | null>();
const userCacheListeners = new Set<() => void>();
let userCacheVersion = 0;

function primeUsers(users: User[] | undefined): void {
  if (!users?.length) return;
  let changed = false;
  for (const user of users) {
    if (userCache.get(user.id) !== user) {
      userCache.set(user.id, user);
      changed = true;
    }
  }
  if (changed) {
    userCacheVersion += 1;
    userCacheListeners.forEach(fn => fn());
  }
}

// Any RedBook write may change an author (follow counts, tombstones): start over.
subscribeDeviceData('redbook', () => {
  if (!userCache.size) return;
  userCache.clear();
  userCacheVersion += 1;
  userCacheListeners.forEach(fn => fn());
});

const pendingUserIds = new Set<string>();
let userBatchScheduled = false;

function requestUser(id: string): void {
  if (!id || userCache.has(id) || pendingUserIds.has(id)) return;
  pendingUserIds.add(id);
  if (userBatchScheduled) return;
  userBatchScheduled = true;
  queueMicrotask(() => {
    userBatchScheduled = false;
    const ids = [...pendingUserIds];
    pendingUserIds.clear();
    void useRedBookStore.ensureSynced()
      .then(() => DeviceClient.query<User[]>('redbook', 'usersByIds', { ids }))
      .then((users) => {
        const found = new Set(users.map(u => u.id));
        for (const missing of ids) if (!found.has(missing)) userCache.set(missing, null);
        primeUsers(users);
      })
      .catch(err => console.error('[redbook] author fetch failed', err));
  });
}

const subscribeUserCache = (listener: () => void) => {
  userCacheListeners.add(listener);
  return () => {
    userCacheListeners.delete(listener);
  };
};
const getUserCacheVersion = () => userCacheVersion;

/** Author of a note card: the current user from the store, anyone else from the cache. */
export function useRedBookAuthor(authorId: string): User | undefined {
  const own = useRedBookStore(s => (s.user.id === authorId ? s.user : null));
  useSyncExternalStore(subscribeUserCache, getUserCacheVersion);
  const cached = userCache.get(authorId);
  useEffect(() => {
    if (!own && cached === undefined) requestUser(authorId);
  }, [own, cached, authorId]);
  return own ?? cached ?? undefined;
}

/** 订阅"当前用户是否点赞过该笔记"。selector 返回 boolean，仅在 flip 时重渲染。 */
export function useIsNoteLiked(noteId: string): boolean {
  return useRedBookStore(s => (s.user.likedNotes || []).includes(noteId));
}

/** 订阅"当前用户是否关注了某用户"。同上。 */
export function useIsFollowingUser(userId: string): boolean {
  return useRedBookStore(s => (s.user.followingIds || []).includes(userId));
}

// ── Note queries ───────────────────────────────────────────────────

interface NotesResult {
  items: Note[];
  authors: User[];
  total?: number;
}

const EMPTY_NOTES: Note[] = [];
const EMPTY_AUTHORS: Record<string, User> = {};

function useNotesQuery(name: string, args: Record<string, unknown>, enabled = true, keepPrevious = false) {
  const { data, loading } = useDeviceQuery<NotesResult>('redbook', name, args, enabled, { keepPrevious });
  useEffect(() => primeUsers(data?.authors), [data]);
  const authorsById = useMemo(
    () => (data ? (Object.fromEntries(data.authors.map(u => [u.id, u])) as Record<string, User>) : EMPTY_AUTHORS),
    [data],
  );
  return {
    notes: data?.items ?? EMPTY_NOTES,
    authorsById,
    total: data?.total ?? data?.items.length ?? 0,
    loading,
  };
}

export interface FeedOptions {
  /** Chinese category label (note.category); omit for every category. */
  category?: string | null;
  sort?: 'default' | 'likes';
  authorIds?: string[];
  limit?: number;
  offset?: number;
}

/**
 * A page of the feed: runtime notes first, then the catalog, with filters
 * applied. By default a growing `limit` keeps the current page visible until
 * the larger one arrives; pass `keepPrevious = false` where the list belongs
 * to a different subject per render (another user's works).
 */
export function useRedBookFeed(options: FeedOptions, enabled = true, keepPrevious = true) {
  return useNotesQuery('feed', options as Record<string, unknown>, enabled, keepPrevious);
}

/** Notes by id, in `ids` order or in feed order. */
export function useRedBookNotes(ids: string[], order: 'ids' | 'feed' = 'ids', enabled = true) {
  return useNotesQuery('notesByIds', { ids, order }, enabled && ids.length > 0);
}

export function useRedBookNote(id: string | undefined) {
  const { notes, loading } = useNotesQuery('note', { id }, Boolean(id));
  return { note: notes[0] as Note | undefined, loading };
}

export function useRedBookSearchNotes(keyword: string, sort: string) {
  return useNotesQuery('searchNotes', { keyword, sort }, Boolean(keyword));
}

// ── User queries ───────────────────────────────────────────────────

const EMPTY_USERS: User[] = [];

/** Users by id, in canonical order (current user, catalog, runtime-only). */
export function useRedBookUsers(ids: string[], enabled = true) {
  const { data, loading } = useDeviceQuery<User[]>('redbook', 'usersByIds', { ids }, enabled && ids.length > 0);
  useEffect(() => primeUsers(data), [data]);
  const users = ids.length ? (data ?? EMPTY_USERS) : EMPTY_USERS;
  const byId = useMemo(() => Object.fromEntries(users.map(u => [u.id, u])) as Record<string, User>, [users]);
  return { users, byId, loading };
}

/** One user with live counts; `null` once the server says the user does not exist. */
export function useRedBookUser(id: string | undefined) {
  const { data, loading } = useDeviceQuery<User | null>('redbook', 'user', { id }, Boolean(id));
  return { user: data, loading };
}

export function useRedBookSearchUsers(keyword: string) {
  const { data, loading } = useDeviceQuery<User[]>('redbook', 'searchUsers', { keyword }, Boolean(keyword));
  return { users: data ?? EMPTY_USERS, loading };
}
