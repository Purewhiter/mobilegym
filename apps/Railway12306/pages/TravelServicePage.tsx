import React from 'react';
import { IcCar, IcBuilding, IcShoppingBag } from '../res/icons';
import { RAILWAY12306_CONFIG } from '../data';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
import { localizeRailwayItemTag } from '../utils/localizeRailwayItem';
export const TravelServicePage: React.FC = () => {
  const config = RAILWAY12306_CONFIG;
  const { bindTap } = useRailwayGestures();
  const s = useRailwayStrings();

  const quickEntries = [
    { id: 'car_rental', name: s.service_car_rental, icon: IcCar, tag: localizeRailwayItemTag('限时优惠', s), color: '#FF8C00' },
    { id: 'hotel', name: s.service_hotel, icon: IcBuilding, color: '#FF8C00' },
    { id: 'mall', name: s.service_mall, icon: IcShoppingBag, color: '#FF8C00' },
  ];

  const travelCards = [
    { id: '1', title: s.travel_service_card_homestay, bg: 'from-amber-600 to-amber-800' },
    { id: '2', title: s.service_ecard, desc: s.travel_service_card_ecard_desc, bg: 'from-blue-500 to-blue-700' },
  ];

  return (
    <div className="min-h-full bg-app-bg">
      {/* 顶栏 */}
      <div className="bg-app-surface pt-10 pb-3 px-4 sticky top-0 z-20">
        <span className="text-lg font-medium text-gray-900 flex justify-center">{s.travel_service_title}</span>
      </div>

      {/* 广告 banner */}
      <div className="mx-3 mt-2 h-32 bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center overflow-hidden">
        <span className="text-white text-sm font-bold">{s.travel_service_banner}</span>
      </div>

      {/* 行程卡片 */}
      <div className="mx-3 mt-3 bg-app-surface rounded-xl p-5 flex flex-col items-center">
        <span className="text-lg text-gray-700 mb-1">{s.travel_service_empty_title}</span>
        <span className="text-sm text-gray-400 mb-4">{s.travel_service_empty_desc}</span>
        <button
          className="bg-app-primary text-white px-16 py-2.5 rounded-lg text-sm font-medium"
          {...bindTap<HTMLButtonElement>('travel.goHome')}
        >
          {s.travel_service_book_now}
        </button>
      </div>

      {/* 快捷入口 */}
      <div className="mx-3 mt-3 bg-app-surface rounded-xl py-4 px-2 flex justify-around">
        {quickEntries.map(entry => {
          const Icon = entry.icon;
          return (
            <div key={entry.id} className="flex flex-col items-center gap-1.5 relative">
              {entry.tag && (
                <span className="absolute -top-2 -right-3 text-[9px] text-white bg-red-500 rounded-full px-1.5 py-0.5 z-10">
                  {entry.tag}
                </span>
              )}
              <div className="w-11 h-11 bg-[#FFF3E0] rounded-xl flex items-center justify-center">
                <Icon size={22} className="text-app-accent" />
              </div>
              <span className="text-xs text-gray-700">{entry.name}</span>
            </div>
          );
        })}
      </div>

      {/* 12306 banner */}
      <div className="mx-3 mt-3 h-28 bg-gradient-to-r from-red-600 to-orange-500 rounded-xl flex items-center justify-center">
        <div className="text-center">
          <span className="text-white text-lg font-bold">{s.travel_service_dining_title}</span>
          <p className="text-white/80 text-xs mt-1">{s.travel_service_dining_desc}</p>
        </div>
      </div>

      {/* 精彩旅程 */}
      <div className="px-4 mt-4 mb-2">
        <span className="text-base font-medium text-gray-900">{s.travel_service_journey_title}</span>
      </div>
      <div className="px-3 pb-6 flex gap-2.5">
        {travelCards.map(card => (
          <div key={card.id} className={`flex-1 h-44 bg-gradient-to-b ${card.bg} rounded-xl flex flex-col justify-end p-3`}>
            <span className="text-white font-medium text-sm">{card.title}</span>
            {card.desc && <span className="text-white/80 text-[11px] mt-0.5">{card.desc}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};
