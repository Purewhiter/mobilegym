import { defineRoutes } from '../../os/navigation/routes';

/** Sms's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/' },
  new: { path: '/new' },
  conversation: { path: '/conversation/:conversationId' },
  settings: { path: '/settings' },
  settingsFreeNetworkSms: { path: '/settings/free-network-sms' },
  settingsAdvanced: { path: '/settings/advanced' },
  settings5gMessage: { path: '/settings/5g-message' },
  settingsPlaceholder: { path: '/settings/*' },
});
