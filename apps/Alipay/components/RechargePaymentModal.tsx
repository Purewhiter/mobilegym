import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React, { useEffect, useRef, useState } from 'react';
import { IcDelete, IcClose } from '../res/icons';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { AlipayBankCard } from '../types';
import { useLocale } from '@/apps/Alipay/locale';

interface RechargePaymentModalProps {
  visible: boolean;
  amount: string;
  card?: AlipayBankCard;
  expectedPassword: string;
  actionVariant?: 'single' | 'multi';
  onSuccess: () => void;
  onClose: () => void;
}

export const RechargePaymentModal: React.FC<RechargePaymentModalProps> = ({
  visible,
  expectedPassword,
  actionVariant = 'single',
  onSuccess,
  onClose,
}) => {
  const s = useAlipayStrings();
  const { bindTap, bindBack } = useAlipayGestures();
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const calledRef = useRef(false);
  const fingerprintText = isEnglish ? 'Use Fingerprint' : '使用指纹';

  useEffect(() => {
    if (visible) {
      setPassword('');
      setError(false);
      calledRef.current = false;
    }
  }, [visible]);

  useEffect(() => {
    if (password.length === 6) {
      if (calledRef.current) return;
      if (password === expectedPassword) {
        calledRef.current = true;
        setTimeout(() => {
          onSuccess();
        }, 200);
      } else {
        setError(true);
        setPassword('');
      }
    } else {
      if (error && password.length > 0) setError(false);
    }
  }, [password, expectedPassword, onSuccess, error]);

  const handleNumberClick = (num: string) => {
    if (password.length < 6) setPassword((prev) => prev + num);
  };

  const handleDelete = () => {
    setPassword((prev) => prev.slice(0, -1));
  };

  const bindPressAction = (digit: string) => (
    actionVariant === 'multi'
      ? bindTap<HTMLButtonElement>(
          { kind: 'action', id: 'rechargeMultiPassword.keypad.press' },
          { params: { digit }, onTrigger: () => handleNumberClick(digit) },
        )
      : bindTap<HTMLButtonElement>(
          { kind: 'action', id: 'rechargePassword.keypad.press' },
          { params: { digit }, onTrigger: () => handleNumberClick(digit) },
        )
  );

  const bindDeleteAction = () => (
    actionVariant === 'multi'
      ? bindTap<HTMLButtonElement>(
          { kind: 'action', id: 'rechargeMultiPassword.keypad.delete' },
          { onTrigger: handleDelete },
        )
      : bindTap<HTMLButtonElement>(
          { kind: 'action', id: 'rechargePassword.keypad.delete' },
          { onTrigger: handleDelete },
        )
  );

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 flex flex-col justify-end">
      <div className="flex-1 flex items-center justify-center px-6" onClick={onClose}>
        <div className="w-full max-w-[380px] bg-app-surface rounded-2xl shadow-xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="relative border-b border-gray-100 p-4 text-center bg-white">
            <button {...bindBack<HTMLButtonElement>({ stopPropagation: true })} onClick={onClose} className="absolute left-4 top-4 text-gray-400">
              <IcClose size={24} />
            </button>
            <span className="text-lg font-medium text-gray-900">{s.enter_payment_password}</span>
            <span className="absolute right-4 top-4.5 text-sm text-app-primary">{fingerprintText}</span>
          </div>

          <div className="pt-6 pb-6 px-6 text-center bg-white">
            <div className="flex justify-center gap-2 mb-4">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div key={index} className="w-12 h-12 border border-gray-200 rounded-lg bg-white flex items-center justify-center">
                  {password.length > index && <div className="w-3 h-3 rounded-full bg-black" />}
                </div>
              ))}
            </div>
            
            <div className="h-6">
                {error && <div className="text-[#FF3B30] text-sm mb-2">{s.incorrect_payment_password}</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white">
        <div className="grid grid-cols-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              {...bindPressAction(String(num))}
              className="h-14 flex items-center justify-center text-2xl font-medium text-gray-900 active:bg-gray-100 bg-white border-t border-gray-100 border-r border-gray-100 nth-[3n]:border-r-0"
            >
              {num}
            </button>
          ))}
          <div className="h-14 bg-white border-t border-gray-100 border-r border-gray-100" />
          <button
            {...bindPressAction('0')}
            className="h-14 flex items-center justify-center text-2xl font-medium text-gray-900 active:bg-gray-100 bg-white border-t border-gray-100 border-r border-gray-100"
          >
            0
          </button>
          <button
            {...bindDeleteAction()}
            className="h-14 flex items-center justify-center text-gray-900 active:bg-gray-100 bg-white border-t border-gray-100"
          >
            <IcDelete size={24} />
          </button>
        </div>
        <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} className="bg-white" />
      </div>
    </div>
  );
};
