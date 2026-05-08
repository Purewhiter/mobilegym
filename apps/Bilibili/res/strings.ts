/**
 * Bilibili 字符串资源 — 对应 AOSP res/values/strings.xml
 */
export const strings = {
  // Home tabs
  tab_live: '直播',
  tab_recommended: '推荐',
  tab_hot: '热门',
  tab_anime: '动画',
  tab_film_tv: '影视',
  tab_new_year: '跨年',

  // Shop items
  shop_figure: '手办雕像',
  shop_blind_box: '盲盒',
  shop_event_show: '漫展演出',
  shop_all_categories: '分类',
} as const;

export type StringKey = keyof typeof strings;
