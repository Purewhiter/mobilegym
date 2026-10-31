import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { routes } from '../apps/Railway12306/routes';
import type { OrderRecord } from '../apps/Railway12306/types';

const paidOrder: OrderRecord = {
  id: 'paid-1',
  trainNo: 'G101',
  fromStation: '北京南',
  toStation: '上海虹桥',
  departTime: '08:00',
  arriveTime: '12:30',
  date: '2026-04-26',
  tickets: [
    { passengerName: '赵宇轩', ticketType: '成人票', seatType: '二等座', seatNo: '06车 15A号', price: 553 },
  ],
  status: 'completed',
  createTime: '2026-04-25T10:00:00+08:00',
};

describe('Railway12306 退票退款链路', () => {
  it('本人车票和退票确认页都有退票提示弹窗，退票成功页单独成页', () => {
    expect(routes.myTickets.search.dialog).toContain('refundNotice');
    expect(routes.refundConfirm.search.dialog).toContain('refundNotice');
    expect(routes.refundSuccess.path).toBe('/refund-success');
    const tickets = readFileSync('apps/Railway12306/pages/MyTicketsPage.tsx', 'utf8');
    expect(tickets).toContain("bindNav(routes.refundConfirm, { search: { id: refundDialogOrderId }, replace: true })");
  });

  it('确认页点击继续后更新订单并进入退票成功页', async () => {
    const refundModule = await import('../apps/Railway12306/utils/refund').catch(() => null);
    expect(refundModule?.requestRailwayRefund).toBeTypeOf('function');
    if (!refundModule) return;

    const updateOrder = vi.fn();
    const onRefunded = vi.fn();

    refundModule.requestRailwayRefund({ order: paidOrder, updateOrder, onRefunded });

    expect(updateOrder).toHaveBeenCalledWith('paid-1', { status: 'cancelled' });
    expect(onRefunded).toHaveBeenCalledWith({ ...paidOrder, status: 'cancelled' });
    const page = readFileSync('apps/Railway12306/pages/RefundConfirmPage.tsx', 'utf8');
    expect(page).toContain('nav.replace(routes.refundSuccess, {}, { state: { order: refundedOrder } })');
  });

  it('退票成功页返回订单 tab 时用 popTo 清理退票流程返回栈', () => {
    const source = readFileSync('apps/Railway12306/pages/RefundSuccessPage.tsx', 'utf8');
    expect(source).toContain("nav.replace(routes.orders, {}, { popTo: '/orders' })");
  });
});
