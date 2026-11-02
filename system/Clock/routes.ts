import { defineRoutes } from '../../os/navigation/routes';

/** Clock's pages and the UI states each keeps in its URL. */
export const routes = defineRoutes({
  home: { path: '/', description: '时钟根路由' },
  alarm: { path: '/alarm', description: '闹钟页' },
  world: { path: '/world', description: '世界时钟页' },
  stopwatch: { path: '/stopwatch', description: '秒表页' },
  timer: { path: '/timer', description: '计时器页' },
});
