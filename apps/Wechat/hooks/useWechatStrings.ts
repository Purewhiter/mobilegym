/**
 * useWechatStrings — 微信专用 i18n hook
 * 
 * 简化用法，只需一行：
 *   import { useWechatStrings } from '../hooks/useWechatStrings';
 *   const t = useWechatStrings();
 *   <span>{t.settings_title}</span>
 */

import { useAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function useWechatStrings() {
  return useAppStrings(strings, stringsEn);
}

export type WechatStringKey = keyof typeof strings;
