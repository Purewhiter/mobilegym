/**
 * X view 层 — base dataset 订阅 + 视图 hook。
 *
 * 设计与 RedBook (`apps/RedBook/data/view.ts`) 对齐:
 *   - base 数据(users/posts/replies)只在 loader 模块缓存里, 不进 zustand store
 *   - 组件通过 useSyncExternalStore 订阅 loader, 通过 useXStore 订阅 runtime overlay
 *   - 视图合并由本文件内 hook 用 useMemo + utils/hydrate.ts 纯函数完成
 *
 * 每个 hook 内部:
 *   1. 订阅 base dataset (loader snapshot)
 *   2. 订阅 store runtime slice (useShallow 保证引用稳定)
 *   3. useMemo 合并 (依赖只在 base / runtime slice 任一变更时重算)
 */
import { useMemo, useSyncExternalStore } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { getXBaseDataset, subscribeBaseDataset, type XBaseDataset } from './loader';
import { conversations as baseConversations, notifications as baseNotifications, searchHistory as baseSearchHistory, currentUser } from './';
import { useXStore, type XStore } from '../state';
import {
  buildPostIndex,
  hydratePost,
  hydrateReplyTree,
  mergeLocalPosts,
  resolveReplyById,
  type XRuntimeMeSlice,
} from '../utils/hydrate';
import type { XMessage, XPost, XUser } from '../types';

// ---- Base dataset subscription ----

/**
 * 订阅 X base dataset (users/posts/replies)。Loader 加载完成时返回的引用会换,
 * useSyncExternalStore 自动触发组件重渲染。
 */
export function useXBaseDataset(): XBaseDataset {
  return useSyncExternalStore(subscribeBaseDataset, getXBaseDataset, getXBaseDataset);
}

/** "Replies 已加载" 信号: replies map 非空即视为已加载。 */
export function useXRepliesLoaded(): boolean {
  const base = useXBaseDataset();
  return Object.keys(base.replies).length > 0;
}

// ---- Internal slice selectors ----

const selectMeSlice = (s: XStore): XRuntimeMeSlice => ({
  id: s.user.id,
  likedPostIds: s.user.likedPostIds,
  retweetedPostIds: s.user.retweetedPostIds,
  followedUserIds: s.user.followedUserIds,
  followerUserIds: s.user.followerUserIds,
});

const selectRuntimePosts = (s: XStore) => s.posts;
const selectConversationsSlice = (s: XStore) => s.conversations;

// ---- Users ----

/**
 * 把 me user 投影成 user 字典里的一条 entry。like/bookmark/post 等不影响展示形态的
 * runtime 变更不会改变这个 slice (useShallow + 字段级浅比较), 避免下游字典重算。
 */
const selectMeUserEntry = (s: XStore): XUser => ({
  id: s.user.id,
  name: s.user.name,
  avatar: s.user.avatar,
  banner: s.user.banner,
  verified: s.user.verified,
  bio: s.user.bio,
  location: s.user.location,
  website: s.user.website,
  birthDate: s.user.birthDate,
  joinDate: s.user.joinDate,
  restId: s.user.restId,
  following: s.user.followedUserIds.length,
  followers: s.user.followerUserIds.length,
});

/** Base users + 当前 me user (合并后字典)。 */
export function useXAllUsers(): Record<string, XUser> {
  const base = useXBaseDataset();
  const meEntry = useXStore(useShallow(selectMeUserEntry));
  return useMemo(
    () => ({ ...base.users, [meEntry.id]: meEntry }),
    [base.users, meEntry],
  );
}

// ---- Local posts (runtime overlay + base, with relationship-derived stats + retweet shells) ----

export function useXLocalPosts(): XPost[] {
  const base = useXBaseDataset();
  const runtimePosts = useXStore(selectRuntimePosts);
  const me = useXStore(useShallow(selectMeSlice));
  return useMemo(
    () => mergeLocalPosts(runtimePosts, me, base.posts),
    [runtimePosts, me, base.posts],
  );
}

function useXPostIndex(): Map<string, XPost> {
  const base = useXBaseDataset();
  const runtimePosts = useXStore(selectRuntimePosts);
  return useMemo(() => buildPostIndex(base.posts, runtimePosts), [base.posts, runtimePosts]);
}

// ---- Hydrated timelines ----

const HYDRATED_FOR_YOU_LIMIT = 200;
const HYDRATED_FOLLOWING_LIMIT = 100;

export function useXHydratedPosts(): any[] {
  const localPosts = useXLocalPosts();
  const allUsers = useXAllUsers();
  const postIndex = useXPostIndex();
  return useMemo(
    () => localPosts.slice(0, HYDRATED_FOR_YOU_LIMIT).map((p) => hydratePost(p, allUsers, postIndex)),
    [localPosts, allUsers, postIndex],
  );
}

export function useXHydratedFollowingPosts(): any[] {
  const localPosts = useXLocalPosts();
  const allUsers = useXAllUsers();
  const postIndex = useXPostIndex();
  const followedUserIds = useXStore((s) => s.user.followedUserIds);
  return useMemo(() => {
    const followSet = new Set(followedUserIds);
    followSet.add(currentUser.id);
    return localPosts
      .filter((p) => followSet.has(p.authorId))
      .slice(0, HYDRATED_FOLLOWING_LIMIT)
      .map((p) => hydratePost(p, allUsers, postIndex));
  }, [localPosts, allUsers, postIndex, followedUserIds]);
}

/**
 * Home 页一次性产出 "For You" + "Following" 两条 timeline。比分别调用
 * useXHydratedPosts + useXHydratedFollowingPosts 共享一次 localPosts/allUsers/postIndex,
 * 避免重复 mergeLocalPosts / buildPostIndex。
 */
export function useXHomeTimelines(): { forYou: any[]; following: any[] } {
  const localPosts = useXLocalPosts();
  const allUsers = useXAllUsers();
  const postIndex = useXPostIndex();
  const followedUserIds = useXStore((s) => s.user.followedUserIds);
  return useMemo(() => {
    const forYou = localPosts
      .slice(0, HYDRATED_FOR_YOU_LIMIT)
      .map((p) => hydratePost(p, allUsers, postIndex));
    const followSet = new Set(followedUserIds);
    followSet.add(currentUser.id);
    const following = localPosts
      .filter((p) => followSet.has(p.authorId))
      .slice(0, HYDRATED_FOLLOWING_LIMIT)
      .map((p) => hydratePost(p, allUsers, postIndex));
    return { forYou, following };
  }, [localPosts, allUsers, postIndex, followedUserIds]);
}

// ---- Single-post resolvers ----

/** 按 id 解析单个 post (本地 timeline -> postIndex -> replies)。 */
export function useXResolvedPost(postId: string): any | null {
  const localPosts = useXLocalPosts();
  const postIndex = useXPostIndex();
  const allUsers = useXAllUsers();
  const base = useXBaseDataset();
  return useMemo(() => {
    if (!postId) return null;
    const localPost = localPosts.find((p) => p.id === postId);
    if (localPost) return hydratePost(localPost, allUsers, postIndex);
    const indexedPost = postIndex.get(postId);
    if (indexedPost) return hydratePost(indexedPost, allUsers, postIndex);
    return resolveReplyById(base.replies, postId, allUsers);
  }, [postId, localPosts, postIndex, allUsers, base.replies]);
}

export function useXUserProfilePosts(userId: string, limit = 80): any[] {
  const localPosts = useXLocalPosts();
  const allUsers = useXAllUsers();
  const postIndex = useXPostIndex();
  return useMemo(() => {
    if (!userId) return [];
    const filtered: XPost[] = [];
    for (const p of localPosts) {
      if (p.authorId === userId) {
        filtered.push(p);
        if (filtered.length >= limit) break;
      }
    }
    return filtered.map((p) => hydratePost(p, allUsers, postIndex));
  }, [userId, limit, localPosts, allUsers, postIndex]);
}

/**
 * 用户输入搜索 — case-insensitive fuzzy match 是合法例外,
 * id 也走 lowercase 让 "openai" 匹中 id=OpenAI。
 */
export function useXSearchPosts(query: string, limit = 1000): any[] {
  const localPosts = useXLocalPosts();
  const allUsers = useXAllUsers();
  const postIndex = useXPostIndex();
  return useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, ' ').replace(/^@/, '');
    if (!q) return [];
    const hits: XPost[] = [];
    for (const p of localPosts) {
      const content = (p.content || '').toLowerCase().replace(/\s+/g, ' ');
      const author = allUsers[p.authorId];
      const name = (author?.name || '').toLowerCase();
      const handle = (author?.id || '').toLowerCase();
      if (content.includes(q) || name.includes(q) || handle.includes(q)) {
        hits.push(p);
        if (hits.length >= limit) break;
      }
    }
    return hits.map((p) => hydratePost(p, allUsers, postIndex));
  }, [query, limit, localPosts, allUsers, postIndex]);
}

// ---- Notifications / Conversations / Search history ----

export function useXNotifications(): any[] {
  const allUsers = useXAllUsers();
  return useMemo(
    () =>
      baseNotifications.map((n: any) => {
        const actor = allUsers[n.actorId];
        return {
          ...n,
          actor: {
            id: actor?.id ?? n.actorId,
            name: actor?.name || 'Unknown',
            avatar: actor?.avatar,
          },
        };
      }),
    [allUsers],
  );
}

export function useXMentionNotifications(): any[] {
  const notifications = useXNotifications();
  return useMemo(() => notifications.filter((n) => n.type === 'mention'), [notifications]);
}

export function useXConversations(): any[] {
  const conversations = useXStore(selectConversationsSlice);
  const allUsers = useXAllUsers();
  return useMemo(() => {
    const list = conversations.length > 0 ? conversations : baseConversations;
    return list.map((c) => {
      const participant = allUsers[c.participantId];
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
  }, [conversations, allUsers]);
}

export function useXRecentSearches(): any[] {
  const allUsers = useXAllUsers();
  return useMemo(
    () =>
      baseSearchHistory.map((h: any) => {
        if (h.type === 'user' && h.userId) {
          return { ...h, user: allUsers[String(h.userId)] };
        }
        return h;
      }),
    [allUsers],
  );
}

// ---- Replies ----

export function useXRepliesForPost(postId: string): XPost[] {
  const base = useXBaseDataset();
  return useMemo(() => {
    if (!postId) return [];
    const raw = base.replies[postId];
    if (!Array.isArray(raw)) return [];
    return raw.map((r) => hydrateReplyTree(r, base.users));
  }, [postId, base.replies, base.users]);
}

/**
 * 用户 profile -> Replies tab: 收集该 user 在所有 replies 树里的回复,
 * 同时附上 hydrated parent post (从 timeline / 关注流里查).
 */
export function useXUserReplies(userId: string, limit = 80): Array<{ reply: XPost; parent?: any }> {
  const base = useXBaseDataset();
  const localPosts = useXLocalPosts();
  const allUsers = useXAllUsers();
  const postIndex = useXPostIndex();
  const followedUserIds = useXStore((s) => s.user.followedUserIds);
  return useMemo(() => {
    if (!userId) return [];
    if (Object.keys(base.replies).length === 0) return [];

    const hydratedPosts = localPosts.slice(0, HYDRATED_FOR_YOU_LIMIT).map((p) => hydratePost(p, allUsers, postIndex));
    const followSet = new Set(followedUserIds);
    const hydratedFollowing = localPosts
      .filter((p) => followSet.has(p.authorId))
      .slice(0, HYDRATED_FOLLOWING_LIMIT)
      .map((p) => hydratePost(p, allUsers, postIndex));

    const hydratedPostById = new Map<string, any>();
    for (const p of hydratedPosts) hydratedPostById.set(p.id, p);
    for (const p of hydratedFollowing) if (!hydratedPostById.has(p.id)) hydratedPostById.set(p.id, p);

    const items: Array<{ reply: XPost; parent?: any }> = [];
    outer: for (const [parentId, replies] of Object.entries(base.replies)) {
      if (!Array.isArray(replies)) continue;
      for (const r of replies as any[]) {
        if (!r || r.authorId !== userId) continue;
        items.push({
          reply: hydrateReplyTree(r as XPost, allUsers),
          parent: hydratedPostById.get(parentId),
        });
        if (items.length >= limit) break outer;
      }
    }
    return items;
  }, [userId, limit, base.replies, localPosts, allUsers, postIndex, followedUserIds]);
}
