import React, { useState } from 'react';
import { IcFile, IcCard, IcTicket, IcNavForward, IcExpand, IcCollapse, IcClock, IcWallet, IcReceipt } from '../res/icons';
import { RAILWAY12306_CONFIG } from '../data';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { useLocale } from '../../../os/locale';
import { localizeRailwayItemName } from '../utils/localizeRailwayItem';
export const OrdersPage: React.FC = () => {
  const config = RAILWAY12306_CONFIG;
  const { bindTap } = useRailwayGestures();
  const s = useAppStrings(strings, stringsEn);
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);

  const ticketEntries = [
    { id: 'pending', name: s.orders_pending, Icon: IcFile },
    { id: 'paid', name: s.orders_paid, Icon: IcCard },
    { id: 'waitlist', name: s.orders_waitlist_order, Icon: IcClock },
    { id: 'my_tickets', name: s.orders_my_tickets, Icon: IcWallet },
    { id: 'invoice', name: s.orders_invoice, Icon: IcReceipt },
  ];

  const displayCategories = expanded ? config.orderCategoriesFull : config.orderCategories;

  return (
    <div className="min-h-full pb-safe">
      {/* 顶栏 */}
      <div className="bg-app-primary pt-10 pb-4 px-4 flex items-center justify-between gap-3 shadow-sm sticky top-0 z-20">
        <span className="text-white text-[18px] font-bold flex-1 min-w-0 px-2 text-center leading-tight">{s.orders_title}</span>
        <span className="max-w-[42%] shrink-0 text-white/90 text-[12px] text-right leading-tight whitespace-normal break-words">{s.orders_warm_tip}</span>
      </div>

      {/* 火车票订单快捷入口 */}
      <div className="bg-app-surface mx-0 px-4 pt-3 pb-2">
        <span className="text-[14px] font-medium text-app-text">{s.orders_train_section}</span>
        <div className="flex justify-around mt-3">
          {ticketEntries.map(entry => {
            const EntryIcon = entry.Icon;
            return (
              <div
                key={entry.id}
                className="flex flex-col items-center gap-1.5 cursor-pointer"
                {...(entry.id === 'my_tickets' ? bindTap<HTMLDivElement>('orders.myTickets') :
                     entry.id === 'paid' ? bindTap<HTMLDivElement>('orders.paidOrders') :
                     entry.id === 'pending' ? bindTap<HTMLDivElement>('orders.incompleteOrders', { params: { from: 'orders' } }) :
                     entry.id === 'invoice' ? bindTap<HTMLDivElement>('orders.invoice' as any) : {})}
              >
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                  <EntryIcon size={20} className="text-app-primary" />
                </div>
                <span className="text-[11px] text-app-text">{entry.name}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 其他订单类型列表 */}
      <div className="bg-app-surface mt-2">
        {displayCategories.map((cat) => (
          <div key={cat.id} className="flex items-center px-4 py-3.5 border-b border-gray-50 last:border-b-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center mr-3" style={{ backgroundColor: cat.color + '20' }}>
              <IcFile size={18} style={{ color: cat.color }} />
            </div>
            <span className="flex-1 text-[14px] text-app-text">{localizeRailwayItemName(cat.id, cat.name, s)}</span>
            <IcNavForward size={16} className="text-gray-300" />
          </div>
        ))}
        <div
          className="text-center py-3 active:bg-gray-50"
          onClick={() => setExpanded(!expanded)}
        >
          <span className="text-xs text-gray-500 flex items-center justify-center gap-0.5">
            {expanded ? s.orders_collapse : s.orders_expand}
            {expanded ? <IcCollapse size={12} /> : <IcExpand size={12} />}
          </span>
        </div>
      </div>

      {/* 底部广告 */}
      <div className="mx-4 mt-3 h-40 bg-gradient-to-r from-red-500 to-orange-400 rounded-xl flex items-center justify-center mb-6">
        <span className="text-white text-sm font-bold">{locale === 'en' ? 'Spring car rental deal · Nationwide one-way return support' : '新春特惠租车 · 全国支持异地还车'}</span>
      </div>
    </div>
  );
};
