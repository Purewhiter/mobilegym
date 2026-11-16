import React, { useEffect, useRef } from 'react';
import { dimens } from '../res/dimens';
import { pad2 } from '../utils';

const PREPEND_WHEEL = 3;
/**
 * How long scrolling must stay quiet (real ms) before the wheel snaps to a
 * whole item. Scroll events during a drag or fling arrive every frame, and
 * __SIM_INPUT__.swipe's scroll steps and inertia tail are well under this apart.
 */
const SNAP_SETTLE_MS = 150;

export const WheelColumn: React.FC<{
  value: number;
  options: number[];
  onChange: (value: number) => void;
  /** 计时页使用大号滚轮 */
  large?: boolean;
  /** 闹钟编辑页使用中号滚轮（更大字体） */
  medium?: boolean;
  /** 循环滚轮：首尾相接（时 00 接 23，分 00 接 59） */
  wrap?: boolean;
}> = ({ value, options, onChange, large, medium, wrap }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const itemHeight = large ? dimens.wheel_item_height_large : medium ? dimens.wheel_item_height_medium : dimens.wheel_item_height_small;
  const displayOptions = wrap
    ? [...options.slice(-PREPEND_WHEEL), ...options, ...options.slice(0, PREPEND_WHEEL)]
    : options;
  const scrollIndexForValue = wrap ? PREPEND_WHEEL + options.indexOf(value) : options.indexOf(value);
  const mainStart = wrap ? PREPEND_WHEEL : 0;
  const mainEnd = wrap ? PREPEND_WHEEL + options.length - 1 : options.length - 1;

  // The gesture listeners mount once (remounting would drop a pending settle
  // timer mid-gesture); they read the current render's values from this ref.
  const latest = useRef({ value, onChange, wrap, itemHeight, displayOptions, mainStart, mainEnd, optionCount: options.length });
  latest.current = { value, onChange, wrap, itemHeight, displayOptions, mainStart, mainEnd, optionCount: options.length };
  const pressedRef = useRef(false);
  const scrollingRef = useRef(false);
  // scrollTop the wheel wrote itself; the scroll event it fires is not a gesture.
  const selfTopRef = useRef<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const readIndex = () => {
      const s = latest.current;
      return Math.min(s.displayOptions.length - 1, Math.max(0, Math.round(el.scrollTop / s.itemHeight)));
    };

    // While the wheel moves: report the nearest value so the highlight follows,
    // and shift a whole cycle out of the cloned ends. Never round scrollTop here —
    // snapping mid-gesture eats the sub-item progress of the scroll steps still
    // to come, so identical swipes land a varying number of items apart.
    const follow = () => {
      const s = latest.current;
      const idx = readIndex();
      const next = s.displayOptions[idx];
      if (next !== s.value) s.onChange(next);
      if (s.wrap && (idx < s.mainStart || idx > s.mainEnd)) {
        el.scrollTop += (idx < s.mainStart ? 1 : -1) * s.optionCount * s.itemHeight;
      }
    };

    // Once the finger is up and scrolling has been quiet for a while, snap to
    // the nearest item — a real wheel picker also snaps only after the fling ends.
    const settle = () => {
      settleTimer = null;
      if (pressedRef.current) return;
      scrollingRef.current = false;
      const s = latest.current;
      let idx = readIndex();
      if (s.wrap && (idx < s.mainStart || idx > s.mainEnd)) {
        idx += idx < s.mainStart ? s.optionCount : -s.optionCount;
      }
      const next = s.displayOptions[idx];
      if (next !== s.value) s.onChange(next);
      const target = idx * s.itemHeight;
      if (Math.abs(el.scrollTop - target) > 0.5) {
        selfTopRef.current = target;
        el.scrollTop = target;
      }
    };
    const scheduleSettle = () => {
      if (settleTimer !== null) clearTimeout(settleTimer);
      settleTimer = setTimeout(settle, SNAP_SETTLE_MS);
    };

    const onScroll = () => {
      const selfTop = selfTopRef.current;
      selfTopRef.current = null;
      if (selfTop !== null && !pressedRef.current && Math.abs(el.scrollTop - selfTop) <= 0.5) return;
      scrollingRef.current = true;
      scheduleSettle();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(follow);
    };
    const onPressStart = () => {
      pressedRef.current = true;
    };
    const onPressEnd = () => {
      pressedRef.current = false;
      scheduleSettle();
    };

    el.addEventListener('scroll', onScroll);
    el.addEventListener('pointerdown', onPressStart);
    el.addEventListener('pointerup', onPressEnd);
    el.addEventListener('pointercancel', onPressEnd);
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('pointerdown', onPressStart);
      el.removeEventListener('pointerup', onPressEnd);
      el.removeEventListener('pointercancel', onPressEnd);
      if (settleTimer !== null) clearTimeout(settleTimer);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Scroll to the value when it is set from outside (first layout, a new
  // draft). Skipped while a gesture or scroll is in progress: the value then
  // comes from the wheel itself, and `settle` aligns to where it stops.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || scrollIndexForValue < 0) return;
    if (pressedRef.current || scrollingRef.current) return;
    const target = scrollIndexForValue * itemHeight;
    if (Math.abs(el.scrollTop - target) > 0.5) {
      selfTopRef.current = target;
      el.scrollTop = target;
    }
  }, [value, options, scrollIndexForValue, itemHeight]);

  const padHeight = large ? dimens.wheel_pad_height_large : medium ? dimens.wheel_pad_height_medium : dimens.wheel_pad_height_small;
  const cellClass = large ? 'h-(--app-wheel-item-height-large) text-[42px]' : medium ? 'h-(--app-wheel-item-height-medium) text-[36px]' : 'h-(--app-wheel-item-height-small) text-[28px]';
  const sizeClass = large ? 'w-(--app-wheel-width-large) h-(--app-wheel-height-large)' : medium ? 'w-(--app-wheel-width-medium) h-(--app-wheel-height-medium)' : 'w-(--app-wheel-width-small) h-(--app-wheel-height-small)';

  return (
    <div className={`overflow-y-scroll no-scrollbar ${sizeClass}`} ref={containerRef}>
      <div style={{ height: padHeight }} />
      {displayOptions.map((option, index) => (
        <div
          key={wrap ? `disp-${index}-${option}` : option}
          className={`flex items-center justify-center ${cellClass} ${option === value ? 'text-black font-medium' : 'text-gray-300'}`}
        >
          {pad2(option)}
        </div>
      ))}
      <div style={{ height: padHeight }} />
    </div>
  );
};
