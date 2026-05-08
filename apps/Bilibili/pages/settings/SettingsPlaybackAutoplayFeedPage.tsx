import React from 'react';
import { SettingLayout, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';

const OPTIONS = [
  { id: 'on', label: '开启自动播放' },
  { id: 'wifi', label: '仅WiFi/免流下自动播放' },
  { id: 'off', label: '关闭自动播放' },
];

export const SettingsPlaybackAutoplayFeedPage: React.FC = () => {
  const value = useBilibiliStore((s) => s.settings.playback.feedAuto) ?? 'on';
  const setSetting = useBilibiliStore((s) => s.setSetting);

  return (
    <SettingLayout title="动态/活动页单列视频是否自动播放">
      <div className="px-4 py-2 text-[13px] text-gray-500">选择后,将影响所有列表场景下的视频播放</div>
      <SettingRadioGroup options={OPTIONS} value={value} onChange={(id) => setSetting('playback.feedAuto', id)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
