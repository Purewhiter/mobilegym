import { defineRoutes } from '../../os/navigation/routes';

/** Sms's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: {
    path: '/',
    search: { menu: ['context'] },
    description: '会话列表页',
    states: { 'menu=context': '会话长按菜单' },
  },
  new: {
    path: '/new',
    search: { dialog: ['invalidRecipient'], panel: ['attachments'] },
    description: '新建短信页',
    states: { 'dialog=invalidRecipient': '收件人无效提示', 'panel=attachments': '附件面板' },
  },
  conversation: {
    path: '/conversation/:conversationId',
    search: { panel: ['attachments'] },
    description: '短信会话详情页',
    states: { 'panel=attachments': '附件面板' },
  },
  settings: { path: '/settings', description: '短信设置页' },
  settingsFreeNetworkSms: { path: '/settings/free-network-sms', description: '免费网络短信设置页' },
  settingsAdvanced: { path: '/settings/advanced', description: '高级设置页' },
  settings5gMessage: { path: '/settings/5g-message', description: '5G消息设置页' },
  settingsPlaceholder: { path: '/settings/*', description: '设置占位页' },
});
