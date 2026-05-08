import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcClose } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { now } from '@/os/TimeService';
import type { ActivityResult } from '@/os/types/manifest';

export const RefundPage: React.FC = () => {
  const recordTransfer = useAlipayStore(state => state.recordTransfer);
  const { back } = useAlipayGestures();
  const s = useAlipayStrings();

  const os = window.__OS__;
  const intentPayload = os?.getIntentPayload?.('alipay') as { data?: Record<string, string | number> } | null;
  const intentData = intentPayload?.data;
  const amount = intentData?.amount != null ? String(intentData.amount) : '0';
  const merchantName = String(intentData?.merchantName ?? s.refund_page_merchant_fallback);
  const subject = intentData?.subject ?? '';
  const orderId = intentData?.orderId != null ? String(intentData.orderId) : '';

  const returnResult = (result: ActivityResult) => {
    if (os?.getIntentPayload?.('alipay') && os?.setResult) {
      os.setResult(result);
    } else {
      back();
    }
  };

  const handleClose = () => {
    returnResult({ resultCode: 'CANCELED' });
  };

  const handleRefund = () => {
    const num = Number.parseFloat(amount);
    const v = Number.isFinite(num) && num > 0 ? num : 0;
    if (v <= 0) {
      returnResult({ resultCode: 'FAILED', data: { reason: 'INVALID_AMOUNT' } });
      return;
    }
    recordTransfer({
      counterpartyName: merchantName,
      delta: v,
    });
    returnResult({ resultCode: 'OK', data: { refundNo: `R${now()}` } });
  };

  return (
    <div className="w-full h-full bg-app-bg flex flex-col pt-10">
      <div className="sticky top-0 z-20 bg-app-primary px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={handleClose} className="p-1">
          <IcClose size={22} className="text-white" />
        </button>
        <span className="text-base font-medium text-white">{s.refund_page_title}</span>
        <div className="w-8" />
      </div>

      <div className="px-4 pt-6 pb-4 bg-white">
        <div className="text-sm text-gray-500 text-center">{s.refund_page_refund_to_payer}</div>
        <div className="text-base font-medium text-gray-900 text-center mt-1">{merchantName}</div>
        {subject && <div className="text-xs text-gray-400 text-center mt-1">{subject}</div>}
        <div className="flex items-baseline justify-center mt-4">
          <span className="text-lg text-gray-900 mr-1">¥</span>
          <span className="text-4xl font-bold text-gray-900">{amount}</span>
        </div>
      </div>

      <div className="px-4 mt-6">
        <button
          className="w-full py-3 rounded-full bg-app-primary text-white font-medium text-base"
          onClick={handleRefund}
        >
          {s.refund_page_confirm}
        </button>
      </div>
    </div>
  );
};
