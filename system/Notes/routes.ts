import { defineRoutes } from '../../os/navigation/routes';

/** Notes's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/' },
  todo: { path: '/todo' },
  folders: { path: '/folders' },
  settings: { path: '/settings' },
  trash: { path: '/trash' },
  private: { path: '/private' },
  note: { path: '/note/:id' },
});
