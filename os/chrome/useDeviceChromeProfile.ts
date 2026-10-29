import { useOsStateStore } from '../OsStateStore';
import type { AppId } from '../types';
import { DEVICE_CHROME_PROFILE_PREFERENCE, DEVICE_CHROME_SNAPSHOT_PREFERENCE, resolveDeviceChromeProfile, withDeviceChromeSnapshot } from './profiles';

/** System-wide device chrome; `appId` only scopes a recorded per-app raster snapshot. */
export function useDeviceChromeProfile(appId?: AppId | null) {
  const preference = useOsStateStore((state) => state.preferences[DEVICE_CHROME_PROFILE_PREFERENCE]);
  const snapshot = useOsStateStore((state) => state.preferences[DEVICE_CHROME_SNAPSHOT_PREFERENCE]);
  return withDeviceChromeSnapshot(resolveDeviceChromeProfile({ preference }), snapshot, appId);
}
