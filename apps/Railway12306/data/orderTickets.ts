/**
 * 车票数据类型与工具函数
 */

import { parseToTimestamp, fromTimestamp, now as timeNow } from '../../../os/TimeService';
import type { OrderRecord, TicketInfo } from '../types';

const WEEK_DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export interface TicketOrder {
  orderId: string;
  trainNo: string;
  fromStation: string;
  toStation: string;
  departTime: string;
  arriveTime: string;
  date: string;         // 如 "2月9日"
  dateWeekday: string;  // 如 "周一"
  fullDate: string;     // 如 "2026年2月9日"
  travelDate: string;   // YYYY-MM-DD，用于判断是否已过乘车日期
  nextDay: boolean;
  status: string;       // 已支付 / 车上已检
  ticketType: string;   // 学生票 / 成人票
  seatInfo: string;     // 如 "二等座 06车 15A号"
  price: number;
  discount?: string;    // 如 "7.3折"
  paymentType: string;  // 非现金支付
  purchaseType: string; // 线上购买
  passengerName: string;
}

/** 将 OrderRecord 展开为每张票一条 TicketOrder 展示格式 */
export function orderToTickets(order: OrderRecord): TicketOrder[] {
  const ts = parseToTimestamp(`${order.date}T00:00:00`);
  const d = ts ? fromTimestamp(ts) : fromTimestamp(timeNow());
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const yyyy = d.getFullYear();

  const [dH = 0, dM = 0] = order.departTime.split(':').map(Number);
  const [aH = 0, aM = 0] = order.arriveTime.split(':').map(Number);
  const nextDay = aH * 60 + aM < dH * 60 + dM;

  const nowTs = timeNow();
  const departTs = parseToTimestamp(`${order.date}T${order.departTime}:00`);
  const status = departTs && departTs > nowTs ? '已支付' : '车上已检';

  return order.tickets.map((ticket: TicketInfo) => ({
    orderId: order.id,
    trainNo: order.trainNo,
    fromStation: order.fromStation,
    toStation: order.toStation,
    departTime: order.departTime,
    arriveTime: order.arriveTime,
    date: `${mm}月${dd}日`,
    dateWeekday: WEEK_DAYS[d.getDay()],
    fullDate: `${yyyy}年${mm}月${dd}日`,
    travelDate: order.date,
    nextDay,
    status,
    ticketType: ticket.ticketType,
    seatInfo: ticket.seatNo
      ? `${ticket.seatType} ${ticket.seatNo}`
      : ticket.seatType,
    price: ticket.price,
    discount: ticket.ticketType === '学生票' ? '7.5折' : undefined,
    paymentType: '非现金支付',
    purchaseType: '线上购买',
    passengerName: ticket.passengerName,
  }));
}

/** 按日期分组的车票（倒序） */
export function getTicketsGroupedByDate(tickets: TicketOrder[]): { date: string; weekday: string; tickets: TicketOrder[] }[] {
  const groups: Record<string, { date: string; weekday: string; tickets: TicketOrder[] }> = {};
  for (const ticket of tickets) {
    const key = ticket.fullDate;
    if (!groups[key]) {
      groups[key] = { date: ticket.fullDate, weekday: ticket.dateWeekday, tickets: [] };
    }
    groups[key].tickets.push(ticket);
  }
  return Object.values(groups).sort((a, b) => (a.date > b.date ? -1 : 1));
}
