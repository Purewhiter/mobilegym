import React from 'react';
import { SettingLayout, SettingItemSwitch, SettingItemArrow } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsPlaybackAutoplayPage: React.FC = () => {
  const { go } = useBilibiliGestures();
  const s = useBilibiliStrings();
  const setSetting = useBilibiliStore((st) => st.setSetting);
  const dataAuto = useBilibiliStore((st) => st.settings.playback.dataAuto) ?? true;
  const detailAuto = useBilibiliStore((st) => st.settings.playback.detailAuto) ?? true;
  const detailFullscreen = useBilibiliStore((st) => st.settings.playback.detailFullscreen) ?? false;

  return (
    <SettingLayout title={s.spb_autoplay}>
      <SettingItemSwitch label={s.spa_data} checked={dataAuto} onChange={(v) => setSetting('playback.dataAuto', v)} />
      <SettingItemSwitch label={s.spa_detail} subtitle={s.spa_detail_sub} checked={detailAuto} onChange={(v) => setSetting('playback.detailAuto', v)} />
      <SettingItemSwitch label={s.spa_fullscreen} subtitle={s.spa_fullscreen_sub} checked={detailFullscreen} onChange={(v) => setSetting('playback.detailFullscreen', v)} />
      <SettingItemArrow label={s.spa_feed} subtitle={s.spa_feed_sub} onClick={() => go('settings.playback.autoplay.feed.open' as any)} />
      <SettingItemArrow label={s.spa_home} subtitle={s.sr_opt_all} onClick={() => go('settings.playback.autoplay.home.open' as any)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
