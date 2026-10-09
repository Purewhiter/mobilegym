import React from 'react';
import { SettingLayout, SettingItemSwitch } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsPlaybackPortraitPage: React.FC = () => {
  const s = useBilibiliStrings();
  const setSetting = useBilibiliStore((st) => st.setSetting);
  const enabled = useBilibiliStore((st) => st.settings.playback.portraitFullscreen) ?? true;

  return (
    <SettingLayout title={s.spb_portrait}>
      <SettingItemSwitch
        label={s.spp_label}
        subtitle={s.spp_sub}
        checked={enabled}
        onChange={(v) => setSetting('playback.portraitFullscreen', v)}
      />
      <div className="h-8" />
    </SettingLayout>
  );
};
