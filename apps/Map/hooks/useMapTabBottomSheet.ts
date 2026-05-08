import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useDraggableSheet } from './useDraggableSheet';
import { computeMapTabSheetSnaps } from '../utils/mapSheetSnaps';

/**
 * 「我 / 贡献」Tab Sheet：peek / **中间档 50% 屏高** / full 顶满；进入时吸附第三档（盖住搜索栏）。
 * 中间档与「本地生活脉搏」（约 20%）不同。
 *
 * 须在**同一次** layout 回调里根据实测容器高度写入 snaps 并 setHeight(full)。
 * 若拆成两个 useLayoutEffect，会先按默认 full=700 执行 setHeight 并打标「已初始化」，
 * 实测 full（如 h-48）到来后只会 Math.min 卡在 700，导致默认高度低于「顶满」吸附点。
 */
export function useMapTabBottomSheet(containerRef: React.RefObject<HTMLElement | null>) {
  const [snaps, setSnaps] = useState({ peek: 72, middle: 160, full: 700 });

  const snapArray = useMemo(
    () => [snaps.peek, snaps.middle, snaps.full],
    [snaps.peek, snaps.middle, snaps.full],
  );

  const { height, setHeight, isDragging, pointerHandlers } = useDraggableSheet({
    snapPoints: snapArray,
    initialHeight: snaps.full,
    minHeight: 56,
    maxHeight: snaps.full,
  });

  const initialFullAppliedRef = useRef(false);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const h = el.clientHeight;
      if (h <= 0) return;
      const next = computeMapTabSheetSnaps(h);
      setSnaps(next);
      if (!initialFullAppliedRef.current) {
        setHeight(next.full);
        initialFullAppliedRef.current = true;
      } else {
        setHeight((cur) => Math.min(cur, next.full));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [setHeight]);

  return {
    snaps,
    sheetHeight: height,
    setSheetHeight: setHeight,
    isDragging,
    pointerHandlers,
  };
}
