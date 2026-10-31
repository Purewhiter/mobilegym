import React from 'react';
import { SettingLayout, SettingItemArrow } from './index';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';
import { routes } from '../../routes';

const ITEMS = [
  { label: '自动播放设置', route: routes.settingsPlaybackAutoplay },
  { label: '竖屏模式设置', route: routes.settingsPlaybackPortrait },
  { label: '小窗播放/后台听视频设置', route: routes.settingsPlaybackPip },
  { label: '弹幕/字幕设置', route: routes.settingsPlaybackDanmaku },
  { label: '清晰度设置', route: routes.settingsPlaybackQuality },
  { label: '其他设置', route: routes.settingsPlaybackOther },
];

export const SettingsPlaybackPage: React.FC = () => {
  const { nav } = useBilibiliGestures();

  return (
    <SettingLayout title="播放设置">
      {ITEMS.map((item) => (
        <SettingItemArrow
          key={item.route.name}
          label={item.label}
          onClick={() => nav.push(item.route)}
          triggerId={`nav.${item.route.name}`}
        />
      ))}
      <div className="h-8" />
    </SettingLayout>
  );
};
