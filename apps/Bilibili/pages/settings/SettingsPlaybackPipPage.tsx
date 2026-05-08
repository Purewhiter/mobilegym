import React from 'react';
import { SettingLayout, SettingSection, SettingItemSwitch, SettingItemArrow } from './index';
import { useBilibiliStore } from '../../state';

export const SettingsPlaybackPipPage: React.FC = () => {
  const setSetting = useBilibiliStore((s) => s.setSetting);
  const pipOut = useBilibiliStore((s) => s.settings.playback.pipOut) ?? false;
  const pipIn = useBilibiliStore((s) => s.settings.playback.pipIn) ?? false;
  const backgroundListen = useBilibiliStore((s) => s.settings.playback.backgroundListen) ?? true;
  const backgroundSeries = useBilibiliStore((s) => s.settings.playback.backgroundSeries) ?? true;

  return (
    <SettingLayout title="小窗播放/后台听视频设置">
      <SettingSection title="小窗播放设置" />
      <SettingItemSwitch label="应用外自动小窗播放" subtitle="切出APP时自动出小窗，继续播放视频/直播" checked={pipOut} onChange={(v) => setSetting('playback.pipOut', v)} />
      <SettingItemSwitch label="应用内自动小窗播放" subtitle="切到APP内其他页面时出小窗，继续播放视频" checked={pipIn} onChange={(v) => setSetting('playback.pipIn', v)} />
      <SettingItemArrow label="小窗默认尺寸" subtitle="可双击小窗，调整尺寸大小" />
      <SettingSection title="后台听视频设置" />
      <SettingItemSwitch label="后台听视频" subtitle="锁屏或切到后台时，继续播放视频声音" checked={backgroundListen} onChange={(v) => setSetting('playback.backgroundListen', v)} />
      <SettingItemSwitch label="后台听视频时，自动连播相关视频" checked={backgroundSeries} onChange={(v) => setSetting('playback.backgroundSeries', v)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
