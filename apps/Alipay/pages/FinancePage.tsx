import React from 'react';
import { useLocale } from '@/apps/Alipay/locale';
import { IconRenderer } from '../components/IconRenderer';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useAlipayStore } from '../state';
import { IcClose, IcEye, IcEyeOff, IcNavForward } from '../res/icons';
import { localizeMarketIndexName, localizeServiceName } from '../utils/localizeCatalog';

type MarketIndex = {
  name: string;
  value: string;
  change: string;
};

const MARKET_INDICES: MarketIndex[] = [
  { name: '道琼斯', value: '46750.98', change: '-1.41%' },
  { name: '纳斯达克', value: '22329.24', change: '-1.70%' },
  { name: '标普500', value: '6688.01', change: '-1.30%' },
];

export const FinancePage: React.FC = () => {
  const balance = useAlipayStore(state => state.balance);
  const financeServices = useAlipayStore(state => state.financeServices);
  const s = useAlipayStrings();
  const isEnglish = useLocale() === 'en';
  const [assetsVisible, setAssetsVisible] = React.useState(true);

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-4" data-status-bar-foreground="light" data-navigation-bar-foreground="dark">
      <div className="fixed left-0 right-0 top-0 z-20 bg-[#1677FF] px-4 pb-3 pt-12">
        <div className="flex items-center gap-3">
          <button className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-400/50">
            <span className="text-lg text-white">+</span>
          </button>
          <div className="flex flex-1 items-center rounded-md bg-white px-3 py-1.5">
            <span className="flex-1 truncate text-[13px] text-gray-500">{s.finance_page_search_hint}</span>
            <span className="ml-2 flex-shrink-0 text-[13px] text-[#7EB4FF]">{s.search}</span>
          </div>
          <button className="flex flex-shrink-0 items-center justify-center text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
              <path d="M9 9l3 4 3-4" />
              <path d="M12 13v5" />
              <path d="M10 15h4" />
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-[#1677FF] px-4 pb-0 pt-[104px]">
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[13px] text-white/90">{s.finance_page_total_assets}</span>
              <button className="text-white/90" onClick={() => setAssetsVisible(value => !value)}>
                {assetsVisible ? <IcEye size={16} /> : <IcEyeOff size={16} />}
              </button>
              <div className="rounded bg-white/20 px-1.5 py-0.5">
                <span className="text-[11px] text-white">{s.finance_page_free_upgrade}</span>
              </div>
            </div>
            <div className="mt-1 pb-2 text-[32px] font-semibold leading-normal text-white">
              {assetsVisible ? balance.total.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '****'}
            </div>
          </div>
          <div className="pb-2 text-center">
            <span className="text-[13px] text-white/90">{s.finance_page_yesterday_income}</span>
            <div className="mt-0.5 text-lg font-medium text-white">{assetsVisible ? balance.dailyIncome.toFixed(2) : '****'}</div>
          </div>
          <div className="pb-2 text-right">
            <span className="text-[13px] text-white/90">{s.finance_page_family_protection}</span>
            <div className="mt-0.5 text-lg font-medium text-white">{assetsVisible ? s.finance_page_family_count : '**'}</div>
          </div>
        </div>
      </div>

      <div className="bg-[#1677FF] px-3 pt-1">
        <div className="flex items-center justify-between rounded-t-xl bg-[#0B59D9] px-3 py-2.5">
          <span className="text-[15px] font-medium text-white">{s.finance_page_rewards_center}</span>
          <div className="flex items-center">
            <span className="text-[13px] text-white/80">{s.finance_page_rewards_hint}</span>
            <IcNavForward size={14} className="ml-0.5 text-white/80" />
          </div>
        </div>
      </div>

      <div className="relative z-10 -mt-2 px-3">
        <div className="rounded-b-xl rounded-t-2xl bg-white p-4 pt-5 shadow-sm">
          <div className="grid grid-cols-5 gap-x-2 gap-y-5">
            {financeServices.map(service => (
              <div key={service.id} className="flex flex-col items-center">
                <div className="mb-1.5 flex h-8 w-8 items-center justify-center">
                  <IconRenderer name={service.icon} size={28} color={service.color} />
                </div>
                <span className="text-[13px] text-gray-700">
                  {localizeServiceName(service.id, service.name, isEnglish)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-center">
            <div className="h-1 w-6 rounded-full bg-gray-200" />
          </div>
        </div>

        <div className="relative mt-3 overflow-hidden rounded-xl bg-white p-4 shadow-sm">
          <div className="absolute left-0 right-0 top-0 h-16 bg-gradient-to-b from-red-50 to-white" />
          <div className="relative z-10">
            <div className="mb-2 flex items-center justify-center">
              <span className="rounded-full bg-red-100/50 px-2 py-0.5 text-[11px] font-medium text-red-500">{s.finance_page_market_hotspot}</span>
              <button className="absolute right-0 text-gray-400"><IcClose size={16} /></button>
            </div>
            <div className="mb-4 text-center">
              <h3 className="text-[20px] font-bold text-gray-800">{s.finance_page_headline}</h3>
              <div className="mt-2 flex items-center justify-center space-x-2">
                <span className="text-[13px] text-red-500">{s.finance_page_sub1}</span>
                <span className="text-[13px] text-gray-300">|</span>
                <span className="text-[13px] text-red-500">{s.finance_page_sub2}</span>
                <span className="text-[13px] text-gray-300">|</span>
                <span className="text-[13px] text-blue-500">{s.finance_page_sub3}</span>
              </div>
            </div>
            <div className="flex justify-center">
              <button className="rounded-full bg-[#1677FF] px-20 py-2 text-[15px] font-medium text-white">{s.finance_page_explore}</button>
            </div>
          </div>
        </div>

        <div className="mt-3 flex space-x-2">
          <div className="flex-1 rounded-xl bg-white p-3 shadow-sm">
            <div className="mb-1 flex justify-end">
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-[#1677FF]">{s.finance_page_fund_watchlist}</span>
            </div>
            <div className="text-[15px] font-medium leading-tight text-gray-800">{s.finance_page_fund_name}</div>
            <div className="mt-2 flex items-end space-x-2">
              <span className="text-[20px] font-bold text-red-500">+1.32%</span>
              <span className="mb-1 rounded bg-blue-50 px-1 text-[11px] text-[#1677FF]">{s.finance_page_low_volatility}</span>
            </div>
            <div className="mt-0.5 text-[12px] text-gray-400">{s.finance_page_six_month_change}</div>
            <div className="mt-3 flex items-center justify-between">
              <button className="rounded-full bg-[#1677FF] px-4 py-1.5 text-[13px] text-white">{s.finance_page_explore}</button>
              <div className="h-8 w-14">
                <svg viewBox="0 0 100 40" className="h-full w-full fill-none stroke-[#1677FF]" strokeWidth="2">
                  <path d="M0,30 L10,25 L20,35 L30,20 L40,28 L50,15 L60,22 L70,10 L80,18 L90,5 L100,15" />
                </svg>
              </div>
            </div>
          </div>

          <div className="flex-1 rounded-xl bg-white p-3 shadow-sm">
            <div className="mb-1 flex justify-end">
              <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[11px] text-[#1677FF]">{s.finance_page_stock_watchlist}</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-[15px] font-medium text-gray-800">{s.finance_page_stock_name}</span>
              <span className="text-[13px] text-red-500">+0.18%</span>
            </div>
            <div className="mt-1.5 text-[20px] font-bold text-green-500">{s.finance_page_stock_inflow_value}</div>
            <div className="mt-0.5 text-[12px] text-gray-400">{s.finance_page_three_day_inflow}</div>
            <div className="mt-3 flex items-center justify-between">
              <button className="rounded-full bg-[#1677FF] px-4 py-1.5 text-[13px] text-white">{s.finance_page_explore}</button>
              <div className="flex h-8 items-end space-x-1">
                <div className="h-4 w-2.5 rounded-sm bg-red-500" />
                <div className="h-6 w-2.5 rounded-sm bg-green-500" />
                <div className="h-5 w-2.5 rounded-sm bg-red-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-white p-4 shadow-sm">
          <div className="grid grid-cols-3 gap-4">
            {MARKET_INDICES.map(index => (
              <div key={index.name}>
                <div className="flex items-center text-[13px] text-gray-500">
                  {localizeMarketIndexName(index.name, isEnglish)}
                  <IcNavForward size={12} className="ml-0.5" />
                </div>
                <div className="mt-1 flex items-baseline space-x-1">
                  <span className="text-[15px] font-bold text-green-500">{index.value}</span>
                  <span className="text-[11px] text-green-500">{index.change}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center border-t border-gray-100 pt-3">
            <span className="mr-2 flex-shrink-0 rounded bg-orange-100 px-1 text-[10px] text-orange-500">{s.finance_page_hot}</span>
            <span className="truncate text-[13px] text-gray-700">{s.finance_page_hot_news}</span>
            <IcNavForward size={14} className="ml-auto flex-shrink-0 text-gray-400" />
          </div>
        </div>
      </div>
    </div>
  );
};
