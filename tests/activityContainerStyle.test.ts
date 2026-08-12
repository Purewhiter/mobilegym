import { describe, it, expect } from 'vitest';
import { computeActivityContainerStyle } from '../os/SystemShell';

// Behavior lock for computeActivityContainerStyle (currently in os/SystemShell.tsx,
// slated to move into os/components/ActivityHost.tsx). Expected values are derived
// from SIMULATOR_CONFIG.framework:
//   recentsCardWidth=200, recentsAppPreviewWidth=390, recentsCardGap=24,
//   recentsTopPadding=96, recentsScrollContainerHeight=500, recentsCardHeight=434,
//   recentsCardBorderRadius=24, recentsAppPreviewHeight=844,
//   zIndexRecentsCards=205, zIndexApp=50
// cardTop = 96 + (500 - 434) / 2 = 129; cardStride = 200 + 24 = 224; paddingLeft = 48

describe('computeActivityContainerStyle', () => {
  it('shouldHide branch: fully hidden container, hardware-accelerated inner', () => {
    const { containerStyle, innerStyle } = computeActivityContainerStyle({
      isRecentsVisible: true,
      isActive: false,
      shouldHide: true,
    });
    expect(containerStyle).toEqual({
      visibility: 'hidden',
      pointerEvents: 'none',
      display: 'none',
      position: 'absolute',
      inset: 0,
      overflow: 'hidden',
    });
    expect(innerStyle).toEqual({ width: '100%', height: '100%', transform: 'translateZ(0)' });
  });

  it('shouldHide wins even when a recents slot is provided', () => {
    const { containerStyle } = computeActivityContainerStyle({
      isRecentsVisible: true,
      isActive: false,
      recentsSlot: { index: 1 },
      shouldHide: true,
    });
    expect(containerStyle.display).toBe('none');
    expect(containerStyle.position).toBe('absolute');
  });

  it('recents card branch: fixed card geometry driven by slot index and --recents-scroll', () => {
    const slot0 = computeActivityContainerStyle({
      isRecentsVisible: true,
      isActive: false,
      recentsSlot: { index: 0 },
    });
    expect(slot0.containerStyle).toEqual({
      position: 'fixed',
      top: '129px',
      left: 'calc(48px - var(--recents-scroll, 0px))',
      width: '200px',
      height: '434px',
      zIndex: 205,
      visibility: 'visible',
      pointerEvents: 'none',
      overflow: 'hidden',
      borderRadius: '24px',
      backgroundColor: '#fff',
    });
    expect(slot0.innerStyle).toEqual({
      width: '390px',
      height: '844px',
      transform: `scale(${200 / 390})`,
      transformOrigin: 'top left',
    });

    const slot2 = computeActivityContainerStyle({
      isRecentsVisible: true,
      isActive: false,
      recentsSlot: { index: 2 },
    });
    // paddingLeft 48 + index 2 * stride 224 = 496
    expect(slot2.containerStyle.left).toBe('calc(496px - var(--recents-scroll, 0px))');
    expect(slot2.containerStyle.top).toBe('129px');
  });

  it('active branch: visible and interactive only when active and recents is closed', () => {
    const active = computeActivityContainerStyle({
      isRecentsVisible: false,
      isActive: true,
    });
    expect(active.containerStyle).toEqual({
      position: 'absolute',
      inset: 0,
      zIndex: 50,
      display: 'block',
      visibility: 'visible',
      pointerEvents: 'auto',
      overflow: 'hidden',
    });
    expect(active.innerStyle).toEqual({ width: '100%', height: '100%', transform: 'translateZ(0)' });
  });

  it('inactive branch: kept mounted but hidden and non-interactive', () => {
    const inactive = computeActivityContainerStyle({
      isRecentsVisible: false,
      isActive: false,
    });
    expect(inactive.containerStyle).toEqual({
      position: 'absolute',
      inset: 0,
      zIndex: 50,
      display: 'none',
      visibility: 'hidden',
      pointerEvents: 'none',
      overflow: 'hidden',
    });
  });

  it('recents open without a slot falls through to the hidden active branch', () => {
    const { containerStyle } = computeActivityContainerStyle({
      isRecentsVisible: true,
      isActive: true,
    });
    // isVisible = isActive && !isRecentsVisible = false
    expect(containerStyle.display).toBe('none');
    expect(containerStyle.position).toBe('absolute');
    expect(containerStyle.zIndex).toBe(50);
  });
});
