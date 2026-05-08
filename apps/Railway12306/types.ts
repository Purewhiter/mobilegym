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
