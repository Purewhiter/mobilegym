/**
 * 离线 catalog 查询服务。
 *
 * 数据源：apps/Railway12306/data/catalog/trainCatalog.json
 *   - 离线车次 catalog 数据，供前端和 bench_env 复用。
 *   - availability: 以 `${trainCode}|${fromCode}|${toCode}` 为键，含 seatTypes /
 *     count / price / berthPrices / discount / canWaitlist / exchangeable / saleTime。
 *   - trains:  以 trainCode 为键，含内部 trainNo 与经停 stops[]。
 *   - transferPlans: 以 `${fromCityCode}|${toCityCode}` 为键。
 *   - cityStations: 城市 → 所属站点名列表（用于城市级展开）。
 *
 * 查询路径：`trainService.queryDirectTrains` / `queryTransferPlans` 会优先调用此模块，
 * 找不到数据再落到真实 API（railwayApi）。
 */

import type { TrainInfo, SeatInfo, TrainType, TransferPlan, BerthPrice } from '../types';
import { getToday, getDate } from '../../../os/TimeService';
import { generateSeatCount, getSaleTimeForStation, isBeforePresale } from './availabilityGenerator';

interface CatalogEntry {
  trainCode: string;
  fromCode: string;
  toCode: string;
  fromStationNo: string;
  toStationNo: string;
  startTime: string;
  arriveTime: string;
  lishi: string;
  seatTypes: string[];
  availability: Record<string, number>;
  prices: Record<string, number>;
  canWaitlist: boolean;
  exchangeable: boolean;
  discount?: Record<string, number>;
  berthPrices?: Record<string, BerthPrice[]>;
  saleTime?: string;
}

interface CatalogTrain {
  trainNo: string;
  /** 始发站「三字母码」（JSON 字段名历史沿用 fromStation，实际存的是 code，如 VNP） */
  fromStation: string;
  /** 终到站「三字母码」（同上，实际是 code，如 AOH） */
  toStation: string;
  stops: { station: string; arr: string | null; dep: string | null; day: number }[];
  seatTypes: string[];
  lishi: string;
}

interface CatalogTransferLeg {
  trainCode: string;
  trainNo: string;
  fromStation: string;
  toStation: string;
  fromCode: string;
  toCode: string;
  startTime: string;
  arriveTime: string;
  lishi: string;
  dayDifference: string;
}

interface CatalogTransferPlan {
  fromStation: string;
  toStation: string;
  middleStation: string;
  startTime: string;
  arriveTime: string;
  totalLishi: string;
  totalMinutes: number;
  waitMinutes: number;
  sameStation: boolean;
  legs: CatalogTransferLeg[];
}

interface CatalogJson {
  meta: { crawledAt: string; date: string; cities: string[]; source: string };
  stationCodeMap: Record<string, string>;
  cityStations: Record<string, string[]>;
  trains: Record<string, CatalogTrain>;
  availability: Record<string, CatalogEntry>;
  transferPlans: Record<string, CatalogTransferPlan[]>;
}

let _catalog: CatalogJson | null = null;
let _loadPromise: Promise<void> | null = null;

// 反查：stationName → stationCode[]；可能一名多码（实际无，但防御）。
let _nameToCodes: Map<string, string[]> | null = null;
// 按 OD 组织：`${fromCode}|${toCode}` → entries[]
let _byOD: Map<string, CatalogEntry[]> | null = null;

export function loadCatalog(): Promise<void> {
  if (_catalog) return Promise.resolve();
  if (!_loadPromise) {
    _loadPromise = (async () => {
      try {
        const mod = await import('../data/catalog/trainCatalog.json');
        _catalog = (mod.default ?? (mod as unknown)) as unknown as CatalogJson;
        buildIndexes(_catalog);
      } catch (e) {
        // 加载失败时清除缓存的 Promise，允许下次查询重试（否则 rejected Promise 会让 catalog 永久失效）。
        _loadPromise = null;
        throw e;
      }
    })();
  }
  return _loadPromise;
}

function buildIndexes(c: CatalogJson) {
  _nameToCodes = new Map();
  for (const [code, name] of Object.entries(c.stationCodeMap)) {
    const arr = _nameToCodes.get(name) ?? [];
    if (!arr.includes(code)) arr.push(code);
    _nameToCodes.set(name, arr);
  }

  _byOD = new Map();
  for (const e of Object.values(c.availability)) {
    const key = `${e.fromCode}|${e.toCode}`;
    const arr = _byOD.get(key) ?? [];
    arr.push(e);
    _byOD.set(key, arr);
  }
}

/**
 * 判断一个站名/城市名是否属于已爬取的 22 个城市。
 * 当 fromName 和 toName 都属于爬取城市时，catalog 对该 OD 就是权威的——
 * 没有条目意味着当天真的没车，不应再去请求真实 API。
 */
function isCrawledCity(name: string): boolean {
  if (!_catalog) return false;
  if (_catalog.meta.cities.includes(name)) return true;
  for (const stations of Object.values(_catalog.cityStations)) {
    if (stations.includes(name)) return true;
  }
  return false;
}

/**
 * 输入站名/城市名 → 该名所在城市的全部站码（含城市自身码）。
 *
 * 真实 12306 APP 即使选择具体站（如"上海南"），也会返回整个城市（"上海"）出发/到达
 * 的全部车次——站名只是城市的一个别名。此函数复刻该语义：具体站 → 扩展到所属城市的
 * 全部站码；城市 → 展开所属站点。
 */
function resolveStationCodes(name: string): string[] {
  if (!_catalog || !_nameToCodes) return [];
  const key = name.trim();
  if (!key) return [];
  const c = _catalog;
  const out: string[] = [];
  const push = (code: string) => {
    if (code && !out.includes(code)) out.push(code);
  };
  const expandCityStations = (stations: string[]) => {
    for (const sn of stations) {
      for (const code of _nameToCodes!.get(sn) ?? []) push(code);
    }
  };

  // 1) key 本身是城市 → 直接展开
  if (c.cityStations[key]) {
    expandCityStations(c.cityStations[key]);
  } else {
    // 2) key 是具体站 → 反查所属城市，展开整个城市的站
    for (const [city, stations] of Object.entries(c.cityStations)) {
      if (stations.includes(key)) {
        expandCityStations(stations);
        for (const code of _nameToCodes.get(city) ?? []) push(code);
      }
    }
  }
  // 3) 兜底：key 自身（未挂到任何城市的孤立站名，如某些小站）
  for (const code of _nameToCodes.get(key) ?? []) push(code);
  return out;
}

/**
 * 输入站名/城市名 → 该名所属城市的城市级站码集合。
 * 例如 '北京南' → ['BJP']；'北京' → ['BJP']；未知名 → []。
 *
 * 用于 transferPlans 查询——该索引的 key 是按"北京↔上海"这种城市对建立的城市码，
 * 具体站名必须先归一到城市码才能命中。
 */
function resolveCityCodes(name: string): string[] {
  if (!_catalog || !_nameToCodes) return [];
  const key = name.trim();
  if (!key) return [];
  const c = _catalog;

  const cityNames: string[] = [];
  if (c.cityStations[key]) {
    cityNames.push(key);
  } else {
    for (const [city, stations] of Object.entries(c.cityStations)) {
      if (stations.includes(key)) cityNames.push(city);
    }
  }

  const out: string[] = [];
  for (const city of cityNames) {
    for (const code of _nameToCodes.get(city) ?? []) {
      if (!out.includes(code)) out.push(code);
    }
  }
  return out;
}

/**
 * 若查询日 === 模拟今天，返回当前 "HH:mm" 作为过滤阈值；否则返回 null。
 *
 * 真实 12306 leftTicket API 对"今天"的查询只返回 startTime > now 的车次
 * （已发车的被过滤掉）；对未来日期则返回全天完整时刻表。此函数用于复刻该语义。
 *
 * 时区：catalog 的 `HH:mm` 是 12306 北京时间字符串；模拟器 StatusBar 的
 * formatTime() 同样用 getHours()/getMinutes() 本地访问器。两者对齐即可，
 * 这里也走本地访问器直接比较字符串。
 */
function todayCutoffHHmm(date: string): string | null {
  if (date !== getToday()) return null;
  const d = getDate();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/**
 * 12306 车次号首字符 → TrainType。非 GDCKZT 的（如 `1461`/`Y701`/`L`/`S`）
 * 归一为 'T'（普通客车类别），与筛选面板"只看普通车"语义一致，避免 unsafe cast。
 *
 * 导出供 trainService.parseTicketResult 复用——API 路径同样会遇到非法首字符。
 */
export function normalizeTrainType(trainCode: string): TrainType {
  const c = trainCode.charAt(0).toUpperCase();
  if (c === 'G' || c === 'D' || c === 'C' || c === 'K' || c === 'Z' || c === 'T') return c;
  return 'T';
}

// ─── seatKey 映射 ──────────────────────────────────────────────────

/**
 * catalog 中 seatKey → 简化席别名（与 parseTicketResult 保持一致）。
 * 注意：数据快照中的 `premiumSeat` 实际对应 12306 `tz_num`（特等座 'P'），
 * 与 `specialSeat` 同义——两个 key 都映射到 '特等'。
 */
const SEAT_KEY_TO_NAME: Record<string, string> = {
  businessSeat: '商务',
  specialSeat: '特等',
  premiumSeat: '特等',
  firstClass: '一等',
  secondClass: '二等',
  highSoftSleeper: '高软',
  softSleeper: '软卧',
  hardSleeper: '硬卧',
  softSeat: '软座',
  hardSeat: '硬座',
  noSeat: '无座',
  motionSleeper: '动卧',
  highMotionSleeper: '高级动卧',
  firstSleeper: '一等卧',
  secondSleeper: '二等卧',
  preferredFirstClass: '优选一等',
};

/** seatKey → 席别码（用于查 RATE_MAP） */
const SEAT_KEY_TO_CODE: Record<string, string> = {
  businessSeat: '9',
  specialSeat: 'P',
  premiumSeat: 'P',
  firstClass: 'M',
  secondClass: 'O',
  highSoftSleeper: '6',
  softSleeper: '4',
  hardSleeper: '3',
  softSeat: '2',
  hardSeat: '1',
  noSeat: 'W',
  motionSleeper: 'F',
  highMotionSleeper: 'A',
  firstSleeper: 'I',
  secondSleeper: 'J',
  preferredFirstClass: 'D',
};

/** 席别码 → 排序权重（数字越小越靠前，与 trainService SEAT_TYPE_RATE_MAP 对齐） */
const SEAT_CODE_RATE: Record<string, number> = {
  '9': 10, 'P': 12, 'M': 14, 'O': 16, '6': 18, '4': 20, '3': 21,
  '2': 22, '1': 23, 'F': 31, 'A': 101, 'I': 34, 'J': 35, 'D': 29, 'W': 100,
};

// ─── catalog entry → TrainInfo ─────────────────────────────────────

function entryToTrainInfo(e: CatalogEntry, date: string): TrainInfo | null {
  if (!_catalog) return null;
  const train = _catalog.trains[e.trainCode];
  if (!train) return null;

  const beforePresale = isBeforePresale(date);

  const raw = e.seatTypes.map(key => {
    const code = SEAT_KEY_TO_CODE[key] ?? '';
    const baseCount = e.availability[key] ?? 0;
    const count = beforePresale
      ? 0
      : generateSeatCount(baseCount, e.trainCode, e.fromCode, e.toCode, date, key);
    return {
      key,
      rate: SEAT_CODE_RATE[code] ?? 50,
      count,
      price: e.prices[key] ?? 0,
      isNone: key === 'noSeat',
    };
  });

  raw.sort((a, b) => a.rate - b.rate);
  raw.sort((a, b) => {
    const pa = a.isNone ? 100000 : a.price;
    const pb = b.isNone ? 100000 : b.price;
    return pa - pb;
  });

  const seats: SeatInfo[] = raw.map(s => {
    // catalog count: -1 = 充足(≥3000), 0 = 无票, 正数 = 精确余票
    const count = s.count === -1 ? Infinity : (s.count <= 0 ? 0 : s.count);
    const canWaitlist = count === 0 && !s.isNone && e.canWaitlist;
    const info: SeatInfo = {
      type: SEAT_KEY_TO_NAME[s.key] ?? s.key,
      count,
      price: s.price,
      canWaitlist,
    };
    if (e.discount?.[s.key] !== undefined) info.discount = e.discount[s.key];
    if (e.berthPrices?.[s.key]?.length) info.berthPrices = e.berthPrices[s.key];
    return info;
  });

  const trainType = normalizeTrainType(e.trainCode);
  const tags: string[] = [];
  if (trainType === 'G' || trainType === 'D') tags.push('复兴号');
  const quiet = tags.includes('复兴号');

  let duration = '未知';
  if (e.lishi && e.lishi.includes(':')) {
    const [h, m] = e.lishi.split(':').map(Number);
    duration = `${h}小时${m}分`;
  }

  const fromName = _catalog.stationCodeMap[e.fromCode] ?? e.fromCode;
  const toName = _catalog.stationCodeMap[e.toCode] ?? e.toCode;

  const fromType: '始' | '过' = train.fromStation === e.fromCode ? '始' : '过';
  const toType: '终' | '过' = train.toStation === e.toCode ? '终' : '过';

  const nextDay = e.arriveTime < e.startTime || e.arriveTime === '00:00';

  const info: TrainInfo = {
    trainNo: e.trainCode,
    trainNoInternal: train.trainNo,
    trainType,
    fromStation: fromName,
    toStation: toName,
    departTime: e.startTime,
    arriveTime: e.arriveTime,
    duration,
    nextDay,
    fromType,
    toType,
    tags,
    exchangeable: e.exchangeable,
    quiet,
    seats,
  };
  if (beforePresale) info.saleTime = getSaleTimeForStation(e.fromCode);
  return info;
}

/**
 * 查直达车次（catalog）。
 * 返回 null 表示 catalog 未覆盖该 OD（应落到真实 API）；
 * 返回 [] 表示覆盖但确实没有车次（不应再请求 API）。
 */
export function queryDirectFromCatalog(fromName: string, toName: string, date: string): TrainInfo[] | null {
  if (!_catalog || !_byOD) return null;
  // 只有两端都属于已爬取的城市，catalog 才对该 OD 权威。
  if (!isCrawledCity(fromName) || !isCrawledCity(toName)) return null;

  const fromCodes = resolveStationCodes(fromName);
  const toCodes = resolveStationCodes(toName);

  const cutoff = todayCutoffHHmm(date);
  const results: TrainInfo[] = [];
  // 同一趟车在同城不同上车站各自作为独立行返回（实测 12306 leftTicket 行为：
  // 如 D2212 会同时返回 EGH/IMH/AOH 三条），不做按 trainCode 去重。
  for (const fc of fromCodes) {
    for (const tc of toCodes) {
      const entries = _byOD.get(`${fc}|${tc}`);
      if (!entries) continue;
      for (const e of entries) {
        // 真实 API 只返回"当前时刻之后"出发的车次，复刻该语义
        if (cutoff !== null && e.startTime <= cutoff) continue;
        const t = entryToTrainInfo(e, date);
        if (t) results.push(t);
      }
    }
  }
  return results;
}

// ─── transfer 解析 ────────────────────────────────────────────────

/** 某 leg 的 trainCode+fromCode+toCode → seats（从 availability 里复用，按日期生成余票） */
function legSeats(trainCode: string, fromCode: string, toCode: string, date: string): SeatInfo[] {
  if (!_byOD) return [];
  const entries = _byOD.get(`${fromCode}|${toCode}`);
  if (!entries) return [];
  const hit = entries.find(e => e.trainCode === trainCode);
  if (!hit) return [];
  const t = entryToTrainInfo(hit, date);
  return t ? t.seats : [];
}

function legToTransferLeg(leg: CatalogTransferLeg, date: string): TransferPlan['leg1'] {
  const trainType = normalizeTrainType(leg.trainCode);
  return {
    trainNo: leg.trainCode,
    trainType,
    fromStation: leg.fromStation,
    toStation: leg.toStation,
    departTime: leg.startTime,
    arriveTime: leg.arriveTime,
    quiet: trainType === 'G' || trainType === 'D',
    exchangeable: false,
    seats: legSeats(leg.trainCode, leg.fromCode, leg.toCode, date),
  };
}

/**
 * 查中转方案（catalog）。
 * null = 未覆盖该 OD（上层应落到真实 API）；
 * [] = 覆盖但当天无中转方案（不应再请求 API）。
 *
 * catalog.transferPlans 是按「城市对」爬的（目前 5 条：BJP|SHH / SHH|NJH /
 * NJH|SHH / HZH|SHH / GZQ|SZQ），key 是两城市的「主站码」，而不是任意具体站码。
 *
 * 权威判定（比直达严格）：
 *   1) 两端站名/城市名能归一到城市码（resolveCityCodes）；
 *   2) `${fromCityCode}|${toCityCode}` 存在于 transferPlans（= 爬取过这条线路）。
 * 只有同时满足才算覆盖；否则返回 null 让上层落 API，避免把"22 城内但未爬取的中转线路"
 * 误判为"确实没有中转方案"。
 */
export function queryTransferFromCatalog(fromName: string, toName: string, date: string): TransferPlan[] | null {
  if (!_catalog) return null;

  const fromCityCodes = resolveCityCodes(fromName);
  const toCityCodes = resolveCityCodes(toName);
  if (fromCityCodes.length === 0 || toCityCodes.length === 0) return null;

  const cutoff = todayCutoffHHmm(date);
  let covered = false;
  const results: TransferPlan[] = [];
  for (const fc of fromCityCodes) {
    for (const tc of toCityCodes) {
      const key = `${fc}|${tc}`;
      const plans = _catalog.transferPlans[key];
      if (!plans) continue;
      for (const p of plans) {
        if (p.legs.length < 2) continue;
        // 只有解析出合法 plan 才算真正覆盖，避免"key 存在但 plans 全是坏数据"
        // 被静默当成"当天确实无中转方案"。坏数据一律交给上层 API fallback。
        covered = true;
        // leg1 已发车则整个方案作废（旅客已赶不上第一程），与真实 API 一致
        if (cutoff !== null && p.legs[0].startTime <= cutoff) continue;
        results.push({
          totalDuration: p.totalLishi,
          transferStation: p.middleStation,
          leg1: legToTransferLeg(p.legs[0], date),
          leg2: legToTransferLeg(p.legs[1], date),
        });
      }
    }
  }
  return covered ? results : null;
}

/** 诊断用 */
export function getCatalogMeta(): CatalogJson['meta'] | null {
  return _catalog?.meta ?? null;
}
