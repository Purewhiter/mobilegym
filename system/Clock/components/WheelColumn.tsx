import React, { useEffect, useRef } from 'react';
import { dimens } from '../res/dimens';
import { pad2 } from '../utils';

const PREPEND_WHEEL = 3;
/**
 * 滚动静止判定窗口（真实时间 ms）。
 * 拨动进行中相邻 scroll 事件的间隔远小于该值（真实触摸/惯性 ~16ms/帧，
 * __SIM_INPUT__.swipe 分步 scrollBy 间隔 ≤~60ms）；静止超过该窗口才把
 * scrollTop 吸附到整格。真机滚轮同样是「松手落定后」才吸附。
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

  // 手势监听 effect 只挂载一次（重挂会丢失拨动中途的 settle 定时器），
  // 可变的渲染值经 snapshotRef 读取。
  const snapshotRef = useRef({ value, onChange, wrap, itemHeight, displayOptions, mainStart, mainEnd, optionCount: options.length });
  snapshotRef.current = { value, onChange, wrap, itemHeight, displayOptions, mainStart, mainEnd, optionCount: options.length };

  const pointerActiveRef = useRef(false); // 手指按住中（touch/pointer down ~ up）
  const scrollActiveRef = useRef(false); // 滚动事件流未静止
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveRafRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const readIndex = () => {
      const snap = snapshotRef.current;
      const idx = Math.round(el.scrollTop / snap.itemHeight);
      return Math.min(snap.displayOptions.length - 1, Math.max(0, idx));
    };

    // 拨动进行中的实时反馈：只上报最近格的值（选中高亮跟手）+ wrap 周期平移。
    // 绝不在这里做取整吸附——中途吸附会与 __SIM_INPUT__.swipe 的分步 scrollBy
    // 竞争，把亚格进度取整掉，长行程会累计成 ±1 格失格。
    const liveUpdate = () => {
      const snap = snapshotRef.current;
      const idx = readIndex();
      const next = snap.displayOptions[idx];
      if (next !== snap.value) snap.onChange(next);
      if (snap.wrap && (idx < snap.mainStart || idx > snap.mainEnd)) {
        // 滚进首尾克隆区：按整周期平移回主区。平移保留亚格偏移（视觉等价
        // 位置），即使插在分步 scrollBy 之间也不改变最终落点。
        const cycle = snap.optionCount * snap.itemHeight;
        el.scrollTop += idx < snap.mainStart ? cycle : -cycle;
      }
    };

    // 滚动静止后的统一吸附：对齐最近整格并上报值。
    const trySettle = () => {
      settleTimerRef.current = null;
      if (pointerActiveRef.current) return; // 手指仍按住：松手时重新计时
      if ((window.__SIM_SCROLLING__ ?? 0) > 0) {
        // __SIM_INPUT__ 程序滚动（含惯性段）仍在进行：延后吸附
        settleTimerRef.current = setTimeout(trySettle, SNAP_SETTLE_MS);
        return;
      }
      scrollActiveRef.current = false;
      const snap = snapshotRef.current;
      let idx = readIndex();
      if (snap.wrap && (idx < snap.mainStart || idx > snap.mainEnd)) {
        idx += idx < snap.mainStart ? snap.optionCount : -snap.optionCount;
      }
      const next = snap.displayOptions[idx];
      if (next !== snap.value) snap.onChange(next);
      const target = idx * snap.itemHeight;
      if (Math.abs(el.scrollTop - target) > 0.5) el.scrollTop = target;
    };

    const scheduleSettle = () => {
      if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(trySettle, SNAP_SETTLE_MS);
    };

    const onScroll = () => {
      scrollActiveRef.current = true;
      scheduleSettle();
      cancelAnimationFrame(liveRafRef.current);
      liveRafRef.current = requestAnimationFrame(liveUpdate);
    };

    const onPressStart = () => {
      pointerActiveRef.current = true;
    };
    const onPressEnd = () => {
      pointerActiveRef.current = false;
      scheduleSettle();
    };

    el.addEventListener('scroll', onScroll);
    el.addEventListener('touchstart', onPressStart);
    el.addEventListener('pointerdown', onPressStart);
    el.addEventListener('touchend', onPressEnd);
    el.addEventListener('touchcancel', onPressEnd);
    el.addEventListener('pointerup', onPressEnd);
    el.addEventListener('pointercancel', onPressEnd);
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('touchstart', onPressStart);
      el.removeEventListener('pointerdown', onPressStart);
      el.removeEventListener('touchend', onPressEnd);
      el.removeEventListener('touchcancel', onPressEnd);
      el.removeEventListener('pointerup', onPressEnd);
      el.removeEventListener('pointercancel', onPressEnd);
      if (settleTimerRef.current !== null) clearTimeout(settleTimerRef.current);
      cancelAnimationFrame(liveRafRef.current);
    };
    // 只挂载一次：所有可变量经 snapshotRef 读取
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 外部设值（初始定位/程序改 value）时滚到对应格。
  // 手势或滚动进行中挂起——真机滚轮拖动时程序吸附不会打断手指；
  // 手势结束后 trySettle 以实际停点为准。内部滚动上报的 value 回流
  // （scrollTop 已在该格）不重排，避免取整掉正在进行的滚动进度。
  useEffect(() => {
    const el = containerRef.current;
    if (!el || scrollIndexForValue < 0) return;
    if (pointerActiveRef.current || scrollActiveRef.current) return;
    const target = scrollIndexForValue * itemHeight;
    if (Math.round(el.scrollTop / itemHeight) === scrollIndexForValue && Math.abs(el.scrollTop - target) <= 1) return;
    el.scrollTop = target;
  }, [value, scrollIndexForValue, itemHeight]);

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
