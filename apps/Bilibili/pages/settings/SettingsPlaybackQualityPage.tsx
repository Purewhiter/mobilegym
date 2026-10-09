import React from 'react';
import { SettingLayout, SettingItemSwitch } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsPlaybackQualityPage: React.FC = () => {
  const s = useBilibiliStrings();
  const setSetting = useBilibiliStore((st) => st.setSetting);
  const hdr = useBilibiliStore((st) => st.settings.playback.hdr) ?? false;

  return (
    <SettingLayout title={s.spb_quality}>
      <SettingItemSwitch label={s.sq_hdr} subtitle={s.sq_hdr_sub} checked={hdr} onChange={(v) => setSetting('playback.hdr', v)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
