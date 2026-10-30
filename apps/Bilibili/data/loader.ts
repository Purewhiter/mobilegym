/**
 * Bilibili data loader.
 *
 * The catalog (videos, comments, authors, commenters, rankings: ~90MB of JSON)
 * is no longer fetched into the page: it lives in the device server
 * (apps/Bilibili/device), shared by every session. Loading Bilibili only means
 * syncing the store mirror with this page's device session; pages read the
 * catalog through device queries (see ../hooks/useData.ts).
 */

import { useBilibiliStore } from '../state';

/** 标准化预加载入口（供 OS waitForData 自动发现） */
export async function preload(): Promise<void> {
  await useBilibiliStore.ensureSynced();
}
