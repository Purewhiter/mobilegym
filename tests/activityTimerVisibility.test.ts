import { describe, expect, it } from 'vitest';
import { isActivityForeground } from '../os/hooks/useAppVisibleTimers';
import { TaskManager } from '../os/TaskManager';
import type { OSState } from '../os/types';

function state(overrides: Partial<OSState> = {}): OSState {
  return {
    ...TaskManager.getState(),
    isLauncherVisible: false,
    isRecentsVisible: false,
    activeTaskId: 'task_1',
    tasks: [{
      taskId: 'task_1', rootAppId: 'spotify', lastActiveAt: 0,
      stack: [
        { activityId: 'act_1', appId: 'spotify', initialRoute: '/' },
        { activityId: 'act_2', appId: 'spotify', initialRoute: '/' },
      ],
    }],
    ...overrides,
  };
}

describe('activity timer visibility', () => {
  it('only the top instance of the same app ticks', () => {
    expect(isActivityForeground(state(), 'act_1')).toBe(false);
    expect(isActivityForeground(state(), 'act_2')).toBe(true);
  });
  it('home pauses even an otherwise active task', () => {
    expect(isActivityForeground(state({ isLauncherVisible: true }), 'act_2')).toBe(false);
  });
  it('recents pauses the active task preview', () => {
    expect(isActivityForeground(state({ isRecentsVisible: true }), 'act_2')).toBe(false);
  });
  it('a removed task cannot tick', () => {
    expect(isActivityForeground(state({ tasks: [], activeTaskId: null }), 'act_2')).toBe(false);
  });
});
