import { defineRoutes } from '../../os/navigation/routes';

/** ThemeStore's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: {
    path: '/',
    search: { tab: ['fonts', 'aod'] },
    description: '主题商店首页',
    states: { 'tab=fonts': '字体', 'tab=aod': '息屏' },
  },
  item: { path: '/item/:kind/:id', description: '主题详情页' },
});
