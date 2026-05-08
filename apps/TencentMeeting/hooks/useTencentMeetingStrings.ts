/**
 * useTencentMeetingStrings — TencentMeeting 专用 i18n hook
 * 
 * 简化用法：
 *   import { useTencentMeetingStrings } from '../hooks/useTencentMeetingStrings';
 *   const t = useTencentMeetingStrings();
 *   <span>{t.some_key}</span>
 */

import { useAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function useTencentMeetingStrings() {
  return useAppStrings(strings, stringsEn);
}

export type TencentMeetingStringKey = keyof typeof strings;
