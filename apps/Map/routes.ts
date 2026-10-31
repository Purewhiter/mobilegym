import { defineRoutes } from '../../os/navigation/routes';

/** Map's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', search: { 'category': ['string'] } },
  me: { path: '/me' },
  contribute: { path: '/contribute' },
  search: { path: '/search' },
  profile: { path: '/profile' },
  settings: { path: '/settings' },
  settingsAppDisplay: { path: '/settings/app-display' },
  settingsAppDisplayLanguage: { path: '/settings/app-display/language' },
  settingsNav: { path: '/settings/nav' },
  settingsGettingAround: { path: '/settings/getting-around' },
  settingsLocationPrivacy: { path: '/settings/location-privacy' },
  settingsOfflineMaps: { path: '/settings/offline-maps' },
  settingsNotifications: { path: '/settings/notifications' },
  settingsNotificationsTraffic: { path: '/settings/notifications/traffic' },
  settingsNotificationsTrafficBySubId: { path: '/settings/notifications/traffic/:subId' },
  settingsNotificationsRecommendations: { path: '/settings/notifications/recommendations' },
  settingsNotificationsRecommendationsBySubId: { path: '/settings/notifications/recommendations/:subId' },
});
