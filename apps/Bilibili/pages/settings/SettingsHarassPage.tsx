import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { SettingLayout, SettingSection, SettingItemSwitch, SettingItemValue, SettingBottomSheet } from './index';
import { useBilibiliStore } from '../../state';
import { useBilibiliGestures } from '../../hooks/useBilibiliGestures';

const HARASS_OPTIONS = [
  { id: '7days', label: '关注我7天以上的人' },
  { id: 'following', label: '我关注的人' },
  { id: 'all', label: '所有人' },
];

const LABELS: Record<string, string> = { '7days': '关注我7天以上的人', following: '我关注的人', all: '所有人' };

export const SettingsHarassPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { back, bindTap } = useBilibiliGestures();
  const setSetting = useBilibiliStore((s) => s.setSetting);
  const oneKey = useBilibiliStore((s) => s.settings.harass.oneKey) ?? false;
  const comment = useBilibiliStore((s) => s.settings.harass.comment) ?? 'all';
  const danmaku = useBilibiliStore((s) => s.settings.harass.danmaku) ?? 'all';
  const pm = useBilibiliStore((s) => s.settings.harass.pm) ?? 'all';

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

  const sheetTitle = sheet === 'comment' ? '谁可以发评论' : sheet === 'danmaku' ? '谁可以发弹幕' : sheet === 'pm' ? '谁可以发私信' : '';

  return (
    <SettingLayout title="防骚扰和互动人群设置">
      <SettingSection title="短期防护" />
      <SettingItemSwitch
        label="一键防骚扰"
        subtitle="开启后,特定时间内只接收选定人群的私信、弹幕、评论,并不再接收@消息。"
        checked={oneKey}
        onChange={(v) => setSetting('harass.oneKey', v)}
      />
      <SettingSection title="长期防护" />
      <SettingItemValue
        label="谁可以发评论"
        value={LABELS[comment] ?? '所有人'}
        {...bindTap('settings.harass.sheet.open', { params: { sheet: 'comment' } })}
      />
      <SettingItemValue
        label="谁可以发弹幕"
        value={LABELS[danmaku] ?? '所有人'}
        {...bindTap('settings.harass.sheet.open', { params: { sheet: 'danmaku' } })}
      />
      <SettingItemValue
        label="谁可以发私信"
        value={LABELS[pm] ?? '所有人'}
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
