/**
 * Browser 字符串资源 — 对应 AOSP res/values/strings.xml
 */
export const strings = {
  app_name: '浏览器',

  // ── BrowserHome ──
  search_or_enter_url: '搜索或输入网址',

  // ── TabsOverlay ──
  tabs: '标签页',
  new_tab: '新标签页',

  // ── BrowserContent ──
  home_page: '主页',
} as const;

export type StringKey = keyof typeof strings;
