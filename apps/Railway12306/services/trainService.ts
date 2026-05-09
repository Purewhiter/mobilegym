/**
 * 列车查询服务。
 *
 * 数据来源优先级：
 *   1. 离线 catalog（catalogService）—— 覆盖 22 个城市、100+ 车站的真实 12306 快照
 *   2. 真实 12306 API（railwayApi）—— catalog 未覆盖时联网
 *
 * catalog 已是主力数据源，bench 任务的 OD 都落在覆盖范围内；
 * 两条路径都失败时直接返回空列表，由上层 UI 呈现"无车次"。
 */

import { initSession, queryTickets, queryTransfer, isSessionValid, type TicketQueryResult, type TransferQueryResult } from './railwayApi';
import { getStationCode, getStationName } from './stationService';
import { loadCatalog, queryDirectFromCatalog, queryTransferFromCatalog, normalizeTrainType } from './catalogService';
import type { TrainInfo, SeatInfo, TransferPlan, BerthPrice } from '../types';
import { getAllStations } from '../data/stations';
import type { Station } from '../data/stations';

export interface TrainFilter {
  onlyHighSpeed?: boolean;   // 只看高铁/动车
  onlyRegular?: boolean;     // 只看普通车
  onlyAvailable?: boolean;   // 只看有票
  stationFilter?: string;    // 按出发/到达站筛选（旧版，保留兼容）
  // 高级筛选（筛选面板）
  trainGroupTypes?: string[];   // 车组类型: 'fux' | 'smart' | 'dynamic'
  seatTypes?: string[];         // 席别类型名称: '商务座' | '一等座' 等
  fromStations?: string[];      // 出发站名
  toStations?: string[];        // 到达站名
  onlyDepartureStation?: boolean; // 只看始发
  onlyTerminalStation?: boolean;  // 只看终到
  depTimeRanges?: number[];     // 出发时间段索引 (0-3)
  arrTimeRanges?: number[];     // 到达时间段索引 (0-3)
}

export type SortMode = 'default' | 'duration' | 'duration_desc' | 'depart' | 'depart_desc' | 'price' | 'price_desc';

// ─── 筛选面板常量 ──────────────────────────────────────────────────

/** 席别筛选选项（和真实 12306 筛选面板一致） */
export const SEAT_FILTER_OPTIONS = [
  '硬座无座', '二等座无座', '商务座',
  '一等座', '二等座', '高级软卧',
  '软卧', '硬卧', '硬座',
  '优选一等', '一等卧', '二等卧',
];

/** 席别筛选选项 → 匹配的座位类型名称 */
export const SEAT_FILTER_MAP: Record<string, string[]> = {
  '硬座无座': ['硬座', '无座'],
  '二等座无座': ['二等', '无座'],
  '商务座': ['商务'],
  '一等座': ['一等'],
  '二等座': ['二等'],
  '高级软卧': ['高软'],
  '软卧': ['软卧'],
  '硬卧': ['硬卧'],
  '硬座': ['硬座'],
  '优选一等': ['优选一等'],
  '一等卧': ['一等卧'],
  '二等卧': ['二等卧'],
};

/** 出发/到达时间段 */
export const TIME_RANGES = [
  { label: '00:00-06:00', name: '凌晨' },
  { label: '06:00-12:00', name: '上午' },
  { label: '12:00-18:00', name: '下午' },
  { label: '18:00-24:00', name: '晚上' },
];

/** 判断时间是否在指定时间段内 */
function isTimeInRange(time: string, rangeIdx: number): boolean {
  const ranges = [['00:00', '06:00'], ['06:00', '12:00'], ['12:00', '18:00'], ['18:00', '24:00']];
  const [start, end] = ranges[rangeIdx];
  return time >= start && time < end;
}

// ─── 直达车次查询（支持真实 API） ──────────────────────────────────

export interface QueryDirectResult {
  trains: TrainInfo[];
}

/**
 * 查询直达车次。优先 catalog → 未覆盖才联网 → 两者都失败返回空。
 */
export async function queryDirectTrains(
  fromName: string,
  toName: string,
  date: string,
): Promise<QueryDirectResult> {
  // 1) 离线 catalog
  try {
    await loadCatalog();
    const hit = queryDirectFromCatalog(fromName, toName, date);
    if (hit !== null) {
      console.log(`[trainService] 直达查询 ${fromName}→${toName} @${date} 数据源=离线catalog 车次=${hit.length}`);
      return { trains: hit };
    }
  } catch (e) {
    console.warn('[trainService] catalog 加载失败，尝试真实 API:', e instanceof Error ? e.message : e);
  }

  // 2) 真实 API
  try {
    const fromCode = getStationCode(fromName);
    const toCode = getStationCode(toName);
    if (fromCode && toCode) {
      await initSession();
      const apiResult = await queryTickets(date, fromCode, toCode, false);
      const trains = parseTicketResult(apiResult);
      console.log(`[trainService] 直达查询 ${fromName}→${toName} @${date} 数据源=在线API 车次=${trains.length}`);
      return { trains };
    }
  } catch (e) {
    console.warn('[trainService] API 查询失败，返回空:', e instanceof Error ? e.message : e);
  }

  return { trains: [] };
}

/**
 * 查询中转方案。优先 catalog → 未覆盖才联网 → 两者都失败返回空。
 */
export async function queryTransferPlans(
  fromName: string,
  toName: string,
  date: string,
): Promise<TransferPlan[]> {
  // 1) 离线 catalog
  try {
    await loadCatalog();
    const hit = queryTransferFromCatalog(fromName, toName, date);
    if (hit !== null) {
      console.log(`[trainService] 中转查询 ${fromName}→${toName} @${date} 数据源=离线catalog 方案=${hit.length}`);
      return hit;
    }
  } catch (e) {
    console.warn('[trainService] catalog 加载失败，尝试真实 API:', e instanceof Error ? e.message : e);
  }

  // 2) 真实 API
  try {
    const fromCode = getStationCode(fromName);
    const toCode = getStationCode(toName);
    if (fromCode && toCode) {
      await initSession();
      const apiResult = await queryTransfer(date, fromCode, toCode, '', false);
      const plans = parseTransferResult(apiResult);
      console.log(`[trainService] 中转查询 ${fromName}→${toName} @${date} 数据源=在线API 方案=${plans.length}`);
      return plans;
    }
  } catch (e) {
    console.warn('[trainService] 中转 API 查询失败，返回空:', e instanceof Error ? e.message : e);
  }

  return [];
}

// ─── 字段解析（57 字段解析规则） ──────────────────────────────────────

/**
 * 解析 12306 余票查询返回的结果。
 *
 * data.result 中每条用 | 分隔约 58 个字段（实测 2026-03 长沙→武汉）。
 * 完整字段索引表（空白项省略）：
 *
 *   [ 0] secret_str       — URL-encoded 密钥，用于提交订单
 *   [ 1] button_text_info — "预订" / "候补" 等按钮文案
 *   [ 2] train_no         — 内部编号（如 65000K16560H），用于调用 queryTicketPrice 等 API
 *   [ 3] station_train_code — 显示车次号（如 K1656）
 *   [ 4] start_station    — 始发站码
 *   [ 5] end_station      — 终到站码
 *   [ 6] from_station     — 出发站码（乘车区间）
 *   [ 7] to_station       — 到达站码
 *   [ 8] start_time       — 发车时间 HH:mm
 *   [ 9] arrive_time      — 到达时间 HH:mm
 *   [10] lishi            — 历时 HH:mm（如 04:13）
 *   [11] canWebBuy        — 是否可购买（Y / N / IS_TIME_NOT_BUY）
 *   [12] yp_info          — 旧版价格编码
 *   [13] start_train_date — 列车始发日期 yyyyMMdd
 *   [14] train_seat_feature — 座位特征码
 *   [15] location_code    — 位置码
 *   [16] from_station_no  — 出发站序号（经停站索引）
 *   [17] to_station_no    — 到达站序号
 *   [18] is_support_card  — 是否支持身份证
 *   [19] controlled_train_flag — 管控标志
 *   [20] gg_num           — ?
 *   [21] gr_num           — 高级软卧余票
 *   [22] qt_num           — 其他
 *   [23] rw_num           — 软卧余票（"有" / "无" / 数字）
 *   [24] rz_num           — 软座余票
 *   [25] tz_num           — 特等座
 *   [26] wz_num           — 无座余票
 *   [27] yb_num           — ?
 *   [28] yw_num           — 硬卧余票
 *   [29] yz_num           — 硬座余票
 *   [30] ze_num           — 二等座余票
 *   [31] zy_num           — 一等座余票
 *   [32] swz_num          — 商务座余票
 *   [33] srrb_num         — 动卧余票
 *   [34] yp_ex            — 扩展信息，如 "104030W0"
 *   [35] seat_types        — 可售席别码串（如 "1431" = 硬座/软卧/硬卧/无座(W)）
 *   [36] exchange_train_flag — 积分兑换标志（1=可兑换）
 *   [37] houbu_train_flag  — 候补购票标志（1=支持候补）
 *   [39] yp_info_cover     — 价格编码（每 10 字符一组，主解析源）
 *   [40] houbu_flag        — 候补整体标志（0 或 1）
 *   [45] 未知标志
 *   [46] houbu_detail      — 候补详情，格式: part0#part1#...#z#partN#<候补席别码串>#z
 *   [49] 列车标签（CHN,CHN 等）
 *   [52] 服务标志
 *   [53] berth_price_info  — 铺位分价信息（每 7 字符一组）
 *   [54] discount_info     — 折扣信息（每 5 字符一组）
 *   [55] sale_datetime     — 开售时间 yyyyMMddHHmm
 *   [56] is_new_flag       — 新列车标志
 */
function parseTicketResult(result: TicketQueryResult): TrainInfo[] {
  const trains: TrainInfo[] = [];
  const stationMap = result.map;

  for (const line of result.result) {
    try {
      const parts = line.split('|');
      if (parts.length < 34) continue;

      const trainCode = parts[3];
      const fromCode = parts[6];
      const toCode = parts[7];
      const departTime = parts[8];
      const arriveTime = parts[9];
      const durationStr = parts[10];

      const fromName = stationMap[fromCode] || getStationName(fromCode) || fromCode;
      const toName = stationMap[toCode] || getStationName(toCode) || toCode;

      // 判断始/终/过
      const fromType = parts[4] === parts[6] ? '始' : '过';
      const toType = parts[5] === parts[7] ? '终' : '过';

      // 车次类型（首字母）；非 GDCKZT（如 1461/Y701）归一为 T 以避免非法联合类型值
      const trainType = normalizeTrainType(trainCode);

      // 解析铺位分价 [53]、折扣 [54]
      const berthPriceMap = parseBerthPrices(parts[53]);
      const discountMap = parseDiscountInfo(parts[54]);

      // 余票和价格
      const seats = parseSeatInfo(parts, trainCode);

      // 将铺位分价、折扣、候补信息合并到 seats
      for (const seat of seats) {
        // 查找席别码
        const seatCode = getSeatTypeCode(seat.type);

        // 铺位分价
        if (seatCode && berthPriceMap[seatCode]) {
          seat.berthPrices = berthPriceMap[seatCode];
        }

        // 折扣信息（取该席别的最大折扣值，无铺位区分时 berthCode='0'）
        if (seatCode && discountMap[seatCode]) {
          seat.discount = discountMap[seatCode];
        }

        // 候补资格
        // 真实 12306 逻辑：houbu_train_flag=1 → 该车次支持候补，
        // 所有售罄的非无座席别均可候补。field [46] 仅为补充信息，不作为唯一判据。
        if (seat.count <= 0 && seat.type !== '无座') {
          seat.canWaitlist = parts[37] === '1';
        }
      }

      // 跨天判断
      const nextDay = arriveTime < departTime || arriveTime === '00:00';

      // 标签和特性
      const tags = inferTags(trainCode, parts);
      const quiet = tags.includes('复兴号');
      // [36] exchange_train_flag: 1 = 可积分兑换
      const exchangeable = parts[36] === '1';

      // 解析 duration (HH:MM 格式)
      let durationText = '未知';
      if (durationStr && durationStr.includes(':')) {
        const [h, m] = durationStr.split(':').map(Number);
        durationText = `${h}小时${m}分`;
      }

      // 解析 [55] sale_datetime（起售时间，格式 yyyyMMddHHmm）
      // canWebBuy='IS_TIME_NOT_BUY' 是 API 明确标识"尚未起售"的信号
      let saleTime: string | undefined;
      const saleDatetime = parts[55];
      const canWebBuy = parts[11];
      if (saleDatetime && saleDatetime.length >= 12 && canWebBuy === 'IS_TIME_NOT_BUY') {
        const hh = saleDatetime.substring(8, 10);
        const mm = saleDatetime.substring(10, 12);
        saleTime = `${hh}:${mm}`;
      }

      trains.push({
        trainNo: trainCode,
        trainNoInternal: parts[2],
        trainType,
        fromStation: fromName,
        toStation: toName,
        departTime,
        arriveTime,
        duration: durationText,
        nextDay,
        fromType,
        toType,
        tags,
        exchangeable,
        quiet,
        seats,
        saleTime,
      });
    } catch {
      // 某条数据解析失败，继续下一条
      continue;
    }
  }

  return trains;
}

/**
 * 解析 [53] berth_price_info — 铺位分价。
 *
 * 格式：每 7 字符一组 <席别码:1><铺位码:1><价格:5>
 *   - 席别码: '3'=硬卧, '4'=软卧, 'I'=一等卧, 'J'=二等卧 等
 *   - 铺位码: 1=下铺(最贵), 2=中铺, 3=上铺(最便宜)
 *   - 价格:   5 位数字，实际价格 = 值 / 10（单位：元）
 *
 * 示例: "43015254101585330099531010753201045"
 *   → 软卧上铺 ¥152.5, 软卧下铺 ¥158.5, 硬卧上铺 ¥99.5, 硬卧下铺 ¥107.5, 硬卧中铺 ¥104.5
 */
function parseBerthPrices(raw: string | undefined): Record<string, BerthPrice[]> {
  const result: Record<string, BerthPrice[]> = {};
  if (!raw || raw.length < 7) return result;

  const BERTH_NAMES: Record<string, '上铺' | '中铺' | '下铺'> = {
    '1': '下铺', '2': '中铺', '3': '上铺',
  };

  for (let i = 0; i + 7 <= raw.length; i += 7) {
    const seatCode = raw[i];
    const berthCode = raw[i + 1];
    const priceRaw = parseInt(raw.substring(i + 2, i + 7), 10);
    if (isNaN(priceRaw)) continue;

    const position = BERTH_NAMES[berthCode];
    if (!position) continue;

    if (!result[seatCode]) result[seatCode] = [];
    result[seatCode].push({ position, price: priceRaw / 10 });
  }

  // 按价格从低到高排序（上铺最便宜在前）
  for (const code in result) {
    result[code].sort((a, b) => a.price - b.price);
  }

  return result;
}

/**
 * 解析 [54] discount_info — 折扣信息。
 *
 * 格式：每 5 字符一组 <席别码:1><铺位码:1><pad:1><折扣率:2>
 *   - 席别码: '1'=硬座, 'W'=无座, 'O'=二等座, 'J'=二等卧 等
 *   - 铺位码: '0'=无铺位, '1'=下铺, '2'=中铺, '3'=上铺
 *   - pad:    填充位
 *   - 折扣率: 2 位数字，如 80=8折, 65=6.5折
 *
 * 无条目的席别表示全价（无折扣）。
 *
 * 示例: "10080W0080" → 硬座 8折, 无座 8折
 * 示例: "J3065J1065J2066O0065" → 二等卧各铺 6.5/6.6折, 二等座 6.5折
 */
function parseDiscountInfo(raw: string | undefined): Record<string, number> {
  const result: Record<string, number> = {};
  if (!raw || raw.length < 5) return result;

  for (let i = 0; i + 5 <= raw.length; i += 5) {
    const seatCode = raw[i];
    const discount = parseInt(raw.substring(i + 3, i + 5), 10);
    if (isNaN(discount) || discount <= 0 || discount >= 100) continue;

    // 同一席别可能有多个铺位条目（取第一个即可，折扣率通常相同或接近）
    if (!result[seatCode]) {
      result[seatCode] = discount;
    }
  }

  return result;
}

/**
 * 解析 [46] houbu_detail — 提取可候补的席别码集合。
 *
 * 格式: "part0#part1#part2#part3#z#part4#<候补席别码串>#z"
 * 其中 <候补席别码串> 如 "43" 表示席别码 4(软卧) 和 3(硬卧) 可以候补。
 * 值为 "0" 表示无候补席别。
 *
 * 示例: "0#0#0#0#z#0#43#z" → Set {'4', '3'}
 */
function parseWaitlistSeatCodes(raw: string | undefined): Set<string> {
  const result = new Set<string>();
  if (!raw) return result;

  const fields = raw.split('#');
  // 候补席别码在第 7 个字段（index 6）
  if (fields.length >= 7) {
    const codes = fields[6];
    if (codes && codes !== '0') {
      for (const c of codes) {
        result.add(c);
      }
    }
  }
  return result;
}

/** 席别名称 → 12306 席别码的反向映射 */
function getSeatTypeCode(typeName: string): string | undefined {
  const map: Record<string, string> = {
    '硬座': '1', '软座': '2', '硬卧': '3', '软卧': '4',
    '高软': '6', '商务': '9', '动卧': 'F', '高级动卧': 'A',
    '一等卧': 'I', '二等卧': 'J', '一等': 'M', '二等': 'O',
    '特等': 'P', '优选一等': 'D', '无座': 'W',
  };
  return map[typeName];
}

/**
 * 解析席别信息（优先 yp_info_cover，fallback 到固定索引）。
 *
 * yp_info_cover 位于 parts[39]，是最准确的价格和余票数据源。
 * 如果缺失则 fallback 到 parts[20]-[33] 的固定索引字段。
 *
 * 注意：此函数只解析基础票价和余票数。
 * 铺位分价（[53]）、折扣（[54]）、候补资格（[46]）由调用方在 parseTicketResult 中合并。
 */
function parseSeatInfo(parts: string[], trainCode: string): SeatInfo[] {
  // 优先使用 yp_info_cover 解析（真实 12306 APP 的方式）
  // yp_info_cover 在 parts[39] 或附近，每 10 字符一组：
  //   [0]: 席别码, [1-5]: 价格(分/10), [6]: 余票标志位(>=3表示无座), [6-9]: 余票数
  const ypInfoCover = parts[39];
  if (ypInfoCover && ypInfoCover.length >= 10) {
    return parseFromYpInfoCover(ypInfoCover);
  }

  // fallback: 从固定索引解析
  return parseFromFixedIndex(parts);
}

/**
 * 从 yp_info_cover (parts[39]) 解析席别信息。
 *
 * 格式：每 10 字符一组：
 *   chars[0]     = 席别码（如 1=硬座, 3=硬卧, 4=软卧, O=二等座, M=一等座, 9=商务座, W=无座...）
 *   chars[1-5]   = 价格（parseFloat / 10 = 元），即执行票价（已含折扣）
 *   chars[6]     = 余票标志高位（parseInt >= 3 表示无座变体）
 *   chars[6-9]   = 余票数（parseInt，无座时实际余票 = 值 - 3000）
 *
 * 示例 K1656: "1004250021 4015250000 3009950000 1004253000"
 *   → 硬座 ¥42.5 余21张, 软卧 ¥152.5 余0张, 硬卧 ¥99.5 余0张, 无座 ¥42.5 余0张
 *
 * canWaitlist 在此处仅做初步设置（count<=0 且非无座），
 * 调用方会用 [46] houbu_detail 的精确候补席别码覆盖此值。
 */
function parseFromYpInfoCover(ypInfoCover: string): SeatInfo[] {
  const n = Math.floor(ypInfoCover.length / 10);
  const rawSeats: { typeId: string; type: string; typeRate: number; count: number; price: number; isNone: boolean }[] = [];

  for (let s = 0, c = 6, u = 10, l = 0, f = 1; s < n; s++, c += 10, u += 10, l += 10, f += 10) {
    const typeId = ypInfoCover.substring(l, f);
    let type: string;
    let typeRate: number;
    let count: number;
    let isNone = false;

    if (parseInt(ypInfoCover.substring(c, c + 1), 10) >= 3) {
      // 无座变体
      type = '无座';
      isNone = true;
      typeRate = 100; // 无座排最后
      count = parseInt(ypInfoCover.substring(c, u), 10) - 3000;
    } else {
      type = SEAT_TYPE_MAP[typeId] || typeId;
      typeRate = SEAT_TYPE_RATE_MAP[typeId] ?? 50;
      if (typeId === 'A') typeRate = 101; // 高级动卧排在无座后面
      count = parseInt(ypInfoCover.substring(c, u), 10);
    }

    const priceRaw = parseFloat(ypInfoCover.substring(f, c)) / 10;
    const price = isNaN(priceRaw) ? 0 : priceRaw;

    // 简化席别名称，保持列表展示稳定
    type = getSeatTypeSimple(type);

    rawSeats.push({ typeId, type, typeRate, count, price, isNone });
  }

  // 按 typeRate 排序，保持席别展示稳定
  rawSeats.sort((a, b) => a.typeRate - b.typeRate);
  // 再按价格排序，无座排最后
  rawSeats.sort((a, b) => {
    const pa = a.isNone ? 100000 : a.price;
    const pb = b.isNone ? 100000 : b.price;
    return pa - pb;
  });

  return rawSeats.map(s => ({
    type: s.type,
    count: s.count > 20 ? Infinity : (s.count <= 0 ? 0 : s.count),
    price: s.price,
    canWaitlist: s.count <= 0 && !s.isNone, // 余票为 0 且非无座 → 支持候补
  }));
}

/** 从固定索引解析（API 失败时的 fallback / mock 数据） */
function parseFromFixedIndex(parts: string[]): SeatInfo[] {
  const seats: SeatInfo[] = [];
  // 按 SEAT_TYPE_RATE_MAP 排序的顺序
  const seatEntries: [number, string][] = [
    [32, '商务'],  // 9 → rate 10
    [31, '一等'],  // M → rate 14
    [30, '二等'],  // O → rate 16
    [21, '高软'],  // 6 → rate 18
    [23, '软卧'],  // 4 → rate 20
    [28, '硬卧'],  // 3 → rate 21
    [24, '软座'],  // 2 → rate 22
    [29, '硬座'],  // 1 → rate 23
    [33, '动卧'],  // F → rate 31
    [26, '无座'],  // W → rate 100
  ];

  for (const [idx, seatType] of seatEntries) {
    const count = parseCount(parts[idx]);
    if (count === null) continue;
    const price = extractPriceFromYpInfoNew(parts, idx, seatType);
    seats.push({ type: seatType, count, price, canWaitlist: count === -1 });
  }

  return seats;
}

/** 12306 席别码 → 全称映射 */
const SEAT_TYPE_MAP: Record<string, string> = {
  '0': '棚车', '1': '硬座', '2': '软座', '3': '硬卧', '4': '软卧',
  '5': '包厢硬卧', '6': '高级软卧', '7': '一等软座', '8': '二等软座',
  '9': '商务座', 'A': '高级动卧', 'B': '混编硬座', 'C': '混编硬卧',
  'D': '优选一等座', 'E': '特等软座', 'F': '动卧', 'G': '高级软卧',
  'H': '一人软包', 'I': '一等卧', 'J': '二等卧', 'K': '混编软座',
  'L': '混编软卧', 'M': '一等座', 'O': '二等座', 'P': '特等座',
  'Q': '多功能座', 'S': '二等包座', 'W': '无座',
};

/** 12306 席别码 → 排序权重（数字越小越靠前） */
const SEAT_TYPE_RATE_MAP: Record<string, number> = {
  '9': 10, 'P': 12, 'M': 14, 'O': 16, '6': 18, '4': 20, '3': 21,
  '2': 22, '1': 23, '7': 24, '8': 25, 'A': 26, 'B': 27, 'C': 28,
  'D': 29, 'E': 30, 'F': 31, 'G': 32, 'H': 33, 'I': 34, 'J': 35,
  'K': 36, 'L': 37, 'Q': 38, 'S': 39, '5': 40, '0': 41,
};

/** 席别名称简化（和真实 12306 APP 一致） */
function getSeatTypeSimple(name: string): string {
  switch (name) {
    case '商务座': return '商务';
    case '特等座': return '特等';
    case '一等座': return '一等';
    case '二等座': return '二等';
    case '高级软卧': return '高软';
    case '优选一等座': return '优选一等';
    default: return name;
  }
}

/**
 * 解析余票数量字段（固定索引 fallback 用）。
 */
function parseCount(val: string): number | null {
  if (!val || val === '' || val === '*') return null;
  if (val === '有') return Infinity;
  if (val === '无') return 0;
  const num = parseInt(val, 10);
  if (!Number.isNaN(num)) return num;
  return null;
}

/**
 * 余票查询索引 → 席别码映射（用于从 yp_info_new 提取价格）
 */
const SEAT_IDX_TO_CODES: Record<number, string[]> = {
  29: ['A', '1'],       // 硬座
  28: ['3'],            // 硬卧
  30: ['O'],            // 二等座
  31: ['M'],            // 一等座
  32: ['9', 'P'],       // 商务座
  23: ['B', '4'],       // 软卧
  26: ['W'],            // 无座
  21: ['6'],            // 高级软卧
  24: ['2'],            // 软座
  33: ['F'],            // 动卧
};

const MOCK_PRICES: Record<string, number> = {
  '硬座': 189.5, '硬卧': 327.5, '软卧': 515.5, '软座': 300,
  '二等': 700, '一等': 1100, '商务': 2100, '高软': 800, '动卧': 600, '无座': 189.5,
};

/** 从 yp_info_new 提取价格（固定索引 fallback 用） */
function extractPriceFromYpInfoNew(parts: string[], seatIdx: number, seatType: string): number {
  const ypInfoNew = parts[39];
  if (ypInfoNew && ypInfoNew.length >= 10) {
    const targetCodes = SEAT_IDX_TO_CODES[seatIdx];
    if (targetCodes) {
      for (let i = 0; i + 10 <= ypInfoNew.length; i += 10) {
        const chunk = ypInfoNew.substring(i, i + 10);
        const code = chunk.charAt(0);
        if (targetCodes.includes(code)) {
          const priceRaw = parseInt(chunk.substring(1, 6), 10);
          if (!Number.isNaN(priceRaw) && priceRaw > 0) {
            return priceRaw / 10;
          }
        }
      }
    }
    // 无座 fallback 到二等座或硬座价格
    if (seatType === '无座') {
      for (const codes of [['O'], ['A', '1']]) {
        for (let i = 0; i + 10 <= ypInfoNew.length; i += 10) {
          const chunk = ypInfoNew.substring(i, i + 10);
          if (codes.includes(chunk.charAt(0))) {
            const priceRaw = parseInt(chunk.substring(1, 6), 10);
            if (!Number.isNaN(priceRaw) && priceRaw > 0) return priceRaw / 10;
          }
        }
      }
    }
  }
  return MOCK_PRICES[seatType] || 0;
}

function inferTags(trainCode: string, parts: string[]): string[] {
  const tags: string[] = [];
  if (trainCode.startsWith('G') || trainCode.startsWith('D')) {
    tags.push('复兴号');
  }
  if (trainCode.startsWith('K')) {
    // 普通列车
  }
  return tags;
}

/**
 * 解析中转查询结果。
 *
 * ⚠️ 当前尚未实现 12306 `middleList` 字段到 TransferPlan 的真实解析逻辑。
 * 抛错让 queryTransferPlans 的 catch 分支记录警告并返回空列表，避免静默
 * 返回假数据。
 */
function parseTransferResult(_result: TransferQueryResult): TransferPlan[] {
  throw new Error('parseTransferResult: 中转 API 解析未实现');
}

// ─── 过滤和排序 ──────────────────────────────────────────────────────

export function applyFilterAndSort(
  results: TrainInfo[],
  filter?: TrainFilter,
  sort?: SortMode,
): TrainInfo[] {
  let filtered = [...results];

  if (filter) {
    if (filter.onlyHighSpeed) {
      filtered = filtered.filter(t => ['G', 'D', 'C'].includes(t.trainType));
    }
    if (filter.onlyRegular) {
      filtered = filtered.filter(t => ['K', 'Z', 'T'].includes(t.trainType));
    }
    if (filter.onlyAvailable) {
      filtered = filtered.filter(t => t.seats.some(s => s.count > 0));
    }
    if (filter.stationFilter) {
      const sf = filter.stationFilter;
      filtered = filtered.filter(t => t.fromStation.includes(sf) || t.toStation.includes(sf));
    }
    // 高级筛选：车组类型（复兴号/智能动车/动感号）
    if (filter.trainGroupTypes && filter.trainGroupTypes.length > 0) {
      filtered = filtered.filter(t => {
        for (const gt of filter.trainGroupTypes!) {
          if (gt === 'fux' && t.tags.includes('复兴号')) return true;
          if (gt === 'smart' && t.tags.includes('智能动车')) return true;
          if (gt === 'dynamic' && t.tags.includes('动感号')) return true;
        }
        return false;
      });
    }
    // 高级筛选：席别类型
    if (filter.seatTypes && filter.seatTypes.length > 0) {
      filtered = filtered.filter(t => {
        for (const st of filter.seatTypes!) {
          const matchNames = SEAT_FILTER_MAP[st] || [st];
          if (t.seats.some(s => matchNames.some(mn => s.type.includes(mn)))) return true;
        }
        return false;
      });
    }
    // 高级筛选：出发车站
    if (filter.fromStations && filter.fromStations.length > 0) {
      filtered = filtered.filter(t => filter.fromStations!.includes(t.fromStation));
    }
    // 高级筛选：到达车站
    if (filter.toStations && filter.toStations.length > 0) {
      filtered = filtered.filter(t => filter.toStations!.includes(t.toStation));
    }
    // 高级筛选：只看始发
    if (filter.onlyDepartureStation) {
      filtered = filtered.filter(t => t.fromType === '始');
    }
    // 高级筛选：只看终到
    if (filter.onlyTerminalStation) {
      filtered = filtered.filter(t => t.toType === '终');
    }
    // 高级筛选：出发时间段
    if (filter.depTimeRanges && filter.depTimeRanges.length > 0) {
      filtered = filtered.filter(t => filter.depTimeRanges!.some(ri => isTimeInRange(t.departTime, ri)));
    }
    // 高级筛选：到达时间段
    if (filter.arrTimeRanges && filter.arrTimeRanges.length > 0) {
      filtered = filtered.filter(t => filter.arrTimeRanges!.some(ri => isTimeInRange(t.arriveTime, ri)));
    }
  }

  if (sort === 'price' || sort === 'price_desc') {
    // 售罄车次（无票且无候补）沉底，按发车时间排序
    const hasTicket = filtered.filter(t => isSoldOut(t) === false);
    const soldOut = filtered.filter(t => isSoldOut(t) === true);
    soldOut.sort((a, b) => a.departTime.localeCompare(b.departTime));
    if (sort === 'price') {
      hasTicket.sort((a, b) => getMinPrice(a) - getMinPrice(b));
    } else {
      hasTicket.sort((a, b) => getMinPrice(b) - getMinPrice(a));
    }
    filtered = [...hasTicket, ...soldOut];
  } else if (sort === 'duration') {
    filtered.sort((a, b) => parseDurationMinutes(a.duration) - parseDurationMinutes(b.duration));
  } else if (sort === 'duration_desc') {
    filtered.sort((a, b) => parseDurationMinutes(b.duration) - parseDurationMinutes(a.duration));
  } else if (sort === 'depart') {
    filtered.sort((a, b) => a.departTime.localeCompare(b.departTime));
  } else if (sort === 'depart_desc') {
    filtered.sort((a, b) => b.departTime.localeCompare(a.departTime));
  }

  return filtered;
}

function parseDurationMinutes(duration: string): number {
  const hourMatch = duration.match(/(\d+)小时/);
  const minMatch = duration.match(/(\d+)分/);
  return (hourMatch ? parseInt(hourMatch[1]) * 60 : 0) + (minMatch ? parseInt(minMatch[1]) : 0);
}

/** 判断车次是否全部售罄（无票且无候补） */
function isSoldOut(train: TrainInfo): boolean {
  return !train.seats.some(s => s.count > 0 || s.count === -1);
}

function getMinPrice(train: TrainInfo): number {
  // 优先取有票席别的最低价
  const availablePrices = train.seats.filter(s => s.count > 0 && s.price > 0).map(s => s.price);
  if (availablePrices.length > 0) return Math.min(...availablePrices);
  // 其次取候补席别的最低价
  const waitlistPrices = train.seats.filter(s => s.count === -1 && s.price > 0).map(s => s.price);
  if (waitlistPrices.length > 0) return Math.min(...waitlistPrices);
  const prices = train.seats.filter(s => s.price > 0).map(s => s.price);
  return prices.length > 0 ? Math.min(...prices) : Infinity;
}

// ─── 车站搜索（保留） ────────────────────────────────────────────────

export function searchStations(keyword: string): Station[] {
  if (!keyword.trim()) return [];
  const lower = keyword.toLowerCase().trim();
  return getAllStations().filter(
    s => s.name.includes(lower) || s.pinyin.startsWith(lower) || s.code.toLowerCase().startsWith(lower),
  );
}
