import React from 'react';
import { SettingLayout, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';

const OPTIONS = [
  { id: 'clear', label: '清晰', subtitle: '清晰 (质量高,图片更清晰)' },
  { id: 'normal', label: '普通', subtitle: '普通 (流量少,速度加载快)' },
  { id: 'auto', label: '自动', subtitle: '自动 (wifi下使用清晰,流量下使用普通)' },
];

export const SettingsImageQualityPage: React.FC = () => {
  const value = useBilibiliStore((s) => s.settings.other.imageQuality) ?? 'clear';
  const setSetting = useBilibiliStore((s) => s.setSetting);

  return (
    <SettingLayout title="默认图片质量">
      <SettingRadioGroup options={OPTIONS} value={value} onChange={(id) => setSetting('other.imageQuality', id)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
