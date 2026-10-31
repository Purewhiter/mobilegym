import { defineRoutes } from '../../os/navigation/routes';

/** Browser's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/' },
  view: { path: '/view' },
});
