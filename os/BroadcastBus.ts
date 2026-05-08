import type { BroadcastIntent, BroadcastReceiver } from './types/broadcast';

export const ACTION_CONNECTIVITY_CHANGE = 'android.net.conn.CONNECTIVITY_CHANGE';
export const ACTION_BATTERY_LOW = 'android.intent.action.BATTERY_LOW';
export const ACTION_BATTERY_OKAY = 'android.intent.action.BATTERY_OKAY';
export const ACTION_LOCALE_CHANGED = 'android.intent.action.LOCALE_CHANGED';
export const ACTION_TIME_SET = 'android.intent.action.TIME_SET';
export const ACTION_TIME_TICK = 'android.intent.action.TIME_TICK';
export const ACTION_BOOT_COMPLETED = 'android.intent.action.BOOT_COMPLETED';
export const ACTION_QUICK_SETTING_CHANGED = 'os.intent.action.QUICK_SETTING_CHANGED';
export const ACTION_NOTIFICATION_POSTED = 'os.intent.action.NOTIFICATION_POSTED';
export const ACTION_NOTIFICATION_REMOVED = 'os.intent.action.NOTIFICATION_REMOVED';
export const ACTION_KEYBOARD_CHANGED = 'os.intent.action.KEYBOARD_CHANGED';
export const ACTION_CLIPBOARD_CHANGED = 'os.intent.action.CLIPBOARD_CHANGED';
export const ACTION_STATUS_BAR_CHANGED = 'os.intent.action.STATUS_BAR_CHANGED';
export const ACTION_SKIN_CHANGED = 'os.intent.action.SKIN_CHANGED';
export const ACTION_THEME_CHANGED = 'os.intent.action.THEME_CHANGED';
export const ACTION_SCREEN_ON = 'android.intent.action.SCREEN_ON';
export const ACTION_SCREEN_OFF = 'android.intent.action.SCREEN_OFF';
export const ACTION_PACKAGE_ADDED = 'android.intent.action.PACKAGE_ADDED';
export const ACTION_PACKAGE_REMOVED = 'android.intent.action.PACKAGE_REMOVED';
export const ACTION_PROVIDER_CHANGED = 'os.intent.action.PROVIDER_CHANGED';
export const ACTION_MEDIA_SCANNER_SCAN_FILE = 'android.intent.action.MEDIA_SCANNER_SCAN_FILE';

export const BROADCAST_ACTIONS = {
  ACTION_CONNECTIVITY_CHANGE,
  ACTION_BATTERY_LOW,
  ACTION_BATTERY_OKAY,
  ACTION_LOCALE_CHANGED,
  ACTION_TIME_SET,
  ACTION_TIME_TICK,
  ACTION_BOOT_COMPLETED,
  ACTION_QUICK_SETTING_CHANGED,
  ACTION_NOTIFICATION_POSTED,
  ACTION_NOTIFICATION_REMOVED,
  ACTION_KEYBOARD_CHANGED,
  ACTION_CLIPBOARD_CHANGED,
  ACTION_STATUS_BAR_CHANGED,
  ACTION_SKIN_CHANGED,
  ACTION_THEME_CHANGED,
  ACTION_SCREEN_ON,
  ACTION_SCREEN_OFF,
  ACTION_PACKAGE_ADDED,
  ACTION_PACKAGE_REMOVED,
  ACTION_PROVIDER_CHANGED,
  ACTION_MEDIA_SCANNER_SCAN_FILE,
} as const;

type InternalReceiver = {
  id: number;
  action: string;
  receiver: BroadcastReceiver;
  priority: number;
  order: number;
};

const receiversByAction = new Map<string, InternalReceiver[]>();
let nextReceiverId = 1;
let nextOrder = 1;

function cloneIntent(intent: BroadcastIntent): BroadcastIntent {
  return {
    action: String(intent.action || ''),
    ...(intent.data ? { data: { ...intent.data } } : {}),
    ...(intent.extras ? { extras: { ...intent.extras } } : {}),
  };
}

function getReceivers(action: string): InternalReceiver[] {
  const list = receiversByAction.get(action);
  return list ? [...list] : [];
}

function safeInvoke(receiver: BroadcastReceiver, intent: BroadcastIntent): void {
  try {
    receiver(intent);
  } catch (err) {
    console.error('[BroadcastBus] receiver error:', err);
  }
}

export const BroadcastBus = {
  hasReceivers(action: string): boolean {
    const list = receiversByAction.get(String(action ?? '').trim());
    return !!list && list.length > 0;
  },

  sendBroadcast(intent: BroadcastIntent): void {
    const action = String(intent?.action ?? '').trim();
    if (!action) return;
    const snapshot = getReceivers(action).sort((a, b) => a.order - b.order);
    if (snapshot.length === 0) return;
    const cloned = cloneIntent({ ...intent, action });
    for (const item of snapshot) {
      Promise.resolve().then(() => safeInvoke(item.receiver, cloned));
    }
  },

  sendOrderedBroadcast(intent: BroadcastIntent): void {
    const action = String(intent?.action ?? '').trim();
    if (!action) return;
    const snapshot = getReceivers(action).sort(
      (a, b) => (b.priority - a.priority) || (a.order - b.order),
    );
    if (snapshot.length === 0) return;
    const cloned = cloneIntent({ ...intent, action });
    for (const item of snapshot) {
      safeInvoke(item.receiver, cloned);
    }
  },

  registerReceiver(
    action: string,
    receiver: BroadcastReceiver,
    opts?: { priority?: number },
  ): () => void {
    const normalizedAction = String(action ?? '').trim();
    if (!normalizedAction || typeof receiver !== 'function') return () => {};
    const entry: InternalReceiver = {
      id: nextReceiverId++,
      action: normalizedAction,
      receiver,
      priority: Number.isFinite(opts?.priority) ? Number(opts!.priority) : 0,
      order: nextOrder++,
    };
    const list = receiversByAction.get(normalizedAction) ?? [];
    list.push(entry);
    receiversByAction.set(normalizedAction, list);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      const curr = receiversByAction.get(normalizedAction);
      if (!curr || curr.length === 0) return;
      const next = curr.filter((x) => x.id !== entry.id);
      if (next.length === 0) receiversByAction.delete(normalizedAction);
      else receiversByAction.set(normalizedAction, next);
    };
  },
};

export default BroadcastBus;
