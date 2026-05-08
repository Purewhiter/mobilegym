import React from 'react';
import { SettingLayout, SettingSection, SettingItemSwitch, SettingItemArrow } from './index';
import { useBilibiliStore } from '../../state';

export const SettingsSupportPage: React.FC = () => {
  const setSetting = useBilibiliStore((s) => s.setSetting);
  const receive = useBilibiliStore((s) => s.settings.message.support) === 'on';
  const collapse = useBilibiliStore((s) => s.settings.message.supportCollapse) ?? true;

  return (
    <SettingLayout title="应援团">
      <SettingItemSwitch label="接收应援团消息" subtitle="应援团消息提醒" checked={receive} onChange={(v) => setSetting('message.support', v ? 'on' : 'off')} />
      <SettingItemSwitch label="收起应援团消息" subtitle="开启后,应援团消息将被折叠在我的应援团内" checked={collapse} onChange={(v) => setSetting('message.supportCollapse', v)} />
      <SettingSection title="应援团攻略" />
      <SettingItemArrow label="加入应援团攻略" />
      <div className="h-8" />
    </SettingLayout>
  );
};
