import { describe, it, expect } from 'vitest';
import type { OSState, Task, ActivityInstance } from '../os/types';

/**
 * We test TaskManager indirectly via its dispatch methods
 * and define the reducer behavior specs here via state transitions.
 */

function mkTask(taskId: string, appId: string, lastActiveAt: number): Task {
  return {
    taskId,
    rootAppId: appId,
    stack: [{ activityId: `${taskId}_root`, appId, initialRoute: '/' }],
    lastActiveAt,
  };
}

function emptyState(): OSState {
  return {
    tasks: [],
    activeTaskId: null,
    isLauncherVisible: true,
    isRecentsVisible: false,
  };
}

describe('OS state transitions (via TaskManager)', () => {
  /**
   * Use a dynamic import approach to get the TaskManager module.
   * Since it's a singleton with internal sequences, each test should be
   * aware of cumulative state — or we call reset().
   */
  async function getTaskManager() {
    const mod = await import('../os/TaskManager');
    const tm = mod.TaskManager;
    tm.reset();
    return tm;
  }

  it('starts with launcher visible and no tasks', async () => {
    const tm = await getTaskManager();
    const state = tm.getState();
    expect(state.tasks).toEqual([]);
    expect(state.activeTaskId).toBeNull();
    expect(state.isLauncherVisible).toBe(true);
  });

  it('launchApp creates a new task and hides launcher', async () => {
    const tm = await getTaskManager();
    tm.launchApp('wechat');
    const state = tm.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].rootAppId).toBe('wechat');
    expect(state.activeTaskId).toBe(state.tasks[0].taskId);
    expect(state.isLauncherVisible).toBe(false);
  });

  it('launchApp same app reuses existing task', async () => {
    const tm = await getTaskManager();
    tm.launchApp('settings');
    const firstTaskId = tm.getState().tasks[0].taskId;
    tm.launchApp('settings');
    const state = tm.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].taskId).toBe(firstTaskId);
  });

  it('launchApp different app creates separate tasks', async () => {
    const tm = await getTaskManager();
    tm.launchApp('wechat');
    tm.launchApp('alipay');
    const state = tm.getState();
    expect(state.tasks).toHaveLength(2);
    expect(state.activeTaskId).toBe(state.tasks[1].taskId);
  });

  it('goHome sets launcher visible and clears active task', async () => {
    const tm = await getTaskManager();
    tm.launchApp('wechat');
    tm.goHome();
    const state = tm.getState();
    expect(state.activeTaskId).toBeNull();
    expect(state.isLauncherVisible).toBe(true);
  });

  it('showRecents sets recents visible', async () => {
    const tm = await getTaskManager();
    tm.launchApp('wechat');
    tm.showRecents();
    const state = tm.getState();
    expect(state.isRecentsVisible).toBe(true);
    expect(state.isLauncherVisible).toBe(false);
  });

  it('closeTask removes the task and shows launcher if it was active', async () => {
    const tm = await getTaskManager();
    tm.launchApp('wechat');
    const taskId = tm.getState().tasks[0].taskId;
    tm.closeTask(taskId);
    const state = tm.getState();
    expect(state.tasks).toHaveLength(0);
    expect(state.activeTaskId).toBeNull();
    expect(state.isLauncherVisible).toBe(true);
  });

  it('closeTask non-active task does not change activeTaskId', async () => {
    const tm = await getTaskManager();
    tm.launchApp('wechat');
    tm.launchApp('alipay');
    const wechatTaskId = tm.getState().tasks[0].taskId;
    const alipayTaskId = tm.getState().tasks[1].taskId;
    tm.closeTask(wechatTaskId);
    const state = tm.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.activeTaskId).toBe(alipayTaskId);
  });

  it('pushActivity adds activity to task stack', async () => {
    const tm = await getTaskManager();
    tm.launchApp('wechat');
    const taskId = tm.getState().tasks[0].taskId;
    const newActivity: ActivityInstance = {
      activityId: 'test_act_push',
      appId: 'gallery',
      initialRoute: '/pick',
    };
    tm.pushActivity(taskId, newActivity);
    const state = tm.getState();
    const task = state.tasks[0];
    expect(task.stack).toHaveLength(2);
    expect(task.stack[1].activityId).toBe('test_act_push');
  });

  it('popActivity removes top activity from stack', async () => {
    const tm = await getTaskManager();
    tm.launchApp('wechat');
    const taskId = tm.getState().tasks[0].taskId;
    const newActivity: ActivityInstance = {
      activityId: 'test_act_pop',
      appId: 'gallery',
      initialRoute: '/pick',
    };
    tm.pushActivity(taskId, newActivity);
    tm.popActivity(taskId);
    const state = tm.getState();
    expect(state.tasks[0].stack).toHaveLength(1);
  });

  it('popActivity on single-activity task removes the entire task', async () => {
    const tm = await getTaskManager();
    tm.launchApp('wechat');
    const taskId = tm.getState().tasks[0].taskId;
    tm.popActivity(taskId);
    const state = tm.getState();
    expect(state.tasks).toHaveLength(0);
    expect(state.isLauncherVisible).toBe(true);
  });

  it('activateTask switches active task', async () => {
    const tm = await getTaskManager();
    tm.launchApp('wechat');
    tm.launchApp('alipay');
    const wechatTaskId = tm.getState().tasks[0].taskId;
    tm.activateTask(wechatTaskId);
    expect(tm.getState().activeTaskId).toBe(wechatTaskId);
  });

  it('reset restores initial state', async () => {
    const tm = await getTaskManager();
    tm.launchApp('wechat');
    tm.reset();
    const state = tm.getState();
    expect(state.tasks).toEqual([]);
    expect(state.activeTaskId).toBeNull();
    expect(state.isLauncherVisible).toBe(true);
  });

  it('subscribe is called immediately with current state', async () => {
    const tm = await getTaskManager();
    let called = false;
    const unsub = tm.subscribe((s) => { called = true; });
    expect(called).toBe(true);
    unsub();
  });
});
