import { useSyncExternalStore } from 'react';
import { getVersion, subscribe } from '../FileSystemService';

/**
 * The file system mirror's version: put it in the deps of whatever reads the
 * mirror (`listDirectory`, `getMediaFiles`, …) so the read runs again once the
 * mirror fills in or changes.
 */
export function useFileSystemVersion(): number {
  return useSyncExternalStore(subscribe, getVersion);
}
