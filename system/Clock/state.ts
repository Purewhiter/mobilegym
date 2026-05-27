import AlarmManagerService, {
  type AlarmClockInfo,
  type AlarmRepeatMode,
} from '../../os/AlarmManagerService';
import BroadcastBus, {
  ACTION_BOOT_COMPLETED,
  ACTION_TIME_SET,
  ACTION_TIME_TICK,
} from '../../os/BroadcastBus';
import { createAppStoreWithActions, memoSelector, registerStateAdapter } from '../../os/createAppStore';
import * as TimeService from '../../os/TimeService';
import { CLOCK_CONFIG } from './data';
import type { Alarm, WorldCity } from './types';
import { getNextTrigger } from './utils';

// ---- Types ----

interface ClockState {
  alarms: Alarm[];
  selectedCityIds: string[];
}

interface ClockActions {
  /** Set alarms array directly, or via updater function */
  setAlarms: (updater: Alarm[] | ((prev: Alarm[]) => Alarm[])) => void;
  /** Toggle a single alarm's enabled state */
  toggleAlarm: (id: string) => void;
  /** Add or update an alarm (upsert by id) */
  saveAlarm: (alarm: Alarm) => void;
  /** Delete alarms by a set of IDs */
  deleteAlarms: (ids: Set<string>) => void;
  /** Set selectedCityIds directly, or via updater function */
  setSelectedCityIds: (updater: string[] | ((prev: string[]) => string[])) => void;
  /** Add a city to the selected list (no-op if already present) */
  addCity: (cityId: string) => void;
  /** Remove cities by a set of IDs */
  removeCities: (ids: Set<string>) => void;
}

// ---- Store ----

const initialState: ClockState = {
  alarms: CLOCK_CONFIG.alarms as Alarm[],
  selectedCityIds: CLOCK_CONFIG.selectedCityIds,
};

export const useClockStore = createAppStoreWithActions<ClockState, ClockActions>(
  'clock',
  initialState,
  (set, get) => ({
    setAlarms: (updater) => {
      set(state => ({
        alarms: typeof updater === 'function' ? updater(state.alarms) : updater,
      }));
    },

    toggleAlarm: (id) => {
      set(state => ({
        alarms: state.alarms.map(a => (a.id === id ? { ...a, enabled: !a.enabled } : a)),
      }));
    },

    saveAlarm: (alarm) => {
      set(state => {
        const idx = state.alarms.findIndex(a => a.id === alarm.id);
        if (idx >= 0) {
          const next = [...state.alarms];
          next[idx] = alarm;
          return { alarms: next };
        }
        return { alarms: [alarm, ...state.alarms] };
      });
    },

    deleteAlarms: (ids) => {
      set(state => ({
        alarms: state.alarms.filter(a => !ids.has(a.id)),
      }));
    },

    setSelectedCityIds: (updater) => {
      set(state => ({
        selectedCityIds: typeof updater === 'function' ? updater(state.selectedCityIds) : updater,
      }));
    },

    addCity: (cityId) => {
      set(state => {
        if (state.selectedCityIds.includes(cityId)) return {};
        return { selectedCityIds: [...state.selectedCityIds, cityId] };
      });
    },

    removeCities: (ids) => {
      set(state => ({
        selectedCityIds: state.selectedCityIds.filter(id => !ids.has(id)),
      }));
    },
  }),
);

// ---- Memoized Selectors ----

type ClockStore = ClockState & ClockActions;

/** Derive the full WorldCity objects from selectedCityIds */
export const selectSelectedCities = memoSelector(
  (s: ClockStore) => s.selectedCityIds,
  (ids: string[]): WorldCity[] => CLOCK_CONFIG.cities.filter(city => ids.includes(city.id)),
);

// ---- AlarmManagerService publisher ─────────────────────────────────
// Real Android: Clock publishes alarms to AlarmManager via setAlarmClock();
// any consumer (lockscreen / status bar / MAML widget) reads next-alarm via
// getNextAlarmClock() — system never knows which app set it. mobile-gym
// mirrors this in os/AlarmManagerService so the widget ambient adapter is
// decoupled from this app's private store.

const CLOCK_PACKAGE_NAME = 'com.android.deskclock';

function alarmRepeatToMode(repeat: Alarm['repeat']): AlarmRepeatMode {
  switch (repeat) {
    case 'daily':
    case 'workday':
    case 'weekday':
    case 'holiday':
    case 'once':
      return repeat;
    default:
      return 'custom';
  }
}

function alarmToAlarmClockInfo(alarm: Alarm): AlarmClockInfo {
  return {
    id: alarm.id,
    ownerPackage: CLOCK_PACKAGE_NAME,
    hour: alarm.hour,
    minute: alarm.minute,
    label: alarm.note ?? '',
    repeat: alarmRepeatToMode(alarm.repeat),
    triggerAtMs: getNextTrigger(alarm, TimeService.getDate()),
  };
}

function publishAlarmsToManager(alarms: Alarm[]): void {
  const enabled = alarms.filter((a) => a.enabled);
  AlarmManagerService.setAlarmClocksFor(
    CLOCK_PACKAGE_NAME,
    enabled.map(alarmToAlarmClockInfo),
  );
}

function republishCurrentAlarms(): void {
  publishAlarmsToManager(useClockStore.getState().alarms);
}

// Initial publish on module load (covers cold-start when defaults already
// have enabled alarms).
republishCurrentAlarms();

useClockStore.subscribe((state, prev) => {
  if (state.alarms === prev.alarms) return;
  publishAlarmsToManager(state.alarms);
});

// triggerAtMs is computed relative to "now", so it goes stale as wall-clock
// time advances or jumps. Re-publish (recomputing every alarm's next trigger
// against the current TimeService time) whenever time moves so the widget's
// next_alarm_time / clock_alarmtime never serve expired data:
//   - TIME_TICK fires each minute while simulated time flows (covers an alarm
//     time passing during normal playback). setAlarmClocksFor dedups, so ticks
//     that don't cross a trigger boundary are no-ops.
//   - TIME_SET fires on __SIM_TIME__.setSimulatedTime() jumps.
BroadcastBus.registerReceiver(ACTION_TIME_TICK, republishCurrentAlarms);
BroadcastBus.registerReceiver(ACTION_TIME_SET, republishCurrentAlarms);

// __SIM__.resetState() (no page reload) wipes the volatile AlarmManager store
// AFTER app stores re-init, leaving the manager empty until the next alarm
// change. OSContext re-emits BOOT_COMPLETED at the end of the reset so derived
// volatile services (this + MediaSession) re-publish from the restored store.
BroadcastBus.registerReceiver(ACTION_BOOT_COMPLETED, republishCurrentAlarms);

// ---- State Adapter (bench_env) ----
// 补齐旧 API 暴露的 alarms / selectedCities（App 未挂载时从 CONFIG 默认值计算）

registerStateAdapter('clock', (state) => {
  const result = { ...state };
  result.cities = state.cities ?? CLOCK_CONFIG.cities;
  if (!Array.isArray(result.alarms)) {
    result.alarms = state.alarms ?? CLOCK_CONFIG.alarms;
  }
  if (!Array.isArray(result.selectedCities)) {
    const ids: string[] = state.selectedCityIds ?? CLOCK_CONFIG.selectedCityIds;
    const cities: any[] = result.cities;
    result.selectedCities = cities.filter((c: any) => ids.includes(c.id));
  }
  return result;
});
