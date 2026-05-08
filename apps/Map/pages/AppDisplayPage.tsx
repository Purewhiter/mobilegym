import React, { useState } from 'react';
import { IcNavBack } from '../res/icons';
import { useMapGestures } from '../hooks/useMapGestures';
import { useMapBackHandler } from '../hooks/useMapBackHandler';
import { useMapStore } from '../state';
import { useMapStrings } from '../hooks/useMapStrings';
import { localizeMapSettingValue } from '../utils/localizeMapValue';

export const AppDisplayPage: React.FC = () => {
  const { bindBack, go } = useMapGestures();
  const appDisplay = useMapStore((s) => s.settings.appDisplay);
  const updateAppDisplay = useMapStore((s) => s.updateAppDisplay);
  const s = useMapStrings();

  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showDistanceModal, setShowDistanceModal] = useState(false);
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [tempTheme, setTempTheme] = useState(appDisplay.theme);
  const [tempVideo, setTempVideo] = useState(appDisplay.videoAutoplay);

  useMapBackHandler(
    () => {
      setShowThemeModal(false);
      return true;
    },
    { enabled: showThemeModal, priority: 920, scope: 'any' },
  );

  useMapBackHandler(
    () => {
      setShowDistanceModal(false);
      return true;
    },
    { enabled: showDistanceModal, priority: 920, scope: 'any' },
  );

  useMapBackHandler(
    () => {
      setShowScaleModal(false);
      return true;
    },
    { enabled: showScaleModal, priority: 920, scope: 'any' },
  );

  useMapBackHandler(
    () => {
      setShowVideoModal(false);
      return true;
    },
    { enabled: showVideoModal, priority: 920, scope: 'any' },
  );

  const handleThemeSave = () => {
    updateAppDisplay('theme', tempTheme);
    setShowThemeModal(false);
  };

  const handleVideoSave = () => {
    updateAppDisplay('videoAutoplay', tempVideo);
    setShowVideoModal(false);
  };

  const handleDistanceSelect = (v: string) => {
    updateAppDisplay('distanceUnit', v);
    setShowDistanceModal(false);
  };

  const handleScaleSelect = (v: string) => {
    updateAppDisplay('scaleBar', v);
    setShowScaleModal(false);
  };

  const themeOptions = [
    { value: '始终采用浅色主题', label: s.theme_light },
    { value: '始终采用深色主题', label: s.theme_dark },
    { value: '与设备主题背景一致', label: s.theme_device },
  ] as const;
  const distanceOptions = [
    { value: '自动', label: s.distance_unit_auto },
    { value: '公里', label: s.distance_unit_km },
    { value: '英里', label: s.distance_unit_miles },
  ] as const;
  const scaleOptions = [
    { value: '缩放时', label: s.scale_bar_on_zoom },
    { value: '始终', label: s.scale_bar_always },
  ] as const;
  const videoOptions = [
    { value: '自动播放功能已关闭', label: s.video_autoplay_off },
    { value: '始终开启自动播放功能', label: s.video_autoplay_always },
    { value: '仅在连接到 Wi-Fi 时自动播放', label: s.video_autoplay_wifi },
  ] as const;

  const RadioOption: React.FC<{
    label: string;
    selected: boolean;
    onSelect: () => void;
  }> = ({ label, selected, onSelect }) => (
    <div className="flex items-center gap-3 cursor-pointer" onClick={onSelect}>
      <div
        className={`w-5 h-5 rounded-full border-[2px] shrink-0 flex items-center justify-center p-0.5 ${
          selected ? 'border-app-primary' : 'border-gray-500'
        }`}
      >
        {selected && <div className="w-full h-full rounded-full bg-app-primary" />}
      </div>
      <div className="text-base text-gray-900">{label}</div>
    </div>
  );

  return (
    <div className="font-sans flex flex-col h-full bg-app-surface">
      <div className="flex items-center gap-4 px-4 pb-4 pt-12 shadow-sm z-10 bg-app-surface border-b border-gray-100">
        <button {...bindBack()}>
          <IcNavBack size={24} className="text-gray-900" />
        </button>
        <div className="text-xl font-medium text-gray-900">{s.app_display_title}</div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div
          className="flex items-center justify-between py-4 px-4 border-b border-gray-100 active:bg-gray-50"
          onClick={() => go('settings.app-display.language.open')}
        >
          <div className="text-base font-medium text-gray-900">{s.app_display_language}</div>
          <div className="text-sm text-app-text-muted">{localizeMapSettingValue(appDisplay.language, s)}</div>
        </div>

        <div
          className="flex items-center justify-between py-4 px-4 border-b border-gray-100 active:bg-gray-50"
          onClick={() => {
            setTempTheme(appDisplay.theme);
            setShowThemeModal(true);
          }}
        >
          <div className="text-base font-medium text-gray-900">{s.app_display_theme}</div>
          <div className="text-sm text-app-text-muted">{localizeMapSettingValue(appDisplay.theme, s)}</div>
        </div>

        <div
          className="flex items-center justify-between py-4 px-4 border-b border-gray-100 active:bg-gray-50"
          onClick={() => setShowDistanceModal(true)}
        >
          <div className="text-base font-medium text-gray-900">{s.app_display_distance_unit}</div>
          <div className="text-sm text-app-text-muted">{localizeMapSettingValue(appDisplay.distanceUnit, s)}</div>
        </div>

        <div
          className="flex items-center justify-between py-4 px-4 border-b border-gray-100 active:bg-gray-50"
          onClick={() => setShowScaleModal(true)}
        >
          <div className="text-base font-medium text-gray-900">{s.app_display_scale_bar}</div>
          <div className="text-sm text-app-text-muted">{localizeMapSettingValue(appDisplay.scaleBar, s)}</div>
        </div>

        <div
          className="flex items-center justify-between py-4 px-4 border-b border-gray-100 active:bg-gray-50"
          onClick={() => {
            setTempVideo(appDisplay.videoAutoplay);
            setShowVideoModal(true);
          }}
        >
          <div className="text-base font-medium text-gray-900">{s.app_display_video_autoplay}</div>
          <div className="text-sm text-app-text-muted">{localizeMapSettingValue(appDisplay.videoAutoplay, s)}</div>
        </div>

        <div className="flex items-center justify-between py-4 px-4 border-b border-gray-100">
          <div className="text-base font-medium text-gray-900">{s.app_display_wlan_only}</div>
          <button
            className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${
              appDisplay.wlanOnly ? 'bg-app-primary-dark' : 'bg-gray-200'
            }`}
            onClick={() => updateAppDisplay('wlanOnly', !appDisplay.wlanOnly)}
          >
            <div
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                appDisplay.wlanOnly ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between py-4 px-4 border-b border-gray-100">
          <div className="text-base font-medium text-gray-900">{s.app_display_satellite}</div>
          <button
            className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${
              appDisplay.satelliteView ? 'bg-app-primary-dark' : 'bg-gray-200'
            }`}
            onClick={() => updateAppDisplay('satelliteView', !appDisplay.satelliteView)}
          >
            <div
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                appDisplay.satelliteView ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between py-4 px-4 border-b border-gray-100">
          <div className="flex-1 pr-4">
            <div className="text-base font-medium text-gray-900">{s.app_display_accessibility}</div>
            <div className="text-sm text-app-text-muted mt-0.5">{s.app_display_accessibility_desc}</div>
          </div>
          <button
            className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${
              appDisplay.accessibility ? 'bg-app-primary-dark' : 'bg-gray-200'
            }`}
            onClick={() => updateAppDisplay('accessibility', !appDisplay.accessibility)}
          >
            <div
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                appDisplay.accessibility ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between py-4 px-4 border-b border-gray-100">
          <div className="text-base font-medium text-gray-900">{s.app_display_shake_feedback}</div>
          <button
            className={`w-12 h-7 rounded-full relative transition-colors shrink-0 ${
              appDisplay.shakeFeedback ? 'bg-app-primary-dark' : 'bg-gray-200'
            }`}
            onClick={() => updateAppDisplay('shakeFeedback', !appDisplay.shakeFeedback)}
          >
            <div
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                appDisplay.shakeFeedback ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>
      </div>

      {showThemeModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-8 font-sans"
          onClick={() => setShowThemeModal(false)}
        >
          <div
            className="bg-app-surface rounded-3xl w-full max-w-xs p-6 shadow-xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xl font-bold text-gray-900 mb-6">{s.theme_title}</div>
            <div className="space-y-6 mb-6">
              {themeOptions.map((opt) => (
                <RadioOption
                  key={opt.value}
                  label={opt.label}
                  selected={tempTheme === opt.value}
                  onSelect={() => setTempTheme(opt.value)}
                />
              ))}
            </div>
            <div className="text-sm text-app-text-muted mb-6">{s.theme_nav_hint}</div>
            <div className="text-sm text-app-primary font-medium mb-6 cursor-pointer">{s.theme_go_nav_settings}</div>
            <div className="flex justify-between gap-3">
              <button
                onClick={() => setShowThemeModal(false)}
                className="flex-1 bg-[#D2E3FC] text-app-primary py-2.5 rounded-full font-bold text-sm active:bg-blue-200"
              >
                {s.filter_cancel}
              </button>
              <button
                onClick={handleThemeSave}
                className="flex-1 bg-app-primary text-white py-2.5 rounded-full font-bold text-sm active:bg-[#005f66]"
              >
                {s.filter_save}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDistanceModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-8 font-sans"
          onClick={() => setShowDistanceModal(false)}
        >
          <div
            className="bg-app-surface rounded-xl w-full max-w-xs p-6 shadow-xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xl font-bold text-gray-900 mb-6">{s.distance_unit_title}</div>
            <div className="space-y-6 mb-6">
              {distanceOptions.map((opt) => (
                <RadioOption
                  key={opt.value}
                  label={opt.label}
                  selected={appDisplay.distanceUnit === opt.value}
                  onSelect={() => handleDistanceSelect(opt.value)}
                />
              ))}
            </div>
            <button
              onClick={() => setShowDistanceModal(false)}
              className="w-full bg-[#D2E3FC] text-app-primary py-2.5 rounded-full font-bold text-sm active:bg-blue-200"
            >
              {s.filter_cancel}
            </button>
          </div>
        </div>
      )}

      {showScaleModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-8 font-sans"
          onClick={() => setShowScaleModal(false)}
        >
          <div
            className="bg-app-surface rounded-xl w-full max-w-xs p-6 shadow-xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xl font-bold text-gray-900 mb-6">{s.scale_bar_title}</div>
            <div className="space-y-6 mb-6">
              {scaleOptions.map((opt) => (
                <RadioOption
                  key={opt.value}
                  label={opt.label}
                  selected={appDisplay.scaleBar === opt.value}
                  onSelect={() => handleScaleSelect(opt.value)}
                />
              ))}
            </div>
            <button
              onClick={() => setShowScaleModal(false)}
              className="w-full bg-[#D2E3FC] text-app-primary py-2.5 rounded-full font-bold text-sm active:bg-blue-200"
            >
              {s.filter_cancel}
            </button>
          </div>
        </div>
      )}

      {showVideoModal && (
        <div
          className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-8 font-sans"
          onClick={() => setShowVideoModal(false)}
        >
          <div
            className="bg-app-surface rounded-3xl w-full max-w-xs p-6 shadow-xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xl font-bold text-gray-900 mb-6">{s.video_settings_title}</div>
            <div className="space-y-6 mb-8">
              {videoOptions.map((opt) => (
                <RadioOption
                  key={opt.value}
                  label={opt.label}
                  selected={tempVideo === opt.value}
                  onSelect={() => setTempVideo(opt.value)}
                />
              ))}
            </div>
            <div className="flex justify-between gap-3">
              <button
                onClick={() => setShowVideoModal(false)}
                className="flex-1 bg-[#D2E3FC] text-app-primary py-2.5 rounded-full font-bold text-sm active:bg-blue-200"
              >
                {s.filter_cancel}
              </button>
              <button
                onClick={handleVideoSave}
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

export default AppDisplayPage;
