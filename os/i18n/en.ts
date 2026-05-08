/**
 * OS 级英文翻译字典
 *
 * 使用 gettext 风格：中文原文作为 key，英文翻译作为 value。
 * 当 locale 为 'zh-Hans' 时直接返回 key，无需查表。
 *
 * App 名称翻译由各 App 的 manifest.displayNameEn 提供，
 * 通过 patchAppNames() 在 appRegistry 加载后注入。
 */

export const OS_EN: Record<string, string> = {
  // ── 系统 UI 字符串 ──────────────────────────────────────────────
  '加载中...': 'Loading...',
  '正在开发中...': 'Under Development...',
  '清除全部': 'Clear All',
  '打开': 'Open',
  '搜索': 'Search',
  '无最近任务': 'No Recent Tasks',
};

/** appRegistry 加载 manifest 后注入 App 名称翻译 */
export function patchAppNames(entries: Record<string, string>) {
  Object.assign(OS_EN, entries);
}
