import React, { useState } from 'react';
import { IcClose, IcHelp } from '../res/icons';
import { useMapGestures } from '../hooks/useMapGestures';
import { useMapBackHandler } from '../hooks/useMapBackHandler';
import { useMapStore } from '../state';
import { useMapStrings } from '../hooks/useMapStrings';
import { localizeMapSettingValue } from '../utils/localizeMapValue';

export const TrafficInfoPage: React.FC = () => {
  const { go, bindBack } = useMapGestures();
  const trafficNotifications = useMapStore((s) => s.settings.notifications.traffic);
  const setAllTrafficNotifications = useMapStore((s) => s.setAllTrafficNotifications);
  const [showGlobalPrefsModal, setShowGlobalPrefsModal] = useState(false);
  const [tempGlobalPref, setTempGlobalPref] = useState<string>('开启');
  const s = useMapStrings();
  const trafficItems = [
    { id: 'offlineMaps', title: s.traffic_offline_maps },
    { id: 'nearbyTraffic', title: s.traffic_nearby_incidents },
    { id: 'publicTransport', title: s.traffic_public_transit },
    { id: 'parkingLocation', title: s.traffic_parking },
    { id: 'desktopDirections', title: s.traffic_desktop_directions },
  ] as const;
  const globalOptions = ['开启', '关闭', '仅限应用'] as const;

  useMapBackHandler(
    () => {
      setShowGlobalPrefsModal(false);
      return true;
    },
    { enabled: showGlobalPrefsModal, priority: 920, scope: 'any' },
  );

  const handleGlobalConfirm = () => {
    setAllTrafficNotifications(tempGlobalPref);
    setShowGlobalPrefsModal(false);
  };

  return (
    <div className="font-sans flex flex-col h-full bg-app-surface">
      <div className="flex justify-between items-center px-6 pt-12 pb-4 bg-app-surface border-b border-transparent">
        <div className="text-[28px] font-bold text-gray-900">{s.traffic_title}</div>
        <button
          {...bindBack()}
          className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center"
        >
          <IcClose size={20} className="text-gray-600" />
        </button>
      </div>

      <div
        className="px-6 pb-4 border-b border-gray-100 active:bg-gray-50 cursor-pointer"
        onClick={() => {
          setTempGlobalPref(trafficNotifications.offlineMaps);
          setShowGlobalPrefsModal(true);
        }}
      >
        <span className="text-[17px] text-gray-900">{s.notification_pref_all_types}</span>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        {trafficItems.map((item) => (
          <div
            key={item.id}
            className="py-4 border-b border-gray-100 active:bg-gray-50 px-6 cursor-pointer"
            onClick={() => go('settings.notifications.traffic.sub.open', { subId: item.id })}
          >
            <div className="text-[17px] text-gray-900 mb-1">{item.title}</div>
            <div className="text-[13px] text-app-text-muted">
              {localizeMapSettingValue(trafficNotifications[item.id], s)}
            </div>
          </div>
        ))}
      </div>

      {showGlobalPrefsModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-8 font-sans"
          onClick={() => setShowGlobalPrefsModal(false)}
        >
          <div
            className="bg-app-surface rounded-3xl w-full max-w-xs p-6 shadow-xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xl font-bold text-gray-900 mb-6">{s.notification_setting}</div>
            <div className="space-y-6 mb-8">
              {globalOptions.map((option) => (
                <div
                  key={option}
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setTempGlobalPref(option)}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-[2px] shrink-0 flex items-center justify-center p-0.5 ${
                      tempGlobalPref === option ? 'border-app-primary' : 'border-gray-500'
                    }`}
                  >
                    {tempGlobalPref === option && (
                      <div className="w-full h-full rounded-full bg-app-primary" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-base text-gray-900">{localizeMapSettingValue(option, s)}</span>
                    {option === '仅限应用' && (
                      <IcHelp size={16} className="text-gray-400 shrink-0" />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-3">
              <button
                onClick={() => setShowGlobalPrefsModal(false)}
                className="flex-1 bg-[#D2E3FC] text-app-primary py-2.5 rounded-full font-bold text-sm active:bg-blue-200"
              >
                {s.filter_cancel}
              </button>
              <button
                onClick={handleGlobalConfirm}
                className="flex-1 bg-app-primary text-white py-2.5 rounded-full font-bold text-sm active:bg-[#005f66]"
              >
                {s.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrafficInfoPage;
