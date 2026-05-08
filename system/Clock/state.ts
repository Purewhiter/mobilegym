import { createAppStoreWithActions, memoSelector, registerStateAdapter } from '../../os/createAppStore';
import { CLOCK_CONFIG } from './data';
import type { Alarm, WorldCity } from './types';

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
