import React from 'react';

type RefundNoticeDialogProps = {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  cancelProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
  confirmProps: React.ButtonHTMLAttributes<HTMLButtonElement>;
};

export const RefundNoticeDialog: React.FC<RefundNoticeDialogProps> = ({
  title,
  message,
  cancelLabel,
  confirmLabel,
  cancelProps,
  confirmProps,
}) => {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-7">
      <div className="absolute inset-0 bg-black/55" />
      <div className="relative w-full max-w-[340px] rounded-[18px] bg-white px-4 pt-7 pb-5 shadow-[0_10px_30px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-gradient-to-l from-[#DCE7F7] to-transparent" />
          <div className="text-center text-[21px] font-semibold text-[#20263A] leading-tight">
            {title}
          </div>
          <span className="h-px w-8 bg-gradient-to-r from-[#DCE7F7] to-transparent" />
        </div>
        <div className="mt-6 px-1 text-center text-[20px] leading-[1.75] text-[#444] tracking-normal">
          {message}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            {...cancelProps}
            className={`h-14 rounded-[8px] border border-[#BBBBBB] bg-white text-[18px] font-medium text-[#666] active:bg-gray-50 ${cancelProps.className ?? ''}`}
          >
            {cancelLabel}
          </button>
          <button
            {...confirmProps}
            className={`h-14 rounded-[8px] bg-[#5B9BEE] text-[18px] font-medium text-white active:bg-[#4589E0] ${confirmProps.className ?? ''}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
