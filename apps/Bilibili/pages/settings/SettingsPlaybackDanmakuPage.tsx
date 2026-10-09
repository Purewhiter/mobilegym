import React from 'react';
import { SettingLayout, SettingSection, SettingItemSwitch } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsPlaybackDanmakuPage: React.FC = () => {
  const s = useBilibiliStrings();
  const setSetting = useBilibiliStore((st) => st.setSetting);
  const danmakuMemory = useBilibiliStore((st) => st.settings.playback.danmakuMemory) ?? false;
  const danmakuQuick = useBilibiliStore((st) => st.settings.playback.danmakuQuick) ?? true;
  const subtitleFeedback = useBilibiliStore((st) => st.settings.playback.subtitleFeedback) ?? false;
  const subtitleDrag = useBilibiliStore((st) => st.settings.playback.subtitleDrag) ?? false;

  return (
    <SettingLayout title={s.spb_danmaku}>
      <SettingSection title={s.sd_sec_danmaku} />
      <SettingItemSwitch label={s.sd_memory} subtitle={s.sd_memory_sub} checked={danmakuMemory} onChange={(v) => setSetting('playback.danmakuMemory', v)} />
      <SettingItemSwitch label={s.sd_quick} subtitle={s.sd_quick_sub} checked={danmakuQuick} onChange={(v) => setSetting('playback.danmakuQuick', v)} />
      <SettingSection title={s.sd_sec_subtitle} />
      <SettingItemSwitch label={s.sd_feedback} subtitle={s.sd_feedback_sub} checked={subtitleFeedback} onChange={(v) => setSetting('playback.subtitleFeedback', v)} />
      <SettingItemSwitch label={s.sd_drag} subtitle={s.sd_drag_sub} checked={subtitleDrag} onChange={(v) => setSetting('playback.subtitleDrag', v)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
