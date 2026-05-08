import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

interface SwipeablePadsProps {
  children: [React.ReactNode, React.ReactNode]; // [左页(数字+运算符), 右页(科学面板)]
  onPageChange?: (page: number) => void;
}

/**
 * ViewPager 模拟 — 翻译自 AOSP CalculatorPadViewPager.java
 *
 * 使用手动 pointer 事件处理 + CSS transform，完整复刻 AOSP 行为：
 *
 * AOSP 规格：
 * - Page 0 宽度 = 100%，Page 1 宽度 = 7/9 (getPageWidth)
 * - PageMargin = -24dp (负边距 → 科学面板从右侧 peek)
 * - PageTransformer:
 *     position < 0 (左页被滚过)：
 *       左页 pin 不动（绝对定位已实现）
 *       alpha = max(1 + position, 0) → 左页淡出
 *     position >= 0 (右页滑入)：
 *       默认滑动，alpha = 1
 * - onPageSelected: recursivelySetEnabled(child, childIndex == position)
 *
 * 实现中 Page 0 用 absolute + inset:0 固定，不需要 translateX 补偿。
 * Page 1 用 translateX 从右侧滑入。
 *
 * 滚动范围 = page0Width + margin + page1Width - viewport
 *          = W + (-24) + 7/9*W - W = 7/9*W - 24
 */

const PAGE_1_WIDTH_RATIO = 7 / 9;
const PAGE_PEEK_PX = 24; // AOSP pad_page_margin = -24dp → 科学面板 peek 距离

// 滑动阈值
const SWIPE_THRESHOLD = 0.15; // 滑动超过最大距离的 15% 即切页
const VELOCITY_THRESHOLD = 0.3; // px/ms，快速滑动直接切页

/** 计算最大滚动距离 */
const getMaxScroll = (containerWidth: number) =>
  containerWidth * PAGE_1_WIDTH_RATIO - PAGE_PEEK_PX;

export const SwipeablePads: React.FC<SwipeablePadsProps> = ({ children, onPageChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentPage, setCurrentPage] = useState(0);

  // 拖拽状态 (用 ref 避免 re-render)
  const dragState = useRef({
    isDragging: false,
    startX: 0,
    startY: 0,
    startScrollX: 0,
    currentScrollX: 0,
    maxScroll: 0,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
    directionLocked: false,
    isHorizontal: false,
  });

  // 应用 AOSP PageTransformer 视觉效果
  const applyTransform = useCallback((scrollX: number) => {
    const container = containerRef.current;
    if (!container) return;

    const leftPage = container.children[0] as HTMLElement;
    const rightPage = container.children[1] as HTMLElement;
    if (!leftPage || !rightPage) return;

    const containerWidth = container.clientWidth;
    const maxScroll = getMaxScroll(containerWidth);
    if (maxScroll <= 0) return;
    const clamped = Math.max(0, Math.min(scrollX, maxScroll));

    // AOSP position for page 0 = -scrollX / viewportWidth
    const position = -clamped / containerWidth;

    // Page 0: 绝对定位已 pin，只需改 opacity
    leftPage.style.opacity = String(Math.max(1 + position, 0));

    // Page 1: 从右侧滑入
    const page1Left = (containerWidth - PAGE_PEEK_PX) - clamped;
    rightPage.style.transform = `translateX(${page1Left}px)`;
  }, []);

  // 动画弹回到目标页
  const animateToPage = useCallback((targetPage: number) => {
    const container = containerRef.current;
    if (!container) return;

    const maxScroll = getMaxScroll(container.clientWidth);
    const targetScrollX = targetPage === 0 ? 0 : maxScroll;
    const startScrollX = dragState.current.currentScrollX;
    const distance = targetScrollX - startScrollX;

    if (Math.abs(distance) < 1) {
      dragState.current.currentScrollX = targetScrollX;
      applyTransform(targetScrollX);
      return;
    }

    const duration = 300;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentScrollX = startScrollX + distance * eased;

      dragState.current.currentScrollX = currentScrollX;
      applyTransform(currentScrollX);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        dragState.current.currentScrollX = targetScrollX;
        applyTransform(targetScrollX);
      }
    };

    requestAnimationFrame(animate);

    if (targetPage !== currentPage) {
      setCurrentPage(targetPage);
      onPageChange?.(targetPage);
    }
  }, [currentPage, onPageChange, applyTransform]);

  // Pointer 事件处理
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;

    const ds = dragState.current;
    ds.isDragging = true;
    ds.startX = e.clientX;
    ds.startY = e.clientY;
    ds.startScrollX = ds.currentScrollX;
    ds.lastX = e.clientX;
    ds.lastTime = e.timeStamp;
    ds.velocity = 0;
    ds.directionLocked = false;
    ds.isHorizontal = false;
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const ds = dragState.current;
    if (!ds.isDragging) return;

    const deltaX = e.clientX - ds.startX;
    const deltaY = e.clientY - ds.startY;

    if (!ds.directionLocked && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
      ds.directionLocked = true;
      ds.isHorizontal = Math.abs(deltaX) > Math.abs(deltaY);
      if (ds.isHorizontal) {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }
    }

    if (!ds.isHorizontal) return;

    e.preventDefault();

    const dt = e.timeStamp - ds.lastTime;
    if (dt > 0) {
      ds.velocity = (e.clientX - ds.lastX) / dt;
    }
    ds.lastX = e.clientX;
    ds.lastTime = e.timeStamp;

    const container = containerRef.current;
    if (!container) return;
    const maxScroll = getMaxScroll(container.clientWidth);
    ds.maxScroll = maxScroll;

    const newScrollX = Math.max(0, Math.min(ds.startScrollX - deltaX, maxScroll));
    ds.currentScrollX = newScrollX;
    applyTransform(newScrollX);
  }, [applyTransform]);

  const handlePointerUp = useCallback(() => {
    const ds = dragState.current;
    if (!ds.isDragging) return;
    ds.isDragging = false;

    if (!ds.isHorizontal) return;

    const maxScroll = ds.maxScroll;
    if (maxScroll <= 0) return;
    const scrollRatio = ds.currentScrollX / maxScroll;

    let targetPage: number;
    if (Math.abs(ds.velocity) > VELOCITY_THRESHOLD) {
      targetPage = ds.velocity < 0 ? 1 : 0;
    } else {
      if (currentPage === 0) {
        targetPage = scrollRatio > SWIPE_THRESHOLD ? 1 : 0;
      } else {
        targetPage = scrollRatio < (1 - SWIPE_THRESHOLD) ? 0 : 1;
      }
    }

    animateToPage(targetPage);
  }, [currentPage, animateToPage]);

  const handlePointerCancel = useCallback(() => {
    const ds = dragState.current;
    if (!ds.isDragging) return;
    ds.isDragging = false;
    animateToPage(currentPage);
  }, [currentPage, animateToPage]);

  // 初始化 transform — useLayoutEffect 确保在浏览器绘制前同步执行
  useLayoutEffect(() => {
    applyTransform(dragState.current.currentScrollX);
  }, [applyTransform]);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden"
      style={{
        backgroundColor: '#000000',
        touchAction: 'pan-y',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* Page 0：数字 + 运算符 — 绝对定位 pin 在原地，只改 opacity */}
      <div
        className="absolute inset-0 flex"
        style={{
          pointerEvents: currentPage === 0 ? 'auto' : 'none',
          willChange: 'opacity',
        }}
      >
        {children[0]}
      </div>

      {/* Page 1：科学面板 — 绝对定位，7/9 宽，通过 translateX 从右侧滑入 */}
      <div
        className="absolute top-0 bottom-0"
        style={{
          width: `${PAGE_1_WIDTH_RATIO * 100}%`,
          left: 0,
          transform: `translateX(100vw)`,
          pointerEvents: currentPage === 1 ? 'auto' : 'none',
          willChange: 'transform',
        }}
      >
        {children[1]}
      </div>
    </div>
  );
};
