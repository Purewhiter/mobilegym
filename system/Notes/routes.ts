import { defineRoutes } from '../../os/navigation/routes';

/** Notes's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', description: '便签列表页' },
  todo: { path: '/todo', description: '待办页' },
  folders: {
    path: '/folders',
    search: { dialog: ['add', 'rename', 'delete'] },
    description: '文件夹页',
    states: { 'dialog=add': '新建文件夹', 'dialog=rename': '重命名文件夹', 'dialog=delete': '删除文件夹确认' },
  },
  settings: { path: '/settings', description: '设置页' },
  trash: {
    path: '/trash',
    search: { sheet: ['actions'], dialog: ['deleteForever', 'restoreAll'] },
    description: '回收站页',
    states: { 'sheet=actions': '笔记操作菜单', 'dialog=deleteForever': '永久删除确认', 'dialog=restoreAll': '全部恢复确认' },
  },
  private: { path: '/private', description: '私密便签页' },
  note: {
    path: '/note/:id',
    search: { sheet: ['more', 'folder', 'reminder'], dialog: ['deleteForever'] },
    description: '编辑页',
    states: {
      'sheet=more': '更多菜单', 'sheet=folder': '选择文件夹', 'sheet=reminder': '设置提醒',
      'dialog=deleteForever': '永久删除确认',
    },
  },
});
