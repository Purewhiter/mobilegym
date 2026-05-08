import React from 'react';
import {
  IcStar,
  IcClose,
  IcBookmark,
  IcShare,
  IcNavigation,
  IcHotel,
  IcLayers,
  IcPhone,
  IcGlobe,
  IcMore,
  IcCheck,
} from '../../res/icons';
import { getPlaceTypeLabel } from '../../constants';
import { getDate as timeGetDate } from '../../../../os/TimeService';
import { buildAboutSections, computeOpeningStatusFromPeriods } from '../../utils/placeUtils';
import { HoursCard } from '../HoursCard';
import { AddressCard } from '../AddressCard';
import { useMapBackHandler } from '../../hooks/useMapBackHandler';
import { useMapStrings } from '../../hooks/useMapStrings';
import { useLocale } from '../../locale';

interface PlaceDetailSheetProps {
  sheetRef: React.RefObject<HTMLDivElement | null>;
  sheetHeight: number;
  isDragging: boolean;
  isLoading: boolean;
  detailSheetPointerHandlers: {
    onPointerDown: React.PointerEventHandler<HTMLDivElement>;
    onPointerMove: React.PointerEventHandler<HTMLDivElement>;
    onPointerUp: React.PointerEventHandler<HTMLDivElement>;
    onPointerCancel: React.PointerEventHandler<HTMLDivElement>;
  };
  selectedPlace: google.maps.places.PlaceResult & Record<string, unknown>;
  setSelectedPlace: (p: google.maps.places.PlaceResult | null) => void;
  replaceState: (state: Record<string, unknown>) => void;
  detailTab: 'overview' | 'about';
  setDetailTab: (t: 'overview' | 'about') => void;
}

export const PlaceDetailSheet: React.FC<PlaceDetailSheetProps> = ({
  sheetRef,
  sheetHeight,
  isDragging,
  isLoading,
  detailSheetPointerHandlers,
  selectedPlace,
  setSelectedPlace,
  replaceState,
  detailTab,
  setDetailTab,
}) => {
  const s = useMapStrings();
  const locale = useLocale();
  const handleClose = () => {
    setSelectedPlace(null);
    replaceState({});
  };

  useMapBackHandler(
    () => {
      handleClose();
      return true;
    },
    { priority: 450 },
  );

  return (
    <div
      ref={sheetRef}
      className="absolute bottom-0 left-0 right-0 bg-app-surface rounded-t-3xl shadow-up z-20 flex flex-col"
      style={{
        height: `${sheetHeight}px`,
        transition: isDragging ? 'none' : 'height 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)',
      }}
    >
    <div className="flex justify-center pt-3 pb-1 shrink-0 w-full touch-none" {...detailSheetPointerHandlers}>
      <div className="w-10 h-1 bg-gray-300 rounded-full" />
    </div>

    <div className="px-5 pt-1 shrink-0 touch-none" {...detailSheetPointerHandlers}>
      <div className="absolute top-4 right-4 flex items-center gap-3 z-10" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-700">
          <IcBookmark size={20} />
        </button>
        <button type="button" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-700">
          <IcShare size={20} />
        </button>
        <button
          type="button"
          className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-700"
          onClick={handleClose}
        >
          <IcClose size={20} />
        </button>
      </div>

      <h3 className="text-2xl font-bold text-gray-900 pr-28 leading-tight mb-1">{selectedPlace.name || s.place_detail_title}</h3>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-app-text-muted mb-3">
          <div className="h-4 w-4 rounded-full border-2 border-gray-200 border-t-teal-700 animate-spin" />
          <span>{s.place_loading_detail}</span>
        </div>
      )}

      {!isLoading && selectedPlace.rating != null && (
        <div className="flex items-center gap-1 mb-1">
          <span className="text-gray-900 font-medium">{selectedPlace.rating.toFixed(1)}</span>
          <div className="flex text-amber-500 text-[10px] gap-0.5">
            {[...Array(5)].map((_, i) => (
              <IcStar
                key={i}
                size={12}
                fill="currentColor"
                stroke="none"
                className={i < Math.round(selectedPlace.rating!) ? '' : 'text-gray-300'}
              />
            ))}
          </div>
          {selectedPlace.user_ratings_total != null && (
            <span className="text-app-text-muted text-sm">({selectedPlace.user_ratings_total.toLocaleString()})</span>
          )}
        </div>
      )}

      {!isLoading && (
        <div className="text-sm text-app-text-muted mb-1">
          {getPlaceTypeLabel(
            selectedPlace.types,
            (selectedPlace as { primaryType?: string }).primaryType,
            (selectedPlace as { primaryTypeDisplayName?: string }).primaryTypeDisplayName,
            locale,
          )}
        </div>
      )}

      {!isLoading &&
        (() => {
        const hrs = (selectedPlace as { regularOpeningHours?: { periods?: unknown[] } }).regularOpeningHours;
        if (!hrs?.periods?.length) return null;
        const { isOpen, closesAt, opensNextLabel } = computeOpeningStatusFromPeriods(hrs as { periods: any[] }, timeGetDate(), locale);
        return (
          <div className="text-sm mb-1">
            <span className={isOpen ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
              {isOpen ? s.place_open_now : s.place_closed_now}
            </span>
            {isOpen && closesAt && <span className="text-app-text-muted"> · {s.place_closes_at}{closesAt}</span>}
            {!isOpen && opensNextLabel && <span className="text-app-text-muted"> · {s.place_opens_at}{opensNextLabel}</span>}
          </div>
        );
      })()}

      <div className="mb-4" />

      {isLoading ? (
        <div className="flex gap-3 overflow-x-auto no-scrollbar mb-6" onPointerDown={(e) => e.stopPropagation()}>
          <div className="h-11 flex-1 min-w-[120px] rounded-full bg-gray-100 animate-pulse shrink-0" />
          <div className="h-11 w-24 rounded-full bg-gray-100 animate-pulse shrink-0" />
          <div className="h-11 w-24 rounded-full bg-gray-100 animate-pulse shrink-0" />
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto no-scrollbar mb-6" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="flex-1 bg-teal-800 text-white px-5 py-2.5 rounded-full font-bold text-sm flex items-center justify-center gap-2 shadow-sm shrink-0 min-w-[100px]"
            onClick={() => {
              if (selectedPlace.geometry?.location) {
                replaceState({
                  destination: {
                    lat: selectedPlace.geometry.location.lat(),
                    lng: selectedPlace.geometry.location.lng(),
                    name: selectedPlace.name,
                    address: selectedPlace.formatted_address || selectedPlace.vicinity || undefined,
                    isCurrentLocation: false,
                  },
                });
              }
            }}
          >
            <IcNavigation size={18} fill="currentColor" /> {s.route}
          </button>

          <button
            type="button"
            className="px-5 py-2.5 bg-teal-50 text-teal-800 rounded-full font-bold text-sm flex items-center gap-1 shrink-0"
          >
            <IcNavigation size={16} fill="currentColor" className="rotate-45" /> {s.route_start}
          </button>

          {selectedPlace.types?.includes('lodging') || selectedPlace.types?.includes('hotel') ? (
            <button
              type="button"
              className="px-5 py-2.5 bg-teal-50 text-teal-800 rounded-full font-bold text-sm flex items-center gap-1 shrink-0"
            >
              <IcHotel size={18} /> {s.action_availability}
            </button>
          ) : selectedPlace.types?.includes('tourist_attraction') && !selectedPlace.types?.includes('park') ? (
            <button
              type="button"
              className="px-5 py-2.5 bg-teal-50 text-teal-800 rounded-full font-bold text-sm flex items-center gap-1 shrink-0"
            >
              <IcLayers size={18} /> {s.action_tickets}
            </button>
          ) : null}

          {selectedPlace.types?.includes('restaurant') || selectedPlace.types?.includes('food') ? (
            <>
              <button
                type="button"
                className="px-5 py-2.5 bg-teal-50 text-teal-800 rounded-full font-bold text-sm flex items-center gap-1 shrink-0"
              >
                <IcBookmark size={16} /> {s.action_save}
              </button>
              <button
                type="button"
                className="px-5 py-2.5 bg-teal-50 text-teal-800 rounded-full font-bold text-sm flex items-center gap-1 shrink-0"
              >
                <IcShare size={16} /> {s.action_share}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="px-5 py-2.5 bg-teal-50 text-teal-800 rounded-full font-bold text-sm flex items-center gap-1 shrink-0"
              >
                <IcPhone size={16} /> {s.action_call}
              </button>
              {!(selectedPlace.types?.includes('lodging') || selectedPlace.types?.includes('hotel')) && (
                <button
                  type="button"
                  className="px-5 py-2.5 bg-teal-50 text-teal-800 rounded-full font-bold text-sm flex items-center gap-1 shrink-0"
                >
                  <IcBookmark size={16} /> {s.action_save}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>

    <div className="flex-1 overflow-y-auto no-scrollbar px-5 pb-24">
      {isLoading ? (
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-4 text-app-text-muted">
          <div className="h-10 w-10 rounded-full border-4 border-gray-200 border-t-teal-700 animate-spin" />
          <div className="text-sm">{s.place_loading_detail}</div>
        </div>
      ) : (
        <>
          <div className="flex justify-center border-b border-app-border mb-4 shrink-0">
            <button
              type="button"
              className={`px-5 pb-3 text-sm ${detailTab === 'overview' ? 'text-teal-800 font-bold border-b-2 border-teal-800' : 'text-app-text-muted font-medium'}`}
              onClick={() => setDetailTab('overview')}
            >
              {s.tab_overview}
            </button>
            {selectedPlace.types?.includes('tourist_attraction') && (
              <button type="button" className="px-5 pb-3 text-app-text-muted font-medium text-sm">
                {s.tab_tickets}
              </button>
            )}
            {(selectedPlace.types?.includes('lodging') || selectedPlace.types?.includes('hotel')) && (
              <button type="button" className="px-5 pb-3 text-app-text-muted font-medium text-sm">
                {s.tab_business}
              </button>
            )}
            <button
              type="button"
              className={`px-5 pb-3 text-sm ${detailTab === 'about' ? 'text-teal-800 font-bold border-b-2 border-teal-800' : 'text-app-text-muted font-medium'}`}
              onClick={() => setDetailTab('about')}
            >
              {s.tab_about}
            </button>
          </div>

          {detailTab === 'about' &&
            (() => {
              const aboutSections = buildAboutSections((selectedPlace as { _aboutData?: Record<string, unknown> })._aboutData, locale);
              if (!aboutSections.length)
                return <div className="text-sm text-app-text-muted py-8 text-center">{s.place_no_description}</div>;
              return (
                <div className="pb-6 space-y-6">
                  {aboutSections.map((section) => (
                    <div key={section.title}>
                      <h3 className="text-sm font-medium text-gray-500 mb-3">{section.title}</h3>
                      <div className="flex flex-wrap gap-x-6 gap-y-2.5">
                        {section.items.map((item) => (
                          <div key={item.label} className="flex items-center gap-2 text-sm text-gray-800">
                            <IcCheck size={16} className="text-green-600 shrink-0" />
                            <span>{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

          {detailTab === 'overview' && (
            <div className="pb-6">
              {(selectedPlace as { editorialSummary?: string }).editorialSummary && (
                <div className="bg-gray-50 rounded-2xl px-4 py-3.5 mb-4 flex items-start gap-2">
                  <div className="text-sm text-gray-700 leading-relaxed flex-1">
                    {(selectedPlace as { editorialSummary?: string }).editorialSummary}
                  </div>
                  <button type="button" className="text-gray-400 shrink-0 mt-0.5">
                    <IcMore size={18} />
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {(selectedPlace as { regularOpeningHours?: { periods?: unknown[] } }).regularOpeningHours?.periods?.length ? (
                  (() => {
                    const hrs = (selectedPlace as { regularOpeningHours: { periods: any[]; weekdayDescriptions?: string[] } })
                      .regularOpeningHours;
                    const st = computeOpeningStatusFromPeriods(hrs, timeGetDate(), locale);
                    return (
                      <HoursCard
                        isOpen={st.isOpen}
                        closesAt={st.closesAt}
                        opensNextLabel={st.opensNextLabel}
                        weekdayDescriptions={(hrs.weekdayDescriptions as string[] | undefined) ?? undefined}
                      />
                    );
                  })()
                ) : null}

                <AddressCard
                  address={selectedPlace.formatted_address || selectedPlace.vicinity || ''}
                  plusCode={(selectedPlace as { plusCode?: string | null }).plusCode || null}
                />

                {(selectedPlace as { websiteURI?: string }).websiteURI && (
                  <div className="bg-gray-50 rounded-2xl px-4 py-3.5 flex items-center gap-3.5">
                    <IcGlobe className="text-gray-500 shrink-0" size={20} />
                    <div className="text-sm text-gray-800 truncate flex-1">
                      {(selectedPlace as { websiteURI: string }).websiteURI.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </div>
                  </div>
                )}

                {selectedPlace.formatted_phone_number && (
                  <div className="bg-gray-50 rounded-2xl px-4 py-3.5 flex items-center gap-3.5">
                    <IcPhone className="text-gray-500 shrink-0" size={20} />
                    <div className="text-sm text-gray-800 flex-1">{selectedPlace.formatted_phone_number}</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
    </div>
  );
};
