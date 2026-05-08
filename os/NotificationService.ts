import type { AppId, OSNotification, OSNotificationSnapshot } from './types';
import BroadcastBus, {
  ACTION_NOTIFICATION_POSTED,
  ACTION_NOTIFICATION_REMOVED,
} from './BroadcastBus';
import { createVolatileOsStore } from './createOsStore';
import { routeGetPreference } from './managers/registry';
import * as TimeService from './TimeService';

type PushListener = (item: OSNotification) => void;

const MAX_ITEMS = 80;
const pushListeners = new Set<PushListener>();

function nowMs(): number {
  return TimeService.now();
}

function genId(): string {
  try {
    const c: any = (globalThis as any).crypto;
    if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  } catch {
    // ignore
  }
  return `n_${nowMs()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeItem(input: Partial<OSNotification> & Pick<OSNotification, 'title'>): OSNotification {
  const timestamp = typeof input.timestamp === 'number' && Number.isFinite(input.timestamp)
    ? input.timestamp
    : nowMs();
  const read = typeof input.read === 'boolean' ? input.read : false;
  const appId = (typeof input.appId === 'string' ? input.appId : undefined) as AppId | undefined;
  const importance = input.importance === 'low' || input.importance === 'high' || input.importance === 'default'
    ? input.importance
    : 'default';
  const route = typeof input.route === 'string' && input.route.trim() ? input.route.trim() : undefined;
  const body = typeof input.body === 'string' && input.body.trim() ? input.body.trim() : undefined;
  const pendingIntent = typeof (input as any).pendingIntent === 'string'
    ? (input as any).pendingIntent
    : undefined;
  const autoCancel = typeof input.autoCancel === 'boolean' ? input.autoCancel : true;

  return {
    id: typeof input.id === 'string' && input.id ? input.id : genId(),
    appId,
    title: String(input.title ?? ''),
    body,
    timestamp,
    read,
    importance,
    route,
    pendingIntent,
    autoCancel,
  };
}

function computeSnapshot(items: OSNotification[]): OSNotificationSnapshot {
  const unreadCount = items.reduce((acc, it) => acc + (it.read ? 0 : 1), 0);
  return { items, unreadCount };
}

function isAppNotificationsEnabled(appId: AppId | undefined): boolean {
  if (!appId) return true;
  try {
    const v = routeGetPreference(`notif.app.${appId}.enabled`);
    return typeof v === 'boolean' ? v : true;
  } catch {
    return true;
  }
}

const base = createVolatileOsStore<OSNotificationSnapshot>('notifications', {
  items: [],
  unreadCount: 0,
});

function setItems(items: OSNotification[]) {
  base.setState(computeSnapshot(items), true);
}

function emitPush(item: OSNotification) {
  for (const listener of pushListeners) {
    try {
      listener(item);
    } catch (err) {
      console.error('[NotificationService] onPush listener error', err);
    }
  }
}

export const NotificationService = {
  getState: base.getState,

  subscribe(listener: (state: OSNotificationSnapshot) => void): () => void {
    listener(base.getState());
    return base.subscribe(listener);
  },

  onPush(listener: PushListener): () => void {
    pushListeners.add(listener);
    return () => pushListeners.delete(listener);
  },

  push(input: Partial<OSNotification> & Pick<OSNotification, 'title'>): OSNotification {
    const item = normalizeItem(input);
    if (item.appId && !isAppNotificationsEnabled(item.appId)) {
      return item;
    }
    const prevItems = base.getState().items;
    setItems([item, ...prevItems].slice(0, MAX_ITEMS));
    emitPush(item);
    BroadcastBus.sendBroadcast({
      action: ACTION_NOTIFICATION_POSTED,
      extras: { id: item.id, appId: item.appId, title: item.title },
    });
    return item;
  },

  markRead(id: string, read: boolean = true): void {
    if (!id) return;
    const prev = base.getState().items;
    let changed = false;
    const next = prev.map((it) => {
      if (it.id !== id) return it;
      if (it.read === read) return it;
      changed = true;
      return { ...it, read };
    });
    if (!changed) return;
    setItems(next);
  },

  dismiss(id: string): void {
    if (!id) return;
    const prev = base.getState().items;
    const removed = prev.find((it) => it.id === id);
    const next = prev.filter((it) => it.id !== id);
    if (next.length === prev.length) return;
    setItems(next);
    if (removed) {
      BroadcastBus.sendBroadcast({
        action: ACTION_NOTIFICATION_REMOVED,
        extras: { id: removed.id, appId: removed.appId, title: removed.title },
      });
    }
  },

  clearAll(): void {
    const prev = base.getState().items;
    if (prev.length === 0) return;
    setItems([]);
    for (const it of prev) {
      BroadcastBus.sendBroadcast({
        action: ACTION_NOTIFICATION_REMOVED,
        extras: { id: it.id, appId: it.appId, title: it.title },
      });
    }
  },

  clearForApp(appId: AppId): void {
    const prev = base.getState().items;
    const removed = prev.filter((it) => it.appId === appId);
    const next = prev.filter((it) => it.appId !== appId);
    if (next.length === prev.length) return;
    setItems(next);
    for (const it of removed) {
      BroadcastBus.sendBroadcast({
        action: ACTION_NOTIFICATION_REMOVED,
        extras: { id: it.id, appId: it.appId, title: it.title },
      });
    }
  },

  /** Dismiss notifications matching appId and route (Android cancel(tag, id) equivalent). */
  dismissByRoute(appId: AppId, route: string): void {
    if (!appId || typeof route !== 'string') return;
    const normalizedRoute = route.trim().startsWith('/') ? route.trim() : `/${route.trim()}`;
    const prev = base.getState().items;
    const toRemove = prev.filter(
      (it) => it.appId === appId && it.route != null && it.route === normalizedRoute,
    );
    if (toRemove.length === 0) return;
    const ids = new Set(toRemove.map((it) => it.id));
    const next = prev.filter((it) => !ids.has(it.id));
    setItems(next);
    for (const it of toRemove) {
      BroadcastBus.sendBroadcast({
        action: ACTION_NOTIFICATION_REMOVED,
        extras: { id: it.id, appId: it.appId, title: it.title },
      });
    }
  },
};

export default NotificationService;
