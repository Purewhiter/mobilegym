/**
 * Reddit data entry for the OS `waitForData` hook.
 *
 * The post catalog lives on the device server (apps/Reddit/device); pages read
 * it through `useDeviceQuery` (hooks/useRedditPosts.ts). Preloading syncs the
 * store with this page's device session.
 */

export async function preload(): Promise<void> {
  // Dynamic import: state → data/index → loader would otherwise form a cycle.
  const { useRedditStore } = await import('../state');
  await useRedditStore.ensureSynced();
}
