import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcNavBack } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
import { useRailwayStore } from '../state';
import { parseToTimestamp, now as timeNow, fromTimestamp } from '../../../os/TimeService';
import { localizeRailwayText } from '../utils/localizeRailwayItem';
import { useLocale } from '../../../os/locale';
import { RefundNoticeDialog } from '../components/RefundNoticeDialog';

function formatWeekday(dateStr: string, isEnglish: boolean): string {
  const timestamp = parseToTimestamp(`${dateStr}T00:00:00`);
  const date = timestamp ? fromTimestamp(timestamp) : fromTimestamp(timeNow());
  const weekdaysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdaysZh = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return isEnglish ? weekdaysEn[date.getDay()] : weekdaysZh[date.getDay()];
}

function getOrderStatusLabel(status: string, s: ReturnType<typeof useRailwayStrings>): string {
  if (status === 'cancelled') return s.order_status_refunded;
  if (status === 'pending') return s.order_status_pending_payment;
  return s.order_status_paid;
}

export const OrderDetailPage: React.FC = () => {
  const { bindBack, bindTap } = useRailwayGestures();
  const [searchParams] = useSearchParams();
  const [showAllPassengers, setShowAllPassengers] = useState(false);
  const orderId = searchParams.get('id');
  const showRefundNotice = searchParams.get('dialog') === 'refundNotice';
  const orders = useRailwayStore(s => s.orders);
  const s = useRailwayStrings();
  const order = orders.find(o => o.id === orderId);
  const isEnglish = useLocale() === 'en';

  if (!order) {
    return (
      <div className="min-h-full bg-app-bg flex flex-col" data-status-bar-foreground="light">
        <div className="bg-app-primary pt-10 pb-4 px-4 sticky top-0 z-20">
          <div className="flex items-center relative">
            <button className="absolute left-0" {...bindBack<HTMLButtonElement>()}>
              <IcNavBack size={24} className="text-white" />
            </button>
            <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{s.order_detail_title}</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center px-6 text-center text-gray-500">
          {s.order_detail_not_found}
        </div>
      </div>
    );
  }

  const durationText = isEnglish ? '1h 30m' : '1小时30分';
  const createDateStr = order.createTime
    ? order.createTime.substring(0, 10).replace(/-/g, isEnglish ? '/' : '.')
    : order.date.replace(/-/g, isEnglish ? '/' : '.');
  const ticketDateStr = order.date.replace(/-/g, isEnglish ? '/' : '.');
  const statusLabel = getOrderStatusLabel(order.status, s);
  const canRefund = order.status === 'completed';
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="min-h-full bg-[#f6f8fa] flex flex-col relative" data-status-bar-foreground="light">
      {/* Absolute background spanning the top portion */}
      <div className="bg-app-primary absolute top-0 left-0 right-0 h-[240px] z-0 pointer-events-none" />

      {/* Header and Order info in regular flow */}
      <div className="relative z-10 pt-10 px-4">
        <div className="flex items-center relative mb-4">
          <button className="absolute left-0" {...bindBack<HTMLButtonElement>()}>
            <IcNavBack size={26} className="text-white" />
          </button>
          <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{s.order_detail_title}</span>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 flex space-x-1">
            <div className="w-[4px] h-[4px] bg-white rounded-full" />
            <div className="w-[4px] h-[4px] bg-white rounded-full" />
            <div className="w-[4px] h-[4px] bg-white rounded-full" />
          </div>
        </div>

        <div className="flex justify-between items-center text-white/90 text-[12px] mt-6 mb-3 gap-1 whitespace-nowrap overflow-hidden">
          <div className="flex items-center min-w-0 pr-2">
            <span className="truncate">{s.order_detail_order_id.replace('：', '')}:{order.id}</span>
            <span className="border border-white/40 px-1 py-[1.5px] ml-1.5 text-[9.5px] rounded-[2px] leading-none opacity-80 shrink-0">{s.order_detail_copy}</span>
          </div>
          <span className="shrink-0">{s.order_detail_ordered_at.replace('：', '')}:{createDateStr}</span>
        </div>
      </div>

      <div className="relative z-10 px-3 pt-2">
        <div className="bg-white rounded-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.06)] overflow-hidden">
          <div className="pt-6 pb-3 px-4">
            <div className="flex justify-between items-start gap-3">
              <div className="w-[30%] min-w-0">
                <div className="text-[28px] font-semibold text-[#1A1A1A] leading-tight">{order.departTime}</div>
                <div className="text-[14px] text-[#333333] mt-1 flex items-center gap-1 break-words">
                  <span className="min-w-0 break-words">{order.fromStation}</span>
                  <span className="text-[11px] text-gray-400 shrink-0">{'>'}</span>
                </div>
              </div>
              <div className="w-[40%] text-center px-1 pt-2 flex flex-col items-center">
                <div className="text-[14px] text-[#333333] font-medium flex items-center justify-center gap-1">
                  <span className="min-w-0 break-words">{order.trainNo}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{'>'}</span>
                </div>
                <div className="flex items-center mt-1">
                  <div className="w-[10px] h-[1px] bg-[#D7DEE8]" />
                  <div className="px-1 text-[#8396AD] text-[10px] border border-[#E9EEF5] rounded-sm mx-1 leading-tight py-[1px]">
                    {s.incomplete_orders_via}
                  </div>
                  <div className="w-[10px] h-[1px] bg-[#D7DEE8] relative">
                    <div className="absolute right-[-4px] top-[-2px] w-0 h-0 border-l-[4px] border-l-[#D7DEE8] border-y-[3px] border-y-transparent" />
                  </div>
                </div>
                <div className="text-[11px] text-[#999999] mt-1">{s.incomplete_orders_duration} {durationText}</div>
              </div>
              <div className="w-[30%] text-right min-w-0">
                <div className="text-[28px] font-semibold text-[#1A1A1A] leading-tight">{order.arriveTime}</div>
                <div className="text-[14px] text-[#333333] mt-1 flex items-center justify-end gap-1 break-words">
                  <span className="min-w-0 break-words">{order.toStation}</span>
                  <span className="text-[11px] text-gray-400 shrink-0">{'>'}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-4 text-[12px] text-[#666666] gap-3">
              <div className="break-words">{s.order_detail_travel_date}：{ticketDateStr} {formatWeekday(order.date, isEnglish)}</div>
              <div className="shrink-0">{isEnglish ? 'Valid on appointed date' : '车票当日当次有效'}</div>
            </div>
          </div>

          <div className="flex border-t border-b border-[#F2F2F2]">
            <button className={`flex-1 py-3 text-[14px] border-r border-[#F2F2F2] ${isCancelled ? 'text-[#999999]' : 'text-[#333333]'}`}>{s.order_detail_change_destination}</button>
            <button className={`flex-1 py-3 text-[14px] border-r border-[#F2F2F2] ${isCancelled ? 'text-[#999999]' : 'text-[#333333]'}`}>{s.order_detail_reschedule}</button>
            <button
              className={`flex-1 py-3 text-[14px] ${isCancelled ? 'text-[#999999]' : 'text-[#333333]'}`}
              disabled={!canRefund}
              {...bindTap<HTMLButtonElement>('orderDetail.openRefundNotice', {
                params: { id: order.id },
              })}
            >
              {s.order_detail_refund}
            </button>
          </div>

          {(showAllPassengers ? order.tickets : order.tickets.slice(0, 1)).map((ticket, idx) => {
            const primaryColor = isCancelled ? 'text-[#999]' : 'text-[#333]';
            const tagColor = isCancelled ? 'text-[#999] border-[#999]' : 'text-[#5B9BEE] border-[#5B9BEE]';
            const priceColor = isCancelled ? 'text-[#999]' : 'text-[#E76C23]';
            const statusColor = isCancelled ? 'text-[#999]' : 'text-[#333]';

            return (
              <div key={idx} className="px-4 py-4 border-b border-[#F2F2F2]">
                <div className="flex justify-between items-center mb-1.5 gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[15px] ${primaryColor} font-medium break-words`}>{ticket.passengerName}</span>
                    <span className={`text-[11px] border rounded-[3px] px-1.5 py-[1px] leading-none ${tagColor}`}>
                      {localizeRailwayText(ticket.ticketType, isEnglish)}
                    </span>
                  </div>
                  <div className={`text-[13px] ${primaryColor} min-w-0 break-words text-right`}>
                    {localizeRailwayText(ticket.seatType, isEnglish)} {ticket.seatNo || s.order_detail_unassigned_seat}
                  </div>
                </div>
                
                <div className="flex justify-between items-center mb-1.5 gap-3">
                  <div className="text-[13px] text-[#999999]">{localizeRailwayText('中国居民身份证', isEnglish)}</div>
                  <div className={`flex items-baseline gap-0.5 ${priceColor}`}>
                    <span className="text-[14px] font-bold">¥</span>
                    <span className="text-[18px] font-bold">{ticket.price}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[13px] gap-3">
                  <div className={statusColor}>
                    {order.status === 'cancelled' ? s.order_status_refunded : s.order_status_paid}
                  </div>
                  <div className="text-[#5B9BEE]">
                    {order.status === 'cancelled' ? (isEnglish ? 'Refund Details' : '退款详情') : s.incomplete_orders_change_refund}
                  </div>
                </div>

                {isCancelled && (
                  <div className="text-[12px] text-[#999999] mt-1.5">
                    {isEnglish ? 'Transaction No:' : '业务流水号:'}2EK{order.id.slice(2)}001001230035096
                  </div>
                )}
              </div>
            );
          })}

          {order.tickets.length > 1 && (
            <button
              className="w-full py-2.5 text-center text-[14px] text-app-primary border-b border-[#F2F2F2]"
              onClick={() => setShowAllPassengers((v: boolean) => !v)}
            >
              {showAllPassengers
                ? s.orders_collapse
                : s.order_detail_show_more.replace('{n}', String(order.tickets.length - 1))}
            </button>
          )}

          {!isCancelled && (
            <div className="px-3 py-3 flex justify-end gap-2 items-center bg-[#FAFAFA]">
              <button className="px-3 py-[6px] text-[13px] text-[#333333] border border-[#E5E5E5] rounded-[4px] bg-white">{s.order_detail_order_meal}</button>
              <button className="px-3 py-[6px] text-[13px] text-[#333333] border border-[#E5E5E5] rounded-[4px] bg-white">{s.order_detail_travel_insurance}</button>
              <button className="px-3 py-[6px] text-[13px] text-white border border-app-primary rounded-[4px] bg-app-primary flex items-center gap-1">
                <span className="text-[14px] relative -top-[1px]">回</span> {s.order_detail_qr_check_in}
              </button>
            </div>
          )}
        </div>

        <div className="text-center text-[#999999] text-[12.5px] mt-3 flex items-center justify-center gap-1">
          <span className="text-[14px] grayscale opacity-70">🔔</span> {isEnglish ? 'Order info valid for 30 days' : '订单信息查询有效期限为30日'}
        </div>

        {/* --- Advertisement Area starts here --- */}
        <div className="px-3 mt-1.5 pb-2">

          {/* Hotel Ad Banner */}
          <div className="bg-gradient-to-b from-[#FFF0E8] to-[#FFFFFF] rounded-[8px] shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden">
            <div className="flex justify-between items-center h-[24px] bg-gradient-to-r from-[#FFF0E8] to-[#FBE4DD]">
              <div className="flex items-center pl-2.5 gap-1">
                <div className="text-[#E63E3E] font-[900] text-[13px] italic tracking-tight">订酒店</div>
                <div className="text-[#333333] font-bold text-[9px]">出行更方便</div>
                <div className="bg-[#FEE5E4] text-[#E63E3E] text-[8px] px-1 py-0.5 rounded-bl-[4px] rounded-tr-[4px] ml-1 transform scale-90 origin-left">订票用户享75折</div>
              </div>
              <div className="bg-gradient-to-r from-[#E64B4E] to-[#E63E3E] text-white text-[9px] h-full flex items-center px-2 font-medium rounded-bl-[8px]">
                领券订酒店 {'>>'}
              </div>
            </div>
            
            <div className="px-1.5 py-1">
              <div className="bg-white rounded-full border border-[#FFF0E8] shadow-[0_2px_8px_rgba(230,62,62,0.06)] h-[28px] flex items-center px-1">
                <div className="flex-1 flex items-center justify-center gap-1 border-r border-[#EEEEEE]">
                  <span className="text-[#B3B3B3] text-[12px]">🔍</span>
                  <span className="text-[#5B9BEE] text-[13px]">{order.toStation}</span>
                </div>
                
                <div className="flex-[1.8] flex items-center justify-center text-[10px]">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[#5B9BEE] text-[12px] font-medium">{order.date.substring(5).replace('-', '-')}</span>
                    <span className="text-[#999999] text-[8px]">入住</span>
                  </div>
                  <div className="bg-[#F5F5F5] text-[#999999] text-[8px] px-[4px] py-[1px] rounded-full mx-1.5 transform scale-90">1晚</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-[#5B9BEE] text-[12px] font-medium">
                      {String(Number(order.date.substring(8, 10)) + 1).padStart(2, '0')} {/* Naive date + 1 mock */}
                    </span>
                    <span className="text-[#999999] text-[9px]">离店</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* More Services Divider */}
          <div className="flex items-center justify-center mt-3 mb-2">
            <div className="flex items-center justify-end w-[36px] gap-1 mr-2 opacity-50">
              <div className="w-full h-[1px] bg-[#CCCCCC]" />
              <div className="w-[2.5px] h-[2.5px] rounded-full bg-[#CCCCCC]" />
            </div>
            <span className="text-[11px] text-[#666666] font-medium">更多服务</span>
            <div className="flex items-center justify-start w-[36px] gap-1 ml-2 opacity-50">
              <div className="w-[2.5px] h-[2.5px] rounded-full bg-[#CCCCCC]" />
              <div className="w-full h-[1px] bg-[#CCCCCC]" />
            </div>
          </div>

          {/* Services Grid */}
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            <div className="bg-white rounded-[6px] p-2 shadow-[0_2px_8px_rgba(0,0,0,0.02)] relative h-[48px] overflow-hidden">
              <div className="text-[11px] text-[#333333] font-medium leading-tight">订餐·特产</div>
              <div className="text-[9px] text-[#999999] mt-0.5">去预定 {'>'}</div>
              <div className="absolute bottom-0 right-0 text-[24px] opacity-90 transform translate-x-1 translate-y-1">🍱</div>
            </div>
            <div className="bg-white rounded-[6px] p-2 shadow-[0_2px_8px_rgba(0,0,0,0.02)] relative h-[48px] overflow-hidden">
              <div className="text-[11px] text-[#333333] font-medium leading-tight">租车·约车</div>
              <div className="text-[9px] text-[#999999] mt-0.5">去预定 {'>'}</div>
              <div className="absolute bottom-0 right-0 text-[24px] opacity-90 transform -translate-x-[2px] translate-y-1">🚕</div>
            </div>
            <div className="bg-white rounded-[6px] p-2 shadow-[0_2px_8px_rgba(0,0,0,0.02)] relative h-[48px] overflow-hidden">
              <div className="text-[11px] text-[#333333] font-medium leading-tight">门票·旅游</div>
              <div className="text-[9px] text-[#999999] mt-0.5">去查看 {'>'}</div>
              <div className="absolute bottom-0 right-0 text-[24px] opacity-90 transform -translate-x-[2px] translate-y-1">🏖️</div>
            </div>
          </div>

          {/* Bottom Ad Image Mock */}
          <div className="bg-gradient-to-r from-[#90C888] to-[#9BCB96] h-[92px] rounded-[8px] relative overflow-hidden shadow-sm flex flex-col justify-end p-2.5">
            <div className="absolute top-0 right-0 bg-white/20 text-white text-[8px] px-1 rounded-bl">广告</div>
            <div className="text-white text-[15px] font-[900] italic leading-none drop-shadow-md pb-1">五一租车特惠</div>
            <div className="text-[#FFEDCA] text-[20px] font-[900] italic leading-none drop-shadow-md tracking-wider">点击立即查看</div>
          </div>
        </div>
      </div>

      {showRefundNotice && (
        <RefundNoticeDialog
          title={s.refund_notice_title}
          message={s.refund_notice_message}
          cancelLabel={s.action_cancel}
          confirmLabel={s.action_confirm}
          cancelProps={bindBack<HTMLButtonElement>()}
          confirmProps={bindTap<HTMLButtonElement>('orderDetail.refundConfirm', {
            params: { id: order.id },
          })}
        />
      )}
    </div>
  );
};
