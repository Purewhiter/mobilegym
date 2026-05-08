import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcNavBack, IcNavForward, IcLab } from '../res/icons';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
type Row = {
  id: string;
  label: string;
  rightText?: string;
  rightIcon?: React.ReactNode;
};

export const PaymentSettingsPage: React.FC = () => {
  const s = useAlipayStrings();
  const { bindTap, bindBack, go } = useAlipayGestures();

  const groups: Row[][] = [
    [
      { id: 'payOrder', label: s.payment_order },
      { id: 'benefits', label: s.benefits_usage },
    ],
    [
      { id: 'autoPay', label: s.auto_renew_no_password },
      { id: 'fastPay', label: s.quick_pay },
    ],
    [
      { id: 'payPassword', label: s.payment_password },
      { id: 'biometric', label: s.biometric_payment, rightText: s.face_id },
    ],
    [
      { id: 'tapPay', label: s.tap_to_pay_2, rightText: s.try_new_payment_methods },
      { id: 'devices', label: s.smart_devices, rightText: s.watch_band_smart_card_etc },
      { id: 'facePay', label: s.face_payment_in_stores },
    ],
    [{ id: 'payManager', label: s.payment_manager }],
    [{ id: 'lab', label: s.payment_lab, rightIcon: <IcLab size={16} className="text-app-primary" /> }],
  ];

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-surface z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-app-surface px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
        <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-800">{s.payment_settings}</span>
        <div className="w-6" />
      </div>

      <div className="flex-1 overflow-auto no-scrollbar px-4 py-3 space-y-3">
        {groups.map((rows, gi) => (
          <div key={gi} className="bg-app-surface rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between px-4 py-4 active:bg-gray-50"
                {...(row.id === 'payOrder'
                  ? bindTap<HTMLDivElement>('settings.payment.order.open')
                  : row.id === 'fastPay'
                    ? bindTap<HTMLDivElement>('settings.payment.fastPay.open')
                    : row.id === 'payPassword'
                    ? { onClick: () => go('settings.payment.password.open') }
                    : row.id === 'autoPay'
                        ? { onClick: () => go('settings.payment.subscriptions.open') }
                        : {})}
              >
                <span className="text-sm font-medium text-gray-800">{row.label}</span>
                <div className="flex items-center text-xs text-gray-400">
                  {row.rightText && <span className="mr-2 truncate max-w-[180px]">{row.rightText}</span>}
                  {row.rightIcon && <span className="mr-2">{row.rightIcon}</span>}
                  <IcNavForward size={16} className="text-gray-300" />
                </div>
              </div>
            ))}
          </div>
        ))}
        <div className="h-10" />
      </div>
    </div>
  );
};
