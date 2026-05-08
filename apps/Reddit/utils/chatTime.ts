import * as TimeService from '../../../os/TimeService';

const sameYmd = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const startOfDayMs = (d: Date): number => {
  const x = TimeService.fromTimestamp(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x.getTime();
};

const monthDay = (d: Date): string => {
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = String(d.getDate()).padStart(2, '0');
  return `${month} ${day}`;
};

const formatAmPmTime = (d: Date): string => {
  const h = d.getHours();
  const m = d.getMinutes();
  const hh = String(h % 12 || 12);
  const mm = String(m).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${hh}:${mm} ${ampm}`;
};

export function getChatDayKey(tsSec: number): string {
  const d = TimeService.fromTimestamp(tsSec * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatChatDateShort(tsSec: number): string {
  const d = TimeService.fromTimestamp(tsSec * 1000);
  return monthDay(d);
}

export function formatChatListTime(tsSec: number): string {
  const msg = TimeService.fromTimestamp(tsSec * 1000);
  const now = TimeService.getDate();

  if (sameYmd(msg, now)) {
    // Same day: show time like "7:55 PM"
    return formatAmPmTime(msg);
  }

  const diffDays = Math.round((startOfDayMs(now) - startOfDayMs(msg)) / 86400000);
  if (diffDays === 1) return 'yesterday';
  return monthDay(msg);
}

export function formatChatDayLabel(tsSec: number): string {
  const msg = TimeService.fromTimestamp(tsSec * 1000);
  const now = TimeService.getDate();
  const diffDays = Math.round((startOfDayMs(now) - startOfDayMs(msg)) / 86400000);
  if (diffDays === 0) return monthDay(msg); // keep screenshot-like label
  if (diffDays === 1) return 'yesterday';
  return monthDay(msg);
}

export function formatChatMessageTime(tsSec: number): string {
  const d = TimeService.fromTimestamp(tsSec * 1000);
  return formatAmPmTime(d);
}

