import React from 'react';
import googleMapsBrandIcon from '../../assets/google_maps_icon_2020.svg';
import googleMicBrandIcon from '../../assets/google_mic.svg';
import { EXPLORE_CATEGORIES } from '../../constants';
import type { TransitionId } from '../../navigation.declaration';
import { useMapStrings } from '../../hooks/useMapStrings';

export const ExploreSearchBar: React.FC<{
  mapInstance: google.maps.Map | null;
  go: (
    id: TransitionId,
    params?: Record<string, string | number>,
    options?: { mode?: 'push' | 'replace'; popTo?: string; popToInclusive?: boolean; state?: unknown },
  ) => void;
  /** 由父组件 `bindTap('profile.open')` 展开得到 */
  profileTriggerProps: Record<string, unknown>;
  searchNearby: (type: string) => void;
}> = ({ mapInstance, go, profileTriggerProps, searchNearby }) => {
  const s = useMapStrings();

  return (
    <div className="pt-12 px-4 pb-2 bg-gradient-to-b from-white/90 via-white/50 to-transparent">
    <div className="pointer-events-auto shadow-md rounded-full bg-app-surface flex items-center p-3 border border-gray-100">
      <img src={googleMapsBrandIcon} className="w-6 h-6 mr-3 shrink-0" width={24} height={24} alt="Google Maps" />
      <div
        className="flex-1 text-app-text-muted text-lg truncate"
        onClick={() => {
          const mc = mapInstance?.getCenter();
          go(
            'search.open',
            undefined,
            mc ? { state: { viewportCenter: { lat: mc.lat(), lng: mc.lng() } } } : undefined,
          );
        }}
      >
        {s.search_placeholder}
      </div>
      <div className="flex items-center gap-3 pl-3 ml-2 shrink-0">
        <img src={googleMicBrandIcon} className="w-6 h-6 shrink-0" width={24} height={24} alt={s.search_voice} />
                <button
          type="button"
          className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold text-xs border border-app-border ml-1"
          {...(profileTriggerProps as object)}
        >
          U
        </button>
      </div>
    </div>

    <div className="pointer-events-auto flex gap-2 overflow-x-auto no-scrollbar py-3 pl-1">
      {EXPLORE_CATEGORIES.map((cat) => (
        <button
          key={cat.searchType}
          type="button"
          className="flex items-center gap-1.5 bg-app-surface px-4 py-2 rounded-full shadow-sm border border-gray-100 whitespace-nowrap active:bg-gray-50"
          onClick={() => searchNearby(cat.searchType)}
        >
          <cat.icon size={16} className="text-gray-600" />
          <span className="text-sm text-gray-700 font-medium">{s[cat.labelKey]}</span>
        </button>
      ))}
    </div>
  </div>
  );
};
