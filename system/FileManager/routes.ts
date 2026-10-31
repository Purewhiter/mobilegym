import { defineRoutes } from '../../os/navigation/routes';

/** FileManager's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', search: { 'modal': ['delete', 'details', 'more', 'rename', 'transfer'], 'mode': ['select'], 'transferDialog': ['newFolder'] } },
  recent: { path: '/recent', search: { 'modal': ['delete', 'details', 'more', 'rename', 'transfer'], 'mode': ['select'], 'transferDialog': ['newFolder'] } },
  cloud: { path: '/cloud' },
  folder: { path: '/folder', search: { 'modal': ['delete', 'details', 'more', 'newFolder', 'rename', 'transfer'], 'transferDialog': ['newFolder'] } },
  text: { path: '/text' },
  pdf: { path: '/pdf' },
  category: { path: '/category/:category' },
});
