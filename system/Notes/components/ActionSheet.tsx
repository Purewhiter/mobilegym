import React from 'react';
import { colors } from '../res/colors';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export type ActionSheetItem = {
  key: string;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export const ActionSheet: React.FC<{
  visible: boolean;
  title?: string;
  items: ActionSheetItem[];
  onClose: () => void;
  cancelLabel?: string;
}> = ({ visible, title, items, onClose, cancelLabel }) => {
  const s = useAppStrings(strings, stringsEn);
  const label = cancelLabel ?? s.action_cancel;
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <button className="absolute inset-0 bg-black/35" onClick={onClose} aria-label={s.action_close} />
      <div className="absolute left-0 right-0 bottom-0 bg-app-surface rounded-t-[24px] overflow-hidden">
        {title ? (
          <div className="px-5 py-4 text-[14px] font-medium text-black">
            {title}
          </div>
        ) : null}

        <div className="px-3 pb-3">
          {items.map((it) => (
            <button
              key={it.key}
              className="w-full flex items-center justify-between px-3 h-12 rounded-[14px] active:bg-black/5 disabled:opacity-40"
              onClick={() => {
                if (it.disabled) return;
                it.onClick();
              }}
              disabled={it.disabled}
            >
              <div
                className="text-[15px]"
                style={{
                  color: it.danger ? '#ff3b30' : colors.text_secondary_strong,
                }}
              >
                {it.label}
              </div>
            </button>
          ))}

          <div className="h-2" />
          <button
            className="w-full h-12 rounded-[14px] bg-[#f3f3f3] text-[15px] active:opacity-80"
            style={{ color: colors.text_secondary_strong }}
            onClick={onClose}
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActionSheet;

