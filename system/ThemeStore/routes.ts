import { defineRoutes } from '../../os/navigation/routes';

/** ThemeStore's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/' },
  item: { path: '/item/:kind/:id' },
});
