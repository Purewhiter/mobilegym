export type LifecycleEvent = 'foreground' | 'background' | 'destroy';

type LifecycleCallback = (event: LifecycleEvent) => void;

const listeners = new Map<string, Set<LifecycleCallback>>();

export const AppLifecycle = {
  subscribe(appId: string, cb: LifecycleCallback): () => void {
    if (!listeners.has(appId)) listeners.set(appId, new Set());
    listeners.get(appId)!.add(cb);
    return () => {
      const set = listeners.get(appId);
      if (!set) return;
      set.delete(cb);
      if (set.size === 0) listeners.delete(appId);
    };
  },

  emit(appId: string, event: LifecycleEvent) {
    listeners.get(appId)?.forEach((cb) => {
      try {
        cb(event);
      } catch (error) {
        console.error(`[Lifecycle] ${appId} ${event}:`, error);
      }
    });
  },
};
