import React, { useEffect, useRef } from 'react';
import { dimens } from '../res/dimens';
import { pad2 } from '../utils';

const PREPEND_WHEEL = 3;

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

  useEffect(() => {
    if (containerRef.current && scrollIndexForValue >= 0) {
      containerRef.current.scrollTop = scrollIndexForValue * itemHeight;
    }
  }, [value, options, scrollIndexForValue, itemHeight]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const idx = Math.round(el.scrollTop / itemHeight);
        const clamped = Math.min(displayOptions.length - 1, Math.max(0, idx));
        const nextValue = displayOptions[clamped];
        if (nextValue !== value) onChange(nextValue);
        if (wrap && (clamped < mainStart || clamped > mainEnd)) {
          el.scrollTop = (PREPEND_WHEEL + nextValue) * itemHeight;
        }
      });
    };
    el.addEventListener('scroll', onScroll);
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [displayOptions, value, onChange, wrap, mainStart, mainEnd, itemHeight]);

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
