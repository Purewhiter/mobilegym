import { useMemo } from 'react';
import { strings, type StringKey } from './strings';
import { stringsEn } from './strings.en';
import { useAppStrings } from '@/os/useAppStrings';

/**
 * Settings 专用 hook —— 同时提供：
 *   s: named-key 字符串（用于静态引用 s.key）
 *   t: 动态翻译函数（用于 JSON 数据驱动的中文→英文查找）
 */
export function useSettingsStrings() {
  const s = useAppStrings(strings, stringsEn);

  const t = useMemo(() => {
    const map = new Map<string, string>();
    for (const key of Object.keys(strings) as StringKey[]) {
      map.set(strings[key], s[key]);
    }
    return (zh: string) => map.get(zh) ?? zh;
  }, [s]);

  return { s, t };
}
