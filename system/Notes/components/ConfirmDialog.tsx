import React from 'react';
import { colors } from '../res/colors';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

/**
 * Confirmation dialog as MIUI Notes shows it: a card at the bottom with a title,
 * a message and two pill buttons. Shown from a URL state; cancel and the
 * backdrop are system back, confirm is the caller's action binding.
 */
export const ConfirmDialog: React.FC<{
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  cancelBind: React.HTMLAttributes<HTMLElement>;
  confirmBind: React.HTMLAttributes<HTMLElement>;
}> = ({ title, message, confirmLabel, danger, cancelBind, confirmBind }) => {
  const s = useAppStrings(strings, stringsEn);
  return (
    <div className="fixed inset-0 z-[90] flex items-end">
      <button className="absolute inset-0 bg-black/35" {...cancelBind} aria-label={s.action_close} />
      <div className="relative mx-3 mb-6 w-full rounded-[28px] bg-app-surface px-5 pt-6 pb-5">
        <div className="text-center text-[18px] font-medium text-black">{title}</div>
        <div className="mt-4 text-center text-[15px] leading-relaxed" style={{ color: colors.text_secondary_strong }}>
          {message}
        </div>
        <div className="mt-6 flex gap-3">
          <button className="flex-1 h-12 rounded-[16px] bg-[#f0f0f0] text-[16px] text-black active:opacity-80" {...cancelBind}>
            {s.action_cancel}
          </button>
          <button
            className="flex-1 h-12 rounded-[16px] bg-[#f0f0f0] text-[16px] active:opacity-80"
            style={{ color: danger ? '#ff3b30' : colors.theme_main }}
            {...confirmBind}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
