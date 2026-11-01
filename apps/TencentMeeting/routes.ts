import { defineRoutes } from '../../os/navigation/routes';

/** Tencent Meeting's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', description: '会议主页' },
  contacts: { path: '/contacts', description: '通讯录' },
  me: { path: '/me', description: '我的' },
  messages: {
    path: '/messages',
    search: { tab: ['todo', 'all'], sub: ['system', 'welfare'] },
    description: '消息中心',
    states: {
      'tab=todo': '待办消息',
      'tab=all': '全部消息-全部',
      'tab=all&sub=system': '全部消息-系统通知',
      'tab=all&sub=welfare': '全部消息-福利通知',
    },
  },
  profile: { path: '/profile', description: '个人资料页' },
  personalRoom: { path: '/personal-room', description: '个人会议室' },
  accountSecurity: {
    path: '/account-security',
    search: { dialog: ['delete-account'] },
    description: '账号与安全',
    states: { 'dialog=delete-account': '注销账号弹窗' },
  },
  settings: { path: '/settings', description: '设置' },
  join: { path: '/join', description: '加入会议' },
  quick: { path: '/quick', description: '快速会议' },
  schedule: { path: '/schedule', description: '预定会议' },
  scheduleRegular: { path: '/schedule/regular', description: '常规会议预定' },
  share: { path: '/share', description: '共享屏幕' },
  meeting: {
    path: '/meeting',
    search: { dialog: ['chat', 'exit'] },
    description: '会议进行中',
    states: { 'dialog=chat': '会议聊天弹窗', 'dialog=exit': '退出会议弹窗' },
  },
  meetingDetail: {
    path: '/meeting/detail',
    search: { dialog: ['actions'] },
    description: '会议详情',
    states: { 'dialog=actions': '会议操作菜单' },
  },
  meetingEdit: { path: '/meeting/edit', description: '修改会议预定' },
  history: { path: '/history', description: '历史会议' },
  historyDetail: { path: '/history/:meetingId', description: '历史会议详情' },
  attendees: { path: '/attendees/:id', description: '参会人员列表' },
});
