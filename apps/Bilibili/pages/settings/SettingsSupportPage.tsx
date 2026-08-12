import React from 'react';
import { SettingLayout, SettingSection, SettingItemSwitch, SettingItemArrow } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsSupportPage: React.FC = () => {
  const s = useBilibiliStrings();
  const setSetting = useBilibiliStore((st) => st.setSetting);
  const receive = useBilibiliStore((st) => st.settings.message.support) === 'on';
  const collapse = useBilibiliStore((st) => st.settings.message.supportCollapse) ?? true;

  return (
    <SettingLayout title={s.ssu_title}>
      <SettingItemSwitch label={s.ssu_receive} subtitle={s.ssu_receive_sub} checked={receive} onChange={(v) => setSetting('message.support', v ? 'on' : 'off')} />
      <SettingItemSwitch label={s.ssu_collapse} subtitle={s.ssu_collapse_sub} checked={collapse} onChange={(v) => setSetting('message.supportCollapse', v)} />
      <SettingSection title={s.ssu_sec_guide} />
      <SettingItemArrow label={s.ssu_join} />
      <div className="h-8" />
    </SettingLayout>
  );
};
