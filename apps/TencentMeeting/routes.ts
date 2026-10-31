import { defineRoutes } from '../../os/navigation/routes';

/** Tencent Meeting's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/' },
  contacts: { path: '/contacts' },
  me: { path: '/me' },
  messages: { path: '/messages', search: { tab: ['todo', 'all'], sub: ['system', 'welfare'] } },
  profile: { path: '/profile' },
  personalRoom: { path: '/personal-room' },
  accountSecurity: { path: '/account-security', search: { dialog: ['delete-account'] } },
  settings: { path: '/settings' },
  join: { path: '/join' },
  quick: { path: '/quick' },
  schedule: { path: '/schedule' },
  scheduleRegular: { path: '/schedule/regular' },
  share: { path: '/share' },
  meeting: { path: '/meeting', search: { dialog: ['chat', 'exit'] } },
  meetingDetail: { path: '/meeting/detail', search: { dialog: ['actions'] } },
  meetingEdit: { path: '/meeting/edit' },
  history: { path: '/history' },
  historyDetail: { path: '/history/:meetingId' },
  attendees: { path: '/attendees/:id' },
});
