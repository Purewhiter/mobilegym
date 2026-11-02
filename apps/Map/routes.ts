import { defineRoutes } from '../../os/navigation/routes';

/** Map's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', description: '探索首页-地图视图' },
  me: { path: '/me', description: '我-个人页（列表/保存）' },
  contribute: { path: '/contribute', description: '贡献首页' },
  search: { path: '/search', description: '搜索页-历史记录' },
  profile: { path: '/profile', description: '个人资料菜单' },
  settings: { path: '/settings', description: '设置主页' },
  settingsAppDisplay: { path: '/settings/app-display', description: '应用和显示设置' },
  settingsAppDisplayLanguage: { path: '/settings/app-display/language', description: '应用语言' },
  settingsNav: { path: '/settings/nav', description: '导航设置' },
  settingsGettingAround: { path: '/settings/getting-around', description: '出行设置' },
  settingsLocationPrivacy: { path: '/settings/location-privacy', description: '位置信息和隐私' },
  settingsOfflineMaps: { path: '/settings/offline-maps', description: '离线地图设置' },
  settingsNotifications: { path: '/settings/notifications', description: '通知设置' },
  settingsNotificationsTraffic: { path: '/settings/notifications/traffic', description: '交通信息通知' },
  settingsNotificationsTrafficBySubId: { path: '/settings/notifications/traffic/:subId', description: '交通信息子页' },
  settingsNotificationsRecommendations: { path: '/settings/notifications/recommendations', description: '个性化推荐通知' },
  settingsNotificationsRecommendationsBySubId: { path: '/settings/notifications/recommendations/:subId', description: '推荐子页' },
});
