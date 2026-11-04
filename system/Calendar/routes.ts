import { defineRoutes } from '../../os/navigation/routes';

export interface CalendarEventRouteState {
  searchResultIds: readonly string[];
}

/** Calendar's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', search: { 'menu': ['more'] }, description: '日历首页', states: { 'menu=more': '更多菜单' } },
  settings: {
    path: '/settings',
    search: { sheet: ['reminder', 'allDayReminder', 'laterReminder'] },
    description: '日历设置页',
    states: { 'sheet=reminder': '默认提醒', 'sheet=allDayReminder': '全天日程默认提醒', 'sheet=laterReminder': '稍后提醒' },
  },
  newEvent: { path: '/new-event', search: { sheet: ['reminder'] }, description: '新建日程页', states: { 'sheet=reminder': '提醒时间选择' } },
  event: { path: '/event/:eventId', search: { 'deleteConfirm': ['open'] }, description: '日程详情页', states: { 'deleteConfirm=open': '删除日程确认弹窗' } },
  eventEdit: { path: '/event/:eventId/edit', search: { sheet: ['reminder'] }, description: '编辑日程页', states: { 'sheet=reminder': '提醒时间选择' } },
  search: { path: '/search', description: '搜索页' },
  dateJump: { path: '/date-jump', description: '日期跳转页' },
  dateCalculate: { path: '/date-calculate', description: '日期计算页' },
  subscription: { path: '/subscription', description: '订阅管理页' },
  deskTheme: { path: '/desk-theme', description: '桌面组件主题页' },
});
