import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { IcNavBack, IcMore, IcNavForward } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
import { useRailwayStore } from '../state';
import { useShallow } from 'zustand/react/shallow';
import { orderToTickets, getTicketsGroupedByDate } from '../data/orderTickets';
import { getToday } from '../../../os/TimeService';
import { useLocale } from '../../../os/locale';
import { localizeRailwayText } from '../utils/localizeRailwayItem';
import { RefundNoticeDialog } from '../components/RefundNoticeDialog';

function localizeFullDate(value: string, isEnglish: boolean): string {
  if (!isEnglish) return value;
  return value.replace(/(\d{4})年(\d{1,2})月(\d{1,2})日/g, '$1/$2/$3');
}

function localizeWeekday(value: string, isEnglish: boolean): string {
  if (!isEnglish) return value;
  const map: Record<string, string> = {
    周日: 'Sun',
    周一: 'Mon',
    周二: 'Tue',
    周三: 'Wed',
    周四: 'Thu',
    周五: 'Fri',
    周六: 'Sat',
  };
  return map[value] || value;
}

function localizeShortDate(value: string, isEnglish: boolean): string {
  if (!isEnglish) return value;
  return value.replace(/(\d{1,2})月(\d{1,2})日/g, '$1/$2');
}

function localizeSeatInfo(value: string, isEnglish: boolean): string {
  if (!isEnglish) return value;
  return value
    .replace('二等座', 'Second Class')
    .replace('一等座', 'First Class')
    .replace('商务座', 'Business Class')
    .replace(/(\d{2})车\s+([0-9A-Z]+)号/g, 'Coach $1 Seat $2');
}

function localizeDiscount(value: string | undefined, isEnglish: boolean): string | undefined {
  if (!value || !isEnglish) return value;
  const rate = Number.parseFloat(value);
  if (Number.isFinite(rate)) {
    return `${rate * 10}% fare`;
  }
  return value;
}

export const MyTicketsPage: React.FC = () => {
  const { bindBack, bindTap } = useRailwayGestures();
  const location = useLocation();
  const s = useRailwayStrings();
  const { passengers, orders } = useRailwayStore(useShallow(state => ({
    passengers: state.passengers,
    orders: state.orders,
  })));
  const isEnglish = useLocale() === 'en';
  const searchParams = new URLSearchParams(location.search);
  const refundDialogOrderId = searchParams.get('dialog') === 'refundNotice' ? searchParams.get('id') : null;

  // 本人车票 = 已支付（completed）的第一个乘车人（本人）的订单
  const selfName = passengers[0]?.name ?? '';

  const tickets = useMemo(() => {
    const completedOrders = orders.filter(
      o => o.status === 'completed' && o.tickets.some(t => t.passengerName === selfName),
    );
    return completedOrders.flatMap(orderToTickets).filter(t => t.passengerName === selfName);
  }, [orders, selfName]);

  const groups = useMemo(() => getTicketsGroupedByDate(tickets), [tickets]);

  return (
    <div className="min-h-full bg-app-bg">
      {/* 顶栏 */}
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center gap-3 relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{isEnglish ? 'My tickets' : '本人车票'}</span>
        <IcMore size={22} className="text-white absolute right-4" />
      </div>

      {/* 提示栏 */}
      <div className="bg-[#FFFBE6] px-4 py-2 flex items-start gap-2">
        <span className="text-yellow-500 text-xs mt-0.5">💡</span>
        <span className="text-xs text-gray-500 flex-1 min-w-0 whitespace-normal leading-tight break-words">{isEnglish ? `Only tickets for "${selfName}" under the current 12306 account are shown here.` : `只显示当前12306账号本人"${selfName}"的出行车票信息。`}</span>
      </div>

      {/* 免费儿童申报 */}
      <div className="bg-app-surface px-4 py-2.5 flex items-center border-b border-gray-100">
        <span className="text-xs text-app-accent font-medium flex-1">{isEnglish ? 'Free child rider declaration (under 6)' : '免费乘车儿童申报（未满6周岁）'}</span>
        <span className="text-xs text-app-accent flex items-center gap-0.5">
          {isEnglish ? 'Add' : '去添加'} <IcNavForward size={14} />
        </span>
      </div>

      {/* 车票列表按日期分组 */}
      <div className="pb-6">
        {groups.map(group => {
          const isPastDate = group.tickets[0] ? group.tickets[0].travelDate < getToday() : false;
          return (
          <div key={group.date}>
            {/* 日期标题：已过乘车日期时变灰 */}
            <div className="px-4 pt-4 mb-2">
              <div
                className={`inline-block text-[12px] px-3 py-1 rounded-full flex items-center font-medium ${isPastDate ? 'bg-gray-100 text-gray-500' : 'bg-[#FFF5E5] text-[#E58A2B]'}`}
              >
                {isEnglish ? 'Travel date:' : '乘车日期：'}{localizeFullDate(group.date, isEnglish)} {localizeWeekday(group.weekday, isEnglish)}
              </div>
            </div>

            {/* 车票卡片 */}
            {group.tickets.map(ticket => {
              const isPast = ticket.travelDate < getToday();
              return (
                <div
                  key={ticket.orderId}
                  className={`mx-3 mb-3 bg-app-surface rounded-xl overflow-hidden shadow-sm ${isPast ? 'opacity-60' : ''}`}
                >
                  {/* 订单号 */}
                  <div className={`px-4 pt-3 pb-2 flex items-center justify-between border-b ${isPast ? 'border-gray-200 text-gray-400' : 'border-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${isPast ? 'text-gray-400' : 'text-gray-500'}`}>{isEnglish ? 'Order ID:' : '订单号：'}{ticket.orderId}</span>
                      <span className={`text-[10px] border rounded px-1 py-0.5 ${isPast ? 'text-gray-400 border-gray-300' : 'text-gray-400 border-gray-300'}`}>{isEnglish ? 'Copy' : '复制'}</span>
                    </div>
                    <span className={`text-xs ${isPast ? 'text-gray-400' : 'text-gray-400'}`}>{isEnglish ? 'Valid only for this train on the travel date' : '车票当日当次有效'}</span>
                  </div>

                  {/* 车次信息 */}
                  <div className="px-4 pt-3 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col items-start">
                        <span className={`text-2xl font-bold ${isPast ? 'text-gray-500' : 'text-gray-900'}`}>{ticket.departTime}</span>
                        <span className={`text-sm mt-0.5 ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>{ticket.fromStation}</span>
                      </div>
                      <div className="flex flex-col items-center flex-1 mx-4">
                        <div className="flex items-center gap-1">
                          <div className={`h-px w-8 ${isPast ? 'bg-gray-400' : 'bg-app-primary'}`} />
                          <span className={`text-xs font-medium ${isPast ? 'text-gray-500' : 'text-gray-700'}`}>{ticket.trainNo}</span>
                          <div className="relative">
                            <div className={`h-px w-8 ${isPast ? 'bg-gray-400' : 'bg-app-primary'}`} />
                            <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0 border-l-[5px] border-y-[3px] border-y-transparent ${isPast ? 'border-l-gray-400' : 'border-l-app-primary'}`} />
                          </div>
                        </div>
                        <span className={`text-[10px] mt-0.5 ${isPast ? 'text-gray-400' : 'text-gray-400'}`}>{localizeShortDate(ticket.date, isEnglish)} {isEnglish ? `(${localizeWeekday(ticket.dateWeekday, true)})` : `（${ticket.dateWeekday}）`}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-baseline">
                          <span className={`text-2xl font-bold ${isPast ? 'text-gray-500' : 'text-gray-900'}`}>{ticket.arriveTime}</span>
                          {ticket.nextDay && <sup className={`text-[10px] ml-0.5 ${isPast ? 'text-gray-400' : 'text-gray-400'}`}>+1</sup>}
                        </div>
                        <span className={`text-sm mt-0.5 ${isPast ? 'text-gray-400' : 'text-gray-600'}`}>{ticket.toStation}</span>
                      </div>
                    </div>
                  </div>

                  {/* 状态 + 票种 | 支付/购买标签在右侧 */}
                  <div className="px-4 pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${isPast ? 'text-gray-400' : 'text-gray-500'}`}>{localizeRailwayText(ticket.status, isEnglish)}</span>
                        <span className={`text-[10px] border rounded px-1.5 py-0.5 ${isPast ? 'text-gray-400 border-gray-300' : 'text-app-accent border-app-accent'}`}>{localizeRailwayText(ticket.ticketType, isEnglish)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] border border-gray-300 rounded px-1.5 py-0.5 ${isPast ? 'text-gray-400' : 'text-gray-400'}`}>{localizeRailwayText(ticket.paymentType, isEnglish)}</span>
                        <span className={`text-[10px] border border-gray-300 rounded px-1.5 py-0.5 ${isPast ? 'text-gray-400' : 'text-gray-400'}`}>{localizeRailwayText(ticket.purchaseType, isEnglish)}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className={`text-xs ${isPast ? 'text-gray-400' : 'text-gray-500'}`}>{localizeSeatInfo(ticket.seatInfo, isEnglish)}</span>
                      <div className="flex items-center gap-1">
                        <span className={`text-base font-bold ${isPast ? 'text-gray-500' : 'text-app-accent'}`}>¥{ticket.price}</span>
                        {ticket.discount && <span className={`text-[10px] border border-gray-300 rounded px-1 py-0.5 ${isPast ? 'text-gray-400' : 'text-gray-400'}`}>{localizeDiscount(ticket.discount, isEnglish)}</span>}
                      </div>
                    </div>
                  </div>

                  {/* 操作按钮：已过乘车日期不显示改签行与餐饮行 */}
                  {!isPast && (
                    <>
                      <div className="border-t border-gray-100 flex">
                        <button className="flex-1 py-2.5 text-center text-sm text-app-primary border-r border-gray-100">{isEnglish ? 'Reschedule' : '改签'}</button>
                        <button
                          className="flex-1 py-2.5 text-center text-sm text-app-primary border-r border-gray-100"
                          {...bindTap<HTMLButtonElement>('myTickets.openRefundNotice', {
                            params: { id: ticket.orderId },
                          })}
                        >
                          {isEnglish ? 'Refund' : '退票'}
                        </button>
                        <button className="flex-1 py-2.5 text-center text-sm text-app-primary">{isEnglish ? 'Change destination' : '变更到站'}</button>
                      </div>
                      <div className="border-t border-gray-100 flex">
                        <button className="flex-1 py-2.5 text-center text-xs text-gray-600 border-r border-gray-100">{isEnglish ? 'Food & specialty' : '餐饮·特产'}</button>
                        <button className="flex-1 py-2.5 text-center text-xs text-gray-600 border-r border-gray-100">{isEnglish ? 'Book hotel' : '订酒店'}</button>
                        <button className="flex-1 py-2.5 text-center text-xs text-gray-600">{isEnglish ? 'Car rental / ride' : '租车·约车'}</button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          );
        })}

        {groups.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-24">
            <span className="text-gray-400 text-sm">{isEnglish ? 'No ticket information yet' : '暂无车票信息'}</span>
          </div>
        )}
      </div>

      {refundDialogOrderId && (
        <RefundNoticeDialog
          title={s.refund_notice_title}
          message={s.refund_notice_message}
          cancelLabel={s.action_cancel}
          confirmLabel={s.action_confirm}
          cancelProps={bindBack<HTMLButtonElement>()}
          confirmProps={bindTap<HTMLButtonElement>('myTickets.refundConfirm', {
            params: { id: refundDialogOrderId },
          })}
        />
      )}
    </div>
  );
};
