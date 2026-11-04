import { defineRoutes } from '../../os/navigation/routes';

/** Gallery's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', search: { 'mode': ['select'], 'dialog': ['delete'] }, description: '相册首页', states: { 'mode=select': '多选模式', 'mode=select&dialog=delete': '批量删除确认' } },
  albums: { path: '/albums', description: '相册首页 - 相册列表' },
  favorites: { path: '/favorites', description: '收藏页' },
  album: { path: '/album/:albumId', search: { 'mode': ['select'] }, description: '相册详情页', states: { 'mode=select': '多选模式' } },
  photo: { path: '/photo/:path', search: { 'modal': ['details', 'more', 'rename', 'delete'] }, description: '图片预览页', states: { 'modal=more': '图片预览页 - 更多菜单弹窗', 'modal=details': '图片预览页 - 详情弹窗', 'modal=rename': '图片预览页 - 重命名弹窗', 'modal=delete': '图片预览页 - 删除确认' } },
  intentView: { path: '/intent/view', search: { 'modal': ['details', 'more', 'rename', 'delete'] }, description: '通过 ACTION_VIEW 打开的图片预览页', states: { 'modal=more': 'ACTION_VIEW 图片预览 - 更多菜单', 'modal=details': 'ACTION_VIEW 图片预览 - 详情弹窗', 'modal=rename': 'ACTION_VIEW 图片预览 - 重命名弹窗', 'modal=delete': 'ACTION_VIEW 图片预览 - 删除确认' } },
});
