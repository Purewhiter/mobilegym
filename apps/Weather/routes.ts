import { defineRoutes } from '../../os/navigation/routes';

/** Weather's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', search: { 'menu': ['more'] } },
  settings: { path: '/settings', search: { 'picker': ['pressure', 'temp', 'wind'] } },
  settingsPrivacy: { path: '/settings/privacy' },
  settingsPermissions: { path: '/settings/permissions' },
  cities: { path: '/cities' },
  citiesSearch: { path: '/cities/search' },
  citiesPreview: { path: '/cities/preview' },
  forecastDaily: { path: '/forecast/daily' },
  airquality: { path: '/airquality' },
});
