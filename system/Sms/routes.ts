import { defineRoutes } from '../../os/navigation/routes';

/** Sms's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', description: '会话列表页' },
  new: { path: '/new', description: '新建短信页' },
  conversation: { path: '/conversation/:conversationId', description: '短信会话详情页' },
  settings: { path: '/settings', description: '短信设置页' },
  settingsFreeNetworkSms: { path: '/settings/free-network-sms', description: '免费网络短信设置页' },
  settingsAdvanced: { path: '/settings/advanced', description: '高级设置页' },
  settings5gMessage: { path: '/settings/5g-message', description: '5G消息设置页' },
  settingsPlaceholder: { path: '/settings/*', description: '设置占位页' },
});
