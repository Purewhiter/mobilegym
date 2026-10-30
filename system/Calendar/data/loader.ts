/**
 * Calendar data entry for the OS `waitForData` hook: the app's state lives in
 * the device server session, so preloading syncs the store with it.
 */
export async function preload(): Promise<void> {
  const { useCalendarStore } = await import('../state');
  await useCalendarStore.ensureSynced();
}
