import React from 'react';
import { SettingLayout, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsWatermarkPage: React.FC = () => {
  const s = useBilibiliStrings();
  const value = useBilibiliStore((st) => st.settings.other.watermark) ?? 'off';
  const setSetting = useBilibiliStore((st) => st.setSetting);

  const OPTIONS = [
    { id: 'off', label: s.sw_off },
    { id: 'center', label: s.sw_center },
    { id: 'bottomRight', label: s.sw_br },
  ];

  return (
    <SettingLayout title={s.sw_title}>
      <div className="px-4 py-2 text-[13px] text-gray-500">{s.sw_hint}</div>
      <SettingRadioGroup options={OPTIONS} value={value} onChange={(id) => setSetting('other.watermark', id)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
