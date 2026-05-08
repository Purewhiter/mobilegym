import React from 'react';
import { SettingLayout, SettingItemSwitch, SettingItemArrow } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';

export const SettingsPlaybackAutoplayPage: React.FC = () => {
  const { go } = useBilibiliGestures();
  const setSetting = useBilibiliStore((s) => s.setSetting);
  const dataAuto = useBilibiliStore((s) => s.settings.playback.dataAuto) ?? true;
  const detailAuto = useBilibiliStore((s) => s.settings.playback.detailAuto) ?? true;
  const detailFullscreen = useBilibiliStore((s) => s.settings.playback.detailFullscreen) ?? false;

  return (
    <SettingLayout title="自动播放设置">
      <SettingItemSwitch label="流量网络下自动播放" checked={dataAuto} onChange={(v) => setSetting('playback.dataAuto', v)} />
      <SettingItemSwitch label="视频详情页直接播放" subtitle="进入视频详情页后自动播放视频" checked={detailAuto} onChange={(v) => setSetting('playback.detailAuto', v)} />
      <SettingItemSwitch label="视频详情页直接全屏" subtitle="进入视频详情页后自动全屏播放视频" checked={detailFullscreen} onChange={(v) => setSetting('playback.detailFullscreen', v)} />
      <SettingItemArrow label="动态/活动页单列视频是否自动播放" subtitle="开启自动播放" onClick={() => go('settings.playback.autoplay.feed.open' as any)} />
      <SettingItemArrow label="首页自动播放" subtitle="Wi-Fi/免流/移动网络下自动播放" onClick={() => go('settings.playback.autoplay.home.open' as any)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
