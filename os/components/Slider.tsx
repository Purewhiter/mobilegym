import React, { useCallback, useEffect, useRef } from 'react';

export interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  onChangeCommitted?: (value: number) => void;
  min?: number;
  max?: number;
  /** 吸附步长;<=0 表示连续(不吸附) */
  step?: number;
  disabled?: boolean;
  /** 外层容器类 */
  className?: string;
  /** 未填充底色(默认 `bg-gray-200`) */
  trackClassName?: string;
  /** 已填充前景(默认 `bg-app-primary`) */
  fillClassName?: string;
  /** 拇指样式(默认 `bg-app-primary shadow-md`) */
  thumbClassName?: string;
  'data-action'?: string;
  'data-action-type'?: string;
  'data-action-params'?: string;
  'aria-label'?: string;
}

/**
 * 通用 Slider(替代 `<input type="range">`)
 *
 * 为什么不直接用原生 range:`__SIM_INPUT__` 合成的 Pointer/Touch/Mouse 事件 isTrusted=false,
 * 浏览器对原生表单控件的默认拖拽/点击行为仅响应 trusted 事件,导致 Agent tap/drag 无效。
 * 本组件纯 React Pointer 事件处理,合成事件可正常驱动。
 *
 * Pointer 隔离:pointerdown 时 `setPointerCapture` 把该 pointer 的后续事件 redirect 到
 * track 元素,随后的 move/up/cancel 通过元素级 React 监听接收——既不污染全局 pointer,
 * 也天然按 pointerId 隔离(第二指/并发 sim 输入不会干扰已激活的拖拽)。极少数
 * 环境下 setPointerCapture 抛错时才回退到 window capture,并按 pointerId 过滤。
 */
export const Slider: React.FC<SliderProps> = ({
  value,
  onChange,
  onChangeCommitted,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  className = '',
  trackClassName = 'bg-gray-200',
  fillClassName = 'bg-app-primary',
  thumbClassName = 'bg-app-primary shadow-md',
  ...dataProps
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const activePointerIdRef = useRef<number | null>(null);
  const lastValueRef = useRef(value);
  lastValueRef.current = value;

  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const range = max - min;
  const percent = range > 0 ? ((clamp(value) - min) / range) * 100 : 0;

  const snapClamp = useCallback(
    (n: number) => {
      const snapped = step > 0 ? Math.round(n / step) * step : n;
      return clamp(snapped);
    },
    [min, max, step],
  );

  const valueFromClientX = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track || range <= 0) return min;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return min;
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const raw = min + ratio * range;
      return snapClamp(raw);
    },
    [min, range, snapClamp],
  );

  const emitChange = useCallback(
    (next: number) => {
      if (next !== lastValueRef.current) {
        lastValueRef.current = next;
        onChange(next);
      }
    },
    [onChange],
  );

  // 仅在 setPointerCapture 不可用时的回退路径
  const windowHandlersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
  } | null>(null);

  const detachWindowHandlers = useCallback(() => {
    const h = windowHandlersRef.current;
    if (!h) return;
    window.removeEventListener('pointermove', h.move, true);
    window.removeEventListener('pointerup', h.up, true);
    window.removeEventListener('pointercancel', h.up, true);
    windowHandlersRef.current = null;
  }, []);

  const finishDrag = useCallback(
    (clientX: number, commit: boolean) => {
      const wasDragging = draggingRef.current;
      const id = activePointerIdRef.current;
      draggingRef.current = false;
      activePointerIdRef.current = null;
      if (id !== null) {
        try {
          trackRef.current?.releasePointerCapture?.(id);
        } catch {
          // ignore
        }
      }
      detachWindowHandlers();
      if (wasDragging && commit) {
        const next = valueFromClientX(clientX);
        emitChange(next);
        onChangeCommitted?.(next);
      }
    },
    [detachWindowHandlers, emitChange, onChangeCommitted, valueFromClientX],
  );

  useEffect(() => detachWindowHandlers, [detachWindowHandlers]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    // 已有 pointer 正在拖,忽略第二路(多指/并发 sim 输入)
    if (activePointerIdRef.current !== null) return;
    e.preventDefault();

    activePointerIdRef.current = e.pointerId;
    draggingRef.current = true;

    let captured = false;
    try {
      trackRef.current?.setPointerCapture?.(e.pointerId);
      captured = true;
    } catch {
      captured = false;
    }

    emitChange(valueFromClientX(e.clientX));

    if (!captured) {
      detachWindowHandlers();
      const activeId = e.pointerId;
      const move = (ev: PointerEvent) => {
        if (ev.pointerId !== activeId || !draggingRef.current) return;
        emitChange(valueFromClientX(ev.clientX));
      };
      const up = (ev: PointerEvent) => {
        if (ev.pointerId !== activeId) return;
        finishDrag(ev.clientX, ev.type !== 'pointercancel');
      };
      windowHandlersRef.current = { move, up };
      window.addEventListener('pointermove', move, true);
      window.addEventListener('pointerup', up, true);
      window.addEventListener('pointercancel', up, true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== activePointerIdRef.current || !draggingRef.current) return;
    emitChange(valueFromClientX(e.clientX));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== activePointerIdRef.current) return;
    finishDrag(e.clientX, true);
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== activePointerIdRef.current) return;
    finishDrag(e.clientX, false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const unit = step > 0 ? step : (range || 1) / 100;
    const bigUnit = Math.max(unit, (range || 1) / 10);
    const current = lastValueRef.current;
    let next = current;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        next = current - unit;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        next = current + unit;
        break;
      case 'PageDown':
        next = current - bigUnit;
        break;
      case 'PageUp':
        next = current + bigUnit;
        break;
      case 'Home':
        next = min;
        break;
      case 'End':
        next = max;
        break;
      default:
        return;
    }
    e.preventDefault();
    const clamped = snapClamp(next);
    emitChange(clamped);
    onChangeCommitted?.(clamped);
  };

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-orientation="horizontal"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clamp(value)}
      aria-disabled={disabled || undefined}
      aria-label={dataProps['aria-label']}
      data-action={dataProps['data-action']}
      data-action-type={dataProps['data-action-type']}
      data-action-params={dataProps['data-action-params']}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
      className={`relative py-3 select-none touch-none focus:outline-none ${disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer'} ${className}`}
      style={{ WebkitTapHighlightColor: 'transparent' }}
    >
      <div className={`h-1 rounded-full ${trackClassName}`}>
        <div
          className={`h-full rounded-full ${fillClassName}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div
        className={`absolute top-1/2 w-5 h-5 rounded-full ${thumbClassName}`}
        style={{
          left: `${percent}%`,
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
};

export default Slider;
