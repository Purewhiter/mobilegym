import { defineRoutes } from '../../os/navigation/routes';

/** Gallery's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/' },
  favorites: { path: '/favorites' },
  album: { path: '/album/:albumId' },
  photo: { path: '/photo/:path', search: { 'modal': ['details', 'more', 'rename'] } },
  intentView: { path: '/intent/view', search: { 'modal': ['details', 'more', 'rename'] } },
});
