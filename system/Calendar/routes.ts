import { defineRoutes } from '../../os/navigation/routes';

/** Calendar's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', search: { 'menu': ['more'] }, description: '日历首页', states: { 'menu=more': '更多菜单' } },
  settings: { path: '/settings', description: '日历设置页' },
  newEvent: { path: '/new-event', description: '新建日程页' },
  event: { path: '/event/:eventId', description: '日程详情页' },
  eventEdit: { path: '/event/:eventId/edit', description: '编辑日程页' },
  search: { path: '/search', description: '搜索页' },
  dateJump: { path: '/date-jump', description: '日期跳转页' },
  dateCalculate: { path: '/date-calculate', description: '日期计算页' },
  subscription: { path: '/subscription', description: '订阅管理页' },
  deskTheme: { path: '/desk-theme', description: '桌面组件主题页' },
});
