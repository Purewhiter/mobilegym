import { strings } from './res/strings';

export const BILIBILI_CONSTANTS = {
  homeTabs: [
    strings.tab_live,
    strings.tab_recommended,
    strings.tab_hot,
    strings.tab_anime,
    strings.tab_film_tv,
    strings.tab_new_year,
  ],
  recommendedUp: [
    {
      id: '800000064982',
      name: '_拾光记录者_',
    },
    {
      id: '800000001054',
      name: '流光视界',
    },
  ],
  shopItems: [
    { title: strings.shop_figure, icon: '🎨' },
    { title: strings.shop_blind_box, icon: '🎁' },
    { title: strings.shop_event_show, icon: '🎫' },
    { title: strings.shop_all_categories, icon: 'all' },
  ],
} as const;
