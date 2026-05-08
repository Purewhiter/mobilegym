import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { NAVIGATION_DECLARATION } from '../apps/Railway12306/navigation.declaration';
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
  it('声明本人车票先弹提示，再进入退票确认页，最后从确认页退票成功', () => {
    expect(NAVIGATION_DECLARATION.transitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'myTickets.openRefundNotice',
          from: '/my-tickets',
          to: '/my-tickets',
          search: { dialog: 'refundNotice' },
        }),
        expect.objectContaining({
          id: 'myTickets.refundConfirm',
          from: '/my-tickets',
          to: '/refund-confirm',
        }),
        expect.objectContaining({
          id: 'refundConfirm.openRefundNotice',
          from: '/refund-confirm',
          to: '/refund-confirm',
          search: { dialog: 'refundNotice' },
        }),
        expect.objectContaining({
          id: 'refundConfirm.refundSuccess',
          from: '/refund-confirm',
          to: '/refund-success',
        }),
      ]),
    );
  });

  it('确认页点击继续后更新订单并进入退票成功页', async () => {
    const refundModule = await import('../apps/Railway12306/utils/refund').catch(() => null);
    expect(refundModule?.requestRailwayRefund).toBeTypeOf('function');
    if (!refundModule) return;

    const updateOrder = vi.fn();
    const go = vi.fn();

    refundModule.requestRailwayRefund({
      order: paidOrder,
      updateOrder,
      go,
      successTransitionId: 'refundConfirm.refundSuccess',
    });

    expect(updateOrder).toHaveBeenCalledWith('paid-1', { status: 'cancelled' });
    expect(go).toHaveBeenCalledWith(
      'refundConfirm.refundSuccess',
      {},
      {
        mode: 'replace',
        state: { order: { ...paidOrder, status: 'cancelled' } },
      },
    );
  });

  it('退票成功页返回到主页订单 tab', () => {
    expect(NAVIGATION_DECLARATION.transitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'refundSuccess.backOrders',
          from: '/refund-success',
          to: '/orders',
          mode: 'replace',
        }),
      ]),
    );
  });

  it('退票成功页返回订单时使用 popTo 清理退票流程返回栈', () => {
    const source = readFileSync('apps/Railway12306/pages/RefundSuccessPage.tsx', 'utf8');
    expect(source).toContain("go('refundSuccess.backOrders', {}, { popTo: '/orders' })");
  });
});
