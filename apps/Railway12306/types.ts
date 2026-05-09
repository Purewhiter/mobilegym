// ─── 订单类型 ─────────────────────────────────────────────────────────

export interface TicketInfo {
  passengerName: string;
  ticketType: string;     // 成人票 | 学生票
  seatType: string;
  seatNo: string;
  price: number;
}

export interface OrderRecord {
  id: string;
  trainNo: string;
  fromStation: string;
  toStation: string;
  departTime: string;
  arriveTime: string;
  date: string;           // YYYY-MM-DD
  tickets: TicketInfo[];
  status: 'completed' | 'pending' | 'cancelled';
  createTime: string;     // ISO
  // 用户选了具体座位号但系统无法满足、自动改派后置 true。仅出现在 pending 单上,
  // 提交订单时由概率(根据余票数)决定。
  seatReassigned?: boolean;
  // 用户在未完成订单页点过"确定"后置 true,避免重复弹窗。
  seatReassignedAcked?: boolean;
}

/** 根据座位类型生成随机座位号 */
export function randomSeatNo(seatType: string): string {
  if (seatType === '无座') {
    const car = String(Math.floor(Math.random() * 16) + 1).padStart(2, '0');
    return `${car}车`;
  }

  if (seatType === '硬座') {
    const car = String(Math.floor(Math.random() * 18) + 1).padStart(2, '0');
    const seat = String(Math.floor(Math.random() * 118) + 1).padStart(3, '0');
    return `${car}车 ${seat}号`;
  }

  if (seatType.includes('卧')) {
    const isSoft = seatType.includes('软');
    const maxCar = isSoft ? 4 : 18;
    const maxBerth = isSoft ? 36 : 66;
    const car = String(Math.floor(Math.random() * maxCar) + 1).padStart(2, '0');
    const berth = String(Math.floor(Math.random() * maxBerth) + 1).padStart(3, '0');
    return `${car}车 ${berth}号`;
  }

  const car = String(Math.floor(Math.random() * 16) + 1).padStart(2, '0');
  let cols: string[];
  if (seatType.includes('商务')) cols = ['A', 'C', 'F'];
  else if (seatType.includes('一等')) cols = ['A', 'C', 'D', 'F'];
  else cols = ['A', 'B', 'C', 'D', 'F'];
  const row = String(Math.floor(Math.random() * 20) + 1).padStart(2, '0');
  const col = cols[Math.floor(Math.random() * cols.length)];
  return `${car}车 ${row}${col}号`;
}

/**
 * 仅高铁/动车的商务/一等/二等席别使用「车厢 + 行号 + 列字母」格式,picker 上的选位才构成有效偏好。
 * 特等/高软/软座/硬座/无座/卧铺等席别座位号格式不同,不进入选座概率流程。
 */
export function supportsPositionPick(seatType: string): boolean {
  return seatType.includes('商务') || seatType.includes('一等') || seatType.includes('二等');
}

/**
 * 把 picker 输出的相对位置(如 ["0-A", "1-C"])映射成实际座位号数组。
 * 同一订单的多张票共用同一车厢号,picker 行号(0/1)对应连续真实行号,列字母直接沿用。
 * 返回值长度与 positions 相同。
 */
export function buildSeatNosFromPositions(seatType: string, positions: string[]): string[] {
  const car = String(Math.floor(Math.random() * 16) + 1).padStart(2, '0');
  const baseRow = Math.floor(Math.random() * 18) + 1; // 1..18,留两行余量
  return positions.map(pos => {
    const [rawRow, col] = pos.split('-');
    const rowOffset = Number.parseInt(rawRow ?? '0', 10) || 0;
    const row = String(baseRow + rowOffset).padStart(2, '0');
    const safeCol = col || 'A';
    return `${car}车 ${row}${safeCol}号`;
  });
}

/**
 * 给定本席别余票数与购票人数,返回「无法满足用户选位」的概率。
 *  - requestedCount <= 0:0(用户没需求)
 *  - count <= 0:1(售罄;实际由 canSubmit 拦截,这里兜底)
 *  - requestedCount > count:1(余票不够,必改派)
 *  - count >= 20 / Infinity:0(余票充足,直接 honor)
 *  - 1 <= count < 20:线性插值 (20 - count) / 20
 *
 * 分支顺序保证 `requestedCount > count` 优先于「充足」判断,避免 count=Infinity 时被误算。
 */
export function computeSeatReassignProbability(count: number, requestedCount: number): number {
  if (requestedCount <= 0) return 0;
  if (count <= 0) return 1;
  if (requestedCount > count) return 1;
  if (!Number.isFinite(count) || count >= 20) return 0;
  return (20 - count) / 20;
}

/** Convenience helpers */
export function getOrderTotalPrice(order: OrderRecord): number {
  return order.tickets.reduce((sum, t) => sum + t.price, 0);
}

export function getOrderPassengerNames(order: OrderRecord): string {
  return order.tickets.map(t => t.passengerName).join(' ');
}

export interface Passenger {
  id: string;
  name: string;
  idType: string;
  idNo: string;
  phone?: string;
  isDefault: boolean;
  ticketType?: string;
}

export interface RailwaySettings {
  fingerprint: boolean;
  notificationEnabled: boolean;
  notificationSound: boolean;
  notificationVibrate: boolean;
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
  version: 'standard' | 'elder';
  paymentPassword: boolean;
  recentRecommend: boolean;
  adRecommend: boolean;
}

export interface InvoiceHeader {
  id: string;
  type: '企业' | '个人/非企业';
  name: string;
  taxNo?: string;
  isDefault: boolean;
}

export interface SelectedTrainDraft {
  trainNo: string;
  seatType: string;
  trainIndex: number;
  passengerIds: string[];
}

// ─── 列车类型 ─────────────────────────────────────────────────────────

export type TrainType = 'G' | 'D' | 'C' | 'K' | 'Z' | 'T';

export interface BerthPrice {
  position: '上铺' | '中铺' | '下铺';
  price: number;
}

export interface SeatInfo {
  type: string;
  // 余票编码（来源不统一，判断"是否可售"请结合 canWaitlist）：
  //   正数          = 精确余票
  //   Infinity      = 余票充足（catalogService / trainService 主路径 >20 归一）
  //                   注意：JSON 序列化后会变成 null（跨边界如 bench_env getState）
  //   0             = 售罄；若同时 canWaitlist=true 则为"可候补"（主路径编码）
  //   -1            = 候补（仅 trainService fallback parseFromFixedIndex 路径遗留）
  count: number;
  price: number;
  canWaitlist: boolean;
  discount?: number;
  berthPrices?: BerthPrice[];
}

export interface TrainInfo {
  trainNo: string;
  trainNoInternal: string;  // 内部编号（parts[2]），用于 queryTrainStops
  trainType: TrainType;
  fromStation: string;
  toStation: string;
  departTime: string;
  arriveTime: string;
  duration: string;
  nextDay: boolean;
  fromType: '始' | '过' | '';
  toType: '终' | '过' | '';
  tags: string[];
  exchangeable: boolean;
  quiet: boolean;
  seats: SeatInfo[];
  saleTime?: string;  // 起售时间 HH:mm（尚未开售时由 API [55] 解析）
}

export interface TransferPlan {
  totalDuration: string;
  transferStation: string;
  leg1: {
    trainNo: string;
    trainType: TrainType;
    fromStation: string;
    toStation: string;
    departTime: string;
    arriveTime: string;
    quiet: boolean;
    exchangeable: boolean;
    seats: SeatInfo[];
  };
  leg2: {
    trainNo: string;
    trainType: TrainType;
    fromStation: string;
    toStation: string;
    departTime: string;
    arriveTime: string;
    quiet: boolean;
    exchangeable: boolean;
    seats: SeatInfo[];
  };
}
