import React from 'react';
import { IcNavBack } from '../res/icons';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import * as TimeService from '../../../os/TimeService';

export const SubscriptionsPage: React.FC = () => {
  const { bindBack } = useAlipayGestures();
  const s = useAlipayStrings();

  const balance = useAlipayStore(state => state.balance);
  const recordTransfer = useAlipayStore(state => state.recordTransfer);
  const upsertSubscription = useAlipayStore(state => state.upsertSubscription);

  const [membershipType, setMembershipType] = React.useState('视频会员');
  const [price, setPrice] = React.useState('30');
  const [billingCycle, setBillingCycle] = React.useState('月');
  const [autoRenew, setAutoRenew] = React.useState(true);
  const [error, setError] = React.useState('');

  const submit = () => {
    setError('');
    const p = Number.parseFloat(price);
    const pr = Number.isFinite(p) && p > 0 ? p : 0;
    if (!membershipType.trim()) {
      setError(s.subscriptions_type_required);
      return;
    }
    if (pr <= 0) {
      setError(s.subscriptions_invalid_price);
      return;
    }
    if ((balance?.total || 0) < pr) {
      setError(s.subscriptions_insufficient);
      return;
    }

    const now = TimeService.now();
    const id = `sub_${now}_${Math.random().toString(16).slice(2)}`;

    upsertSubscription({
      id,
      membershipType: membershipType.trim(),
      price: pr,
      billingCycle: billingCycle.trim() || '月',
      autoRenew,
      createdAt: now,
    });

    recordTransfer({
      counterpartyName: '会员订阅',
      delta: -pr,
    });
  };

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-surface z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-app-surface px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
        <button {...bindBack()} className="p-1 -ml-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-800">{s.subscriptions_title}</span>
        <div className="w-6" />
      </div>

      <div className="flex-1 overflow-auto no-scrollbar px-4 py-4">
        <div className="bg-app-surface rounded-xl shadow-sm p-4 space-y-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">{s.subscriptions_membership_type}</div>
            <input
              value={membershipType}
              onChange={(e) => setMembershipType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500 mb-1">{s.subscriptions_price}</div>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
                inputMode="decimal"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">{s.subscriptions_billing_cycle}</div>
              <input
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white outline-none"
              />
            </div>
          </div>

          <button
            className={`w-full h-10 rounded-full ${autoRenew ? 'bg-app-primary text-white' : 'bg-gray-100 text-gray-800'} font-medium`}
            onClick={() => setAutoRenew(v => !v)}
          >
            {autoRenew ? s.subscriptions_auto_renew_on : s.subscriptions_auto_renew_off}
          </button>

          {error ? <div className="text-sm text-[#FF3B30]">{error}</div> : null}

          <button
            className="w-full h-10 rounded-full bg-app-primary text-white font-medium active:bg-app-primary/90"
            onClick={submit}
          >
            {s.subscriptions_submit}
          </button>
        </div>
      </div>
    </div>
  );
};
