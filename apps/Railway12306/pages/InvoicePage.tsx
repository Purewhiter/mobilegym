import React from 'react';
import { IcNavBack, IcFile, IcMail } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useLocale } from '../../../os/locale';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
import { localizeRailwayText } from '../utils/localizeRailwayItem';
export const InvoicePage: React.FC = () => {
  const { bindBack, bindTap } = useRailwayGestures();
  const isEnglish = useLocale() === 'en';
  const s = useRailwayStrings();

  return (
    <div className="min-h-full bg-app-bg">
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{s.service_invoice}</span>
      </div>

      {/* 头部区域 */}
      <div className="bg-gradient-to-b from-app-primary to-[#6BB3F7] px-4 pt-2 pb-8 text-center">
        <h2 className="text-white text-xl font-bold">{s.invoice_header_title}</h2>
        <p className="text-white/70 text-sm mt-1">{s.invoice_header_desc}</p>
      </div>

      {/* 发票申请预览 */}
      <div className="mx-4 -mt-4 bg-app-surface rounded-xl shadow-sm p-4 relative z-10">
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-gray-700 mb-2">{s.invoice_request_title}</p>
          <div className="space-y-1.5 text-xs text-gray-500">
            <div className="flex gap-4"><span className="text-gray-400 w-16">{s.invoice_request_type_label}</span><span>{localizeRailwayText('企业', isEnglish)}</span></div>
            <div className="flex gap-4"><span className="text-gray-400 w-16">{s.invoice_request_header_label}</span><span>中国****有限公司</span></div>
            <div className="flex gap-4"><span className="text-gray-400 w-16">{s.invoice_request_tax_id_label}</span><span>9000*********3456</span></div>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="flex-1 flex items-center justify-center gap-2 bg-blue-50 rounded-xl py-4" {...bindTap<HTMLButtonElement>('invoice.invoiceHeaders' as any)}>
            <IcFile size={22} className="text-app-primary" />
            <span className="text-sm font-medium text-gray-700">{s.invoice_manage_headers}</span>
          </button>
          <button className="flex-1 flex items-center justify-center gap-2 bg-blue-50 rounded-xl py-4" {...bindTap<HTMLButtonElement>('invoice.emailSettings' as any)}>
            <IcMail size={22} className="text-app-primary" />
            <span className="text-sm font-medium text-gray-700">{s.invoice_email_title}</span>
          </button>
        </div>
      </div>

      {/* 开具按钮 */}
      <div className="mx-4 mt-4">
        <button className="w-full py-3 bg-app-primary rounded-lg text-white text-base font-medium">
          {s.invoice_issue_button}
        </button>
      </div>

      {/* 业务须知 */}
      <div className="mx-4 mt-4 pb-6">
        <p className="text-sm text-app-primary mb-2">{s.invoice_service_notes_reminder}</p>
        <div className="bg-app-surface rounded-xl p-4">
          <div className="flex items-center gap-1 mb-2">
            <span className="text-app-primary">ℹ</span>
            <span className="text-sm font-medium text-gray-900">{s.invoice_service_notes_title}</span>
          </div>
          <div className="text-xs text-gray-500 space-y-2">
            <p>{s.invoice_service_note_1}</p>
            <p>{s.invoice_service_note_2}</p>
            <p>{s.invoice_service_note_3}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
