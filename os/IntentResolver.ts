import type { ActivityInstance, AppId, OSState } from './types';
import type { ActivityResult, AppIntentFilter, IntentPayload } from './types/manifest';
import { SIMULATOR_CONFIG } from './data';
import PackageManagerService from './PackageManagerService';
import { getActiveTask, getTaskTopActivity } from './taskUtils';
import { AppNavigatorRegistry } from './AppNavigatorRegistry';

type ChooserListener = (state: IntentChooserState) => void;

export interface IntentChooserState {
  open: boolean;
  intent: IntentPayload | null;
  matches: { appId: AppId; filter: AppIntentFilter }[];
}

export interface StartActivityDeps {
  getState: () => OSState;
  nextActivityId: () => string;
  allocRequestCode: (callerActivityId: string, callback: (result: ActivityResult) => void) => number;
  pushActivity: (taskId: string, activity: ActivityInstance) => void;
  navigateToActivity: (activityId: string, route: string, opts?: { fallbackAppId?: AppId; replace?: boolean }) => void;
}

export interface StartActivityPlainDeps {
  getState: () => OSState;
  nextActivityId: () => string;
  pushActivity: (taskId: string, activity: ActivityInstance) => void;
  popActivity: (taskId: string) => void;
  navigateToActivity: (activityId: string, route: string, opts?: { fallbackAppId?: AppId; replace?: boolean }) => void;
  launchApp: (appId: AppId) => void;
  markExternalRoute: (appId: AppId) => void;
  setActivityIntent: (taskId: string, activityId: string, intent: IntentPayload) => void;
}

const chooserListeners = new Set<ChooserListener>();
let chooserResolver: ((appId: AppId | null) => void) | null = null;
let chooserState: IntentChooserState = {
  open: false,
  intent: null,
  matches: [],
};

function buildIntentDebugStack(tag: string): string {
  try {
    throw new Error(tag);
  } catch (error) {
    if (!(error instanceof Error) || !error.stack) return 'n/a';
    return error.stack
      .split('\n')
      .slice(1, 5)
      .map((line) => line.trim())
      .join(' <- ');
  }
}

function emitChooser() {
  for (const listener of chooserListeners) listener(chooserState);
}

function setChooser(next: IntentChooserState) {
  chooserState = next;
  emitChooser();
}

function matchesType(filterType: string | undefined, intentType: string | undefined) {
  if (!filterType) return true;
  if (!intentType) return false;
  if (filterType.endsWith('/*')) return intentType.startsWith(filterType.slice(0, -1));
  return filterType === intentType;
}

function matchesScheme(filterScheme: string | undefined, intentScheme: string | undefined) {
  if (!filterScheme) return true;
  return filterScheme === intentScheme;
}

function pickTargetFilter(appId: AppId, intent: IntentPayload) {
  const targetManifest = PackageManagerService.getPackageInfo(appId);
  const filters = targetManifest?.intentFilters ?? [];
  return filters.find(
    (f) => f.action === intent.action
      && matchesScheme(f.scheme, intent.scheme)
      && matchesType(f.type, intent.type),
  );
}

function ensureCallerQueryVisible(callerAppId: AppId, intent: IntentPayload) {
  const callerManifest = PackageManagerService.getPackageInfo(callerAppId);
  if (!callerManifest) return;
  const queries = callerManifest.queries ?? [];
  const queryOk = queries.some((q) =>
    q.action === intent.action
    && matchesScheme(q.scheme, intent.scheme)
    && matchesType(q.type, intent.type),
  );
  if (!queryOk) {
    console.warn(
      `[OS] startActivityForResult: ${callerAppId} does not declare queries for action=${intent.action} scheme=${intent.scheme ?? '-'} type=${intent.type ?? '-'}`
    );
  }
}

function requestIntentChoice(
  intent: IntentPayload,
  matches: { appId: AppId; filter: AppIntentFilter }[],
): Promise<AppId | null> {
  return new Promise((resolve) => {
    if (chooserResolver) {
      resolve(null);
      return;
    }
    chooserResolver = resolve;
    setChooser({ open: true, intent, matches });
  });
}

function launchResolvedIntentForResult(
  appId: AppId,
  callerAppId: AppId,
  intent: IntentPayload,
  callback: (result: ActivityResult) => void,
  deps: StartActivityDeps,
): boolean {
  if (!PackageManagerService.isInstalled(appId)) {
    console.error(`[OS] startActivityForResult: Invalid appId: ${appId}`);
    return false;
  }

  ensureCallerQueryVisible(callerAppId, intent);
  const targetFilter = pickTargetFilter(appId, intent);
  if (!targetFilter && !intent.route) {
    console.error(
      `[OS] startActivityForResult: 无法解析 intent — ${appId} 没有匹配的 intentFilter，`
      + `且 intent 未提供 route (action=${intent.action} scheme=${intent.scheme ?? '-'} type=${intent.type ?? '-'})`,
    );
    return false;
  }
  if (!targetFilter) {
    console.warn(
      `[OS] startActivityForResult: ${appId} has no intentFilter for action=${intent.action} scheme=${intent.scheme ?? '-'} type=${intent.type ?? '-'}, using intent.route fallback`,
    );
  }

  const activeTask = getActiveTask(deps.getState());
  if (!activeTask) {
    console.error('[OS] startActivityForResult: No active task');
    return false;
  }
  const callerActivity = getTaskTopActivity(activeTask);
  if (!callerActivity) {
    console.error('[OS] startActivityForResult: No caller activity');
    return false;
  }

  const requestCode = deps.allocRequestCode(callerActivity.activityId, callback);
  // 调用方 intent.route 优先于 manifest filter.route。
  // 真机对应：filter 决定哪个 Activity 接收，调用方通过 intent extras / data 决定 Activity 内部细节；
  // 我们把 route 当成"caller hint"暴露出来，让调用方一次性指明目标子页（如 Settings → FM /category/images），
  // 避免 OS 先 navigate('/') 又被 App-side dispatcher replace 到子页的双跳竞态。
  // 缺省（未指定 intent.route）时仍走 filter.route。
  const baseRoute = intent.route ?? targetFilter?.route ?? '/';

  const newActivity: ActivityInstance = {
    activityId: deps.nextActivityId(),
    appId,
    initialRoute: baseRoute,
    intent,
    requestCode,
    callerActivityId: callerActivity.activityId,
  };

  console.log(
    `[OSDBG] startActivityForResult caller=${callerAppId} target=${appId} route=${baseRoute} `
    + `action=${intent.action} scheme=${intent.scheme ?? '-'} type=${intent.type ?? '-'} `
    + `stack=${buildIntentDebugStack('startActivityForResult')}`,
  );
  console.log(`[OS] startActivityForResult: ${callerAppId} → ${appId} route=${baseRoute}`);
  deps.pushActivity(activeTask.taskId, newActivity);
  deps.navigateToActivity(newActivity.activityId, baseRoute, { fallbackAppId: newActivity.appId });
  return true;
}

function launchResolvedIntent(
  appId: AppId,
  callerAppId: AppId,
  intent: IntentPayload,
  newTask: boolean,
  deps: StartActivityPlainDeps,
): boolean {
  if (!PackageManagerService.isInstalled(appId)) {
    console.error(`[OS] startActivity: Invalid appId: ${appId}`);
    return false;
  }

  ensureCallerQueryVisible(callerAppId, intent);
  const targetFilter = pickTargetFilter(appId, intent);
  if (!targetFilter && !intent.route) {
    console.error(
      `[OS] startActivity: 无法解析 intent — ${appId} 没有匹配的 intentFilter，`
      + `且 intent 未提供 route (action=${intent.action} scheme=${intent.scheme ?? '-'} type=${intent.type ?? '-'})`,
    );
    return false;
  }

  // 同 forResult 路径：intent.route 优先（caller hint 一次性指明目标子页），缺省走 filter.route。
  const baseRoute = intent.route ?? targetFilter?.route ?? '/';

  const enrichedIntent: IntentPayload = {
    ...intent,
    data: { ...intent.data, __callerAppId: callerAppId },
  };

  // 接收方声明 launchMode='singleTask' 时，强制 promote 到 newTask 路径，对应真机
  // "Activity 上的 launchMode 由接收方决定，凌驾于调用方 flag" 的语义：
  // 即使调用方没传 FLAG_ACTIVITY_NEW_TASK，singleTask Activity 也始终落在自己的 task 里。
  // 典型例子：12306 不传 newTask 调 startActivity(ACTION_VIEW + scheme=sms)，SMS 仍然进入自己的独立 task。
  const launchMode = targetFilter?.launchMode ?? 'standard';
  const effectiveNewTask = newTask || launchMode === 'singleTask';

  console.log(
    `[OSDBG] startActivity caller=${callerAppId} target=${appId} route=${baseRoute} newTask=${String(newTask)} `
    + `effectiveNewTask=${String(effectiveNewTask)} launchMode=${launchMode} `
    + `action=${intent.action} scheme=${intent.scheme ?? '-'} type=${intent.type ?? '-'} `
    + `stack=${buildIntentDebugStack('startActivity')}`,
  );

  if (effectiveNewTask) {
    const callerTaskId = getActiveTask(deps.getState())?.taskId;
    const taskExisted = deps.getState().tasks.some((t) => t.rootAppId === appId);

    // singleTask + 已存在 Task：清栈到 root + 重置 root 历史 + 重新投递 intent。
    // 对应真机 Activity 上 launchMode="singleTask" 的语义。
    if (launchMode === 'singleTask' && taskExisted) {
      const existingTask = deps.getState().tasks.find((t) => t.rootAppId === appId);
      if (!existingTask || existingTask.stack.length === 0) return false;

      // Pop 掉 root 之上所有 Activity（含 foreign-task 借栈来的）。
      while (true) {
        const cur = deps.getState().tasks.find((t) => t.rootAppId === appId);
        if (!cur || cur.stack.length <= 1) break;
        deps.popActivity(cur.taskId);
      }

      const refreshedTask = deps.getState().tasks.find((t) => t.rootAppId === appId);
      if (!refreshedTask || refreshedTask.stack.length === 0) return false;
      const rootActivity = refreshedTask.stack[0];

      // 把 enrichedIntent 投递到 root activity（ShareForwardPage 通过 getIntentPayload 读取）。
      deps.setActivityIntent(refreshedTask.taskId, rootActivity.activityId, enrichedIntent);

      // 把 wechat Task 切到前台。LAUNCH_APP 不会动其它 task — Gallery Task 仍保留在后台。
      deps.launchApp(appId);

      // 重置 MemoryRouter 历史到 ['/', baseRoute]：先 popToRoot 退回 '/'，再 push baseRoute。
      requestAnimationFrame(() => {
        // rAF 间隙里 task 可能被外部 closeTask 移除（如用户立刻在 recents 里划掉）。
        // 此时 navigator 可能尚未走完 React 异步 unregister，仍能拿到引用，但不该再操作已关闭的 Task。
        const stillExists = deps.getState().tasks.some((t) => t.rootAppId === appId);
        if (!stillExists) {
          console.warn(`[OS] startActivity(singleTask): ${appId} task closed before rAF — aborting nav reset`);
          return;
        }
        const nav = AppNavigatorRegistry.get(appId);
        if (!nav) {
          console.warn(`[OS] startActivity(singleTask): navigator not registered for ${appId}`);
          return;
        }
        if (nav.popToRoot) {
          nav.popToRoot();
        } else {
          // Older AppNavigator without popToRoot — fallback to replace
          nav.navigate('/', { replace: true });
        }
        nav.navigate(baseRoute, { replace: false });
      });

      console.log(`[OS] startActivity: ${callerAppId} → ${appId} route=${baseRoute} (singleTask, reused)`);
      return true;
    }

    deps.launchApp(appId);
    if (!taskExisted) {
      deps.markExternalRoute(appId);
    }

    // Zustand dispatch is synchronous — locate the target activity immediately.
    // Reverse-search for the activity belonging to appId (the stack top may be
    // another app's activity pushed via same-task mode).
    const postState = deps.getState();
    const task = postState.tasks.find((t) => t.rootAppId === appId);
    if (!task || task.stack.length === 0) return false;

    if (!taskExisted) {
      const targetActivity =
        [...task.stack].reverse().find((act) => act.appId === appId)
        ?? task.stack[task.stack.length - 1];

      deps.setActivityIntent(task.taskId, targetActivity.activityId, enrichedIntent);

      const targetActivityId = targetActivity.activityId;
      // singleTask 新建 Task 时用 push 模式，使根 Activity 历史为 ['/', baseRoute]，
      // 完成后 replace 到结果路由形成 ['/', resultRoute]，返回键能回到主页 '/'.
      // 默认 standard 走 replace（历史为 [baseRoute]），保持 ACTION_PAY 等"finish 即回调用方"的精确语义。
      const replaceMode = launchMode !== 'singleTask';
      requestAnimationFrame(() => {
        deps.navigateToActivity(targetActivityId, baseRoute, { replace: replaceMode, fallbackAppId: appId });
      });
    } else {
      const newActivity: ActivityInstance = {
        activityId: deps.nextActivityId(),
        appId,
        initialRoute: baseRoute,
        launchedByTaskId: callerTaskId,
        intent: enrichedIntent,
      };

      deps.pushActivity(task.taskId, newActivity);

      requestAnimationFrame(() => {
        deps.navigateToActivity(newActivity.activityId, baseRoute, { fallbackAppId: appId });
      });
    }

    console.log(`[OS] startActivity: ${callerAppId} → ${appId} route=${baseRoute} (newTask)`);
    return true;
  }

  // Same-task mode: push new Activity into caller's Task
  const activeTask = getActiveTask(deps.getState());
  if (!activeTask) {
    console.error('[OS] startActivity: No active task');
    return false;
  }

  const newActivity: ActivityInstance = {
    activityId: deps.nextActivityId(),
    appId,
    initialRoute: baseRoute,
    intent: enrichedIntent,
  };

  console.log(`[OS] startActivity: ${callerAppId} → ${appId} route=${baseRoute} (sameTask)`);
  deps.pushActivity(activeTask.taskId, newActivity);
  deps.navigateToActivity(newActivity.activityId, baseRoute, { fallbackAppId: newActivity.appId });
  return true;
}

export const IntentResolver = {
  getState(): IntentChooserState {
    return chooserState;
  },

  subscribe(listener: ChooserListener): () => void {
    chooserListeners.add(listener);
    listener(chooserState);
    return () => chooserListeners.delete(listener);
  },

  chooseIntentActivity(appId: AppId): void {
    const resolver = chooserResolver;
    chooserResolver = null;
    setChooser({ open: false, intent: null, matches: [] });
    if (resolver) resolver(appId);
  },

  cancelIntentChooser(): void {
    const resolver = chooserResolver;
    chooserResolver = null;
    setChooser({ open: false, intent: null, matches: [] });
    if (resolver) resolver(null);
  },

  startActivityForResult(
    appIdOrIntent: AppId | string | IntentPayload,
    intentOrCallback: IntentPayload | ((result: ActivityResult) => void) | undefined,
    callbackOrUndefined: ((result: ActivityResult) => void) | undefined,
    deps: StartActivityDeps,
  ): boolean {
    let appId: AppId | null = null;
    let intent: IntentPayload;
    let callback: (result: ActivityResult) => void;

    if (typeof appIdOrIntent === 'string') {
      appId = appIdOrIntent as AppId;
      intent = intentOrCallback as IntentPayload;
      callback = callbackOrUndefined!;
    } else if (typeof appIdOrIntent === 'object' && appIdOrIntent && 'action' in appIdOrIntent) {
      intent = appIdOrIntent;
      callback = intentOrCallback as (result: ActivityResult) => void;
      const matches = PackageManagerService.queryIntentActivities(intent);
      if (matches.length === 0) {
        console.error(
          `[OS] startActivityForResult: 隐式解析无匹配 — action=${intent.action} scheme=${intent.scheme ?? '-'} type=${intent.type ?? '-'}`
        );
        return false;
      }
      if (matches.length > 1 && SIMULATOR_CONFIG.intent.chooserEnabled) {
        if (chooserResolver) {
          return false;
        }
        const activeTask = getActiveTask(deps.getState());
        const top = getTaskTopActivity(activeTask);
        const callerAppId = top?.appId ?? null;
        if (!callerAppId) {
          console.error('[OS] startActivityForResult: No active app');
          return false;
        }
        void requestIntentChoice(intent, matches).then((chosen) => {
          if (!chosen) {
            requestAnimationFrame(() => callback({ resultCode: 'CANCELED' }));
            return;
          }
          launchResolvedIntentForResult(chosen, callerAppId, intent, callback, deps);
        });
        return true;
      }
      appId = matches[0].appId;
      console.log(`[OS] startActivityForResult: 隐式解析 → ${appId} (共 ${matches.length} 个匹配)`);
    } else {
      console.error('[OS] startActivityForResult: 参数格式错误');
      return false;
    }

    if (typeof callback !== 'function') {
      console.error('[OS] startActivityForResult: callback is required');
      return false;
    }

    if (!appId) {
      console.error('[OS] startActivityForResult: Invalid appId');
      return false;
    }

    const activeTask = getActiveTask(deps.getState());
    if (!activeTask) {
      console.error('[OS] startActivityForResult: No active task');
      return false;
    }

    const callerActivity = getTaskTopActivity(activeTask);
    if (!callerActivity) {
      console.error('[OS] startActivityForResult: No caller activity');
      return false;
    }
    const callerAppId = callerActivity.appId;
    return launchResolvedIntentForResult(appId, callerAppId, intent, callback, deps);
  },

  startActivity(
    appIdOrIntent: AppId | string | IntentPayload,
    intentOrOptions: IntentPayload | { newTask?: boolean } | undefined,
    optionsOrUndefined: { newTask?: boolean } | undefined,
    deps: StartActivityPlainDeps,
  ): boolean {
    let appId: AppId | null = null;
    let intent: IntentPayload;
    let newTask = false;

    if (typeof appIdOrIntent === 'string') {
      appId = appIdOrIntent as AppId;
      intent = intentOrOptions as IntentPayload;
      newTask = !!optionsOrUndefined?.newTask;
    } else if (typeof appIdOrIntent === 'object' && appIdOrIntent && 'action' in appIdOrIntent) {
      intent = appIdOrIntent;
      const opts = intentOrOptions as { newTask?: boolean } | undefined;
      newTask = !!opts?.newTask;

      const matches = PackageManagerService.queryIntentActivities(intent);
      if (matches.length === 0) {
        console.error(
          `[OS] startActivity: 隐式解析无匹配 — action=${intent.action} scheme=${intent.scheme ?? '-'} type=${intent.type ?? '-'}`
        );
        return false;
      }
      if (matches.length > 1 && SIMULATOR_CONFIG.intent.chooserEnabled) {
        if (chooserResolver) return false;
        const activeTask = getActiveTask(deps.getState());
        const top = getTaskTopActivity(activeTask);
        const callerAppId = top?.appId ?? null;
        if (!callerAppId) {
          console.error('[OS] startActivity: No active app');
          return false;
        }
        void requestIntentChoice(intent, matches).then((chosen) => {
          if (!chosen) return;
          launchResolvedIntent(chosen, callerAppId, intent, newTask, deps);
        });
        return true;
      }
      appId = matches[0].appId;
      console.log(`[OS] startActivity: 隐式解析 → ${appId} (共 ${matches.length} 个匹配)`);
    } else {
      console.error('[OS] startActivity: 参数格式错误');
      return false;
    }

    if (!appId) {
      console.error('[OS] startActivity: Invalid appId');
      return false;
    }

    const activeTask = getActiveTask(deps.getState());
    if (!activeTask) {
      console.error('[OS] startActivity: No active task');
      return false;
    }
    const callerActivity = getTaskTopActivity(activeTask);
    if (!callerActivity) {
      console.error('[OS] startActivity: No caller activity');
      return false;
    }
    return launchResolvedIntent(appId, callerActivity.appId, intent, newTask, deps);
  },
};

export default IntentResolver;
