/** A narrow TaskManager subscription that re-renders only when the selected value changes. */

import { useRef, useSyncExternalStore, useCallback } from 'react';

import { TaskManager } from '../TaskManager';
import type { OSState } from '../types';

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
