export function formatWechatReadingMessage(template: string, ...values: Array<string | number>) {
  return values.reduce(
    (result: string, value, index) => result.replace(new RegExp(`\\{${index}\\}`, 'g'), String(value)),
    template,
  );
}

function parseNumericCount(count: number | string) {
  if (typeof count === 'number') return count;

  const wanMatch = count.match(/^(\d+(?:\.\d+)?)万(?:字)?$/);
  if (wanMatch) {
    return Number(wanMatch[1]) * 10000;
  }

  const normalized = Number(count.replace(/,/g, ''));
  return Number.isFinite(normalized) ? normalized : null;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: value >= 100000 ? 0 : 1,
  }).format(value);
}

export function formatWechatReadingCount(count: number | string | undefined, locale: string) {
  if (count === undefined || count === null || count === '') return '-';
  if (locale !== 'en') {
    if (typeof count === 'string') return count;
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
    return String(count);
  }

  const numeric = parseNumericCount(count);
  if (numeric === null) return String(count);
  return numeric >= 1000 ? formatCompactNumber(numeric) : String(numeric);
}

export function formatWechatReadingWords(count: number | undefined, locale: string) {
  if (!count) return locale === 'en' ? '0 words' : '0字';
  if (locale === 'en') {
    const value = count >= 1000 ? formatCompactNumber(count) : String(count);
    return `${value} words`;
  }
  if (count >= 10000) return `${(count / 10000).toFixed(1)}万字`;
  return `${count}字`;
}

export function formatWechatReadingDuration(minutes: number, locale: string) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (locale === 'en') {
    if (hours > 0 && mins > 0) return `${hours} h ${mins} min`;
    if (hours > 0) return `${hours} h`;
    return `${mins} min`;
  }
  return `${hours}时 ${mins}分`;
}

export function quoteWechatReadingTitle(title: string, locale: string) {
  return locale === 'en' ? `"${title}"` : `《${title}》`;
}

export function localizeWechatReadingGender(
  gender: string,
  strings: { gender_male: string; gender_female: string },
) {
  if (gender === '男') return strings.gender_male;
  if (gender === '女') return strings.gender_female;
  return gender;
}

export function localizeWechatReadingVisibility(
  visibility: string,
  strings: {
    profile_privacy_self_only: string;
    profile_privacy_mutual_only: string;
    profile_privacy_followers_only: string;
    profile_privacy_everyone: string;
  },
) {
  switch (visibility) {
    case '仅自己可见':
      return strings.profile_privacy_self_only;
    case '互关可见':
      return strings.profile_privacy_mutual_only;
    case '关注我的人可见':
      return strings.profile_privacy_followers_only;
    case '所有人可见':
      return strings.profile_privacy_everyone;
    default:
      return visibility;
  }
}

export function localizeWechatReadingDarkModeValue(
  darkMode: string,
  strings: {
    settings_dark_mode_follow_system: string;
    settings_dark_mode_enabled: string;
    settings_dark_mode_disabled: string;
  },
) {
  if (darkMode === '跟随系统') return strings.settings_dark_mode_follow_system;
  if (darkMode === '深色') return strings.settings_dark_mode_enabled;
  return strings.settings_dark_mode_disabled;
}

export function localizeWechatReadingDarkModeMode(
  darkMode: string,
  strings: {
    dark_mode_follow_system: string;
    dark_mode_light: string;
    dark_mode_dark: string;
  },
) {
  if (darkMode === '跟随系统') return strings.dark_mode_follow_system;
  if (darkMode === '深色') return strings.dark_mode_dark;
  return strings.dark_mode_light;
}

export function localizeWechatReadingPageTurnStyle(
  pageTurnStyle: string,
  strings: {
    page_turn_simulation: string;
    page_turn_swipe: string;
    page_turn_scroll: string;
    page_turn_cover: string;
  },
) {
  switch (pageTurnStyle) {
    case '仿真翻页':
      return strings.page_turn_simulation;
    case '左右滑动':
      return strings.page_turn_swipe;
    case '上下滚动':
      return strings.page_turn_scroll;
    case '覆盖翻页':
      return strings.page_turn_cover;
    default:
      return pageTurnStyle;
  }
}
