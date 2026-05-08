import type { AppId, ActiveIntentEntry, OSState, Task } from './types';

export function getTasksMRU(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => b.lastActiveAt - a.lastActiveAt);
}

export function deriveRunningApps(tasks: Task[]): AppId[] {
  const seen = new Set<AppId>();
  const result: AppId[] = [];
  for (const task of getTasksMRU(tasks)) {
    if (!seen.has(task.rootAppId)) {
      seen.add(task.rootAppId);
      result.push(task.rootAppId);
    }
  }
  return result;
}

export function getActiveTask(state: OSState): Task | null {
  if (!state.activeTaskId) return null;
  return state.tasks.find(task => task.taskId === state.activeTaskId) ?? null;
}

export function getTaskTopActivity(task: Task | null | undefined) {
  if (!task || task.stack.length === 0) return null;
  return task.stack[task.stack.length - 1];
}

export function getActiveTopActivityId(state: OSState): string | null {
  const top = getTaskTopActivity(getActiveTask(state));
  return top?.activityId ?? null;
}

export function getActiveAppId(state: OSState): AppId | null {
  const top = getTaskTopActivity(getActiveTask(state));
  return top?.appId ?? null;
}

export function deriveIntentStack(tasks: Task[]): ActiveIntentEntry[] {
  const byRequestCode = new Map<number, ActiveIntentEntry>();

  for (const task of tasks) {
    for (const activity of task.stack) {
      if (activity.requestCode == null || !activity.intent) continue;

      const caller = activity.callerActivityId
        ? task.stack.find(a => a.activityId === activity.callerActivityId)
        : null;

      byRequestCode.set(activity.requestCode, {
        requestCode: activity.requestCode,
        callerAppId: caller?.appId ?? task.rootAppId,
        targetAppId: activity.appId,
        // 该字段无法从当前模型精确恢复，这里给 true 避免误清理
        wasTargetRunning: true,
        intent: activity.intent,
        resolvedRoute: activity.initialRoute,
      });
    }
  }

  return [...byRequestCode.values()].sort((a, b) => a.requestCode - b.requestCode);
}
