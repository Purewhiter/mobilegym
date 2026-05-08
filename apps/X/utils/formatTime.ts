import { now as timeNow, fromTimestamp, parseToTimestamp } from '../../../os/TimeService';
import { getLocale } from '../../../os/locale';

const ISO_RE = /^\d{4}-\d{2}-\d{2}T/;
const REL_RE = /^(\d+)([mhd])$/;
const CN_DATE_RE = /^(\d+)月(\d+)日$/;
const CN_FULL_DATE_RE = /^(\d{4})年(\d+)月(\d+)日$/;
const EN_DATE_RE = /^(\d+)\/(\d+)$/;
const EN_FULL_DATE_RE = /^(\d+)\/(\d+)\/(\d{4})$/;
export const JUST_NOW_ZH = '刚刚';
export const JUST_NOW_EN = 'just now';
const TWITTER_EPOCH_MS = 1288834974657n;
const TWITTER_POST_ID_RE = /^p_(\d+)$/;
const LOCAL_POST_ID_RE = /^(?:new|reply)_(\d+)$/;

export interface XPostTemporalLike {
  id?: string;
  time?: string;
  createdAt?: string;
}

interface ResolveCreatedAtOptions {
  allowIdFallback?: boolean;
}

export function getJustNowLabel(): string {
  return getLocale() === 'en' ? JUST_NOW_EN : JUST_NOW_ZH;
}

function toIsoString(timestamp: number): string {
  return fromTimestamp(timestamp).toISOString();
}

function normalizeAbsoluteTime(value?: string): string | undefined {
  if (!value) return undefined;
  const ts = parseToTimestamp(value);
  return ts ? toIsoString(ts) : undefined;
}

function deriveCreatedAtFromPostId(id?: string): string | undefined {
  if (!id) return undefined;

  const twitterMatch = id.match(TWITTER_POST_ID_RE);
  if (twitterMatch) {
    try {
      const snowflake = BigInt(twitterMatch[1]);
      const timestampMs = Number((snowflake >> 22n) + TWITTER_EPOCH_MS);
      return toIsoString(timestampMs);
    } catch {
      return undefined;
    }
  }

  const localMatch = id.match(LOCAL_POST_ID_RE);
  if (!localMatch) return undefined;

  const timestampMs = Number(localMatch[1]);
  if (!Number.isFinite(timestampMs) || timestampMs <= 0) return undefined;
  return toIsoString(timestampMs);
}

function resolveExplicitXPostCreatedAt(post: XPostTemporalLike): string | undefined {
  return normalizeAbsoluteTime(post.createdAt)
    ?? normalizeAbsoluteTime(ISO_RE.test(post.time || '') ? post.time : undefined);
}

export function resolveXPostCreatedAt(
  post: XPostTemporalLike,
  options: ResolveCreatedAtOptions = {},
): string | undefined {
  const explicitCreatedAt = resolveExplicitXPostCreatedAt(post);
  if (explicitCreatedAt) return explicitCreatedAt;
  if (options.allowIdFallback === false) return undefined;
  return deriveCreatedAtFromPostId(post.id);
}

export function getXPostDisplayTime(post: XPostTemporalLike): string {
  const explicitCreatedAt = resolveXPostCreatedAt(post, { allowIdFallback: false });
  if (explicitCreatedAt) return formatXTime(explicitCreatedAt);
  if (post.time) return formatXTime(post.time);
  return formatXTime(resolveXPostCreatedAt(post) ?? '');
}

export function getXPostRecencyMs(post: XPostTemporalLike): number | null {
  const createdAt = resolveXPostCreatedAt(post, { allowIdFallback: false });
  if (!createdAt) return null;
  const ts = parseToTimestamp(createdAt);
  return ts || null;
}

function getXPostRecencyMinutes(post: XPostTemporalLike): number | null {
  const explicitTimestamp = getXPostRecencyMs(post);
  if (explicitTimestamp !== null) {
    return Math.max(0, Math.floor((timeNow() - explicitTimestamp) / 60_000));
  }

  if (post.time) {
    const minutes = parseXTimeToMinutes(post.time);
    if (minutes !== 999999) return minutes;
  }

  const fallbackCreatedAt = resolveXPostCreatedAt(post, { allowIdFallback: true });
  if (!fallbackCreatedAt) return null;
  const ts = parseToTimestamp(fallbackCreatedAt);
  if (!ts) return null;
  return Math.max(0, Math.floor((timeNow() - ts) / 60_000));
}

function getXPostTieBreakerMs(post: XPostTemporalLike): number | null {
  const explicitTimestamp = getXPostRecencyMs(post);
  if (explicitTimestamp !== null) return explicitTimestamp;

  const fallbackCreatedAt = resolveXPostCreatedAt(post, { allowIdFallback: true });
  if (!fallbackCreatedAt) return null;
  const ts = parseToTimestamp(fallbackCreatedAt);
  return ts || null;
}

export function compareXPostsByRecencyDesc(a: XPostTemporalLike, b: XPostTemporalLike): number {
  const aMs = getXPostRecencyMs(a);
  const bMs = getXPostRecencyMs(b);
  if (aMs !== null && bMs !== null) {
    const delta = bMs - aMs;
    if (delta !== 0) return delta;
  }

  const aMinutes = getXPostRecencyMinutes(a);
  const bMinutes = getXPostRecencyMinutes(b);
  if (aMinutes !== null && bMinutes !== null) {
    const delta = aMinutes - bMinutes;
    if (delta !== 0) return delta;

    const aTieBreaker = getXPostTieBreakerMs(a);
    const bTieBreaker = getXPostTieBreakerMs(b);
    if (aTieBreaker !== null && bTieBreaker !== null && aTieBreaker !== bTieBreaker) {
      return bTieBreaker - aTieBreaker;
    }
    return 0;
  }
  if (aMinutes !== null) return -1;
  if (bMinutes !== null) return 1;
  return 0;
}

export function normalizeXPostTemporalFields<T extends XPostTemporalLike>(post: T): T & { time: string; createdAt?: string } {
  const explicitCreatedAt = resolveXPostCreatedAt(post, { allowIdFallback: false });
  const createdAt = explicitCreatedAt ?? (!post.time ? resolveXPostCreatedAt(post) : undefined);
  return {
    ...post,
    ...(createdAt ? { createdAt } : {}),
    time: getXPostDisplayTime({ ...post, ...(createdAt ? { createdAt } : {}) }),
  };
}

function formatXCalendarDate(ts: number): string {
  const date = fromTimestamp(ts);
  const nowDate = fromTimestamp(timeNow());
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (getLocale() === 'en') {
    if (date.getFullYear() !== nowDate.getFullYear()) {
      return `${month}/${day}/${date.getFullYear()}`;
    }
    return `${month}/${day}`;
  }

  if (date.getFullYear() !== nowDate.getFullYear()) {
    return `${date.getFullYear()}年${month}月${day}日`;
  }
  return `${month}月${day}日`;
}

/**
 * Convert any time string to X-style display format.
 * - ISO timestamps → relative ("5m", "3h") or date ("1月27日", "2025年3月15日")
 * - Already-formatted strings ("1h", "2d", "刚刚") → pass through
 */
export function formatXTime(timeStr: string): string {
  if (!timeStr) return '';
  if (timeStr === JUST_NOW_ZH || timeStr === JUST_NOW_EN) return getJustNowLabel();
  if (REL_RE.test(timeStr)) return timeStr;

  const cnFullMatch = timeStr.match(CN_FULL_DATE_RE);
  if (cnFullMatch) {
    const ts = parseToTimestamp(`${cnFullMatch[1]}-${cnFullMatch[2].padStart(2, '0')}-${cnFullMatch[3].padStart(2, '0')}`);
    return ts ? formatXCalendarDate(ts) : timeStr;
  }

  const cnMatch = timeStr.match(CN_DATE_RE);
  if (cnMatch) {
    const nowDate = fromTimestamp(timeNow());
    const ts = parseToTimestamp(`${nowDate.getFullYear()}-${cnMatch[1].padStart(2, '0')}-${cnMatch[2].padStart(2, '0')}`);
    return ts ? formatXCalendarDate(ts) : timeStr;
  }

  const enFullMatch = timeStr.match(EN_FULL_DATE_RE);
  if (enFullMatch) {
    const ts = parseToTimestamp(`${enFullMatch[3]}-${enFullMatch[1].padStart(2, '0')}-${enFullMatch[2].padStart(2, '0')}`);
    return ts ? formatXCalendarDate(ts) : timeStr;
  }

  const enMatch = timeStr.match(EN_DATE_RE);
  if (enMatch) {
    const nowDate = fromTimestamp(timeNow());
    const ts = parseToTimestamp(`${nowDate.getFullYear()}-${enMatch[1].padStart(2, '0')}-${enMatch[2].padStart(2, '0')}`);
    return ts ? formatXCalendarDate(ts) : timeStr;
  }

  if (!ISO_RE.test(timeStr)) return timeStr;

  const ts = parseToTimestamp(timeStr);
  if (!ts) return timeStr;

  const nowMs = timeNow();
  const diffMs = nowMs - ts;
  if (diffMs < 0) return getJustNowLabel();

  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return getJustNowLabel();
  if (diffMin < 60) return `${diffMin}m`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;

  return formatXCalendarDate(ts);
}

/**
 * Parse any X time string to "minutes ago" for sorting.
 * Lower = more recent.
 */
export function parseXTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 999999;
  if (timeStr === JUST_NOW_ZH || timeStr === JUST_NOW_EN) return 0;

  const relMatch = timeStr.match(REL_RE);
  if (relMatch) {
    const num = parseInt(relMatch[1]);
    const unit = relMatch[2];
    if (unit === 'm') return num;
    if (unit === 'h') return num * 60;
    if (unit === 'd') return num * 1440;
  }

  if (ISO_RE.test(timeStr)) {
    const ts = parseToTimestamp(timeStr);
    if (ts) return Math.max(0, Math.floor((timeNow() - ts) / 60_000));
  }

  const cnFull = timeStr.match(CN_FULL_DATE_RE);
  if (cnFull) {
    const ts = parseToTimestamp(`${cnFull[1]}-${cnFull[2].padStart(2, '0')}-${cnFull[3].padStart(2, '0')}`);
    if (ts) return Math.max(0, Math.floor((timeNow() - ts) / 60_000));
  }

  const cn = timeStr.match(CN_DATE_RE);
  if (cn) {
    const nowDate = fromTimestamp(timeNow());
    const ts = parseToTimestamp(`${nowDate.getFullYear()}-${cn[1].padStart(2, '0')}-${cn[2].padStart(2, '0')}`);
    if (ts) return Math.max(0, Math.floor((timeNow() - ts) / 60_000));
  }

  const enFull = timeStr.match(EN_FULL_DATE_RE);
  if (enFull) {
    const ts = parseToTimestamp(`${enFull[3]}-${enFull[1].padStart(2, '0')}-${enFull[2].padStart(2, '0')}`);
    if (ts) return Math.max(0, Math.floor((timeNow() - ts) / 60_000));
  }

  const en = timeStr.match(EN_DATE_RE);
  if (en) {
    const nowDate = fromTimestamp(timeNow());
    const ts = parseToTimestamp(`${nowDate.getFullYear()}-${en[1].padStart(2, '0')}-${en[2].padStart(2, '0')}`);
    if (ts) return Math.max(0, Math.floor((timeNow() - ts) / 60_000));
  }

  return 999999;
}
