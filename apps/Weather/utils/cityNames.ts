import type { SearchableCity, WeatherCityDefinition } from '../types';
import { strings } from '../res/strings';
import searchableCities from '../data/searchableCities.json';

function isEnglishStrings(s: typeof strings): boolean {
  return s.app_name !== strings.app_name;
}

function titleCaseWord(word: string): string {
  if (!word) return word;
  return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
}

function formatPinyinLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '--';
  return trimmed
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map(titleCaseWord)
    .join(' ');
}

function lookupDistrictPinyin(rawLocationName: string): string | null {
  const district = rawLocationName.split(' ')[0];
  const found = (searchableCities as SearchableCity[]).find(
    c => c.name === district || c.adm2 === district,
  );
  if (!found) return null;
  return found.pinyin || found.id;
}

export function getLocalizedWeatherCityName(
  city: Pick<WeatherCityDefinition, 'id' | 'name'>,
  s: typeof strings,
): string {
  if (!isEnglishStrings(s)) {
    return city.name;
  }
  return formatPinyinLabel(city.id);
}

export function getLocalizedLocationName(
  rawLocationName: string | undefined,
  s: typeof strings,
): string {
  if (!rawLocationName) {
    return s.city_manager_current_location;
  }

  if (!isEnglishStrings(s)) {
    return rawLocationName;
  }

  if (/^[A-Za-z0-9\s,./_-]+$/.test(rawLocationName)) {
    return rawLocationName;
  }

  const pinyin = lookupDistrictPinyin(rawLocationName);
  if (pinyin) return formatPinyinLabel(pinyin);

  return s.city_manager_current_location;
}

export function getWeatherCitySearchTerms(city: SearchableCity): string[] {
  const raw = [
    city.id,
    city.pinyin,
    city.name,
    city.adm1,
    city.adm2,
  ].filter((value): value is string => Boolean(value));

  // 生成带/不带"市"后缀的变体，使搜索 "广州市" 能匹配 "广州"，反之亦然
  const variants: string[] = [];
  for (const v of raw) {
    variants.push(v);
    if (v.endsWith('市')) {
      variants.push(v.slice(0, -1));
    } else if (v.length >= 2 && !v.endsWith('区') && !v.endsWith('县') && !v.endsWith('盟') && !/[a-z]$/i.test(v)) {
      variants.push(v + '市');
    }
  }

  return variants.map((value) => value.trim().toLowerCase());
}
