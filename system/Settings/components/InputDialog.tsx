import React, { useEffect, useState } from 'react';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';

export const InputDialog: React.FC<{
  open: boolean;
  title: string;
  defaultValue?: string;
  placeholder?: string;
  inputType?: React.HTMLInputTypeAttribute;
  confirmText?: string;
  /** Allow confirming empty string */
  allowEmpty?: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
}> = ({
  open,
  title,
  defaultValue = '',
  placeholder,
  inputType = 'text',
  confirmText,
  allowEmpty = false,
  onClose,
  onConfirm,
}) => {
  const s = useAppStrings(strings, stringsEn);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) setValue(defaultValue);
  }, [open, defaultValue]);

  if (!open) return null;

  const trimmed = value.trim();
  const canConfirm = allowEmpty ? true : !!trimmed;
  const confirmValue = allowEmpty ? value : trimmed;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-[340px] bg-app-surface rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="text-[17px] font-semibold text-app-text">{title}</div>
        </div>
        <div className="p-5">
          <input
            type={inputType}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full px-4 py-3 border border-app-border rounded-xl text-[15px] focus:outline-none focus:border-blue-500"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canConfirm) onConfirm(confirmValue);
            }}
          />
          <div className="flex gap-3 mt-5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl bg-gray-100 text-[15px] font-medium text-gray-700 active:bg-gray-200"
            >
              {s.cancel}
            </button>
            <button
              type="button"
              onClick={() => canConfirm && onConfirm(confirmValue)}
              disabled={!canConfirm}
              className="flex-1 py-3 rounded-xl bg-app-primary text-[15px] font-medium text-white disabled:opacity-50 active:bg-[#2f74e6]"
            >
              {confirmText ?? s.ok}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

