import defaults from './defaults.json';
import type { CompassConfig } from '../types';

// data/index.ts 是唯一 TS 入口：导出兼容的 *_CONFIG，供运行时与静态分析使用
export const COMPASS_CONFIG = defaults as CompassConfig;

// 便于外部直接从 `system/Compass/data` 访问常用工具/类型（减少迁移改动）
export { getDirectionText, formatDMS, formatLatLon } from '../constants';
export type { CompassState, CompassConfig } from '../types';

