import React from 'react';
import { SettingLayout, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';

const OPTIONS = [
  { id: 'on', label: '接收提醒' },
  { id: 'off', label: '永不提醒' },
];

export const SettingsMessageFanPage: React.FC = () => {
  const value = useBilibiliStore((s) => s.settings.message.fan) ?? 'on';
  const setSetting = useBilibiliStore((s) => s.setSetting);

  return (
    <SettingLayout title="新增粉丝消息提醒">
      <SettingRadioGroup options={OPTIONS} value={value} onChange={(id) => setSetting('message.fan', id)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
