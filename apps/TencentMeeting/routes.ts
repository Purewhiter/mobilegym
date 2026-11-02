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
  scheduleRegular: {
    path: '/schedule/regular',
    search: {
      picker: ['startTime', 'duration', 'endTime', 'timezone', 'repeat', 'customRepeat', 'endRepeat', 'invitees'],
      sub: ['date', 'count'],
    },
    description: '常规会议预定',
    states: {
      'picker=startTime': '开始时间选择', 'picker=duration': '时长选择', 'picker=endTime': '结束时间选择',
      'picker=timezone': '时区选择', 'picker=repeat': '重复频率选择', 'picker=customRepeat': '自定义重复',
      'picker=endRepeat': '结束重复', 'picker=invitees': '选择参会人',
      'picker=endRepeat&sub=date': '结束重复 - 日期', 'picker=endRepeat&sub=count': '结束重复 - 次数',
    },
  },
  share: { path: '/share', description: '共享屏幕' },
  meeting: {
    path: '/meeting',
    search: { dialog: ['chat', 'exit', 'rename'], panel: ['more', 'members'], sheet: ['member'] },
    description: '会议进行中',
    states: {
      'dialog=chat': '会议聊天弹窗', 'dialog=exit': '退出会议弹窗', 'dialog=rename': '改名弹窗',
      'panel=more': '更多菜单', 'panel=members': '管理成员', 'sheet=member': '成员资料卡',
      'panel=members&sheet=member': '管理成员 - 成员资料卡', 'dialog=rename&panel=members': '管理成员 - 改名弹窗',
    },
  },
  meetingDetail: {
    path: '/meeting/detail',
    search: { dialog: ['actions'] },
    description: '会议详情',
    states: { 'dialog=actions': '会议操作菜单' },
  },
  meetingEdit: {
    path: '/meeting/edit',
    search: { picker: ['startTime', 'duration', 'endTime', 'timezone', 'repeat', 'invitees'] },
    description: '修改会议预定',
    states: {
      'picker=startTime': '开始时间选择', 'picker=duration': '时长选择', 'picker=endTime': '结束时间选择',
      'picker=timezone': '时区选择', 'picker=repeat': '重复频率选择', 'picker=invitees': '选择参会人',
    },
  },
  history: { path: '/history', description: '历史会议' },
  historyDetail: { path: '/history/:meetingId', description: '历史会议详情' },
  attendees: { path: '/attendees/:id', description: '参会人员列表' },
});
