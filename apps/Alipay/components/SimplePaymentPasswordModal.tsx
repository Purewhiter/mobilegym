import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React, { useEffect, useRef, useState } from 'react';
import { IcDelete, IcClose } from '../res/icons';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
interface SimplePaymentPasswordModalProps {
  visible: boolean;
  expectedPassword?: string;
  onSuccess: () => void;
}

export const SimplePaymentPasswordModal: React.FC<SimplePaymentPasswordModalProps> = ({
  visible,
  expectedPassword = '000000',
  onSuccess,
}) => {
  const s = useAlipayStrings();
  const { bindTap, bindBack } = useAlipayGestures();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const calledRef = useRef(false);

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
  }, [password, expectedPassword, error, onSuccess]);

  const handleNumberClick = (num: string) => {
    if (password.length < 6) setPassword((prev) => prev + num);
  };

  const handleDelete = () => {
    setPassword((prev) => prev.slice(0, -1));
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 flex flex-col justify-end">
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-[380px] bg-app-surface rounded-2xl shadow-xl relative">
          <button {...bindBack<HTMLButtonElement>({ stopPropagation: true })} className="absolute left-4 top-4 text-gray-300">
            <IcClose size={20} />
          </button>
          <div className="pt-10 pb-6 px-6 text-center">
            <div className="text-lg font-medium text-gray-900">{s.enter_payment_password}</div>
            <div className="h-6 mt-2 text-sm">
              {error ? <span className="text-[#FF3B30]">{s.incorrect_payment_password}</span> : <span className="text-transparent">{s.placeholder}</span>}
            </div>
            <div className="flex justify-center gap-0 mt-2">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div key={index} className="w-12 h-12 border border-app-border flex items-center justify-center first:rounded-l-lg last:rounded-r-lg">
                  {password.length > index && <div className="w-2.5 h-2.5 rounded-full bg-black" />}
                </div>
              ))}
            </div>
            <button className="mt-5 text-app-primary text-base">{s.forgot_password_2}</button>
          </div>
        </div>
      </div>

      <div className="bg-app-surface">
        <div className="grid grid-cols-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              {...bindTap<HTMLButtonElement>(
                { kind: 'action', id: 'fastPayPassword.keypad.press' },
                { params: { digit: String(num) }, onTrigger: () => handleNumberClick(String(num)) },
              )}
              className="h-20 flex items-center justify-center text-2xl text-gray-900 active:bg-gray-100 border-t border-gray-100 border-r border-gray-100 nth-[3n]:border-r-0"
            >
              {num}
            </button>
          ))}
          <div className="h-20 border-t border-gray-100 border-r border-gray-100"></div>
          <button
            {...bindTap<HTMLButtonElement>(
              { kind: 'action', id: 'fastPayPassword.keypad.press' },
              { params: { digit: '0' }, onTrigger: () => handleNumberClick('0') },
            )}
            className="h-20 flex items-center justify-center text-2xl text-gray-900 active:bg-gray-100 border-t border-gray-100 border-r border-gray-100"
          >
            0
          </button>
          <button
            {...bindTap<HTMLButtonElement>(
              { kind: 'action', id: 'fastPayPassword.keypad.delete' },
              { onTrigger: handleDelete },
            )}
            className="h-20 flex items-center justify-center text-gray-900 active:bg-gray-100 border-t border-gray-100"
          >
            <div className="w-12 h-8 rounded-lg border border-gray-300 flex items-center justify-center">
              <IcDelete size={18} className="text-gray-700" />
            </div>
          </button>
        </div>
        <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
      </div>
    </div>
  );
};

