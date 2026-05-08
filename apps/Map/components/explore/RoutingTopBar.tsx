import React from 'react';
import { IcLocation, IcNavBack, IcMore } from '../../res/icons';
import { useMapStrings } from '../../hooks/useMapStrings';
import { isCurrentLocationRoutePoint, type RoutePoint } from '../../hooks/useRouting';

export const RoutingTopBar: React.FC<{
  origin: RoutePoint | null;
  destination: RoutePoint;
  anchorSide: 'origin' | 'destination';
  onSwapRoute: () => void;
  onOpenPointPicker: (side: 'origin' | 'destination', initialQuery?: string) => void;
}> = ({ origin, destination, anchorSide, onSwapRoute, onOpenPointPicker }) => {
  const s = useMapStrings();
  const originIsCurrent = isCurrentLocationRoutePoint(origin);
  const destinationIsCurrent = isCurrentLocationRoutePoint(destination);

  return (
    <div className="pointer-events-auto absolute top-12 left-4 right-4 bg-app-surface shadow-md rounded-xl p-0 overflow-hidden z-10 border border-gray-100">
    <div className="flex flex-col relative">
      <div className="flex items-center h-12 px-4 relative">
        {originIsCurrent ? (
          <div className="w-4 h-4 rounded-full border-[3px] border-blue-500 shrink-0 mr-3" />
        ) : (
          <div className="w-4 h-4 rounded-full border-[3px] border-gray-400 bg-app-surface shrink-0 mr-3" />
        )}
        <button
          type="button"
          className={`flex-1 text-left text-base font-bold truncate active:bg-gray-50 h-full flex items-center ${originIsCurrent ? 'text-blue-600' : 'text-gray-900'}`}
          onClick={() => onOpenPointPicker('origin', anchorSide === 'origin' ? '' : origin?.name)}
        >
          {origin?.name || s.your_location}
        </button>
        <button type="button" className="p-2 text-app-text-muted" onClick={() => {}}>
          <IcMore size={20} />
        </button>
      </div>

      <div className="absolute left-[21px] top-[30px] flex flex-col gap-1 z-0">
        <div className="w-1 h-1 bg-gray-300 rounded-full" />
        <div className="w-1 h-1 bg-gray-300 rounded-full" />
        <div className="w-1 h-1 bg-gray-300 rounded-full" />
      </div>

      <div className="flex items-center h-12 px-4 border-t border-gray-50 relative bg-gray-50/50">
        {destinationIsCurrent ? (
          <div className="w-4 h-4 rounded-full border-[3px] border-blue-500 shrink-0 mr-3" />
        ) : (
          <IcLocation className="text-red-500 shrink-0 mr-3" size={20} fill="currentColor" />
        )}
        <button
          type="button"
          className={`flex-1 text-left text-base truncate active:bg-gray-100 h-full flex items-center ${destinationIsCurrent ? 'text-blue-600 font-bold' : 'text-gray-900'}`}
          onClick={() => onOpenPointPicker('destination', anchorSide === 'destination' ? '' : destination?.name)}
        >
          {destination.name}
        </button>
        <button type="button" className="p-2 text-app-text-muted" onClick={onSwapRoute}>
          <div className="flex flex-col gap-0.5 items-center">
            <IcNavBack size={16} className="rotate-90" />
            <IcNavBack size={16} className="-rotate-90" />
          </div>
        </button>
      </div>
    </div>
  </div>
  );
};
