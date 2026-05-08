import React from 'react';
import { SettingLayout, SettingItemSwitch } from './index';
import { useBilibiliStore } from '../../state';

export const SettingsPlaybackPortraitPage: React.FC = () => {
  const setSetting = useBilibiliStore((s) => s.setSetting);
  const enabled = useBilibiliStore((s) => s.settings.playback.portraitFullscreen) ?? true;

  return (
    <SettingLayout title="竖屏模式设置">
      <SettingItemSwitch
        label="竖屏视频全屏用竖屏模式播放"
        subtitle="全屏后可以上下滑视频"
        checked={enabled}
        onChange={(v) => setSetting('playback.portraitFullscreen', v)}
      />
      <div className="h-8" />
    </SettingLayout>
  );
};
