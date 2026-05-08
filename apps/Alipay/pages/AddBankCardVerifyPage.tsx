import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcNavBack, IcBuilding, IcHeadphone, IcSettings, IcCheckCircle, IcCard, IcContacts } from '../res/icons';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useAlipayStore } from '../state';
import SmsGateway from '../../../os/SmsGateway';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import type { AlipayBankCard } from '../types';
import { useLocale } from '@/apps/Alipay/locale';
import { localizeBankName } from '../utils/localizeBankName';

function maskPhone(phone: string): string {
  const p = String(phone || '').replace(/\s/g, '');
  return p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

function extractLast4(cardNumber: string): string {
  const digits = String(cardNumber || '').replace(/\D/g, '');
  return digits.slice(-4) || '0000';
}

function maskCardNumber(input: string): string {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 8) return `${digits.slice(0, 2)}**${digits.slice(-2)}`;
  const head = digits.slice(0, 4);
  const tail = digits.slice(-4);
  return `${head}${'*'.repeat(Math.max(0, digits.length - 8))}${tail}`;
}

function generate19Digits(bankName: string): string {
  const prefixMap: Record<string, string> = {
    中国农业银行: '622848',
    中国工商银行: '622200',
    工商银行: '622200',
    农业银行: '622848',
  };
  const prefix = Object.entries(prefixMap).find(([k]) => bankName.includes(k))?.[1] || '622848';
  const digits = '0123456789';
  let mid = '';
  for (let i = 0; i < 9; i++) mid += digits[Math.floor(Math.random() * 10)];
  let last4 = '';
  for (let i = 0; i < 4; i++) last4 += digits[Math.floor(Math.random() * 10)];
  return `${prefix}${mid}${last4}`;
}

const RECHARGE_RETURN_PATH = '/balance/recharge';
const MULTI_RECHARGE_RETURN_PATH = '/balance/recharge?modal=multi';

export const AddBankCardVerifyPage: React.FC = () => {
  const { bindBack, go, back } = useAlipayGestures();
  const s = useAlipayStrings();
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const [searchParams] = useSearchParams();
  const { userInfo, addBankCard } = useAlipayStore();
  const [showExitDialog, setShowExitDialog] = React.useState(false);
  const [addedCard, setAddedCard] = React.useState<AlipayBankCard | null>(null);

  const bankName = searchParams.get('bankName') || '银行卡';
  const displayBankName = localizeBankName(bankName, isEnglish);
  const rawCardNumber = searchParams.get('cardNumber') || '';
  const returnTo = searchParams.get('returnTo');
  const resolvedCardNumber = React.useMemo(() => {
    const digits = String(rawCardNumber || '').replace(/\D/g, '');
    if (digits.length === 19) return digits;
    if (digits.length > 19) return digits.slice(0, 19);
    return generate19Digits(bankName);
  }, [rawCardNumber, bankName]);
  const last4 = extractLast4(resolvedCardNumber);

  const [code, setCode] = React.useState('');
  const [counter, setCounter] = React.useState(54);
  const [expectedCode, setExpectedCode] = React.useState<string | null>(null);
  const [error, setError] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const hasSentRef = React.useRef(false);
  const completedRef = React.useRef(false);

  const sendCode = React.useCallback(() => {
    const { code } = SmsGateway.sendVerificationCode({
      from: bankName,
      codeLength: 6,
      template: '【{app}】验证码：{code}，5分钟内有效',
    });
    setExpectedCode(code);
    setCounter(54);
  }, [bankName]);

  React.useEffect(() => {
    const t = window.setInterval(() => {
      setCounter((v) => (v > 0 ? v - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  React.useEffect(() => {
    if (hasSentRef.current) return;
    hasSentRef.current = true;
    sendCode();
  }, [sendCode]);

  React.useEffect(() => {
    if (completedRef.current) return;
    if (code.length !== 6) return;
    if (!expectedCode) return;
    if (code !== expectedCode) {
      setError(s.add_bank_card_verify_invalid_code);
      setCode('');
      return;
    }
    setError('');
    completedRef.current = true;
    const card = addBankCard({
      bankName: bankName.includes('银行') ? `${bankName}储蓄卡` : `${bankName}储蓄卡`,
      cardNumber: resolvedCardNumber,
      bound: true,
      available: returnTo && returnTo.includes('/balance/recharge') ? 50000 : 1000,
    });
    setAddedCard(card);
  }, [code, expectedCode, addBankCard, bankName, resolvedCardNumber, returnTo, go]);

  const handleDone = () => {
    if (returnTo === MULTI_RECHARGE_RETURN_PATH) {
      go('bankCards.add.verify.doneReturnMulti', {}, { popTo: MULTI_RECHARGE_RETURN_PATH });
      return;
    }
    if (returnTo === RECHARGE_RETURN_PATH) {
      go('bankCards.add.verify.doneReturnRecharge', {}, { popTo: RECHARGE_RETURN_PATH });
      return;
    }
    go('bankCards.add.verify.done', {}, {
      popTo: ['/settings/payment/bank-cards', '/bank-cards'],
    });
  };

  if (addedCard) {
    const cardLabel = `${localizeBankName(addedCard.bankName, isEnglish)}(${addedCard.last4})`;
    return (
      <div className="bg-app-bg h-full w-full flex flex-col pt-10">
        <div className="px-4 py-3 flex items-center justify-end flex-shrink-0">
          <button onClick={handleDone} className="text-sm text-gray-900 active:opacity-70">{s.add_bank_card_verify_done}</button>
        </div>

        <div className="flex flex-col items-center px-6 pt-8 pb-10">
          <div className="w-16 h-16 rounded-full bg-app-primary flex items-center justify-center mb-4">
            <IcCheckCircle size={40} className="text-white" />
          </div>
          <div className="text-xl font-medium text-gray-900 mb-2">{s.add_bank_card_verify_success}</div>
          <div className="text-sm text-gray-500 text-center">{s.add_bank_card_verify_success_hint.replace('{cardLabel}', cardLabel)}</div>
        </div>

        <div className="mx-4 bg-white rounded-2xl p-4 space-y-4">
          <div className="text-sm font-medium text-gray-900">{s.add_bank_card_verify_easier}</div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <IcContacts size={20} className="text-app-primary" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">{s.add_bank_card_verify_share_card}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.add_bank_card_verify_share_hint}</div>
              </div>
            </div>
            <button className="text-xs px-3 py-1.5 rounded-full bg-app-primary text-white flex-shrink-0 ml-3">{s.add_bank_card_verify_explore}</button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
                <IcCard size={20} className="text-orange-500" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900">{s.add_bank_card_verify_manage_cards}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.add_bank_card_verify_manage_hint}</div>
              </div>
            </div>
            <button className="text-xs px-3 py-1.5 rounded-full bg-app-primary text-white flex-shrink-0 ml-3">{s.add_bank_card_verify_manage}</button>
          </div>
        </div>
      </div>
    );
  }

  const codeDigits = code.replace(/\D/g, '').slice(0, 6);
  const boxes = Array.from({ length: 6 }).map((_, idx) => codeDigits[idx] || '');

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-bg z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-app-bg px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={() => setShowExitDialog(true)} className="p-1 -ml-1 active:opacity-70">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-900">{s.add_bank_card_verify_title}</span>
        <div className="flex items-center gap-1">
          <button className="p-2 -mr-1 active:opacity-70" onClick={() => { }}>
            <IcHeadphone size={18} className="text-gray-700" />
          </button>
          <button className="p-2 -mr-2 active:opacity-70" onClick={() => { }}>
            <IcSettings size={18} className="text-gray-700" />
          </button>
        </div>
      </div>

      <div className="px-4">
        <div className="bg-app-surface rounded-2xl p-4 shadow-sm">
          <div className="text-sm font-medium text-gray-900">{s.add_bank_card_verify_add_card.replace('{name}', displayBankName)}</div>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-8 h-8 rounded-full bg-[#EAF2FF] flex items-center justify-center flex-shrink-0">
              <IcBuilding size={16} className="text-app-primary" />
            </div>
            <span className="text-xs text-gray-500">{s.add_bank_card_verify_debit_card.replace('{masked}', maskCardNumber(resolvedCardNumber))}</span>
          </div>
        </div>

        <div className="mt-4 bg-app-surface rounded-2xl p-4 shadow-sm">
          <div className="text-xs text-black font-semibold">
            {s.add_bank_card_verify_sent_sms.replace('{phone}', maskPhone(userInfo?.phone || '18200002221'))}
          </div>

          <div className="mt-5 relative w-[288px] max-w-full">
            <input
              ref={inputRef}
              value={code}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(digits);
              }}
              type="tel"
              inputMode="numeric"
              autoFocus
              className="absolute inset-0 opacity-0"
              style={{ caretColor: 'transparent' }}
            />
            <div className="border border-[#BBD6FF] rounded-lg overflow-hidden bg-white">
              <div className="flex items-center">
                {boxes.map((v, idx) => (
                  <div
                    key={idx}
                    className={`w-12 h-12 flex items-center justify-center text-lg font-medium ${idx === Math.min(codeDigits.length, 5) ? 'ring-1 ring-app-primary ring-inset' : ''
                      } ${idx === 0 ? '' : 'border-l border-[#D6E6FF]'}`}
                  >
                    {v ? '•' : ''}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center text-xs text-gray-400">
            <button
              className={`active:opacity-70 ${counter > 0 ? 'text-gray-400' : 'text-app-primary'}`}
              disabled={counter > 0}
              onClick={() => sendCode()}
            >
              {counter > 0 ? s.add_bank_card_verify_resend.replace('{seconds}', String(counter)) : s.add_bank_card_verify_resend_idle}
            </button>
          </div>

          {error ? <div className="mt-3 text-sm text-[#FF3B30]">{error}</div> : null}
        </div>
      </div>

      {showExitDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-10" onClick={() => setShowExitDialog(false)}>
          <div className="bg-white rounded-2xl w-full max-w-[300px] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-4">
              <div className="text-center text-base font-medium text-gray-900 mb-3">{s.add_bank_card_verify_hint_title}</div>
              <div className="text-sm text-gray-600 leading-relaxed">{s.add_bank_card_verify_slow_sms}</div>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                className="flex-1 py-3 text-sm text-gray-600 active:bg-gray-50 border-r border-gray-100"
                onClick={() => { setShowExitDialog(false); back(); }}
              >
                {s.add_bank_card_verify_exit}
              </button>
              <button
                className="flex-1 py-3 text-sm text-app-primary font-medium active:bg-blue-50"
                onClick={() => setShowExitDialog(false)}
              >
                {s.add_bank_card_verify_continue}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
