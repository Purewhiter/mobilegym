import React from 'react';

export function LevelDial(props: { size?: number; angleDeg?: number }) {
  const { size = 320, angleDeg = 1 } = props;
  const cx = size / 2;
  const cy = size / 2;

  const showLine = Math.abs(angleDeg) >= 3;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
        {/* Outer circle */}
        <circle
          cx={cx}
          cy={cy}
          r={size * 0.44}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={2}
        />

        {/* Main level line */}
        {showLine ? (
          <g transform={`rotate(${angleDeg} ${cx} ${cy})`}>
            <line
              x1={cx - size * 0.34}
              y1={cy}
              x2={cx + size * 0.34}
              y2={cy}
              stroke="rgba(255,255,255,0.9)"
              strokeWidth={2.6}
              strokeLinecap="round"
            />
          </g>
        ) : null}

        {/* Center ring */}
        <circle cx={cx} cy={cy} r={size * 0.02} fill="rgba(0,0,0,1)" />
        <circle cx={cx} cy={cy} r={size * 0.026} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={2} />
        <circle cx={cx} cy={cy} r={size * 0.04} fill="none" stroke="rgba(255,59,48,0.9)" strokeWidth={2.4} />
      </svg>
    </div>
  );
}

