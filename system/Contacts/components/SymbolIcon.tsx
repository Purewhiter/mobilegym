import React from 'react';
import { getHyperosSymbolUrl } from '../res/icons';

type SymbolIconProps = {
  /** Symbol name from res/icons (e.g. IcSymbolAdd) or file name under hyperos-symbols without .svg */
  name: string;
  size?: number;
  className?: string;
  /** Accessibility label; omit for decorative icons */
  label?: string;
};

/**
 * HyperOS symbol icon renderer.
 *
 * Uses CSS mask to allow `text-*` color control via `currentColor`.
 */
export const SymbolIcon: React.FC<SymbolIconProps> = ({ name, size = 24, className = '', label }) => {
  const url = getHyperosSymbolUrl(name);
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        backgroundColor: 'currentColor',
        WebkitMaskImage: `url(${url})`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskImage: `url(${url})`,
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        maskSize: 'contain',
      }}
    />
  );
};

