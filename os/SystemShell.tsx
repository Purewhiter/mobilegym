
import React, { useState, useRef, useEffect, useSyncExternalStore, useCallback, useMemo } from 'react';
import { useOS } from './OSContext';
import { SIMULATOR_CONFIG } from './data';
import { renderAppContent, getAppManifest, getLocalizedAppName } from './data/appRegistry';

const {
  recentsCardWidth, recentsAppPreviewWidth, recentsCardGap, recentsTopPadding,
  recentsScrollContainerHeight, recentsCardHeight, recentsCardBorderRadius,
  recentsAppPreviewHeight, recentsOpacityDivisor, recentsBackgroundOpacity,
  recentsSwipeThreshold, recentsHoldDuration,
  zIndexRecentsCards, zIndexApp, zIndexRecentsBlur, zIndexRecentsChrome,
  zIndexGestureBar, zIndexEdgeGestures,
  transitionDuration,
  gestureBarOpacityLight, gestureBarOpacityDark, gestureProgressDivisor,
  homeSwipeThreshold, gestureCancelThreshold,
  bottomGestureHeight, gestureBarWidth, gestureBarHeight, gestureProgressScale,
  edgeGestureWidth, swipeThreshold, backIndicatorSize, backIndicatorOpacity,
  viewportWidth: fwViewportWidth,
} = SIMULATOR_CONFIG.framework;
import { initScrollMeta } from './scrollMeta';
import { initSimInput } from './simInput';
import { Launcher } from './launcher/Launcher';
import { AppIcon } from './components/AppIcon';
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
import { useTaskManagerSelector } from './hooks/useTaskManagerSelector';
import {
  getLightTextFromManifestForeground,
  getChromeTaskSnapshot,
  areChromeTaskSnapshotsEqual,
  getDeclaredForeground,
} from './components/chromeForeground';
import { StatusBar } from './components/StatusBar';
import { TextSelectionService } from './TextSelectionService';
import * as TimeService from './TimeService';
import { useOsT } from './i18n';
import * as SkinService from './SkinService';
import { themeToCssVars } from './utils/themeToCssVars';
import { getActiveTopActivityId, getTaskTopActivity, getTasksMRU } from './taskUtils';
import { ActivityContext } from './ActivityContext';
import { KeyboardService } from './keyboard/KeyboardService';
import { TaskManager } from './TaskManager';
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

function syncSwipeToActivityContainer(
  topActivityId: string,
  taskId: string,
  offset: number,
  mode: 'drag' | 'resetAnimated' | 'resetImmediate' = 'drag',
): void {
  const activityContainerEl = document.getElementById(`activity-container-${topActivityId}`) as HTMLElement | null;
  const escapedTaskId =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(taskId) : taskId;
  const chromeCardEl = document.querySelector(
    `[data-recents-card="${escapedTaskId}"]`
  ) as HTMLElement | null;

  const targets = [activityContainerEl, chromeCardEl].filter(Boolean) as HTMLElement[];
  if (targets.length === 0) return;

  if (mode === 'resetImmediate') {
    targets.forEach((el) => {
      el.style.transform = '';
      el.style.opacity = '';
      el.style.transition = '';
    });
    return;
  }

  if (mode === 'resetAnimated') {
    targets.forEach((el) => {
      el.style.transform = '';
      el.style.opacity = '';
      el.style.transition = 'transform 0.2s, opacity 0.2s';
    });
    return;
  }

  {
    const opacity = String(Math.max(0, 1 - offset / recentsOpacityDivisor));
    targets.forEach((el) => {
      el.style.transform = `translateY(${-offset}px)`;
      el.style.opacity = opacity;
      el.style.transition = 'none';
    });
  }
}

const RecentsBlur: React.FC = () => {
  const { state, goHome } = useOS();
  if (!state.isRecentsVisible) return null;
  return (
    <div
      className="absolute inset-0 backdrop-blur-sm"
      style={{
        zIndex: zIndexRecentsBlur,
        backgroundColor: `rgba(0, 0, 0, ${recentsBackgroundOpacity})`,
      }}
      onClick={goHome}
    />
  );
};

const RecentsChrome: React.FC = () => {
  const { state, launchTaskById, closeTask, goHome } = useOS();
  const t = useOsT();
  const scrollRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<{ pid: number; y: number; taskId: string } | null>(null);
  const swipeOffset = useRef(0);
  const lastDismissTs = useRef(0);

  const tasksMRU = useMemo(() => getTasksMRU(state.tasks), [state.tasks]);
  const topActivityByTaskId = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasksMRU) {
      const top = getTaskTopActivity(task);
      if (top) map.set(task.taskId, top.activityId);
    }
    return map;
  }, [tasksMRU]);

  const handleScroll = useCallback(() => {
    document.documentElement.style.setProperty(
      '--recents-scroll',
      `${scrollRef.current?.scrollLeft ?? 0}px`
    );
  }, []);

  useEffect(() => {
    if (!state.isRecentsVisible) return;
    document.documentElement.style.setProperty('--recents-scroll', '0px');
    handleScroll();
    return () => {
      document.documentElement.style.removeProperty('--recents-scroll');
    };
  }, [state.isRecentsVisible, handleScroll]);

  useEffect(() => {
    if (!state.isRecentsVisible) return;
    // 确保进入/退出多任务时，不残留上滑 transform/opacity
    tasksMRU.forEach((task) => {
      const topActivityId = topActivityByTaskId.get(task.taskId);
      if (topActivityId) {
        syncSwipeToActivityContainer(topActivityId, task.taskId, 0, 'resetImmediate');
      }
    });

    return () => {
      tasksMRU.forEach((task) => {
        const topActivityId = topActivityByTaskId.get(task.taskId);
        if (topActivityId) {
          syncSwipeToActivityContainer(topActivityId, task.taskId, 0, 'resetImmediate');
        }
      });
    };
  }, [state.isRecentsVisible, tasksMRU, topActivityByTaskId]);

  if (!state.isRecentsVisible) return null;

  const handleClearAll = () => {
    const taskIds = tasksMRU.map(task => task.taskId);
    taskIds.forEach(taskId => closeTask(taskId));
    goHome();
  };

  const handleScrollContainerClick = (e: React.MouseEvent) => {
    if (TimeService.realNow() - lastDismissTs.current < 400) return;
    if (e.target === e.currentTarget) {
      goHome();
    }
  };

  const handleCardPointerDown = (e: React.PointerEvent, taskId: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    swipeStartRef.current = { pid: e.pointerId, y: e.clientY, taskId };
    swipeOffset.current = 0;
    const topActivityId = topActivityByTaskId.get(taskId);
    if (topActivityId) syncSwipeToActivityContainer(topActivityId, taskId, 0, 'resetImmediate');
    try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const handleCardPointerMove = (e: React.PointerEvent) => {
    const s = swipeStartRef.current;
    if (!s || s.pid !== e.pointerId) return;
    const diff = s.y - e.clientY;
    if (diff <= 0) return; // 只允许向上滑动
    swipeOffset.current = diff;
    const topActivityId = topActivityByTaskId.get(s.taskId);
    if (topActivityId) syncSwipeToActivityContainer(topActivityId, s.taskId, diff, 'drag');
  };

  const handleCardPointerEnd = (e: React.PointerEvent) => {
    const s = swipeStartRef.current;
    if (!s || s.pid !== e.pointerId) return;

    const offset = swipeOffset.current;
    const topActivityId = topActivityByTaskId.get(s.taskId);

    if (offset > recentsSwipeThreshold) {
      lastDismissTs.current = TimeService.realNow();
      closeTask(s.taskId);
      if (tasksMRU.length === 1) {
        goHome();
      }
    } else {
      if (topActivityId) syncSwipeToActivityContainer(topActivityId, s.taskId, 0, 'resetAnimated');
    }

    swipeStartRef.current = null;
    swipeOffset.current = 0;
  };

  return (
    <div
      className="absolute inset-0 flex flex-col items-center pointer-events-none"
      style={{
        zIndex: zIndexRecentsChrome,
        paddingTop: `${recentsTopPadding}px`,
      }}
    >
      <div
        ref={scrollRef}
        className="flex overflow-x-auto w-full px-12 no-scrollbar items-center pointer-events-auto"
        style={{
          gap: `${recentsCardGap}px`,
          height: `${recentsScrollContainerHeight}px`,
        }}
        onScroll={handleScroll}
        onClick={handleScrollContainerClick}
      >
        {tasksMRU.map((task) => {
          const manifest = getAppManifest(task.rootAppId);
          return (
            <div
              key={task.taskId}
              data-recents-card={task.taskId}
              className="flex-shrink-0 relative group cursor-pointer touch-none"
              style={{
                width: `${recentsCardWidth}px`,
                height: `${recentsCardHeight}px`,
              }}
              onPointerDown={(e) => handleCardPointerDown(e, task.taskId)}
              onPointerMove={handleCardPointerMove}
              onPointerUp={handleCardPointerEnd}
              onPointerCancel={handleCardPointerEnd}
              onClick={() => launchTaskById(task.taskId)}
            >
              <div className="absolute -top-7 left-3 flex items-center gap-2 pointer-events-none z-10">
                {manifest ? (
                  <AppIcon manifest={manifest} size={28} radius={8} showShadow />
                ) : null}
                <span className="text-white text-[13px] font-medium drop-shadow-lg">
                  {getLocalizedAppName(task.rootAppId)}
                </span>
              </div>
              <div
                className="overflow-hidden shadow-2xl relative border border-white/10"
                style={{
                  width: `${recentsCardWidth}px`,
                  height: `${recentsCardHeight}px`,
                  borderRadius: `${recentsCardBorderRadius}px`,
                }}
              />
            </div>
          );
        })}
      </div>

      {state.tasks.length > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClearAll();
          }}
          className="mt-12 bg-white/10 px-8 py-3 rounded-full text-white font-medium border border-white/10 active:scale-95 transition-transform pointer-events-auto"
        >
          {t('清除全部')}
        </button>
      )}
    </div>
  );
};

const GestureBar = () => {
  const {
    activeTopActivityId,
    activeRootAppId,
    isLauncherVisible,
    isRecentsVisible,
  } = useTaskManagerSelector(getChromeTaskSnapshot, areChromeTaskSnapshotsEqual);
  const startY = useRef(0);
  const startTime = useRef(0);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const holdTimerRef = useRef<number | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  // 检测背景颜色：桌面/多任务 或 声明式属性（限定在当前活跃应用内查找）
  const getActiveActivityContainer = () => activeTopActivityId
    ? document.getElementById(`activity-container-${activeTopActivityId}`)
    : null;

  const getIsOnDarkBg = () => {
    if (isLauncherVisible || isRecentsVisible) return true;
    const container = getActiveActivityContainer();
    const activeManifest = activeRootAppId ? getAppManifest(activeRootAppId) : undefined;

    // 1. 优先检查 data-navigation-bar-foreground（底部独立前景信号）
    const declaredNavLight = getDeclaredForeground(container, 'data-navigation-bar-foreground');
    if (declaredNavLight !== null) return declaredNavLight;

    // 2. 优先使用 app 级 navigationBar 默认值，再回退到共享的 status bar 信号
    const manifestNavLight = getLightTextFromManifestForeground(
      activeManifest?.theme.colors.navigationBarForeground,
    );
    if (manifestNavLight !== null) return manifestNavLight;

    // 3. 再回退到 status bar 声明（顶底共享信号）
    const declaredLight = getDeclaredForeground(container, 'data-status-bar-foreground');
    if (declaredLight !== null) return declaredLight;

    // 4. Final semantic fallback: reuse status bar manifest when nav is unspecified.
    const manifestStatusLight = getLightTextFromManifestForeground(
      activeManifest?.theme.colors.statusBarForeground,
    );
    if (manifestStatusLight !== null) return manifestStatusLight;

    return false;
  };

  const [isOnDarkBg, setIsOnDarkBg] = useState(getIsOnDarkBg);

  // 仅在关键状态变化时重新检测（延迟一帧，确保新页面 DOM 已渲染）
  useEffect(() => {
    requestAnimationFrame(() => {
      setIsOnDarkBg(getIsOnDarkBg());
    });
  }, [isLauncherVisible, isRecentsVisible, activeTopActivityId, activeRootAppId]);

  // 监听属性变化及子节点变化（应用内路由切换会替换子组件）
  useEffect(() => {
    if (!activeTopActivityId || isLauncherVisible || isRecentsVisible) return;

    const activityContainer = document.getElementById(`activity-container-${activeTopActivityId}`);
    if (!activityContainer) return;

    const redetect = () => requestAnimationFrame(() => {
      setIsOnDarkBg(getIsOnDarkBg());
    });

    const observer = new MutationObserver(redetect);

    observer.observe(activityContainer, {
      attributes: true,
      attributeFilter: ['data-status-bar-foreground', 'data-navigation-bar-foreground'],
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [activeTopActivityId, isLauncherVisible, isRecentsVisible, activeRootAppId]);

  const barOpacity = isOnDarkBg ? gestureBarOpacityLight : gestureBarOpacityDark;
  const barColor = isOnDarkBg ? 'white' : 'black';

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    startTime.current = TimeService.realNow();
    setSwipeProgress(0);

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const diff = startY.current - currentY;
    const progress = Math.min(Math.max(diff / gestureProgressDivisor, 0), 1);
    setSwipeProgress(progress);

    // 上滑悬停触发多任务
    if (diff > homeSwipeThreshold && !holdTimerRef.current) {
      holdTimerRef.current = window.setTimeout(() => {
        window.__OS__?.showRecents();
        setSwipeProgress(0);
        holdTimerRef.current = null;
      }, recentsHoldDuration);
    }

    if (diff < 40 && holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    const endY = e.changedTouches[0].clientY;
    const duration = TimeService.realNow() - startTime.current;
    const diff = startY.current - endY;

    // 快速上滑返回桌面
    if (diff > homeSwipeThreshold && duration < recentsHoldDuration && !isRecentsVisible) {
      // 已在桌面时先尝试关闭桌面层遮罩（如搜索）
      if (isLauncherVisible) {
        window.__OS__?.handleBack();
      } else {
        window.__OS__?.goHome();
      }
    }

    setSwipeProgress(0);
  };

  // 鼠标事件处理 - 需要在 document 上监听才能捕获拖动
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isMouseDown || startY.current === 0) return;

      const currentY = e.clientY;
      const diff = startY.current - currentY;
      const progress = Math.min(Math.max(diff / gestureProgressDivisor, 0), 1);
      setSwipeProgress(progress);

      // 上滑悬停触发多任务
      if (diff > homeSwipeThreshold && !holdTimerRef.current) {
        holdTimerRef.current = window.setTimeout(() => {
          window.__OS__?.showRecents();
          setSwipeProgress(0);
          holdTimerRef.current = null;
        }, recentsHoldDuration);
      }

      if (diff < gestureCancelThreshold && holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!isMouseDown) return;

      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }

      const endY = e.clientY;
      const duration = TimeService.realNow() - startTime.current;
      const diff = startY.current - endY;

      // 快速上滑返回桌面
      if (diff > homeSwipeThreshold && duration < recentsHoldDuration && !isRecentsVisible) {
        // 已在桌面时先尝试关闭桌面层遮罩（如搜索）
        if (isLauncherVisible) {
          window.__OS__?.handleBack();
        } else {
          window.__OS__?.goHome();
        }
      }

      startY.current = 0;
      setSwipeProgress(0);
      setIsMouseDown(false);
    };

    if (isMouseDown) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isMouseDown, isRecentsVisible, isLauncherVisible]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    startY.current = e.clientY;
    startTime.current = TimeService.realNow();
    setIsMouseDown(true);
  };

  // 在App内时，减小触摸区域避免遮挡TabBar
  const isInApp = activeTopActivityId !== null && !isLauncherVisible && !isRecentsVisible;
  const touchAreaHeight = isInApp ? bottomGestureHeight : bottomGestureHeight * 2;

  return (
    <div
      className="absolute bottom-0 w-full flex justify-center items-end pb-1"
      data-gesture-bar="true"
      style={{
        zIndex: zIndexGestureBar,
        height: `${touchAreaHeight}px`
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
    >
      <div
        className="rounded-full pointer-events-none"
        style={{
          width: `${gestureBarWidth}px`,
          height: `${gestureBarHeight}px`,
          backgroundColor: barColor,
          opacity: barOpacity,
          transform: `scaleX(${1 + swipeProgress * gestureProgressScale})`,
          transitionDuration: `${transitionDuration}ms`,
        }}
      />
    </div>
  );
};

// 侧边返回手势
const EdgeGestures = () => {
  const isRecentsVisible = useTaskManagerSelector((state) => state.isRecentsVisible);
  const [gesture, setGesture] = useState<{
    active: boolean;
    side: 'left' | 'right';
    progress: number;
    y: number;
  }>({ active: false, side: 'left', progress: 0, y: 0 });

  const EDGE_WIDTH = edgeGestureWidth;
  const SWIPE_THRESHOLD = swipeThreshold;
  const gestureRef = useRef<{ startX: number; startY: number; side: 'left' | 'right' | null }>({
    startX: 0, startY: 0, side: null
  });

  // 获取模拟器在视口中的实际边界（通过 getBoundingClientRect 直接读取，自动计入 CSS transform）
  const getPhoneBounds = () => {
    const rootEl = document.getElementById('root');
    if (!rootEl) {
      return { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, scale: 1 };
    }
    const rect = rootEl.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      scale: rect.width / fwViewportWidth,
    };
  };

  // 全局统一的返回处理 - 类似安卓的 onBackPressed
  const handleSystemBack = () => {
    // Prefer the OS unified back handler if available (handles overlays like keyboard/pickers)
    const os = window.__OS__;
    if (os && typeof os.handleBack === 'function') {
      os.handleBack();
      return;
    }

    // Fallback (should rarely happen)
    console.log('[System] handleSystemBack fallback');
    TaskManager.goHome();
  };

  useEffect(() => {
    // Always register edge gestures (except during recents view).
    // This allows back-gesture to dismiss overlays like SystemShade even
    // when on the home screen (activeAppId === null).
    if (isRecentsVisible) return;

    // Touch 事件处理
    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      const { left, top: phoneTop, right, scale } = getPhoneBounds();
      const edgeW = EDGE_WIDTH * scale;
      // 允许从手机边缘内外各 edgeW 范围起手
      if (touch.clientX >= left - edgeW && touch.clientX <= left + edgeW) {
        const localY = (touch.clientY - phoneTop) / scale;
        gestureRef.current = { startX: touch.clientX, startY: touch.clientY, side: 'left' };
        setGesture({ active: true, side: 'left', progress: 0, y: localY });
      } else if (touch.clientX >= right - edgeW && touch.clientX <= right + edgeW) {
        const localY = (touch.clientY - phoneTop) / scale;
        gestureRef.current = { startX: touch.clientX, startY: touch.clientY, side: 'right' };
        setGesture({ active: true, side: 'right', progress: 0, y: localY });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!gestureRef.current.side) return;
      const touch = e.touches[0];
      const { top: phoneTop, scale } = getPhoneBounds();
      const diffX = gestureRef.current.side === 'left'
        ? touch.clientX - gestureRef.current.startX
        : gestureRef.current.startX - touch.clientX;
      const progress = Math.min(Math.max(diffX / (SWIPE_THRESHOLD * scale), 0), 1);
      const localY = (touch.clientY - phoneTop) / scale;
      setGesture(prev => ({ ...prev, progress, y: localY }));
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!gestureRef.current.side) return;
      const touch = e.changedTouches[0];
      const { scale } = getPhoneBounds();
      const diffX = gestureRef.current.side === 'left'
        ? touch.clientX - gestureRef.current.startX
        : gestureRef.current.startX - touch.clientX;

      if (diffX >= SWIPE_THRESHOLD * scale) {
        handleSystemBack();
      }

      gestureRef.current = { startX: 0, startY: 0, side: null };
      setGesture({ active: false, side: 'left', progress: 0, y: 0 });
    };

    // Mouse 事件处理（与 Touch 逻辑相同）
    const handleMouseDown = (e: MouseEvent) => {
      const { left, top: phoneTop, right, scale } = getPhoneBounds();
      const edgeW = EDGE_WIDTH * scale;
      if (e.clientX >= left - edgeW && e.clientX <= left + edgeW) {
        const localY = (e.clientY - phoneTop) / scale;
        gestureRef.current = { startX: e.clientX, startY: e.clientY, side: 'left' };
        setGesture({ active: true, side: 'left', progress: 0, y: localY });
      } else if (e.clientX >= right - edgeW && e.clientX <= right + edgeW) {
        const localY = (e.clientY - phoneTop) / scale;
        gestureRef.current = { startX: e.clientX, startY: e.clientY, side: 'right' };
        setGesture({ active: true, side: 'right', progress: 0, y: localY });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!gestureRef.current.side) return;
      const { top: phoneTop, scale } = getPhoneBounds();
      const diffX = gestureRef.current.side === 'left'
        ? e.clientX - gestureRef.current.startX
        : gestureRef.current.startX - e.clientX;
      const progress = Math.min(Math.max(diffX / (SWIPE_THRESHOLD * scale), 0), 1);
      const localY = (e.clientY - phoneTop) / scale;
      setGesture(prev => ({ ...prev, progress, y: localY }));
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!gestureRef.current.side) return;
      const { scale } = getPhoneBounds();
      const diffX = gestureRef.current.side === 'left'
        ? e.clientX - gestureRef.current.startX
        : gestureRef.current.startX - e.clientX;

      if (diffX >= SWIPE_THRESHOLD * scale) {
        handleSystemBack();
      }

      gestureRef.current = { startX: 0, startY: 0, side: null };
      setGesture({ active: false, side: 'left', progress: 0, y: 0 });
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);

      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isRecentsVisible]);

  if (!gesture.active) return null;

  const indicatorStyle = {
    top: gesture.y - 24,
    transform: `translateX(${gesture.side === 'left' ? -24 + gesture.progress * 40 : 24 - gesture.progress * 40}px) scale(${0.5 + gesture.progress * 0.5})`,
    opacity: gesture.progress,
  };

  return (
    <div
      className={`fixed ${gesture.side === 'left' ? 'left-0' : 'right-0'} top-0 bottom-0 w-1 pointer-events-none`}
      style={{ zIndex: zIndexEdgeGestures }}
    >
      <div
        className="absolute rounded-full backdrop-blur-sm flex items-center justify-center"
        style={{
          width: `${backIndicatorSize}px`,
          height: `${backIndicatorSize}px`,
          backgroundColor: `rgba(255, 255, 255, ${backIndicatorOpacity})`,
          ...indicatorStyle,
          [gesture.side]: 0
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </div>
    </div>
  );
};

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
