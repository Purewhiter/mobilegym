import { prefetchDeviceQuery } from '../../../os/device/deviceStore';
import { getJustNowLabel } from '../utils/formatTime';

/**
 * X data lives on the device server (apps/X/device); pages read assembled
 * views through `apps/X/data/view.ts`, never the whole catalog.
 */

/** OS `waitForData` 入口: 同步 store 与本页的 device session, 并预取首页时间线（页面挂载时数据已就绪）。 */
export async function preload(): Promise<void> {
  // 动态 import: state → loader 静态 import 会成环。
  const { useXStore } = await import('../state');
  await useXStore.ensureSynced();
  await prefetchDeviceQuery('x', 'homeTimelines', { justNow: getJustNowLabel() });
}
