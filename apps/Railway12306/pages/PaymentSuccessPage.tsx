import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { IcNavBack } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
import type { OrderRecord } from '../types';
import { getAllStations } from '../data/stations';
import { parseToTimestamp, now as timeNow, fromTimestamp } from '../../../os/TimeService';
import { BackDispatcher } from '../../../os/BackDispatcher';
import { useLocale } from '../../../os/locale';

function formatTripDate(dateStr: string, isEnglish: boolean): string {
  const timestamp = parseToTimestamp(`${dateStr}T00:00:00`);
  const date = timestamp ? fromTimestamp(timestamp) : fromTimestamp(timeNow());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return isEnglish ? `${month}/${day}` : `${month}月${day}日`;
}

export const PaymentSuccessPage: React.FC = () => {
  const location = useLocation();
  const { bindTap, go } = useRailwayGestures();
  const s = useRailwayStrings();
  const isEnglish = useLocale() === 'en';
  const stateOrder = (location.state as { order?: OrderRecord })?.order ?? null;

  React.useEffect(() => {
    const unregister = BackDispatcher.register('railway12306.paymentSuccess.back', () => {
      if (window.__OS__?.state?.activeAppId !== 'railway12306') return false;
      go('paymentSuccess.backHome', {}, { popTo: '/' });
      return true;
    }, 110);
    return unregister;
  }, [go]);

  const order: OrderRecord = stateOrder || {
    id: 'mock-1',
    trainNo: 'S515',
    date: '2026-03-16',
    departTime: '06:36',
    arriveTime: '08:06',
    fromStation: isEnglish ? 'Beijing North' : '北京北',
    toStation: isEnglish ? 'Huairou North' : '怀柔北',
    tickets: [{ passengerName: isEnglish ? 'Wu **' : '吴**', ticketType: isEnglish ? 'Adult Fare' : '成人票', seatType: isEnglish ? 'Second Class' : '二等座', seatNo: '', price: 12.0 }],
    status: 'completed',
    createTime: '',
  };

  const arrivalCity = useMemo(() => {
    const stations = getAllStations();
    const found = stations.find(s => s.name === order.toStation);
    return found?.cityName ?? order.toStation;
  }, [order.toStation]);

  return (
    <div className="min-h-[100dvh] bg-[#F5F7FA] flex flex-col relative overflow-hidden" data-status-bar-foreground="light">
      <div className="absolute top-0 left-0 right-0 h-[160px] bg-gradient-to-b from-[#4886E0] via-[#7BAFF5] to-[#F5F7FA] z-0" />

      <div className="pt-10 pb-3 px-4 flex items-center gap-3 relative z-10">
        <button
          {...bindTap<HTMLButtonElement>('paymentSuccess.backHome', {
            onTrigger: () => go('paymentSuccess.backHome', {}, { popTo: '/' }),
          })}
          className="w-16 shrink-0 flex items-center"
        >
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-[18px] font-medium text-white leading-tight">
          {s.payment_success_title}
        </span>
        <span className="max-w-[42%] shrink-0 text-right text-[14px] text-white leading-tight whitespace-normal break-words">
          {s.payment_success_notification_settings}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto relative z-10 pb-6">
        <div className="mx-3 mt-2 bg-white rounded-[12px] pt-4 px-4 pb-2 shadow-sm">
          <div className="flex justify-between items-center gap-3">
            <div className="flex flex-col items-start w-[32%] min-w-0">
              <span className="text-[36px] font-semibold text-[#222] leading-none">{order.departTime}</span>
              <span className="text-[16px] text-[#333] mt-2 break-words">{order.fromStation}</span>
              <span className="text-[13px] text-[#999] mt-1 break-words">{order.tickets.map(t => t.passengerName).join(', ')}</span>
            </div>

            <div className="flex flex-col items-center w-[36%]">
              <span className="text-[16px] text-[#333] font-medium">{order.trainNo}</span>
              <div className="flex items-center w-full my-1 relative">
                <div className="h-[1px] flex-1 bg-[#ccc]" />
                <div className="w-0 h-0 border-l-[6px] border-l-[#ccc] border-y-[4px] border-y-transparent absolute right-0 top-1/2 -translate-y-1/2" />
              </div>
              <span className="text-[12px] text-[#999]">{formatTripDate(order.date, isEnglish)}</span>
            </div>

            <div className="flex flex-col items-end w-[32%] min-w-0">
              <span className="text-[36px] font-semibold text-[#222] leading-none">{order.arriveTime}</span>
              <span className="text-[16px] text-[#333] mt-2 break-words">{order.toStation}</span>
              <span className="text-[13px] text-transparent mt-1">-</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              {...bindTap<HTMLButtonElement>('paymentSuccess.backOrders', {
                onTrigger: () => go('paymentSuccess.backOrders', {}, { popTo: '/', mode: 'push' }),
              })}
              className="py-1.5 border border-[#9AC2EB] rounded-[6px] text-[13px] text-[#4886E0] text-center leading-tight whitespace-normal break-words"
            >
              {s.payment_success_order_details}
            </button>
            <button className="py-1.5 border border-[#9AC2EB] rounded-[6px] text-[13px] text-[#4886E0] text-center leading-tight whitespace-normal break-words">
              {s.payment_success_meal_reservation}
            </button>
            <button className="py-1.5 border border-[#9AC2EB] rounded-[6px] text-[13px] text-[#4886E0] text-center relative leading-tight whitespace-normal break-words">
              {s.payment_success_trip_assistance}
              <span className="absolute -top-2 -right-1 bg-[#FF6B00] text-white text-[9px] px-1 rounded-tl-[4px] rounded-br-[4px] rounded-tr-[4px]">
                {s.payment_success_hot}
              </span>
            </button>
            <button className="py-1.5 border border-[#9AC2EB] rounded-[6px] text-[13px] text-[#4886E0] text-center leading-tight whitespace-normal break-words">
              {s.payment_success_pack_light}
            </button>
          </div>

          <div className="flex justify-between items-center mt-2 pt-2 border-t border-[#F0F0F0] gap-3">
            <span className="text-[13px] text-[#666] break-words">
              {s.payment_success_share_text}
            </span>
            <button className="flex items-center text-[#28C445] text-[13px] border border-[#28C445] rounded-full px-2 py-0.5 shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              {s.payment_success_share_now}
            </button>
          </div>
        </div>

        <div className="mx-3 mt-3 bg-white rounded-[12px] overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-[#FDF6F8] to-[#FFF] p-3 border-b border-[#F5F5F5]">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-[#9C51E0] rounded-full flex items-center justify-center shrink-0">
                <span className="text-white text-[10px] font-bold">H</span>
              </div>
              <span className="text-[16px] font-semibold text-[#333] mr-2 break-words">
                {s.payment_success_hotel_deals.replace('{city}', arrivalCity)}
              </span>
              <span className="bg-[#FF4D4F] text-white text-[10px] px-1.5 py-0.5 rounded-[4px]">75% off</span>
              <span className="ml-auto text-[13px] text-[#FF6B00] font-medium flex items-center">
                {s.payment_success_hotel_offer}
                <span className="text-[#CCC] ml-1">{'>'}</span>
              </span>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-[16px] font-medium">03-16 <span className="text-[12px] font-normal text-[#666]">{s.payment_success_check_in}</span></span>
              </div>
              <div className="text-[12px] text-[#999] border-b border-[#EEE] px-6 pb-1">1 {s.payment_success_night}</div>
              <div className="flex flex-col text-right">
                <span className="text-[16px] font-medium">03-17 <span className="text-[12px] font-normal text-[#666]">{s.payment_success_check_out}</span></span>
              </div>
            </div>
            <div className="flex justify-between items-center mt-3 gap-3">
              <button className="flex-1 bg-[#4886E0] text-white rounded-[20px] py-1.5 text-[14px] font-medium mr-3">
                {s.payment_success_claim_coupon} {'>'}
              </button>
              <div className="bg-[#FFF8E6] text-[#D48806] border border-[#FFE58F] rounded-[4px] px-2 py-0.5 flex flex-col items-center justify-center w-[70px]">
                <span className="text-[13px] font-bold leading-none">¥120</span>
                <span className="text-[10px] leading-none mt-0.5">{s.payment_success_hotel_coupon}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-3 mt-3 rounded-[12px] overflow-hidden relative h-[80px] bg-[#E8F3E9]">
          <div className="absolute inset-0 flex items-center px-4">
            <div className="flex flex-col z-10">
              <span className="text-[#2E7D32] text-[20px] font-bold italic drop-shadow-sm">
                {s.payment_success_car_rental_deals}
              </span>
              <span className="text-[#FF6B00] text-[16px] font-black italic mt-1 bg-white/80 px-2 rounded-full inline-block w-fit">
                {s.payment_success_view_now}
              </span>
            </div>
            <div className="ml-auto w-[120px] h-full relative">
              <div className="absolute right-0 bottom-0 w-20 h-20 bg-[#4CAF50] rounded-full opacity-20 translate-x-4 translate-y-4" />
              <div className="absolute right-10 top-2 w-10 h-10 bg-[#FF9800] rounded-full opacity-20" />
            </div>
          </div>
          <div className="absolute bottom-1.5 left-4 text-[#666] text-[9px]">
            {s.payment_success_activity_period}
          </div>
          <div className="absolute bottom-1.5 right-1.5 bg-black/20 text-white text-[8px] px-1 rounded">
            {s.payment_success_ad}
          </div>
        </div>

        <div className="mx-3 mt-3 bg-white rounded-[12px] p-3 shadow-sm">
            <div className="flex items-center mb-2">
              <div className="w-4 h-4 bg-[#FF6B00] rounded-full flex items-center justify-center mr-2">
                <span className="text-white text-[9px] font-bold">M</span>
              </div>
            <span className="text-[15px] font-semibold text-[#333]">{s.paid_orders_ad_title}</span>
          </div>
          <div className="flex items-center justify-between bg-white rounded-[24px] pl-3 pr-1 py-0.5 border border-[#FFE4D6] shadow-[0_2px_8px_rgba(255,107,0,0.08)] gap-3">
            <div className="flex items-center min-w-0">
              <span className="text-[#FF6B00] mr-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                  <path d="M7 2v20" />
                  <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                </svg>
              </span>
              <span className="text-[14px] text-[#333] font-medium break-words">
                {s.payment_success_dining_desc}
              </span>
            </div>
            <button className="bg-gradient-to-r from-[#FF8C00] to-[#FF5500] text-white text-[12px] px-4 py-1.5 rounded-[20px] font-medium shrink-0">
              {s.paid_orders_book_now}
            </button>
          </div>
        </div>

        <div className="mx-3 mt-3 bg-white rounded-[12px] p-4 shadow-sm">
          <div className="flex items-center mb-3">
            <div className="w-5 h-5 bg-[#4886E0] rounded-full flex items-center justify-center mr-2">
              <span className="text-white text-[10px] font-bold">R</span>
            </div>
            <span className="text-[16px] font-semibold text-[#333] mr-2">{s.payment_success_car_rental_title}</span>
            <span className="bg-[#FFF0E6] text-[#FF6B00] text-[11px] px-1.5 py-0.5 rounded-[4px]">
              {s.payment_success_car_rental_offer}
            </span>
          </div>
          <div className="flex items-center justify-between mt-2 gap-3">
            <div className="text-[14px] text-[#333] min-w-0 break-words">
              <span className="text-[#999]">{s.payment_success_pickup} · </span>{arrivalCity}
              <span className="mx-3" />
              <span className="text-[#999]">{s.payment_success_duration} · </span>2 {s.payment_success_days}
            </div>
            <button className="bg-[#4886E0] text-white text-[13px] px-4 py-1.5 rounded-[16px] shrink-0">
              {s.payment_success_choose_car} {'>'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
