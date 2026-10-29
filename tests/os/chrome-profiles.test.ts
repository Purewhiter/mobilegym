import { describe, expect, it } from 'vitest';
import { REDMI_NOTE12_TURBO_CHROME_ID as id, resolveDeviceChromeProfile, withDeviceChromeSnapshot } from '../../os/chrome/profiles';

describe('device chrome profile selection', () => {
  it('uses the captured device chrome system-wide by default', () => {
    expect(resolveDeviceChromeProfile({})?.id).toBe(id);
    expect(resolveDeviceChromeProfile({ preference: 'auto' })?.id).toBe(id);
  });
  it('lets an explicit device preference opt out or select a profile', () => {
    expect(resolveDeviceChromeProfile({ preference: 'legacy' })).toBeNull();
    expect(resolveDeviceChromeProfile({ preference: id })?.id).toBe(id);
  });
  it('does not silently substitute another profile for an unknown explicit ID', () => {
    expect(resolveDeviceChromeProfile({ preference: 'unknown' })).toBeNull();
  });
  it('scopes captured raster state to the declared profile and foreground app', () => {
    const profile = resolveDeviceChromeProfile({})!;
    const snapshot = { profileId: id, appId: 'settings', navigationRasterOffsetPhysical: { x: -4, y: -4 } };
    expect(withDeviceChromeSnapshot(null, snapshot, 'settings')).toBeNull();
    expect(withDeviceChromeSnapshot(profile, snapshot, 'contacts')).toBe(profile);
    expect(withDeviceChromeSnapshot(profile, { ...snapshot, profileId: 'other' }, 'settings')).toBe(profile);
    expect(withDeviceChromeSnapshot(profile, snapshot, 'settings')?.gesture.rasterOffsetX).toBe(-4 / 3);
    expect(profile.gesture.rasterOffsetX).toBeUndefined();
  });
  it('rejects invalid snapshot geometry without changing default device chrome', () => {
    const profile = resolveDeviceChromeProfile({})!;
    for (const x of [Infinity, NaN, 31, '4']) {
      expect(withDeviceChromeSnapshot(profile, { profileId: id, appId: 'settings', navigationRasterOffsetPhysical: { x, y: 0 } }, 'settings')).toBe(profile);
    }
  });
});
