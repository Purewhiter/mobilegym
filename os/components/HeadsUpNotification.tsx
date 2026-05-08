import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { SIMULATOR_CONFIG } from '../data';
const { transitionDuration, statusBarHeight, zIndexApp, zIndexStatusBar } = SIMULATOR_CONFIG.framework;
import { getAppManifest, getLocalizedAppName } from '../data/appRegistry';
import { AppIcon } from './AppIcon';
import { NotificationService } from '../NotificationService';
import { QuickSettingsService } from '../QuickSettingsService';
import { useOS } from '../OSContext';
import { routeGetPreference } from '../managers/registry';
import { subscribeOsDataRevision } from '../simState';
import type { OSNotification } from '../types';
import { PendingIntent } from '../PendingIntent';

const AUTO_HIDE_DEFAULT_MS = 3800;
const AUTO_HIDE_HIGH_MS = 5200;
const SWIPE_DISMISS_PX = 36;

function getAutoHideMs(it: OSNotification): number {
  return it.importance === 'high' ? AUTO_HIDE_HIGH_MS : AUTO_HIDE_DEFAULT_MS;
}

export const HeadsUpNotification: React.FC = () => {
  const { launchApp } = useOS();

  const [queue, setQueue] = useState<OSNotification[]>([]);
  const [current, setCurrent] = useState<OSNotification | null>(null);
  const [visible, setVisible] = useState(false);

  const hideTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const swipeRef = useRef<{ pid: number; startX: number; startY: number; moved: boolean } | null>(null);
  const ignoreClickRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    hideTimerRef.current = null;
    closeTimerRef.current = null;
  }, []);

  const closeCurrent = useCallback(() => {
    if (!current) return;
    clearTimers();
    setVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      setCurrent(null);
    }, transitionDuration);
  }, [clearTimers, current]);

  // Subscribe to new notifications and enqueue heads-up candidates.
  useEffect(() => {
    return NotificationService.onPush((it) => {
      // Do-not-disturb suppresses heads-up, but the notification still exists in the center.
      if (QuickSettingsService.getState().doNotDisturbEnabled) return;
      // Silent mode settings: "禁止悬浮通知" (key_popup_window) suppresses heads-up.
      if (routeGetPreference('key_popup_window') === true) return;
      const importance = it.importance ?? 'default';
      if (importance === 'low') return;
      if (it.read) return;
      setQueue((prev) => [...prev, it]);
    });
  }, []);

  // If DND is turned on while a heads-up is visible, dismiss it immediately.
  useEffect(() => {
    return QuickSettingsService.subscribe((qs) => {
      if (!qs.doNotDisturbEnabled) return;
      setQueue([]);
      if (current && visible) {
        closeCurrent();
      }
    });
  }, [closeCurrent, current, visible]);

  // If "disable heads-up" becomes true while visible, dismiss immediately.
  useEffect(() => {
    return subscribeOsDataRevision(() => {
      if (routeGetPreference('key_popup_window') !== true) return;
      setQueue([]);
      if (current && visible) closeCurrent();
    });
  }, [closeCurrent, current, visible]);

  // Dequeue next item when idle.
  useEffect(() => {
    if (current) return;
    if (queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
    setVisible(true);
    ignoreClickRef.current = false;
  }, [queue, current]);

  // Auto-hide timer for the current item.
  useEffect(() => {
    if (!current || !visible) return;
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => closeCurrent(), getAutoHideMs(current));
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    };
  }, [current, visible, closeCurrent]);

  // Cleanup timers on unmount.
  useEffect(() => clearTimers, [clearTimers]);

  const manifest = useMemo(() => (current?.appId ? getAppManifest(current.appId) : null), [current?.appId]);

  const handleOpen = useCallback(() => {
    if (!current) return;
    if (ignoreClickRef.current) return;

    if (current.autoCancel !== false) {
      NotificationService.dismiss(current.id);
    } else {
      NotificationService.markRead(current.id, true);
    }
    closeCurrent();

    if (current.pendingIntent) {
      PendingIntent.send(current.pendingIntent);
      return;
    }
    if (!current.appId) return;
    const os = window.__OS__;
    if (current.route && os && typeof os.openApp === 'function') {
      os.openApp(current.appId, current.route);
      return;
    }
    launchApp(current.appId);
  }, [current, closeCurrent, launchApp]);

  if (!current) return null;

  const top = statusBarHeight + 8;
  const zIndex = Math.max(zIndexApp + 1, zIndexStatusBar - 1);

  return (
    <div
      className="fixed left-0 right-0 flex justify-center"
      style={{
        top,
        zIndex,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        role="button"
        tabIndex={0}
        className="w-[calc(100%-24px)] max-w-[560px] px-4 py-3 rounded-2xl border border-white/10 shadow-xl backdrop-blur-2xl bg-black/55 text-white select-none"
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(-120%)',
          opacity: visible ? 1 : 0,
          transitionProperty: 'transform, opacity',
          transitionDuration: `${transitionDuration}ms`,
          transitionTimingFunction: 'cubic-bezier(0.2, 0.9, 0.2, 1)',
        }}
        onClick={handleOpen}
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          ignoreClickRef.current = false;
          swipeRef.current = { pid: e.pointerId, startX: e.clientX, startY: e.clientY, moved: false };
          try {
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
        }}
        onPointerMove={(e) => {
          const s = swipeRef.current;
          if (!s || s.pid !== e.pointerId) return;
          const dy = e.clientY - s.startY;
          const dx = e.clientX - s.startX;
          if (Math.abs(dy) > 4 || Math.abs(dx) > 4) s.moved = true;
          if (dy < -SWIPE_DISMISS_PX && Math.abs(dx) < 90) {
            ignoreClickRef.current = true;
            swipeRef.current = null;
            closeCurrent();
          }
        }}
        onPointerUp={(e) => {
          const s = swipeRef.current;
          if (!s || s.pid !== e.pointerId) return;
          swipeRef.current = null;
        }}
        onPointerCancel={() => {
          swipeRef.current = null;
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {manifest ? (
            <AppIcon manifest={manifest} size={40} radius={12} showShadow={false} />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Bell size={18} className="text-white/80" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              {manifest ? (
                <span className="text-[12px] text-white/70 shrink-0">{current?.appId ? getLocalizedAppName(current.appId) : manifest.displayName}</span>
              ) : null}
              <div className="text-[14px] font-medium text-white/95 truncate">
                {current.title}
              </div>
            </div>
            {current.body && (
              <div className="mt-0.5 text-[13px] text-white/75 truncate">
                {current.body}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeadsUpNotification;
