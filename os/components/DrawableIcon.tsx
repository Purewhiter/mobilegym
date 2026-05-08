import React from 'react';
import type { AppIconSource, IconProps } from '../types/res';

/**
 * 通用图标渲染组件 — 对应 Android ImageView 使用 Drawable 资源
 *
 * 统一渲染三种图标来源，切换实现只需改 res/drawable/icons.tsx，业务组件无需修改：
 *   1. SVG 组件（lucide-react 图标 / 自定义 SVG）
 *   2. 图片 URL（PNG / WebP，通过 Vite import 获得）
 *   3. Tailwind React 组件（纯 CSS/HTML 实现的图标形状）
 *
 * 用法：
 *   import { TabHome, IcBack } from '../res/drawable/icons';
 *   import { DrawableIcon } from '@/os/components/DrawableIcon';
 *
 *   <DrawableIcon icon={TabHome} size={24} color="currentColor" />
 *   <DrawableIcon icon={tabPhotoPng} size={32} className="opacity-70" />
 */
export const DrawableIcon: React.FC<{ icon: AppIconSource } & IconProps> = ({
  icon,
  size = 24,
  color = 'currentColor',
  strokeWidth,
  className = '',
}) => {
  if (typeof icon === 'string') {
    // PNG / WebP / 图片 URL
    return (
      <img
        src={icon}
        width={typeof size === 'number' ? size : undefined}
        height={typeof size === 'number' ? size : undefined}
        className={className}
        alt=""
        aria-hidden="true"
        draggable={false}
        style={typeof size === 'string' ? { width: size, height: size } : undefined}
      />
    );
  }

  // SVG 组件 / lucide-react / Tailwind React 组件
  const Comp = icon;
  return (
    <Comp
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={className}
    />
  );
};
