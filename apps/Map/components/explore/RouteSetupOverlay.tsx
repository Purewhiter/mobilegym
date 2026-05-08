import React from 'react';
import { IcClock, IcLocation, IcNavBack, IcSwapVertical } from '../../res/icons';
import type { MapSearchHistoryEntry } from '../../state';
import { isCurrentLocationRoutePoint, type RoutePoint } from '../../hooks/useRouting';
import { useMapGestures } from '../../hooks/useMapGestures';
import { useMapStrings } from '../../hooks/useMapStrings';

type TransportModeKey = 'driving' | 'transit' | 'walking' | 'cycling';

type ModeTab = {
  key: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number; fill?: string }>;
};

type RouteSide = 'origin' | 'destination';

const FIELD_ROW_MIN_H = 'min-h-14';

export const RouteSetupOverlay: React.FC<{
  origin: RoutePoint | null;
  anchorSide: RouteSide;
  searchHistory: MapSearchHistoryEntry[];
  selectedTransportMode: TransportModeKey;
  setAnchorSide: (side: RouteSide) => void;
  setSelectedTransportMode: (mode: TransportModeKey) => void;
  modes: ModeTab[];
  onOpenPointPicker: (side: RouteSide, initialQuery?: string) => void;
  onSelectHistoryPlace: (placeId: string, side: RouteSide) => void;
}> = ({
  origin,
  anchorSide,
  searchHistory,
  selectedTransportMode,
  setAnchorSide,
  setSelectedTransportMode,
  modes,
  onOpenPointPicker,
  onSelectHistoryPlace,
}) => {
  const s = useMapStrings();
  const { bindBack, bindTap } = useMapGestures();

  const originLabel = origin?.name || s.your_location;
  const transportModes = modes.filter((mode) => mode.key !== 'cycling');
  const placeHistory = searchHistory.filter(
    (item): item is MapSearchHistoryEntry & { kind: 'place'; placeId: string } =>
      item.kind === 'place' && typeof item.placeId === 'string' && item.placeId.length > 0,
  );

  const fieldBase =
    'flex w-full items-center gap-3 rounded-xl border bg-white px-3.5 text-left transition-colors active:bg-gray-50';

  return (
    <div className="absolute inset-0 z-30 bg-white pointer-events-auto" data-status-bar-foreground="dark">
      <div className="flex h-full flex-col pt-10">
        <div className="shrink-0 px-3 pb-2">
          <div className="flex items-start gap-1">
            <button
              type="button"
              className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-800 active:bg-gray-100"
              {...bindBack<HTMLButtonElement>()}
            >
              <IcNavBack size={24} />
            </button>

            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-2">
                  <div className="flex w-5 shrink-0 justify-center pt-0.5">
                    <div className="h-3.5 w-3.5 shrink-0 rounded-full bg-[#1A73E8]" aria-hidden />
                  </div>
                  <button
                    type="button"
                    className={`${fieldBase} ${FIELD_ROW_MIN_H} ${
                      anchorSide === 'origin' ? 'border-[#1A73E8]/45 ring-1 ring-[#1A73E8]/25' : 'border-gray-200'
                    }`}
                    {...bindTap<HTMLButtonElement>(
                      { kind: 'action', id: 'routeSetup.open.originPicker' },
                      {
                        onTrigger: () => {
                          setAnchorSide('origin');
                          onOpenPointPicker(
                            'origin',
                            isCurrentLocationRoutePoint(origin) ? '' : originLabel,
                          );
                        },
                      },
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-[17px] font-medium text-[#1A73E8]">
                      {originLabel}
                    </span>
                  </button>
                </div>

                <div className="flex h-3 items-stretch gap-2">
                  <div className="flex w-5 shrink-0 justify-center">
                    <div className="h-full border-l-2 border-dashed border-gray-300" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1" />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex w-5 shrink-0 justify-center">
                    <IcLocation size={20} className="text-[#EA4335]" fill="currentColor" strokeWidth={2} />
                  </div>
                  <button
                    type="button"
                    className={`${fieldBase} ${FIELD_ROW_MIN_H} ${
                      anchorSide === 'destination'
                        ? 'border-[#1A73E8]/35 ring-1 ring-[#1A73E8]/20'
                        : 'border-gray-200'
                    }`}
                    {...bindTap<HTMLButtonElement>(
                      { kind: 'action', id: 'routeSetup.open.destinationPicker' },
                      {
                        onTrigger: () => {
                          setAnchorSide('destination');
                          onOpenPointPicker('destination');
                        },
                      },
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-[17px] text-gray-500">
                      {s.route_setup_select_dest}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-600 active:bg-gray-100"
                {...bindTap<HTMLButtonElement>(
                  { kind: 'action', id: 'routeSetup.swap' },
                  {
                    onTrigger: () => {
                      setAnchorSide(anchorSide === 'origin' ? 'destination' : 'origin');
                    },
                  },
                )}
              >
                <IcSwapVertical size={22} strokeWidth={2.1} />
              </button>
            </div>
          </div>

          <div className="mt-4 flex justify-center px-1">
            <div className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 p-1">
              {transportModes.map((mode) => {
                const Icon = mode.icon;
                const active = selectedTransportMode === mode.key;
                return (
                  <button
                    key={mode.key}
                    type="button"
                    className={`flex h-11 w-[52px] items-center justify-center rounded-full transition-colors ${
                      active ? 'bg-[#B8D4F5] text-gray-900 shadow-sm' : 'text-gray-500 active:bg-gray-200/80'
                    }`}
                    {...bindTap<HTMLButtonElement>(
                      { kind: 'action', id: 'routeSetup.transport.select' },
                      {
                        onTrigger: () => setSelectedTransportMode(mode.key as TransportModeKey),
                      },
                    )}
                  >
                    <Icon
                      size={22}
                      strokeWidth={active ? 2.35 : 2}
                      fill={active ? 'currentColor' : 'none'}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto border-t border-gray-200 bg-white">
          {placeHistory.map((item) => (
            <button
              key={item.id}
              type="button"
              className="flex w-full items-start gap-3 px-4 py-3.5 text-left active:bg-gray-50"
              {...bindTap<HTMLButtonElement>(
                { kind: 'action', id: 'routeSetup.history.select' },
                {
                  onTrigger: () => onSelectHistoryPlace(item.placeId, anchorSide),
                },
              )}
            >
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <IcClock size={18} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1 border-b border-gray-200 pb-3.5">
                <div className="truncate text-[17px] font-semibold text-gray-900">{item.text}</div>
                {item.subtitle ? (
                  <div className="mt-0.5 truncate text-sm text-gray-500">{item.subtitle}</div>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
