import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseDraggableSheetOptions {
  /** 吸附高度（升序即可；拖拽结束会吸附到最近的一个） */
  snapPoints: number[];
  initialHeight: number;
  minHeight?: number;
  maxHeight?: number;
}

/**
 * 底部 Sheet 拖拽：与 ExplorePage 原有三套 pointer 逻辑一致，使用 dragActiveRef 避免首帧 move 时 isDragging 尚未提交的问题。
 */
export function useDraggableSheet(opts: UseDraggableSheetOptions): {
  height: number;
  setHeight: React.Dispatch<React.SetStateAction<number>>;
  isDragging: boolean;
  pointerHandlers: {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (e: React.PointerEvent<HTMLDivElement>) => void;
  };
} {
  const { initialHeight, minHeight = 100 } = opts;

  const [height, setHeight] = useState(initialHeight);
  const [isDragging, setIsDragging] = useState(false);

  const heightRef = useRef(height);
  useEffect(() => {
    heightRef.current = height;
  }, [height]);

  const snapPointsRef = useRef(opts.snapPoints);
  snapPointsRef.current = opts.snapPoints;

  const maxHeightRef = useRef(opts.maxHeight);
  maxHeightRef.current = opts.maxHeight;

  const dragActiveRef = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const pointerIdRef = useRef<number | null>(null);

  const snapToNearest = useCallback(() => {
    const snaps = snapPointsRef.current;
    if (!snaps.length) return;
    const h = heightRef.current;
    let best = snaps[0];
    let bestDist = Math.abs(h - best);
    for (let i = 1; i < snaps.length; i++) {
      const d = Math.abs(h - snaps[i]);
      if (d < bestDist) {
        bestDist = d;
        best = snaps[i];
      }
    }
    setHeight(best);
  }, []);

  const finishDrag = useCallback(() => {
    dragActiveRef.current = false;
    setIsDragging(false);
    pointerIdRef.current = null;
    snapToNearest();
  }, [snapToNearest]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    dragActiveRef.current = true;
    setIsDragging(true);
    pointerIdRef.current = e.pointerId;
    dragStartY.current = e.clientY;
    dragStartHeight.current = heightRef.current;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId || !dragActiveRef.current) return;
    if (e.pointerType === 'mouse' && (e.buttons & 1) === 0) {
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      }
      finishDrag();
      return;
    }
    e.preventDefault();
    const deltaY = dragStartY.current - e.clientY;
    const newHeight = dragStartHeight.current + deltaY;
    const max = maxHeightRef.current;
    if (max !== undefined && newHeight > max) return;
    if (newHeight < minHeight) return;
    setHeight(newHeight);
  }, [finishDrag, minHeight]);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== e.pointerId) return;
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      }
      finishDrag();
    },
    [finishDrag],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (pointerIdRef.current !== e.pointerId) return;
      finishDrag();
    },
    [finishDrag],
  );

  return {
    height,
    setHeight,
    isDragging,
    pointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
  };
}
