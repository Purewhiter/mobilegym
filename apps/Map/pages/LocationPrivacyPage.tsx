import React from 'react';
import { IcClose } from '../res/icons';
import { useMapGestures } from '../hooks/useMapGestures';
import { useMapStore } from '../state';
import { useMapStrings } from '../hooks/useMapStrings';

export const LocationPrivacyPage: React.FC = () => {
  const { bindBack } = useMapGestures();
  const locationPrivacy = useMapStore((s) => s.settings.locationPrivacy);
  const updateLocationPrivacy = useMapStore((s) => s.updateLocationPrivacy);
  const s = useMapStrings();

  return (
    <div className="font-sans flex flex-col h-full bg-app-surface">
      <div className="flex items-center gap-4 px-4 pb-4 pt-12 shadow-sm z-10 bg-app-surface border-b border-gray-100">
        <button
          {...bindBack()}
          className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100"
        >
          <IcClose size={24} className="text-gray-600" />
        </button>
        <div className="text-xl font-medium text-gray-900">{s.location_privacy_title}</div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-4">
        <div className="py-4">
          <div className="text-[17px] font-bold text-gray-900">{s.location_device_location}</div>
          <div className="text-[15px] font-medium text-app-primary">{s.location_enabled}</div>
        </div>

        <div className="py-4">
          <div className="text-[17px] font-bold text-gray-900">{s.location_google_maps_location}</div>
          <div className="text-[13px] text-app-text-muted mb-2">{s.location_permission_when_using}</div>
          <div className="text-[13px] text-app-text-muted">{s.location_permission_desc}</div>
        </div>

        <div className="flex justify-between items-center py-4">
          <div className="text-[17px] font-bold text-gray-900">{s.location_save_recent_searches}</div>
          <button
            className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${
              locationPrivacy.saveRecentSearches ? 'bg-app-primary-dark' : 'bg-gray-200'
            }`}
            onClick={() =>
              updateLocationPrivacy('saveRecentSearches', !locationPrivacy.saveRecentSearches)
            }
          >
            <div
              className={`absolute top-1 w-5 h-5 rounded-full bg-app-surface transition-all ${
                locationPrivacy.saveRecentSearches ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LocationPrivacyPage;
