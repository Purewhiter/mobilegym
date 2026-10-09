import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as TimeService from '../os/TimeService';
import BroadcastBus, { ACTION_TIME_TICK } from '../os/BroadcastBus';

let unregister: (() => void) | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TimeService.fromLocalParts(2026, 9, 6, 9, 0, 30));
  vi.stubGlobal('window', { setTimeout, clearTimeout });
  TimeService.setSpeed(1);
});
afterEach(() => {
  unregister?.();
  unregister = undefined;
  TimeService.useSimulatedTime('2026-10-06 09:00:30', false);
  TimeService.setSpeed(1);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('TIME_TICK scheduling', () => {
  it.each([
    ['real', 0.5], ['real', 1], ['real', 10],
    ['simulated', 0.5], ['simulated', 1], ['simulated', 10],
  ] as const)('aligns %s time to minute boundaries at speed %s', async (mode, speed) => {
    if (mode === 'simulated') TimeService.useSimulatedTime('2026-10-06 09:00:30', true);
    else TimeService.useRealTime();
    TimeService.setSpeed(speed);
    const ticks: number[] = [];
    unregister = BroadcastBus.registerReceiver(ACTION_TIME_TICK, () => ticks.push(TimeService.getDate().getMinutes()));
    const delay = 30_000 / speed;
    await vi.advanceTimersByTimeAsync(delay - 1);
    expect(ticks).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(ticks).toEqual([1]);
    await vi.advanceTimersByTimeAsync(60_000 / speed);
    expect(ticks).toEqual([1, 2]);
  });

  it('reschedules at the current boundary when speed changes', async () => {
    TimeService.useSimulatedTime('2026-10-06 09:00:30', true);
    const ticks: number[] = [];
    unregister = BroadcastBus.registerReceiver(ACTION_TIME_TICK, () => ticks.push(TimeService.getDate().getMinutes()));
    await vi.advanceTimersByTimeAsync(10_000);
    TimeService.setSpeed(10);
    await vi.advanceTimersByTimeAsync(1999);
    expect(ticks).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(ticks).toEqual([1]);
  });

  it('does not tick when frozen, and resumes at the next boundary', async () => {
    TimeService.useSimulatedTime('2026-10-06 09:00:30', false);
    TimeService.setSpeed(10);
    const ticks: number[] = [];
    unregister = BroadcastBus.registerReceiver(ACTION_TIME_TICK, () => ticks.push(TimeService.getDate().getMinutes()));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(ticks).toEqual([]);
    TimeService.setFlowing(true);
    await vi.advanceTimersByTimeAsync(3000);
    expect(ticks).toEqual([1]);
  });
});
