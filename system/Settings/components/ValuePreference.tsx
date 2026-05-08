import React, { useMemo, useState } from 'react';
import { PreferenceItem } from './PreferenceItem';
import { InputDialog } from './InputDialog';
import { useStringPreference } from '../state';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';

function androidInputTypeToHtmlType(
  androidInputType: string | undefined,
  settingKey: string
): React.HTMLInputTypeAttribute {
  const t = (androidInputType || '').toLowerCase();
  if (t.includes('password')) return 'password';
  if (t.includes('email')) return 'email';
  if (t.includes('uri') || t.includes('url')) return 'url';
  if (t.includes('phone')) return 'tel';
  if (t.includes('number')) return 'number';

  // Heuristic fallback by key name
  const k = settingKey.toLowerCase();
  if (k.includes('password') || k.includes('passwd') || k.endsWith('_pwd') || k.includes('pin')) return 'password';
  if (k.includes('port') || k.endsWith('_mcc') || k.endsWith('_mnc')) return 'number';
  return 'text';
}

export const ValuePreference: React.FC<{
  title: string;
  summary?: string;
  settingKey: string;
  defaultValue?: string;
  inputType?: string;
  showDivider?: boolean;
  /** If provided, clicking will navigate instead of editing */
  onNavigate?: () => void;
  itemProps?: React.HTMLAttributes<HTMLDivElement>;
}> = ({
  title,
  summary,
  settingKey,
  defaultValue = '',
  inputType,
  showDivider = true,
  onNavigate,
  itemProps,
}) => {
  const s = useAppStrings(strings, stringsEn);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useStringPreference(settingKey, defaultValue);

  const htmlInputType = useMemo(
    () => androidInputTypeToHtmlType(inputType, settingKey),
    [inputType, settingKey]
  );
  const displayValue = htmlInputType === 'password'
    ? (value ? s.set : '')
    : value;

  return (
    <>
      <PreferenceItem
        title={title}
        summary={summary}
        value={displayValue || undefined}
        showChevron={!!onNavigate}
        showDivider={showDivider}
        itemProps={itemProps}
        onClick={() => {
          if (onNavigate) {
            onNavigate();
          } else {
            setOpen(true);
          }
        }}
      />
      <InputDialog
        open={open}
        title={title}
        defaultValue={value}
        placeholder={s.enter_value}
        inputType={htmlInputType}
        onClose={() => setOpen(false)}
        onConfirm={(v) => {
          setValue(v);
          setOpen(false);
        }}
      />
    </>
  );
};
