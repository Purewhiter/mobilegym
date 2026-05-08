/**
 * OS 级 i18n 工具
 *
 * 提供 useOsT() Hook 和 osT() 函数用于翻译系统级 UI 字符串。
 */

import { useLocale, type Locale, getLocale } from '../locale';
import { OS_EN } from './en';

/**
 * React Hook: 返回 OS 级翻译函数。
 * 用法: const t = useOsT(); t('设置') → 'Settings'
 */
export function useOsT(): (zh: string) => string {
  const locale = useLocale();
  if (locale === 'zh-Hans') return (zh: string) => zh;
  return (zh: string) => OS_EN[zh] ?? zh;
}

/**
 * 非 Hook 版本：用于非组件上下文（如工具函数）。
 * 每次调用时读取当前 locale。
 */
export function osT(zh: string): string {
  const locale = getLocale();
  if (locale === 'zh-Hans') return zh;
  return OS_EN[zh] ?? zh;
}

/**
 * 获取 App 的本地化名称（非 Hook 版本）。
 * 传入 APP_REGISTRY 中的中文 name，返回当前 locale 对应的名称。
 */
export function localizedAppName(chineseName: string): string {
  return osT(chineseName);
}
