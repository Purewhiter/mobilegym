import React from 'react';
import { SettingLayout, SettingItemArrow } from './index';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsPlaybackPage: React.FC = () => {
  const { go } = useBilibiliGestures();
  const s = useBilibiliStrings();

  const ITEMS: { label: string; transitionId: string }[] = [
    { label: s.spb_autoplay, transitionId: 'settings.playback.autoplay.open' },
    { label: s.spb_portrait, transitionId: 'settings.playback.portrait.open' },
    { label: s.spb_pip, transitionId: 'settings.playback.pip.open' },
    { label: s.spb_danmaku, transitionId: 'settings.playback.danmaku.open' },
    { label: s.spb_quality, transitionId: 'settings.playback.quality.open' },
    { label: s.spb_other, transitionId: 'settings.playback.other.open' },
  ];

  return (
    <SettingLayout title={s.spb_title}>
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
