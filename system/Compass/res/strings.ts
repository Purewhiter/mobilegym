/**
 * Compass 字符串资源 — 对应 AOSP res/values/strings.xml
 */
export const strings = {
  app_name: '指南针',

  // --- Top bar tabs ---
  tab_compass: '指南针',
  tab_level: '水平仪',

  // --- Compass directions (from constants.ts getDirectionText) ---
  direction_north: '北',
  direction_northeast: '东北',
  direction_east: '东',
  direction_southeast: '东南',
  direction_south: '南',
  direction_southwest: '西南',
  direction_west: '西',
  direction_northwest: '西北',

  // --- Latitude / longitude labels (from constants.ts formatLatLon) ---
  lat_north: '北纬',
  lat_south: '南纬',
  lon_east: '东经',
  lon_west: '西经',

  // --- More menu ---
  menu_more: '更多',
  menu_close: '关闭菜单',
  menu_view_privacy_policy: '查看隐私政策',
  menu_permissions: '权限说明',

  // --- Permissions page ---
  permission_title: '权限说明',
  permission_location_title: '获取设备定位',
  permission_location_desc: '用于提供经纬度等服务',
  permission_camera_title: '打开相机',
  permission_camera_desc: '用于打开指南针实景模式',
  permission_status_allowed: '已允许',

  // --- Privacy page ---
  privacy_back: '返回',
  privacy_new_tab: '新标签页',

  // --- Common ---
  back: '返回',
} as const;

export type StringKey = keyof typeof strings;
