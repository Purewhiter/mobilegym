import { describe, it, expect } from 'vitest';
import {
  getTasksMRU,
  deriveRunningApps,
  getActiveTask,
  getTaskTopActivity,
  getActiveTopActivityId,
  getActiveAppId,
} from '../os/taskUtils';
import type { OSState, Task } from '../os/types';

function mkTask(taskId: string, appId: string, lastActiveAt: number, stackSize = 1): Task {
  const stack = Array.from({ length: stackSize }, (_, i) => ({
    activityId: `${taskId}_act_${i}`,
    appId,
    initialRoute: '/',
  }));
  return { taskId, rootAppId: appId, stack, lastActiveAt };
}

function mkState(tasks: Task[], activeTaskId: string | null = null): OSState {
  return {
    tasks,
    activeTaskId,
    isLauncherVisible: !activeTaskId,
    isRecentsVisible: false,
    brightness: 60,
    volume: 30,
  };
}

describe('getTasksMRU', () => {
  it('returns tasks sorted by lastActiveAt descending', () => {
    const tasks = [mkTask('t1', 'a', 1), mkTask('t2', 'b', 3), mkTask('t3', 'c', 2)];
    const sorted = getTasksMRU(tasks);
    expect(sorted.map(t => t.taskId)).toEqual(['t2', 't3', 't1']);
  });

  it('returns empty array for empty input', () => {
    expect(getTasksMRU([])).toEqual([]);
  });

  it('does not mutate the original array', () => {
    const tasks = [mkTask('t1', 'a', 2), mkTask('t2', 'b', 1)];
    const copy = [...tasks];
    getTasksMRU(tasks);
    expect(tasks).toEqual(copy);
  });
});

describe('deriveRunningApps', () => {
  it('returns unique app IDs in MRU order', () => {
    const tasks = [
      mkTask('t1', 'wechat', 1),
      mkTask('t2', 'settings', 3),
      mkTask('t3', 'wechat', 2),
    ];
    expect(deriveRunningApps(tasks)).toEqual(['settings', 'wechat']);
  });

  it('returns empty for no tasks', () => {
    expect(deriveRunningApps([])).toEqual([]);
  });
});

describe('getActiveTask', () => {
  it('returns the matching task when activeTaskId is set', () => {
    const tasks = [mkTask('t1', 'a', 1), mkTask('t2', 'b', 2)];
    const state = mkState(tasks, 't2');
    expect(getActiveTask(state)?.taskId).toBe('t2');
  });

  it('returns null when activeTaskId is null', () => {
    const state = mkState([mkTask('t1', 'a', 1)], null);
    expect(getActiveTask(state)).toBeNull();
  });

  it('returns null when activeTaskId does not match any task', () => {
    const state = mkState([mkTask('t1', 'a', 1)], 'nonexistent');
    expect(getActiveTask(state)).toBeNull();
  });
});

describe('getTaskTopActivity', () => {
  it('returns the last activity in the stack', () => {
    const task = mkTask('t1', 'a', 1, 3);
    const top = getTaskTopActivity(task);
    expect(top?.activityId).toBe('t1_act_2');
  });

  it('returns null for null/undefined task', () => {
    expect(getTaskTopActivity(null)).toBeNull();
    expect(getTaskTopActivity(undefined)).toBeNull();
  });

  it('returns null for task with empty stack', () => {
    const task: Task = { taskId: 't1', rootAppId: 'a', stack: [], lastActiveAt: 0 };
    expect(getTaskTopActivity(task)).toBeNull();
  });
});

describe('getActiveTopActivityId', () => {
  it('returns activity ID of the active task top', () => {
    const task = mkTask('t1', 'a', 1, 2);
    const state = mkState([task], 't1');
    expect(getActiveTopActivityId(state)).toBe('t1_act_1');
  });

  it('returns null when no active task', () => {
    const state = mkState([mkTask('t1', 'a', 1)], null);
    expect(getActiveTopActivityId(state)).toBeNull();
  });
});

describe('getActiveAppId', () => {
  it('returns the appId of the top activity of the active task', () => {
    const task = mkTask('t1', 'myapp', 1);
    const state = mkState([task], 't1');
    expect(getActiveAppId(state)).toBe('myapp');
  });

  it('returns null when no active task', () => {
    const state = mkState([], null);
    expect(getActiveAppId(state)).toBeNull();
  });
});
