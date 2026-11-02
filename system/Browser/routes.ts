import { defineRoutes } from '../../os/navigation/routes';

/** Browser's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', search: { panel: ['tabs'] }, description: '浏览器首页', states: { 'panel=tabs': '标签页列表' } },
  view: { path: '/view', search: { panel: ['tabs'] }, description: '网页浏览页', states: { 'panel=tabs': '标签页列表' } },
});
