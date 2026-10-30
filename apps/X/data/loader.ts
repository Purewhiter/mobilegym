import { prefetchDeviceQuery } from '../../../os/device/deviceStore';
import type { XPost, XUser } from '../types';

/**
 * X base dataset (静态 JSON 表, 只读, 不属于 state):
 *   - users:   全平台用户表 (case-sensitive id 主键)
 *   - posts:   所有可见推文 (排好序的 base feed)
 *   - replies: 按根 post id 索引的回复树
 *
 * 数据在 device server 上 (apps/X/device), 页面通过 `useXBaseDataset()`
 * (apps/X/data/view.ts) 用 catalog query 读取。replies 体量大, 只在
 * PostDetailsPage / UserProfilePage 调 `requestReplies()` 之后才查询。
 */
export interface XBaseDataset {
  users: Record<string, XUser>;
  posts: XPost[];
  replies: Record<string, XPost[]>;
}

let repliesRequested = false;
const repliesListeners = new Set<() => void>();

/** Start loading reply trees (idempotent). */
export function requestReplies(): void {
  if (repliesRequested) return;
  repliesRequested = true;
  for (const listener of repliesListeners) listener();
}

export const areRepliesRequested = (): boolean => repliesRequested;

export function subscribeRepliesRequested(listener: () => void): () => void {
  repliesListeners.add(listener);
  return () => {
    repliesListeners.delete(listener);
  };
}

/** OS `waitForData` 入口: 同步 store 与本页的 device session, 并预取 users + posts（页面挂载时数据已就绪）。 */
export async function preload(): Promise<void> {
  // 动态 import: state → loader 静态 import 会成环。
  const { useXStore } = await import('../state');
  await useXStore.ensureSynced();
  await Promise.all([
    prefetchDeviceQuery('x', 'users', {}, { catalog: true }),
    prefetchDeviceQuery('x', 'posts', {}, { catalog: true }),
  ]);
}
