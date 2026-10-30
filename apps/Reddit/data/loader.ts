/**
 * Reddit data entry for the OS `waitForData` hook.
 *
 * The post catalog lives on the device server (apps/Reddit/device); pages read
 * it through `useDeviceQuery` (hooks/useRedditPosts.ts). Preloading syncs the
 * store with this page's device session and fetches the feed, so the app
 * mounts with its posts the way it did when they were a bundled JSON file.
 */

import { prefetchDeviceQuery } from '../../../os/device/deviceStore';

export async function preload(): Promise<void> {
  // Dynamic import: state → data/index → loader would otherwise form a cycle.
  const { useRedditStore } = await import('../state');
  await useRedditStore.ensureSynced();
  await prefetchDeviceQuery('reddit', 'posts', {}, { catalog: true });
}
