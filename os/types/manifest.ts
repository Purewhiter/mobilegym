import type { ReactNode } from 'react';
import type { AppId } from '../types';
import type { AppIconSource } from './res';
import type { PermissionId } from '../permissions';

/** App 主题颜色 — 所有 App 可配置的颜色 */
export interface AppThemeColors {
  /** 主色调（按钮、激活状态）— 必填 */
  primary: string;
  /** 主色深色变体（按下态、Header） */
  primaryDark?: string;
  /** Primary 色背景上的文本/图标色（Material Design onPrimary） */
  onPrimary?: string;
  /** 辅助色 */
  secondary?: string;
  /** 强调色（徽章、指示器） */
  accent?: string;
  /** 页面背景色 — 必填 */
  background: string;
  /** 卡片/浮层背景 */
  surface?: string;
  /** Surface 色背景上的文本/图标色（Material Design onSurface） */
  onSurface?: string;
  /** 主文本色 — 必填 */
  textPrimary: string;
  /** 次文本色 — 必填 */
  textSecondary: string;
  /** 边框色 */
  border?: string;
  /** Tab 栏背景色 */
  tabBarBg?: string;
  /**
   * 默认状态栏前景风格。
   * 规范语义与 `data-status-bar-foreground` 一致：
   * - `light` = 浅色前景（白色文字/图标）
   * - `dark` = 深色前景（黑色文字/图标）
   */
  statusBarForeground: 'dark' | 'light';
  /**
   * 默认导航栏/手势条前景风格。
   * 规范语义与 `data-navigation-bar-foreground` 一致：
   * - `light` = 浅色前景（白色手势条）
   * - `dark` = 深色前景（黑色手势条）
   */
  navigationBarForeground?: 'dark' | 'light';
}

/** App 主题 */
export interface AppTheme {
  colors: AppThemeColors;
  /** 深色模式颜色（未提供时使用 colors） */
  colorsDark?: AppThemeColors;
  /** CSS font-family 覆盖（空 = 系统默认） */
  fontFamily?: string;
}

/**
 * App 启动开屏配置（可选）。
 *
 * 不设 = 走默认系统级 splash（主题色铺底 + 图标 scale-in，时长 = 实际加载时间）。
 *        系统 App（计算器、设置、笔记等）通常什么都不用配，加载 < 200ms 就会"白屏一闪而过"，
 *        与真机系统 App 行为一致。
 *
 * 设了 = 在系统 splash 之上叠加扩展层；用于商业 App 的"图标 + 标语"开屏页或自定义内容。
 *
 * - `kind: 'branded'` — 系统 splash + 图标下方加 tagline，可选 `minDurationMs` 强制最短停留
 *                       （不管 chunk 加载多快），匹配微信/淘宝等商业 App 的开屏行为。
 * - `kind: 'custom'`  — 完全自定义 render（开屏广告 / 特殊动画 / 视频帧等的逃生口）。
 */
export type AppSplashConfig =
  | { kind: 'branded'; tagline?: string; minDurationMs?: number }
  | { kind: 'custom'; render: (manifest: AppManifest) => ReactNode };

/** App Manifest — 每个 App 的完整自声明 */
export interface AppManifest {
  /** 唯一标识符 */
  id: AppId;
  /** Android 风格包名 */
  packageName: string;
  /** 显示名称（中文原文 key，供 osT 翻译） */
  displayName: string;
  /** 英文显示名称（i18n 用，不设则回退 displayName） */
  displayNameEn?: string;
  /** Agent/benchmark 可识别的名称别名 */
  aliases?: string[];
  /** 版本（语义化版本号） */
  version: string;
  /** 版本码（整数，用于更新比较） */
  versionCode: number;
  /** App 类型（不再有 dock；原 dock 映射为 system） */
  type: 'system' | 'plugin';
  /** 图标 — App 自己提供（支持 React 组件或图片 URL） */
  icon: AppIconSource;
  /** 图标背景（CSS background 值：'#rrggbb' 或 'linear-gradient(...)'） */
  iconBackground: string;
  /** 图标前景色（CSS color 值） */
  iconForeground?: string;
  /** 主题 */
  theme: AppTheme;
  /**
   * 设计视口宽度（逻辑 px）。若设置，OS 会对该 App 应用 zoom = viewportWidth / designViewportWidth，
   * 使按更大/更小设计稿开发的 App 在 360 宽视口下正确显示。与系统 displayScale 叠加生效。
   */
  designViewportWidth?: number;
  /** Intent 过滤器（对应 Android <intent-filter>）— App 能接收的 Intent */
  intentFilters?: AppIntentFilter[];
  /** 可发出的 Intent 声明（对应 Android <queries>）— 供 bench_env 静态分析 */
  queries?: AppQuery[];
  /** 权限声明（预留） */
  permissions?: PermissionId[];
  /**
   * 可选启动开屏配置。不设 = 走系统级默认 splash（主题色 + 图标 scale-in），
   * 大多数系统 App 不需要配置。商业 App 可设为 `branded` / `custom` 模拟真机开屏。
   */
  splash?: AppSplashConfig;
}

export interface AppIntentFilter {
  /** Intent 动作（如 'ACTION_SEND', 'ACTION_VIEW', 'ACTION_DIAL'） */
  action: string;
  /** MIME 类型过滤（如 'text/plain', 'image/*'） */
  type?: string;
  /** URL scheme 过滤（如 'weixin', 'tel', 'http'） */
  scheme?: string;
  /** 接收此 intent 时导航到的路由路径（如 '/receive-share'） */
  route: string;
  /**
   * 启动模式（对应 Android `<activity android:launchMode>`）。
   * - `standard`（默认）：进入调用方 Task 或新 Task（取决于 caller flags），完成后回到调用方。
   * - `singleTask`：始终进入接收方自己的 Task；若该 Task 已存在，则**清空其上层 Activity 并重置 root 历史**到本 route，
   *   接收方处理完成后停留在自己 Task 中，不会回退到调用方（典型场景：分享接收 / 二维码扫描结果）。
   *
   * 真机上 launchMode 是 per-Activity 的，本模拟器以 per-intent-filter 表达 —— 每条 filter 等价于真机里一个独立的接收 Activity。
   */
  launchMode?: 'standard' | 'singleTask';
  /** 路由参数说明 */
  params?: { name: string; type: 'string' | 'number'; description?: string }[];
  /** 描述（供文档 / bench_env） */
  description?: string;
}

/** App 可发出的 Intent 声明（对应 Android <queries>） */
export interface AppQuery {
  /** Intent 动作 */
  action: string;
  /** MIME 类型（可选） */
  type?: string;
  /** URL scheme（可选） */
  scheme?: string;
}

/** 跨应用 Intent 载荷（对应 Android Intent） */
export interface IntentPayload {
  /** Intent 动作（如 'ACTION_PAY', 'ACTION_SEND'） */
  action: string;
  /** MIME 类型（如 'text/plain'） */
  type?: string;
  /** URL scheme（如 'alipays'） */
  scheme?: string;
  /** 目标路由路径（如 '/pay/cashier'） */
  route?: string;
  /** 携带的数据 */
  data?: Record<string, any>;
}

/** Activity 返回结果（对应 Android ActivityResult） */
export interface ActivityResult {
  resultCode: 'OK' | 'CANCELED' | 'FAILED';
  data?: Record<string, any>;
}
