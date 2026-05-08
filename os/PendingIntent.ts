import type { IntentPayload } from './types/manifest';
import type { PendingIntentToken } from './types';
import type { BroadcastIntent } from './types/broadcast';
import BroadcastBus from './BroadcastBus';
import PackageManagerService from './PackageManagerService';

type PendingIntentRecord =
  | { kind: 'activity'; intent: IntentPayload }
  | { kind: 'broadcast'; intent: BroadcastIntent };

function encodeToken(record: PendingIntentRecord): PendingIntentToken {
  const raw = JSON.stringify(record);
  try {
    const bytes = new TextEncoder().encode(raw);
    const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join('');
    return `pi:${btoa(binary)}`;
  } catch {
    return `pi:${raw}`;
  }
}

function decodeToken(token: PendingIntentToken): PendingIntentRecord | null {
  const rawToken = String(token ?? '').trim();
  if (!rawToken.startsWith('pi:')) return null;
  const body = rawToken.slice(3);
  let raw = body;
  try {
    const binary = atob(body);
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    raw = new TextDecoder().decode(bytes);
  } catch {
    raw = body;
  }
  try {
    const parsed = JSON.parse(raw) as PendingIntentRecord;
    if (!parsed || typeof parsed !== 'object' || !('kind' in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export const PendingIntent = {
  getActivity(intent: IntentPayload): PendingIntentToken {
    return encodeToken({ kind: 'activity', intent: { ...intent } });
  },

  getBroadcast(broadcastIntent: BroadcastIntent): PendingIntentToken {
    return encodeToken({ kind: 'broadcast', intent: { ...broadcastIntent } });
  },

  send(token: PendingIntentToken): void {
    const record = decodeToken(token);
    if (!record) {
      console.warn('[PendingIntent] Invalid token');
      return;
    }

    if (record.kind === 'broadcast') {
      BroadcastBus.sendBroadcast(record.intent);
      return;
    }

    const intent = record.intent;
    const os = window.__OS__;
    if (!os) {
      console.warn('[PendingIntent] __OS__ unavailable');
      return;
    }

    const match = PackageManagerService.queryIntentActivities(intent)[0];
    const appId = match?.appId;
    if (!appId) {
      console.warn('[PendingIntent] No activity resolved for intent:', intent);
      return;
    }

    const route = intent.route ?? match?.filter?.route ?? '/';
    console.log(
      `[OSDBG] PendingIntent.send target=${appId} route=${route} action=${intent.action} `
      + `scheme=${intent.scheme ?? '-'} type=${intent.type ?? '-'}`,
    );
    if (typeof os.openApp === 'function') {
      os.openApp(appId, route);
      return;
    }
    if (typeof os.launchApp === 'function') {
      os.launchApp(appId);
    }
  },
};

export default PendingIntent;
