import React from 'react';
import { SettingLayout, SettingItemSwitch } from './index';
import { useBilibiliStore } from '../../state';

export const SettingsPlaybackQualityPage: React.FC = () => {
  const setSetting = useBilibiliStore((s) => s.setSetting);
  const hdr = useBilibiliStore((s) => s.settings.playback.hdr) ?? false;

  return (
    <SettingLayout title="清晰度设置">
      <SettingItemSwitch label="优先播放HDR清晰度" subtitle="大会员且设备支持时优先选中" checked={hdr} onChange={(v) => setSetting('playback.hdr', v)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
