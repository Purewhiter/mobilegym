import { defineRoutes } from '../../os/navigation/routes';

/** Clock's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/' },
  alarm: { path: '/alarm' },
  world: { path: '/world' },
  stopwatch: { path: '/stopwatch' },
  timer: { path: '/timer' },
});
