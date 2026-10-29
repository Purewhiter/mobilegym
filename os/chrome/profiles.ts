export const DEVICE_CHROME_PROFILE_PREFERENCE = 'device_chrome_profile';
export const DEVICE_CHROME_SNAPSHOT_PREFERENCE = 'device_chrome_snapshot';
export const REDMI_NOTE12_TURBO_CHROME_ID = 'redmi-note12-turbo-hyperos3';

export interface DeviceChromeProfile {
  id: string;
  sourceDevice: { model: string; device: string; systemVersion: string; physicalSize: readonly [number, number]; pixelsPerCssPixel: number };
  statusBar: {
    height: number;
    clockLeft: number;
    clockTop: number;
    clockHeight: number;
    clockFontSize: number;
    rightInset: number;
    iconsTop: number;
    iconSide: number;
    batteryWidth: number;
    batteryHeight: number;
    chargeWidth: number;
  };
  gesture: { width: number; height: number; bottom: number; touchHeight: number; opacityDark: number; opacityLight: number; colorDark: string; colorLight: string; rasterOffsetX?: number; rasterOffsetY?: number };
}

const px = (physical: number) => physical / 3;

export const REDMI_NOTE12_TURBO_CHROME: DeviceChromeProfile = {
  id: REDMI_NOTE12_TURBO_CHROME_ID,
  sourceDevice: { model: '23049RAD8C', device: 'marble', systemVersion: 'OS3.0.1.0.VMRCNXM', physicalSize: [1080, 2400], pixelsPerCssPixel: 3 },
  // StatusBar / NavigationBar0 typed window snapshots and shipped SystemUI.
  statusBar: {
    height: px(111), clockLeft: px(71), clockTop: px(14), clockHeight: px(80), clockFontSize: px(42),
    rightInset: px(62), iconsTop: px(24), iconSide: px(60), batteryWidth: px(84), batteryHeight: px(60), chargeWidth: px(24),
  },
  gesture: { width: px(456), height: 1.8499756 * 2, bottom: px(18), touchHeight: px(48), opacityDark: 166 / 255, opacityLight: 166 / 255, colorDark: '#191919', colorLight: '#ffffff' },
};

export const DEVICE_CHROME_PROFILES: Readonly<Record<string, DeviceChromeProfile>> = {
  [REDMI_NOTE12_TURBO_CHROME_ID]: REDMI_NOTE12_TURBO_CHROME,
};

/** A recorded compositor/drawing state, scoped to one profile and foreground app. */
export function withDeviceChromeSnapshot(profile: DeviceChromeProfile | null, value: unknown, appId?: string | null): DeviceChromeProfile | null {
  if (!profile || !value || typeof value !== 'object' || Array.isArray(value)) return profile;
  const snapshot = value as Record<string, unknown>;
  if (snapshot.profileId !== profile.id || snapshot.appId !== appId) return profile;
  const offset = snapshot.navigationRasterOffsetPhysical;
  if (!offset || typeof offset !== 'object' || Array.isArray(offset)) return profile;
  const { x, y } = offset as Record<string, unknown>;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 30 || Math.abs(y) > 30) return profile;
  const scale = profile.sourceDevice.pixelsPerCssPixel;
  return { ...profile, gesture: { ...profile.gesture, rasterOffsetX: x / scale, rasterOffsetY: y / scale } };
}

function explicitProfile(id: string): DeviceChromeProfile | null {
  return DEVICE_CHROME_PROFILES[id] ?? null;
}

/**
 * System-wide chrome: the captured device chrome is the global default for the
 * launcher, recents and every app. Only an explicit preference changes it
 * (`legacy` or an unknown ID falls back to the legacy drawn status bar).
 */
export function resolveDeviceChromeProfile(input: { preference?: unknown }): DeviceChromeProfile | null {
  const preference = typeof input.preference === 'string' ? input.preference.trim() : '';
  if (preference && preference !== 'auto') return explicitProfile(preference);
  return REDMI_NOTE12_TURBO_CHROME;
}
