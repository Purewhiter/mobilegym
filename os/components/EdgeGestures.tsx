import { useState, useRef, useEffect } from 'react';
import { SIMULATOR_CONFIG } from '../data';
import { TaskManager } from '../TaskManager';
import { useTaskManagerSelector } from '../hooks/useTaskManagerSelector';

const {
  edgeGestureWidth, swipeThreshold, backIndicatorSize, backIndicatorOpacity,
  zIndexEdgeGestures,
  viewportWidth: fwViewportWidth,
} = SIMULATOR_CONFIG.framework;

// 侧边返回手势
export const EdgeGestures = () => {
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
