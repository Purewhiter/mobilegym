// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [background] 全局背景

  // [topbar] 顶部标签栏 (CompassTopBar)
  topbar_tab_active: 'rgba(255,255,255,0.80)',   // 激活标签文字 (text-white/80)
  topbar_tab_inactive: 'rgba(255,255,255,0.55)', // 未激活标签文字 (text-white/55)
  topbar_more_icon: 'rgba(255,255,255,0.70)',    // 更多按钮图标色 (text-white/70)

  // [heading] 方向/角度标题

  // [dial] 罗盘圆盘指针 (CompassDial)
  pointer_fill: 'rgba(255,255,255,0.95)', // 固定三角形指针颜色

  // [level_dial] 水平仪圆盘 (LevelDial)
  level_outer_ring: 'rgba(255,255,255,0.35)',   // 外圈描边
  level_line: 'rgba(255,255,255,0.90)',          // 水平基准线
  level_center_dot: 'rgba(0,0,0,1.0)',           // 中心内圆（填充黑）
  level_center_ring_white: 'rgba(255,255,255,0.85)', // 中心白色描边圈
  level_center_ring_red: 'rgba(255,59,48,0.90)', // 中心红色外圈（iOS 风格）

  // [latlon] 经纬度显示栏 (LatLonBar)

  // [popover] 更多菜单弹出框 (MoreMenuPopover)
  popover_shadow: 'rgba(0,0,0,0.35)',             // 弹出框阴影 (shadow-[0_12px_30px_rgba(0,0,0,0.35)])
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
