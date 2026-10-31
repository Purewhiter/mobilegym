/**
 * Reddit data entry for the OS `waitForData` hook.
 *
 * The post catalog lives on the device server (apps/Reddit/device); pages read
 * the views they show through `useDeviceQuery` (hooks/useRedditPosts.ts).
 * Preloading syncs the store with this page's device session and fetches the
 * first feed page, so the home page mounts with its posts.
 */

import { prefetchDeviceQuery } from '../../../os/device/deviceStore';

export async function preload(): Promise<void> {
  // Dynamic import: state → data/index → loader would otherwise form a cycle.
  const { useRedditStore } = await import('../state');
  await useRedditStore.ensureSynced();
  await prefetchDeviceQuery('reddit', 'feedPage', { limit: 20 });
}
