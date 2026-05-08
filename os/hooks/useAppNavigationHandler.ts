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
import { syncTracker } from '../utils/memoryHistoryTracker';

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
      back: () => optionsRef.current.onBack(),
      route: () => routeRef.current,
    });

    isForegroundRef.current = window.__OS__?.state.activeAppId === appId;

    const unregisterBack = BackDispatcher.register(`app.back.${appId}`, () => {
      if (!isForegroundRef.current) return false;
      return !!optionsRef.current.onBack();
    }, 100);

    return () => {
      unregisterBack();
      AppNavigatorRegistry.unregister(appId);
    };
  }, [appId, navigate, taskId]);

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
