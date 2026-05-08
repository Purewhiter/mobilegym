import React from 'react';
import { SettingLayout, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';

const OPTIONS = [
  { id: 'all', label: 'Wi-Fi/免流/移动网络下自动播放' },
  { id: 'wifi', label: '仅Wi-Fi下自动播放' },
  { id: 'off', label: '关闭自动播放' },
];

export const SettingsPlaybackAutoplayHomePage: React.FC = () => {
  const value = useBilibiliStore((s) => s.settings.playback.homeAuto) ?? 'all';
  const setSetting = useBilibiliStore((s) => s.setSetting);

  return (
    <SettingLayout title="首页自动播放">
      <SettingRadioGroup options={OPTIONS} value={value} onChange={(id) => setSetting('playback.homeAuto', id)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
