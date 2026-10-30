/**
 * Compass data entry for the OS `waitForData` hook: the app's state lives in
 * the device server session, so preloading syncs the store with it.
 */
export async function preload(): Promise<void> {
  const { useCompassStore } = await import('../state');
  await useCompassStore.ensureSynced();
}
