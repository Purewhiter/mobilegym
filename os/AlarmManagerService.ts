/**
 * AlarmManagerService — OS-level user-facing alarm registry, modeled after
 * Android's `AlarmManager.setAlarmClock()` / `getNextAlarmClock()` pair.
 *
 * Real Android flow
 * -----------------
 * 1. Any app that owns "user-facing alarms" (Clock, Calendar, Sleep, etc.)
 *    calls `alarmManager.setAlarmClock(AlarmClockInfo, pendingIntent)`.
 * 2. The system tracks every registered alarm and merges them into a single
 *    chronological queue.
 * 3. Consumers (lockscreen "next alarm" text, status bar alarm icon, MAML
 *    widget) call `alarmManager.getNextAlarmClock()` to read the soonest one
 *    — they never import or know about the source app.
 *
 * mobile-gym mirror
 * -----------------
 * - {@link AlarmManagerService.setAlarmClock} — publisher upserts a single
 *   alarm by stable id.
 * - {@link AlarmManagerService.cancelAlarmClock} — publisher removes one.
 * - {@link AlarmManagerService.setAlarmClocksFor} — bulk replace all alarms
 *   owned by one source (idiomatic when an app's full alarm list changes).
 * - {@link AlarmManagerService.getNextAlarmClock} — direct mirror of Android.
 * - {@link AlarmManagerService.getRegisteredAlarmClocks} — extension beyond
 *   real Android. Needed because the MAML widget renders ALL alarms as
 *   ambient array vars (`clock_message[]`/`clock_hour[]`/...). Real Android
 *   apps would expose enumeration via their own ContentProvider; we simplify
 *   by surfacing it at the registry. Sorted by trigger time ascending.
 *
 * State is volatile (no persistence). Publishers re-publish on app boot.
 */
import BroadcastBus from './BroadcastBus';
import { createVolatileOsStore } from './createOsStore';

export const ACTION_NEXT_ALARM_CLOCK_CHANGED = 'android.app.action.NEXT_ALARM_CLOCK_CHANGED';

export type AlarmRepeatMode =
  | 'once'      // fires a single time then is removed by the publisher
  | 'daily'     // every day at hour:minute
  | 'weekday'   // Mon-Fri
  | 'workday'   // alias for weekday in some locales
  | 'holiday'   // Sat-Sun
  | 'custom';   // publisher-specific; daysOfWeekMask carries the encoding

export interface AlarmClockInfo {
  /**
   * Stable identifier for this alarm within the OWNER namespace. Combined
   * with {@link ownerPackage} to make a globally unique key. Re-publishing
   * an id replaces the previous entry.
   */
  id: string;
  /** Publisher app's package name (e.g. `com.android.deskclock`). */
  ownerPackage: string;
  /** Wall-clock display hour (0-23). */
  hour: number;
  /** Wall-clock display minute (0-59). */
  minute: number;
  /** User-visible label, may be empty. */
  label: string;
  /**
   * Repeat semantics. The publisher is responsible for canceling a `'once'`
   * alarm after it fires (mirrors how Android `setAlarmClock` works — it
   * doesn't auto-repeat).
   */
  repeat: AlarmRepeatMode;
  /**
   * 7-bit bitmask `Sun=1, Mon=2, Tue=4, ..., Sat=64`. For built-in repeat
   * modes (daily=127, weekday=31, holiday=96) consumers can derive this
   * from {@link repeat} alone; populated only when {@link repeat} is
   * `'custom'`.
   */
  daysOfWeekMask?: number;
  /** Absolute trigger time in ms since epoch (next firing). */
  triggerAtMs: number;
}

interface AlarmManagerState {
  /** Keyed by `${ownerPackage}:${id}`. */
  alarms: Record<string, AlarmClockInfo>;
}

const store = createVolatileOsStore<AlarmManagerState>(
  'alarm_manager',
  { alarms: {} },
  { registerToServiceRegistry: true },
);

function compositeKey(ownerPackage: string, id: string): string {
  return `${ownerPackage}:${id}`;
}

function emit(): void {
  // Android's matching system broadcast — sent whenever the next alarm clock
  // changes (added, removed, or rescheduled).
  BroadcastBus.sendBroadcast({ action: ACTION_NEXT_ALARM_CLOCK_CHANGED });
}

export const AlarmManagerService = {
  setAlarmClock(info: AlarmClockInfo): void {
    const key = compositeKey(info.ownerPackage, info.id);
    const prev = store.getState().alarms[key];
    if (prev && alarmsEqual(prev, info)) return;
    store.setState((state) => ({
      alarms: { ...state.alarms, [key]: { ...info } },
    }));
    emit();
  },

  cancelAlarmClock(ownerPackage: string, id: string): void {
    const key = compositeKey(ownerPackage, id);
    if (!store.getState().alarms[key]) return;
    store.setState((state) => {
      const next = { ...state.alarms };
      delete next[key];
      return { alarms: next };
    });
    emit();
  },

  /**
   * Bulk replace every alarm owned by {@link ownerPackage}. Convenient when
   * the publisher has the full latest list and doesn't track per-id diffs.
   * Cancels any previously-registered alarms from this owner that aren't in
   * the new list.
   */
  setAlarmClocksFor(ownerPackage: string, infos: AlarmClockInfo[]): void {
    const wanted = new Set(infos.map((info) => compositeKey(info.ownerPackage, info.id)));
    const current = store.getState().alarms;
    let changed = false;

    for (const key of Object.keys(current)) {
      if (current[key].ownerPackage !== ownerPackage) continue;
      if (wanted.has(key)) continue;
      changed = true;
    }
    for (const info of infos) {
      const key = compositeKey(info.ownerPackage, info.id);
      const prev = current[key];
      if (!prev || !alarmsEqual(prev, info)) {
        changed = true;
        break;
      }
    }

    if (!changed) return;

    store.setState((state) => {
      const next: Record<string, AlarmClockInfo> = {};
      for (const [key, value] of Object.entries(state.alarms)) {
        if (value.ownerPackage !== ownerPackage) next[key] = value;
      }
      for (const info of infos) {
        next[compositeKey(info.ownerPackage, info.id)] = { ...info };
      }
      return { alarms: next };
    });
    emit();
  },

  /**
   * The single soonest-firing registered alarm, or `null` if none. Direct
   * mirror of `android.app.AlarmManager#getNextAlarmClock()`.
   */
  getNextAlarmClock(): AlarmClockInfo | null {
    const all = Object.values(store.getState().alarms);
    if (all.length === 0) return null;
    return all.reduce((best, cur) => (cur.triggerAtMs < best.triggerAtMs ? cur : best));
  },

  /**
   * All currently-registered alarms, sorted by trigger time ascending.
   * Extension beyond stock Android — see file header for why.
   */
  getRegisteredAlarmClocks(): AlarmClockInfo[] {
    return Object.values(store.getState().alarms).sort(
      (a, b) => a.triggerAtMs - b.triggerAtMs,
    );
  },
};

function alarmsEqual(a: AlarmClockInfo, b: AlarmClockInfo): boolean {
  return (
    a.id === b.id &&
    a.ownerPackage === b.ownerPackage &&
    a.hour === b.hour &&
    a.minute === b.minute &&
    a.label === b.label &&
    a.repeat === b.repeat &&
    a.daysOfWeekMask === b.daysOfWeekMask &&
    a.triggerAtMs === b.triggerAtMs
  );
}

export default AlarmManagerService;
