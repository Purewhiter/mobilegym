import React from 'react';
import { SettingLayout, SettingSection, SettingItemSwitch, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';

const VOLUME_OPTIONS = [
  { id: 'standard', label: '标准模式', subtitle: '自动平衡不同视频间的音量大小' },
  { id: 'high', label: '高动态模式', subtitle: '保留更多声音细节,但音量更小' },
];

export const SettingsPlaybackOtherPage: React.FC = () => {
  const setSetting = useBilibiliStore((s) => s.setSetting);
  const fullscreenCount = useBilibiliStore((s) => s.settings.playback.fullscreenCount) ?? true;
  const gravity = useBilibiliStore((s) => s.settings.playback.gravity) ?? true;
  const volumeBalance = useBilibiliStore((s) => s.settings.playback.volumeBalance) ?? 'standard';
  const eyeCare = useBilibiliStore((s) => s.settings.playback.eyeCare) ?? false;
  const colorAid = useBilibiliStore((s) => s.settings.playback.colorAid) ?? false;
  const https = useBilibiliStore((s) => s.settings.playback.https) ?? false;

  return (
    <SettingLayout title="其他设置">
      <SettingItemSwitch label="全屏播放面板展示同时在看人数" checked={fullscreenCount} onChange={(v) => setSetting('playback.fullscreenCount', v)} />
      <SettingItemSwitch label="启用重力感应旋屏" subtitle="可通过重力感应切换半屏/全屏播放器" checked={gravity} onChange={(v) => setSetting('playback.gravity', v)} />
      <SettingSection title="音量均衡" />
      <SettingRadioGroup options={VOLUME_OPTIONS} value={volumeBalance} onChange={(id) => setSetting('playback.volumeBalance', id)} />
      <SettingItemSwitch label="护眼模式" checked={eyeCare} onChange={(v) => setSetting('playback.eyeCare', v)} />
      <SettingItemSwitch label="色觉辅助" checked={colorAid} onChange={(v) => setSetting('playback.colorAid', v)} />
      <SettingItemSwitch label="启用https播放" subtitle="启用更安全" checked={https} onChange={(v) => setSetting('playback.https', v)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
