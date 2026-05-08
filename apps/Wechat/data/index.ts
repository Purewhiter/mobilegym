/**
 * WeChat App 数据入口（默认数据 + 运行时派生）
 *
 * 说明：
 * - 默认数据来自 `defaults.json`（可替换以构建不同测试环境）
 * - 时间戳支持 `resolveDataTimestamp` 的 4 种格式（见 TimeService）：
 *   - `"-1h"` / `"-2d30m"` 等可读相对偏移
 *   - 负数 ms 偏移、绝对时间戳、日期字符串
 * - time 类型消息的 `content` 会在此处根据 timestamp 重新生成（保证"昨天/xx月xx日"逻辑一致）
 */

import { resolveDataTimestamp, now, fromTimestamp } from '../../../os/TimeService';
import type { AppData } from '../types';
import defaults from './defaults.json';
const asset = (r: unknown) => { const s = String(r ?? '').trim(); return (!s || s.startsWith('http')) ? s : `/@app-assets/Wechat/${s}`; };

const NOW = now();
const ts = (v: unknown) => resolveDataTimestamp(v as string | number);

const formatChatTimeline = (timestamp: number): string => {
  const date = fromTimestamp(timestamp);
  const nowDate = fromTimestamp(NOW);
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const timeStr = `${hours}:${minutes}`;

  if (isSameDay(date, nowDate)) return timeStr;
  const yesterday = fromTimestamp(nowDate.getTime());
  yesterday.setDate(nowDate.getDate() - 1);
  if (isSameDay(date, yesterday)) return `昨天 ${timeStr}`;

  if (date.getFullYear() === nowDate.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${timeStr}`;
};

const withResolvedTimestamps = (data: any): AppData => {
  const chats = Array.isArray(data?.chats)
    ? data.chats.map((chat: any) => {
        const messages = Array.isArray(chat?.messages)
          ? chat.messages.map((msg: any) => {
              const timestamp = ts(msg?.timestamp);
              if (msg?.type === 'time') {
                return { ...msg, timestamp, content: formatChatTimeline(timestamp) };
              }
              return { ...msg, timestamp };
            })
          : [];
        return { ...chat, messages };
      })
    : [];

  const moments = Array.isArray(data?.moments)
    ? data.moments.map((mo: any) => ({ ...mo, timestamp: ts(mo?.timestamp) }))
    : [];

  return {
    ...(data as AppData),
    chats,
    moments,
  };
};

const resolveAssetsDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(resolveAssetsDeep);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = resolveAssetsDeep(v);
    }
    return out;
  }
  if (typeof value === 'string' && value.includes('/')) return asset(value);
  return value;
};

let cachedWechatConfig: AppData | null = null;

/**
 * data-mode 直接使用完整初始数据（不再维护额外的"导航专用投影层/接口"）。
 */
export function getWechatConfig(): AppData {
  if (cachedWechatConfig) return cachedWechatConfig;
  const resolvedDefaults = resolveAssetsDeep(defaults) as typeof defaults;
  cachedWechatConfig = withResolvedTimestamps(resolvedDefaults);
  return cachedWechatConfig;
}

export const WECHAT_CONFIG = getWechatConfig();
