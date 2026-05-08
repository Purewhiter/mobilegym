import React from 'react';
import {
  IcClose,
  IcPhone2,
  IcNavigation,
  IcBus,
  IcLocation,
  IcDownload,
  IcBell,
  IcShield,
} from '../res/icons';
import { useMapGestures } from '../hooks/useMapGestures';
import { useMapStrings } from '../hooks/useMapStrings';

export const SettingsPage: React.FC = () => {
  const { go, bindBack } = useMapGestures();
  const s = useMapStrings();

  return (
    <div className="flex flex-col h-full bg-app-surface overflow-y-auto no-scrollbar font-sans">
      <div className="flex justify-between items-center px-4 py-4 pt-12 border-b border-transparent">
        <div className="text-2xl font-bold text-gray-900">{s.settings_title}</div>
        <button
          {...bindBack()}
          className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
        >
          <IcClose size={20} className="text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-2">
        <div
          className="flex items-start gap-5 p-4 active:bg-gray-50 rounded-xl"
          onClick={() => go('settings.app-display.open')}
        >
          <div className="mt-1 text-app-text-muted bg-gray-100 p-2 rounded-full">
            <IcPhone2 size={20} />
          </div>
          <div className="flex-1">
            <div className="text-base font-bold text-gray-900 mb-0.5">{s.settings_app_display}</div>
            <div className="text-sm text-app-text-muted">{s.settings_app_display_desc}</div>
          </div>
        </div>

        <div
          className="flex items-start gap-5 p-4 active:bg-gray-50 rounded-xl"
          onClick={() => go('settings.nav.open')}
        >
          <div className="mt-1 text-app-text-muted bg-gray-100 p-2 rounded-full">
            <IcNavigation size={20} />
          </div>
          <div className="flex-1">
            <div className="text-base font-bold text-gray-900 mb-0.5">{s.settings_navigation}</div>
            <div className="text-sm text-app-text-muted">{s.settings_navigation_desc}</div>
          </div>
        </div>

        <div
          className="flex items-start gap-5 p-4 active:bg-gray-50 rounded-xl"
          onClick={() => go('settings.getting-around.open')}
        >
          <div className="mt-1 text-app-text-muted bg-gray-100 p-2 rounded-full">
            <IcBus size={20} />
          </div>
          <div className="flex-1">
            <div className="text-base font-bold text-gray-900 mb-0.5">{s.settings_getting_around}</div>
            <div className="text-sm text-app-text-muted">{s.settings_getting_around_desc}</div>
          </div>
        </div>

        <div
          className="flex items-start gap-5 p-4 active:bg-gray-50 rounded-xl"
          onClick={() => go('settings.location-privacy.open')}
        >
          <div className="mt-1 text-app-text-muted bg-gray-100 p-2 rounded-full">
            <IcLocation size={20} />
          </div>
          <div className="flex-1">
            <div className="text-base font-bold text-gray-900 mb-0.5">{s.settings_location_privacy}</div>
            <div className="text-sm text-app-text-muted">{s.settings_location_privacy_desc}</div>
          </div>
        </div>

        <div
          className="flex items-start gap-5 p-4 active:bg-gray-50 rounded-xl"
          onClick={() => go('settings.offline-maps.open')}
        >
          <div className="mt-1 text-app-text-muted bg-gray-100 p-2 rounded-full">
            <IcDownload size={20} />
          </div>
          <div className="flex-1">
            <div className="text-base font-bold text-gray-900 mb-0.5">{s.settings_offline_maps}</div>
            <div className="text-sm text-app-text-muted">{s.settings_offline_maps_desc}</div>
          </div>
        </div>

        <div
          className="flex items-start gap-5 p-4 active:bg-gray-50 rounded-xl"
          onClick={() => go('settings.notifications.open')}
        >
          <div className="mt-1 text-app-text-muted bg-gray-100 p-2 rounded-full">
            <IcBell size={20} />
          </div>
          <div className="flex-1">
            <div className="text-base font-bold text-gray-900 mb-0.5">{s.settings_notifications}</div>
            <div className="text-sm text-app-text-muted">{s.settings_notifications_desc}</div>
          </div>
        </div>

        <div className="flex items-center gap-5 p-4 active:bg-gray-50 rounded-xl">
          <div className="text-app-text-muted bg-gray-100 p-2 rounded-full">
            <IcShield size={20} />
          </div>
          <div className="flex-1">
            <div className="text-base font-bold text-gray-900">{s.settings_about_terms}</div>
          </div>
        </div>

        <div className="p-6 mt-4">
          <button className="text-base font-medium text-gray-900">{s.action_login}</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
