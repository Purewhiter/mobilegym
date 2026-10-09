import React from 'react';
import { SettingLayout, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsTimerPage: React.FC = () => {
  const s = useBilibiliStrings();
  const value = useBilibiliStore((st) => st.settings.timer) ?? 'off';
  const setSetting = useBilibiliStore((st) => st.setSetting);

  const OPTIONS = [
    { id: 'off', label: s.sti_off },
    { id: '15', label: s.sti_15 },
    { id: '30', label: s.sti_30 },
    { id: '60', label: s.sti_60 },
    { id: 'custom', label: s.sti_custom },
  ];

  return (
    <SettingLayout title={s.sti_title}>
      <div className="px-4 py-3 text-center text-[13px] text-gray-500">{s.sti_hint}</div>
      <SettingRadioGroup options={OPTIONS} value={value} onChange={(id) => setSetting('timer', id)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
