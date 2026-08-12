import React from 'react';
import { SettingLayout, SettingSection, SettingItemArrow, SettingItemSwitch } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsPushPage: React.FC = () => {
  const s = useBilibiliStrings();
  const setSetting = useBilibiliStore((st) => st.setSetting);
  const settings = useBilibiliStore((st) => st.settings);
  const toggle = (key: string) => settings.push[key] ?? true;
  const set = (key: string, v: boolean) => setSetting(`push.${key}`, v);

  return (
    <SettingLayout title={s.sp_title}>
      <SettingItemArrow label={s.sp_master} subtitle={s.sp_master_sub} />
      <SettingItemArrow label={s.sp_dnd} subtitle={s.sp_dnd_sub} />
      <SettingSection title={s.sp_sec_interact} />
      <SettingItemSwitch label={s.sp_like} checked={toggle('like')} onChange={(v) => set('like', v)} />
      <SettingItemSwitch label={s.sp_comment} checked={toggle('comment')} onChange={(v) => set('comment', v)} />
      <SettingItemSwitch label="@" checked={toggle('at')} onChange={(v) => set('at', v)} />
      <SettingSection title={s.sp_sec_pm} />
      <SettingItemSwitch label={s.sp_chat} checked={toggle('chat')} onChange={(v) => set('chat', v)} />
      <SettingSection title={s.sp_sec_follow} />
      <SettingItemSwitch label={s.sp_follow_up} checked={toggle('followUp')} onChange={(v) => set('followUp', v)} />
      <SettingSection title={s.sp_sec_content} />
      <SettingItemSwitch label={s.sp_recommend} checked={toggle('recommend')} onChange={(v) => set('recommend', v)} />
      <SettingItemSwitch label={s.sp_hot} checked={toggle('hot')} onChange={(v) => set('hot', v)} />
      <SettingItemSwitch label={s.sp_activity} checked={toggle('activity')} onChange={(v) => set('activity', v)} />
      <SettingSection title={s.sp_sec_sub} />
      <SettingItemSwitch label={s.sp_chase} checked={toggle('chase')} onChange={(v) => set('chase', v)} />
      <SettingItemSwitch label={s.sp_live} checked={toggle('live')} onChange={(v) => set('live', v)} />
      <SettingItemSwitch label={s.sp_collection} checked={toggle('collection')} onChange={(v) => set('collection', v)} />
      <SettingItemSwitch label={s.sp_search} checked={toggle('search')} onChange={(v) => set('search', v)} />
      <SettingItemSwitch label={s.sp_other_sub} checked={toggle('otherSub')} onChange={(v) => set('otherSub', v)} />
      <SettingSection title={s.sp_sec_helper} />
      <SettingItemSwitch label={s.sp_upload} checked={toggle('upload')} onChange={(v) => set('upload', v)} />
      <SettingSection title={s.sp_sec_service} />
      <SettingItemSwitch label={s.sp_logistics} checked={toggle('logistics')} onChange={(v) => set('logistics', v)} />
      <SettingItemSwitch label={s.sp_value} checked={toggle('value')} onChange={(v) => set('value', v)} />
      <SettingSection title={s.sp_sec_other} />
      <SettingItemSwitch label={s.sp_security} checked={toggle('security')} onChange={(v) => set('security', v)} />
      <SettingItemSwitch label={s.sp_other} checked={toggle('other')} onChange={(v) => set('other', v)} />
      <SettingSection title={s.sp_sec_banner} />
      <SettingItemSwitch label={s.sp_banner} subtitle={s.sp_banner_sub} checked={toggle('banner')} onChange={(v) => set('banner', v)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
