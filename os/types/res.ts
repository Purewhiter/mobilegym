import type { ComponentType } from 'react';

/**
 * 标准图标 Props — 对应 Android VectorDrawable 的属性集
 * 所有 res/drawable/icons.tsx 中的自定义 SVG 组件必须实现此接口，
 * 以保证可以无缝替换 lucide-react 图标。
 *
 * 使用方式：
 *   // icons.tsx 中替换 lucide 图标为自定义 SVG，只改此一处：
 *   // 替换前：export { ChevronLeft } from 'lucide-react';
 *   // 替换后：export const ChevronLeft: React.FC<IconProps> = ({size=24, color='currentColor', className=''}) => <svg .../>
 *   // 业务组件无需任何改动 ✅
 */
export interface IconProps {
  /** 图标尺寸（px），对应 lucide 的 size prop */
  size?: number | string;
  /** 图标颜色，对应 lucide 的 color prop */
  color?: string;
  /** 描边宽度，对应 lucide 的 strokeWidth prop */
  strokeWidth?: number | string;
  /** CSS class */
  className?: string;
}

/**
 * 统一图标来源类型 — 对应 Android Drawable 的所有子类
 *
 * 支持的实现类型：
 *   - ComponentType<IconProps>  ← lucide-react 图标 / 自定义 SVG 组件 / Tailwind React 组件
 *   - string                   ← PNG / WebP / SVG 图片 URL（import xxx from './assets/foo.png'）
 *
 * 配合 <AppIcon> 组件统一渲染：
 *   <AppIcon icon={TabHome} size={24} />         // SVG/lucide
 *   <AppIcon icon={tabHomePng} size={24} />       // PNG
 *
 * 在 res/drawable/icons.tsx 中定义语义名：
 *   // lucide
 *   export { Home as TabHome } from 'lucide-react';
 *   // PNG
 *   import _tabHome from '../assets/tab/home.png';
 *   export const TabHome = _tabHome;
 *   // 自定义 SVG
 *   export const TabHome: React.FC<IconProps> = ({ size, color, className }) => <svg>...</svg>;
 *   // Tailwind 纯 CSS 组件
 *   export const TabHome: React.FC<IconProps> = ({ size = 24, className = '' }) => (
 *     <span style={{ width: size, height: size }} className={`inline-block rounded-full bg-current ${className}`} />
 *   );
 */
export type AppIconSource =
  | ComponentType<IconProps>
  | string; // image URL (PNG / WebP / SVG file)

export type ColorState =
  | 'default'
  | 'pressed'
  | 'active'
  | 'selected'
  | 'disabled'
  | 'focused'
  | 'checked';

/** 对应 Android res/color/*.xml 的状态颜色列表 */
export type ColorStateList = Partial<Record<ColorState, string>> & { default: string };
