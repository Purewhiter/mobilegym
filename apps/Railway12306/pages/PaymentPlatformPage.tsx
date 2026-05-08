import React, { useMemo, useState } from 'react';
import { useRailwayStore } from '../state';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
import type { ActivityResult } from '@/os/types/manifest';
import type { OrderRecord } from '../types';
import { getOrderTotalPrice, randomSeatNo } from '../types';

function completeOrder(order: OrderRecord): OrderRecord {
  return {
    ...order,
    status: 'completed',
    tickets: order.tickets.map(t => ({ ...t, seatNo: t.seatNo || randomSeatNo(t.seatType) })),
  };
}

export const PaymentPlatformPage: React.FC = () => {
  const orders = useRailwayStore(s => s.orders);
  const updateOrder = useRailwayStore(s => s.updateOrder);
  const updateOrderTickets = useRailwayStore(s => s.updateOrderTickets);
  const { bindTap, go, back } = useRailwayGestures();
  const s = useRailwayStrings();
  const [selectedMethod, setSelectedMethod] = useState<'alipay' | 'jd'>('alipay');

  const pendingOrder = useMemo(
    () => orders.find(order => order.status === 'pending') ?? null,
    [orders],
  );

  const totalPrice = pendingOrder ? getOrderTotalPrice(pendingOrder) : 0;

  const finishPayment = () => {
    if (!pendingOrder) return;
    updateOrder(pendingOrder.id, { status: 'completed' });
    updateOrderTickets(pendingOrder.id, ts => ts.map(t => ({ ...t, seatNo: t.seatNo || randomSeatNo(t.seatType) })));
    go('paymentPlatform.paymentSuccess', {}, { state: { order: completeOrder(pendingOrder) } });
  };

  const handleSubmit = () => {
    if (!pendingOrder) return;
    if (selectedMethod === 'alipay') {
      const os = window.__OS__;
      if (os?.startActivityForResult) {
        const launched = os.startActivityForResult(
          'alipay',
          {
            action: 'ACTION_PAY',
            scheme: 'alipays',
            data: {
              amount: totalPrice,
              orderId: pendingOrder.id,
              merchantName: s.payment_platform_merchant_name,
              subject: s.payment_platform_subject,
            },
          },
          (result: ActivityResult) => {
            if (result.resultCode === 'OK') {
              finishPayment();
            } else {
              back();
            }
          },
        );
        if (launched) return;
      }
    }
    finishPayment();
  };

  return (
    <div className="h-full min-h-full bg-[#f1f1f1] flex flex-col relative w-full overflow-hidden z-[200]" data-status-bar-foreground="light">
      <div className="bg-[#4886E0] text-white shrink-0">
        <div className="pt-12 pb-3 px-4 flex items-center gap-3">
          <button className="w-16 shrink-0 text-left text-[17px] active:opacity-70" onClick={() => back()}>
            {s.orders_title}
          </button>
          <span className="flex-1 min-w-0 px-2 text-center text-[18px] font-medium leading-tight">
            {s.payment_platform_title}
          </span>
          <button className="w-16 shrink-0 text-right text-[17px] leading-tight active:opacity-70" onClick={() => back()}>
            {s.payment_platform_done}
          </button>
        </div>
        <div className="px-4 pb-3">
          <span className="text-[16px] leading-tight break-words">{s.payment_platform_subtitle}</span>
        </div>
      </div>

      <div className="bg-white pl-4">
        <div className="py-4 pr-4 flex items-center justify-between border-b border-[#E5E5E5]/60 gap-3">
          <span className="text-[16px] text-[#333]">{s.payment_platform_amount_due}</span>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[15px] text-[#222]">¥</span>
            <span className="text-[20px] text-[#222] font-semibold tracking-tight">{totalPrice}</span>
          </div>
        </div>

        <button
          className="w-full py-3.5 pr-4 flex items-center justify-between border-b border-[#E5E5E5]/60 active:bg-gray-50 gap-3"
          onClick={() => setSelectedMethod('alipay')}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-[26px] h-[26px] bg-[#1677FF] rounded-[4px] flex items-center justify-center text-white font-bold text-[14px]">A</div>
            <span className="text-[16px] text-[#333] break-words">{s.notification_alipay_name}</span>
          </div>
          {selectedMethod === 'alipay' ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#4B8BF4"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : (
            <div className="w-[22px] h-[22px] rounded-full border-[1.5px] border-[#CCC]" />
          )}
        </button>

        <button
          className="w-full py-3 pr-4 flex items-center justify-between border-b border-[#E5E5E5]/60 active:bg-gray-50 gap-3"
          onClick={() => setSelectedMethod('jd')}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex flex-col items-center justify-center w-[26px] h-[26px] bg-[#E1251B] rounded-[4px] text-white shadow-inner">
              <span className="text-[10px] font-bold leading-none scale-[0.85] origin-bottom mt-0.5">JD</span>
              <span className="text-[8px] leading-none scale-[0.85] origin-top mt-[1px]">Pay</span>
            </div>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-[16px] text-[#333] break-words">{s.payment_platform_jd_name}</span>
              <span className="text-[11px] text-[#E1251B] mt-[1px] leading-tight break-words">
                {s.payment_platform_jd_offer}
              </span>
            </div>
          </div>
          {selectedMethod === 'jd' ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#4B8BF4"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : (
            <div className="w-[22px] h-[22px] rounded-full border-[1.5px] border-[#CCC]" />
          )}
        </button>

        <button className="w-full py-3.5 flex items-center justify-center gap-1 text-[13px] text-[#666] active:bg-gray-50 px-4 leading-tight whitespace-normal text-center">
          <span>{s.payment_platform_other_methods}</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mt-[1px]">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      <div className="mt-auto px-4 pb-12 pt-6">
        <button
          {...bindTap<HTMLButtonElement>('paymentPlatform.paymentSuccess', {
            onTrigger: handleSubmit,
          })}
          className="w-full h-[46px] rounded-[4px] bg-[#4886E0] text-white text-[17px] active:bg-[#3b75c9] transition-colors"
        >
          {s.payment_platform_submit}
        </button>
      </div>
    </div>
  );
};
