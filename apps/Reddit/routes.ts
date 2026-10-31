import { defineRoutes } from '../../os/navigation/routes';

/** Reddit's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', search: { 'menu': ['drawer', 'home'] } },
  search: { path: '/search' },
  communities: { path: '/communities', search: { 'menu': ['drawer'] } },
  create: { path: '/create' },
  createCommunity: { path: '/create/community' },
  chat: { path: '/chat', search: { 'menu': ['drawer'] } },
  chatNew: { path: '/chat/new' },
  chatByUsername: { path: '/chat/:username' },
  chatThread: { path: '/chat/:username/thread/:messageId' },
  inbox: { path: '/inbox', search: { 'menu': ['drawer'] } },
  me: { path: '/me' },
  meEdit: { path: '/me/edit' },
  meSettings: { path: '/me/settings' },
  user: { path: '/user/:username' },
  post: { path: '/post/:postId' },
  postReply: { path: '/post/:postId/reply/:commentId' },
  postEdit: { path: '/post/:postId/edit/:commentId' },
});
