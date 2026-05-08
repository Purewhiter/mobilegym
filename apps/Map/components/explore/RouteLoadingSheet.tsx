import React, { useEffect } from 'react';
import { IcClose } from '../../res/icons';
import { useMapBackHandler } from '../../hooks/useMapBackHandler';
import { useMapStrings } from '../../hooks/useMapStrings';
import { useMapStore } from '../../state';

type ModeTab = {
  key: string;
  mode: google.maps.TravelMode | undefined;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number; fill?: string }>;
};

export const RouteLoadingSheet: React.FC<{
  selectedTransportMode: 'driving' | 'transit' | 'walking' | 'cycling';
  setSelectedTransportMode: (m: 'driving' | 'transit' | 'walking' | 'cycling') => void;
  modeDurations: Record<string, string>;
  routeError: string | null;
  modes: ModeTab[];
  onCloseRoute: () => void;
}> = ({
  selectedTransportMode,
  setSelectedTransportMode,
  modeDurations,
  routeError,
  modes,
  onCloseRoute,
}) => {
  const setRouteSheetOpen = useMapStore((s) => s.setRouteSheetOpen);
  const s = useMapStrings();

  useEffect(() => {
    setRouteSheetOpen(true);
    return () => setRouteSheetOpen(false);
  }, [setRouteSheetOpen]);

  useMapBackHandler(
    () => {
      onCloseRoute();
      return true;
    },
    { priority: 500 },
  );

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 bg-app-surface shadow-up rounded-t-2xl pb-safe animate-slide-up p-0 flex flex-col min-h-[200px]">
      <div className="flex justify-between items-center px-4 pt-4 pb-2">
        <div className="text-xl font-bold text-app-text">
          {selectedTransportMode === 'driving'
            ? s.route_driving
            : selectedTransportMode === 'transit'
              ? s.route_transit
              : selectedTransportMode === 'walking'
                ? s.route_walking
                : s.route_cycling}
        </div>
        <div className="flex gap-2">
          <button type="button" className="p-2 bg-gray-100 rounded-full text-gray-600" onClick={onCloseRoute}>
            <IcClose size={18} />
          </button>
        </div>
      </div>

      <div className="flex gap-4 px-4 mb-4 overflow-x-auto no-scrollbar">
        {modes.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`flex flex-col items-center gap-1 min-w-[60px] pb-2 border-b-2 transition-all whitespace-nowrap ${
              selectedTransportMode === m.key ? 'border-teal-700 text-teal-700' : 'border-transparent text-app-text-muted'
            } ${modeDurations[m.mode!] === 'N/A' && selectedTransportMode !== m.key ? 'opacity-30 grayscale' : ''}`}
            onClick={() => m.mode && setSelectedTransportMode(m.key as 'driving' | 'transit' | 'walking' | 'cycling')}
          >
            <m.icon
              size={24}
              strokeWidth={selectedTransportMode === m.key ? 2.5 : 2}
              fill={selectedTransportMode === m.key ? 'currentColor' : 'none'}
            />
            {modeDurations[m.mode!] === 'N/A' || (selectedTransportMode === m.key && routeError) ? (
              <span className="text-xl font-bold text-gray-300">—</span>
            ) : modeDurations[m.mode!] ? (
              <span className="text-sm font-bold">{modeDurations[m.mode!]}</span>
            ) : (
              <div className="w-8 h-4 bg-gray-100 rounded animate-pulse" />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center pb-8 px-6 text-center -mt-6">
        {routeError ? (
          <>
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
              <IcClose size={24} className="text-red-500" />
            </div>
            <div className="text-xl font-bold text-gray-900 mb-1">{s.route_not_found}</div>
            <div className="text-sm text-app-text-muted mb-6">{routeError}</div>
            {selectedTransportMode !== 'driving' && (
              <button
                type="button"
                className="px-8 py-2.5 bg-teal-800 text-white rounded-full font-bold text-base shadow-sm active:bg-teal-900"
                onClick={() => setSelectedTransportMode('driving')}
              >
                {s.route_try_driving}
              </button>
            )}
          </>
        ) : (
          <>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mb-3" />
            <span className="text-app-text-muted font-medium">{s.route_calculating}</span>
          </>
        )}
      </div>
    </div>
  );
};
