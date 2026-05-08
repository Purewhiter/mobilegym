/**
 * CollapsingToolbar — 系统级折叠标题栏组件
 *
 * 复刻 HyperOS 原生 CollapsingToolbarLayout 行为：
 * - 大标题在内容区展示，随滚动淡出 + 上移
 * - 小标题在固定 TopBar 中居中，随滚动淡入
 * - 按钮统一 40dp 触控区、8dp 间距
 *
 * 关键尺寸来自反编译 Deskclock/Settings APK dimens.xml:
 *   - 展开标题字号: 36dp (Settings) / 32sp (通用 miuix_font_size_title1)
 *   - 折叠标题字号: 20dp (miuix_font_size_title3)
 *   - ActionBar 按钮: 26×26dp drawable, 40dp 触控区, 间距 8dp
 *   - ActionBar 水平 padding: 20dp (miuix_appcompat_action_bar_horizontal_padding_start/end)
 *   - 菜单项内 padding: 3.27dp (miuix_appcompat_action_menu_item_view_padding_horizontal)
 *   - 展开标题水平 padding: 26dp (miuix_appcompat_action_bar_title_horizontal_padding)
 *   - Toolbar 高度: 56dp (miuix_appcompat_action_bar_default_height)
 *   - 返回按钮 margin: start 8dp (miuix_appcompat_action_bar_up_view_margin_start)
 *
 * 用法:
 *   <CollapsingToolbar
 *     title="设置"
 *     scrollTop={scrollTop}
 *     rightContent={<ToolbarIconButton icon={MoreVertical} />}
 *   />
 *   // ... 在滚动容器中:
 *   <div className="h-24" />  {/* spacer for fixed toolbar *\/}
 *   <CollapsingLargeTitle title="设置" scrollTop={scrollTop} />
 *   {/* ... page content ... *\/}
 */
import React from 'react';
import { ChevronLeft } from 'lucide-react';

/* ── 常量（基于反编译真机参数，dp → tailwind/px 近似） ── */

/** 大标题开始淡出的滚动距离 */
const LARGE_TITLE_COLLAPSE_RANGE = 60;
/** 小标题开始淡入的滚动起点 */
const SMALL_TITLE_FADE_START = 40;
/** 小标题完成淡入的滚动终点 */
const SMALL_TITLE_FADE_END = 80;
/** 大标题随滚动上移的视差系数 */
const PARALLAX_FACTOR = 0.2;

/* ── CollapsingToolbar (固定顶栏) ── */

interface CollapsingToolbarProps {
  /** 标题文本 */
  title: string;
  /** 当前滚动距离 (px) */
  scrollTop?: number;
  /** 是否显示返回按钮 */
  showBack?: boolean;
  /** 返回按钮点击回调 */
  onBack?: () => void;
  /** 右侧内容 (操作按钮) */
  rightContent?: React.ReactNode;
  /** 左侧自定义内容 (优先于 showBack) */
  leftContent?: React.ReactNode;
  /** 始终显示小标题 (子页面无大标题时) */
  alwaysShowSmallTitle?: boolean;
  /** 背景色 class, 默认 bg-[#F5F5F5] */
  bgClass?: string;
  /** 外部控制小标题 opacity (0-1)，覆盖内部渐变计算 */
  smallTitleOpacity?: number;
}

export const CollapsingToolbar: React.FC<CollapsingToolbarProps> = ({
  title,
  scrollTop = 0,
  showBack = false,
  onBack,
  rightContent,
  leftContent,
  alwaysShowSmallTitle = false,
  bgClass = 'bg-[#F5F5F5]',
  smallTitleOpacity: smallTitleOpacityProp,
}) => {
  const smallTitleOpacity = alwaysShowSmallTitle
    ? 1
    : smallTitleOpacityProp !== undefined
      ? smallTitleOpacityProp
      : Math.max(0, Math.min(1, (scrollTop - SMALL_TITLE_FADE_START) / (SMALL_TITLE_FADE_END - SMALL_TITLE_FADE_START)));

  const renderLeft = () => {
    if (leftContent) return leftContent;
    if (showBack) {
      return (
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center -ml-2 active:opacity-60"
          aria-label="返回"
        >
          <ChevronLeft size={28} className="text-gray-900" />
        </button>
      );
    }
    return <div className="flex-1" />;
  };

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-30 pt-10 px-5 ${bgClass}`}
      data-status-bar-foreground="dark"
    >
      {/* h-14 ≈ 56dp action bar height */}
      <div className="h-14 flex items-center justify-between relative">
        {renderLeft()}

        {/* 居中小标题 — absolute 保证无论左右内容如何都居中 */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-150"
          style={{ opacity: smallTitleOpacity }}
        >
          {/* 20sp collapsed title */}
          <span className="text-[20px] font-semibold text-gray-900">{title}</span>
        </div>

        {/* 右侧操作区 — -mr-1 补偿 40px 触控区 vs 真机 ~32dp 菜单项宽度差 */}
        <div className="flex items-center gap-2 -mr-1">
          {rightContent}
        </div>
      </div>
    </div>
  );
};

/* ── CollapsingLargeTitle (内联大标题，放在滚动容器内) ── */

interface CollapsingLargeTitleProps {
  /** 标题文本 */
  title: string;
  /** 当前滚动距离 (px) */
  scrollTop: number;
  /** 自定义字号 class, 默认 text-[32px] (miuix_font_size_title1 = 32sp) */
  fontSizeClass?: string;
  /** 使用 sticky 两阶段折叠 (搜索栏先隐藏 → 大标题后推出) */
  sticky?: boolean;
  /** sticky 偏移 (px), 默认 TOOLBAR_SPACER_HEIGHT */
  stickyTop?: number;
  /** sticky 背景色 class */
  stickyBgClass?: string;
  /** 覆盖标题文字 opacity (sticky 模式由外部按阶段控制) */
  opacity?: number;
}

export const CollapsingLargeTitle = React.forwardRef<HTMLDivElement, CollapsingLargeTitleProps>(
  function CollapsingLargeTitle(
    {
      title,
      scrollTop,
      fontSizeClass = 'text-[32px]',
      sticky = false,
      stickyTop = TOOLBAR_SPACER_HEIGHT,
      stickyBgClass = 'bg-[#F5F5F5]',
      opacity: opacityProp,
    },
    ref,
  ) {
    const opacity =
      opacityProp !== undefined
        ? opacityProp
        : Math.max(0, 1 - scrollTop / LARGE_TITLE_COLLAPSE_RANGE);

    if (sticky) {
      return (
        <div
          ref={ref}
          className={`px-[26px] pb-2 ${stickyBgClass}`}
          style={{ position: 'sticky', top: stickyTop, zIndex: 20 }}
        >
          <h1
            className={`${fontSizeClass} font-normal text-gray-900`}
            style={{ opacity }}
          >
            {title}
          </h1>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className="px-[26px] pb-2"
        style={{
          opacity,
          transform: `translateY(${-scrollTop * PARALLAX_FACTOR}px)`,
        }}
      >
        <h1 className={`${fontSizeClass} font-normal text-gray-900`}>{title}</h1>
      </div>
    );
  },
);

/* ── ToolbarIconButton (统一 40×40 触控区) ── */

interface ToolbarIconButtonProps {
  icon: React.FC<{ size?: number; className?: string; strokeWidth?: number }>;
  onClick?: () => void;
  className?: string;
  label?: string;
}

export const ToolbarIconButton: React.FC<ToolbarIconButtonProps> = ({
  icon: Icon,
  onClick,
  className = '',
  label,
}) => (
  <button
    onClick={onClick}
    className={`w-10 h-10 flex items-center justify-center active:opacity-60 ${className}`}
    aria-label={label}
  >
    <Icon size={26} className="text-gray-700" strokeWidth={1.5} />
  </button>
);

/* ── TOOLBAR_SPACER_CLASS — 固定顶栏占位高度 ── */
/** pt-10 (状态栏) + h-14 (toolbar) = 96px, 用 h-24 近似 */
export const TOOLBAR_SPACER_HEIGHT = 96;
