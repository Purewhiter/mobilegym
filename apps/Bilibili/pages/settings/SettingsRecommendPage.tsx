import React from 'react';
import { SettingLayout, SettingSection, SettingRadioGroup, SettingItemArrow } from './index';
import { useBilibiliStore } from '../../state';

const PLAY_MODE_OPTIONS = [
  { id: 'portrait', label: '竖屏模式', subtitle: '默认用竖屏模式播放视频' },
  { id: 'auto', label: '自动模式', subtitle: '根据视频类型自动选择播放模式' },
];
const AUTO_PLAY_OPTIONS = [
  { id: 'all', label: 'Wi-Fi/免流/移动网络下自动播放' },
  { id: 'wifi', label: '仅Wi-Fi下自动播放' },
  { id: 'off', label: '关闭自动播放' },
];
const BIG_CARD_SOUND_OPTIONS = [
  { id: 'on', label: '默认打开' },
  { id: 'off', label: '默认静音' },
];
const REFRESH_OPTIONS = [
  { id: 'on', label: '开启' },
  { id: 'off', label: '关闭' },
];

export const SettingsRecommendPage: React.FC = () => {
  const setSetting = useBilibiliStore((s) => s.setSetting);
  const playMode = useBilibiliStore((s) => s.settings.recommend.playMode) ?? 'auto';
  const autoPlay = useBilibiliStore((s) => s.settings.recommend.autoPlay) ?? 'wifi';
  const bigCardSound = useBilibiliStore((s) => s.settings.recommend.bigCardSound) ?? 'off';
  const refresh = useBilibiliStore((s) => s.settings.recommend.refresh) ?? 'on';

  return (
    <SettingLayout title="首页推荐设置">
      <SettingSection title="首页视频播放模式" />
      <SettingRadioGroup options={PLAY_MODE_OPTIONS} value={playMode} onChange={(id) => setSetting('recommend.playMode', id)} />
      <SettingSection title="首页自动播放" />
      <SettingRadioGroup options={AUTO_PLAY_OPTIONS} value={autoPlay} onChange={(id) => setSetting('recommend.autoPlay', id)} />
      <SettingSection title="大卡默认声音(重启后生效)" />
      <SettingRadioGroup options={BIG_CARD_SOUND_OPTIONS} value={bigCardSound} onChange={(id) => setSetting('recommend.bigCardSound', id)} />
      <SettingSection title="首页推荐自动刷新" />
      <SettingRadioGroup options={REFRESH_OPTIONS} value={refresh} onChange={(id) => setSetting('recommend.refresh', id)} />
      <SettingItemArrow label="首页单双列切换" />
      <div className="h-8" />
    </SettingLayout>
  );
};
