import React from 'react';
import { SettingLayout, SettingItemArrow } from './index';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';

const ITEMS: { label: string; transitionId: string }[] = [
  { label: '自动播放设置', transitionId: 'settings.playback.autoplay.open' },
  { label: '竖屏模式设置', transitionId: 'settings.playback.portrait.open' },
  { label: '小窗播放/后台听视频设置', transitionId: 'settings.playback.pip.open' },
  { label: '弹幕/字幕设置', transitionId: 'settings.playback.danmaku.open' },
  { label: '清晰度设置', transitionId: 'settings.playback.quality.open' },
  { label: '其他设置', transitionId: 'settings.playback.other.open' },
];

export const SettingsPlaybackPage: React.FC = () => {
  const { go } = useBilibiliGestures();

  return (
    <SettingLayout title="播放设置">
      {ITEMS.map((item) => (
        <SettingItemArrow
          key={item.transitionId}
          label={item.label}
          onClick={() => go(item.transitionId as any)}
          triggerId={item.transitionId}
        />
      ))}
      <div className="h-8" />
    </SettingLayout>
  );
};
