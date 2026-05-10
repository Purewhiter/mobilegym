import { useEffect, useRef, useContext } from 'react';
// UNSAFE_NavigationContext: react-router v7 no longer exposes MemoryHistory.entries,
// but still provides navigator.index. We use this to sync the shadow HistoryTracker
// that powers popTo. If a future version removes this context, the tracker init
// and UNSAFE_NavigationContext usage are confined to this file + app navigation.ts files.
import { useLocation, useNavigate, UNSAFE_NavigationContext } from 'react-router-dom';
import { AppNavigatorRegistry } from '../AppNavigatorRegistry';
import { AppLifecycle, type LifecycleEvent } from '../AppLifecycle';
import { BackDispatcher } from '../BackDispatcher';
import { useActivityContext } from '../ActivityContext';
import { TaskManager } from '../TaskManager';
import { useAppReady } from './useAppReady';
import { syncTracker, getTracker } from '../utils/memoryHistoryTracker';
import { memoryHistoryPopTo } from '../utils/memoryHistoryPopTo';

interface Options {
  onBack: () => boolean;
  onForeground?: () => void;
  onBackground?: () => void;
  onDestroy?: () => void;
  onNavigate?: (path: string, navigate: (nextPath: string) => void) => void;
}

interface NavOptions { replace?: boolean }

export function useAppNavigationHandler(appId: string, options: Options) {
  const navigate = useNavigate();
  const location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const { taskId } = useActivityContext();

  // Sync the shadow history tracker on every location change.
  useEffect(() => {
    syncTracker(navigator, location);
  }, [navigator, location.pathname, location.search, location.key]);

  const optionsRef = useRef(options);
  const routeRef = useRef<AppRouteInfo>({
    app: appId,
    path: location.pathname + location.search,
  });
  const navigateRef = useRef<(path: string, opts?: NavOptions) => void>(() => {});
  const isForegroundRef = useRef(false);

  optionsRef.current = options;

  useEffect(() => {
    routeRef.current = { app: appId, path: location.pathname + location.search };
  }, [appId, location.pathname, location.search]);

  useEffect(() => {
    const state = TaskManager.getState();
    const task = taskId ? state.tasks.find(t => t.taskId === taskId) : null;
    const isInForeignTask = task != null && task.rootAppId !== appId;

    if (isInForeignTask) {
      return;
    }

    navigateRef.current = (path: string, opts?: NavOptions) => {
      const shouldReplace = opts?.replace ?? true;
      const directNavigate = (nextPath: string) => navigate(nextPath, { replace: shouldReplace });
      if (optionsRef.current.onNavigate) {
        optionsRef.current.onNavigate(path, directNavigate);
        return;
      }
      directNavigate(path);
    };

    AppNavigatorRegistry.register(appId, {
      navigate: (path: string, opts?: NavOptions) => navigateRef.current(path, opts),
      back: () => {
        // 与下面 `app.back.${appId}` BackDispatcher 条目同样的 activeTask 校验。
        // OS 的 `os.appBack`（os/OSContext.tsx）通过 AppNavigatorRegistry.getBackHandler 直接取这个
        // 闭包，绕过 BackDispatcher 注册时的过滤；如果不在这里也加一遍，foreign-task push 同 appId
        // 的场景下背景 own-task 实例的 onBack 仍会被调用（消费别人的返回事件）。
        const state = TaskManager.getState();
        if (taskId && state.activeTaskId !== taskId) return false;
        return optionsRef.current.onBack();
      },
      route: () => routeRef.current,
      popToRoot: () => {
        const tracker = getTracker(navigator as object);
        if (tracker && tracker.findPopToDelta('/', false) >= 0) {
          memoryHistoryPopTo(navigator, '/', { inclusive: false });
          return true;
        }
        // Fallback: 历史中找不到 '/'（极少数 replace 链覆盖了根条目），直接 replace 当前条目为 '/'.
        navigate('/', { replace: true });
        return true;
      },
    });

    isForegroundRef.current = window.__OS__?.state.activeAppId === appId;

    const unregisterBack = BackDispatcher.register(`app.back.${appId}`, () => {
      // foreground 检查：只有当我自己的 own-task 是当前 active task 时才处理 back。
      // 否则（同 appId 的 Activity 被 foreign-task push 到别的 task 上时，原本 own-task 在后台
      // 但 activeAppId 仍 == 我的 appId）让位给 activity-level handler（priority 50），
      // 否则 own-task 实例的 handleBackPress 会用自己 MemoryRouter 的状态消费 back，
      // 导致前台 foreign-task Activity 不动。
      if (!isForegroundRef.current) return false;
      const state = TaskManager.getState();
      if (taskId && state.activeTaskId !== taskId) return false;
      return !!optionsRef.current.onBack();
    }, 100);

    return () => {
      unregisterBack();
      AppNavigatorRegistry.unregister(appId);
    };
  }, [appId, navigate, navigator, taskId]);

  useEffect(() => {
    const state = TaskManager.getState();
    const task = taskId ? state.tasks.find(t => t.taskId === taskId) : null;
    const isInForeignTask = task != null && task.rootAppId !== appId;
    if (isInForeignTask) return;

    return AppLifecycle.subscribe(appId, (event: LifecycleEvent) => {
      if (event === 'foreground') {
        isForegroundRef.current = true;
        optionsRef.current.onForeground?.();
        return;
      }
      if (event === 'background') {
        isForegroundRef.current = false;
        optionsRef.current.onBackground?.();
        return;
      }
      if (event === 'destroy') {
        isForegroundRef.current = false;
        AppNavigatorRegistry.setBackOverride(appId);
        optionsRef.current.onDestroy?.();
      }
    });
  }, [appId, taskId]);

  useAppReady(appId);
}
