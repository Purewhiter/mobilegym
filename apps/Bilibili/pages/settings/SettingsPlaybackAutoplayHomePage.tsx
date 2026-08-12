import React from 'react';
import { SettingLayout, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsPlaybackAutoplayHomePage: React.FC = () => {
  const s = useBilibiliStrings();
  const value = useBilibiliStore((st) => st.settings.playback.homeAuto) ?? 'all';
  const setSetting = useBilibiliStore((st) => st.setSetting);

  const OPTIONS = [
    { id: 'all', label: s.sr_opt_all },
    { id: 'wifi', label: s.sr_opt_wifi },
    { id: 'off', label: s.sr_opt_off },
  ];

  return (
    <SettingLayout title={s.spa_home}>
      <SettingRadioGroup options={OPTIONS} value={value} onChange={(id) => setSetting('playback.homeAuto', id)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
