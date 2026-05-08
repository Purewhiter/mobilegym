import React from 'react';
import { useMapStrings } from '../../hooks/useMapStrings';

export const ExplorePulseSheet: React.FC<{
  exploreSheetHeight: number;
  isExploreDragging: boolean;
  /** 最低档（露头）高度，用于判断是否展开正文区 */
  exploreSnapPeek: number;
  pointerHandlers: {
    onPointerDown: React.PointerEventHandler<HTMLDivElement>;
    onPointerMove: React.PointerEventHandler<HTMLDivElement>;
    onPointerUp: React.PointerEventHandler<HTMLDivElement>;
    onPointerCancel: React.PointerEventHandler<HTMLDivElement>;
  };
}> = ({ exploreSheetHeight, isExploreDragging, exploreSnapPeek, pointerHandlers }) => {
  const s = useMapStrings();

  return (
    <div
    className="absolute bottom-0 left-0 right-0 z-20 bg-app-surface shadow-up rounded-t-2xl flex flex-col"
    style={{
      height: `${exploreSheetHeight}px`,
      transition: isExploreDragging ? 'none' : 'height 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
    }}
  >
    <div className="w-full flex justify-center pt-2 pb-1 shrink-0 touch-none" {...pointerHandlers}>
      <div className="w-8 h-1 bg-gray-300 rounded-full" />
    </div>
    <div className="flex items-center justify-between px-4 py-1 shrink-0">
      <div className="text-2xl leading-tight font-bold text-gray-900">{s.explore_pulse}</div>
      <div className="flex items-center gap-1 text-gray-900">
        <span className="text-yellow-500">☀</span>
        <span>23°</span>
      </div>
    </div>

    {exploreSheetHeight > exploreSnapPeek + 16 && (
      <div className="px-4 pb-4 overflow-y-auto no-scrollbar">
        <div className="text-base font-bold mb-2">{s.explore_accommodation}</div>
        <div className="text-sm text-app-text-muted mb-3">{s.explore_hotel_price_dates}</div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar">
          <div className="min-w-[220px] rounded-xl bg-app-surface border border-gray-100 shadow-sm p-3">
            <div className="inline-block px-2 py-1 bg-gray-100 rounded text-sm text-gray-700 mb-2">¥428</div>
            <img
              src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80"
              alt="hotel"
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-56 w-full object-cover rounded mb-2"
            />
            <div className="font-medium text-gray-900">Lavande IcHotel Zhongguancun Renmin University</div>
            <div className="text-sm text-app-text-muted">{s.explore_no_reviews} · {s.type_hotel_3star}</div>
          </div>
          <div className="min-w-[220px] rounded-xl bg-app-surface border border-gray-100 shadow-sm p-3">
            <div className="inline-block px-2 py-1 bg-gray-100 rounded text-sm text-gray-700 mb-2">¥567</div>
            <img
              src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80"
              alt="hotel"
              loading="lazy"
              referrerPolicy="no-referrer"
              className="h-56 w-full object-cover rounded mb-2"
            />
            <div className="font-medium text-gray-900">Holiday Inn Zhongguancun</div>
            <div className="text-sm text-app-text-muted">3.0 (5)</div>
          </div>
        </div>
        <div className="mt-4 flex justify-center">
          <button type="button" className="px-6 py-2 rounded-full bg-gray-100 text-gray-700 font-medium">
            {s.explore_view_all_hotels}
          </button>
        </div>
      </div>
    )}
  </div>
  );
};
