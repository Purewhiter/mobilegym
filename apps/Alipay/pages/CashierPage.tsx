import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcClose, IcExpand, IcDelete } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { now } from '@/os/TimeService';
import type { ActivityResult } from '@/os/types/manifest';
import { useActivityContext } from '@/os/ActivityContext';
import { useLocale } from '@/apps/Alipay/locale';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { localizeBankName } from '../utils/localizeBankName';
import { DefaultAvatar } from '../components/DefaultAvatar';
import type { AlipayUserInfo } from '../types';

export function getCashierExpectedPassword(userInfo: Pick<AlipayUserInfo, 'paymentPassword'> | null | undefined): string {
  return String(userInfo?.paymentPassword ?? '');
}

export const CashierPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const deductBalance = useAlipayStore(s => s.deductBalance);
  const recordTransfer = useAlipayStore(s => s.recordTransfer);
  const setLastPaymentHint = useAlipayStore(s => s.setLastPaymentHint);
  const bankCards = useAlipayStore(s => s.bankCards);
  const balance = useAlipayStore(s => s.balance);
  const userInfo = useAlipayStore(s => s.userInfo);
  const s = useAlipayStrings();
  const { bindTap, back } = useAlipayGestures();
  const { activityId } = useActivityContext();
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const isPasswordModalVisible = searchParams.get('modal') === 'password';
  const [selectedMethodId, setSelectedMethodId] = useState<string>('huabei');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);

  // Password state
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const calledRef = useRef(false);
  const expectedPassword = getCashierExpectedPassword(userInfo);

  const os = window.__OS__;
  const intentPayload =
    (os?.getIntentPayload?.(activityId) ?? os?.getIntentPayload?.('alipay')) as { data?: Record<string, any> } | null;
  const intentData = intentPayload?.data;
  const amount = intentData?.amount != null ? String(intentData.amount) : '0';
  const merchantName = intentData?.merchantName ?? s.cashier_merchant_fallback;
  const subject = intentData?.subject ?? '';
  const orderId = intentData?.orderId ?? undefined;
  const payable = Number(amount) || 0;

  const maskedPhone = userInfo?.phone
    ? `${userInfo.phone.slice(0, 3)}******${userInfo.phone.slice(-2)}`
    : '';

  const boundCards = (bankCards || []).filter(c => c.bound);

  const returnResult = (result: ActivityResult) => {
    if ((os?.getIntentPayload?.(activityId) ?? os?.getIntentPayload?.('alipay')) && os?.setResult) {
      os.setResult(result);
    } else {
      back();
    }
  };

  const handleClose = () => {
      setCancelDialogOpen(true);
  };

  const handleConfirmCancel = () => {
    setCancelDialogOpen(false);
    returnResult({ resultCode: 'CANCELED' });
  };

  const handleContinuePay = () => {
    setCancelDialogOpen(false);
  };

  const handlePaymentSuccess = (methodId?: string) => {
    const activeMethodId = methodId || selectedMethodId;

    if (payable <= 0) {
      setLastPaymentHint(s.cashier_invalid_amount);
      returnResult({ resultCode: 'FAILED', data: { reason: 'INVALID_AMOUNT' } });
      return;
    }

    const isVirtualMethod = ['huabei', 'yuebao'].includes(activeMethodId);

    if (!isVirtualMethod) {
      const activeCard = activeMethodId === 'balance'
        ? null
        : (bankCards || []).find(c => c.id === activeMethodId && c.bound) || null;
      const activeAvailable = activeMethodId === 'balance'
        ? Number(balance?.total || 0)
        : Number(activeCard?.available || 0);

      if (activeAvailable < payable) {
        setSelectedMethodId(activeMethodId);
        setLastPaymentHint(s.cashier_insufficient_balance);
        return;
      }
    }

    recordTransfer({
      counterpartyName: merchantName,
      delta: -payable,
      methodId: activeMethodId,
      orderId,
      subject,
      kind: 'payment',
    });

    if (!isVirtualMethod) {
      const num = parseFloat(amount);
      if (isFinite(num) && num > 0) {
        deductBalance(num);
      }
    }

    returnResult({ resultCode: 'OK', data: { tradeNo: `T${now()}` } });
  };

  // Password logic
  useEffect(() => {
    if (isPasswordModalVisible) {
      setPassword('');
      setError(false);
      calledRef.current = false;
    }
  }, [isPasswordModalVisible]);

  useEffect(() => {
    if (password.length === 6) {
      if (calledRef.current) return;
      if (password === expectedPassword) {
        calledRef.current = true;
        setTimeout(() => {
          handlePaymentSuccess(selectedMethodId);
        }, 200);
      } else {
        setError(true);
        setPassword('');
      }
    } else {
      if (error && password.length > 0) {
        setError(false);
      }
    }
  }, [password, expectedPassword, selectedMethodId, error]);

  const handleNumberClick = (num: string) => {
    if (password.length < 6) {
      setPassword(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPassword(prev => prev.slice(0, -1));
  };

  const CheckIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1677FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  return (
    <div className="w-full h-full bg-[#1A2230] flex flex-col">
      {/* Cancel confirmation dialog */}
      {cancelDialogOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl w-[280px] overflow-hidden px-6 pt-6 pb-5">
            <div className="text-center">
              <div className="text-[17px] font-semibold text-gray-900">{s.cashier_cancel_title}</div>
              <div className="text-[14px] text-gray-500 mt-2 leading-relaxed">{s.cashier_cancel_hint}</div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                className="flex-1 py-2.5 rounded-full border border-[#1677FF] text-[#1677FF] text-[15px] font-medium active:bg-blue-50"
                onClick={handleConfirmCancel}
              >
                {s.cashier_abandon}
              </button>
              <button
                className="flex-1 py-2.5 rounded-full bg-[#1677FF] text-white text-[15px] font-medium active:bg-[#1266D9]"
                onClick={handleContinuePay}
              >
                {s.cashier_continue}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User info area at top */}
      {!isPasswordModalVisible && (
        <div className="flex-shrink-0 flex flex-col items-center pt-14 pb-6">
          <div className="w-[48px] h-[48px] rounded-lg overflow-hidden bg-gray-200 mb-2 shadow-sm">
            {userInfo?.avatar ? (
              <img src={userInfo.avatar} className="w-full h-full object-cover" alt="" />
            ) : (
              <DefaultAvatar iconSize={24} />
            )}
          </div>
          <span className="text-[15px] text-white">{maskedPhone}</span>
        </div>
      )}

      {/* White payment card */}
      <div className={`flex-1 bg-white rounded-t-[20px] flex flex-col overflow-hidden ${isPasswordModalVisible ? 'mt-12' : ''}`}>
        <div className={`flex-1 px-5 pt-4 pb-2 ${isPasswordModalVisible ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3 relative">
            <button onClick={handleClose} className="p-1 -ml-1">
              <IcClose size={20} className="text-gray-400" />
            </button>
            {isPasswordModalVisible && (
              <span className="text-[16px] font-medium text-[#333] absolute left-1/2 -translate-x-1/2">
                {s.enter_payment_password}
              </span>
            )}
            <button
              {...(!isPasswordModalVisible ? bindTap<HTMLButtonElement>('cashier.password.open') : {})}
              className="text-[14px] text-[#1677FF]"
            >
              {isPasswordModalVisible ? s.cashier_use_fingerprint : s.cashier_use_password}
            </button>
          </div>

          {/* Merchant + Amount */}
          <div className="text-center mb-3">
            <div className="text-[14px] text-[#333]">{merchantName}</div>
            <div className="flex items-baseline justify-center mt-1">
              <span className="text-[18px] font-bold text-gray-900 mr-0.5">¥</span>
              <span className="text-[36px] font-bold text-gray-900 leading-tight">
                {Number(amount).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Account + Order info — 行间无分割线 */}
          <div className="pt-3 mt-2">
            <div className="flex justify-between py-2">
              <span className="text-[13px] text-[#999]">{s.cashier_account}</span>
              <span className="text-[13px] text-[#333]">{maskedPhone}</span>
            </div>
            {subject && (
              <div className="flex justify-between py-2">
                <span className="text-[13px] text-[#999]">{s.order_info}</span>
                <span className="text-[13px] text-[#333]">{subject}</span>
              </div>
            )}
          </div>

          {/* Payment methods — 浅灰底色 + 圆角矩形框，细线仅从文字左侧到右框边 */}
          <div className="-mx-2 mt-4 rounded-xl bg-[#F8F8F8] border border-gray-100 overflow-hidden">
            <div className="px-4 py-1">
              {/* 花呗 */}
              <button
                className="w-full flex items-center justify-between py-2.5 active:bg-gray-200/60"
                onClick={() => !isPasswordModalVisible && setSelectedMethodId('huabei')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-[28px] h-[28px] rounded-full bg-[#1677FF] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[13px] font-bold">花</span>
                  </div>
                  <span className="text-[15px] text-[#333]">{s.huabei}</span>
                </div>
                {selectedMethodId === 'huabei' && <CheckIcon />}
              </button>
              <div className="h-px bg-gray-100 ml-[56px]" aria-hidden />
              {/* 余额宝 */}
              <button
                className="w-full flex items-center justify-between py-2.5 active:bg-gray-200/60"
                onClick={() => !isPasswordModalVisible && setSelectedMethodId('yuebao')}
              >
                <div className="flex items-center gap-3">
                  <div className="w-[28px] h-[28px] rounded-full bg-[#FF6E30] flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[13px] font-bold">余</span>
                  </div>
                  <span className="text-[15px] text-[#333]">{s.cashier_yuebao}</span>
                </div>
                {selectedMethodId === 'yuebao' && <CheckIcon />}
              </button>
              <div className="h-px bg-gray-100 ml-[56px]" aria-hidden />
              {/* Bank cards */}
              {boundCards.map((card, i) => (
                <React.Fragment key={card.id}>
                  <button
                    className="w-full flex items-center justify-between py-2.5 active:bg-gray-200/60"
                    onClick={() => !isPasswordModalVisible && setSelectedMethodId(card.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-[28px] h-[28px] rounded-full bg-[#00B578] flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[11px] font-bold">银</span>
                      </div>
                      <span className="text-[15px] text-[#333]">{localizeBankName(card.bankName, isEnglish)}({card.last4})</span>
<span className="text-[10px] text-[#FF6E30] bg-[#FFF0EB] rounded-full px-2 py-0.5 leading-tight">
                      {s.cashier_bank_discount}
                    </span>
                    </div>
                    {selectedMethodId === card.id && <CheckIcon />}
                  </button>
                  {i < boundCards.length - 1 && <div className="h-px bg-gray-100 ml-[56px]" aria-hidden />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Expand arrow */}
          <div className="flex justify-center py-1">
            <IcExpand size={18} className="text-[#CCC]" />
          </div>

          {/* Password dots (only visible when modal is open) */}
          {isPasswordModalVisible && (
            <div className="mt-5">
              <div className="flex gap-2 justify-center px-1">
                {[0, 1, 2, 3, 4, 5].map((index) => (
                  <div
                    key={index}
                    className={`flex-1 aspect-square max-h-[48px] rounded-lg border flex items-center justify-center bg-[#F8F8F8] ${
                      index === password.length && !error
                        ? 'border-[#1677FF]'
                        : 'border-gray-100'
                    }`}
                  >
                    {password.length > index && (
                      <div className="w-3 h-3 rounded-full bg-black" />
                    )}
                  </div>
                ))}
              </div>
              {/* Error message space */}
              <div className="h-6 mt-1 flex items-center justify-center">
                {error && <span className="text-[#FF3B30] text-sm animate-pulse">{s.incorrect_payment_password}</span>}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Area */}
        {!isPasswordModalVisible ? (
          <div className="flex-shrink-0 px-5 pb-5 pt-2">
            <button
              className="w-full py-3.5 rounded-full bg-[#1677FF] text-white font-medium text-[16px] active:bg-[#1266D9]"
              {...bindTap<HTMLButtonElement>('cashier.password.open')}
            >
              {s.confirm_pay}
            </button>
            <div className="text-[11px] text-[#CCC] text-center mt-3">
              {s.cashier_provider}
            </div>
          </div>
        ) : (
          <div
            className="bg-white border-t border-[#E0E0E0]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {[[1,2,3],[4,5,6],[7,8,9]].map((row, ri) => (
              <div key={ri} className="flex border-b border-[#E0E0E0]">
                {row.map((num, ci) => (
                  <button
                    key={num}
                    {...bindTap<HTMLButtonElement>(
                      { kind: 'action', id: 'cashierPassword.keypad.press' },
                      { params: { digit: String(num) }, onTrigger: () => handleNumberClick(num.toString()) },
                    )}
                    className={`flex-1 h-[52px] text-[22px] font-medium text-gray-900 active:bg-[#E8E8E8] ${ci < 2 ? 'border-r border-[#E0E0E0]' : ''}`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            ))}
            <div className="flex">
              <div className="flex-1 h-[52px] border-r border-[#E0E0E0]" />
              <button
                {...bindTap<HTMLButtonElement>(
                  { kind: 'action', id: 'cashierPassword.keypad.press' },
                  { params: { digit: '0' }, onTrigger: () => handleNumberClick('0') },
                )}
                className="flex-1 h-[52px] text-[22px] font-medium text-gray-900 active:bg-[#E8E8E8] border-r border-[#E0E0E0]"
              >
                0
              </button>
              <button
                {...bindTap<HTMLButtonElement>(
                  { kind: 'action', id: 'cashierPassword.keypad.delete' },
                  { onTrigger: handleDelete },
                )}
                className="flex-1 h-[52px] flex items-center justify-center text-gray-900 active:bg-[#E8E8E8]"
              >
                <IcDelete size={22} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
