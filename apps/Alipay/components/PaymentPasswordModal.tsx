import React, { useState, useEffect, useRef } from 'react';
import { IcClose, IcDelete, IcWallet, IcBuilding, IcNavBack, IcCheck, IcNavForward, IcExpand, IcCollapse } from '../res/icons';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useLocale } from '@/apps/Alipay/locale';
import { localizeBankName } from '../utils/localizeBankName';

interface BankCardInfo {
  id: string;
  bankName: string;
  last4: string;
  bound: boolean;
  available: number;
}

interface PaymentPasswordModalProps {
  visible: boolean;
  variant?: 'transfer' | 'cashier';
  amount: string;
  payeeName: string;
  expectedPassword?: string;
  onSuccess: (methodId: string) => void;
  bankCards?: BankCardInfo[];
  balance?: { total: number };
  defaultMethodId?: string;
  actionPrefix?: string;
  maskedPhone?: string;
  subject?: string;
}

export const PaymentPasswordModal: React.FC<PaymentPasswordModalProps> = ({
  visible,
  variant = 'transfer',
  amount,
  payeeName,
  expectedPassword = '000000',
  onSuccess,
  bankCards = [],
  balance,
  defaultMethodId,
  actionPrefix = 'transferPassword',
  maskedPhone = '',
  subject = '',
}) => {
  const s = useAlipayStrings();
  const { bindTap, bindBack } = useAlipayGestures();
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const calledRef = useRef(false);
  const [selectedMethodId, setSelectedMethodId] = useState<string>('balance');
  const [expanded, setExpanded] = useState(false);

  const boundCards = bankCards.filter(c => c.bound);

  useEffect(() => {
    if (visible) {
      setPassword('');
      setError(false);
      calledRef.current = false;
      setExpanded(false);
      // 每次进入弹窗都重新选付款方式并输密码，避免沿用上次的银行卡导致「不用再选卡、像没走密码」的体验
      setSelectedMethodId(defaultMethodId ?? 'balance');
    } else {
      setPassword('');
      calledRef.current = false;
    }
  }, [visible, defaultMethodId]);

  useEffect(() => {
    if (!visible) return;
    if (password.length === 6) {
      if (calledRef.current) return;
      if (password === expectedPassword) {
        calledRef.current = true;
        setTimeout(() => {
          onSuccess(selectedMethodId);
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
  }, [visible, password, expectedPassword, onSuccess, selectedMethodId, error]);

  const handleNumberClick = (num: string) => {
    if (password.length < 6) {
      setPassword(prev => prev + num);
    }
  };

  const handleDelete = () => {
    setPassword(prev => prev.slice(0, -1));
  };

  const handleSelectMethod = (id: string) => {
    setSelectedMethodId(id);
  };

  const handleConfirmExpanded = () => {
    setExpanded(false);
  };

  if (!visible) return null;

  const CheckIcon = ({ size = 16 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1677FF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  const Keypad = () => (
    <div className="bg-[#D2D5DB] p-[5px] grid grid-cols-3 gap-[5px]">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
        <button
          key={num}
          {...bindTap<HTMLButtonElement>(
            { kind: 'action', id: `${actionPrefix}.keypad.press` },
            { params: { digit: String(num) }, onTrigger: () => handleNumberClick(num.toString()) },
          )}
          className="bg-white rounded h-[52px] text-[22px] font-medium text-gray-900 active:bg-gray-200"
        >
          {num}
        </button>
      ))}
      <div />
      <button
        {...bindTap<HTMLButtonElement>(
          { kind: 'action', id: `${actionPrefix}.keypad.press` },
          { params: { digit: '0' }, onTrigger: () => handleNumberClick('0') },
        )}
        className="bg-white rounded h-[52px] text-[22px] font-medium text-gray-900 active:bg-gray-200"
      >
        0
      </button>
      <button
        {...bindTap<HTMLButtonElement>(
          { kind: 'action', id: `${actionPrefix}.keypad.delete` },
          { onTrigger: handleDelete },
        )}
        className="bg-white rounded h-[52px] flex items-center justify-center text-gray-900 active:bg-gray-200"
      >
        <IcDelete size={22} />
      </button>
    </div>
  );

  const PasswordDots = () => (
    <div className="flex gap-2 justify-center">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div
          key={index}
          className={`w-11 h-11 rounded-lg border flex items-center justify-center bg-white ${
            index === password.length && !error ? 'border-[#1677FF]' : 'border-gray-200'
          }`}
        >
          {password.length > index && (
            <div className="w-3 h-3 rounded-full bg-black" />
          )}
        </div>
      ))}
    </div>
  );

  // ═══════════════════════════════════════════════════
  // Transfer variant: bottom-sheet (original design)
  // ═══════════════════════════════════════════════════

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-[430px] bg-app-bg rounded-t-xl overflow-hidden animate-in slide-in-from-bottom duration-300 flex flex-col max-h-[92%]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* Header */}
        <div className="relative bg-app-surface border-b border-gray-100 p-4 text-center flex-shrink-0">
          <button {...bindBack<HTMLButtonElement>({ stopPropagation: true })} className="absolute left-4 top-4 text-gray-400">
            <IcClose size={24} />
          </button>
          <span className="text-lg font-medium text-gray-900">{s.enter_payment_password}</span>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="bg-app-surface px-6 pt-6 pb-4 flex flex-col items-center border-b border-gray-100">
            <div className="text-sm text-gray-500 mb-2">{s.transfer_to_payee.replace('{payeeName}', payeeName)}</div>
            <div className="text-4xl font-bold text-gray-900 mb-4">¥{amount}</div>

            {/* Payment method selector — in-place expand/collapse */}
            <div className="w-full bg-gray-50 rounded-lg overflow-hidden mb-4">
              {/* Balance */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100"
                onClick={() => handleSelectMethod('balance')}
              >
                <div className="flex items-center gap-2.5">
                  <IcWallet className="text-app-primary" size={18} />
                  <span className="text-gray-900 text-sm">{s.account_balance}</span>
                </div>
                {selectedMethodId === 'balance' && <CheckIcon size={16} />}
              </button>

              {expanded ? (
                <>
                  {/* All bound bank cards */}
                  {boundCards.length > 0 && (
                    <>
                      <div className="px-4 pt-3 pb-1 text-xs text-gray-400">{s.payment_password_modal_bank_cards}</div>
                      {boundCards.map((card) => (
                        <button
                          key={card.id}
                          className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100"
                          onClick={() => handleSelectMethod(card.id)}
                        >
                          <div className="flex items-center gap-2.5">
                            <IcBuilding className="text-app-primary" size={18} />
                            <span className="text-gray-900 text-sm">{localizeBankName(card.bankName, isEnglish)} {s.payment_password_modal_debit_card} {isEnglish ? `(${card.last4})` : `（${card.last4}）`}</span>
                          </div>
                          {selectedMethodId === card.id && <CheckIcon size={16} />}
                        </button>
                      ))}
                    </>
                  )}

                  {/* Credit */}
                  <div className="px-4 pt-3 pb-1 text-xs text-gray-400">{s.payment_password_modal_credit}</div>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2.5">
                      <IcWallet className="text-app-primary" size={18} />
                      <div className="text-left">
                        <div className="text-gray-900 text-sm">{s.payment_password_modal_mybank_loan}</div>
                        <div className="text-xs text-gray-400">{s.payment_password_modal_available_after_open}</div>
                      </div>
                    </div>
                  </div>

                  {/* Unavailable */}
                  <div className="px-4 pt-3 pb-1 text-xs text-gray-400">{s.payment_password_modal_unavailable_methods}</div>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 opacity-50">
                    <div className="flex items-center gap-2.5">
                      <IcWallet className="text-gray-400" size={18} />
                      <span className="text-gray-400 text-sm">{s.huabei}</span>
                    </div>
                  </div>

                  {/* Collapse button */}
                  <button
                    className="w-full flex items-center justify-center py-2"
                    onClick={() => setExpanded(false)}
                  >
                    <IcCollapse className="text-gray-400" size={18} />
                  </button>
                </>
              ) : (
                <>
                  {/* First bound card (compact) */}
                  {boundCards.length > 0 && (
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100"
                      onClick={() => handleSelectMethod(boundCards[0].id)}
                    >
                      <div className="flex items-center gap-2.5">
                        <IcBuilding className="text-app-primary" size={18} />
                        <span className="text-gray-900 text-sm">{localizeBankName(boundCards[0].bankName, isEnglish)} {isEnglish ? `(${boundCards[0].last4})` : `（${boundCards[0].last4}）`}</span>
                      </div>
                      {selectedMethodId === boundCards[0].id && <CheckIcon size={16} />}
                    </button>
                  )}

                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-2.5">
                      <IcWallet className="text-gray-400" size={18} />
                      <span className="text-gray-500 text-sm">{s.payment_password_modal_add_bank_card}</span>
                    </div>
                    <IcNavForward className="text-gray-400" size={14} />
                  </div>

                  {/* Expand button */}
                  <button
                    className="w-full flex items-center justify-center py-2"
                    onClick={() => setExpanded(true)}
                  >
                    <IcExpand className="text-gray-400" size={18} />
                  </button>
                </>
              )}
            </div>

            {/* Error + password dots */}
            <div className="h-6 mb-2">
              {error && <div className="text-[#FF3B30] text-sm animate-pulse">{s.incorrect_payment_password}</div>}
            </div>

            <div className="flex gap-2 mb-4">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div
                  key={index}
                  className="w-12 h-12 rounded-lg border border-gray-300 bg-app-surface flex items-center justify-center"
                >
                  {password.length > index && (
                    <div className="w-3 h-3 rounded-full bg-black" />
                  )}
                </div>
              ))}
            </div>

            {error && (
              <button className="text-app-primary text-sm font-medium mt-2">{s.forgot_password}</button>
            )}
          </div>
        </div>

        {/* Keypad — always visible, pinned at bottom */}
        <div className="bg-[#D2D5DB] p-1.5 grid grid-cols-3 gap-1.5 flex-shrink-0">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              {...bindTap<HTMLButtonElement>(
                { kind: 'action', id: `${actionPrefix}.keypad.press` },
                { params: { digit: String(num) }, onTrigger: () => handleNumberClick(num.toString()) },
              )}
              className="bg-app-surface rounded h-14 text-2xl font-medium text-gray-900 active:bg-gray-200 shadow-sm"
            >
              {num}
            </button>
          ))}
          <div className="bg-[#D2D5DB]"></div>
          <button
            {...bindTap<HTMLButtonElement>(
              { kind: 'action', id: `${actionPrefix}.keypad.press` },
              { params: { digit: '0' }, onTrigger: () => handleNumberClick('0') },
            )}
            className="bg-app-surface rounded h-14 text-2xl font-medium text-gray-900 active:bg-gray-200 shadow-sm"
          >
            0
          </button>
          <button
            {...bindTap<HTMLButtonElement>(
              { kind: 'action', id: `${actionPrefix}.keypad.delete` },
              { onTrigger: handleDelete },
            )}
            className="bg-app-surface rounded h-14 flex items-center justify-center text-gray-900 active:bg-gray-200 shadow-sm"
          >
            <IcDelete size={24} />
          </button>
        </div>
      </div>
    </div>
  );
};
