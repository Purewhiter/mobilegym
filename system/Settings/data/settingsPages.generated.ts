/**
 * ⚠️ 注意：历史上此文件包含 700KB+ 的 Settings 页面大对象（会显著拖慢 Vite dev server）。
 *
 * 现已迁移为：
 * - `system/Settings/data/pages.json`（数据）
 * - `system/Settings/data/loader.ts`（new URL + fetch 异步加载 + 缓存）
 *
 * 业务侧请优先使用 `SettingsPagesDataProvider` / `useSettingsPagesData`。
 */
export { loadPages, getPagesSync, clearPagesCache } from './loader';
export type { SettingsPagesData } from './loader';

