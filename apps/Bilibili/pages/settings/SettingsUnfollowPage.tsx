import React from 'react';
import { SettingLayout, SettingSection, SettingItemSwitch } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsUnfollowPage: React.FC = () => {
  const s = useBilibiliStrings();
  const setSetting = useBilibiliStore((st) => st.setSetting);
  const collapse = useBilibiliStore((st) => st.settings.message.unfollowCollapse) ?? false;

  return (
    <SettingLayout title={s.sun_title}>
      <SettingSection title={s.sun_sec} />
      <SettingItemSwitch
        label={s.sun_collapse}
        subtitle={s.sun_collapse_sub}
        checked={collapse}
        onChange={(v) => setSetting('message.unfollowCollapse', v)}
      />
      <div className="h-8" />
    </SettingLayout>
  );
};
