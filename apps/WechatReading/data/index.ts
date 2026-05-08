import defaults from './defaults.json';
import { WECHAT_READING_CONSTANTS } from '../constants';
import * as TimeService from '../../../os/TimeService';

// ============================================================
// 数据时间戳统一解析
// ============================================================
//
// 所有时间戳字段统一走 TimeService.resolveDataTimestamp：
//   "-XdYhZm"   → 人类可读的相对偏移，锚定 bootTime
//   负数         → 毫秒偏移，锚定 bootTime
//   ISO 字符串   → 绝对值
// 无条件解析，不区分格式 —— resolveDataTimestamp 已处理所有情况。

const __pad2 = (n: number) => String(n).padStart(2, '0');

function __formatDate(ts: number): string {
  const d = TimeService.fromTimestamp(ts);
  return `${d.getFullYear()}-${__pad2(d.getMonth() + 1)}-${__pad2(d.getDate())}`;
}

function __formatISO(ts: number): string {
  const d = TimeService.fromTimestamp(ts);
  return `${d.getFullYear()}-${__pad2(d.getMonth() + 1)}-${__pad2(d.getDate())}T${__pad2(d.getHours())}:${__pad2(d.getMinutes())}:${__pad2(d.getSeconds())}`;
}

function __resolveToISO(raw: string | number): string {
  return __formatISO(TimeService.resolveDataTimestamp(raw));
}

const __resolvedRecords = ((defaults as any).readingRecords ?? []).map((r: any) => {
  const ts = TimeService.resolveDataTimestamp(r.timestamp);
  return { ...r, date: __formatDate(ts), timestamp: __formatISO(ts) };
});

const __resolvedShelf = ((defaults as any).shelf ?? []).map((item: any) => ({
  ...item,
  addedAt: __resolveToISO(item.addedAt),
}));

const __resolvedProgress: Record<string, any> = {};
for (const [key, val] of Object.entries((defaults as any).bookProgress ?? {})) {
  const p = val as any;
  __resolvedProgress[key] = { ...p, lastReadAt: __resolveToISO(p.lastReadAt) };
}

// ============================================================
// Derived collections (progress-driven lists)
// - In the real app, "在读/读完" is driven by reading progress/history,
//   and persists even if the book is removed from the shelf.
// - MyProfile "读完" tab visibility/list is driven by finished books,
//   but excludes books that are on-shelf AND marked private.
// ============================================================

const __storeById = new Map((defaults.store ?? []).map((b: any) => [String(b.id), b]));
const __shelfByBookId = new Map(__resolvedShelf.map((i: any) => [String(i.bookId), i]));
const __progressByBookId: Record<string, any> = __resolvedProgress;
const __progressBookIds = Object.keys(__progressByBookId).map(String);

function __getTotalWords(bookId: string) {
  const book = __storeById.get(String(bookId));
  return typeof (book as any)?.totalWords === 'number' ? (book as any).totalWords : null;
}

function __isFinished(bookId: string) {
  const total = __getTotalWords(bookId);
  const p = __progressByBookId[String(bookId)];
  if (!p || total === null) return false;
  return Number(p.charOffset) >= Number(total);
}

const __finishedBookIds = __progressBookIds.filter(__isFinished);
const __readingBookIds = __progressBookIds.filter((id) => !__isFinished(id));

const __homeFinishedBookIds = __finishedBookIds.filter((bookId) => {
  const shelfItem = __shelfByBookId.get(String(bookId));
  return !(shelfItem && (shelfItem as any).isPrivate === true);
});

// Build config with derived fields included directly (no post-hoc mutation)
export const WECHAT_READING_CONFIG = {
  ...WECHAT_READING_CONSTANTS,
  ...defaults,
  shelf: __resolvedShelf,
  bookProgress: __resolvedProgress,
  readingRecords: __resolvedRecords,
  allProgressBookIds: __progressBookIds,
  readingBookIds: __readingBookIds,
  finishedBookIds: __finishedBookIds,
  homeFinishedBookIds: __homeFinishedBookIds,
};
