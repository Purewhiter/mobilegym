import React, { useEffect } from 'react';
import {
  IcClose,
  IcFilter,
  IcShare,
  IcLocation,
  IcNavBack,
  IcNavigation,
  InfoCircleIcon,
} from '../../res/icons';
import { useMapStrings } from '../../hooks/useMapStrings';
import { isCurrentLocationRoutePoint, type RouteInfo, type RoutePoint, type RouteStep } from '../../hooks/useRouting';
import { useMapBackHandler } from '../../hooks/useMapBackHandler';
import { useMapStore } from '../../state';
import { formatShortDisplayAddress, stripHtml } from '../../utils/placeUtils';

type ModeTab = {
  key: string;
  mode: google.maps.TravelMode | undefined;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number; fill?: string }>;
  label: string;
  subLabel: string;
};

export const RouteDetailSheet: React.FC<{
  routeSheetHeight: number;
  isRouteDragging: boolean;
  routeSheetPointerHandlers: {
    onPointerDown: React.PointerEventHandler<HTMLDivElement>;
    onPointerMove: React.PointerEventHandler<HTMLDivElement>;
    onPointerUp: React.PointerEventHandler<HTMLDivElement>;
    onPointerCancel: React.PointerEventHandler<HTMLDivElement>;
  };
  selectedTransportMode: 'driving' | 'transit' | 'walking' | 'cycling';
  setSelectedTransportMode: (m: 'driving' | 'transit' | 'walking' | 'cycling') => void;
  modes: ModeTab[];
  modeDurations: Record<string, string>;
  routeError: string | null;
  routeInfo: RouteInfo | null;
  isCollapsed: boolean;
  isExpanded: boolean;
  destination: RoutePoint;
  routeSteps: RouteStep[];
  origin: { lat: number; lng: number; name: string } | null;
  mapInstance: google.maps.Map | null;
  clearRoutePolyline: () => void;
  setRouteEndLocation: (v: { lat: number; lng: number } | null) => void;
  setRouteInfo: (v: RouteInfo | null) => void;
  setOrigin: (v: RoutePoint | null) => void;
  setTravelMode: (m: google.maps.TravelMode) => void;
  replaceState: (state: Record<string, unknown>) => void;
  setIsNavigating: (v: boolean) => void;
}> = ({
  routeSheetHeight,
  isRouteDragging,
  routeSheetPointerHandlers,
  selectedTransportMode,
  setSelectedTransportMode,
  modes,
  modeDurations,
  routeError,
  routeInfo,
  isCollapsed,
  isExpanded,
  destination,
  routeSteps,
  origin,
  mapInstance,
  clearRoutePolyline,
  setRouteEndLocation,
  setRouteInfo,
  setOrigin,
  setTravelMode,
  replaceState,
  setIsNavigating,
}) => {
  const setRouteSheetOpen = useMapStore((s) => s.setRouteSheetOpen);
  const s = useMapStrings();
  const shortDestinationAddress = formatShortDisplayAddress(destination.address);
  const lastRouteStep = routeSteps[routeSteps.length - 1];
  const lastRouteInstruction = stripHtml(lastRouteStep?.instructions || '');
  const destinationSideHint = (() => {
    const matched = lastRouteInstruction.match(/目的地在[左右]侧|destination (?:will be|is) on (?:the )?(?:left|right)/i);
    return matched?.[0] ?? null;
  })();
  const isArrivalStep =
    Boolean(lastRouteStep)
    && (
      lastRouteInstruction === s.route_arrive_destination
      || /arrive at destination/i.test(lastRouteInstruction)
      || Boolean(destinationSideHint)
    );
  const visibleRouteSteps = isArrivalStep ? routeSteps.slice(0, -1) : routeSteps;

  useEffect(() => {
    setRouteSheetOpen(true);
    return () => setRouteSheetOpen(false);
  }, [setRouteSheetOpen]);

  const getRouteLabelText = (routeLabels?: string[]) => {
    const labels = new Set(routeLabels || []);
    if (labels.has('FUEL_EFFICIENT')) return s.route_fuel_efficient_route;
    if (labels.has('SHORTER_DISTANCE')) return s.route_shorter_distance_route;
    if (labels.has('DEFAULT_ROUTE_ALTERNATE')) return s.route_alternative_route;
    if (labels.has('DEFAULT_ROUTE')) return s.route_recommended_route;
    return s.route_recommended_route;
  };

  const handleCloseRoute = () => {
    clearRoutePolyline();
    setRouteEndLocation(null);
    setRouteInfo(null);
    setOrigin(null);
    setTravelMode('DRIVING' as google.maps.TravelMode);
    replaceState({});
  };

  useMapBackHandler(
    () => {
      handleCloseRoute();
      return true;
    },
    { priority: 500 },
  );

  return (
    <div
      className="absolute bottom-0 left-0 right-0 z-20 bg-app-surface shadow-up rounded-t-2xl flex flex-col"
      style={{
        height: `${routeSheetHeight}px`,
        transition: isRouteDragging ? 'none' : 'height 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
      }}
    >
      <div className="w-full flex justify-center pt-3 pb-1 shrink-0 touch-none" {...routeSheetPointerHandlers}>
        <div className="w-10 h-1 bg-gray-300 rounded-full" />
      </div>

      <div className="flex justify-between items-center px-4 pt-2 pb-2 shrink-0">
        <div className="text-2xl font-normal text-gray-900">
          {selectedTransportMode === 'driving'
            ? s.route_driving
            : selectedTransportMode === 'transit'
              ? s.route_transit
              : selectedTransportMode === 'walking'
                ? s.route_walking
                : s.route_cycling}
        </div>
        <div className="flex gap-3">
          <button type="button" className="w-10 h-10 bg-gray-100 rounded-full text-gray-700 flex items-center justify-center">
            <IcFilter size={20} />
          </button>
          <button type="button" className="w-10 h-10 bg-gray-100 rounded-full text-gray-700 flex items-center justify-center">
            <IcShare size={20} />
          </button>
          <button
            type="button"
            className="w-10 h-10 bg-gray-100 rounded-full text-gray-700 flex items-center justify-center"
            onClick={handleCloseRoute}
          >
            <IcClose size={20} />
          </button>
        </div>
      </div>

    {!isCollapsed && (
      <div className="flex gap-4 px-4 mb-4 overflow-x-auto no-scrollbar border-b border-gray-100 shrink-0 animate-fade-in">
        {modes.map((m) => {
          const duration = modeDurations[m.mode!] || '';
          const isDisabled = duration === 'N/A';
          return (
            <button
              key={m.key}
              type="button"
              className={`flex items-center gap-2 pb-3 border-b-2 transition-all whitespace-nowrap min-w-max px-1 ${
                selectedTransportMode === m.key
                  ? 'border-teal-700 text-teal-700'
                  : 'border-transparent text-app-text-muted'
              } ${isDisabled && selectedTransportMode !== m.key ? 'opacity-30 grayscale' : ''}`}
              onClick={() => m.mode && setSelectedTransportMode(m.key as 'driving' | 'transit' | 'walking' | 'cycling')}
            >
              <m.icon
                size={22}
                strokeWidth={selectedTransportMode === m.key ? 2.5 : 2}
                fill={selectedTransportMode === m.key ? 'currentColor' : 'none'}
              />
              {duration ? (
                <span className="text-base font-bold">{duration === 'N/A' ? '—' : duration}</span>
              ) : duration === 'N/A' || (selectedTransportMode === m.key && routeError) ? (
                <span className="text-xl font-bold text-gray-300 mx-2">—</span>
              ) : (
                <div className="w-12 h-4 bg-gray-100 rounded animate-pulse" />
              )}
            </button>
          );
        })}
      </div>
    )}

    {routeError ? (
      <div className="flex-1 px-4 pb-2 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center -mt-6">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
            <IcClose size={24} className="text-red-500" />
          </div>
          <div className="text-xl font-bold text-gray-900 mb-1">{s.route_not_found}</div>
          <div className="text-sm text-app-text-muted mb-6">{s.route_not_found_detail}</div>
          {selectedTransportMode !== 'driving' && (
            <button
              type="button"
              className="px-8 py-2.5 bg-teal-800 text-white rounded-full font-bold text-base shadow-sm active:bg-teal-900"
              onClick={() => setSelectedTransportMode('driving')}
            >
              {s.route_try_driving}
            </button>
          )}
        </div>
      </div>
    ) : isExpanded ? (
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-4 py-0 mb-4 flex gap-2 overflow-x-auto no-scrollbar">
          {selectedTransportMode === 'driving' && (
            <>
              <button
                type="button"
                className="bg-gray-100 rounded-lg py-1.5 px-3 flex items-center justify-between text-sm font-medium text-gray-700 whitespace-nowrap"
              >
                {s.route_depart_time} 10:20 <span className="text-[10px] ml-1">▼</span>
              </button>
              <button
                type="button"
                className="bg-gray-100 rounded-lg py-1.5 px-3 flex items-center justify-between text-sm font-medium text-gray-700 whitespace-nowrap"
              >
                {s.route_avoid_tolls}
              </button>
              <button
                type="button"
                className="bg-gray-100 rounded-lg py-1.5 px-3 flex items-center justify-between text-sm font-medium text-gray-700 whitespace-nowrap"
              >
                {s.route_avoid_highways}
              </button>
            </>
          )}
          {selectedTransportMode === 'transit' && (
            <>
              <button
                type="button"
                className="bg-gray-100 rounded-lg py-1.5 px-3 flex items-center justify-between text-sm font-medium text-gray-700 whitespace-nowrap"
              >
                {s.route_depart_time} {s.route_depart_now} <span className="text-[10px] ml-1">▼</span>
              </button>
              <button
                type="button"
                className="bg-gray-100 rounded-lg py-1.5 px-3 flex items-center justify-between text-sm font-medium text-gray-700 whitespace-nowrap"
              >
                {s.route_prefer_subway}
              </button>
              <button
                type="button"
                className="bg-gray-100 rounded-lg py-1.5 px-3 flex items-center justify-between text-sm font-medium text-gray-700 whitespace-nowrap"
              >
                {s.route_least_transfers}
              </button>
            </>
          )}
          {selectedTransportMode === 'cycling' && (
            <button
              type="button"
              className="bg-gray-100 rounded-lg py-1.5 px-3 flex items-center justify-between text-sm font-medium text-gray-700 whitespace-nowrap"
            >
              {s.route_avoid_hills}
            </button>
          )}
          {selectedTransportMode === 'walking' && (
            <button
              type="button"
              className="bg-gray-100 rounded-lg py-1.5 px-3 flex items-center justify-between text-sm font-medium text-gray-700 whitespace-nowrap"
            >
              {s.route_prefer_main_roads}
            </button>
          )}
        </div>

        <div className="px-4 pb-2 flex flex-col">
          {!isCollapsed && routeInfo && (
            <>
              <div className="flex items-baseline gap-2 mb-1 mt-1">
                <span className="text-2xl font-bold text-gray-900">{routeInfo.duration}</span>
                <span className="text-lg text-gray-600">({routeInfo.distance})</span>
              </div>
              <div className="text-sm text-app-text-muted mb-4">{getRouteLabelText(routeInfo.routeLabels)}</div>
            </>
          )}
        </div>

        <div className="px-4 mb-4">
          <div className="bg-gray-100 rounded-xl p-4 flex items-center gap-3">
            <IcLocation className="text-gray-900 shrink-0" size={24} />
            <div className="flex-1 overflow-hidden">
              <div className="text-base font-bold text-gray-900 truncate">{destination.name}</div>
              {shortDestinationAddress ? (
                <div className="text-sm text-app-text-muted truncate">{shortDestinationAddress}</div>
              ) : null}
            </div>
            <IcNavBack className="text-app-text-muted rotate-180 shrink-0" size={20} />
          </div>
        </div>

        <div className="px-4 pt-2 border-t border-gray-100 bg-gray-50/50 pb-20">
          <div className="font-bold text-lg mb-4 mt-2 py-2">{s.route_detailed_steps}</div>

          <div className="flex gap-4 mb-6 relative">
            <div className="absolute left-[9px] top-6 bottom-[-24px] w-0.5 bg-gray-300" />
            <div className="mt-1 text-blue-500 z-10 bg-gray-50">
              <div className="w-5 h-5 rounded-full border-4 border-blue-100 bg-blue-500" />
            </div>
            <div className="flex-1">
              <div className="text-base text-gray-900 font-medium leading-snug">{isCurrentLocationRoutePoint(origin) ? s.your_current_location : origin?.name}</div>
            </div>
          </div>

          {visibleRouteSteps.map((step, idx) => (
            <div key={idx} className="flex gap-4 mb-6 relative">
              {idx !== visibleRouteSteps.length - 1 && (
                <div className="absolute left-[9px] top-6 bottom-[-24px] w-0.5 bg-gray-300" />
              )}
              <div className="mt-1 text-app-text-muted z-10 bg-gray-50">
                <div className="w-5 h-5 flex items-center justify-center">
                  {step.maneuver?.includes('right') ? (
                    <IcNavBack size={20} className="rotate-180" />
                  ) : step.maneuver?.includes('left') ? (
                    <IcNavBack size={20} />
                  ) : (
                    <IcNavigation size={20} className="text-gray-400" />
                  )}
                </div>
              </div>
              <div className="flex-1">
                <div className="text-base text-gray-900 font-medium leading-snug">
                  {step.instructions || ''}
                </div>
                <div className="text-sm text-app-text-muted mt-1">{step.distanceText}</div>
              </div>
            </div>
          ))}

          <div className="flex gap-4 mb-8">
            <div className="mt-1 text-red-500 z-10">
              <IcLocation size={20} fill="currentColor" />
            </div>
            <div className="flex-1">
              <div className="text-base text-gray-900 font-medium">{destination.name}</div>
              {shortDestinationAddress ? (
                <div className="text-sm text-app-text-muted mt-1">{shortDestinationAddress}</div>
              ) : null}
              {destinationSideHint ? (
                <div className="flex items-center gap-1.5 text-sm text-app-primary mt-2">
                  <InfoCircleIcon className="w-4 h-4 shrink-0" />
                  <span>{destinationSideHint}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    ) : (
      <div className="px-4 pb-2 flex flex-col shrink-0">
        {!isCollapsed && routeInfo && (
          <>
            <div className="flex items-baseline gap-2 mb-1 mt-1">
              <span className="text-2xl font-bold text-gray-900">{routeInfo.duration}</span>
              <span className="text-lg text-gray-600">({routeInfo.distance})</span>
            </div>
            <div className="text-sm text-app-text-muted mb-4">{getRouteLabelText(routeInfo.routeLabels)}</div>
          </>
        )}
      </div>
    )}

    <div className="px-4 pb-safe pt-2 bg-app-surface shrink-0 z-20">
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          className="px-5 py-2.5 bg-teal-800 text-white rounded-full font-bold text-base shadow-sm active:bg-teal-900 flex items-center justify-center gap-2 min-w-[100px]"
          onClick={() => {
            setIsNavigating(true);
            if (mapInstance && origin) {
              mapInstance.setZoom(19);
              mapInstance.setTilt(45);
              mapInstance.panTo({ lat: origin.lat, lng: origin.lng });
            }
          }}
        >
          <IcNavigation size={18} fill="currentColor" />
          {s.route_start}
        </button>
        <button
          type="button"
          className="flex-1 px-3 py-2.5 bg-teal-50 text-teal-900 rounded-full font-bold text-sm active:bg-teal-100 flex items-center justify-center gap-1"
        >
          <IcLocation size={16} />
          {s.route_add_stop}
        </button>
        <button
          type="button"
          className="flex-1 px-3 py-2.5 bg-teal-50 text-teal-900 rounded-full font-bold text-sm active:bg-teal-100 flex items-center justify-center gap-1"
        >
          <IcShare size={16} />
          {s.route_share}
        </button>
      </div>
    </div>
    </div>
  );
};
