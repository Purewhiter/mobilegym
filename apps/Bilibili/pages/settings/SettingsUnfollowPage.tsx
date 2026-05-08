import React from 'react';
import { SettingLayout, SettingSection, SettingItemSwitch } from './index';
import { useBilibiliStore } from '../../state';

export const SettingsUnfollowPage: React.FC = () => {
  const setSetting = useBilibiliStore((s) => s.setSetting);
  const collapse = useBilibiliStore((s) => s.settings.message.unfollowCollapse) ?? false;

  return (
    <SettingLayout title="未关注人消息">
      <SettingSection title="未关注人消息提醒" />
      <SettingItemSwitch
        label="收起未关注人消息"
        subtitle="开启后,未关注人消息将被折叠在未关注人消息内"
        checked={collapse}
        onChange={(v) => setSetting('message.unfollowCollapse', v)}
      />
      <div className="h-8" />
    </SettingLayout>
  );
};
