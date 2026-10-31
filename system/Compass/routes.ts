import { defineRoutes } from '../../os/navigation/routes';

/** Compass's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', search: { 'menu': ['true'] } },
  level: { path: '/level', search: { 'menu': ['true'] } },
  permissions: { path: '/permissions' },
  privacy: { path: '/privacy' },
});
