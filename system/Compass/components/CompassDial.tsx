import React from 'react';
import compassDialUrl from '../assets/compass_dial.svg';

/**
 * CompassDial - 使用原生矢量资源渲染指南针圆盘。
 *
 * compass_dial.svg 由 VectorDrawable 转为 SVG，包含 360° 刻度线、度数标签、
 * 方向文字(N/E/S/W)、红色北指针三角和中心十字。
 *
 * 整个 SVG 根据 headingDeg 旋转，固定三角指示器在圆盘外部不动。
 */
export function CompassDial(props: {
  size?: number;
  headingDeg?: number;
  directionText?: string;
}) {
  const { size = 290, headingDeg = 69, directionText = '东' } = props;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Fixed pointer (small triangle at top, does NOT rotate) */}
      <div className="absolute -top-5 left-1/2 -translate-x-1/2">
        <div
          className="w-0 h-0"
          style={{
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            borderBottom: '12px solid rgba(255,255,255,0.95)',
          }}
        />
      </div>

      {/* Native compass dial SVG - rotates based on heading */}
      <img
        src={compassDialUrl}
        alt=""
        width={size}
        height={size}
        className="block"
        style={{
          transform: `rotate(${-headingDeg}deg)`,
          filter: 'drop-shadow(0 0 0 rgba(0,0,0,0))',
        }}
        draggable={false}
      />

      {/* Accessibility label */}
      <div className="sr-only">{directionText}{headingDeg}°</div>
    </div>
  );
}
