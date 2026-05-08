import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { IcNavBack } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
import { useRailwayStore } from '../state';
import { EmptyState } from '../components/EmptyState';
import { parseToTimestamp, now as timeNow, fromTimestamp } from '../../../os/TimeService';
import { getOrderPassengerNames } from '../types';
import { useLocale } from '../../../os/locale';
import { RefundNoticeDialog } from '../components/RefundNoticeDialog';

function formatWeekday(dateStr: string, isEnglish: boolean): string {
  const timestamp = parseToTimestamp(`${dateStr}T00:00:00`);
  const date = timestamp ? fromTimestamp(timestamp) : fromTimestamp(timeNow());
  const weekdaysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdaysZh = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return isEnglish ? weekdaysEn[date.getDay()] : weekdaysZh[date.getDay()];
}

export const PaidOrdersPage: React.FC = () => {
  const { bindBack, bindTap } = useRailwayGestures();
  const location = useLocation();
  const orders = useRailwayStore(s => s.orders);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const s = useRailwayStrings();
  const isEnglish = useLocale() === 'en';
  const searchParams = new URLSearchParams(location.search);
  const refundDialogOrderId = searchParams.get('dialog') === 'refundNotice' ? searchParams.get('id') : null;

  const completedOrders = useMemo(
    () => orders.filter(o => o.status === 'completed' || o.status === 'cancelled'),
    [orders],
  );

  const { futureOrders, pastOrders } = useMemo(() => {
    const nowTs = timeNow();
    const todayDate = fromTimestamp(nowTs);
    const todayStr = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;

    const future: typeof completedOrders = [];
    const past: typeof completedOrders = [];
    for (const order of completedOrders) {
      if (order.date >= todayStr) future.push(order);
      else past.push(order);
    }
    return { futureOrders: future, pastOrders: past };
  }, [completedOrders]);

  const displayOrders = activeTab === 'pending' ? futureOrders : pastOrders;

  const groupedByCreateDate = useMemo(() => {
    const byDate: Record<string, typeof displayOrders> = {};
    for (const order of displayOrders) {
      const createDate = order.createTime ? order.createTime.substring(0, 10) : order.date;
      if (!byDate[createDate]) byDate[createDate] = [];
      byDate[createDate].push(order);
    }
    return byDate;
  }, [displayOrders]);

  const groupedEntries = useMemo(
    () => Object.entries(groupedByCreateDate).sort((a, b) => b[0].localeCompare(a[0])),
    [groupedByCreateDate],
  );

  const formatGroupedDate = (date: string) => {
    const parts = date.split('-');
    if (isEnglish) return `${parts[0]}-${parts[1]}-${parts[2]}`;
    return `${parts[0]}年${parts[1]}月${parts[2]}日`;
  };

  return (
    <div className="min-h-full bg-[#f6f8fa] flex flex-col relative pb-20" data-status-bar-foreground="light">
      <div className="bg-app-primary pt-10 pb-0 px-4 sticky top-0 z-20">
        <div className="flex items-center relative pb-3 gap-3">
          <button className="absolute left-0 w-10 text-left" {...bindBack<HTMLButtonElement>()}>
            <IcNavBack size={24} className="text-white" />
          </button>
          <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">
            {s.paid_orders_title}
          </span>
        </div>
        <div className="flex gap-6 px-4">
          <button
            className={`pb-2 text-[15px] relative ${activeTab === 'pending' ? 'text-white font-medium' : 'text-white/70'}`}
            onClick={() => setActiveTab('pending')}
          >
            {s.paid_orders_tab_upcoming}
            {activeTab === 'pending' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[3px] bg-white rounded-t-sm" />}
          </button>
          <button
            className={`pb-2 text-[15px] relative ${activeTab === 'history' ? 'text-white font-medium' : 'text-white/70'}`}
            onClick={() => setActiveTab('history')}
          >
            {s.paid_orders_tab_history}
            {activeTab === 'history' && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-[3px] bg-white rounded-t-sm" />}
          </button>
        </div>
      </div>

      <div className="bg-[#FFF6ED] px-4 py-2 flex items-start justify-between gap-3">
        <span className="text-[13px] text-[#E77833] flex items-center gap-1 leading-tight">
          <span className="text-base leading-none">🙂</span>
          <span className="whitespace-normal break-words">{s.paid_orders_child_notice}</span>
        </span>
        <span className="text-[13px] text-[#E77833] flex items-center shrink-0 leading-tight">
          {s.paid_orders_add_now}<span className="ml-[2px] text-[10px]">&gt;</span>
        </span>
      </div>

      {displayOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center pt-24">
          <EmptyState message={s.paid_orders_empty} />
        </div>
      ) : (
        <div className="pb-6">
          {groupedEntries.map(([date, group]) => {
            const dateStr = formatGroupedDate(date);
            return (
              <div key={date}>
                <div className="mx-4 mt-4 mb-2 inline-block">
                  <div className="bg-[#FFF5E5] text-[#E58A2B] text-[12px] px-3 py-1 rounded-full flex items-center">
                    {s.paid_orders_ordered_on}: {dateStr}
                  </div>
                </div>

                {group.map(order => {
                  const ticketCount = order.tickets.length;
                  const passengerDisplay =
                    ticketCount <= 1
                      ? getOrderPassengerNames(order)
                      : s.paid_orders_passenger_display_more
                        .replace('{name}', order.tickets[0].passengerName)
                        .replace('{count}', String(ticketCount))
                        .replace('{extraCount}', String(ticketCount - 1));
                  const statusText = order.status === 'cancelled' ? s.order_status_refunded : s.order_status_paid;
                  const statusClass = order.status === 'cancelled' ? 'text-[#999999]' : 'text-[#54C59A]';
                  const isCancelled = order.status === 'cancelled';
                  return (
                    <div
                      key={order.id}
                      className="mx-3 mb-3 rounded-[8px] bg-white overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.02)] active:opacity-60 transition-opacity"
                      {...bindTap('paidOrders.orderDetail', { params: { id: order.id } })}
                    >
                      <div className={`px-4 py-3 border-b border-[#F5F5F5] flex items-center text-[15px] font-medium ${isCancelled ? 'text-[#999]' : 'text-[#333]'}`}>
                        <span className={`text-[15px] mr-1.5 flex items-center ${isCancelled ? 'grayscale opacity-60' : ''}`}>🚄</span>
                        {order.trainNo} {order.fromStation} — {order.toStation}
                      </div>

                      <div className={`px-4 py-3 text-[13px] leading-[26px] relative font-light ${isCancelled ? 'text-[#999]' : 'text-[#666]'}`}>
                        <div className="flex items-start justify-between min-w-0">
                          <div className="flex min-w-0 items-start">
                            <span className={isEnglish ? "w-[85px] shrink-0 text-[#999]" : "w-[48px] shrink-0 flex justify-between text-[#999]"}>
                              {isEnglish ? s.paid_orders_order_id_label.replace(/[:：\s]/g, '') : s.paid_orders_order_id_label.replace(/[:：\s]/g, '').split('').map((c, i) => <span key={i}>{c}</span>)}
                            </span>
                            <span className="text-[#999]">{isEnglish ? ': ' : '：'}</span>
                            <span className={`ml-[2px] flex-1 min-w-0 break-words ${isCancelled ? 'text-[#999]' : 'text-[#333]'} font-medium`}>{order.id}</span>
                          </div>
                          <span className={`${statusClass} shrink-0`}>{statusText}</span>
                        </div>

                        <div className="flex items-start min-w-0">
                          <span className={isEnglish ? "w-[85px] shrink-0 text-[#999]" : "w-[48px] shrink-0 flex justify-between text-[#999]"}>
                            {isEnglish ? s.paid_orders_departure_label.replace(/[:：\s]/g, '') : s.paid_orders_departure_label.replace(/[:：\s]/g, '').split('').map((c, i) => <span key={i}>{c}</span>)}
                          </span>
                          <span className="text-[#999]">{isEnglish ? ': ' : '：'}</span>
                          <span className={`ml-[2px] flex-1 min-w-0 break-words ${isCancelled ? 'text-[#999]' : 'text-[#333]'} font-medium`}>
                            {order.date} {formatWeekday(order.date, isEnglish)} {order.departTime}开
                          </span>
                        </div>

                        <div className="flex items-start min-w-0">
                          <span className={isEnglish ? "w-[85px] shrink-0 text-[#999]" : "w-[48px] shrink-0 flex justify-between text-[#999]"}>
                            {isEnglish ? s.paid_orders_passengers_label.replace(/[:：\s]/g, '') : s.paid_orders_passengers_label.replace(/[:：\s]/g, '').split('').map((c, i) => <span key={i}>{c}</span>)}
                          </span>
                          <span className="text-[#999]">{isEnglish ? ': ' : '：'}</span>
                          <span className={`ml-[2px] flex-1 min-w-0 break-words ${isCancelled ? 'text-[#999]' : 'text-[#333]'} font-medium`}>
                            {ticketCount}张 {passengerDisplay}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div className="text-center text-[#999999] text-[12px] mt-2 pb-4">
            {s.paid_orders_retention_notice}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-2 z-10">
        <div className="bg-gradient-to-r from-[#FFF5E6] to-[#FF8D42] rounded-[10px] p-0.5 shadow-md">
          <div className="bg-white rounded-[9px] w-full h-[52px] flex items-center justify-between px-3 relative overflow-hidden">
            <div className="absolute right-1 top-1 text-gray-400 text-[10px] z-10 leading-none p-1">✕</div>
            <div className="flex flex-col relative z-0">
              <div className="text-[#E75D20] text-[16px] font-bold italic">{s.paid_orders_ad_title}</div>
              <div className="text-[#666666] text-[11px] mt-0.5 flex items-center gap-1">
                <span className="text-[#E75D20]">▶</span> {s.paid_orders_ad_desc}
              </div>
            </div>
            <button className="bg-gradient-to-r from-[#FF8D42] to-[#FF5F25] text-white text-[13px] font-medium px-4 py-1.5 rounded-full z-10 mr-4">
              {s.paid_orders_book_now}
            </button>
            <div className="absolute right-0 top-0 bottom-0 w-[120px] bg-gradient-to-r from-[#FF8D42] to-[#FF5F25] opacity-90 rounded-l-full translate-x-[20px] shadow-inner pointer-events-none" />
          </div>
        </div>
      </div>

      {refundDialogOrderId && (
        <RefundNoticeDialog
          title={s.refund_notice_title}
          message={s.refund_notice_message}
          cancelLabel={s.action_cancel}
          confirmLabel={s.action_confirm}
          cancelProps={bindBack<HTMLButtonElement>()}
          confirmProps={bindTap<HTMLButtonElement>('paidOrders.refundConfirm', {
            params: { id: refundDialogOrderId },
          })}
        />
      )}
    </div>
  );
};
