import { mutateOsState, useOsStateStore } from '../OsStateStore';
import { registerManager, type DeviceSetOptions, type DeviceSettingValue, type ManagerWithPreferences } from './registry';

const AUDIO_PREFERENCE_KEYS = [
  'volume_media',
  'volume_ring',
  'volume_alarm',
  'volume_notification',
  'volume_call',
  'volume_voice_assist',
  'silent',
  'do_not_disturb',
] as const;

let silentBeforeDnd: boolean | null = null;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const next = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(Math.max(Math.round(next), min), max);
}

function callOsVolume(value: number): void {
  const os = window.__OS__;
  if (!os || typeof os.setVolume !== 'function') return;
  os.setVolume(value);
}

function setMediaVolume(value: number, options?: DeviceSetOptions): void {
  const next = clampInt(value, 0, 100, useOsStateStore.getState().settings.system.mediaVolume);
  mutateOsState((state) => {
    state.settings.system.mediaVolume = next;
  });
  if (options?.source !== 'os') {
    callOsVolume(next);
  }
}

function setSilentMode(enabled: boolean): void {
  const state = useOsStateStore.getState();
  if (state.settings.global.doNotDisturbEnabled) {
    silentBeforeDnd = enabled;
    return;
  }
  mutateOsState((draft) => {
    draft.settings.global.silentMode = enabled;
  });
}

function setDoNotDisturbEnabled(enabled: boolean): void {
  const state = useOsStateStore.getState();
  if (enabled) {
    if (!state.settings.global.doNotDisturbEnabled) {
      silentBeforeDnd = state.settings.global.silentMode;
    }
    mutateOsState((draft) => {
      draft.settings.global.doNotDisturbEnabled = true;
      draft.settings.global.silentMode = true;
    });
    return;
  }
  mutateOsState((draft) => {
    draft.settings.global.doNotDisturbEnabled = false;
    if (silentBeforeDnd !== null) {
      draft.settings.global.silentMode = silentBeforeDnd;
    }
  });
  silentBeforeDnd = null;
}

export const AudioManager: ManagerWithPreferences & {
  setMediaVolume: typeof setMediaVolume;
  setSilentMode: typeof setSilentMode;
  setDoNotDisturbEnabled: typeof setDoNotDisturbEnabled;
} = {
  getPreference(key: string): DeviceSettingValue | undefined {
    const state = useOsStateStore.getState();
    switch (key) {
      case 'volume_media':
        return state.settings.system.mediaVolume;
      case 'volume_ring':
      case 'volume_alarm':
      case 'volume_notification':
      case 'volume_call':
      case 'volume_voice_assist':
        return state.preferences[key] ?? 50;
      case 'silent':
        return state.settings.global.doNotDisturbEnabled ? true : state.settings.global.silentMode;
      case 'do_not_disturb':
        return state.settings.global.doNotDisturbEnabled;
      default:
        return undefined;
    }
  },

  setPreference(key: string, value: DeviceSettingValue, options?: DeviceSetOptions): void {
    switch (key) {
      case 'volume_media':
        setMediaVolume(clampInt(value, 0, 100, useOsStateStore.getState().settings.system.mediaVolume), options);
        return;
      case 'volume_ring':
      case 'volume_alarm':
      case 'volume_notification':
      case 'volume_call':
      case 'volume_voice_assist':
        mutateOsState((state) => {
          state.preferences[key] = clampInt(value, 0, 100, (state.preferences[key] as number) ?? 50);
        });
        return;
      case 'silent':
        setSilentMode(Boolean(value));
        return;
      case 'do_not_disturb':
        setDoNotDisturbEnabled(Boolean(value));
        return;
      default:
        return;
    }
  },

  setMediaVolume,
  setSilentMode,
  setDoNotDisturbEnabled,
};

registerManager(AUDIO_PREFERENCE_KEYS, AudioManager);
