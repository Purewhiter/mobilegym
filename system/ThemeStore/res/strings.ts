/**
 * ThemeStore 字符串资源 — 对应 AOSP res/values/strings.xml
 */
export const strings = {
  app_name: '主题商店',

  // ── ThemeStoreHomePage ──
  refresh: '刷新',
  tab_themes: '主题',
  tab_fonts: '字体',
  tab_aod: '息屏',
  loading: '加载中...',
  load_failed: '加载失败：',
  no_resources_found: '未发现资源。',
  enabled: '已启用',
  unknown_author: '未知作者',
  pill_icons: '图标',
  pill_wallpaper: '壁纸',
  pill_statusbar: '状态栏',
  pill_control_center: '控制中心',

  // ── StoreItemDetailPage ──
  theme_detail: '主题详情',
  apply: '应用',
  applying: '应用中...',
  apply_full_theme: '应用整套主题',
  mix_and_match: '混搭',
  apply_icons_only: '只应用图标',
  apply_wallpaper_only: '只应用壁纸',
  no_available_wallpaper: '该主题没有可用壁纸',
  sim_font_not_supported: '当前模拟暂不支持应用字体，仅展示预览与信息。',
  sim_aod_not_supported: '当前模拟暂不支持应用息屏，仅展示预览与信息。',
  operation_failed: '操作失败：',
  resource_not_found: '未找到资源：',
} as const;

export type StringKey = keyof typeof strings;
