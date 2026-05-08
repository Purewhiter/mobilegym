import type { Locale } from '../../../os/locale';

function toNumericValue(value: number | string | undefined): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  const text = value.trim();
  if (!text) return null;

  if (text.includes('亿')) {
    const parsed = Number.parseFloat(text.replace(/[^\d.]/g, ''));
    return Number.isFinite(parsed) ? parsed * 100000000 : null;
  }

  if (text.includes('万')) {
    const parsed = Number.parseFloat(text.replace(/[^\d.]/g, ''));
    return Number.isFinite(parsed) ? parsed * 10000 : null;
  }

  const parsed = Number.parseFloat(text.replace(/[^\d.]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatBilibiliStat(value: number | string | undefined, locale: Locale) {
  if (locale !== 'en' && typeof value === 'string' && (value.includes('万') || value.includes('亿'))) {
    return value;
  }

  const numericValue = toNumericValue(value);
  if (numericValue === null) return '0';

  if (locale === 'en') {
    if (numericValue >= 1000000000) return `${(numericValue / 1000000000).toFixed(1)}B`;
    if (numericValue >= 1000000) return `${(numericValue / 1000000).toFixed(1)}M`;
    if (numericValue >= 1000) return `${(numericValue / 1000).toFixed(1)}K`;
    return Math.round(numericValue).toString();
  }

  if (numericValue >= 100000000) return `${(numericValue / 100000000).toFixed(1)}亿`;
  if (numericValue >= 10000) return `${(numericValue / 10000).toFixed(1)}万`;
  return Math.round(numericValue).toString();
}

export function formatBilibiliDuration(value: number | string | undefined) {
  if (!value) return '00:00';
  if (typeof value === 'string' && value.includes(':')) return value;

  const seconds = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (!Number.isFinite(seconds)) return '00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds
      .toString()
      .padStart(2, '0')}`;
  }

  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds
    .toString()
    .padStart(2, '0')}`;
}

export function formatBilibiliRelativeDate(hasDate: boolean, locale: Locale) {
  if (locale === 'en') {
    return hasDate ? '2 days ago' : 'Yesterday';
  }
  return hasDate ? '2天前' : '昨天';
}
