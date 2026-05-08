import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcNavBack, IcEye, IcEyeOff, IcMore, IcTransfer, IcCard, IcHeart, IcSavings, IcGrow, IcNavForward } from '../res/icons';
import * as TimeService from '../../../os/TimeService';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { DefaultAvatar } from '../components/DefaultAvatar';
import { getBillDisplayTitle } from '../utils/bills';
export const BalancePage: React.FC = () => {
  const { balance, transferRecords } = useAlipayStore();
  const { bindTap, bindBack, go } = useAlipayGestures();
  const s = useAlipayStrings();
  const [showBalance, setShowBalance] = React.useState(true);
  const sorted = React.useMemo(() => {
    const nowTs = TimeService.now();
    return [...transferRecords]
      .filter((r: any) => (r.timestamp || 0) <= nowTs)
      .sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [transferRecords]);

  const latestThree = React.useMemo(() => {
    let afterBalance = balance.total;
    const rows = sorted.slice(0, 3).map((r: any) => {
      const row = { ...r, balanceAfter: afterBalance };
      afterBalance = afterBalance - r.delta;
      return row;
    });
    return rows;
  }, [sorted, balance.total]);

  const formatDateTime = (timestamp: number) => {
    const d = TimeService.fromTimestamp(timestamp);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  return (
    <div className="bg-app-bg h-full flex flex-col pt-10" data-status-bar-foreground="light">
      {/* Status bar overlay to match blue background */}
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-primary z-10 pointer-events-none"></div>
      {/* Fixed Top Bar */}
      <div className="sticky top-0 z-20 bg-app-primary px-4 pt-4 pb-2 text-white">
        <div className="relative flex min-h-11 items-center justify-center">
          <button type="button" className="absolute left-0 top-1/2 -translate-y-1/2" {...bindBack<HTMLButtonElement>()}>
            <IcNavBack size={24} />
          </button>
          <span className="pointer-events-none text-lg font-medium">{s.balance}</span>
          <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center space-x-3">
            <button type="button" className="flex items-center rounded-full bg-app-surface/20 px-2 py-1 text-xs">
              {s.youth_mode} <span className="ml-1">▶</span>
            </button>
            <IcMore size={24} />
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
        {/* Blue banner background */}
        <div className="bg-app-primary h-24"></div>

        {/* Main Card */}
        <div className="px-3 -mt-16 relative z-10">
        <div className="bg-app-surface rounded-xl p-6 shadow-sm mb-3">
          <div className="flex justify-center items-center text-app-primary text-xs mb-6">
            <span className="mr-1">🛡️</span> {s.funds_are_safely_secured} <IcNavForward size={12} />
          </div>
          
          <div className="text-center mb-8">
            <div className="flex items-center justify-center text-gray-500 text-sm mb-2">
              <span>{s.available_balance_cny}</span>
              <button onClick={() => setShowBalance(!showBalance)} className="ml-2">
                {showBalance ? <IcEye size={16} /> : <IcEyeOff size={16} />}
              </button>
              <button className="ml-auto bg-[#FFF7E6] text-[#FF7D00] text-xs px-2 py-0.5 rounded">{s.complete}</button>
            </div>
            <div className="text-4xl font-bold text-gray-900">
              {showBalance ? balance.total.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '****'}
            </div>
          </div>

          <div className="flex space-x-4">
            <button className="flex-1 bg-app-surface border border-app-border text-gray-800 py-2.5 rounded-lg font-medium text-sm">
              {s.withdraw}
            </button>
            <button
              className="flex-1 bg-app-primary text-white py-2.5 rounded-lg font-medium text-sm shadow-md shadow-blue-200"
              onClick={() => go('balance.recharge.open')}
            >
              {s.top_up}
            </button>
          </div>
        </div>

        {/* Action Grid */}
        <div className="bg-app-surface rounded-xl p-4 shadow-sm mb-3">
          <div className="grid grid-cols-5 gap-4">
            <button 
              className="flex flex-col items-center"
              {...bindTap<HTMLButtonElement>('transfer.open')}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1 text-gray-600">
                <IcTransfer size={24} />
              </div>
              <span className="text-xs text-gray-600">{s.transfer}</span>
            </button>
            <button
              className="flex flex-col items-center relative"
              onClick={() => go('balance.bankCards.open')}
            >
              <div className="absolute -top-2 right-1 bg-[#FF4D4F] text-white text-[9px] px-1 rounded-bl-lg rounded-tr-lg">{s.discount}</div>
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1 text-gray-600">
                <IcCard size={24} />
              </div>
              <span className="text-xs text-gray-600">{s.bank_cards}</span>
            </button>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1 text-gray-600">
                <IcHeart size={24} />
              </div>
              <span className="text-xs text-gray-600">{s.family_card}</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1 text-gray-600">
                <IcSavings size={24} />
              </div>
              <span className="text-xs text-gray-600">{s.dadada}</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 rounded-full flex items-center justify-center mb-1 text-gray-600">
                <IcGrow size={24} />
              </div>
              <span className="text-xs text-gray-600">{s.little_wallet}</span>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        <div className="bg-app-surface rounded-xl shadow-sm overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-50">
            <span className="font-medium text-gray-800">{s.balance_details}</span>
            <button className="flex items-center text-gray-400 text-sm" {...bindTap<HTMLButtonElement>('balance.records.open')}>
              {s.messagespage_all} <IcNavForward size={16} />
            </button>
          </div>
          <div>
            {latestThree.map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between p-4 border-b border-gray-50 last:border-none">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden mr-3 flex-shrink-0">
                    {tx.counterpartyAvatar ? (
                      <img src={tx.counterpartyAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <DefaultAvatar iconSize={20} />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{getBillDisplayTitle(tx)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{formatDateTime(tx.timestamp)}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-medium ${Number(tx.delta) > 0 ? 'text-[#FF7D00]' : 'text-gray-800'}`}>
                    {Number(tx.delta) > 0 ? `+${Number(tx.delta).toFixed(2)}` : Number(tx.delta).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.balance} {Number(tx.balanceAfter).toFixed(2)}{s.balancepage_cny}</div>
                </div>
              </div>
            ))}
            {latestThree.length === 0 && (
              <div className="py-10 text-center text-gray-400 text-sm">{s.no_records}</div>
            )}
          </div>
        </div>
        
        <div className="text-center text-gray-400 text-sm py-6">
          {s.customer_center}
        </div>
      </div>
      </div>
    </div>
  );
};
