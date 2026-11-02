import { defineRoutes } from '../../os/navigation/routes';

/** Compass's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', search: { 'menu': ['true'] }, description: '指南针-主界面', states: { 'menu=true': '指南针-更多菜单' } },
  level: { path: '/level', search: { 'menu': ['true'] }, description: '水平仪-主界面', states: { 'menu=true': '水平仪-更多菜单' } },
  permissions: { path: '/permissions', description: '权限说明页' },
  privacy: { path: '/privacy', description: '隐私政策（内置页/占位）' },
});
