// All app-level dimensions (matching AOSP dimens.xml)
export const dimens = {
  // [status_bar] 顶部状态栏

  // [topbar] 顶部标签栏 (CompassTopBar)
  // COMPASS_TOP_BAR_HEIGHT = statusBarHeight + 55
  topbar_title_row_height: 55,      // 标签行高度 (h-[55px])

  // [heading] 方向/角度标题区域

  // [dial] 罗盘/水平仪圆盘

  // [level_dial] 水平仪圆盘 (LevelDial)

  // [latlon] 经纬度显示栏 (LatLonBar)

  // [popover] 更多菜单弹出框 (MoreMenuPopover)

  // [icon sizes]
  icSizeTab: 24,                     // px — tab bar icons
  icSizeNav: 20,                     // px — navigation / header icons
  icSizeAction: 18,                  // px — inline action icons
  icSizeService: 28,                 // px — service / POI icons
  icSizeToolbar: 22,                 // px — toolbar icons
} as const;
