
import React, { useEffect, useSyncExternalStore, useMemo } from 'react';
import { useOS } from './OSContext';
import { SIMULATOR_CONFIG } from './data';
import { renderAppContent, getAppManifest } from './data/appRegistry';

const {
  recentsCardWidth, recentsAppPreviewWidth, recentsCardGap, recentsTopPadding,
  recentsScrollContainerHeight, recentsCardHeight, recentsCardBorderRadius,
  recentsAppPreviewHeight,
  zIndexRecentsCards, zIndexApp,
  viewportWidth: fwViewportWidth,
} = SIMULATOR_CONFIG.framework;
import { initScrollMeta } from './scrollMeta';
import { initSimInput } from './simInput';
import { Launcher } from './launcher/Launcher';
import { MediaPickerHost } from './components/MediaPickerHost';
import { KeyboardOverlay } from './components/KeyboardOverlay';
import { TextSelectionMenu } from './components/TextSelectionMenu';
import { TextSelectionHandles } from './components/TextSelectionHandles';
import { HeadsUpNotification } from './components/HeadsUpNotification';
import { SystemShade } from './components/SystemShade';
import { PermissionDialogHost } from './components/PermissionDialog';
import { SystemErrorBoundary } from './components/SystemErrorBoundary';
import { TopEdgeShadeGestureCatcher } from './components/TopEdgeShadeGestureCatcher';
import { DeviceEffects } from './components/DeviceEffects';
import { IntentChooserSheet } from './components/IntentChooserSheet';
import { useGlobalLongPress } from './hooks/useGlobalLongPress';
import { StatusBar } from './components/StatusBar';
import { GestureBar } from './components/GestureBar';
import { EdgeGestures } from './components/EdgeGestures';
import { RecentsBlur, RecentsChrome } from './components/RecentsOverlay';
import { TextSelectionService } from './TextSelectionService';
import * as SkinService from './SkinService';
import { themeToCssVars } from './utils/themeToCssVars';
import { getActiveTopActivityId, getTasksMRU } from './taskUtils';
import { ActivityContext } from './ActivityContext';
import { KeyboardService } from './keyboard/KeyboardService';
import type { AppId } from './types';

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
const AdjustResizeContainer: React.FC<{ isActive: boolean; children: React.ReactNode }> = ({ isActive, children }) => {
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
const MemoizedActivityContent = React.memo<{
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

export const SystemShell: React.FC = () => {
  const { state, intentChooser, chooseIntentActivity, cancelIntentChooser } = useOS();
  const skin = useSyncExternalStore(SkinService.subscribe, SkinService.getState, SkinService.getState);
  const skinImageFilter = skin.imageFilter;
  const activeTopActivityId = getActiveTopActivityId(state);
  const tasksMRU = useMemo(() => getTasksMRU(state.tasks), [state.tasks]);
  const recentsSlotByTaskId = useMemo(() => {
    const map = new Map<string, { index: number }>();
    tasksMRU.forEach((task, index) => map.set(task.taskId, { index }));
    return map;
  }, [tasksMRU]);
  const allActivities = useMemo(() => (
    state.tasks.flatMap(task => task.stack.map((activity, index) => ({
      ...activity,
      taskId: task.taskId,
      rootAppId: task.rootAppId,
      isTaskTop: index === task.stack.length - 1,
    })))
  ), [state.tasks]);

  const themeVarsByApp = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const activity of allActivities) {
      if (map[activity.appId]) continue;
      const manifest = getAppManifest(activity.appId);
      const colors = manifest ? SkinService.applySkinToThemeColors(manifest.theme.colors) : null;
      map[activity.appId] = colors ? themeToCssVars(colors) : {};
    }
    return map;
  }, [allActivities, skin]);

  // 初始化滚动状态观测 API
  useEffect(() => {
    initScrollMeta();
    initSimInput();
  }, []);

  // 启用全局长按检测（剪贴板菜单）
  useGlobalLongPress();

  // Android-like: hide system selection menu on major OS UI transitions
  useEffect(() => {
    TextSelectionService.hideSelectionMenu();
  }, [activeTopActivityId, state.isLauncherVisible, state.isRecentsVisible]);

  const displayScale: number = SIMULATOR_CONFIG.display.scale ?? 1;
  const viewportWidth: number = fwViewportWidth ?? 360;

  return (
    <div className="w-full h-full overflow-hidden bg-black font-sans select-none">
      <SystemErrorBoundary
        componentName="SystemShell"
        fallback={
          <div className="w-full h-full flex items-center justify-center bg-black text-white">
            <div className="text-center">
              <div className="text-lg mb-2">系统出现问题</div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-white/20 rounded-lg"
              >
                刷新
              </button>
            </div>
          </div>
        }
      >
        <div
          className="relative w-full h-full"
          style={displayScale !== 1 ? { zoom: displayScale } : undefined}
        >
        <DeviceEffects />
        <SystemErrorBoundary componentName="StatusBar">
          <StatusBar />
        </SystemErrorBoundary>
        <TopEdgeShadeGestureCatcher />

        {/* Screens Layer — 仅 Launcher */}
        <div className="h-full w-full">
          {(state.isLauncherVisible || state.isRecentsVisible) && (
            <SystemErrorBoundary componentName="Launcher">
              <Launcher />
            </SystemErrorBoundary>
          )}
        </div>

        {/* Activity containers — 支持同一 App 在不同 Task 中多实例 */}
        {/* DOM contract (writer side): `activity-container-${activityId}` ids are
            queried by os/components/RecentsOverlay.tsx (swipe-to-dismiss style sync),
            os/components/chromeForeground.ts (foreground/hidden probing) and
            os/components/GestureBar.tsx (mutation observer target). */}
        {allActivities.map(activity => {
          const isActive =
            activity.activityId === activeTopActivityId && !state.isLauncherVisible && !state.isRecentsVisible;
          const recentsSlot = state.isRecentsVisible && activity.isTaskTop
            ? recentsSlotByTaskId.get(activity.taskId)
            : undefined;
          const shouldHide = state.isRecentsVisible && !activity.isTaskTop;

          const { containerStyle, innerStyle } = computeActivityContainerStyle({
            isRecentsVisible: state.isRecentsVisible,
            isActive,
            recentsSlot,
            shouldHide,
          });

          return (
            <div
              key={activity.activityId}
              id={`activity-container-${activity.activityId}`}
              className="select-text bg-white"
              data-skin-filter={skinImageFilter ? 'true' : undefined}
              style={{
                ...containerStyle,
                ...(themeVarsByApp[activity.appId] as any),
                ...(skinImageFilter ? ({ '--skin-image-filter': skinImageFilter } as any) : {}),
              }}
            >
              <div className="origin-top-left" style={innerStyle}>
                <AdjustResizeContainer isActive={isActive}>
                  <MemoizedActivityContent
                    activityId={activity.activityId}
                    appId={activity.appId}
                    taskId={activity.taskId}
                    viewportWidth={viewportWidth}
                  />
                </AdjustResizeContainer>
              </div>
            </div>
          );
        })}

        {/* Recents 三层 */}
        <SystemErrorBoundary componentName="RecentsBlur">
          <RecentsBlur />
        </SystemErrorBoundary>
        <SystemErrorBoundary componentName="RecentsChrome">
          <RecentsChrome />
        </SystemErrorBoundary>
        <EdgeGestures />
        <GestureBar />
        <SystemErrorBoundary componentName="HeadsUpNotification">
          <HeadsUpNotification />
        </SystemErrorBoundary>
        <SystemErrorBoundary componentName="SystemShade">
          <SystemShade />
        </SystemErrorBoundary>
        <IntentChooserSheet
          open={intentChooser.open}
          intent={intentChooser.intent}
          matches={intentChooser.matches}
          onChoose={chooseIntentActivity}
          onCancel={cancelIntentChooser}
        />
        <SystemErrorBoundary componentName="KeyboardOverlay">
          <KeyboardOverlay />
        </SystemErrorBoundary>
        <MediaPickerHost />
        <TextSelectionHandles />
        <TextSelectionMenu />
        <SystemErrorBoundary componentName="PermissionDialogHost">
          <PermissionDialogHost />
        </SystemErrorBoundary>
        </div>
      </SystemErrorBoundary>
    </div>
  );
};
