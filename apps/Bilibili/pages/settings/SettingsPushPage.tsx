import React from 'react';
import { SettingLayout, SettingSection, SettingItemArrow, SettingItemSwitch } from './index';
import { useBilibiliStore } from '../../state';

export const SettingsPushPage: React.FC = () => {
  const setSetting = useBilibiliStore((s) => s.setSetting);
  const settings = useBilibiliStore((s) => s.settings);
  const toggle = (key: string) => settings.push[key] ?? true;
  const set = (key: string, v: boolean) => setSetting(`push.${key}`, v);

  return (
    <SettingLayout title="推送设置">
      <SettingItemArrow label="接收消息通知总开关 [已开启]" subtitle="请在您设备的「设置-通知」中,选择「哔哩哔哩」进行修改" />
      <SettingItemArrow label="消息免打扰" subtitle="开启后,免打扰时间内将不会收到推送消息" />
      <SettingSection title="互动通知" />
      <SettingItemSwitch label="点赞" checked={toggle('like')} onChange={(v) => set('like', v)} />
      <SettingItemSwitch label="评论" checked={toggle('comment')} onChange={(v) => set('comment', v)} />
      <SettingItemSwitch label="@" checked={toggle('at')} onChange={(v) => set('at', v)} />
      <SettingSection title="私信通知" />
      <SettingItemSwitch label="聊天消息" checked={toggle('chat')} onChange={(v) => set('chat', v)} />
      <SettingSection title="关注通知" />
      <SettingItemSwitch label="关注up主的更新提醒" checked={toggle('followUp')} onChange={(v) => set('followUp', v)} />
      <SettingSection title="内容推荐" />
      <SettingItemSwitch label="推荐可能感兴趣的内容" checked={toggle('recommend')} onChange={(v) => set('recommend', v)} />
      <SettingItemSwitch label="热点" checked={toggle('hot')} onChange={(v) => set('hot', v)} />
      <SettingItemSwitch label="活动" checked={toggle('activity')} onChange={(v) => set('activity', v)} />
      <SettingSection title="订阅/预约通知" />
      <SettingItemSwitch label="追番追剧更新提醒" checked={toggle('chase')} onChange={(v) => set('chase', v)} />
      <SettingItemSwitch label="直播提醒" checked={toggle('live')} onChange={(v) => set('live', v)} />
      <SettingItemSwitch label="订阅合集更新提醒" checked={toggle('collection')} onChange={(v) => set('collection', v)} />
      <SettingItemSwitch label="搜索内容更新提醒" checked={toggle('search')} onChange={(v) => set('search', v)} />
      <SettingItemSwitch label="其他订阅/预约提醒" checked={toggle('otherSub')} onChange={(v) => set('otherSub', v)} />
      <SettingSection title="UP主小助手" />
      <SettingItemSwitch label="投稿服务通知" checked={toggle('upload')} onChange={(v) => set('upload', v)} />
      <SettingSection title="服务通知" />
      <SettingItemSwitch label="物流与订单通知" checked={toggle('logistics')} onChange={(v) => set('logistics', v)} />
      <SettingItemSwitch label="增值服务通知" checked={toggle('value')} onChange={(v) => set('value', v)} />
      <SettingSection title="其他通知" />
      <SettingItemSwitch label="账号安全通知" checked={toggle('security')} onChange={(v) => set('security', v)} />
      <SettingItemSwitch label="其他通知" checked={toggle('other')} onChange={(v) => set('other', v)} />
      <SettingSection title="APP内通知横幅" />
      <SettingItemSwitch label="应用内顶部横幅提醒" subtitle="开启后，应用使用期间会收到推送通知" checked={toggle('banner')} onChange={(v) => set('banner', v)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
