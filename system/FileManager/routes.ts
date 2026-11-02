import { defineRoutes } from '../../os/navigation/routes';

/** FileManager's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', search: { 'modal': ['delete', 'details', 'more', 'rename', 'transfer'], 'mode': ['select'], 'transferDialog': ['newFolder'] }, description: '浏览主页', states: { 'modal=details': '浏览主页 - 详情弹窗', 'modal=rename': '浏览主页 - 重命名弹窗', 'mode=select': '浏览主页 - 选择模式', 'mode=select&modal=delete': '浏览主页 - 选择模式 - 删除确认', 'mode=select&modal=more': '浏览主页 - 选择模式 - 更多菜单', 'mode=select&modal=transfer': '浏览主页 - 选择模式 - 复制/移动目标选择', 'mode=select&modal=transfer&transferDialog=newFolder': '浏览主页 - 选择模式 - 复制/移动目标选择 - 新建文件夹' } },
  recent: { path: '/recent', search: { 'modal': ['delete', 'details', 'more', 'rename', 'transfer'], 'mode': ['select'], 'transferDialog': ['newFolder'] }, description: '最近文件', states: { 'modal=details': '最近文件 - 详情弹窗', 'modal=rename': '最近文件 - 重命名弹窗', 'mode=select': '最近文件 - 选择模式', 'mode=select&modal=delete': '最近文件 - 选择模式 - 删除确认', 'mode=select&modal=more': '最近文件 - 选择模式 - 更多菜单', 'mode=select&modal=transfer': '最近文件 - 选择模式 - 复制/移动目标选择', 'mode=select&modal=transfer&transferDialog=newFolder': '最近文件 - 选择模式 - 复制/移动目标选择 - 新建文件夹' } },
  cloud: { path: '/cloud', description: '云盘' },
  folder: { path: '/folder', search: { 'modal': ['delete', 'details', 'more', 'newFolder', 'rename', 'transfer'], 'mode': ['select'], 'transferDialog': ['newFolder'] }, description: '文件夹浏览', states: { 'modal=details': '文件夹浏览 - 详情弹窗', 'modal=rename': '文件夹浏览 - 重命名弹窗', 'modal=newFolder': '文件夹浏览 - 新建文件夹', 'mode=select': '文件夹浏览 - 选择模式', 'mode=select&modal=delete': '文件夹浏览 - 选择模式 - 删除确认', 'mode=select&modal=more': '文件夹浏览 - 选择模式 - 更多菜单', 'mode=select&modal=transfer': '文件夹浏览 - 选择模式 - 复制/移动目标选择', 'mode=select&modal=transfer&transferDialog=newFolder': '文件夹浏览 - 选择模式 - 复制/移动目标选择 - 新建文件夹' } },
  text: { path: '/text', description: '文本文件预览' },
  pdf: { path: '/pdf', description: 'PDF 文件预览' },
  category: { path: '/category/:category', description: '分类文件' },
});
