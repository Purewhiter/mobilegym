import { memoSelector } from '../../os/createAppStore';
import { createDeviceAppStore } from '../../os/device/deviceStore';
import { CALENDAR_CONFIG } from './data';
import * as TimeService from '@/os/TimeService';
import type { CalendarEvent, CalendarSettings } from './types';
import { base36, nextStream } from '../../os/RandomService';

// ---- Helper functions ----

function randomId(prefix: string): string {
  return `${prefix}_${base36(nextStream(`calendar.${prefix}`), 8)}${TimeService.now().toString(36).slice(-4)}`;
}

function startOfDayTs(ts: number): number {
  const d = TimeService.fromTimestamp(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// ---- Types ----

interface CalendarState {
  settings: CalendarSettings;
  events: CalendarEvent[];
  selectedDateTs: number;
}

interface CalendarActions {
  updateSettings: (patch: Partial<CalendarSettings>) => void;
  setSelectedDate: (date: Date) => void;
  createEvent: (event: Omit<CalendarEvent, 'id'>) => string;
  updateEvent: (id: string, patch: Partial<Omit<CalendarEvent, 'id'>>) => void;
  deleteEvent: (id: string) => void;
}

// ---- Store ----

const initialState: CalendarState = {
  settings: CALENDAR_CONFIG.settings,
  events: [],
  selectedDateTs: startOfDayTs(TimeService.now()),
};

// State lives in the device server session (device/stateOnly.ts); the actions
// below run here as before and every write is saved there.
export const useCalendarStore = createDeviceAppStore<CalendarState, CalendarActions>(
  'calendar',
  initialState,
  { localKeys: [], syncSetState: true },
  (_device, set, get) => ({
    updateSettings: (patch: Partial<CalendarSettings>) => {
      set(state => ({ settings: { ...state.settings, ...patch } }));
    },

    setSelectedDate: (date: Date) => {
      set({ selectedDateTs: startOfDayTs(date.getTime()) });
    },

    createEvent: (event: Omit<CalendarEvent, 'id'>) => {
      const id = randomId('evt');
      const created: CalendarEvent = { ...event, id };
      set(state => ({ events: [created, ...state.events] }));
      return id;
    },

    updateEvent: (id: string, patch: Partial<Omit<CalendarEvent, 'id'>>) => {
      set(state => ({
        events: state.events.map(e => (e.id === id ? { ...e, ...patch, id: e.id } : e)),
      }));
    },

    deleteEvent: (id: string) => {
      set(state => ({ events: state.events.filter(e => e.id !== id) }));
    },
  }),
);

// ---- Memoized Selectors ----

type CalendarStore = CalendarState & CalendarActions;

export const selectSelectedDate = memoSelector(
  (s: CalendarStore) => s.selectedDateTs,
  (ts: number) => TimeService.fromTimestamp(ts),
);
