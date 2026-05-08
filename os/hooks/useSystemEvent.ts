import { useEffect, useRef } from 'react';
import BroadcastBus from '../BroadcastBus';
import type { BroadcastIntent, BroadcastReceiver } from '../types/broadcast';

export function useSystemEvent(
  action: string,
  handler: BroadcastReceiver,
  opts?: { priority?: number; enabled?: boolean },
): void {
  const handlerRef = useRef<BroadcastReceiver>(() => {});
  handlerRef.current = handler;

  useEffect(() => {
    if (opts?.enabled === false) return;
    const normalizedAction = String(action ?? '').trim();
    if (!normalizedAction) return;

    const receiver = (intent: BroadcastIntent) => handlerRef.current(intent);
    return BroadcastBus.registerReceiver(normalizedAction, receiver, { priority: opts?.priority });
  }, [action, opts?.enabled, opts?.priority]);
}

export default useSystemEvent;

