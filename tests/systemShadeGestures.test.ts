import { describe, expect, it } from 'vitest';
import {
  getShadeDragOffset,
  getShadeSwipeTarget,
  getShadeWheelOffset,
  getShadeWheelTarget,
  shouldIgnoreShadePanelGestureStart,
} from '../os/components/systemShadeGestures';

describe('system shade horizontal gestures', () => {
  it('switches from notifications to control center on a left swipe', () => {
    expect(getShadeSwipeTarget('notifications', { dx: -80, dy: 12 })).toBe('control');
  });

  it('switches from control center to notifications on a right swipe', () => {
    expect(getShadeSwipeTarget('control', { dx: 80, dy: 12 })).toBe('notifications');
  });

  it('ignores mostly vertical swipes so swipe-up-to-close remains available', () => {
    expect(getShadeSwipeTarget('notifications', { dx: -90, dy: -120 })).toBeNull();
  });

  it('maps touchpad horizontal wheel deltas to the adjacent shade panel', () => {
    expect(getShadeWheelTarget('notifications', { deltaX: 72, deltaY: 4 })).toBe('control');
    expect(getShadeWheelTarget('control', { deltaX: -72, deltaY: 4 })).toBe('notifications');
  });

  it('lets touchpad wheel deltas follow the adjacent panel continuously', () => {
    expect(getShadeWheelOffset('notifications', 24, 360)).toBe(-24);
    expect(getShadeWheelOffset('notifications', -24, 360)).toBe(0);
    expect(getShadeWheelOffset('control', -24, 360)).toBe(24);
    expect(getShadeWheelOffset('control', 24, 360)).toBe(0);
  });

  it('only follows drags toward an available adjacent panel', () => {
    expect(getShadeDragOffset('notifications', -40, 360)).toBe(-40);
    expect(getShadeDragOffset('notifications', 40, 360)).toBe(0);
    expect(getShadeDragOffset('control', 40, 360)).toBe(40);
    expect(getShadeDragOffset('control', -40, 360)).toBe(0);
  });

  it('allows panel gesture tracking to start from buttons', () => {
    const target = {
      closest: (selector: string) => selector.includes('button') ? {} : null,
    };

    expect(shouldIgnoreShadePanelGestureStart(target)).toBe(false);
  });

  it('does not start panel gesture tracking from vertical sliders', () => {
    const target = {
      closest: (selector: string) => selector.includes('data-shade-slider') ? {} : null,
    };

    expect(shouldIgnoreShadePanelGestureStart(target)).toBe(true);
  });
});
