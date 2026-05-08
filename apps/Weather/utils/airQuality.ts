import { strings } from '../res/strings';

export type AqiLevel = 'excellent' | 'good' | 'light' | 'moderate' | 'heavy' | 'severe';

export function normalizeAqiLevel(category: string, level?: string): AqiLevel | null {
  const raw = category.trim().toLowerCase();

  if (raw.includes('\u4e25\u91cd') || raw.includes('severe')) return 'severe';
  if (raw.includes('\u91cd\u5ea6') || raw.includes('heavy')) return 'heavy';
  if (raw.includes('\u4e2d\u5ea6') || raw.includes('moderate')) return 'moderate';
  if (raw.includes('\u8f7b\u5ea6') || raw.includes('light')) return 'light';
  if (raw.includes('\u826f') || raw.includes('good')) return 'good';
  if (raw.includes('\u4f18') || raw.includes('excellent')) return 'excellent';

  switch (level) {
    case '1':
      return 'excellent';
    case '2':
      return 'good';
    case '3':
      return 'light';
    case '4':
      return 'moderate';
    case '5':
      return 'heavy';
    case '6':
      return 'severe';
    default:
      return null;
  }
}

export function getAqiLevelColor(level: AqiLevel | null): string {
  switch (level) {
    case 'excellent':
      return '#61b15a';
    case 'good':
      return '#e8a735';
    case 'light':
      return '#f0874a';
    case 'moderate':
      return '#ea5a5a';
    case 'heavy':
      return '#b44dcc';
    case 'severe':
      return '#7e1023';
    default:
      return '#999';
  }
}

export function getAqiLevelSoftColor(level: AqiLevel | null): string {
  switch (level) {
    case 'excellent':
      return '#b9e6c9';
    case 'good':
      return '#e8c77a';
    case 'light':
      return '#f0a86b';
    case 'moderate':
      return '#ea8a8a';
    case 'heavy':
      return '#c37ce6';
    case 'severe':
      return '#9e5474';
    default:
      return '#c6d0db';
  }
}

export function getAqiLevelLabel(level: AqiLevel | null, s: typeof strings): string {
  switch (level) {
    case 'excellent':
      return s.aqi_level_excellent;
    case 'good':
      return s.aqi_level_good;
    case 'light':
      return s.aqi_level_light;
    case 'moderate':
      return s.aqi_level_moderate;
    case 'heavy':
      return s.aqi_level_heavy;
    case 'severe':
      return s.aqi_level_severe;
    default:
      return '--';
  }
}

export function getAqiLevelDescription(level: AqiLevel | null, s: typeof strings): string {
  switch (level) {
    case 'excellent':
      return s.aqi_desc_excellent;
    case 'good':
      return s.aqi_desc_good;
    case 'light':
      return s.aqi_desc_light;
    case 'moderate':
      return s.aqi_desc_moderate;
    case 'heavy':
      return s.aqi_desc_heavy;
    case 'severe':
      return s.aqi_desc_severe;
    default:
      return '';
  }
}
