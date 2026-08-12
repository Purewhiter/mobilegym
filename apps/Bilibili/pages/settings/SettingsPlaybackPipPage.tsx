import React from 'react';
import { SettingLayout, SettingSection, SettingItemSwitch, SettingItemArrow } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsPlaybackPipPage: React.FC = () => {
  const s = useBilibiliStrings();
  const setSetting = useBilibiliStore((st) => st.setSetting);
  const pipOut = useBilibiliStore((st) => st.settings.playback.pipOut) ?? false;
  const pipIn = useBilibiliStore((st) => st.settings.playback.pipIn) ?? false;
  const backgroundListen = useBilibiliStore((st) => st.settings.playback.backgroundListen) ?? true;
  const backgroundSeries = useBilibiliStore((st) => st.settings.playback.backgroundSeries) ?? true;

  return (
    <SettingLayout title={s.spb_pip}>
      <SettingSection title={s.pip_sec_pip} />
      <SettingItemSwitch label={s.pip_out} subtitle={s.pip_out_sub} checked={pipOut} onChange={(v) => setSetting('playback.pipOut', v)} />
      <SettingItemSwitch label={s.pip_in} subtitle={s.pip_in_sub} checked={pipIn} onChange={(v) => setSetting('playback.pipIn', v)} />
      <SettingItemArrow label={s.pip_size} subtitle={s.pip_size_sub} />
      <SettingSection title={s.pip_sec_bg} />
      <SettingItemSwitch label={s.pip_bg} subtitle={s.pip_bg_sub} checked={backgroundListen} onChange={(v) => setSetting('playback.backgroundListen', v)} />
      <SettingItemSwitch label={s.pip_bg_series} checked={backgroundSeries} onChange={(v) => setSetting('playback.backgroundSeries', v)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
