import React, { useEffect, useMemo, useState } from 'react';
import { IcNavBack, IcExpand, IcCollapse, IcClock3 } from '../res/icons';
import { useLocation } from 'react-router-dom';
import { useRailwayStore } from '../state';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
import { useShallow } from 'zustand/react/shallow';
import { EmptyState } from '../components/EmptyState';
import { fromTimestamp, now as timeNow, parseToTimestamp } from '../../../os/TimeService';
import { getOrderTotalPrice } from '../types';
import { localizeRailwayText } from '../utils/localizeRailwayItem';
import { useLocale } from '../../../os/locale';

const WEEK_DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEK_DAYS_ZH = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatTripDate(dateStr: string, isEnglish: boolean): string {
  const timestamp = parseToTimestamp(`${dateStr}T00:00:00`);
  const date = timestamp ? fromTimestamp(timestamp) : fromTimestamp(timeNow());
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return isEnglish ? `${yyyy}/${mm}/${dd} ${WEEK_DAYS_EN[date.getDay()]}` : `${yyyy}年${mm}月${dd}日 ${WEEK_DAYS_ZH[date.getDay()]}`;
}

function formatRemain(ms: number): string {
  const safeMs = Math.max(0, ms);
  const minutes = Math.floor(safeMs / 60000);
  const seconds = Math.floor((safeMs % 60000) / 1000);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDuration(departTime: string, arriveTime: string, isEnglish: boolean): string {
  const [departHour = '0', departMinute = '0'] = departTime.split(':');
  const [arriveHour = '0', arriveMinute = '0'] = arriveTime.split(':');
  const departTotal = Number(departHour) * 60 + Number(departMinute);
  let arriveTotal = Number(arriveHour) * 60 + Number(arriveMinute);
  if (arriveTotal < departTotal) arriveTotal += 24 * 60;
  const diff = Math.max(0, arriveTotal - departTotal);
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  return isEnglish ? `${hours}h ${minutes}m` : `${hours}小时${minutes}分`;
}

export const IncompleteOrdersPage: React.FC = () => {
  const state = useRailwayStore(useShallow(s => ({ orders: s.orders, passengers: s.passengers })));
  const updateOrder = useRailwayStore(s => s.updateOrder);
  const { bindBack, go } = useRailwayGestures();
  const s = useRailwayStrings();
  const location = useLocation();
  const isEnglish = useLocale() === 'en';
  const fromOrders = new URLSearchParams(location.search).get('from') === 'orders';
  const [showAmountSheet, setShowAmountSheet] = useState(false);
  const [showAllPassengers, setShowAllPassengers] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [currentTs, setCurrentTs] = useState(() => timeNow());

  const pendingOrder = useMemo(
    () => state.orders.find(order => order.status === 'pending') ?? null,
    [state.orders],
  );

  useEffect(() => {
    if (!pendingOrder) return;
    const timer = window.setInterval(() => {
      setCurrentTs(timeNow());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pendingOrder]);

  if (!pendingOrder) {
    return (
      <div className="min-h-full bg-app-bg" data-status-bar-foreground="light">
        <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center relative sticky top-0 z-20">
          <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
            <IcNavBack size={24} className="text-white" />
          </button>
          <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">
            {s.incomplete_orders_title}
          </span>
        </div>
        <EmptyState message={s.incomplete_orders_empty} />
      </div>
    );
  }

  const createTs = parseToTimestamp(pendingOrder.createTime);
  const expireTs = (createTs || currentTs) + 20 * 60 * 1000;
  const remainText = formatRemain(expireTs - currentTs);
  const durationText = formatDuration(pendingOrder.departTime, pendingOrder.arriveTime, isEnglish);
  const totalPrice = getOrderTotalPrice(pendingOrder);
  const tickets = pendingOrder.tickets;

  return (
    <div className="min-h-full bg-[#FAFAFA] pb-[140px]" data-status-bar-foreground="light">
      <div className="bg-[#4FA4F7] pt-12 pb-3 sticky top-0 z-20">
        <div className="flex items-center justify-between px-4">
          <button className="flex items-center justify-center p-1" onClick={() => setShowLeaveConfirm(true)}>
            <IcNavBack size={26} className="text-white" />
          </button>
          <span className="text-[18px] text-white font-medium">{s.incomplete_orders_title}</span>
          <div className="w-8" />
        </div>
        <div className="px-4 mt-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-1.5 text-[15px]">
            <IcClock3 size={16} className="opacity-90" />
            <span className="font-medium">{s.incomplete_orders_title}</span>
          </div>
          <div className="text-[14px]">
            {s.incomplete_orders_remaining}<span className="ml-1 font-medium text-[16px] tracking-wide font-mono">{remainText}</span>
          </div>
        </div>
      </div>

      <div className="mx-3 mt-3 rounded-[12px] bg-white overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="w-[30%] min-w-0">
              <div className="text-[32px] leading-none text-[#20242E] font-medium">{pendingOrder.departTime}</div>
              <div className="mt-1 text-[14px] text-[#2D3440] font-medium flex items-center gap-0.5 break-words">
                {pendingOrder.fromStation} <span className="text-[#A5B0BF] text-[10px] scale-75 origin-left tracking-tighter">{'>'}</span>
              </div>
            </div>
            <div className="w-[40%] text-center px-1 pt-1 flex flex-col items-center">
              <div className="text-[14px] font-medium text-[#20242E] flex items-center gap-0.5">
                {pendingOrder.trainNo} <span className="text-[#A5B0BF] text-[10px] scale-75 origin-left tracking-tighter">{'>'}</span>
              </div>
              <div className="mt-[3px] px-1 py-[1.5px] rounded-[10px] text-[9px] text-[#8C95A3] border border-[#DEE2E8] leading-none">
                {s.incomplete_orders_via}
              </div>
              <div className="mt-1 text-[10px] text-[#8C95A3]">{s.incomplete_orders_duration}{durationText}</div>
            </div>
            <div className="w-[30%] text-right min-w-0">
              <div className="text-[32px] leading-none text-[#20242E] font-medium">{pendingOrder.arriveTime}</div>
              <div className="mt-1 text-[14px] text-[#2D3440] font-medium flex items-center justify-end gap-0.5 break-words">
                {pendingOrder.toStation} <span className="text-[#A5B0BF] text-[10px] scale-75 origin-right tracking-tighter">{'>'}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 text-[13px] text-[#525C6A]">{s.incomplete_orders_departure}{formatTripDate(pendingOrder.date, isEnglish)}</div>
        </div>

        <div className="mx-3 border-t border-dashed border-[#EEF2F6]" />

        {(showAllPassengers ? tickets : tickets.slice(0, 1)).map((ticket, idx) => {
          const psgr = state.passengers.find(p => p.name === ticket.passengerName);
          const seatText = ticket.seatNo
            ? `${localizeRailwayText(ticket.seatType, isEnglish)} ${ticket.seatNo}`
            : localizeRailwayText(ticket.seatType, isEnglish);
          return (
            <div key={idx} className="px-4 py-3 border-b border-[#EEF2F6] last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[15px] text-[#20242E] font-medium break-words">{ticket.passengerName}</span>
                  <span className="text-[11px] text-[#4FA4F7] font-medium border border-[#4FA4F7] rounded-[2px] px-1 py-[1.5px] leading-none">
                    {localizeRailwayText(ticket.ticketType, isEnglish)}
                  </span>
                </div>
                <div className="flex items-end gap-1 shrink-0">
                  <span className="text-[18px] text-[#DA6722] font-semibold leading-none">¥{ticket.price}</span>
                  <span className="text-[10px] text-[#A5B0BF] pb-[2px]">{s.incomplete_orders_discount}</span>
                </div>
              </div>
              <div className="mt-3 text-[13px] text-[#8C95A3] flex items-center justify-between gap-3">
                <span className="break-words">{localizeRailwayText(psgr?.idType || '中国居民身份证', isEnglish)}</span>
                <span className="text-[#4FA4F7]">{s.incomplete_orders_change_refund}</span>
              </div>
              <div className="mt-2.5 text-[15px] text-[#242A36] font-medium break-words">
                {seatText}
              </div>
            </div>
          );
        })}

        {tickets.length > 1 && (
          <button
            className="w-full py-2.5 text-center text-[14px] text-[#4FA4F7]"
            onClick={() => setShowAllPassengers(v => !v)}
          >
            {showAllPassengers ? s.orders_collapse : s.incomplete_orders_show_more.replace('{n}', String(tickets.length - 1))}
          </button>
        )}
      </div>

      <div className="mx-3 mt-2.5 rounded-[12px] bg-[#FEF6DF] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div className="px-3.5 pt-3 pb-2 text-[15px] font-semibold text-[#B37424] italic">
          {s.incomplete_orders_insurance_title}
        </div>
        <div className="mx-[6px] rounded-[10px] bg-white p-3 flex shadow-sm">
          <div className="w-[60px] h-[60px] rounded-[6px] bg-gradient-to-b from-[#CDE3F3] to-[#E5EFF8]" />
          <div className="ml-3 flex-1 relative flex flex-col justify-center min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] text-[#242A36] font-medium break-words">
                {s.incomplete_orders_insurance_main_title}
              </span>
              <span className="text-[10px] text-[#9098A3] border border-[#DCE4EC] rounded-[2px] px-1 py-[1.5px] leading-none">
                {s.incomplete_orders_insurance_more_products} {'>'}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-[#E08D5B]">
              {s.incomplete_orders_insurance_desc}
            </div>
            <div className="mt-1 text-[16px] text-[#DA6722] font-semibold flex items-baseline">
              ¥<span className="text-[20px] mx-[1px]">3</span><span className="text-[11px] text-[#DA6722] font-normal">{s.incomplete_orders_insurance_unit}</span>
            </div>
            <div className="mt-2 flex gap-1 text-[10px] text-[#4CB56E]">
              <span className="px-1 py-[1.5px] rounded-[2px] border border-[#BCE1C8] leading-none">{s.incomplete_orders_insurance_accident}</span>
              <span className="px-1 py-[1.5px] rounded-[2px] border border-[#BCE1C8] leading-none">{s.incomplete_orders_insurance_medical}</span>
              <span className="px-1 py-[1.5px] rounded-[2px] border border-[#BCE1C8] leading-none">{s.incomplete_orders_insurance_liability}</span>
            </div>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-[1.5px] border-[#DCE4EC]" />
          </div>
        </div>
        <div className="px-3.5 py-3 text-[11px] text-[#9E631B]">
          {s.incomplete_orders_please_read}<span className="font-medium"> {s.incomplete_orders_purchase_notice}</span>、<span className="font-medium">{s.incomplete_orders_policy_terms}</span> {s.common_and} <span className="font-medium">{s.incomplete_orders_disclaimer}</span>
        </div>
      </div>

      <div className="mx-3 mt-2.5 h-[46px] rounded-[12px] bg-gradient-to-r from-[#4F8BE3] to-[#6EB1F6] px-4 flex items-center justify-between text-white shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-[64px] h-[22px] bg-white/20 rounded-[4px] flex items-center justify-center font-bold italic text-[14px]">{s.service_ecard}</div>
          <div className="text-[10px] border border-white/60 rounded-[2px] px-1 py-[1px] leading-none">{s.incomplete_orders_quick_pay_badge}</div>
          <div className="text-[11px] ml-1">{s.incomplete_orders_quick_pay_scan} {'>'}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[16px] font-bold italic mr-1">GO</span>
          <div className="w-8 h-4 bg-white/30 rounded-full flex items-center p-[2px]"><div className="w-3 h-3 rounded-full bg-white" /></div>
        </div>
      </div>

      {showAmountSheet && (
        <button
          className="fixed inset-0 bg-black/45 z-[55]"
          onClick={() => setShowAmountSheet(false)}
        />
      )}

      <div className="fixed left-0 right-0 bottom-0 z-[60] bg-[#FAFAFA] border-t border-[#EDEDED] pb-[calc(env(safe-area-inset-bottom)+8px)]">
        {showAmountSheet && (
          <div className="overflow-hidden shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
            <div className="bg-[#4FA4F7] py-3 text-center text-white text-[16px] font-medium">
              {s.incomplete_orders_order_total}
            </div>
            <div className="bg-white px-5 py-3.5 flex items-center justify-between border-b border-[#F0F2F5]">
              <span className="text-[#20242E] text-[15px]">{s.incomplete_orders_ticket_price}</span>
              <span className="text-[#DA6722] text-[16px] font-medium">¥{totalPrice}</span>
            </div>
          </div>
        )}
        <div className="h-[46px] px-4 flex items-center justify-between bg-white">
          <span className="text-[13px] text-[#A5B0BF]">
            {s.incomplete_orders_total} <span className="text-[#DA6722] text-[20px] font-bold tracking-tight inline-block ml-0.5">¥{totalPrice}</span>
          </span>
          <button
            className="text-[13px] text-[#A5B0BF] flex items-center gap-0.5"
            onClick={() => setShowAmountSheet(v => !v)}
          >
            <span>{s.incomplete_orders_details}</span>
            {showAmountSheet ? <IcExpand size={16} /> : <IcCollapse size={16} />}
          </button>
        </div>
        <div className="flex items-center px-4 pt-2 pb-1">
          <button
            className="flex-1 text-center py-2.5 text-[16px] text-[#8C95A3] h-[46px] flex items-center justify-center"
            onClick={() => setShowCancelConfirm(true)}
          >
            {s.incomplete_orders_cancel_order}
          </button>
          <div className="flex flex-[2] gap-3 pl-2">
            <button className="flex-1 h-[42px] rounded-[6px] bg-[#E8F2FD] text-[#4FA4F7] text-[16px] font-medium flex items-center justify-center">
              {s.incomplete_orders_buy_return}
            </button>
            <button
              className="flex-1 h-[42px] rounded-[6px] bg-[#E08D5B] text-white text-[16px] font-medium flex items-center justify-center shadow-[0_2px_6px_rgba(224,141,91,0.3)]"
              onClick={() => setShowPaymentSheet(true)}
            >
              {s.incomplete_orders_pay_now}
            </button>
          </div>
        </div>
      </div>

      {showCancelConfirm && (
        <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center px-10">
          <div className="bg-white rounded-xl w-full max-w-[280px] overflow-hidden">
            <div className="px-5 pt-5 pb-4 text-center">
              <p className="text-[16px] font-medium text-[#2B3038]">{s.common_notice}</p>
              <p className="mt-3 text-[14px] text-[#525C6A] leading-relaxed">
                {s.incomplete_orders_cancel_confirm_message}
              </p>
            </div>
            <div className="flex border-t border-[#F0F2F5]">
              <button
                className="flex-1 py-3 text-[16px] text-[#8C95A3] border-r border-[#F0F2F5]"
                onClick={() => setShowCancelConfirm(false)}
              >
                {s.action_cancel}
              </button>
              <button
                className="flex-1 py-3 text-[16px] text-white font-medium bg-[#4FA4F7] rounded-br-xl"
                onClick={() => {
                  updateOrder(pendingOrder.id, { status: 'cancelled' });
                  setShowCancelConfirm(false);
                  if (fromOrders) go('incompleteOrders.backOrders');
                  else go('incompleteOrders.backHome');
                }}
              >
                {s.incomplete_orders_confirm_cancel}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingOrder.seatReassigned && !pendingOrder.seatReassignedAcked && (
        <div className="fixed inset-0 z-[130] bg-black/45 flex items-center justify-center px-10">
          <div className="bg-white rounded-2xl w-full max-w-[300px] overflow-hidden px-5 pt-5 pb-4">
            <p className="text-center text-[17px] font-medium text-[#2B3038]">{s.common_notice}</p>
            <p className="mt-3 text-[14px] text-[#525C6A] leading-relaxed">
              {s.incomplete_orders_seat_reassigned_message}
            </p>
            <button
              className="mt-5 w-full h-[44px] rounded-[10px] bg-[#4FA4F7] text-white text-[16px] font-medium"
              onClick={() => updateOrder(pendingOrder.id, { seatReassignedAcked: true })}
            >
              {s.action_confirm}
            </button>
          </div>
        </div>
      )}

      {showLeaveConfirm && (
        <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center px-10">
          <div className="bg-white rounded-xl w-full max-w-[280px] overflow-hidden">
            <div className="px-5 pt-5 pb-4 text-center">
              <p className="text-[16px] font-medium text-[#2B3038]">{s.common_notice}</p>
              <p className="mt-3 text-[14px] text-[#525C6A] leading-relaxed">
                {s.incomplete_orders_leave_confirm_message}
              </p>
            </div>
            <div className="flex border-t border-[#F0F2F5]">
              <button
                className="flex-1 py-3 text-[16px] text-[#8C95A3] border-r border-[#F0F2F5]"
                onClick={() => setShowLeaveConfirm(false)}
              >
                {s.action_cancel}
              </button>
              <button
                className="flex-1 py-3 text-[16px] text-[#4FA4F7] font-medium"
                onClick={() => {
                  setShowLeaveConfirm(false);
                  if (fromOrders) go('incompleteOrders.backOrders');
                  else go('incompleteOrders.backHome');
                }}
              >
                {s.action_confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPaymentSheet && (
        <div className="fixed inset-0 z-[120] flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/45" onClick={() => setShowPaymentSheet(false)} />
          <div className="relative bg-[#FAFAFA] rounded-t-[16px] flex flex-col max-h-[90vh]">
            <div className="relative py-4 shrink-0 bg-white rounded-t-[16px]">
              <div className="text-center text-[16px] font-medium text-[#222]">{s.incomplete_orders_order_payment}</div>
              <button
                className="absolute right-4 top-4 text-[#999]"
                onClick={() => setShowPaymentSheet(false)}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <div className="text-center mt-3 flex items-baseline justify-center font-mono tracking-tight">
                <span className="text-[20px] font-bold text-[#222]">¥</span>
                <span className="text-[36px] font-bold text-[#222] ml-0.5">{totalPrice}</span>
              </div>
            </div>

            <div className="overflow-y-auto no-scrollbar flex-1 pb-safe pt-3">
              <div className="mx-3 bg-white rounded-[12px] border border-[#EEF2F6] overflow-hidden mb-3">
                <div className="px-3 pt-3 pb-2 flex items-center gap-1.5">
                  <span className="text-[15px] font-bold text-[#1F4186] italic">{s.incomplete_orders_choose_payment_method}</span>
                </div>
                <div className="px-3 pb-3">
                  <div className="h-[46px] rounded-lg bg-gradient-to-r from-[#598EE3] to-[#7BC2F8] px-3 flex items-center justify-between text-white relative mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="font-bold italic text-[15px]">{s.service_ecard}</div>
                      <div className="flex flex-col items-start gap-0.5 ml-1">
                        <div className="text-[9px] bg-white text-[#4FA4F7] px-1 rounded-[2px] leading-none mb-0.5 font-medium tracking-tight">
                          {s.incomplete_orders_quick_pay_badge}
                        </div>
                        <div className="text-[10px]">{s.incomplete_orders_quick_pay_scan}<span className="text-[8px]">{'>'}</span></div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center italic text-[#4FA4F7] font-black text-[14px]">GO</div>
                      <div className="w-[18px] h-[18px] rounded-full border border-white/60" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 pb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#E8F1FC] text-[#4FA4F7] flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9c0-.28.22-.5.5-.5h3c.28 0 .5.22.5.5v9c0 .28-.22.5-.5.5h-3c-.28 0-.5-.22-.5-.5z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-[15px] font-medium text-[#222]">{s.incomplete_orders_other_payment_methods}</div>
                        <div className="text-[11px] text-[#9098A3] mt-[1px]">{s.incomplete_orders_other_payment_desc}</div>
                      </div>
                    </div>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="#4FA4F7"><circle cx="12" cy="12" r="10" /><path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </div>
                </div>
              </div>

              <div className="px-3 mb-2 flex items-end gap-2">
                <div className="font-bold text-[15px] text-[#A67137] italic">{s.incomplete_orders_insurance_title}</div>
                <div className="text-[11px] text-[#A67137]/80 mb-[2px] bg-[#E8BC92]/20 px-1.5 py-[2px] rounded-full">
                  {s.incomplete_orders_add_protection}
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto px-3 pb-4 no-scrollbar">
                <div className="shrink-0 w-[105px] h-[110px] bg-[#FFF5F0] border-[1.5px] border-[#DE723D] rounded-xl relative flex flex-col">
                  <div className="absolute top-0 right-0 w-6 h-6 bg-[#DE723D] rounded-bl-lg rounded-tr-[10.5px] flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <div className="flex-1 flex items-center justify-center text-[15px] font-medium text-[#222]">{s.incomplete_orders_no_coverage}</div>
                  <div className="h-0 border-t border-dashed border-[#DE723D]/30 mx-3" />
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-[#DE723D] text-[18px] opacity-70">✕</div>
                  </div>
                </div>

                <div className="shrink-0 w-[115px] h-[110px] bg-white border border-[#EEF2F6] rounded-xl relative flex flex-col">
                  <div className="absolute top-0 left-0 bg-[#3BBA6A] text-white text-[9px] px-1.5 py-0.5 rounded-br-lg rounded-tl-[10.5px]">
                    {s.incomplete_orders_best_value}
                  </div>
                  <div className="absolute top-1 right-1 w-4 h-4 bg-[#EEF2F6] rounded-full flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#A5B0BF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center mt-3">
                    <div className="text-[13px] font-medium text-[#222]">{s.incomplete_orders_accident_medical_plan}</div>
                    <div className="mt-0.5 flex items-baseline">
                      <span className="text-[#DA6722] text-[12px] font-bold">¥3</span>
                      <span className="text-[#999] text-[10px]"> / {s.incomplete_orders_person}</span>
                    </div>
                  </div>
                  <div className="h-0 border-t border-dashed border-[#EEF2F6] mx-3" />
                  <div className="flex-[0.8] flex items-center justify-center">
                    <div className="text-[10px] text-[#A5B0BF]">{s.incomplete_orders_max_payout}<span className="text-[#4FA4F7]">¥550,000</span> <span className="text-[#4FA4F7] scale-75 inline-block">{'>'}</span></div>
                  </div>
                </div>

                <div className="shrink-0 w-[115px] h-[110px] bg-white border border-[#EEF2F6] rounded-xl relative flex flex-col">
                  <div className="absolute top-1 right-1 w-4 h-4 bg-[#EEF2F6] rounded-full flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#A5B0BF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center mt-3">
                    <div className="text-[13px] font-medium text-[#222]">{s.incomplete_orders_accident_luggage_plan}</div>
                    <div className="mt-0.5 flex items-baseline">
                      <span className="text-[#DA6722] text-[12px] font-bold">¥5</span>
                      <span className="text-[#999] text-[10px]"> / {s.incomplete_orders_person}</span>
                    </div>
                  </div>
                  <div className="h-0 border-t border-dashed border-[#EEF2F6] mx-3" />
                  <div className="flex-[0.8] flex items-center justify-center">
                    <div className="text-[10px] text-[#A5B0BF]">{s.incomplete_orders_max_payout}<span className="text-[#4FA4F7]">¥880,000</span> <span className="text-[#4FA4F7] scale-75 inline-block">{'>'}</span></div>
                  </div>
                </div>
              </div>

              <div className="px-4 pb-4">
                <div className="text-center text-[11px] text-[#222] mb-3">
                  {s.incomplete_orders_please_read}<span className="text-[#4FA4F7]">{s.incomplete_orders_purchase_notice}</span>、<span className="text-[#4FA4F7]">{s.incomplete_orders_policy_terms}</span> {s.common_and}<span className="text-[#4FA4F7]">{s.incomplete_orders_disclaimer}</span>
                </div>
                <button
                  className="w-full h-[46px] rounded-[8px] bg-[#4FA4F7] text-white text-[17px] font-medium"
                  onClick={() => {
                    setShowPaymentSheet(false);
                    go('incompleteOrders.paymentPlatform.open', { from: fromOrders ? 'orders' : 'home' });
                  }}
                >
                  {s.incomplete_orders_go_pay}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
