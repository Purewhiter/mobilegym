import React from 'react';
import { useLocation } from 'react-router-dom';
import { IcNavBack, IcCheckCircle } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
import type { OrderRecord } from '../types';
import { getOrderTotalPrice } from '../types';

export const RefundSuccessPage: React.FC = () => {
  const location = useLocation();
  const { bindTap, go } = useRailwayGestures();
  const s = useRailwayStrings();
  const order = (location.state as { order?: OrderRecord })?.order ?? null;
  const totalPrice = order ? getOrderTotalPrice(order) : 0;
  const backToOrdersProps = bindTap<HTMLButtonElement>('refundSuccess.backOrders', {
    onTrigger: () => go('refundSuccess.backOrders', {}, { popTo: '/orders' }),
  });

  return (
    <div className="min-h-[100dvh] bg-[#f5f5f5] flex flex-col" data-status-bar-foreground="light">
      <div className="bg-[#4886E0] pt-10 pb-3 px-4 flex items-center">
        <button {...backToOrdersProps}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-[18px] font-medium text-white leading-tight">
          {s.refund_success_title}
        </span>
      </div>

      <div className="bg-[#4886E0] pb-6 px-4">
        <div className="bg-white/15 rounded-[8px] px-4 py-5 flex items-center gap-3">
          <IcCheckCircle size={36} className="text-[#4CD964] shrink-0" />
          <div className="min-w-0">
            <div className="text-white text-[17px] font-medium">
              {s.refund_success_banner}
            </div>
            {order && (
              <div className="text-white/70 text-[13px] mt-1 break-words">
                {s.refund_success_business_id}: {order.id}
              </div>
            )}
          </div>
        </div>
      </div>

      {order && (
        <div className="mx-3 mt-3 rounded-[8px] bg-white overflow-hidden">
          <div className="px-4 pt-4 pb-2 text-[15px] font-medium text-[#333] border-b border-[#EEF2F6]">
            {s.refund_success_details_title}
          </div>
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] text-[#666]">{s.refund_success_train}</span>
              <span className="text-[14px] text-[#333] break-words">
                {order.trainNo} {order.fromStation} {'>'} {order.toStation}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] text-[#666]">{s.refund_success_passengers}</span>
              <span className="text-[14px] text-[#333] break-words">{order.tickets.map(t => t.passengerName).join(', ')}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] text-[#666]">{s.refund_success_original_fare}</span>
              <span className="text-[14px] text-[#333]">¥{totalPrice.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] text-[#666]">{s.refund_success_rate}</span>
              <span className="text-[14px] text-[#333]">0%</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] text-[#666]">{s.refund_success_service_fee}</span>
              <span className="text-[14px] text-[#333]">¥0.00</span>
            </div>
          </div>
          <div className="px-4 py-3 border-t border-[#EEF2F6] flex items-center justify-between">
            <span className="text-[15px] font-medium text-[#333]">
              {s.refund_success_total}
            </span>
            <span className="text-[17px] font-semibold text-[#DA6722]">¥{totalPrice.toFixed(2)}</span>
          </div>
        </div>
      )}

      <div className="mt-6 px-4">
        <button
          className="w-full h-[42px] rounded-[4px] bg-[#4886E0] text-white text-[15px] active:bg-[#3b75c9]"
          {...backToOrdersProps}
        >
          {s.refund_success_back}
        </button>
      </div>
    </div>
  );
};
