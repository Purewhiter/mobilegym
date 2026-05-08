import React from 'react';
import { IcClose } from '../res/icons';
import { useMapGestures } from '../hooks/useMapGestures';
import { useMapStrings } from '../hooks/useMapStrings';

export const GettingAroundPage: React.FC = () => {
  const { bindBack } = useMapGestures();
  const s = useMapStrings();
  const items = [
    { title: s.getting_around_commute, subtitle: s.getting_around_commute_desc },
    { title: s.getting_around_walking, subtitle: s.getting_around_walking_desc },
    { title: s.getting_around_transit, subtitle: s.getting_around_transit_desc },
    { title: s.getting_around_rideshare, subtitle: s.getting_around_rideshare_desc },
    { title: s.getting_around_cycling, subtitle: s.getting_around_cycling_desc },
  ];

  return (
    <div className="font-sans flex flex-col h-full bg-app-surface">
      <div className="flex justify-between items-center px-4 pt-12 pb-4 bg-app-surface border-b border-gray-100 shadow-sm z-10">
        <div className="text-[28px] font-bold text-gray-900">{s.getting_around_title}</div>
        <button
          type="button"
          {...bindBack()}
          className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
        >
          <IcClose size={20} className="text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-8">
        {items.map((item) => (
          <div
            key={item.title}
            className="py-4 border-b border-gray-100 active:bg-gray-50 -mx-4 px-4"
          >
            <div className="text-[17px] font-bold text-gray-900 mb-1">{item.title}</div>
            <div className="text-[15px] text-app-text-muted">{item.subtitle}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GettingAroundPage;
