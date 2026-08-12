import React, { useMemo, useSyncExternalStore } from 'react';
import { SIMULATOR_CONFIG } from '../data';
import { renderAppContent, getAppManifest } from '../data/appRegistry';
import { ActivityContext } from '../ActivityContext';
import { KeyboardService } from '../keyboard/KeyboardService';
import type { AppId } from '../types';

const {
  recentsCardWidth, recentsAppPreviewWidth, recentsCardGap, recentsTopPadding,
  recentsScrollContainerHeight, recentsCardHeight, recentsCardBorderRadius,
  recentsAppPreviewHeight,
  zIndexRecentsCards, zIndexApp,
} = SIMULATOR_CONFIG.framework;

/**
 * Activity hosting primitives — the render-performance boundary of the shell.
 * Split from os/SystemShell.tsx as pure moves; the three pieces below must
 * keep their structure (see docs/pending/split-plans-2026-08-12.md plan 2):
 *
 * - computeActivityContainerStyle: pure style function for the three container
 *   states (hidden / recents card / active). DOM contract (reader side): its
 *   recents branch reads the `--recents-scroll` documentElement CSS var written
 *   by os/components/RecentsOverlay.tsx on card-strip scroll.
 * - AdjustResizeContainer: keyboard-height subscription isolation — only the
 *   active activity subscribes to KeyboardService; inactive ones use a noop
 *   subscription so app subtrees skip keyboard re-renders.
 * - MemoizedActivityContent: React.memo boundary with 4 scalar props keeping
 *   app component trees from re-rendering on SystemShell re-renders.
 */
export const computeActivityContainerStyle = (args: {
  isRecentsVisible: boolean;
  isActive: boolean;
  recentsSlot?: { index: number };
  shouldHide?: boolean;
}): { containerStyle: React.CSSProperties; innerStyle: React.CSSProperties } => {
  const scale = recentsCardWidth / recentsAppPreviewWidth;
  const paddingLeft = 48; // Tailwind px-12
  const cardStride = recentsCardWidth + recentsCardGap;
  const cardTop =
    recentsTopPadding +
    (recentsScrollContainerHeight - recentsCardHeight) / 2;

  if (args.shouldHide) {
    return {
      containerStyle: {
        visibility: 'hidden',
        pointerEvents: 'none',
        display: 'none',
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
      },
      innerStyle: { width: '100%', height: '100%', transform: 'translateZ(0)' },
    };
  }

  if (args.isRecentsVisible && args.recentsSlot) {
    return {
      containerStyle: {
        position: 'fixed',
        top: `${cardTop}px`,
        left: `calc(${paddingLeft + (args.recentsSlot.index * cardStride)}px - var(--recents-scroll, 0px))`,
        width: `${recentsCardWidth}px`,
        height: `${recentsCardHeight}px`,
        zIndex: zIndexRecentsCards,
        visibility: 'visible',
        pointerEvents: 'none',
        overflow: 'hidden',
        borderRadius: `${recentsCardBorderRadius}px`,
        backgroundColor: '#fff',
      },
      innerStyle: {
        width: `${recentsAppPreviewWidth}px`,
        height: `${recentsAppPreviewHeight}px`,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      },
    };
  }

  const isVisible = args.isActive && !args.isRecentsVisible;
  return {
    containerStyle: {
      position: 'absolute',
      inset: 0,
      zIndex: zIndexApp,
      display: isVisible ? 'block' : 'none',
      visibility: isVisible ? 'visible' : 'hidden',
      pointerEvents: isVisible ? 'auto' : 'none',
      overflow: 'hidden',
    },
    innerStyle: { width: '100%', height: '100%', transform: 'translateZ(0)' },
  };
};

const noopSubscribe = () => () => {};
const getZeroSnapshot = () => 0;
const getKeyboardHeightSnapshot = () => KeyboardService.getState().height;

/**
 * Isolates keyboard-height subscription so that SystemShell (and all mounted
 * apps) do NOT re-render when the keyboard opens/closes.  Only this thin
 * wrapper re-renders; its `children` reference stays stable because the
 * parent (SystemShell) didn't re-render, so React skips the subtree.
 */
export const AdjustResizeContainer: React.FC<{ isActive: boolean; children: React.ReactNode }> = ({ isActive, children }) => {
  const subscribe = isActive ? KeyboardService.subscribe : noopSubscribe;
  const getSnapshot = isActive ? getKeyboardHeightSnapshot : getZeroSnapshot;
  const kbHeight = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getZeroSnapshot,
  );

  return (
    <div
      data-adjust-resize
      {...(isActive && kbHeight > 0 ? { 'data-keyboard-active': '' } : {})}
      style={
        isActive && kbHeight > 0
          ? { width: '100%', height: `calc(100% - ${kbHeight}px)`, overflow: 'hidden' }
          : { width: '100%', height: '100%' }
      }
    >
      {children}
    </div>
  );
};

/**
 * Memoized activity content — prevents app component trees from re-rendering
 * when SystemShell re-renders due to OS state changes (task switch, recents,
 * brightness, etc.). Only re-renders when the activity identity or viewport
 * actually changes.  Also memoizes the ActivityContext value to avoid
 * unnecessary consumer re-renders.
 */
export const MemoizedActivityContent = React.memo<{
  activityId: string;
  appId: AppId;
  taskId: string;
  viewportWidth: number;
}>(({ activityId, appId, taskId, viewportWidth }) => {
  const ctxValue = useMemo(
    () => ({ activityId, appId, taskId }),
    [activityId, appId, taskId],
  );

  const manifest = getAppManifest(appId);
  const needsZoom = manifest?.designViewportWidth != null
    && manifest.designViewportWidth > 0
    && manifest.designViewportWidth !== viewportWidth;

  return (
    <ActivityContext.Provider value={ctxValue}>
      {needsZoom ? (
        <div style={{ zoom: viewportWidth / manifest!.designViewportWidth!, width: '100%', height: '100%' }}>
          {renderAppContent(appId)}
        </div>
      ) : (
        renderAppContent(appId)
      )}
    </ActivityContext.Provider>
  );
});
