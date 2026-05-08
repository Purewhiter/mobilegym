import { resolveAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useLocale } from '../locale';

export function useMapStrings() {
  const locale = useLocale();
  return resolveAppStrings(strings, stringsEn, locale);
}
