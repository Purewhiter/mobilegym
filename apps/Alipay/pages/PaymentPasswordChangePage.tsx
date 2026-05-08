import React from 'react';
import { IcNavBack } from '../res/icons';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';

function maskPhone(phone: string): string {
  const p = String(phone || '').replace(/\s/g, '');
  return p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
}

function isSequentialDigits(v: string): boolean {
  const digits = String(v || '').replace(/\D/g, '');
  if (digits.length !== 6) return false;
  const nums = digits.split('').map((x) => Number(x));
  const asc = nums.every((n, i) => i === 0 || n - nums[i - 1] === 1);
  const desc = nums.every((n, i) => i === 0 || n - nums[i - 1] === -1);
  return asc || desc;
}

function isAllSameDigits(v: string): boolean {
  const digits = String(v || '').replace(/\D/g, '');
  return digits.length === 6 && digits.split('').every((d) => d === digits[0]);
}

function PasswordBoxes(props: { value: string; activeIndex: number }) {
  const digits = props.value.replace(/\D/g, '').slice(0, 6);
  const boxes = Array.from({ length: 6 }).map((_, idx) => digits[idx] || '');
  return (
    <div className="flex items-center gap-0 border border-[#BBD6FF] rounded-lg overflow-hidden">
      {boxes.map((v, idx) => (
        <div
          key={idx}
          className={`w-12 h-12 flex items-center justify-center text-lg font-medium bg-white ${
            idx === props.activeIndex ? 'ring-1 ring-app-primary ring-inset' : ''
          } ${idx === 0 ? '' : 'border-l border-[#D6E6FF]'}`}
        >
          {v ? '•' : ''}
        </div>
      ))}
    </div>
  );
}

type Step = 'choose' | 'verify' | 'set' | 'done' | 'forgot';

export const PaymentPasswordChangePage: React.FC = () => {
  const { back, bindBack } = useAlipayGestures();
  const s = useAlipayStrings();
  const userInfo = useAlipayStore(s => s.userInfo);
  const paymentPassword = useAlipayStore(s => s.userInfo.paymentPassword);
  const setPaymentPassword = useAlipayStore(s => s.setPaymentPassword);
  const accountText = maskPhone(userInfo?.phone || '13800000000');
  const currentPwd = String(paymentPassword);

  const [step, setStep] = React.useState<Step>('choose');
  const [verifyPwd, setVerifyPwd] = React.useState('');
  const [newPwd, setNewPwd] = React.useState('');
  const [error, setError] = React.useState('');
  const [toast, setToast] = React.useState<string | null>(null);
  const verifyInputRef = React.useRef<HTMLInputElement | null>(null);
  const newInputRef = React.useRef<HTMLInputElement | null>(null);

  const showToast = (t: string) => {
    setToast(t);
    window.setTimeout(() => setToast(null), 1200);
  };

  React.useEffect(() => {
    if (verifyPwd.replace(/\D/g, '').length !== 6) return;
    const v = verifyPwd.replace(/\D/g, '').slice(0, 6);
    if (v !== currentPwd) {
      setError(s.payment_password_change_wrong_password);
      setVerifyPwd('');
      return;
    }
    setError('');
    setVerifyPwd('');
    setStep('set');
  }, [verifyPwd, currentPwd]);

  React.useEffect(() => {
    if (newPwd.replace(/\D/g, '').length !== 6) return;
    const v = newPwd.replace(/\D/g, '').slice(0, 6);
    if (v === currentPwd) {
      setError(s.payment_password_change_same_password);
      setNewPwd('');
      return;
    }
    if (isAllSameDigits(v) || isSequentialDigits(v)) {
      setError(s.payment_password_change_invalid_password);
      setNewPwd('');
      return;
    }
    setError('');
    setPaymentPassword(currentPwd, v);
    setStep('done');
    window.setTimeout(() => back(), 800);
  }, [newPwd, currentPwd, back, setPaymentPassword]);

  const renderBody = () => {
    if (step === 'choose') {
      return (
        <div className="flex-1 flex flex-col items-center justify-start px-6 pt-12">
          <div className="text-sm text-gray-400">{s.payment_password_change_remember_account}</div>
          <div className="mt-2 text-xl font-medium text-gray-800">{accountText}</div>
          <div className="mt-2 text-sm text-gray-400">{s.payment_password_change_current_password}</div>

          <div className="mt-8 w-full flex items-center gap-4">
            <button
              className="flex-1 h-11 rounded-lg bg-white border border-gray-200 text-gray-700 font-medium active:bg-gray-50"
              onClick={() => setStep('forgot')}
            >
              {s.payment_password_change_forgot}
            </button>
            <button
              className="flex-1 h-11 rounded-lg bg-app-primary text-white font-medium active:bg-app-primary/90"
              onClick={() => setStep('verify')}
            >
              {s.payment_password_change_remember}
            </button>
          </div>
        </div>
      );
    }

    if (step === 'forgot') {
      return (
        <div className="flex-1 flex flex-col items-center justify-start px-6 pt-12">
          <div className="text-2xl font-medium text-gray-900">{s.payment_password_change_title}</div>
          <div className="mt-3 text-sm text-gray-400 text-center">{s.payment_password_change_forgot_hint}</div>
          <button
            className="mt-8 w-full h-11 rounded-lg bg-app-primary text-white font-medium active:bg-app-primary/90"
            onClick={() => setStep('choose')}
          >
            {s.payment_password_change_back}
          </button>
        </div>
      );
    }

    if (step === 'verify') {
      const digits = verifyPwd.replace(/\D/g, '').slice(0, 6);
      return (
        <div className="flex-1 flex flex-col items-center px-6 pt-10">
          <div className="text-3xl font-medium text-gray-900">{s.payment_password_change_verify_title}</div>
          <div className="mt-3 text-sm text-gray-400">{s.payment_password_change_verify_hint}</div>

          <div className="mt-8 relative">
            <input
              ref={verifyInputRef}
              value={verifyPwd}
              onChange={(e) => setVerifyPwd(e.target.value.replace(/\D/g, '').slice(0, 6))}
              type="tel"
              inputMode="numeric"
              autoFocus
              className="absolute inset-0 opacity-0"
              style={{ caretColor: 'transparent' }}
            />
            <PasswordBoxes value={digits} activeIndex={Math.min(digits.length, 5)} />
          </div>

          {error ? <div className="mt-4 text-sm text-[#FF3B30]">{error}</div> : null}
        </div>
      );
    }

    if (step === 'set') {
      const digits = newPwd.replace(/\D/g, '').slice(0, 6);
      return (
        <div className="flex-1 flex flex-col items-center px-6 pt-10">
          <div className="text-3xl font-medium text-gray-900">{s.payment_password_change_set_title}</div>
          <div className="mt-3 text-sm text-gray-400">{s.payment_password_change_set_hint}</div>

          <div className="mt-8 relative">
            <input
              ref={newInputRef}
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value.replace(/\D/g, '').slice(0, 6))}
              type="tel"
              inputMode="numeric"
              autoFocus
              className="absolute inset-0 opacity-0"
              style={{ caretColor: 'transparent' }}
            />
            <PasswordBoxes value={digits} activeIndex={Math.min(digits.length, 5)} />
          </div>

          {error ? <div className="mt-4 text-sm text-[#FF3B30]">{error}</div> : null}
        </div>
      );
    }

    if (step === 'done') {
      return (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="text-5xl">✓</div>
          <div className="mt-4 text-xl font-medium text-gray-900">{s.payment_password_change_done}</div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-bg z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-app-bg px-4 pt-4 pb-3 flex items-center">
        <button {...bindBack()} className="p-1 -ml-1 active:opacity-70">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
      </div>

      {renderBody()}

      {toast ? (
        <div className="fixed left-0 right-0 bottom-8 flex justify-center pointer-events-none">
          <div className="bg-black/70 text-white text-sm px-4 py-2 rounded-full">{toast}</div>
        </div>
      ) : null}
    </div>
  );
};
