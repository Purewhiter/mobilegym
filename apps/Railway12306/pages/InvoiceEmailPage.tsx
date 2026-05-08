import React, { useState } from 'react';
import { IcNavBack, IcInfo } from '../res/icons';
import { RAILWAY12306_CONFIG } from '../data';
import { useRailwayStore, maskEmail } from '../state';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';

export const InvoiceEmailPage: React.FC = () => {
  const { bindBack, back } = useRailwayGestures();
  const s = useRailwayStrings();
  const savedEmail = useRailwayStore(s => s.invoiceEmail);
  const setInvoiceEmail = useRailwayStore(s => s.setInvoiceEmail);

  const rawEmail = (RAILWAY12306_CONFIG as any).account?.email?.address ?? '';
  const defaultDisplay = maskEmail(savedEmail || rawEmail);

  const [email, setEmail] = useState(defaultDisplay);
  const [showDialog, setShowDialog] = useState(false);

  const handleSave = () => {
    if (!email.trim() || email === defaultDisplay) return;
    setInvoiceEmail(email.trim());
    setShowDialog(true);
  };

  const handleConfirm = () => {
    setShowDialog(false);
    back();
  };

  return (
    <div className="min-h-full bg-app-bg flex flex-col">
      {/* 顶栏 */}
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center gap-3 relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{s.invoice_email_title}</span>
      </div>

      {/* 邮箱卡片 */}
      <div className="bg-app-surface mx-3 mt-4 rounded-lg px-4 py-4">
        <p className="text-base font-bold text-gray-900 mb-1">{s.invoice_email_default_label}</p>
        <p className="text-xs text-gray-400 mb-4">
          {s.invoice_email_default_desc}
        </p>
        <input
          className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm text-gray-900 outline-none focus:border-app-primary bg-transparent placeholder:text-gray-300"
          placeholder={s.invoice_email_placeholder}
          value={email}
          onChange={e => setEmail(e.target.value)}
          onFocus={() => { if (email === defaultDisplay) setEmail(''); }}
        />
      </div>

      {/* 保存按钮 */}
      <div className="px-3 mt-4">
        <button
          className="w-full py-3 bg-app-primary rounded-full text-white text-base font-medium active:opacity-80"
          onClick={handleSave}
        >
          {s.action_save}
        </button>
      </div>

      {/* 温馨提示 */}
      <div className="mx-3 mt-6 px-4 py-3">
        <div className="flex items-center gap-1.5 mb-2">
          <IcInfo size={14} className="text-app-primary shrink-0" />
          <span className="text-sm text-gray-900 font-medium">{s.invoice_email_notes_title}</span>
        </div>
        <div className="text-xs text-gray-400 space-y-2 leading-relaxed">
          <p>{s.invoice_email_note_1}</p>
          <p>{s.invoice_email_note_2}</p>
          <p>{s.invoice_email_note_3}</p>
          <p>{s.invoice_email_note_4}</p>
        </div>
      </div>

      {/* 成功弹窗 */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl w-[280px] overflow-hidden">
            <div className="px-6 pt-6 pb-4 text-center">
              <p className="text-lg font-bold text-gray-900 mb-3">{s.common_notice}</p>
              <p className="text-sm text-gray-600">{s.invoice_email_saved_success}</p>
            </div>
            <button
              className="w-full py-3 border-t border-gray-100 text-base font-medium text-app-primary active:bg-gray-50"
              onClick={handleConfirm}
            >
              {s.action_confirm}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
