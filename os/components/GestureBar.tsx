import { useState, useRef, useEffect } from 'react';
import { SIMULATOR_CONFIG } from '../data';
import { getAppManifest } from '../data/appRegistry';
import * as TimeService from '../TimeService';
import { useTaskManagerSelector } from '../hooks/useTaskManagerSelector';
import {
  getLightTextFromManifestForeground,
  getChromeTaskSnapshot,
  areChromeTaskSnapshotsEqual,
  getDeclaredForeground,
} from './chromeForeground';

const {
  recentsHoldDuration, transitionDuration,
  gestureBarOpacityLight, gestureBarOpacityDark, gestureProgressDivisor,
  homeSwipeThreshold, gestureCancelThreshold,
  bottomGestureHeight, gestureBarWidth, gestureBarHeight, gestureProgressScale,
  zIndexGestureBar,
} = SIMULATOR_CONFIG.framework;

/**
 * Bottom gesture bar: quick swipe-up goes home, swipe-up-and-hold opens
 * recents; light/dark bar color follows a 4-level foreground fallback chain.
 *
 * DOM contract (reader side): probes `#activity-container-${activityId}`
 * (rendered by os/SystemShell.tsx) for data-navigation-bar-foreground /
 * data-status-bar-foreground declarations, and observes its mutations.
 * Emits `data-gesture-bar="true"` on its own root (queried by bench tooling).
 * Touch area height is halved inside apps to avoid covering TabBars.
 */
export const GestureBar = () => {
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
