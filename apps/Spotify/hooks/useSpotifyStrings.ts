import { useAppStrings } from '@/os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export function useSpotifyStrings() {
  return useAppStrings(strings, stringsEn);
}

export type SpotifyStringKey = keyof typeof strings;
