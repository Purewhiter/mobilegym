import React from 'react';
import { SettingLayout, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsMessageFanPage: React.FC = () => {
  const s = useBilibiliStrings();
  const value = useBilibiliStore((st) => st.settings.message.fan) ?? 'on';
  const setSetting = useBilibiliStore((st) => st.setSetting);

  const OPTIONS = [
    { id: 'on', label: s.opt_receive },
    { id: 'off', label: s.opt_never },
  ];

  return (
    <SettingLayout title={s.smf_title}>
      <SettingRadioGroup options={OPTIONS} value={value} onChange={(id) => setSetting('message.fan', id)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
