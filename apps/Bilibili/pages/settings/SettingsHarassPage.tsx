import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { SettingLayout, SettingSection, SettingItemSwitch, SettingItemValue, SettingBottomSheet } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';
import { useBilibiliStrings } from '../../hooks/useBilibiliStrings';

export const SettingsHarassPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { back, bindTap } = useBilibiliGestures();
  const s = useBilibiliStrings();
  const setSetting = useBilibiliStore((st) => st.setSetting);
  const oneKey = useBilibiliStore((st) => st.settings.harass.oneKey) ?? false;
  const comment = useBilibiliStore((st) => st.settings.harass.comment) ?? 'all';
  const danmaku = useBilibiliStore((st) => st.settings.harass.danmaku) ?? 'all';
  const pm = useBilibiliStore((st) => st.settings.harass.pm) ?? 'all';

  const HARASS_OPTIONS = [
    { id: '7days', label: s.sh_opt_7days },
    { id: 'following', label: s.sh_opt_following },
    { id: 'all', label: s.opt_all },
  ];

  const LABELS: Record<string, string> = { '7days': s.sh_opt_7days, following: s.sh_opt_following, all: s.opt_all };

  const sheet = searchParams.get('sheet') ?? '';

  // 弹窗打开走声明化 go()（URL 驱动、push 入栈），关闭统一 back() 弹栈
  const closeSheet = () => back();

  const currentValue = sheet === 'comment' ? comment : sheet === 'danmaku' ? danmaku : sheet === 'pm' ? pm : '';
  const onSelect = (id: string) => {
    if (sheet === 'comment') setSetting('harass.comment', id);
    else if (sheet === 'danmaku') setSetting('harass.danmaku', id);
    else if (sheet === 'pm') setSetting('harass.pm', id);
    closeSheet();
  };

  const sheetTitle = sheet === 'comment' ? s.sh_comment : sheet === 'danmaku' ? s.sh_danmaku : sheet === 'pm' ? s.sh_pm : '';

  return (
    <SettingLayout title={s.sh_title}>
      <SettingSection title={s.sh_sec_short} />
      <SettingItemSwitch
        label={s.sh_onekey}
        subtitle={s.sh_onekey_sub}
        checked={oneKey}
        onChange={(v) => setSetting('harass.oneKey', v)}
      />
      <SettingSection title={s.sh_sec_long} />
      <SettingItemValue
        label={s.sh_comment}
        value={LABELS[comment] ?? s.opt_all}
        {...bindTap('settings.harass.sheet.open', { params: { sheet: 'comment' } })}
      />
      <SettingItemValue
        label={s.sh_danmaku}
        value={LABELS[danmaku] ?? s.opt_all}
        {...bindTap('settings.harass.sheet.open', { params: { sheet: 'danmaku' } })}
      />
      <SettingItemValue
        label={s.sh_pm}
        value={LABELS[pm] ?? s.opt_all}
        {...bindTap('settings.harass.sheet.open', { params: { sheet: 'pm' } })}
      />
      <div className="h-8" />

      <SettingBottomSheet
        title={sheetTitle}
        options={HARASS_OPTIONS}
        value={currentValue}
        onSelect={onSelect}
        onClose={closeSheet}
        open={sheet !== ''}
      />
    </SettingLayout>
  );
};
