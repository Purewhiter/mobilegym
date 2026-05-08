import React from 'react';

export const MaskIcon: React.FC<{
  src: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  /**
   * Some glyph-based SVGs have very tight viewBox bounds. When used as a CSS mask
   * at small sizes, edge pixels can get clipped by rasterization/rounding.
   * Shrinking the mask slightly avoids the "bottom edge missing" artifact.
   */
  maskScale?: number; // 0~1, default 0.96
}> = ({ src, size = 24, className = '', style, maskScale = 0.96 }) => {
  const px = typeof size === 'number' ? `${size}px` : String(size);
  const scale = Number.isFinite(maskScale) ? Math.min(1, Math.max(0, maskScale)) : 1;
  const scalePct = `${(scale * 100).toFixed(2)}% ${(scale * 100).toFixed(2)}%`;
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        width: px,
        height: px,
        display: 'inline-block',
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url(${src})`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        WebkitMaskSize: scalePct,
        maskImage: `url(${src})`,
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        maskSize: scalePct,
        ...style,
      }}
    />
  );
};

