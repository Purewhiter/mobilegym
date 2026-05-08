import React, { useEffect, useRef, useState } from 'react';
import { colors } from '../res/colors';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export const InputDialog: React.FC<{
  title: string;
  placeholder?: string;
  initialValue?: string;
  confirmText?: string;
  cancelText?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}> = ({
  title,
  placeholder = '',
  initialValue = '',
  confirmText,
  cancelText,
  onCancel,
  onConfirm,
}) => {
  const s = useAppStrings(strings, stringsEn);
  const confirm = confirmText ?? s.action_confirm;
  const cancel = cancelText ?? s.action_cancel;
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <button
        className="absolute inset-0 bg-black/35"
        onClick={onCancel}
        aria-label={s.action_close}
      />

      <div className="relative w-[320px] max-w-[88vw] rounded-[18px] bg-app-surface shadow-2xl overflow-hidden">
        <div className="px-5 pt-4 pb-3">
          <div className="text-[16px] font-medium text-black">{title}</div>
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="mt-3 w-full h-11 rounded-[12px] px-4 outline-none bg-[#f3f3f3] text-[15px] text-black placeholder:text-[#bdbdbd]"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm(value);
              if (e.key === 'Escape') onCancel();
            }}
          />
          <div className="mt-2 text-[12px]" style={{ color: colors.text_secondary }}>
            {s.input_hint}
          </div>
        </div>

        <div className="h-px bg-black/5" />
        <div className="flex">
          <button
            className="flex-1 h-12 text-[16px] active:bg-black/5"
            style={{ color: colors.text_secondary_strong }}
            onClick={onCancel}
          >
            {cancel}
          </button>
          <div className="w-px bg-black/5" />
          <button
            className="flex-1 h-12 text-[16px] font-medium active:bg-black/5"
            style={{ color: colors.theme_main }}
            onClick={() => onConfirm(value)}
          >
            {confirm}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InputDialog;

