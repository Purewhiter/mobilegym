import React from 'react';
import { SettingLayout, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';

const OPTIONS = [
  { id: 'all', label: '所有人' },
  { id: 'following', label: '关注的人' },
  { id: 'none', label: '不接收任何消息提醒' },
];

export const SettingsMessageReplyAtPage: React.FC = () => {
  const value = useBilibiliStore((s) => s.settings.message.replyAt) ?? 'all';
  const setSetting = useBilibiliStore((s) => s.setSetting);

  return (
    <SettingLayout title="回复与@消息提醒">
      <SettingRadioGroup options={OPTIONS} value={value} onChange={(id) => setSetting('message.replyAt', id)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
