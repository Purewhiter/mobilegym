import React, { useRef } from 'react';
import { SIMULATOR_CONFIG } from '../data';
const { statusBarHeight, zIndexStatusBar } = SIMULATOR_CONFIG.framework;
import { SystemShadeService } from '../SystemShadeService';
import type { ShadePanelKind } from '../types';
import { realNow } from '../TimeService';

/**
 * A thin, invisible catcher at the top edge to detect
 * MIUI-style split shade gesture:
 * - left half: notification center
 * - right half: control center
 */
export const TopEdgeShadeGestureCatcher: React.FC = () => {
  const activeRef = useRef(false);
  const startRef = useRef<{ x: number; y: number; t: number; kind: ShadePanelKind; pid: number } | null>(null);

  const HEIGHT = statusBarHeight + 8;
  const OPEN_THRESHOLD = 44; // px
  const MIN_DURATION_MS = 10;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button for mouse
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (SystemShadeService.isOpen()) return;

    activeRef.current = true;
    const kind: ShadePanelKind = e.clientX < window.innerWidth / 2 ? 'notifications' : 'control';
    startRef.current = { x: e.clientX, y: e.clientY, t: realNow(), kind, pid: e.pointerId };
    try {
      (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const end = () => {
    activeRef.current = false;
    startRef.current = null;
  };

  const tryOpen = (clientY: number) => {
    if (!activeRef.current || !startRef.current) return;
    const dt = realNow() - startRef.current.t;
    const dy = clientY - startRef.current.y;
    // Basic guard: avoid accidental open on micro drags/clicks
    if (dt >= MIN_DURATION_MS && dy >= OPEN_THRESHOLD) {
      SystemShadeService.open(startRef.current.kind);
      end();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeRef.current || !startRef.current) return;
    if (startRef.current.pid !== e.pointerId) return;
    tryOpen(e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!activeRef.current || !startRef.current) return;
    if (startRef.current.pid !== e.pointerId) return;
    tryOpen(e.clientY);
    end();
  };

  const onPointerCancel = () => end();

  return (
    <div
      data-no-clipboard="true"
      className="fixed top-0 left-0 w-full touch-none"
      style={{
        height: `${HEIGHT}px`,
        zIndex: zIndexStatusBar + 5,
        // Important: the shade itself provides visuals; this catcher is only for gesture capture.
        backgroundColor: 'transparent',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    />
  );
};

export default TopEdgeShadeGestureCatcher;

