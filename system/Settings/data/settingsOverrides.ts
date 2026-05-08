/**
 * 手写的 Settings 页面补丁（用于模拟真机上动态构建的页面）。
 *
 * 为避免大 TS 文件拖慢 Vite，这里只做 TS 类型封装，实际数据在 `overrides.json`。
 */
import type { SettingsPage } from '../types';
import overrides from './overrides.json';

export const SETTINGS_PAGE_OVERRIDES = overrides as Record<string, SettingsPage>;

