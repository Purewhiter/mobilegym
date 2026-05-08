import React, { useEffect, useState } from 'react';
import { IcCheck, IcNavBack, IcAdd, IcEdit } from '../res/icons';
import { useLocation } from 'react-router-dom';
import { useRailwayStore, maskIdNo } from '../state';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useShallow } from 'zustand/react/shallow';
import type { Passenger } from '../types';


// ── Pinyin initial letter helper ────────────────────────────────
const PINYIN_MAP: Record<string, string> = {
  赵:'Z',钱:'Q',孙:'S',李:'L',周:'Z',吴:'W',郑:'Z',王:'W',冯:'F',陈:'C',
  蒋:'J',沈:'S',韩:'H',杨:'Y',朱:'Z',秦:'Q',许:'X',何:'H',吕:'L',张:'Z',
  曹:'C',刘:'L',胡:'H',林:'L',罗:'L',高:'G',梁:'L',郭:'G',马:'M',黄:'H',
  徐:'X',唐:'T',汪:'W',邓:'D',谢:'X',邹:'Z',彭:'P',董:'D',潘:'P',田:'T',
  蔡:'C',贾:'J',魏:'W',薛:'X',程:'C',文:'W',宋:'S',丁:'D',叶:'Y',范:'F',
  任:'R',袁:'Y',邱:'Q',夏:'X',苏:'S',石:'S',方:'F',金:'J',白:'B',
};

function getInitialLetter(name: string): string {
  if (!name) return '#';
  const first = name.charAt(0);
  return PINYIN_MAP[first] || first.toUpperCase();
}

/** Group passengers by initial letter, sorted alphabetically */
function groupByInitial(passengers: Passenger[]): { letter: string; items: Passenger[] }[] {
  const map = new Map<string, Passenger[]>();
  for (const p of passengers) {
    const letter = getInitialLetter(p.name);
    if (!map.has(letter)) map.set(letter, []);
    map.get(letter)!.push(p);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([letter, items]) => ({ letter, items }));
}

// ── Verification badge icons ────────────────────────────────────

/** Small green verification badge icon (similar to 12306 real app) */
const VerifiedBadge: React.FC<{ className?: string }> = ({ className }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={className}>
    <rect width="14" height="10" x="1" y="3" rx="2" fill="#4CAF50" />
    <path d="M4.5 8l2 2 5-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

/** Passenger row in manage mode */
const PassengerCard: React.FC<{ passenger: Passenger }> = ({ passenger }) => (
  <div className="flex items-center px-4 py-3.5 bg-white">
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <span className="text-[15px] text-[#4CAF50] font-medium">{passenger.name}</span>
        <span className="text-[12px] text-[#666] ml-1">{passenger.ticketType || '成人'}</span>
      </div>
      <div className="mt-1.5 text-[13px] text-[#999] font-mono tracking-wider">
        {maskIdNo(passenger.idNo)}
      </div>
    </div>
    <IcEdit size={18} className="text-[#C0C0C0] flex-shrink-0 ml-2" />
  </div>
);

/** Manage passengers view (from 我的 → 乘车人) */
const ManagePassengersView: React.FC<{
  passengers: Passenger[];
  bindBack: ReturnType<typeof useRailwayGestures>['bindBack'];
  bindTap: ReturnType<typeof useRailwayGestures>['bindTap'];
}> = ({ passengers, bindBack, bindTap }) => {
  const currentUser = passengers.find(p => p.isDefault);
  const otherPassengers = passengers.filter(p => !p.isDefault);
  const grouped = groupByInitial(otherPassengers);

  return (
    <div className="min-h-full bg-[#F5F5F5]">
      {/* Top bar */}
      <div className="bg-[#4FA4F7] pt-10 pb-3 px-4 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-3">
          <button className="w-10 shrink-0 p-1 text-left" {...bindBack<HTMLButtonElement>()}>
            <IcNavBack size={24} className="text-white" />
          </button>
          <span className="text-[17px] text-white font-medium">乘车人</span>
          <button className="w-10 shrink-0 text-right text-white text-[15px] p-1" {...bindTap<HTMLButtonElement>('passengers.addPassenger' as any)}>添加</button>
        </div>
      </div>

      {/* Refresh hint */}
      <div className="text-center text-[12px] text-[#A6AFBA] py-2.5">
        下拉<span className="text-[#4FA4F7]">刷新</span>可获取12306乘车人最新状态
      </div>

      {/* Current user section */}
      {currentUser && (
        <>
          <div className="px-4 py-2 text-[13px] text-[#666] font-medium bg-[#F5F5F5]">
            当前用户
          </div>
          <PassengerCard passenger={currentUser} />
        </>
      )}

      {/* Grouped list */}
      {grouped.map(group => (
        <React.Fragment key={group.letter}>
          <div className="px-4 py-2 text-[13px] text-[#666] font-medium bg-[#F5F5F5]">
            {group.letter}
          </div>
          {group.items.map(p => (
            <React.Fragment key={p.id}>
              <PassengerCard passenger={p} />
              <div className="h-px bg-[#EBEBEB] ml-4" />
            </React.Fragment>
          ))}
        </React.Fragment>
      ))}

      {/* Bottom spacer */}
      <div className="h-6" />
    </div>
  );
};

/** Select passengers view (from 订单确认 → 选择乘车人) */
const SelectPassengersView: React.FC<{
  passengers: Passenger[];
  selectedIds: string[];
  selectedCount: number;
  totalCount: number;
  onToggle: (id: string) => void;
  bindBack: ReturnType<typeof useRailwayGestures>['bindBack'];
  bindTap: ReturnType<typeof useRailwayGestures>['bindTap'];
  doneBackBinding: Record<string, any>;
}> = ({ passengers, selectedIds, selectedCount, totalCount, onToggle, bindBack, bindTap, doneBackBinding }) => (
  <div className="min-h-full bg-[#F5F5F5] pb-[110px]">
    <div className="bg-[#4FA4F7] pt-12 pb-3 px-4 sticky top-0 z-20 flex items-center justify-between gap-3">
      <button className="w-10 shrink-0 flex items-center justify-center p-1" {...bindBack<HTMLButtonElement>()}>
        <IcNavBack size={26} className="text-white" />
      </button>
      <span className="flex-1 min-w-0 text-center text-[18px] text-white font-medium leading-tight">选择乘车人</span>
      <button className="w-10 shrink-0 text-right text-white text-[16px] p-1" {...doneBackBinding}>完成</button>
    </div>

    <div className="mx-3 mt-3">
      <button
        className="w-full h-[60px] rounded-[10px] bg-white text-[#525C6A] text-[16px] flex items-center justify-center gap-2"
        {...bindTap<HTMLButtonElement>('passengers.addPassenger' as any)}
      >
        <div className="w-[18px] h-[18px] rounded-full border border-[#4FA4F7] flex items-center justify-center">
          <IcAdd size={16} className="text-[#4FA4F7]" />
        </div>
        <span>添加乘车人</span>
      </button>
    </div>

    <div className="mt-3.5 text-center text-[12px] text-[#A6AFBA]">
      下拉<span className="text-[#4FA4F7]">刷新</span>可获取12306乘车人最新状态
    </div>

    <div className="mx-3 mt-3 rounded-[10px] bg-white overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
      {passengers.map(passenger => {
        const checked = selectedIds.includes(passenger.id);
        return (
          <div
            key={passenger.id}
            className="px-4 py-4 border-b border-[#F0F2F5] last:border-b-0 flex items-center"
            onClick={() => onToggle(passenger.id)}
          >
            <div className={`w-[20px] h-[20px] rounded-[3px] border mr-3.5 flex items-center justify-center ${checked ? 'border-[#4FA4F7] bg-[#4FA4F7]' : 'border-[#C2D6F3] bg-transparent'}`}>
              {checked && <IcCheck size={14} className="text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[17px] text-[#242A36] font-medium">{passenger.name}</span>
                <span className="text-[10px] text-[#5B6576] px-1 py-[1.5px] border border-[#D5D9E0] rounded-[2px] leading-none">
                  {passenger.ticketType || '成人'}
                </span>
              </div>
              <div className="mt-2 text-[14px] text-[#8C95A3] font-mono tracking-wider">{maskIdNo(passenger.idNo)}</div>
            </div>
            <IcEdit size={18} className="text-[#C8CED9]" />
          </div>
        );
      })}
    </div>

    <div className="fixed bottom-0 left-0 right-0 bg-[#F5F5F5] px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
      <button
        className="w-full h-[46px] rounded-[6px] bg-[#4FA4F7] text-white flex flex-col items-center justify-center active:bg-[#3B8DE5] leading-tight"
        {...doneBackBinding}
      >
        <span className="text-[16px] font-medium mt-1">确认</span>
        <span className="text-[11px] mb-1 opacity-90">已选{selectedCount}/{totalCount}人</span>
      </button>
    </div>
  </div>
);

export const PassengerListPage: React.FC = () => {
  const { passengers, selectedTrain } = useRailwayStore(
    useShallow(s => ({ passengers: s.passengers, selectedTrain: s.selectedTrain })),
  );
  const updatePassengers = useRailwayStore(s => s.updatePassengers);
  const setSelectedTrain = useRailwayStore(s => s.setSelectedTrain);
  const { bindBack, bindTap } = useRailwayGestures();
  const location = useLocation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const searchParams = new URLSearchParams(location.search);
  const isSelectMode = searchParams.get('mode') === 'select';

  useEffect(() => {
    if (!isSelectMode) { setSelectedIds([]); return; }
    setSelectedIds(selectedTrain?.passengerIds ?? []);
  }, [isSelectMode, selectedTrain]);

  // ── Manage mode (from 我的 → 乘车人) ──
  if (!isSelectMode) {
    return (
      <ManagePassengersView
        passengers={passengers}
        bindBack={bindBack}
        bindTap={bindTap}
      />
    );
  }

  // ── Select mode (from 订单确认 → 选择乘车人) ──
  const selectedCount = selectedIds.length;
  const totalCount = passengers.length;

  const doneBackBinding = bindBack<HTMLButtonElement>({
    beforeTrigger: () => {
      if (selectedTrain) {
        setSelectedTrain({ ...selectedTrain, passengerIds: selectedIds });
      }
    },
  });

  const handleToggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id],
    );
  };

  return (
    <SelectPassengersView
      passengers={passengers}
      selectedIds={selectedIds}
      selectedCount={selectedCount}
      totalCount={totalCount}
      onToggle={handleToggle}
      bindBack={bindBack}
      bindTap={bindTap}
      doneBackBinding={doneBackBinding}
    />
  );
};
