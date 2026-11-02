import { defineRoutes } from '../../os/navigation/routes';

/** Browser's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', description: '浏览器首页' },
  view: { path: '/view', description: '网页浏览页' },
});
