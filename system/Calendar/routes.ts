import { defineRoutes } from '../../os/navigation/routes';

/** Calendar's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/' },
  settings: { path: '/settings' },
  newEvent: { path: '/new-event' },
  event: { path: '/event/:eventId' },
  eventEdit: { path: '/event/:eventId/edit' },
  search: { path: '/search' },
  dateJump: { path: '/date-jump' },
  dateCalculate: { path: '/date-calculate' },
  subscription: { path: '/subscription' },
  deskTheme: { path: '/desk-theme' },
});
