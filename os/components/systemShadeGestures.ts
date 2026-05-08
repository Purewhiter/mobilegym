import type { ShadePanelKind } from '../types';

export const SHADE_SWITCH_THRESHOLD_PX = 64;
export const SHADE_SWITCH_DOMINANCE = 1.2;
export const SHADE_WHEEL_SWITCH_THRESHOLD_PX = 56;
export const SHADE_PANEL_GESTURE_IGNORE_SELECTOR = '[data-shade-slider="true"]';

export function getAdjacentShadeKind(kind: ShadePanelKind, direction: 'previous' | 'next'): ShadePanelKind | null {
  if (kind === 'notifications' && direction === 'next') return 'control';
  if (kind === 'control' && direction === 'previous') return 'notifications';
  return null;
}

export function getShadeSwipeTarget(
  kind: ShadePanelKind,
  delta: { dx: number; dy: number },
  threshold = SHADE_SWITCH_THRESHOLD_PX,
): ShadePanelKind | null {
  const absX = Math.abs(delta.dx);
  const absY = Math.abs(delta.dy);
  if (absX < threshold) return null;
  if (absX < absY * SHADE_SWITCH_DOMINANCE) return null;
  return getAdjacentShadeKind(kind, delta.dx < 0 ? 'next' : 'previous');
}

export function getShadeWheelTarget(
  kind: ShadePanelKind,
  delta: { deltaX: number; deltaY: number },
  threshold = SHADE_WHEEL_SWITCH_THRESHOLD_PX,
): ShadePanelKind | null {
  const absX = Math.abs(delta.deltaX);
  const absY = Math.abs(delta.deltaY);
  if (absX < threshold) return null;
  if (absX < absY * SHADE_SWITCH_DOMINANCE) return null;
  return getAdjacentShadeKind(kind, delta.deltaX > 0 ? 'next' : 'previous');
}

export function getShadeWheelOffset(kind: ShadePanelKind, deltaX: number, panelWidth: number): number {
  return getShadeDragOffset(kind, -deltaX, panelWidth);
}

export function getShadeDragOffset(kind: ShadePanelKind, dx: number, panelWidth: number): number {
  const width = Math.max(1, panelWidth);
  const target = getAdjacentShadeKind(kind, dx < 0 ? 'next' : 'previous');
  if (!target) return 0;
  return Math.max(-width, Math.min(width, dx));
}

export function shouldIgnoreShadePanelGestureStart(
  target: { closest?: (selector: string) => unknown } | null | undefined,
): boolean {
  return Boolean(target?.closest?.(SHADE_PANEL_GESTURE_IGNORE_SELECTOR));
}
