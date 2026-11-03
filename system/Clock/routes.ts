import { defineRoutes } from '../../os/navigation/routes';

/** Clock's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', description: '时钟根路由' },
  alarm: {
    path: '/alarm',
    search: { sheet: ['edit', 'editor', 'repeat'], mode: ['select'] },
    description: '闹钟页',
    states: { 'sheet=edit': '快速编辑闹钟', 'sheet=editor': '闹钟设置', 'sheet=repeat': '重复方式', 'mode=select': '多选闹钟' },
  },
  world: {
    path: '/world',
    search: { sheet: ['city'], mode: ['select'] },
    description: '世界时钟页',
    states: { 'sheet=city': '选择城市', 'mode=select': '多选城市' },
  },
  stopwatch: { path: '/stopwatch', description: '秒表页' },
  timer: { path: '/timer', description: '计时器页' },
});
