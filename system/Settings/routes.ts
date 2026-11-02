import { defineRoutes } from '../../os/navigation/routes';

/** Settings's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', description: '设置首页' },
  search: { path: '/search', description: '设置搜索页' },
  page: { path: '/page/:pageId', description: '设置详情页' },
});
