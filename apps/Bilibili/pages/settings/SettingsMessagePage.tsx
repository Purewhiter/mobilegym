import React from 'react';
import { SettingLayout, SettingSection, SettingItemSwitch, SettingItemValue, SettingItemArrow } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';

const REPLY_AT_LABELS: Record<string, string> = { all: '所有人', following: '关注的人', none: '不接收任何消息提醒' };
const FAN_LABELS: Record<string, string> = { on: '接收提醒', off: '永不提醒' };
const SUPPORT_LABELS: Record<string, string> = { on: '接收消息', off: '不接收' };

export const SettingsMessagePage: React.FC = () => {
  const { go } = useBilibiliGestures();
  const setSetting = useBilibiliStore((s) => s.setSetting);
  const messageNotify = useBilibiliStore((s) => s.settings.message.notify) ?? true;
  const smartBlock = useBilibiliStore((s) => s.settings.message.smartBlock) ?? true;
  const replyAt = useBilibiliStore((s) => s.settings.message.replyAt) ?? 'all';
  const like = useBilibiliStore((s) => s.settings.message.like) ?? 'all';
  const fan = useBilibiliStore((s) => s.settings.message.fan) ?? 'on';
  const support = useBilibiliStore((s) => s.settings.message.support) ?? 'on';

  return (
    <SettingLayout title="消息设置">
      <SettingSection title="消息提醒" />
      <SettingItemSwitch label="消息提醒" subtitle="关闭后，APP首页将不再进行数字提醒" checked={messageNotify} onChange={(v) => setSetting('message.notify', v)} />
      <SettingSection title="消息接收设置" />
      <SettingItemSwitch label="私信智能拦截" subtitle="开启后，将自动拦截疑似骚扰和不良的会话" checked={smartBlock} onChange={(v) => setSetting('message.smartBlock', v)} />
      <SettingItemArrow label="消息屏蔽词" subtitle="添加后，将不再接受包含屏蔽词的消息" />
      <SettingSection title="互动通知" />
      <SettingItemValue label="回复与@" subtitle="你将收到这些人的评论、弹幕等通知提醒" value={REPLY_AT_LABELS[replyAt] ?? '所有人'} onClick={() => go('settings.message.replyAt.open' as any)} />
      <SettingItemValue label="收到喜欢" subtitle="是否接收点赞等通知提醒" value={REPLY_AT_LABELS[like] ?? '所有人'} onClick={() => go('settings.message.like.open' as any)} />
      <SettingItemValue label="新增粉丝" subtitle="是否接收新增粉丝通知提醒" value={FAN_LABELS[fan] ?? '接收提醒'} onClick={() => go('settings.message.fan.open' as any)} />
      <SettingSection title="应援团和未关注人" />
      <SettingItemValue label="应援团消息" value={SUPPORT_LABELS[support] ?? '接收消息'} onClick={() => go('settings.message.support.open' as any)} />
      <SettingItemArrow label="未关注人消息" onClick={() => go('settings.message.unfollow.open' as any)} />
      <SettingSection title="联系人" />
      <SettingItemArrow label="黑名单" />
      <div className="h-8" />
    </SettingLayout>
  );
};
