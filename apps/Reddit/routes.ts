import { defineRoutes } from '../../os/navigation/routes';

/** Reddit's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', search: { 'menu': ['drawer', 'home'], 'sheet': ['postMore'] } },
  search: { path: '/search' },
  communities: { path: '/communities', search: { 'menu': ['drawer'] } },
  create: { path: '/create', search: { 'sheet': ['tags'] } },
  createCommunity: { path: '/create/community' },
  chat: { path: '/chat', search: { 'menu': ['drawer'], 'tab': ['messages', 'threads', 'requests', 'unread'] } },
  chatNew: { path: '/chat/new' },
  chatByUsername: { path: '/chat/:username', search: { 'sheet': ['messageMenu', 'deleteMessage'] } },
  chatThread: { path: '/chat/:username/thread/:messageId' },
  inbox: { path: '/inbox', search: { 'menu': ['drawer'], 'tab': ['notifications', 'messages'] } },
  me: { path: '/me', search: { 'tab': ['posts', 'comments', 'about'], 'sheet': ['account', 'postMore', 'deletePost'] } },
  meEdit: { path: '/me/edit' },
  meSettings: { path: '/me/settings', search: { 'sheet': ['openLinks'] } },
  user: { path: '/user/:username', search: { 'tab': ['posts', 'comments', 'about'] } },
  post: { path: '/post/:postId', search: { 'sheet': ['commentMore', 'deleteConfirm'] } },
  postReply: { path: '/post/:postId/reply/:commentId' },
  postEdit: { path: '/post/:postId/edit/:commentId' },
});
