import React from 'react';
import { SettingLayout, SettingSection, SettingRadioGroup, SettingItemArrow } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsRecommendPage: React.FC = () => {
  const s = useBilibiliStrings();
  const setSetting = useBilibiliStore((st) => st.setSetting);
  const playMode = useBilibiliStore((st) => st.settings.recommend.playMode) ?? 'auto';
  const autoPlay = useBilibiliStore((st) => st.settings.recommend.autoPlay) ?? 'wifi';
  const bigCardSound = useBilibiliStore((st) => st.settings.recommend.bigCardSound) ?? 'off';
  const refresh = useBilibiliStore((st) => st.settings.recommend.refresh) ?? 'on';

  const PLAY_MODE_OPTIONS = [
    { id: 'portrait', label: s.sr_portrait, subtitle: s.sr_portrait_sub },
    { id: 'auto', label: s.sr_auto, subtitle: s.sr_auto_sub },
  ];
  const AUTO_PLAY_OPTIONS = [
    { id: 'all', label: s.sr_opt_all },
    { id: 'wifi', label: s.sr_opt_wifi },
    { id: 'off', label: s.sr_opt_off },
  ];
  const BIG_CARD_SOUND_OPTIONS = [
    { id: 'on', label: s.sr_sound_on },
    { id: 'off', label: s.sr_sound_off },
  ];
  const REFRESH_OPTIONS = [
    { id: 'on', label: s.opt_on },
    { id: 'off', label: s.opt_off },
  ];

  return (
    <SettingLayout title={s.sr_title}>
      <SettingSection title={s.sr_sec_mode} />
      <SettingRadioGroup options={PLAY_MODE_OPTIONS} value={playMode} onChange={(id) => setSetting('recommend.playMode', id)} />
      <SettingSection title={s.sr_sec_autoplay} />
      <SettingRadioGroup options={AUTO_PLAY_OPTIONS} value={autoPlay} onChange={(id) => setSetting('recommend.autoPlay', id)} />
      <SettingSection title={s.sr_sec_sound} />
      <SettingRadioGroup options={BIG_CARD_SOUND_OPTIONS} value={bigCardSound} onChange={(id) => setSetting('recommend.bigCardSound', id)} />
      <SettingSection title={s.sr_sec_refresh} />
      <SettingRadioGroup options={REFRESH_OPTIONS} value={refresh} onChange={(id) => setSetting('recommend.refresh', id)} />
      <SettingItemArrow label={s.sr_column} />
      <div className="h-8" />
    </SettingLayout>
  );
};
