import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcNavBack } from '../res/icons';
import { RefundNoticeDialog } from '../components/RefundNoticeDialog';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
import { useRailwayStore } from '../state';
import { getOrderTotalPrice, getOrderPassengerNames } from '../types';
import { requestRailwayRefund } from '../utils/refund';
import { localizeRailwayText } from '../utils/localizeRailwayItem';
import { useLocale } from '../../../os/locale';
import { parseToTimestamp, now as timeNow, fromTimestamp } from '../../../os/TimeService';

function formatTripDate(dateStr: string, isEnglish: boolean): string {
  const timestamp = parseToTimestamp(`${dateStr}T00:00:00`);
  const date = timestamp ? fromTimestamp(timestamp) : fromTimestamp(timeNow());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const weekdaysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdaysZh = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return isEnglish
    ? `${dateStr} ${weekdaysEn[date.getDay()]}`
    : `${dateStr}日 ${weekdaysZh[date.getDay()]}`;
}

export const RefundConfirmPage: React.FC = () => {
  const { bindBack, bindTap, go } = useRailwayGestures();
  const [searchParams] = useSearchParams();
  const s = useRailwayStrings();
  const isEnglish = useLocale() === 'en';
  const orderId = searchParams.get('id') ?? '';
  const showNotice = searchParams.get('dialog') === 'refundNotice';
  const order = useRailwayStore(state => state.orders.find(item => item.id === orderId));
  const updateOrder = useRailwayStore(state => state.updateOrder);

  if (!order) {
    return (
      <div className="min-h-full bg-white flex flex-col" data-status-bar-foreground="light">
        <div className="bg-[#5B9BEE] pt-10 pb-4 px-4 flex items-center relative">
          <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
            <IcNavBack size={24} className="text-white" />
          </button>
          <span className="flex-1 px-10 text-center text-[20px] font-medium text-white leading-tight">
            {s.refund_confirm_title}
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 text-center text-[15px] text-gray-500">
          {s.order_detail_not_found}
        </div>
      </div>
    );
  }

  const total = getOrderTotalPrice(order);
  const firstTicket = order.tickets[0];
  const passengers = getOrderPassengerNames(order);
  const handleRefund = () => {
    if (order.status !== 'completed') return;
    requestRailwayRefund({
      order,
      updateOrder,
      go,
      successTransitionId: 'refundConfirm.refundSuccess',
    });
  };

  return (
    <div className="min-h-full bg-[#f6f8fb] flex flex-col" data-status-bar-foreground="light" data-navigation-bar-foreground="dark">
      <div className="bg-[#5A9AEC] pt-10 pb-[60px] px-4 flex items-center relative shrink-0">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={26} className="text-white" />
        </button>
        <span className="flex-1 px-10 text-center text-[20px] font-medium text-white leading-tight">
          {s.refund_confirm_title}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar -mt-[44px] px-3 pb-8 relative z-10">
        <div className="rounded-[8px] bg-white shadow-[0_4px_16px_rgba(63,93,128,0.06)]">
          <div className="px-5 pt-6 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div className="w-[30%] min-w-0">
                <div className="text-[32px] font-semibold leading-none text-[#1E2530]">{order.departTime}</div>
                <div className="mt-2 text-[15px] text-[#666] break-words">{order.fromStation}</div>
              </div>
              <div className="w-[40%] pt-6 text-center">
                <div className="text-[14px] text-[#666]">{order.trainNo}</div>
                <div className="relative mx-auto mt-1.5 h-[1px] w-[80%] bg-[#A9CEF7]">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[10px] border-l-[#A9CEF7] border-y-[4px] border-y-transparent" />
                </div>
              </div>
              <div className="w-[30%] min-w-0 text-right">
                <div className="text-[32px] font-semibold leading-none text-[#1E2530]">{order.arriveTime}</div>
                <div className="mt-2 text-[15px] text-[#666] break-words">{order.toStation}</div>
              </div>
            </div>
            <div className="mt-6 text-[13px] text-[#666]">
              {s.refund_confirm_departure_time}：{formatTripDate(order.date, isEnglish)}
            </div>
          </div>

          <div className="mx-4 border-t border-dashed border-[#F0F0F0] pt-4 pb-5 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[16px] font-medium text-[#222]">
                <span className="min-w-0 break-words">{passengers}</span>
                {firstTicket && (
                  <span className="shrink-0 rounded-[3px] border border-[#5B9BEE] px-1.5 py-[1px] text-[12px] font-normal text-[#5B9BEE]">
                    {localizeRailwayText(firstTicket.ticketType, isEnglish)}
                  </span>
                )}
              </div>
              <div className="mt-2.5 text-[14px] text-[#999]">{isEnglish ? 'ID card' : '中国居民身份证'}</div>
              {firstTicket && (
                <div className="mt-2.5 text-[14px] text-[#666]">
                  {localizeRailwayText(firstTicket.seatType, isEnglish)} {firstTicket.seatNo || s.order_detail_unassigned_seat}
                </div>
              )}
            </div>
            <div className="shrink-0 pt-1 flex items-baseline gap-1.5 text-[#E67D33]">
              <span className="text-[14px] font-bold">￥</span>
              <span className="text-[20px] font-bold">{total}</span>
            </div>
          </div>
        </div>

        <div className="mx-1 mt-6 rounded-[5px] border border-dashed border-[#DCE5EE] bg-white p-4">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#5B9BEE] text-[13px] font-bold italic leading-none text-white">i</span>
            <span className="text-[15px] text-[#666]">{s.refund_confirm_notice_title}</span>
          </div>
          <div className="text-[14px] leading-[1.65] text-[#666]">
            <p>1.{s.refund_confirm_rule_1_prefix}<span className="text-[#5B9BEE] underline underline-offset-2 decoration-[#5B9BEE]/40">{s.refund_confirm_rule_link}</span>。</p>
            <p>2.{s.refund_confirm_rule_2}</p>
            <p>3.{s.refund_confirm_rule_3}</p>
          </div>
        </div>
      </div>

      <div className="shrink-0 bg-white px-4 pb-6 pt-3 shadow-[0_-2px_10px_rgba(0,0,0,0.02)]">
        <div className="mb-4 flex items-center justify-between text-[14px] text-[#666]">
          <div className="flex items-center">
            {s.refund_confirm_total_label}：
            <span className="flex items-baseline text-[#E67D33] ml-1">
              <span className="text-[16px] font-medium">￥</span>
              <span className="text-[24px] font-medium">{total}</span>
            </span>
          </div>
          <div className="flex items-center text-[#999]">
            {s.refund_confirm_detail_label} ∧
          </div>
        </div>
        <div className="flex items-center justify-between mt-1">
          <button className="text-[18px] text-[#666] px-2 py-2" {...bindBack<HTMLButtonElement>()}>
            {s.refund_confirm_cancel}
          </button>
          <button
            className="h-12 w-[140px] rounded-[5px] bg-[#E88643] text-[18px] font-medium text-white active:bg-[#D47133]"
            {...bindTap<HTMLButtonElement>('refundConfirm.openRefundNotice', {
              params: { id: order.id },
            })}
          >
            {s.refund_confirm_submit}
          </button>
        </div>
      </div>

      {showNotice && (
        <RefundNoticeDialog
          title={s.refund_notice_title}
          message={s.refund_notice_message}
          cancelLabel={s.action_cancel}
          confirmLabel={s.refund_notice_continue}
          cancelProps={bindBack<HTMLButtonElement>()}
          confirmProps={bindTap<HTMLButtonElement>('refundConfirm.refundSuccess', {
            onTrigger: handleRefund,
          })}
        />
      )}
    </div>
  );
};
