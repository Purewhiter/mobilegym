/** The bottom gesture bar: swipe up to go home, swipe and hold for recents. */

import React, { useState, useRef, useEffect } from 'react';

import { SIMULATOR_CONFIG } from '../data';
import { getAppManifest } from '../data/appRegistry';

import * as TimeService from '../TimeService';

import { useTaskManagerSelector } from '../hooks/useTaskManagerSelector';
import { areChromeTaskSnapshotsEqual, getChromeTaskSnapshot, getDeclaredForeground, getLightTextFromManifestForeground } from './chromeForeground';

const {
  recentsHoldDuration,
  zIndexGestureBar, transitionDuration,
  gestureBarOpacityLight, gestureBarOpacityDark, gestureProgressDivisor,
  homeSwipeThreshold, gestureCancelThreshold,
  bottomGestureHeight, gestureBarWidth, gestureBarHeight, gestureProgressScale,
} = SIMULATOR_CONFIG.framework;

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
  const pointerId = useRef<number | null>(null);
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
      // data-resident-screen: a page on the back stack shown or hidden again changes the declaration in force.
      attributeFilter: ['data-status-bar-foreground', 'data-navigation-bar-foreground', 'data-resident-screen'],
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [activeTopActivityId, isLauncherVisible, isRecentsVisible, activeRootAppId]);

  const barOpacity = isOnDarkBg ? gestureBarOpacityLight : gestureBarOpacityDark;
  const barColor = isOnDarkBg ? 'white' : 'black';

  const clearHold = () => {
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  };

  useEffect(() => {
    const cancel = () => {
      clearHold();
      pointerId.current = null;
    };
    const onBlur = () => {
      cancel();
      setSwipeProgress(0);
    };
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('blur', onBlur);
      cancel();
    };
  }, []);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0 || pointerId.current !== null) return;
    pointerId.current = event.pointerId;
    startY.current = event.clientY;
    startTime.current = TimeService.realNow();
    setSwipeProgress(0);
    // Playwright replays synthetic pointer events on the original element.
    if (event.nativeEvent.isTrusted) event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerId.current) return;
    const distance = startY.current - event.clientY;
    setSwipeProgress(Math.min(Math.max(distance / gestureProgressDivisor, 0), 1));

    if (distance < gestureCancelThreshold || isRecentsVisible) {
      clearHold();
      return;
    }
    if (holdTimerRef.current !== null) return;
    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      pointerId.current = null;
      setSwipeProgress(0);
      window.__OS__?.showRecents();
    }, recentsHoldDuration);
  };

  const finishPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerId !== pointerId.current) return;
    clearHold();
    pointerId.current = null;
    setSwipeProgress(0);
    if (event.type !== 'pointerup' || isRecentsVisible) return;
    if (startY.current - event.clientY <= homeSwipeThreshold ||
        TimeService.realNow() - startTime.current >= recentsHoldDuration) return;
    if (isLauncherVisible) window.__OS__?.handleBack();
    else window.__OS__?.goHome();
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
        height: `${touchAreaHeight}px`,
        touchAction: 'none'
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
      onLostPointerCapture={finishPointer}
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
