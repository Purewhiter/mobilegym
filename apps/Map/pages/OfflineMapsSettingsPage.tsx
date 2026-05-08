import React, { useState } from 'react';
import { IcClose } from '../res/icons';
import { useMapGestures } from '../hooks/useMapGestures';
import { useMapBackHandler } from '../hooks/useMapBackHandler';
import { useMapStore } from '../state';
import { useMapStrings } from '../hooks/useMapStrings';
import { localizeMapSettingValue } from '../utils/localizeMapValue';

export const OfflineMapsSettingsPage: React.FC = () => {
  const { bindBack } = useMapGestures();
  const offlineMapPrefs = useMapStore((s) => s.settings.offlineMaps);
  const updateOfflineMapPrefs = useMapStore((s) => s.updateOfflineMapPrefs);
  const [showDownloadPrefsModal, setShowDownloadPrefsModal] = useState(false);
  const [tempPref, setTempPref] = useState(offlineMapPrefs.downloadPreference);
  const s = useMapStrings();
  const downloadPrefOptions = [
    { value: '仅通过 WLAN 网络', label: s.offline_wlan_only },
    { value: '通过 WLAN 或移动网络', label: s.offline_wlan_or_mobile },
  ] as const;

  useMapBackHandler(
    () => {
      setShowDownloadPrefsModal(false);
      return true;
    },
    { enabled: showDownloadPrefsModal, priority: 920, scope: 'any' },
  );

  const handleOpenModal = () => {
    setTempPref(offlineMapPrefs.downloadPreference);
    setShowDownloadPrefsModal(true);
  };

  const handleSavePref = () => {
    updateOfflineMapPrefs('downloadPreference', tempPref);
    setShowDownloadPrefsModal(false);
  };

  return (
    <div className="font-sans flex flex-col h-full bg-app-surface">
      <div className="flex items-center gap-4 px-4 pb-4 pt-12 shadow-sm z-10 bg-app-surface border-b border-gray-100">
        <button
          {...bindBack()}
          className="w-8 h-8 flex items-center justify-center rounded-full active:bg-gray-100"
        >
          <IcClose size={24} className="text-gray-600" />
        </button>
        <div className="text-xl font-medium text-gray-900">{s.offline_maps_title}</div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-4">
        <div className="flex justify-between items-start py-4">
          <div>
            <div className="text-[17px] font-bold text-gray-900">{s.offline_auto_update}</div>
            <div className="text-[13px] text-app-text-muted mt-1">{s.offline_auto_update_desc}</div>
          </div>
          <button
            className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${
              offlineMapPrefs.autoUpdate ? 'bg-app-primary-dark' : 'bg-gray-200'
            }`}
            onClick={() => updateOfflineMapPrefs('autoUpdate', !offlineMapPrefs.autoUpdate)}
          >
            <div
              className={`absolute top-1 w-5 h-5 rounded-full bg-app-surface transition-all ${
                offlineMapPrefs.autoUpdate ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        <div className="flex justify-between items-center py-4">
          <div className="text-[17px] font-bold text-gray-900">{s.offline_auto_download}</div>
          <button
            className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${
              offlineMapPrefs.autoDownloadRecommended ? 'bg-app-primary-dark' : 'bg-gray-200'
            }`}
            onClick={() =>
              updateOfflineMapPrefs(
                'autoDownloadRecommended',
                !offlineMapPrefs.autoDownloadRecommended
              )
            }
          >
            <div
              className={`absolute top-1 w-5 h-5 rounded-full bg-app-surface transition-all ${
                offlineMapPrefs.autoDownloadRecommended ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        <div
          className="flex justify-between items-center py-4 active:bg-gray-50 -mx-4 px-4 rounded-lg cursor-pointer"
          onClick={handleOpenModal}
        >
          <div className="text-[17px] font-bold text-gray-900">{s.offline_download_prefs}</div>
          <div className="text-[13px] text-app-text-muted">{localizeMapSettingValue(offlineMapPrefs.downloadPreference, s)}</div>
        </div>

        <div className="py-4">
          <div className="text-[17px] font-bold text-gray-900">{s.offline_about}</div>
          <div className="text-[13px] text-app-text-muted mt-1">{s.offline_about_desc}</div>
        </div>
      </div>

      {showDownloadPrefsModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-8 font-sans"
          onClick={() => setShowDownloadPrefsModal(false)}
        >
          <div
            className="bg-app-surface rounded-3xl w-full max-w-xs p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xl font-bold text-gray-900 mb-6">{s.offline_download_prefs_title}</div>
            <div className="space-y-4 mb-6">
              {downloadPrefOptions.map((opt) => (
                <div
                  key={opt.value}
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setTempPref(opt.value)}
                >
                  <div
                    className={`w-5 h-5 rounded-full border-[2px] shrink-0 flex items-center justify-center p-0.5 ${
                      tempPref === opt.value ? 'border-app-primary' : 'border-gray-500'
                    }`}
                  >
                    {tempPref === opt.value && (
                      <div className="w-full h-full rounded-full bg-app-primary" />
                    )}
                  </div>
                  <div className="text-base text-gray-900">{opt.label}</div>
                </div>
              ))}
            </div>
            <div className="flex justify-between gap-3">
              <button
                onClick={() => setShowDownloadPrefsModal(false)}
                className="flex-1 bg-[#D2E3FC] text-app-primary py-2.5 rounded-full font-bold text-sm active:bg-blue-200"
              >
                {s.filter_cancel}
              </button>
              <button
                onClick={handleSavePref}
                className="flex-1 bg-app-primary text-white py-2.5 rounded-full font-bold text-sm active:bg-[#005f66]"
              >
                {s.filter_save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineMapsSettingsPage;
