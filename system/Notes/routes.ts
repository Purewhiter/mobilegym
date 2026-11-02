import { defineRoutes } from '../../os/navigation/routes';

/** Notes's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', description: '便签列表页' },
  todo: { path: '/todo', description: '待办页' },
  folders: { path: '/folders', description: '文件夹页' },
  settings: { path: '/settings', description: '设置页' },
  trash: { path: '/trash', description: '回收站页' },
  private: { path: '/private', description: '私密便签页' },
  note: {
    path: '/note/:id',
    search: { sheet: ['more', 'folder', 'reminder'] },
    description: '编辑页',
    states: { 'sheet=more': '更多菜单', 'sheet=folder': '选择文件夹', 'sheet=reminder': '设置提醒' },
  },
});
