import { defineRoutes } from '../../os/navigation/routes';

/** Settings's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/' },
  search: { path: '/search' },
  page: { path: '/page/:pageId' },
});
