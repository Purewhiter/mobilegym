import { describe, it, expect } from 'vitest';
import {
  getChromeTaskSnapshot,
  areChromeTaskSnapshotsEqual,
  type ChromeTaskSnapshot,
} from '../os/components/chromeForeground';
import type { OSState, Task } from '../os/types';

// Behavior lock for the chrome-facing TaskManager snapshot helpers in
// os/components/chromeForeground.ts (originally extracted from os/SystemShell.tsx).
// These narrow OSState down to the 4 fields StatusBar/GestureBar care about, so
// chrome components skip re-renders on unrelated task-stack changes.

function mkTask(taskId: string, appId: string, lastActiveAt: number, stackSize = 1): Task {
  const stack = Array.from({ length: stackSize }, (_, i) => ({
    activityId: `${taskId}_act_${i}`,
    appId,
    initialRoute: '/',
  }));
  return { taskId, rootAppId: appId, stack, lastActiveAt };
}

function mkState(overrides: Partial<OSState> = {}): OSState {
  return {
    tasks: [],
    activeTaskId: null,
    isLauncherVisible: true,
    isRecentsVisible: false,
    brightness: 60,
    volume: 30,
    ...overrides,
  };
}

describe('getChromeTaskSnapshot', () => {
  it('captures top activity id and root app of the active task', () => {
    const state = mkState({
      tasks: [mkTask('t1', 'wechat', 1, 2), mkTask('t2', 'settings', 2)],
      activeTaskId: 't1',
      isLauncherVisible: false,
    });
    expect(getChromeTaskSnapshot(state)).toEqual({
      activeTopActivityId: 't1_act_1',
      activeRootAppId: 'wechat',
      isLauncherVisible: false,
      isRecentsVisible: false,
    });
  });

  it('returns nulls when no task is active (launcher visible)', () => {
    const state = mkState({ tasks: [mkTask('t1', 'wechat', 1)] });
    expect(getChromeTaskSnapshot(state)).toEqual({
      activeTopActivityId: null,
      activeRootAppId: null,
      isLauncherVisible: true,
      isRecentsVisible: false,
    });
  });

  it('returns nulls when activeTaskId points to a missing task', () => {
    const state = mkState({
      tasks: [mkTask('t1', 'wechat', 1)],
      activeTaskId: 'ghost',
      isRecentsVisible: true,
    });
    expect(getChromeTaskSnapshot(state)).toEqual({
      activeTopActivityId: null,
      activeRootAppId: null,
      isLauncherVisible: true,
      isRecentsVisible: true,
    });
  });
});

describe('areChromeTaskSnapshotsEqual', () => {
  const base: ChromeTaskSnapshot = {
    activeTopActivityId: 'a1',
    activeRootAppId: 'wechat',
    isLauncherVisible: false,
    isRecentsVisible: false,
  };

  it('is true for identical field values (different object identity)', () => {
    expect(areChromeTaskSnapshotsEqual(base, { ...base })).toBe(true);
  });

  it('is false when any single field differs', () => {
    const variants: ChromeTaskSnapshot[] = [
      { ...base, activeTopActivityId: 'a2' },
      { ...base, activeTopActivityId: null },
      { ...base, activeRootAppId: 'settings' },
      { ...base, activeRootAppId: null },
      { ...base, isLauncherVisible: true },
      { ...base, isRecentsVisible: true },
    ];
    for (const variant of variants) {
      expect(areChromeTaskSnapshotsEqual(base, variant)).toBe(false);
      expect(areChromeTaskSnapshotsEqual(variant, base)).toBe(false);
    }
  });

  it('treats all-null snapshots as equal (launcher idle state)', () => {
    const idle: ChromeTaskSnapshot = {
      activeTopActivityId: null,
      activeRootAppId: null,
      isLauncherVisible: true,
      isRecentsVisible: false,
    };
    expect(areChromeTaskSnapshotsEqual(idle, { ...idle })).toBe(true);
  });
});
