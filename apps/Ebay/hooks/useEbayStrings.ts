import { useAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function useEbayStrings() {
  return useAppStrings(strings, stringsEn);
}

export type EbayStringKey = keyof typeof strings;
