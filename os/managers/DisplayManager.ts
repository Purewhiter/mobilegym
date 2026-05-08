import { mutateOsState, useOsStateStore } from '../OsStateStore';
import { registerManager, type DeviceSetOptions, type DeviceSettingValue, type ManagerWithPreferences } from './registry';

const DISPLAY_PREFERENCE_KEYS = [
  'brightness',
  'auto_brightness',
  'font_size',
  'display_size',
  'dark_mode',
  'eye_comfort',
  'eye_comfort_level',
] as const;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const next = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(Math.max(Math.round(next), min), max);
}

export function fontScaleFromPct(pct: number): number {
  const p = Math.min(100, Math.max(0, pct));
  return 0.85 + (p / 100) * 0.45;
}

export function displayScaleFromPct(pct: number): number {
  const p = Math.min(100, Math.max(0, pct));
  return 0.85 + (p / 100) * 0.3;
}

function callOsBrightness(value: number): void {
  const os = window.__OS__;
  if (!os || typeof os.setBrightness !== 'function') return;
  os.setBrightness(value);
}

function setBrightness(value: number, options?: DeviceSetOptions): void {
  const next = clampInt(value, 0, 100, useOsStateStore.getState().settings.system.brightness);
  mutateOsState((state) => {
    state.settings.system.brightness = next;
  });
  if (options?.source !== 'os') {
    callOsBrightness(next);
  }
}

function setAutoBrightnessEnabled(enabled: boolean): void {
  mutateOsState((state) => {
    state.settings.global.autoBrightnessEnabled = enabled;
  });
}

function setFontSizePct(value: number): void {
  mutateOsState((state) => {
    state.settings.system.fontSizePct = clampInt(value, 0, 100, state.settings.system.fontSizePct);
  });
}

function setDisplaySizePct(value: number): void {
  mutateOsState((state) => {
    state.settings.system.displaySizePct = clampInt(value, 0, 100, state.settings.system.displaySizePct);
  });
}

function setDarkModeEnabled(enabled: boolean): void {
  mutateOsState((state) => {
    state.settings.global.darkModeEnabled = enabled;
  });
}

function setEyeComfortEnabled(enabled: boolean): void {
  mutateOsState((state) => {
    state.settings.global.eyeComfortEnabled = enabled;
  });
}

function setEyeComfortLevel(value: number): void {
  mutateOsState((state) => {
    state.settings.system.eyeComfortLevel = clampInt(value, 0, 100, state.settings.system.eyeComfortLevel);
  });
}

export const DisplayManager: ManagerWithPreferences & {
  setBrightness: typeof setBrightness;
  setAutoBrightnessEnabled: typeof setAutoBrightnessEnabled;
  setFontSizePct: typeof setFontSizePct;
  setDisplaySizePct: typeof setDisplaySizePct;
  setDarkModeEnabled: typeof setDarkModeEnabled;
  setEyeComfortEnabled: typeof setEyeComfortEnabled;
  setEyeComfortLevel: typeof setEyeComfortLevel;
} = {
  getPreference(key: string): DeviceSettingValue | undefined {
    const state = useOsStateStore.getState();
    switch (key) {
      case 'brightness':
        return state.settings.system.brightness;
      case 'auto_brightness':
        return state.settings.global.autoBrightnessEnabled;
      case 'font_size':
        return state.settings.system.fontSizePct;
      case 'display_size':
        return state.settings.system.displaySizePct;
      case 'dark_mode':
        return state.settings.global.darkModeEnabled;
      case 'eye_comfort':
        return state.settings.global.eyeComfortEnabled;
      case 'eye_comfort_level':
        return state.settings.system.eyeComfortLevel;
      default:
        return undefined;
    }
  },

  setPreference(key: string, value: DeviceSettingValue, options?: DeviceSetOptions): void {
    switch (key) {
      case 'brightness':
        setBrightness(clampInt(value, 0, 100, useOsStateStore.getState().settings.system.brightness), options);
        return;
      case 'auto_brightness':
        setAutoBrightnessEnabled(Boolean(value));
        return;
      case 'font_size':
        setFontSizePct(clampInt(value, 0, 100, useOsStateStore.getState().settings.system.fontSizePct));
        return;
      case 'display_size':
        setDisplaySizePct(clampInt(value, 0, 100, useOsStateStore.getState().settings.system.displaySizePct));
        return;
      case 'dark_mode':
        setDarkModeEnabled(Boolean(value));
        return;
      case 'eye_comfort':
        setEyeComfortEnabled(Boolean(value));
        return;
      case 'eye_comfort_level':
        setEyeComfortLevel(clampInt(value, 0, 100, useOsStateStore.getState().settings.system.eyeComfortLevel));
        return;
      default:
        return;
    }
  },

  setBrightness,
  setAutoBrightnessEnabled,
  setFontSizePct,
  setDisplaySizePct,
  setDarkModeEnabled,
  setEyeComfortEnabled,
  setEyeComfortLevel,
};

registerManager(DISPLAY_PREFERENCE_KEYS, DisplayManager);
