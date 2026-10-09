import React from 'react';
import { SettingLayout, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsImageQualityPage: React.FC = () => {
  const s = useBilibiliStrings();
  const value = useBilibiliStore((st) => st.settings.other.imageQuality) ?? 'clear';
  const setSetting = useBilibiliStore((st) => st.setSetting);

  const OPTIONS = [
    { id: 'clear', label: s.si_clear, subtitle: s.si_clear_sub },
    { id: 'normal', label: s.si_normal, subtitle: s.si_normal_sub },
    { id: 'auto', label: s.si_auto, subtitle: s.si_auto_sub },
  ];

  return (
    <SettingLayout title={s.si_title}>
      <SettingRadioGroup options={OPTIONS} value={value} onChange={(id) => setSetting('other.imageQuality', id)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
