import React from 'react';
import { SettingLayout, SettingSection, SettingItemSwitch } from './index';
import { useBilibiliStore } from '../../state';

export const SettingsPlaybackDanmakuPage: React.FC = () => {
  const setSetting = useBilibiliStore((s) => s.setSetting);
  const danmakuMemory = useBilibiliStore((s) => s.settings.playback.danmakuMemory) ?? false;
  const danmakuQuick = useBilibiliStore((s) => s.settings.playback.danmakuQuick) ?? true;
  const subtitleFeedback = useBilibiliStore((s) => s.settings.playback.subtitleFeedback) ?? false;
  const subtitleDrag = useBilibiliStore((s) => s.settings.playback.subtitleDrag) ?? false;

  return (
    <SettingLayout title="弹幕/字幕设置">
      <SettingSection title="弹幕设置" />
      <SettingItemSwitch label="记忆弹幕开关状态" subtitle="弹幕开关状态变化将同步至此设备的所有视频" checked={danmakuMemory} onChange={(v) => setSetting('playback.danmakuMemory', v)} />
      <SettingItemSwitch label="弹幕快捷选择功能" subtitle="点击弹幕可进行点赞、复制等操作" checked={danmakuQuick} onChange={(v) => setSetting('playback.danmakuQuick', v)} />
      <SettingSection title="字幕设置" />
      <SettingItemSwitch label="字幕反馈模式" subtitle="开启可点击字幕进行反馈" checked={subtitleFeedback} onChange={(v) => setSetting('playback.subtitleFeedback', v)} />
      <SettingItemSwitch label="字幕拖拽" subtitle="开启可进行字幕拖拽" checked={subtitleDrag} onChange={(v) => setSetting('playback.subtitleDrag', v)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
