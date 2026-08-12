import React from 'react';
import { SettingLayout, SettingSection, SettingItemSwitch, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsPlaybackOtherPage: React.FC = () => {
  const s = useBilibiliStrings();
  const setSetting = useBilibiliStore((st) => st.setSetting);
  const fullscreenCount = useBilibiliStore((st) => st.settings.playback.fullscreenCount) ?? true;
  const gravity = useBilibiliStore((st) => st.settings.playback.gravity) ?? true;
  const volumeBalance = useBilibiliStore((st) => st.settings.playback.volumeBalance) ?? 'standard';
  const eyeCare = useBilibiliStore((st) => st.settings.playback.eyeCare) ?? false;
  const colorAid = useBilibiliStore((st) => st.settings.playback.colorAid) ?? false;
  const https = useBilibiliStore((st) => st.settings.playback.https) ?? false;

  const VOLUME_OPTIONS = [
    { id: 'standard', label: s.spo_vol_standard, subtitle: s.spo_vol_standard_sub },
    { id: 'high', label: s.spo_vol_high, subtitle: s.spo_vol_high_sub },
  ];

  return (
    <SettingLayout title={s.spb_other}>
      <SettingItemSwitch label={s.spo_fullscreen_count} checked={fullscreenCount} onChange={(v) => setSetting('playback.fullscreenCount', v)} />
      <SettingItemSwitch label={s.spo_gravity} subtitle={s.spo_gravity_sub} checked={gravity} onChange={(v) => setSetting('playback.gravity', v)} />
      <SettingSection title={s.spo_sec_volume} />
      <SettingRadioGroup options={VOLUME_OPTIONS} value={volumeBalance} onChange={(id) => setSetting('playback.volumeBalance', id)} />
      <SettingItemSwitch label={s.spo_eye} checked={eyeCare} onChange={(v) => setSetting('playback.eyeCare', v)} />
      <SettingItemSwitch label={s.spo_color} checked={colorAid} onChange={(v) => setSetting('playback.colorAid', v)} />
      <SettingItemSwitch label={s.spo_https} subtitle={s.spo_https_sub} checked={https} onChange={(v) => setSetting('playback.https', v)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
