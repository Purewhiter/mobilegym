import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { NAVIGATION_DECLARATION } from '../apps/Railway12306/navigation.declaration';

const mockOrder = {
  id: 'pending-1',
  trainNo: 'G1',
  fromStation: '北京南',
  toStation: '上海虹桥',
  departTime: '08:00',
  arriveTime: '12:30',
  date: '2026-04-26',
  tickets: [
    { passengerName: '赵宇轩', ticketType: '成人票', seatType: '二等座', seatNo: '', price: 553 },
  ],
  status: 'pending',
  createTime: '2026-04-25T10:00:00+08:00',
};

vi.mock('../apps/Railway12306/state', () => ({
  useRailwayStore: (selector: (state: any) => unknown) =>
    selector({
      orders: [mockOrder],
      updateOrder: vi.fn(),
      updateOrderTickets: vi.fn(),
    }),
}));

vi.mock('../apps/Railway12306/hooks/useRailwayGestures', () => ({
  useRailwayGestures: () => ({
    bindTap: (id: string, options?: { onTrigger?: () => void }) => ({
      'data-trigger': id,
      'data-trigger-type': 'tap',
      onClick: options?.onTrigger,
    }),
    go: vi.fn(),
    back: vi.fn(),
  }),
}));

vi.mock('../apps/Railway12306/hooks/useRailwayStrings', () => ({
  useRailwayStrings: () => ({
    orders_title: '订单',
    payment_platform_title: '请您支付',
    payment_platform_done: '完成',
    payment_platform_subtitle: '中国铁路电子支付平台',
    payment_platform_amount_due: '应付金额',
    notification_alipay_name: '支付宝',
    payment_platform_jd_name: '京东支付',
    payment_platform_jd_offer: '限量减1-298，白条新减30',
    payment_platform_other_methods: '选择其他11种支付方式',
    payment_platform_submit: '提交支付',
    payment_platform_merchant_name: '铁路12306',
    payment_platform_subject: '火车票',
  }),
}));

describe('Railway12306 支付平台导航', () => {
  it('声明支付平台页面路由，保证导航图能连接支付提交页', () => {
    expect(NAVIGATION_DECLARATION.routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/payment-platform',
          component: 'PaymentPlatformPage',
        }),
      ]),
    );
  });

  it('提交支付按钮绑定支付成功 transition，供动作图继续唤起支付宝支付链路', async () => {
    const { PaymentPlatformPage } = await import('../apps/Railway12306/pages/PaymentPlatformPage');

    const markup = renderToStaticMarkup(React.createElement(PaymentPlatformPage));

    expect(markup).toContain('提交支付');
    expect(markup).toContain('data-trigger="paymentPlatform.paymentSuccess"');
    expect(markup).toContain('data-trigger-type="tap"');
  });
});
