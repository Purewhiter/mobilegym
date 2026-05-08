// Tier-2 component-level colors (Tier-1 semantic colors are in manifest.ts theme.colors)
// Naming: <area>_<purpose> matching AOSP colors.xml convention
export const colors = {
  // [map] 地图覆盖物

  // [marker] 地图标记

  // [route_ui] 路线/导航 UI

  // [transport_mode] 交通方式按钮

  // [rating] 评分

  // [action_button] 地图 FAB / 操作按钮
  fab_shadow: 'rgba(0,0,0,0.30)',          // FAB 阴影 (drop-shadow)

  // [login] Google 登录区域

  // [settings_panel] 设置/通知面板

  // [overlay] 搜索框顶部渐变遮罩
  search_overlay_from: 'rgba(255,255,255,0.90)', // from-white/90
  search_overlay_to: 'rgba(255,255,255,0.00)',   // to-transparent

  // [loading] 加载状态
  loading_spinner_track: 'rgba(59,130,246,0.20)', // blue-500/20

  // [me_page] 我的页面 (MePage)
} as const;

export const colorsDark: Partial<typeof colors> = {} as const;
