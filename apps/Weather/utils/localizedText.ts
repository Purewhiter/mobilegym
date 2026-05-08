import { strings } from '../res/strings';

function isEnglishStrings(s: typeof strings): boolean {
  return s.app_name !== strings.app_name;
}

export function getLocalizedWeatherText(text: string | undefined, s: typeof strings): string {
  const raw = String(text ?? '').trim();
  if (!raw) return '--';

  const normalized = raw.toLowerCase();

  if (/^[A-Za-z0-9\s\-_/]+$/.test(raw)) {
    if (normalized.includes('blizzard') || normalized.includes('storm snow')) return s.weather_storm_snow;
    if (normalized.includes('snow')) return normalized.includes('heavy') ? s.weather_heavy_snow : normalized.includes('moderate') ? s.weather_moderate_snow : s.weather_light_snow;
    if (normalized.includes('torrential') || normalized.includes('storm rain')) return s.weather_storm_rain;
    if (normalized.includes('rain')) return normalized.includes('heavy') ? s.weather_heavy_rain : normalized.includes('moderate') ? s.weather_moderate_rain : s.weather_light_rain;
    if (normalized.includes('fog')) return s.weather_fog;
    if (normalized.includes('haze')) return normalized.includes('heavy') ? s.weather_heavy_haze : normalized.includes('moderate') ? s.weather_moderate_haze : s.weather_light_haze;
    if (normalized.includes('dust')) return s.weather_dust;
    if (normalized.includes('sand')) return s.weather_sand;
    if (normalized.includes('wind')) return s.weather_wind;
    if (normalized.includes('overcast') || normalized.includes('cloudy')) return s.weather_cloudy;
    if (normalized.includes('partly')) return s.weather_partly_cloudy;
    if (normalized.includes('clear') || normalized.includes('sunny')) return s.weather_clear;
    return raw;
  }

  if (raw.includes('\u96f7') && raw.includes('\u96e8')) return s.weather_storm_rain;
  if (raw.includes('\u66b4\u96e8') || raw.includes('\u5927\u96e8')) return s.weather_heavy_rain;
  if (raw.includes('\u4e2d\u96e8')) return s.weather_moderate_rain;
  if (raw.includes('\u9635\u96e8') || raw.includes('\u5c0f\u96e8') || raw.includes('\u6bdb\u6bdb\u96e8')) return s.weather_light_rain;
  if (raw.includes('\u66b4\u96ea') || raw.includes('\u5927\u96ea')) return s.weather_heavy_snow;
  if (raw.includes('\u4e2d\u96ea')) return s.weather_moderate_snow;
  if (raw.includes('\u9635\u96ea') || raw.includes('\u5c0f\u96ea')) return s.weather_light_snow;
  if (raw.includes('\u96fe') || raw.includes('\u6d53\u96fe')) return s.weather_fog;
  if (raw.includes('\u91cd\u5ea6\u9727\u973e') || (raw.includes('\u91cd\u5ea6') && raw.includes('\u973e'))) return s.weather_heavy_haze;
  if (raw.includes('\u4e2d\u5ea6\u9727\u973e') || (raw.includes('\u4e2d\u5ea6') && raw.includes('\u973e'))) return s.weather_moderate_haze;
  if (raw.includes('\u8f7b\u5ea6\u9727\u973e') || raw.includes('\u9727\u973e') || raw.includes('\u973e')) return s.weather_light_haze;
  if (raw.includes('\u6d6e\u5c18') || raw.includes('\u626c\u5c18')) return s.weather_dust;
  if (raw.includes('\u6c99\u5c18')) return s.weather_sand;
  if (raw.includes('\u5927\u98ce')) return s.weather_wind;
  if (raw.includes('\u9634')) return s.weather_cloudy;
  if (raw.includes('\u591a\u4e91') || raw.includes('\u5c11\u4e91')) return s.weather_partly_cloudy;
  if (raw.includes('\u6674')) return s.weather_clear;

  return raw;
}

export function getLocalizedLifeIndexName(type: string, name: string, s: typeof strings): string {
  switch (type) {
    case '1':
      return s.index_sport;
    case '2':
      return s.index_car_wash;
    case '3':
      return s.index_dressing;
    case '5':
      return s.index_uv;
    case '9':
      return s.index_flu;
    default:
      return name;
  }
}

const LIFE_INDEX_CATEGORY_LABELS: Record<string, string> = {
  '适宜': 'Suitable',
  '较适宜': 'Quite Suitable',
  '不宜': 'Not Suitable',
  '较不宜': 'Rather Unsuitable',
  '极不宜': 'Highly Unsuitable',
  '一般': 'Average',
  '较好': 'Good',
  '良好': 'Good',
  '舒适': 'Comfortable',
  '较舒适': 'Comfortable',
  '较热': 'Warm',
  '热': 'Hot',
  '炎热': 'Very Hot',
  '凉': 'Cool',
  '较冷': 'Chilly',
  '冷': 'Cold',
  '寒冷': 'Very Cold',
  '很弱': 'Very Low',
  '弱': 'Low',
  '中等': 'Moderate',
  '强': 'High',
  '很强': 'Very High',
  '极强': 'Extreme',
  '少发': 'Low Risk',
  '较少发': 'Slight Risk',
  '不易发': 'Unlikely',
  '较不易发': 'Low Risk',
  '较易发': 'Moderate Risk',
  '易发': 'High Risk',
  '极易发': 'Very High Risk',
};

const PRECIPITATION_LABELS: Array<{ test: (raw: string) => boolean; value: string }> = [
  {
    test: (raw) => /未来(?:两|2)小时.*无.*降水|短时内无明显降水|未来\d+小时.*无.*降水|无明显降水/.test(raw),
    value: 'No precipitation expected in the next 2 hours',
  },
  {
    test: (raw) => /未来(?:两|2)小时.*(?:小雨|阵雨|毛毛雨)|短时.*(?:小雨|阵雨|毛毛雨)/.test(raw),
    value: 'Light rain expected in the next 2 hours',
  },
  {
    test: (raw) => /未来(?:两|2)小时.*中雨|短时.*中雨/.test(raw),
    value: 'Moderate rain expected in the next 2 hours',
  },
  {
    test: (raw) => /未来(?:两|2)小时.*(?:大雨|暴雨)|短时.*(?:大雨|暴雨)/.test(raw),
    value: 'Heavy rain expected in the next 2 hours',
  },
  {
    test: (raw) => /未来(?:两|2)小时.*雪|短时.*雪/.test(raw),
    value: 'Snow expected in the next 2 hours',
  },
  {
    test: (raw) => /未来(?:两|2)小时.*降水|短时.*降水|未来\d+小时.*降水/.test(raw),
    value: 'Precipitation expected in the next 2 hours',
  },
];

export function getLocalizedLifeIndexCategory(category: string, s: typeof strings, _type?: string): string {
  if (!isEnglishStrings(s)) return category;

  const raw = String(category ?? '').trim();
  if (!raw) return '--';
  if (/^[A-Za-z0-9\s/&()-]+$/.test(raw)) return raw;

  const mapped = LIFE_INDEX_CATEGORY_LABELS[raw];
  if (mapped) return mapped;

  const normalized = category.toLowerCase();
  if (category.includes('\u4e0d\u5b9c') || normalized.includes('unsuitable')) return s.index_category_unsuitable;
  if (category.includes('\u9002\u5b9c') || normalized.includes('suitable')) return s.index_category_suitable;
  return category;
}

export function getLocalizedMinutelySummary(summary: string | undefined, s: typeof strings): string {
  const raw = String(summary ?? '').trim();
  if (!raw) return '';
  if (!isEnglishStrings(s)) return raw;
  if (/^[A-Za-z0-9\s,./:_()-]+$/.test(raw)) return raw;

  const matched = PRECIPITATION_LABELS.find((item) => item.test(raw));
  if (matched) return matched.value;

  if (raw.includes('降水')) return 'Precipitation expected soon';
  return raw;
}

const WIND_DIRECTION_LABELS: Array<{ matches: string[]; value: keyof typeof strings }> = [
  { matches: ['north-northeast', 'north northeast', 'nne', '\u5317\u504f\u4e1c', '\u5317\u4e1c\u5317\u98ce'], value: 'wind_dir_nne' },
  { matches: ['east-northeast', 'east northeast', 'ene', '\u4e1c\u504f\u5317', '\u4e1c\u4e1c\u5317\u98ce'], value: 'wind_dir_ene' },
  { matches: ['east-southeast', 'east southeast', 'ese', '\u4e1c\u504f\u5357', '\u4e1c\u4e1c\u5357\u98ce'], value: 'wind_dir_ese' },
  { matches: ['south-southeast', 'south southeast', 'sse', '\u5357\u504f\u4e1c', '\u5357\u4e1c\u5357\u98ce'], value: 'wind_dir_sse' },
  { matches: ['south-southwest', 'south southwest', 'ssw', '\u5357\u504f\u897f', '\u5357\u897f\u5357\u98ce'], value: 'wind_dir_ssw' },
  { matches: ['west-southwest', 'west southwest', 'wsw', '\u897f\u504f\u5357', '\u897f\u897f\u5357\u98ce'], value: 'wind_dir_wsw' },
  { matches: ['west-northwest', 'west northwest', 'wnw', '\u897f\u504f\u5317', '\u897f\u897f\u5317\u98ce'], value: 'wind_dir_wnw' },
  { matches: ['north-northwest', 'north northwest', 'nnw', '\u5317\u504f\u897f', '\u5317\u897f\u5317\u98ce'], value: 'wind_dir_nnw' },
  { matches: ['northeast', 'north east', 'ne', '\u4e1c\u5317\u98ce'], value: 'wind_dir_ne' },
  { matches: ['southeast', 'south east', 'se', '\u4e1c\u5357\u98ce'], value: 'wind_dir_se' },
  { matches: ['southwest', 'south west', 'sw', '\u897f\u5357\u98ce'], value: 'wind_dir_sw' },
  { matches: ['northwest', 'north west', 'nw', '\u897f\u5317\u98ce'], value: 'wind_dir_nw' },
  { matches: ['north', 'n', '\u5317\u98ce'], value: 'wind_dir_n' },
  { matches: ['east', 'e', '\u4e1c\u98ce'], value: 'wind_dir_e' },
  { matches: ['south', 's', '\u5357\u98ce'], value: 'wind_dir_s' },
  { matches: ['west', 'w', '\u897f\u98ce'], value: 'wind_dir_w' },
];

export function getLocalizedWindDirection(direction: string | undefined, s: typeof strings): string {
  const raw = String(direction ?? '').trim();
  if (!raw) return '--';

  const normalized = raw.toLowerCase();
  const matched = WIND_DIRECTION_LABELS.find(item => item.matches.some(match => normalized === match || raw.includes(match)));
  if (matched) return s[matched.value];

  return raw;
}

const WARNING_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  thunderstorm: { zh: '\u96f7\u96e8', en: 'Thunderstorm' },
  rainstorm: { zh: '\u66b4\u96e8', en: 'Rainstorm' },
  blizzard: { zh: '\u66b4\u96ea', en: 'Blizzard' },
  coldwave: { zh: '\u5bd2\u6f6e', en: 'Cold wave' },
  gale: { zh: '\u5927\u98ce', en: 'Gale' },
  sandstorm: { zh: '\u6c99\u5c18\u66b4', en: 'Sandstorm' },
  hightemperature: { zh: '\u9ad8\u6e29', en: 'High temperature' },
  lowtemperature: { zh: '\u4f4e\u6e29', en: 'Low temperature' },
  fog: { zh: '\u5927\u96fe', en: 'Fog' },
  haze: { zh: '\u973e', en: 'Haze' },
};

const WARNING_LEVEL_LABELS: Record<string, { zh: string; en: string }> = {
  blue: { zh: '\u84dd\u8272', en: 'Blue' },
  yellow: { zh: '\u9ec4\u8272', en: 'Yellow' },
  orange: { zh: '\u6a59\u8272', en: 'Orange' },
  red: { zh: '\u7ea2\u8272', en: 'Red' },
};

function findWarningTypeLabel(rawValue: string, english: boolean): string | null {
  const normalized = rawValue.trim().toLowerCase();
  for (const [key, value] of Object.entries(WARNING_TYPE_LABELS)) {
    if (normalized.includes(key) || rawValue.includes(value.zh)) {
      return english ? value.en : value.zh;
    }
  }
  return null;
}

function findWarningLevelLabel(rawValue: string, english: boolean): string | null {
  const normalized = rawValue.trim().toLowerCase();
  for (const [key, value] of Object.entries(WARNING_LEVEL_LABELS)) {
    if (normalized.includes(key) || rawValue.includes(value.zh)) {
      return english ? value.en : value.zh;
    }
  }
  return null;
}

export function getLocalizedWarningType(
  warning: { title?: string; typeName?: string; severity?: string; level?: string },
  s: typeof strings,
): string {
  const english = isEnglishStrings(s);
  const typeLabel =
    findWarningTypeLabel(String(warning.typeName ?? ''), english) ??
    findWarningTypeLabel(String(warning.title ?? ''), english);
  const levelLabel =
    findWarningLevelLabel(String(warning.severity ?? ''), english) ??
    findWarningLevelLabel(String(warning.level ?? ''), english) ??
    findWarningLevelLabel(String(warning.title ?? ''), english);

  if (typeLabel && levelLabel) {
    return english ? `${typeLabel} ${levelLabel} Warning` : `${typeLabel}${levelLabel}\u9884\u8b66`;
  }

  if (typeLabel) {
    return english ? `${typeLabel} Warning` : `${typeLabel}\u9884\u8b66`;
  }

  return String(warning.title ?? '').trim() || '--';
}

export function getLocalizedWarningText(
  warning: { text?: string; title?: string; typeName?: string; severity?: string; level?: string },
  s: typeof strings,
): string {
  const raw = String(warning.text ?? '').trim();
  if (!raw) return '';
  if (!isEnglishStrings(s)) return raw;
  if (/^[A-Za-z0-9\s,./:_()-]+$/.test(raw)) return raw;
  return `${getLocalizedWarningType(warning, s)} in effect.`;
}
