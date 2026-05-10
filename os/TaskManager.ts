import type { ActivityResult, IntentPayload } from './types/manifest';
import type { ActivityInstance, AppId, OSState, Task } from './types';
import { createVolatileOsStore } from './createOsStore';

export type OSAction =
  | { type: 'LAUNCH_APP'; appId: AppId; timestamp: number; newTask: Task }
  | { type: 'ACTIVATE_TASK'; taskId: string; timestamp: number }
  | { type: 'GO_HOME' }
  | { type: 'SHOW_RECENTS' }
  | { type: 'CLOSE_TASK'; taskId: string }
  | { type: 'PUSH_ACTIVITY'; taskId: string; activity: ActivityInstance; timestamp: number }
  | { type: 'POP_ACTIVITY'; taskId: string }
  | { type: 'MARK_EXTERNAL_ROUTE'; appId: AppId }
  | { type: 'SET_ACTIVITY_INTENT'; taskId: string; activityId: string; intent: IntentPayload }
  | { type: 'CONSUME_LAUNCHED_BY'; taskId: string }
  | { type: 'RESET'; state?: OSState | any };

function createInitialState(): OSState {
  return {
    tasks: [],
    activeTaskId: null,
    isLauncherVisible: true,
    isRecentsVisible: false,
  };
}

function coerceResetState(raw: any): OSState {
  if (raw && Array.isArray(raw.tasks)) {
    return {
      tasks: raw.tasks,
      activeTaskId: raw.activeTaskId ?? null,
      isLauncherVisible: !!raw.isLauncherVisible,
      isRecentsVisible: !!raw.isRecentsVisible,
    };
  }
  return createInitialState();
}

function osReducer(state: OSState, action: OSAction): OSState {
  switch (action.type) {
    case 'LAUNCH_APP': {
      const callerTaskId = state.activeTaskId ?? undefined;
      const existing = state.tasks.find((task) => task.rootAppId === action.appId);
      if (existing) {
        return {
          ...state,
          tasks: state.tasks.map((task) =>
            task.taskId === existing.taskId
              ? {
                  ...task,
                  lastActiveAt: action.timestamp,
                  // From Launcher (no caller): clear launchedByTaskId so Back goes Home.
                  // Exception: externally-routed transient tasks (e.g. payment flows)
                  // must preserve their caller relationship even if resumed from launcher,
                  // so finishing the top activity can still return to the original app.
                  // From another app (has caller): DON'T update — the existing task's
                  // relationship is preserved; the pushed route is handled by the app's
                  // own back handler, matching Android's behavior where bringing an
                  // existing task to foreground doesn't change its back-stack origin.
                  ...(!callerTaskId && !task.wasExternallyRouted ? { launchedByTaskId: undefined } : {}),
                }
              : task),
          activeTaskId: existing.taskId,
          isLauncherVisible: false,
          isRecentsVisible: false,
        };
      }

      return {
        ...state,
        tasks: [...state.tasks, { ...action.newTask, launchedByTaskId: callerTaskId }],
        activeTaskId: action.newTask.taskId,
        isLauncherVisible: false,
        isRecentsVisible: false,
      };
    }

    case 'ACTIVATE_TASK': {
      const exists = state.tasks.some((task) => task.taskId === action.taskId);
      if (!exists) return state;
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.taskId === action.taskId ? { ...task, lastActiveAt: action.timestamp } : task),
        activeTaskId: action.taskId,
        isLauncherVisible: false,
        isRecentsVisible: false,
      };
    }

    case 'GO_HOME':
      return {
        ...state,
        activeTaskId: null,
        isLauncherVisible: true,
        isRecentsVisible: false,
      };

    case 'SHOW_RECENTS':
      return {
        ...state,
        isRecentsVisible: true,
        isLauncherVisible: false,
      };

    case 'CLOSE_TASK': {
      const target = state.tasks.find((task) => task.taskId === action.taskId);
      if (!target) return state;

      const nextTasks = state.tasks.filter((task) => task.taskId !== action.taskId);
      const wasActive = state.activeTaskId === action.taskId;
      // When dismissing a task from the recents screen, stay in recents
      // (unless it was the last task — handled by the caller via goHome).
      const stayInRecents = state.isRecentsVisible && nextTasks.length > 0;
      return {
        ...state,
        tasks: nextTasks,
        activeTaskId: wasActive ? null : state.activeTaskId,
        isLauncherVisible: stayInRecents ? false : (wasActive ? true : state.isLauncherVisible),
        isRecentsVisible: stayInRecents ? true : (wasActive ? false : state.isRecentsVisible),
      };
    }

    case 'PUSH_ACTIVITY': {
      const exists = state.tasks.some((task) => task.taskId === action.taskId);
      if (!exists) return state;

      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.taskId === action.taskId
            ? { ...task, stack: [...task.stack, action.activity], lastActiveAt: action.timestamp }
            : task),
        activeTaskId: action.taskId,
        isLauncherVisible: false,
        isRecentsVisible: false,
      };
    }

    case 'POP_ACTIVITY': {
      const task = state.tasks.find((t) => t.taskId === action.taskId);
      if (!task || task.stack.length === 0) return state;

      const nextStack = task.stack.slice(0, -1);
      if (nextStack.length === 0) {
        const nextTasks = state.tasks.filter((t) => t.taskId !== action.taskId);
        const wasActive = state.activeTaskId === action.taskId;
        return {
          ...state,
          tasks: nextTasks,
          activeTaskId: wasActive ? null : state.activeTaskId,
          isLauncherVisible: wasActive ? true : state.isLauncherVisible,
          isRecentsVisible: wasActive ? false : state.isRecentsVisible,
        };
      }

      return {
        ...state,
        tasks: state.tasks.map((t) => (t.taskId === action.taskId ? { ...t, stack: nextStack } : t)),
      };
    }

    case 'MARK_EXTERNAL_ROUTE': {
      const task = state.tasks.find((t) => t.rootAppId === action.appId);
      if (!task || task.wasExternallyRouted) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.taskId === task.taskId ? { ...t, wasExternallyRouted: true } : t),
      };
    }

    case 'SET_ACTIVITY_INTENT': {
      const task = state.tasks.find((t) => t.taskId === action.taskId);
      if (!task) return state;
      const idx = task.stack.findIndex((a) => a.activityId === action.activityId);
      if (idx < 0) return state;
      if (task.stack[idx].intent === action.intent) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.taskId === action.taskId
            ? {
                ...t,
                stack: t.stack.map((act, i) =>
                  i === idx ? { ...act, intent: action.intent } : act),
              }
            : t),
      };
    }

    case 'CONSUME_LAUNCHED_BY': {
      // 用户通过 launchedByTaskId 链回到 caller 后调用此 action，把源 task 的 launchedByTaskId 清掉。
      // 语义：launchedByTaskId 是一次性指针，用过即作废。再次通过 recents 进入此 task 后按返回，
      // 不应再沿原启动链跳回旧 caller，而是走默认的回桌面行为。
      const target = state.tasks.find((t) => t.taskId === action.taskId);
      if (!target || target.launchedByTaskId === undefined) return state;
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.taskId === action.taskId ? { ...t, launchedByTaskId: undefined } : t),
      };
    }

    case 'RESET':
      return action.state ? coerceResetState(action.state) : createInitialState();

    default:
      return state;
  }
}

const base = createVolatileOsStore<OSState>('taskManager', createInitialState());

let taskSeq = 0;
let activitySeq = 0;
let mruCounter = 0;
let requestCode = 0;

const pendingCallbacks = new Map<number, {
  callerActivityId: string;
  callback: (result: ActivityResult) => void;
}>();

function nextTaskId() {
  taskSeq += 1;
  return `task_${taskSeq}`;
}

function nextActivityId() {
  activitySeq += 1;
  return `act_${activitySeq}`;
}

function nextMruStamp() {
  mruCounter += 1;
  return mruCounter;
}

export const TaskManager = {
  getState: base.getState,

  subscribe(listener: (state: OSState) => void): () => void {
    listener(base.getState());
    return base.subscribe(listener);
  },

  dispatch(action: OSAction): void {
    const curr = base.getState();
    const next = osReducer(curr, action);
    if (next === curr) return;
    base.setState(next, true);
  },

  launchApp(appId: AppId): void {
    const taskId = nextTaskId();
    const activityId = nextActivityId();
    const stamp = nextMruStamp();
    TaskManager.dispatch({
      type: 'LAUNCH_APP',
      appId,
      timestamp: stamp,
      newTask: {
        taskId,
        rootAppId: appId,
        stack: [{ activityId, appId, initialRoute: '/' }],
        lastActiveAt: stamp,
      },
    });
  },

  activateTask(taskId: string): void {
    TaskManager.dispatch({ type: 'ACTIVATE_TASK', taskId, timestamp: nextMruStamp() });
  },

  closeTask(taskId: string): void {
    TaskManager.dispatch({ type: 'CLOSE_TASK', taskId });
  },

  goHome(): void {
    TaskManager.dispatch({ type: 'GO_HOME' });
  },

  showRecents(): void {
    TaskManager.dispatch({ type: 'SHOW_RECENTS' });
  },

  pushActivity(taskId: string, activity: ActivityInstance): void {
    TaskManager.dispatch({ type: 'PUSH_ACTIVITY', taskId, activity, timestamp: nextMruStamp() });
  },

  popActivity(taskId: string): void {
    TaskManager.dispatch({ type: 'POP_ACTIVITY', taskId });
  },

  markExternalRoute(appId: AppId): void {
    TaskManager.dispatch({ type: 'MARK_EXTERNAL_ROUTE', appId });
  },

  consumeLaunchedBy(taskId: string): void {
    TaskManager.dispatch({ type: 'CONSUME_LAUNCHED_BY', taskId });
  },

  setActivityIntent(taskId: string, activityId: string, intent: IntentPayload): void {
    TaskManager.dispatch({ type: 'SET_ACTIVITY_INTENT', taskId, activityId, intent });
  },

  nextTaskId,
  nextActivityId,
  nextMruStamp,

  allocRequestCode(callerActivityId: string, callback: (result: ActivityResult) => void): number {
    requestCode += 1;
    pendingCallbacks.set(requestCode, { callerActivityId, callback });
    return requestCode;
  },

  takePendingCallback(code: number) {
    const pending = pendingCallbacks.get(code);
    pendingCallbacks.delete(code);
    return pending;
  },

  cancelPendingForTask(task: Task): void {
    for (const activity of task.stack) {
      if (activity.requestCode == null) continue;
      const pending = pendingCallbacks.get(activity.requestCode);
      pendingCallbacks.delete(activity.requestCode);
      if (pending) {
        requestAnimationFrame(() => pending.callback({ resultCode: 'CANCELED' }));
      }
    }
  },

  reset(state?: OSState | any): void {
    TaskManager.dispatch({ type: 'RESET', state });
  },
};

export default TaskManager;
