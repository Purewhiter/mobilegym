/**
 * 余票模拟生成器。
 *
 * 基于 catalog 快照（数据来源 2026-04-23）为任意日期生成拟真余票数量。
 * 使用确定性 PRNG（FNV-1a + mulberry32），相同查询参数始终返回相同结果。
 *
 * 返回值语义与 catalog availability 字段一致：
 *   -1 = "有"（充足，原始 ≥3000 或标记充足）
 *    0 = 售罄 / 未开售 / 已过期
 *   正整数 = 具体余票数
 */

import { getToday, fromTimestamp, parseToTimestamp } from '../../../os/TimeService';

const PRESALE_DAYS = 15;

/** 席别基础紧张度（0=永远有票，1=永远售罄），整体调松保证 bench 任务不因票源干涸失败 */
const SEAT_TIGHTNESS: Record<string, number> = {
  businessSeat: 0.55,
  premiumSeat: 0.50,
  specialSeat: 0.50,
  firstClass: 0.35,
  secondClass: 0.15,
  softSleeper: 0.45,
  hardSleeper: 0.35,
  softSeat: 0.20,
  hardSeat: 0.18,
  noSeat: 0.05,
  motionSleeper: 0.35,
  highMotionSleeper: 0.40,
  firstSleeper: 0.40,
  secondSleeper: 0.30,
  preferredFirstClass: 0.35,
  highSoftSleeper: 0.45,
};

/**
 * 始发站三字码 → 开售时刻（HH:mm）。
 * 来源：2026-04-23 数据快照校验——同一始发站所有车次 saleDt 时刻一致。
 */
const STATION_SALE_TIME: Record<string, string> = {
  BJP: '14:00', SHH: '14:00', GZQ: '13:00', SZQ: '13:00',
  HZH: '07:00', NJH: '14:00', WHN: '14:00', CDW: '14:30',
  CQW: '08:00', XAY: '15:00', CSQ: '13:30', ZZF: '14:00',
  TJP: '15:30', JNK: '15:30', HFH: '15:00', FZS: '13:30',
  XMS: '13:30', QDK: '15:30', SYT: '16:00', DLT: '16:00',
  HBB: '08:00', KMM: '08:00',
};

/** 未知始发站 fallback 时刻候选 */
const FALLBACK_SALE_TIMES = ['05:00', '08:00', '10:00', '12:30', '14:00', '16:00', '18:00'];

// ── 确定性 PRNG ──────────────────────────────────────────────────────

function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (Math.imul(h, 16777619)) >>> 0;
  }
  return h >>> 0;
}

function makeMulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return (): number => {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = (Math.imul(t ^ (t >>> 15), t | 1)) >>> 0;
    t ^= (t + (Math.imul(t ^ (t >>> 7), t | 61))) >>> 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

// ── 日期工具 ──────────────────────────────────────────────────────────

/** YYYY-MM-DD 距今天模拟日期的天数差（负=过去，0=今天，正=未来） */
function daysFromToday(dateStr: string): number {
  const todayTs = parseToTimestamp(getToday());
  const queryTs = parseToTimestamp(dateStr);
  if (!queryTs) return -999;
  return Math.round((queryTs - todayTs) / 86400000);
}

/** YYYY-MM-DD → weekday（0=Mon..6=Sun，与 Python weekday() 一致） */
function getWeekday(dateStr: string): number {
  const d = fromTimestamp(parseToTimestamp(dateStr));
  return (d.getUTCDay() + 6) % 7;
}

// ── 紧张度计算 ────────────────────────────────────────────────────────

function computeTightness(
  seatKey: string,
  trainCode: string,
  daysUntil: number,
  weekday: number,
): number {
  const seatT = SEAT_TIGHTNESS[seatKey] ?? 0.4;
  const dayF = daysUntil === 0 ? 0.30 : daysUntil <= 3 ? 0.15 : daysUntil <= 7 ? 0.05 : 0;
  const wf: Record<number, number> = { 4: 0.15, 5: 0.05, 6: 0.20 };
  const trainLuck = (fnv1a(trainCode) % 40) / 100 - 0.20;
  return clamp(seatT + dayF + (wf[weekday] ?? 0) + trainLuck, 0, 1);
}

// ── 主接口 ────────────────────────────────────────────────────────────

/**
 * 为指定 OD、日期、席别生成模拟余票数量。
 *
 * @param baseCount - catalog 基线：-1="有", 0=售罄, 正整数=具体余票（≥3000 视为充足）
 * @param trainCode - 车次号（如 "G1"）
 * @param fromCode  - 出发站三字码（如 "BJP"）
 * @param toCode    - 到达站三字码（如 "NJH"）
 * @param dateStr   - 查询日期 YYYY-MM-DD
 * @param seatKey   - 席别键（如 "secondClass"）
 * @returns 与 baseCount 语义一致：-1="有", 0=售罄/未开售, 正整数=具体余票
 */
export function generateSeatCount(
  baseCount: number,
  trainCode: string,
  fromCode: string,
  toCode: string,
  dateStr: string,
  seatKey: string,
): number {
  const daysUntil = daysFromToday(dateStr);
  // 未开售（预售期外）或已过期，均返回 0；调用方负责设置 saleTime
  if (daysUntil < 0 || daysUntil > PRESALE_DAYS) return 0;

  const weekday = getWeekday(dateStr);
  const tightness = computeTightness(seatKey, trainCode, daysUntil, weekday);
  const seedKey = `${trainCode}|${fromCode}|${toCode}|${dateStr}|${seatKey}`;
  const rng = makeMulberry32(fnv1a(seedKey));

  if (baseCount === 0) {
    // 基线售罄 → 粘性强
    const soldOutP = clamp(0.92 + (tightness - 0.5) * 0.2, 0.85, 0.99);
    if (rng() < soldOutP) return 0;
    return Math.floor(1 + rng() * 7); // 罕见松动 1..8
  }

  if (baseCount === -1 || baseCount >= 3000) {
    // 基线充足
    const soldOutP = tightness * 0.3;
    if (rng() < soldOutP) return Math.floor(1 + rng() * 14); // 1..15
    return -1;
  }

  // 基线具体数
  const soldOutP = clamp(tightness - 0.5 + (baseCount < 5 ? 0.1 : 0), 0, 0.6);
  if (rng() < soldOutP) return 0;

  if (baseCount <= 4) {
    const delta = Math.round((rng() - 0.5) * 8); // ±4
    return Math.max(1, baseCount + delta);
  }

  const k = 0.4 + rng() * 1.0; // 0.4×..1.4×
  return Math.max(1, Math.round(baseCount * k));
}

/**
 * 未开售车次的起售时刻（HH:mm）。
 * 按始发站查表；未覆盖的小站用 FNV-1a 取 fallback 时刻。
 */
export function getSaleTimeForStation(fromCode: string): string {
  return STATION_SALE_TIME[fromCode]
    ?? FALLBACK_SALE_TIMES[fnv1a(fromCode) % FALLBACK_SALE_TIMES.length];
}

/**
 * 指定日期是否尚未开始售票（超出预售期）。
 * 返回 true 时，调用方应将所有席别 count 置 0 并填入 saleTime。
 */
export function isBeforePresale(dateStr: string): boolean {
  return daysFromToday(dateStr) > PRESALE_DAYS;
}
