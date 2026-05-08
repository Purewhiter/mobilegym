import React from 'react';
import { IcNavBack } from '../res/icons';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';

export const RechargeCardPage: React.FC = () => {
  const { bindBack } = useAlipayGestures();
  const s = useAlipayStrings();

  const redeemRechargeCard = useAlipayStore(state => state.redeemRechargeCard);
  const rechargeCards = useAlipayStore(state => state.rechargeCards);

  const [cardNumber, setCardNumber] = React.useState('');
  const [message, setMessage] = React.useState('');

  const redeem = () => {
    setMessage('');
    const result = redeemRechargeCard(cardNumber);
    if (!result.ok) {
      setMessage(s.recharge_card_failed);
      return;
    }
    setMessage(s.recharge_card_success.replace('{value}', (result.value || 0).toFixed(2)));
    setCardNumber('');
  };

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-surface z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-app-surface px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
        <button {...bindBack()} className="p-1 -ml-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-800">{s.recharge_card_title}</span>
        <div className="w-6" />
      </div>

      <div className="flex-1 overflow-auto no-scrollbar px-4 py-4 space-y-3">
        <div className="bg-app-surface rounded-xl shadow-sm p-4 space-y-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">{s.recharge_card_number}</div>
            <input
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
              placeholder={s.recharge_card_example}
            />
          </div>
          <button
            className="w-full h-10 rounded-full bg-app-primary text-white font-medium active:bg-app-primary/90"
            onClick={redeem}
          >
            {s.recharge_card_confirm}
          </button>
          {message ? <div className="text-sm text-gray-700">{message}</div> : null}
        </div>

        <div className="bg-app-surface rounded-xl shadow-sm p-4">
          <div className="text-sm font-medium text-gray-900 mb-2">{s.recharge_card_available_cards}</div>
          <div className="space-y-2">
            {(rechargeCards || []).map(c => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-800">{c.code}</span>
                <span className={`text-xs ${c.redeemed ? 'text-gray-400' : 'text-app-primary'}`}>
                  {c.redeemed ? s.recharge_card_used : s.recharge_card_value.replace('{value}', Number(c.value).toFixed(0))}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
