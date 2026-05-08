import React, { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcNavBack, IcCheck, IcChevronsUpDown } from '../res/icons';
import { PreferenceCategory } from '../../../system/Settings/components/PreferenceCategory';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import { useWeatherGestures } from '../hooks/useWeatherGestures';
import { useWeatherStore } from '../state';
import type { TransitionId } from '../navigation.declaration';
import type { WeatherSettings } from '../types';

type PickerOption = { label: string; value: string; actionId: string };

const PickerPopup: React.FC<{
  open: boolean;
  options: PickerOption[];
  value: string;
  onSelect: (value: string, actionId: string) => void;
  onClose: () => void;
  bindTap: ReturnType<typeof useWeatherGestures>['bindTap'];
  bindBack: ReturnType<typeof useWeatherGestures>['bindBack'];
}> = ({ open, options, value, onSelect, onClose, bindTap, bindBack }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" {...bindBack<HTMLDivElement>()} />
      <div className="relative bg-white rounded-2xl overflow-hidden shadow-2xl mx-6 min-w-[240px] max-w-[320px] py-2">
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              className="w-full px-5 py-3 text-left flex items-center justify-between gap-3 active:bg-gray-50"
              {...bindTap<HTMLButtonElement>(
                { kind: 'action', id: opt.actionId },
                { onTrigger: () => onSelect(opt.value, opt.actionId) },
              )}
            >
              <span className={`text-[15px] leading-snug ${selected ? 'text-[#007AFF] font-medium' : 'text-gray-900'}`}>
                {opt.label}
              </span>
              {selected && <IcCheck size={18} className="text-[#007AFF] flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};

function useWeatherSetting<K extends keyof WeatherSettings>(key: K) {
  const value = useWeatherStore((s) => s.settings[key]);
  const set = useCallback((v: WeatherSettings[K]) => {
    useWeatherStore.setState((prev) => ({
      settings: { ...prev.settings, [key]: v },
    }));
  }, [key]);
  return [value, set] as const;
}

const UnitPreferenceItem: React.FC<{
  title: string;
  options: PickerOption[];
  settingKey: keyof WeatherSettings;
  pickerKey: string;
  transitionId: TransitionId;
  showDivider?: boolean;
  bindTap: ReturnType<typeof useWeatherGestures>['bindTap'];
  bindBack: ReturnType<typeof useWeatherGestures>['bindBack'];
  back: ReturnType<typeof useWeatherGestures>['back'];
}> = ({ title, options, settingKey, pickerKey, transitionId, showDivider = true, bindTap, bindBack, back }) => {
  const [value, setValue] = useWeatherSetting(settingKey);
  const [searchParams] = useSearchParams();
  const open = searchParams.get('picker') === pickerKey;

  const selectedLabel = useMemo(() => {
    return options.find((o) => o.value === value)?.label ?? options[0]?.label ?? '';
  }, [options, value]);

  const handleSelect = useCallback((v: string) => {
    setValue(v as WeatherSettings[typeof settingKey]);
    back();
  }, [setValue, back]);

  return (
    <>
      <div>
        <div
          className="flex items-center px-4 py-3.5 active:bg-gray-50 min-h-[52px] cursor-pointer"
          {...bindTap<HTMLDivElement>(transitionId)}
        >
          <div className="flex-1 min-w-0">
            <div className="text-[15px] text-gray-900 leading-tight">{title}</div>
          </div>
          <div className="flex items-center ml-2 flex-shrink-0 gap-1">
            <span className="text-[13px] text-gray-400">{selectedLabel}</span>
            <IcChevronsUpDown size={14} className="text-gray-300" />
          </div>
        </div>
        {showDivider && <div className="h-px bg-gray-100 ml-4 mr-4" />}
      </div>
      <PickerPopup
        open={open}
        options={options}
        value={String(value)}
        onSelect={handleSelect}
        onClose={() => back()}
        bindTap={bindTap}
        bindBack={bindBack}
      />
    </>
  );
};

const WeatherSwitchItem: React.FC<{
  title: string;
  summary?: string;
  settingKey: keyof WeatherSettings;
  showDivider?: boolean;
}> = ({ title, summary, settingKey, showDivider = true }) => {
  const [checked, setChecked] = useWeatherSetting(settingKey);

  return (
    <div>
      <div
        className="flex items-center px-4 py-3.5 active:bg-gray-50 min-h-[52px]"
        onClick={() => setChecked(!checked as WeatherSettings[typeof settingKey])}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[15px] text-gray-900 leading-tight">{title}</div>
          {summary && (
            <div className="text-[12px] text-gray-400 mt-0.5 leading-tight line-clamp-2">
              {summary}
            </div>
          )}
        </div>
        <div className="ml-3 flex-shrink-0">
          <div
            className={`w-[44px] h-[26px] rounded-full flex items-center p-[2px] transition-colors duration-200 ${
              checked ? 'bg-[#34c759] justify-end' : 'bg-gray-300 justify-start'
            }`}
          >
            <div className="w-[22px] h-[22px] bg-white rounded-full shadow-sm" />
          </div>
        </div>
      </div>
      {showDivider && <div className="h-px bg-gray-100 ml-4 mr-4" />}
    </div>
  );
};

const lightThemeOverrides: React.CSSProperties = {
  '--app-surface': '#ffffff',
  '--app-text': '#1c1c1e',
  '--app-text-muted': '#8e8e93',
  '--app-primary': '#34c759',
  '--app-border': '#e5e7eb',
} as React.CSSProperties;

const WeatherSettingsPage: React.FC = () => {
  const { bindTap, bindBack, back } = useWeatherGestures();
  const s = useAppStrings(strings, stringsEn);

  const tempOptions: PickerOption[] = useMemo(() => [
    { label: s.settings_temp_unit_celsius, value: 'celsius', actionId: 'settings.tempUnit.select.celsius' },
    { label: s.settings_temp_unit_fahrenheit, value: 'fahrenheit', actionId: 'settings.tempUnit.select.fahrenheit' },
  ], [s]);

  const windOptions: PickerOption[] = useMemo(() => [
    { label: s.settings_wind_unit_beaufort, value: 'beaufort', actionId: 'settings.windUnit.select.beaufort' },
    { label: s.settings_wind_unit_kmh, value: 'kmh', actionId: 'settings.windUnit.select.kmh' },
    { label: s.settings_wind_unit_ms, value: 'ms', actionId: 'settings.windUnit.select.ms' },
    { label: s.settings_wind_unit_mph, value: 'mph', actionId: 'settings.windUnit.select.mph' },
    { label: s.settings_wind_unit_kn, value: 'kn', actionId: 'settings.windUnit.select.kn' },
  ], [s]);

  const pressureOptions: PickerOption[] = useMemo(() => [
    { label: s.settings_pressure_unit_hpa, value: 'hpa', actionId: 'settings.pressureUnit.select.hpa' },
    { label: s.settings_pressure_unit_mmhg, value: 'mmhg', actionId: 'settings.pressureUnit.select.mmhg' },
    { label: s.settings_pressure_unit_inhg, value: 'inhg', actionId: 'settings.pressureUnit.select.inhg' },
  ], [s]);

  return (
    <div
      className="flex flex-col h-full bg-[#f4f4f4] dark:bg-black text-black dark:text-white pt-10"
      data-status-bar-foreground="dark"
      style={lightThemeOverrides}
    >
      <div className="flex items-center px-4 py-3">
        <button
          {...bindBack<HTMLButtonElement>()}
          className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5"
        >
          <IcNavBack size={24} />
        </button>
        <h1 className="ml-2 text-xl font-medium">{s.settings_title}</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-8" data-scroll-container="main" data-scroll-direction="vertical">
        <PreferenceCategory title={s.settings_category_alerts}>
          <WeatherSwitchItem
            settingKey="morningEveningAlert"
            title={s.settings_morning_evening_alert}
            summary={s.settings_morning_evening_alert_summary}
          />
          <WeatherSwitchItem
            settingKey="warningAlert"
            title={s.settings_warning_alert}
            summary={s.settings_warning_alert_summary}
          />
          <WeatherSwitchItem
            settingKey="abnormalWeatherAlert"
            title={s.settings_abnormal_weather_alert}
            summary={s.settings_abnormal_weather_alert_summary}
          />
          <WeatherSwitchItem
            settingKey="nightDnd"
            title={s.settings_night_dnd}
            summary={s.settings_night_dnd_summary}
          />
        </PreferenceCategory>

        <PreferenceCategory title={s.settings_category_units}>
          <UnitPreferenceItem
            title={s.settings_temp_unit}
            options={tempOptions}
            settingKey="tempUnit"
            pickerKey="temp"
            transitionId="settings.picker.temp.open"
            bindTap={bindTap}
            bindBack={bindBack}
            back={back}
          />
          <UnitPreferenceItem
            title={s.settings_wind_unit}
            options={windOptions}
            settingKey="windUnit"
            pickerKey="wind"
            transitionId="settings.picker.wind.open"
            bindTap={bindTap}
            bindBack={bindBack}
            back={back}
          />
          <UnitPreferenceItem
            title={s.settings_pressure_unit}
            options={pressureOptions}
            settingKey="pressureUnit"
            pickerKey="pressure"
            transitionId="settings.picker.pressure.open"
            bindTap={bindTap}
            bindBack={bindBack}
            back={back}
          />
        </PreferenceCategory>

        <PreferenceCategory title={s.settings_category_other}>
          <WeatherSwitchItem
            settingKey="nightAutoUpdate"
            title={s.settings_night_auto_update}
            summary={s.settings_night_auto_update_summary}
          />
        </PreferenceCategory>

        <PreferenceCategory title={s.settings_category_about}>
          <PreferenceItemNav title={s.settings_user_experience} />
          <PreferenceItemNav title={s.settings_feedback} />
          <PreferenceItemNav
            title={s.settings_privacy_policy}
            itemProps={bindTap<HTMLDivElement>('privacy.open')}
          />
          <WeatherSwitchItem
            settingKey="revokeConsent"
            title={s.settings_revoke_consent}
            summary={s.settings_revoke_consent_summary}
          />
        </PreferenceCategory>

        <PreferenceCategory>
          <PreferenceItemNav
            title={s.settings_privacy_settings}
            itemProps={bindTap<HTMLDivElement>('privacy.open')}
            showDivider={false}
          />
        </PreferenceCategory>
      </div>
    </div>
  );
};

const PreferenceItemNav: React.FC<{
  title: string;
  showDivider?: boolean;
  itemProps?: React.HTMLAttributes<HTMLDivElement>;
}> = ({ title, showDivider = true, itemProps }) => {
  return (
    <div>
      <div
        className="flex items-center px-4 py-3.5 active:bg-gray-50 min-h-[52px]"
        {...itemProps}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[15px] text-gray-900 leading-tight">{title}</div>
        </div>
        <div className="flex items-center ml-2 flex-shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>
      {showDivider && <div className="h-px bg-gray-100 ml-4 mr-4" />}
    </div>
  );
};

export default WeatherSettingsPage;
