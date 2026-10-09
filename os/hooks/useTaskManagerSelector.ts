import { useRef, useCallback, useSyncExternalStore } from 'react';
import { TaskManager } from '../TaskManager';
import type { OSState } from '../types';

/**
 * Narrow TaskManager subscription with an equality-cached snapshot.
 *
 * Performance-critical: chrome components (StatusBar / GestureBar / EdgeGestures)
 * subscribe through this hook so they only re-render when their selected slice
 * actually changes, not on every task-stack mutation. The cache returns the
 * previous reference when `isEqual` holds, letting useSyncExternalStore bail out.
 */
export function useTaskManagerSelector<T>(
  selector: (state: OSState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const cacheRef = useRef<T>(selector(TaskManager.getState()));
  const subscribe = useCallback((onStoreChange: () => void) => {
    return TaskManager.subscribe(() => onStoreChange());
  }, []);
  const getSnapshot = useCallback(() => {
    const next = selector(TaskManager.getState());
    if (isEqual(cacheRef.current, next)) return cacheRef.current;
    cacheRef.current = next;
    return next;
  }, [selector, isEqual]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
