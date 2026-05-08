import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

type MapBackScope = 'explore-home' | 'any';

type MapBackEntry = {
  id: number;
  priority: number;
  handler: () => boolean;
};

const mapBackEntries: MapBackEntry[] = [];
let nextMapBackEntryId = 1;

function registerMapBackHandler(handler: () => boolean, priority: number) {
  const entry: MapBackEntry = {
    id: nextMapBackEntryId++,
    priority,
    handler,
  };
  mapBackEntries.push(entry);
  return () => {
    const idx = mapBackEntries.findIndex((item) => item.id === entry.id);
    if (idx >= 0) mapBackEntries.splice(idx, 1);
  };
}

export function dispatchMapBackHandlers(): boolean {
  const snapshot = [...mapBackEntries].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.id - a.id;
  });

  for (const entry of snapshot) {
    if (entry.handler()) {
      return true;
    }
  }

  return false;
}

export function useMapBackHandler(
  handler: () => boolean,
  options?: {
    enabled?: boolean;
    priority?: number;
    scope?: MapBackScope;
  },
) {
  const location = useLocation();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  const enabled = options?.enabled ?? true;
  const priority = options?.priority ?? 0;
  const scope = options?.scope ?? 'explore-home';
  const isScopeActive = scope === 'any' || location.pathname === '/';

  useEffect(() => {
    if (!enabled || !isScopeActive) return;

    // 让首页的本地 overlay 在 historyBack 之前先消费系统返回。
    return registerMapBackHandler(() => handlerRef.current(), priority);
  }, [enabled, isScopeActive, priority]);
}
