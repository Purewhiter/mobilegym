import { defineRoutes } from '../../os/navigation/routes';

/** Contacts's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', search: { 'dialpad': ['true'] }, description: '通话-通话记录列表', states: { 'dialpad=true': '通话-拨号盘浮层' } },
  contacts: { path: '/contacts', search: { 'fav': ['true'] }, description: '联系人-列表', states: { 'fav=true': '联系人-收藏筛选' } },
  business: { path: '/business', description: '营业厅-首页' },
  search: { path: '/search', description: '联系人-搜索' },
  contact: { path: '/contact/:contactId', description: '联系人详情' },
  call: { path: '/call/:callLogId', description: '通话详情' },
  contactsNew: { path: '/contacts/new', description: '新建联系人（小米账号）' },
  settingsCalls: { path: '/settings/calls', description: '电话设置-通话' },
  settingsContacts: { path: '/settings/contacts', description: '电话设置-联系人' },
  settingsPage: { path: '/settings/page/:pageId', search: { dialog: ['list'] }, description: '电话设置-偏好页', states: { 'dialog=list': '选择设置值' } },
});
