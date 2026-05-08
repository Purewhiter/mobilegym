import React, { useCallback, useRef, useState } from 'react';

interface CalcButtonProps {
  label: string;
  fontSize?: number | string;
  textColor?: string;
  rippleColor?: string;
  uppercase?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onTrigger?: () => void;
  onLongPress?: () => void;
  /** data-action 属性（agent 可观测） */
  'data-action'?: string;
  'data-action-type'?: string;
}

/**
 * 通用计算器按钮 — Material Design ripple 效果
 * 对应 AOSP 的 pad_button_background.xml (ripple drawable)
 */
export const CalcButton: React.FC<CalcButtonProps> = ({
  label,
  fontSize = 23,
  textColor = '#FFFFFF',
  rippleColor = 'rgba(255,255,255,0.2)',
  uppercase = false,
  className = '',
  style,
  onTrigger,
  onLongPress,
  ...restProps
}) => {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const rippleIdRef = useRef(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const isLongPressRef = useRef(false);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    // 创建 ripple
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = ++rippleIdRef.current;
    setRipples(prev => [...prev, { id, x, y }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 600);

    // 长按检测
    isLongPressRef.current = false;
    if (onLongPress) {
      longPressTimerRef.current = setTimeout(() => {
        isLongPressRef.current = true;
        onLongPress();
      }, 500);
    }
  }, [onLongPress]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  }, []);

  const handleClick = useCallback(() => {
    if (!isLongPressRef.current && onTrigger) {
      onTrigger();
    }
  }, [onTrigger]);

  return (
    <button
      className={`relative overflow-hidden select-none flex items-center justify-center
        transition-colors active:brightness-90 ${className}`}
      style={{
        fontSize: typeof fontSize === 'number' ? `${fontSize}px` : fontSize,
        color: textColor,
        fontWeight: 300,
        fontFamily: 'sans-serif',
        textTransform: uppercase ? 'uppercase' : 'none',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
        ...style,
      }}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      {...restProps}
    >
      {label}
      {/* Ripple effects */}
      {ripples.map(r => (
        <span
          key={r.id}
          className="absolute rounded-full animate-ripple pointer-events-none"
          style={{
            left: r.x,
            top: r.y,
            width: 0,
            height: 0,
            transform: 'translate(-50%, -50%)',
            backgroundColor: rippleColor,
          }}
        />
      ))}
    </button>
  );
};
