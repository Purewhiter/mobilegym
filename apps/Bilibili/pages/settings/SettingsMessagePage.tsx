import React from 'react';
import { SettingLayout, SettingSection, SettingItemSwitch, SettingItemValue, SettingItemArrow } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsMessagePage: React.FC = () => {
  const { go } = useBilibiliGestures();
  const s = useBilibiliStrings();
  const setSetting = useBilibiliStore((st) => st.setSetting);
  const messageNotify = useBilibiliStore((st) => st.settings.message.notify) ?? true;
  const smartBlock = useBilibiliStore((st) => st.settings.message.smartBlock) ?? true;
  const replyAt = useBilibiliStore((st) => st.settings.message.replyAt) ?? 'all';
  const like = useBilibiliStore((st) => st.settings.message.like) ?? 'all';
  const fan = useBilibiliStore((st) => st.settings.message.fan) ?? 'on';
  const support = useBilibiliStore((st) => st.settings.message.support) ?? 'on';

  const REPLY_AT_LABELS: Record<string, string> = { all: s.opt_all, following: s.opt_following, none: s.opt_none };
  const FAN_LABELS: Record<string, string> = { on: s.opt_receive, off: s.opt_never };
  const SUPPORT_LABELS: Record<string, string> = { on: s.opt_receive_msg, off: s.opt_not_receive };

  return (
    <SettingLayout title={s.sm_title}>
      <SettingSection title={s.sm_sec_notify} />
      <SettingItemSwitch label={s.sm_notify} subtitle={s.sm_notify_sub} checked={messageNotify} onChange={(v) => setSetting('message.notify', v)} />
      <SettingSection title={s.sm_sec_receive} />
      <SettingItemSwitch label={s.sm_smart_block} subtitle={s.sm_smart_block_sub} checked={smartBlock} onChange={(v) => setSetting('message.smartBlock', v)} />
      <SettingItemArrow label={s.sm_block_words} subtitle={s.sm_block_words_sub} />
      <SettingSection title={s.sm_sec_interact} />
      <SettingItemValue label={s.sm_reply_at} subtitle={s.sm_reply_at_sub} value={REPLY_AT_LABELS[replyAt] ?? s.opt_all} onClick={() => go('settings.message.replyAt.open' as any)} />
      <SettingItemValue label={s.sm_like} subtitle={s.sm_like_sub} value={REPLY_AT_LABELS[like] ?? s.opt_all} onClick={() => go('settings.message.like.open' as any)} />
      <SettingItemValue label={s.sm_fan} subtitle={s.sm_fan_sub} value={FAN_LABELS[fan] ?? s.opt_receive} onClick={() => go('settings.message.fan.open' as any)} />
      <SettingSection title={s.sm_sec_support} />
      <SettingItemValue label={s.sm_support} value={SUPPORT_LABELS[support] ?? s.opt_receive_msg} onClick={() => go('settings.message.support.open' as any)} />
      <SettingItemArrow label={s.sm_unfollow} onClick={() => go('settings.message.unfollow.open' as any)} />
      <SettingSection title={s.sm_sec_contacts} />
      <SettingItemArrow label={s.sm_blacklist} />
      <div className="h-8" />
    </SettingLayout>
  );
};
