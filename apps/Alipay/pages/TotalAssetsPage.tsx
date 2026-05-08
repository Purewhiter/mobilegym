import React from 'react';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { IcNavBack, IcEye, IcEyeOff, IcNavForward, IcShield } from '../res/icons';

const fmt = (n: number, visible: boolean) =>
  visible ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '****';

function ChevRight({ className }: { className?: string }) {
  return <IcNavForward size={11} className={className ?? 'opacity-55'} strokeWidth={2.2} />;
}

/** 总资产：与理财页同源；理财资产中「余额」= 总资产，「余额宝」固定 0.00 */
export const TotalAssetsPage: React.FC = () => {
  const balance = useAlipayStore(s => s.balance);
  const { bindBack, bindTap } = useAlipayGestures();
  const s = useAlipayStrings();
  const [visible, setVisible] = React.useState(true);
  const total = balance.total;
  const yesterday = balance.dailyIncome;
  const yuebaoDisplay = 0;
  const zeroCol = { main: 0, sub: 0 };

  return (
    <div className="relative min-h-full bg-[#F5F5F5] pb-8 pt-10 font-sans antialiased flex flex-col" data-status-bar-foreground="dark">
      <div className="absolute top-0 left-0 right-0 h-[280px] bg-gradient-to-b from-[#e8f1ff] via-[#eff5ff] to-[#F5F5F5] pointer-events-none" />
      <div className="fixed top-0 left-0 right-0 z-30 h-10 pointer-events-none bg-transparent" />
      <div className="relative z-10 flex flex-col flex-1">
      <header className="relative z-20 px-3 py-2 mt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button type="button" {...bindBack<HTMLButtonElement>()} className="flex h-9 w-9 items-center justify-center rounded-full active:bg-black/5 -ml-1">
              <IcNavBack size={22} className="text-gray-900" strokeWidth={1.5} />
            </button>
            <span className="text-[19px] text-gray-900 font-medium">{s.total_assets}</span>
          </div>
          <button type="button" className="px-1 py-1 text-right text-[15px] text-gray-800 font-medium active:opacity-70 mr-1" {...bindTap<HTMLButtonElement>('assets.finance.open')}>
            {s.total_assets_page_go_finance}
          </button>
        </div>
      </header>

      {/* 提示条 */}
      <div className="relative z-10 mx-3 mt-2 flex items-center gap-2">
        <div className="flex h-[42px] w-[42px] flex-shrink-0 items-center justify-center z-10 drop-shadow-sm ml-1">
          <svg width="42" height="42" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" rx="50" fill="transparent"/>
            <path d="M50 20C30 20 20 35 20 50C20 65 30 80 50 80C70 80 80 65 80 50C80 35 70 20 50 20Z" fill="#E8F1FF" stroke="#0080FF" strokeWidth="4"/>
            <rect x="35" y="40" width="30" height="10" fill="#0080FF"/>
            <circle cx="35" cy="55" r="5" fill="#0080FF"/>
            <circle cx="65" cy="55" r="5" fill="#0080FF"/>
            <path d="M40 70H60" stroke="#0080FF" strokeWidth="4" strokeLinecap="round"/>
            <path d="M45 20V10M55 20V10" stroke="#0080FF" strokeWidth="4" strokeLinecap="round"/>
            <circle cx="45" cy="10" r="4" fill="#0080FF"/>
            <circle cx="55" cy="10" r="4" fill="#0080FF"/>
          </svg>
        </div>
        <div className="min-w-0 flex-1 rounded-[12px] rounded-tl-[4px] bg-white/90 px-3 py-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-white/50">
          <p className="flex items-center gap-1.5 text-[14px] leading-snug text-gray-800">
            <span className="inline-flex items-center rounded bg-[#4293FF] px-[6px] py-[2px] text-[11px] font-medium text-white tracking-wide">
              {s.total_assets_page_banner_cta}
            </span>
            <span className="truncate text-[13px]">{s.total_assets_page_banner_question}</span>
          </p>
        </div>
      </div>

      {/* 主卡片：与理财页同色蓝底 + 内嵌白卡 */}
      <div className="relative z-10 mx-3 mt-3 overflow-hidden rounded-[16px] bg-[#007CF3] shadow-[0_4px_12px_rgba(0,124,243,0.2)] shrink-0">
        <div className="px-4 pt-4 pb-3 text-white">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              <span className="text-[17px] font-medium leading-tight text-white tracking-wide">{s.total_assets_page_overview}</span>
              <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded-[4px] bg-white/20 px-1 py-[2px] text-[10px] leading-none text-white ml-0.5">
                <IcShield size={10} className="text-white" strokeWidth={2.2} />
                {s.total_assets_page_upgrade_badge}
              </span>
            </div>
            <button type="button" className="flex-shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-[11px] text-white active:bg-white/25">
              {s.total_assets_page_view_score}
            </button>
          </div>

          <div className="mt-6 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)] items-end gap-x-1">
            <div className="min-w-0 pb-1">
              <div className="flex items-center gap-0.5 opacity-80">
                <span className="text-[12px] text-white">{s.total_assets_page_my_assets}</span>
                <ChevRight className="text-white/70" />
                <button type="button" className="shrink-0 text-white active:opacity-80 ml-0.5" aria-label="toggle visibility" onClick={() => setVisible(v => !v)}>
                  {visible ? <IcEye size={14} className="opacity-90" /> : <IcEyeOff size={14} className="opacity-90" />}
                </button>
              </div>
              <div className="mt-2 max-w-full font-medium leading-none tracking-tight text-white tabular-nums" style={{ fontSize: '26px' }}>
                {fmt(total, visible)}
              </div>
            </div>
            <div className="min-w-0 pb-1 text-center">
              <span className="inline-flex items-center justify-center gap-0.5 text-[12px] text-white opacity-80">
                {s.finance_page_yesterday_income}
                <ChevRight className="text-white/70" />
              </span>
              <div className="mt-2 text-[26px] font-medium leading-none tabular-nums text-white">{visible ? yesterday.toFixed(2) : '****'}</div>
            </div>
            <div className="min-w-0 pb-1 text-right relative">
              <div className="absolute right-0 bottom-full mb-1.5 w-px h-3 bg-white/20 -mr-1" />
              <span className="inline-flex items-center justify-end gap-0.5 text-[12px] text-white opacity-80">
                {s.finance_page_family_protection}
                <ChevRight className="text-white/70" />
              </span>
              <div className="mt-2 text-[26px] font-medium leading-none text-white flex items-baseline justify-end">
                {visible ? "2" : '**'}<span className="text-[13px] font-normal ml-1">份</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-1.5 pb-1.5">
          <div className="rounded-[12px] bg-white py-3.5">
            <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)] gap-x-0 relative">
              <div className="absolute left-[38%] top-2 bottom-2 w-px bg-gray-100" />
              <div className="absolute left-[70%] top-2 bottom-2 w-px bg-gray-100" />
              {[
                { label: s.total_assets_page_current_label, main: total, sub: yesterday },
                { label: s.total_assets_page_stable_label, main: zeroCol.main, sub: zeroCol.sub },
                { label: s.total_assets_page_advanced_label, main: zeroCol.main, sub: zeroCol.sub },
              ].map((col, idx) => (
                <div key={col.label} className="flex min-w-0 flex-col px-3 relative z-10">
                  <div className="inline-flex max-w-full items-center gap-0 text-[13px] text-gray-500">
                    <span className="truncate">{col.label}</span>
                    <ChevRight className="flex-shrink-0 text-gray-400 scale-90 origin-left" />
                  </div>
                  <div className="mt-1 max-w-full font-medium tabular-nums leading-tight text-gray-900 text-[16px]">
                    {fmt(col.main, visible)}
                  </div>
                  <div className="mt-0.5 text-[12px] tabular-nums text-gray-400">{visible ? (typeof col.sub === 'number' ? col.sub.toFixed(2) : col.sub) : '****'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tab + 分析 */}
      <div className="relative z-10 mx-3 mt-3 overflow-hidden rounded-[16px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)] shrink-0">
        <div className="flex border-b border-gray-100/80 px-1 pt-1.5">
          {[
            s.total_assets_page_tab_position,
            s.total_assets_page_tab_earning,
            s.total_assets_page_tab_opportunity,
            s.total_assets_page_tab_protection,
          ].map((label, i) => (
            <div key={label} className="relative min-w-0 flex-1 py-3 text-center">
              <span className={`block truncate px-0.5 text-[15px] leading-tight ${i === 0 ? 'font-medium text-[#1677FF]' : 'font-normal text-gray-600'}`}>{label}</span>
              {i === 0 && <div className="absolute bottom-0 left-1/2 h-[3px] w-7 -translate-x-1/2 rounded-full bg-[#1677FF]" />}
            </div>
          ))}
        </div>
        <div className="px-4 pb-4 pt-4">
          <div className="flex items-start gap-4">
            <p className="min-w-0 flex-1 text-[17px] font-medium leading-[1.5] text-gray-900 tracking-wide mt-1">{s.total_assets_page_analysis_hint}</p>
            <div className="flex h-[76px] w-[76px] flex-shrink-0 items-center justify-center -mt-1" aria-hidden>
              <svg width="76" height="76" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="100" height="100" rx="50" fill="transparent"/>
                <path d="M50 20C30 20 20 35 20 50C20 65 30 80 50 80C70 80 80 65 80 50C80 35 70 20 50 20Z" fill="#DDEBFF" stroke="#0080FF" strokeWidth="4"/>
                <rect x="35" y="40" width="30" height="10" fill="#0080FF"/>
                <circle cx="35" cy="55" r="5" fill="#0080FF"/>
                <circle cx="65" cy="55" r="5" fill="#0080FF"/>
                <path d="M40 70H60" stroke="#0080FF" strokeWidth="4" strokeLinecap="round"/>
                <path d="M45 20V10M55 20V10" stroke="#0080FF" strokeWidth="4" strokeLinecap="round"/>
                <circle cx="45" cy="10" r="4" fill="#0080FF"/>
                <circle cx="55" cy="10" r="4" fill="#0080FF"/>
              </svg>
            </div>
          </div>
          <div className="mt-1">
            <p className="text-[13px] text-gray-500">{s.total_assets_page_guess_ask}</p>
            <div className="mt-2.5 flex gap-2.5">
              <button type="button" className="min-h-[36px] flex-1 rounded-full border border-[#1677FF] bg-white px-2 py-1.5 text-center text-[14px] leading-tight text-[#1677FF] active:bg-blue-50/90">
                {s.total_assets_page_btn_observe}
              </button>
              <button type="button" className="min-h-[36px] flex-1 rounded-full border border-[#1677FF] bg-white px-2 py-1.5 text-center text-[14px] leading-tight text-[#1677FF] active:bg-blue-50/90">
                {s.total_assets_page_btn_opportunity}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 理财资产 */}
      <section className="relative z-10 mx-3 mt-3 mb-8 overflow-hidden rounded-[16px] bg-white shadow-[0_2px_8px_rgba(0,0,0,0.02)] shrink-0">
        <div className="p-4 pb-3 flex items-center gap-2">
          <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#1677FF] text-[12px] font-bold text-white shadow-sm">¥</div>
          <span className="text-[16px] font-medium text-gray-900 tracking-wide">{s.total_assets_page_wealth_section}</span>
        </div>
        <div className="divide-y divide-gray-100/80 border-t border-gray-100/80">
          {/* 余额 + 余额宝 */}
          <div className="flex divide-x divide-gray-100/80">
            <div className="min-w-0 flex-1 px-4 py-3.5">
              <div className="text-[14px] text-gray-500">{s.balance}</div>
              <div className="mt-1.5 max-w-full font-medium tabular-nums leading-tight text-gray-900 text-[18px]">
                {fmt(total, visible)}
              </div>
            </div>
            <div className="min-w-0 flex-1 px-4 py-3.5">
              <div className="text-[14px] text-gray-500">{s.yue_bao}</div>
              <div className="mt-1.5 flex items-baseline justify-between gap-1">
                <div className="max-w-full font-medium tabular-nums leading-tight text-gray-900 truncate text-[18px]">
                  {fmt(yuebaoDisplay, visible)}
                </div>
                <div className="text-[12px] tabular-nums text-gray-400 flex-shrink-0">{fmt(0, visible)}</div>
              </div>
            </div>
          </div>
          {/* 定期 + 基金 */}
          <div className="flex divide-x divide-gray-100/80">
            <div className="min-w-0 flex-1 px-4 py-3.5">
              <div className="text-[14px] text-gray-500">{s.total_assets_page_fixed}</div>
              <div className="mt-1.5 text-[15px] leading-snug text-gray-800">{s.total_assets_page_fixed_hint}</div>
            </div>
            <div className="min-w-0 flex-1 px-4 py-3.5">
              <div className="text-[14px] text-gray-500">{s.total_assets_page_funds}</div>
              <div className="mt-1.5 text-[15px] leading-snug text-gray-800">{s.total_assets_page_funds_hint}</div>
            </div>
          </div>
          {/* 黄金 + 券商理财 */}
          <div className="flex divide-x divide-gray-100/80">
            <div className="min-w-0 flex-1 px-4 py-3.5">
              <div className="text-[14px] text-gray-500">{s.total_assets_page_gold}</div>
              <div className="mt-1.5 text-[15px] leading-snug text-gray-800">{s.total_assets_page_gold_hint}</div>
            </div>
            <div className="min-w-0 flex-1 px-4 py-3.5">
              <div className="text-[14px] text-gray-500">{s.total_assets_page_broker}</div>
              <div className="mt-1.5 text-[15px] leading-snug text-gray-800">{s.total_assets_page_broker_hint}</div>
            </div>
          </div>
        </div>
      </section>
      </div>
    </div>
  );
};


