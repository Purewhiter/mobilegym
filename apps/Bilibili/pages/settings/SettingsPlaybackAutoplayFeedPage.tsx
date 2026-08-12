import React from 'react';
import { SettingLayout, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsPlaybackAutoplayFeedPage: React.FC = () => {
  const s = useBilibiliStrings();
  const value = useBilibiliStore((st) => st.settings.playback.feedAuto) ?? 'on';
  const setSetting = useBilibiliStore((st) => st.setSetting);

  const OPTIONS = [
    { id: 'on', label: s.saf_opt_on },
    { id: 'wifi', label: s.saf_opt_wifi },
    { id: 'off', label: s.sr_opt_off },
  ];

  return (
    <SettingLayout title={s.spa_feed}>
      <div className="px-4 py-2 text-[13px] text-gray-500">{s.saf_hint}</div>
      <SettingRadioGroup options={OPTIONS} value={value} onChange={(id) => setSetting('playback.feedAuto', id)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
