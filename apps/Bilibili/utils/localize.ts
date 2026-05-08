import type { Locale } from '@/os/locale';
import * as TimeService from '../../../os/TimeService';

function parseStatValue(value: number | string | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  if (value.includes('亿')) return parseFloat(value) * 100000000;
  if (value.includes('万')) return parseFloat(value) * 10000;
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatBilibiliStat(value: number | string | undefined, locale: Locale): string {
  const numeric = parseStatValue(value);
  if (locale !== 'en') {
    if (typeof value === 'string' && (value.includes('万') || value.includes('亿'))) {
      return value;
    }
    if (numeric >= 100000000) return `${(numeric / 100000000).toFixed(1)}亿`;
    if (numeric >= 10000) return `${(numeric / 10000).toFixed(1)}万`;
    return `${numeric || 0}`;
  }
  if (numeric >= 1000000000) return `${(numeric / 1000000000).toFixed(1)}B`;
  if (numeric >= 1000000) return `${(numeric / 1000000).toFixed(1)}M`;
  if (numeric >= 1000) return `${(numeric / 1000).toFixed(1)}K`;
  return `${numeric || 0}`;
}

export function formatBilibiliRelativeTime(timestampSeconds: number, nowMs: number, locale: Locale): string {
  const diff = nowMs - timestampSeconds * 1000;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (locale !== 'en') {
    if (hours < 24) return `${hours || 1}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  }
  if (hours < 24) return `${hours || 1}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatBilibiliSearchDate(timestamp: number, locale: Locale): string {
  if (!timestamp) return '';
  const now = TimeService.now();
  const ts = timestamp > 1e11 ? timestamp : timestamp * 1000;
  const diff = now - ts;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (locale !== 'en') {
    if (diff < minute) return '刚刚';
    if (diff < hour) return `${Math.floor(diff / minute)}分钟前`;
    if (diff < 24 * hour) return `${Math.floor(diff / hour)}小时前`;
    if (diff < 2 * day) return '昨天';
  } else {
    if (diff < minute) return 'Just now';
    if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
    if (diff < 24 * hour) return `${Math.floor(diff / hour)}h ago`;
    if (diff < 2 * day) return 'Yesterday';
  }

  const date = TimeService.fromTimestamp(ts);
  if (locale !== 'en') {
    const nowDate = TimeService.getDate();
    if (date.getFullYear() === nowDate.getFullYear()) {
      return `${date.getMonth() + 1}月${date.getDate()}日`;
    }
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  }

  return date.toLocaleDateString('en-US', {
    year: date.getFullYear() === TimeService.getDate().getFullYear() ? undefined : 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
