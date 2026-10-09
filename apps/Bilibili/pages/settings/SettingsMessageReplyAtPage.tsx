import React from 'react';
import { SettingLayout, SettingRadioGroup } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsMessageReplyAtPage: React.FC = () => {
  const s = useBilibiliStrings();
  const value = useBilibiliStore((st) => st.settings.message.replyAt) ?? 'all';
  const setSetting = useBilibiliStore((st) => st.setSetting);

  const OPTIONS = [
    { id: 'all', label: s.opt_all },
    { id: 'following', label: s.opt_following },
    { id: 'none', label: s.opt_none },
  ];

  return (
    <SettingLayout title={s.smr_title}>
      <SettingRadioGroup options={OPTIONS} value={value} onChange={(id) => setSetting('message.replyAt', id)} />
      <div className="h-8" />
    </SettingLayout>
  );
};
