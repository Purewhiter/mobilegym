import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcNavBack, IcEye } from '../res/icons';
import * as TimeService from '../../../os/TimeService';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { DefaultAvatar } from '../components/DefaultAvatar';
import { getBillDisplayTitle } from '../utils/bills';

type TabKey = 'all' | 'out' | 'in';

const formatDateTime = (timestamp: number) => {
  const d = TimeService.fromTimestamp(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export const BalanceRecordsPage: React.FC = () => {
  const s = useAlipayStrings();
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: TabKey = tabParam === 'out' || tabParam === 'in' ? tabParam : 'all';
  const { balance, transferRecords } = useAlipayStore();
  const { bindTap, bindBack } = useAlipayGestures();

  // 首先计算完整列表的余额变化，无论当前tab是什么
  const fullSorted = React.useMemo(() => {
    return [...transferRecords].sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [transferRecords]);

  // 计算每条记录后的余额
  const fullEnriched = React.useMemo(() => {
    let afterBalance = balance.total;
    return fullSorted.map((r: any) => {
      const row = { ...r, balanceAfter: afterBalance };
      afterBalance = afterBalance - r.delta;
      return row;
    });
  }, [fullSorted, balance.total]);

  // 然后根据当前tab过滤显示，并排除未来交易
  const sorted = React.useMemo(() => {
    const nowTs = TimeService.now();
    const current = fullEnriched.filter((r: any) => (r.timestamp || 0) <= nowTs);
    if (tab === 'out') return current.filter((r: any) => r.delta < 0);
    if (tab === 'in') return current.filter((r: any) => r.delta > 0);
    return current;
  }, [fullEnriched, tab]);

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-surface z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-app-surface px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
        <button {...bindBack<HTMLButtonElement>()} className="p-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-800">{s.balance_details}</span>
        <button className="p-1">
          <IcEye size={22} className="text-gray-500" />
        </button>
      </div>

      <div className="bg-app-surface border-b border-gray-100 px-6 pt-2">
        <div className="flex items-center justify-between text-base font-medium">
          <button
            {...bindTap<HTMLButtonElement>('balanceRecords.tab.all')}
            className={`pb-2 ${tab === 'all' ? 'text-app-primary border-b-2 border-app-primary' : 'text-gray-600'}`}
          >
            {s.messagespage_all}
          </button>
          <button
            {...bindTap<HTMLButtonElement>('balanceRecords.tab.out')}
            className={`pb-2 ${tab === 'out' ? 'text-app-primary border-b-2 border-app-primary' : 'text-gray-600'}`}
          >
            {s.expenses}
          </button>
          <button
            {...bindTap<HTMLButtonElement>('balanceRecords.tab.in')}
            className={`pb-2 ${tab === 'in' ? 'text-app-primary border-b-2 border-app-primary' : 'text-gray-600'}`}
          >
            {s.income}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar">
        <div className="bg-app-surface">
          {sorted.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <div className="flex items-center min-w-0">
                <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden mr-3 flex-shrink-0">
                  {r.counterpartyAvatar ? (
                    <img src={r.counterpartyAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <DefaultAvatar iconSize={20} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{getBillDisplayTitle(r)}</div>
                  <div className="text-xs text-gray-400 mt-1">{formatDateTime(r.timestamp)}</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0 pl-3">
                <div className={`text-sm font-medium ${Number(r.delta) > 0 ? 'text-[#FF7D00]' : 'text-gray-900'}`}>
                  {Number(r.delta) > 0 ? `+${Number(r.delta).toFixed(2)}` : Number(r.delta).toFixed(2)}
                </div>
                <div className="text-xs text-gray-400 mt-1">{s.balance} {Number(r.balanceAfter).toFixed(2)}{s.balancepage_cny}</div>
              </div>
            </div>
          ))}
          {sorted.length === 0 && (
            <div className="py-16 text-center text-gray-400 text-sm">{s.no_records}</div>
          )}
        </div>
      </div>
    </div>
  );
};
