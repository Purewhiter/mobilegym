import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as TimeService from '../os/TimeService';
import { getPassiveDataUpdateDelayMs } from '../os/wmr/passiveRefresh';
import { VarContext } from '../os/wmr/engine/variables';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_790_000_000_000);
});

afterEach(() => {
  TimeService.setSpeed(1);
  TimeService.useRealTime();
  vi.useRealTimers();
});

describe('WMR passive data refresh delay', () => {
  it('lands just after the next minute boundary', () => {
    TimeService.useSimulatedTime('2026-10-06 09:00:30', true);
    expect(getPassiveDataUpdateDelayMs(['DateTime.Minute'])).toBe(30_000);
  });

  it('never fires before a boundary that is only milliseconds away', () => {
    TimeService.useSimulatedTime('2026-10-06 09:00:59', true);
    vi.advanceTimersByTime(990);
    // Previously clamped to 50 ms, which refreshed 40 ms early and kept the old minute.
    expect(getPassiveDataUpdateDelayMs(['DateTime.Minute'])).toBe(10);
  });

  it('converts simulated time to real time when time runs faster', () => {
    TimeService.useSimulatedTime('2026-10-06 09:00:30', true);
    TimeService.setSpeed(10);
    expect(getPassiveDataUpdateDelayMs(['DateTime.Minute'])).toBe(3_000);
  });

  it('keeps the heartbeat when simulated time is frozen or no updater is declared', () => {
    TimeService.useSimulatedTime('2026-10-06 09:00:30', false);
    expect(getPassiveDataUpdateDelayMs(['DateTime.Minute'])).toBe(60_000);
    TimeService.useSimulatedTime('2026-10-06 09:00:30', true);
    expect(getPassiveDataUpdateDelayMs([])).toBe(60_000);
  });
});

describe('WMR looping timelines', () => {
  type Advance = (total: number, state: Record<string, unknown>, loop?: boolean) => number;

  it('wrap phase-continuously instead of restarting from the frame that noticed the end', () => {
    const vars = new VarContext('test-loop');
    const advance = (vars as unknown as { advanceTimeline: Advance }).advanceTimeline.bind(vars);
    const state = {
      fromTime: 0, toTime: 1000, startedAt: Date.now(), duration: 1000,
      playing: true, currentTime: 0, completed: false,
    };
    // Sample at an irregular 70 ms cadence for 10.5 cycles.
    let t = 0;
    while (t + 70 <= 10_500) {
      vi.advanceTimersByTime(70);
      t += 70;
      advance(1000, state, true);
    }
    vi.advanceTimersByTime(10_500 - t);
    // Exactly half-way through a cycle, whatever cadence the frames came at.
    expect(advance(1000, state, true)).toBeCloseTo(500, 6);
  });

  it('wrap within a partial play(from, to) range', () => {
    const vars = new VarContext('test-loop-range');
    const advance = (vars as unknown as { advanceTimeline: Advance }).advanceTimeline.bind(vars);
    const state = {
      fromTime: 200, toTime: 600, startedAt: Date.now(), duration: 400,
      playing: true, currentTime: 200, completed: false,
    };
    vi.advanceTimersByTime(500); // one full cycle plus 100 ms
    expect(advance(1000, state, true)).toBeCloseTo(300, 6);
  });
});
