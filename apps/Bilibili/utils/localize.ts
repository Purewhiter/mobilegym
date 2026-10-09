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

/**
 * 分区/榜单等「中文数据值」的英文显示映射。
 * 数据层（partition 字段、RANKING_DATA 键、URL 参数）保持中文值不变，
 * 仅在渲染时经此映射转换；zh locale 下原样返回。
 */
const PARTITION_LABELS_EN: Record<string, string> = {
  全站: 'All',
  番剧: 'Anime',
  国创: 'Chinese Animation',
  纪录片: 'Documentary',
  电影: 'Movies',
  电视剧: 'TV Series',
  综艺: 'Variety',
  影视: 'Movies & TV',
  娱乐: 'Entertainment',
  音乐: 'Music',
  舞蹈: 'Dance',
  动画: 'Animation',
  绘画: 'Art',
  鬼畜: 'Kichiku',
  游戏: 'Gaming',
  资讯: 'News',
  知识: 'Knowledge',
  人工智能: 'AI',
  科技数码: 'Tech',
  汽车: 'Cars',
  时尚美妆: 'Style & Beauty',
  家装房产: 'Home & Property',
  户外潮流: 'Outdoors',
  健身: 'Fitness',
  体育运动: 'Sports',
  手工: 'Crafts',
  美食: 'Food',
  小剧场: 'Sketches',
  旅游出行: 'Travel',
  三农: 'Rural Life',
  动物: 'Animals',
  亲子: 'Parenting',
  健康: 'Health',
  情感: 'Relationships',
  vlog: 'Vlog',
  生活兴趣: 'Lifestyle',
  生活经验: 'Life Tips',
  全区排行榜: 'All Rankings',
  新歌热榜: 'New Music Chart',
  工房集市: 'Workshop Market',
  小黑屋: 'Banned List',
  游戏中心: 'Game Center',
  游戏赛事: 'Esports',
  漫画: 'Comics',
  课堂: 'Classes',
  专栏: 'Articles',
  超高清专区: 'Ultra HD Zone',
};

export function localizePartitionLabel(label: string | undefined, locale: Locale): string {
  if (!label) return '';
  if (locale !== 'en') return label;
  return PARTITION_LABELS_EN[label] ?? label;
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
