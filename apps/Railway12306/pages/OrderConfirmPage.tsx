import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IcWarning, IcCalendar, IcCheck, IcNavBack, IcAdd, IcTicket, IcClose } from '../res/icons';
import { useLocation } from 'react-router-dom';
import { useRailwayStore, maskIdNo } from '../state';
import { randomSeatNo, supportsPositionPick, buildSeatNosFromPositions, computeSeatReassignProbability } from '../types';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useShallow } from 'zustand/react/shallow';
import { fromTimestamp, getISOString, now as timeNow, parseToTimestamp } from '../../../os/TimeService';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import type { StringKey } from '../res/strings';
type Strings = Record<StringKey, string>;

function formatDatePill(dateStr: string, s: Strings): string {
  const timestamp = parseToTimestamp(`${dateStr}T00:00:00`);
  const date = timestamp ? fromTimestamp(timestamp) : fromTimestamp(timeNow());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const dayNames = [s.day_sun, s.day_mon, s.day_tue, s.day_wed, s.day_thu, s.day_fri, s.day_sat];
  return `${mm}${s.date_suffix_month}${dd}${s.date_suffix_day} ${dayNames[date.getDay()]}`;
}

function seatCountLabel(count: number, s: Strings): string {
  if (count === -1) return s.seat_waitlist;
  if (count === 0) return s.seat_none;
  return s.seat_available_short;
}

export const OrderConfirmPage: React.FC = () => {
  const state = useRailwayStore(useShallow(s => ({
    selectedTrain: s.selectedTrain, passengers: s.passengers, orders: s.orders,
    date: s.date, isStudent: s.isStudent, directTrains: s.directTrains,
  })));
  const addOrder = useRailwayStore(s => s.addOrder);
  const updateOrder = useRailwayStore(s => s.updateOrder);
  const setSelectedTrain = useRailwayStore(s => s.setSelectedTrain);
  const { bindBack, bindTap, go } = useRailwayGestures();
  const s = useAppStrings(strings, stringsEn);
  const location = useLocation();
  const [selectedSeat, setSelectedSeat] = useState('');
  const [showTip, setShowTip] = useState(true);
  const [showProcessing, setShowProcessing] = useState(false);
  const [selectedSeatPositions, setSelectedSeatPositions] = useState<string[]>([]);
  const submitTimerRef = useRef<number | null>(null);

  const urlParams = new URLSearchParams(location.search);
  const queryIdx = urlParams.get('idx');
  const querySeat = urlParams.get('seat') || '';
  const trainIndex = Number.parseInt(queryIdx || `${state.selectedTrain?.trainIndex ?? 0}`, 10);
  const train = state.directTrains[trainIndex] || state.directTrains[0];

  const seatOptions = useMemo(
    () => train?.seats.filter(seat => seat.price > 0) ?? [],
    [train],
  );

  const hasMatchingDraft = !!(
    state.selectedTrain
    && train
    && state.selectedTrain.trainNo === train.trainNo
    && state.selectedTrain.trainIndex === trainIndex
  );

  const selectedPassengerIds = hasMatchingDraft ? state.selectedTrain?.passengerIds ?? [] : [];
  const selectedPassengers = state.passengers.filter(passenger => selectedPassengerIds.includes(passenger.id));
  const passengerIdsKey = selectedPassengerIds.join(',');

  useEffect(() => {
    return () => {
      if (submitTimerRef.current !== null) {
        window.clearTimeout(submitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!train) return;

    const draftSeat = hasMatchingDraft ? state.selectedTrain?.seatType : '';
    const resolvedSeat = querySeat || draftSeat || seatOptions[0]?.type || '';
    setSelectedSeat(resolvedSeat);

    if (!hasMatchingDraft) {
      setSelectedTrain({
        trainNo: train.trainNo,
        seatType: resolvedSeat,
        trainIndex,
        passengerIds: [],
      });
      return;
    }

    if (resolvedSeat && draftSeat !== resolvedSeat) {
      setSelectedTrain({
        ...state.selectedTrain,
        trainNo: state.selectedTrain?.trainNo ?? train.trainNo,
        trainIndex: state.selectedTrain?.trainIndex ?? trainIndex,
        seatType: resolvedSeat,
        passengerIds: selectedPassengerIds,
      });
    }

  }, [
    hasMatchingDraft,
    querySeat,
    seatOptions,
    passengerIdsKey,
    setSelectedTrain,
    train,
    trainIndex,
  ]);

  const seatInfo = seatOptions.find(seat => seat.type === selectedSeat) || seatOptions[0];
  const canSubmit = selectedPassengerIds.length > 0 && !!seatInfo && seatInfo.count !== 0;
  const datePillText = formatDatePill(state.date, s);

  if (!train || !seatInfo) {
    return (
      <div className="min-h-full bg-app-bg flex items-center justify-center">
        <span className="text-gray-400">{s.order_error}</span>
      </div>
    );
  }

  const handleSeatSelect = (seatType: string) => {
    setSelectedSeat(seatType);
    setSelectedSeatPositions([]);
    setSelectedTrain({
      trainNo: train.trainNo,
      seatType,
      trainIndex,
      passengerIds: selectedPassengerIds,
    });
  };

  const handleSubmit = () => {
    if (!canSubmit || showProcessing) return;

    state.orders.filter(o => o.status === 'pending').forEach(o => updateOrder(o.id, { status: 'cancelled' }));

    const createTime = getISOString();
    const orderSeed = String(timeNow()).slice(-8);

    const validPassengers = selectedPassengerIds
      .map(pid => state.passengers.find(p => p.id === pid))
      .filter((p): p is NonNullable<typeof p> => !!p);

    const canHonorPositions = supportsPositionPick(seatInfo.type) && selectedSeatPositions.length > 0;
    // 失败概率以「本席别购票人数」为需求量(而非用户实际点中的格子数),
    // 否则 2 人购票只点 1 个位置时会低估概率。
    const reassignProb = canHonorPositions
      ? computeSeatReassignProbability(seatInfo.count, validPassengers.length)
      : 0;
    const seatReassigned = canHonorPositions && Math.random() < reassignProb;

    const honoredSeatNos = canHonorPositions && !seatReassigned
      ? buildSeatNosFromPositions(seatInfo.type, selectedSeatPositions)
      : [];

    const tickets = validPassengers.map((passenger, idx) => ({
      passengerName: passenger.name,
      ticketType: state.isStudent ? '学生票' : '成人票',
      seatType: seatInfo.type,
      seatNo: honoredSeatNos[idx] ?? randomSeatNo(seatInfo.type),
      price: seatInfo.price,
    }));

    if (tickets.length === 0) return;

    addOrder({
      id: `EK${orderSeed}01`,
      trainNo: train.trainNo,
      fromStation: train.fromStation,
      toStation: train.toStation,
      departTime: train.departTime,
      arriveTime: train.arriveTime,
      date: state.date,
      tickets,
      status: 'pending',
      createTime,
      ...(seatReassigned ? { seatReassigned: true } : {}),
    });

    setShowProcessing(true);
    submitTimerRef.current = window.setTimeout(() => {
      setShowProcessing(false);
      setSelectedTrain(null);
      go('orders.incompleteOrders');
    }, 1200);
  };

  const passengerSelectBinding = bindTap<HTMLButtonElement>('orderConfirm.passengers', {
    beforeTrigger: () => {
      setSelectedTrain({
        trainNo: train.trainNo,
        seatType: seatInfo.type,
        trainIndex,
        passengerIds: selectedPassengerIds,
      });
    },
  });

  return (
    <div className="pt-10 min-h-full bg-[#FAFAFA] pb-8">
      <div className="bg-[#4FA4F7] pt-10 pb-4 sticky top-0 z-20 -mt-10">
        <div className="h-(--app-order-top-bar-height) flex items-center justify-center relative px-4">
          <button className="absolute left-4 top-1/2 -translate-y-1/2" {...bindBack<HTMLButtonElement>()}>
            <IcNavBack size={26} className="text-white" />
          </button>
          <span className="flex-1 min-w-0 px-2 text-center text-white text-[18px] font-medium leading-tight">{s.order_confirm_title}</span>
          <span className="absolute right-4 top-1/2 -translate-y-1/2 max-w-[42%] text-right text-[14px] text-white leading-tight">{s.order_refund_rules}</span>
        </div>
        <div className="px-4 mt-1 flex items-center justify-between">
          <span className="text-[14px] text-white whitespace-nowrap">{s.order_prev_day}</span>
          <div className="h-9 min-w-[172px] rounded bg-white px-4 flex items-center justify-center gap-1.5 text-[#4FA4F7] text-[14px]">
            <span>{datePillText}</span>
            <IcCalendar size={15} />
          </div>
          <span className="text-[14px] text-white whitespace-nowrap">{s.order_next_day}</span>
        </div>
      </div>

      <div className="mx-3 mt-3 rounded-[12px] bg-white overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        {showTip && train.quiet && seatInfo.type === '二等' && (
          <div className="px-4 py-2 bg-[#FFF6F0] text-[#EF6E42] text-[13px] flex items-center justify-between">
            <span>{s.order_quiet_tip}</span>
            <button onClick={() => setShowTip(false)}>
              <IcClose size={16} className="text-[#F1A28A]" />
            </button>
          </div>
        )}

        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-2">
            <div className="w-[30%] min-w-0">
              <div className="text-[32px] leading-none text-[#20242E] font-medium">{train.departTime}</div>
              <div className="mt-1 text-[16px] text-[#2D3440]">{train.fromStation}</div>
            </div>
            <div className="w-[40%] px-1 pt-0.5 text-center min-w-0">
              <div className="flex items-center justify-center gap-1 text-[13px] text-[#4FA4F7]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8" cy="11" r="2" /><path d="M4 17s1-2 4-2 4 2 4 2M15 11h4M15 15h4" /></svg>
                <span className="ml-0.5 font-medium">{train.trainNo}</span>
                <span className="text-[#8EA1BA]">{' >'}</span>
              </div>
              <div className="mt-1.5 flex items-center justify-center">
                <div className="h-[2px] flex-1 mr-1 bg-[#BFD9F5]" />
                <div className="w-0 h-0 border-l-[6px] border-l-[#BFD9F5] border-y-[4px] border-y-transparent" />
              </div>
              <div className="mt-1 text-[12px] text-[#5D6571]">{train.duration}</div>
            </div>
            <div className="w-[30%] text-right min-w-0">
              <div className="text-[32px] leading-none text-[#20242E] font-medium">{train.arriveTime}</div>
              <div className="mt-1 text-[16px] text-[#2D3440]">{train.toStation}</div>
              <div className="mt-1 flex items-center justify-end gap-1">
                <span className="bg-[#3AB263] text-white rounded-[2px] px-0.5 text-[10px] leading-none py-[2px] scale-95 origin-right">{s.station_type_end}</span>
                <span className="text-[13px] text-[#3AB263]">吉安西</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-3 border-t border-dashed border-[#EBEEF2]" />

        <div className="px-3 py-3 grid grid-cols-4 gap-2">
          {seatOptions.map(seat => {
            const selected = seat.type === seatInfo.type;
            const discountTxt = seat.type === '二等' || seat.type === '无座' ? '7.5折' : '7.6折';
            return (
              <button
                key={seat.type}
                className={`relative rounded-[8px] h-[72px] border ${selected ? 'border-[#4FA4F7]' : 'border-[#EEF2F6]'} ${seat.count === 0 ? 'bg-[#FAFAFA]' : 'bg-white'} flex flex-col items-center justify-center overflow-hidden`}
                onClick={() => handleSeatSelect(seat.type)}
              >
                {!seat.type.includes('卧') && (
                  <div className="absolute left-0 top-0 bg-[#F58F4A] text-white text-[9px] px-1 rounded-br-[6px] scale-90 origin-top-left leading-tight py-[1px]">
                    {discountTxt}
                  </div>
                )}
                <div className={`text-[15px] font-medium flex items-center gap-0.5 mt-2 ${seat.count === 0 ? 'text-[#B8BEC8]' : 'text-[#222E3E]'}`}>
                  <span>{seat.type}</span>
                  {train.quiet && seat.type === '二等' && (
                    <span className="bg-[#F8ECB2] text-[#A67824] text-[9px] leading-none px-[2px] py-[2px] rounded-[2px]">静</span>
                  )}
                </div>
                <div className={`mt-[1px] text-[13px] ${seat.count === 0 ? 'text-[#C0C5CD]' : 'text-[#6A7280]'}`}>
                  ¥{seat.price}{seat.type.includes('卧') ? '起' : ''}
                </div>
                <div className={`mt-[1px] text-[11px] leading-none ${seat.count === 0 ? 'text-[#C7CCD4]' : 'text-[#434C59]'}`}>
                  {seat.count > 0 && seat.count <= 20 ? `${seat.count}张` : seatCountLabel(seat.count, s)}
                </div>
                {selected && (
                  <div className="absolute right-0 bottom-0 w-4 h-4 bg-[#4FA4F7] rounded-tl-[6px] flex items-center justify-center">
                    <IcCheck size={10} className="text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {seatInfo.type.includes('卧') && (
          <div className="flex items-center justify-center border-t border-dashed border-[#EBEEF2] bg-[#FAFAFA] text-[12px] h-10 w-full rounded-b-[12px]">
            <span className="text-[#6A7280] mr-1">上铺</span><span className="text-[#DE723D]">¥{seatInfo.price}</span>
            <span className="text-[#DCE4EC] mx-2.5">|</span>
            <span className="text-[#6A7280] mr-1">中铺</span><span className="text-[#DE723D]">¥{seatInfo.price + 5}</span>
            <span className="text-[#DCE4EC] mx-2.5">|</span>
            <span className="text-[#6A7280] mr-1">下铺</span><span className="text-[#DE723D]">¥{seatInfo.price + 8}</span>
          </div>
        )}
      </div>

      {seatInfo.type.includes('商务') && (
        <div className="mx-3 mt-2.5 px-3 py-2.5 bg-[#FFF8F3] text-[#DE723D] text-[13px] leading-snug rounded-[8px]">
          ① 本次列车商务座旅客可免费预约出站引导服务，由服务人员在站台迎候并引导至出站通道。
        </div>
      )}

      <div className="mx-3 mt-2.5 rounded-[12px] bg-white overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
        {selectedPassengers.length > 0 && (
          <div className="px-4 py-3 border-b border-[#EEF2F6] space-y-3">
            {selectedPassengers.map(passenger => (
              <div key={passenger.id} className="flex">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-[15px] text-[#222E3E] font-medium">
                    <span>{passenger.name}</span>
                    <span className="text-[12px] text-[#4FA4F7] font-normal">{state.isStudent ? '学生票' : '成人票'}</span>
                    <span className="text-[12px] text-[#4FA4F7] font-normal">{seatInfo.type}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[14px] text-[#9098A3] font-mono tracking-wider">{maskIdNo(passenger.idNo)}</span>
                    <button onClick={() => {
                      const newIds = selectedPassengerIds.filter(id => id !== passenger.id);
                      setSelectedTrain({
                        trainNo: train.trainNo,
                        seatType: seatInfo.type,
                        trainIndex,
                        passengerIds: newIds,
                      });
                    }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#AAB2BD]"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" /></svg>
                    </button>
                  </div>
                  <div className="mt-1.5 inline-block bg-[#FFF6F0] text-[#DE723D] text-[10px] px-1.5 py-[3px] rounded-[2px] border border-[#FDE1D3] leading-none">
                    ① 14到28岁双倍积分
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex">
          <button
            className="flex-1 h-[48px] flex items-center justify-center gap-1.5 text-[15px] text-[#DE723D] border-r border-[#F0F2F5]"
            {...passengerSelectBinding}
          >
            <IcAdd size={16} />
            <span>{s.order_select_passenger}</span>
          </button>
          <div className="flex-1 h-[48px] flex items-center justify-center gap-1.5 text-[15px] text-[#DE723D]">
            <IcAdd size={16} />
            <span>{s.order_points_recipient}</span>
          </div>
        </div>
      </div>

      {selectedPassengers.length > 0 && selectedPassengers.length < 6 && !['硬座', '无座'].includes(seatInfo.type) && (
        <div className="mx-3 mt-2.5 rounded-[12px] bg-white overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.02)] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-medium text-[#DE723D]">选{seatInfo.type.includes('卧') ? '铺' : '座'}服务</span>
            {!seatInfo.type.includes('卧') && <span className="text-[13px] text-[#4FA4F7]">可选择{selectedPassengers.length}个座位</span>}
          </div>

          <div className={`mt-1 text-[12px] text-[#9098A3] ${!seatInfo.type.includes('卧') ? 'mb-4' : ''}`}>
            如剩余{seatInfo.type.includes('卧') ? '铺' : '座位'}无法满足您的需求，系统将自动为您分配。
          </div>

          {seatInfo.type.includes('卧') && (
            <div className="mt-4 space-y-2.5">
              {(seatInfo.type === '硬卧' ? ['下铺', '中铺', '上铺'] : ['下铺', '上铺']).map((lbl) => (
                <div key={lbl} className="flex items-center justify-between bg-[#FAFAFA] rounded-[6px] px-3 py-2.5 border border-[#F0F2F5]">
                  <span className="text-[14px] text-[#242A36]">选择{lbl}</span>
                  <div className="flex items-center gap-3">
                    <button className="w-5 h-5 flex items-center justify-center bg-white border border-[#D5D9E0] rounded-[4px] text-[#B8BEC8] text-[16px] leading-none pb-0.5">-</button>
                    <span className="text-[13px] text-[#242A36]">0</span>
                    <button className="w-5 h-5 flex items-center justify-center bg-white border border-[#4FA4F7] rounded-[4px] text-[#4FA4F7] text-[16px] leading-none pb-0.5">+</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {supportsPositionPick(seatInfo.type) && (() => {
            const isBizOrFirst = seatInfo.type.includes('商务') || seatInfo.type.includes('一等');
            const leftCols = ['A', ...(isBizOrFirst ? [] : ['B']), 'C'];
            const rightCols = [(seatInfo.type.includes('商务') ? '' : 'D'), 'F'].filter(Boolean);
            const maxSeats = selectedPassengers.length;
            const rowCount = Math.min(maxSeats, 2);

            const handleSeatClick = (seatId: string) => {
              setSelectedSeatPositions(prev => {
                const idx = prev.indexOf(seatId);
                if (idx !== -1) return prev.filter((_, i) => i !== idx);
                const next = [...prev, seatId];
                if (next.length > maxSeats) next.shift();
                return next;
              });
            };

            const renderSeat = (row: number, col: string) => {
              const seatId = `${row}-${col}`;
              const active = selectedSeatPositions.includes(seatId);
              const fill = active ? '#DE723D' : '#EEF2F6';
              const stroke = active ? '#DE723D' : '#DCE4EC';
              const textColor = active ? 'text-white' : 'text-[#B8BEC8]';
              return (
                <button key={col} className="relative w-[42px] h-[42px]" onClick={() => handleSeatClick(seatId)}>
                  <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="4" y="2" width="34" height="24" rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
                    <rect x="2" y="26" width="38" height="10" rx="3" fill={fill} stroke={stroke} strokeWidth="1.5" />
                    <rect x="1" y="30" width="4" height="8" rx="2" fill={fill} stroke={stroke} strokeWidth="1.5" />
                    <rect x="37" y="30" width="4" height="8" rx="2" fill={fill} stroke={stroke} strokeWidth="1.5" />
                  </svg>
                  <span className={`absolute inset-x-0 top-0 h-[26px] flex items-center justify-center text-[16px] font-semibold ${textColor}`}>{col}</span>
                </button>
              );
            };

            return (
              <div className="mt-3 space-y-2">
                {Array.from({ length: rowCount }, (_, row) => (
                  <div key={row} className="flex items-center justify-center gap-[14px]">
                    <div className="flex items-center gap-[6px]">
                      {leftCols.map(c => renderSeat(row, c))}
                    </div>
                    <span className="text-[11px] text-[#B8BEC8] leading-none">过<br />道</span>
                    <div className="flex items-center gap-[6px]">
                      {rightCols.map(c => renderSeat(row, c))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      <div className="mx-4 mt-3 text-[12px] text-[#9098A3] leading-5">
        {s.order_agree_prefix}
        <span className="text-[#4FA4F7]">{s.order_terms_transport}</span>
        <span className="text-[#4FA4F7]">{s.order_terms_service}</span>
      </div>

      <div className="mx-4 mt-4 mb-2">
        <button
          className="w-full h-[46px] rounded-[6px] text-white text-[18px] font-medium bg-[#4FA4F7] active:bg-[#3B8DE5]"
          disabled={showProcessing}
          onClick={(e) => {
            if (!canSubmit) {
              // user feedback if needed
              e.preventDefault();
            } else {
              handleSubmit();
            }
          }}
        >
          {s.order_submit}
        </button>
      </div>

      {showProcessing && (
        <div className="fixed inset-0 z-[120] bg-black/45 flex items-center justify-center px-12">
          <div className="bg-white rounded-xl text-center px-8 py-6 min-w-[200px]">
            <p className="text-[16px] font-medium text-[#2B3038]">{s.order_processing_title}</p>
            <p className="mt-3 text-[14px] text-[#646B75]">{s.order_processing_msg}</p>
          </div>
        </div>
      )}
    </div>
  );
};
