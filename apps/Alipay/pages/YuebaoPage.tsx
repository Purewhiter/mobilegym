import React from 'react';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { IcNavBack, IcEye, IcEyeOff, IcMore, IcNavForward, IcInfo } from '../res/icons';

const YUEBAO_TOTAL = 0;

function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 4L8 8H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h3l6 4V4z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M16.5 9.5c.7.8 1.1 1.8 1.1 2.9s-.4 2.1-1.1 2.9M19 7c1.2 1.5 1.9 3.4 1.9 5.4s-.7 3.9-1.9 5.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 攒钱补贴左侧红包图标 */
function RedPacketIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden>
      <rect x="2" y="5" width="20" height="15" rx="3" fill="#E83632" />
      <path d="M2 9 L12 15 L22 9" fill="#FF6B6B" opacity="0.35" />
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fill="white"
        fontSize="11"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        ¥
      </text>
    </svg>
  );
}

function YuebaoFeatureGlyph({ kind }: { kind: 'save' | 'cash' | 'earn' | 'flex' | 'more' }) {
  const wrap = 'flex h-[44px] w-[44px] items-center justify-center rounded-full bg-[#FF5000] shadow-[0_2px_6px_rgba(255,80,0,0.35)]';
  if (kind === 'save') {
    return (
      <div className={wrap}>
        <span className="text-[17px] font-bold leading-none text-white">攒</span>
      </div>
    );
  }
  if (kind === 'cash') {
    return (
      <div className={wrap}>
        <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="white" aria-hidden>
          <path d="M12 2l2.4 6.2L21 9l-5 4.2L17.5 22 12 18.2 6.5 22 8 13.2 3 9l6.6-.8L12 2z" />
        </svg>
      </div>
    );
  }
  if (kind === 'earn') {
    return (
      <div className={wrap}>
        <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 9a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2V9z"
            stroke="white"
            strokeWidth="1.75"
          />
          <path d="M4 9V7a3 3 0 013-3h10a3 3 0 013 3v2" stroke="white" strokeWidth="1.75" strokeLinecap="round" />
          <circle cx="12" cy="14" r="1.6" fill="white" />
        </svg>
      </div>
    );
  }
  if (kind === 'flex') {
    return (
      <div className={wrap}>
        <span className="text-[19px] font-bold leading-none text-white">¥</span>
      </div>
    );
  }
  return (
    <div className={`${wrap} grid grid-cols-2 gap-[3px] p-[11px]`}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="h-[6px] w-[6px] rounded-[1px] bg-white" />
      ))}
    </div>
  );
}

/** 余额宝：总金额固定 0.00；视觉对齐客户端橙白卡片风格 */
export const YuebaoPage: React.FC = () => {
  const s = useAlipayStrings();
  const { bindBack } = useAlipayGestures();
  const [visible, setVisible] = React.useState(true);
  const totalStr = visible
    ? YUEBAO_TOTAL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '****';
  const noEarnings = YUEBAO_TOTAL <= 0;

  const iconRow: { key: string; kind: 'save' | 'cash' | 'earn' | 'flex' | 'more'; label: string }[] = [
    { key: 'save', kind: 'save', label: s.yuebao_page_icon_save },
    { key: 'cash', kind: 'cash', label: s.yuebao_page_icon_cash },
    { key: 'earn', kind: 'earn', label: s.yuebao_page_icon_earn },
    { key: 'flex', kind: 'flex', label: s.yuebao_page_icon_current },
    { key: 'more', kind: 'more', label: s.yuebao_page_icon_more },
  ];

  return (
    <div className="min-h-full bg-[#F5F5F5] pb-10 pt-10" data-status-bar-foreground="light">
      <div className="fixed top-0 left-0 right-0 z-10 h-10 bg-[#FF5000] pointer-events-none" />

      <div className="relative overflow-hidden bg-gradient-to-br from-[#FF5000] via-[#FF6A1A] to-[#FF8533] pb-10 text-white">
        <div className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rounded-full bg-white/12 blur-2xl" />
        <div className="pointer-events-none absolute -left-10 top-10 h-32 w-32 rounded-full bg-white/10 blur-xl" />

        <div className="relative z-[1] px-3 pt-1">
          <div className="flex items-center justify-between">
            <button type="button" {...bindBack<HTMLButtonElement>()} className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10">
              <IcNavBack size={26} className="text-white" strokeWidth={1.5} />
            </button>
            <span className="text-[19px] font-medium tracking-wide">{s.yue_bao}</span>
            <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full active:bg-white/10">
              <IcMore size={24} className="text-white" strokeWidth={2} />
            </button>
          </div>

          <div className="mt-2 flex justify-center px-4">
            <button
              type="button"
              className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-white/20 px-3.5 py-1 text-[13px] font-medium text-white/95 ring-1 ring-white/20 backdrop-blur-sm active:bg-white/30 tracking-wide"
            >
              <span className="truncate">{s.yuebao_page_fund_pill}</span>
              <IcNavForward size={12} className="flex-shrink-0 opacity-90 scale-90 origin-left" strokeWidth={2.2} />
            </button>
          </div>

          <button
            type="button"
            className="relative z-[1] mt-3 flex w-full items-center gap-1.5 rounded-[12px] bg-white/10 px-3 py-2.5 text-left text-[14px] text-white/95 ring-1 ring-white/10 active:bg-black/16"
          >
            <SpeakerIcon className="flex-shrink-0 text-white/90 scale-110" />
            <span className="min-w-0 flex-1 truncate tracking-wide">{s.yuebao_page_announce}</span>
            <IcNavForward size={14} className="flex-shrink-0 text-white/70" strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="relative z-[2] -mt-7 px-3">
        <div className="overflow-hidden rounded-t-[16px] rounded-b-[16px] bg-white shadow-[0_8px_24px_rgba(255,80,0,0.08)]">
          <div className="h-20 bg-gradient-to-b from-orange-100/60 via-orange-50/30 to-white" />

          <div className="px-4 pb-4 -mt-16">
            <div className="flex flex-wrap items-center gap-1 text-[13px] text-gray-500">
              <span>{s.yuebao_page_total}</span>
              <button type="button" className="rounded p-0.5 text-gray-500 active:bg-gray-100" onClick={() => setVisible(v => !v)}>
                {visible ? <IcEye size={15} className="opacity-90" /> : <IcEyeOff size={15} className="opacity-90" />}
              </button>
              <span className="ml-1 inline-flex items-center gap-0.5 rounded-[4px] bg-white border border-red-200 px-1 py-[2px] text-[10px] text-red-500">
                <span aria-hidden>🛡</span>
                {s.yuebao_page_safe}
              </span>
            </div>

            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-[52px] font-semibold leading-none tracking-tight text-gray-900 tabular-nums">{totalStr}</span>
              <IcNavForward size={22} className="text-gray-300 opacity-50" strokeWidth={2} />
            </div>

            <div className="mt-7 flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-[13px] text-gray-400">
                  {s.yuebao_page_yesterday_label}
                  <IcInfo size={13} className="text-gray-300" strokeWidth={1.5} />
                </div>
                <div className={`mt-1.5 text-[18px] font-medium ${noEarnings ? 'text-[#E83632]' : 'text-gray-900'}`}>
                  {visible ? (noEarnings ? s.yuebao_page_no_earnings : YUEBAO_TOTAL.toFixed(2)) : '****'}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] text-gray-400">{s.yuebao_page_cumulative_label}</div>
                <div className="mt-1.5 text-[18px] font-medium tabular-nums text-gray-900">{visible ? s.yuebao_page_cumulative_demo : '****'}</div>
              </div>
              <div className="flex flex-col items-end justify-start">
                <div className="text-[13px] text-gray-400 mb-1.5">收益+</div>
                <span className="flex-shrink-0 rounded-full bg-gradient-to-r from-[#FFD700] to-[#FFC107] px-2 py-[2px] text-[10px] font-bold text-[#8B4513] shadow-sm italic">{s.yuebao_page_money_tree}</span>
              </div>
            </div>

            <div className="mt-8 flex gap-4 px-1">
              <button
                type="button"
                className="flex-1 rounded-[6px] border border-orange-500/30 bg-white py-3.5 text-[17px] text-[#FF5000] active:bg-orange-50 tracking-wide"
              >
                {s.yuebao_page_out}
              </button>
              <button
                type="button"
                className="flex-1 rounded-[6px] bg-gradient-to-r from-[#FF8C00] to-[#FF5000] py-3.5 text-[17px] text-white active:opacity-95 tracking-wide shadow-md shadow-orange-500/20"
              >
                {s.yuebao_page_in}
              </button>
            </div>

            <button type="button" className="mt-5 flex w-full items-center justify-center gap-1 text-[13px] text-gray-500 active:text-gray-700">
              <span className="text-[14px] leading-none text-orange-500" aria-hidden>
                🕐
              </span>
              {s.yuebao_page_schedule}
              <IcNavForward size={14} className="text-gray-300 opacity-80" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <button
          type="button"
          className="mt-3 flex w-full items-center gap-3 rounded-[14px] bg-white px-4 py-3.5 text-left shadow-[0_1px_4px_rgba(0,0,0,0.06)] active:bg-gray-50"
        >
          <RedPacketIcon className="h-[22px] w-[22px] flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-medium tracking-wide text-[#1C1C1E]">{s.yuebao_page_subsidy}</div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1 text-[13px] text-[#FF5000]">
            <span className="whitespace-nowrap">{s.yuebao_page_subsidy_claim}</span>
            <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#E83632]" aria-hidden />
            <IcNavForward size={14} className="flex-shrink-0 text-gray-300" strokeWidth={1.5} />
          </div>
        </button>

        <div className="mt-3 rounded-[14px] bg-white px-1.5 py-5 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="grid grid-cols-5 gap-0">
            {iconRow.map(row => (
              <button key={row.key} type="button" className="flex flex-col items-center py-1 active:opacity-85">
                <YuebaoFeatureGlyph kind={row.kind} />
                <span className="mt-2.5 max-w-full px-0.5 text-center text-[12px] leading-tight text-[#1C1C1E] tracking-wide">{row.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-3 overflow-hidden rounded-[16px] border border-[#FFE4E4]/80 bg-gradient-to-b from-[#FFF5F5] via-white to-white px-4 pb-4 pt-7 shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="absolute left-1/2 top-0 z-[1] flex -translate-x-1/2 items-center gap-1 rounded-b-[10px] bg-[#FFE8E8] px-2.5 py-1 text-[10px] font-medium text-[#FF5000]">
            <span>余额宝</span>
            <span className="h-2 w-px bg-[#FF5000]/25" aria-hidden />
            <span>到店支付</span>
          </div>
          <div className="relative z-0 flex items-stretch gap-3 pt-1">
            <div
              className="mt-1 flex h-[88px] w-[58px] flex-shrink-0 flex-col overflow-hidden rounded-[9px] border-[1.5px] border-[#FF4D4F] bg-white"
              aria-hidden
            >
              <div className="flex flex-1 flex-col items-center justify-center bg-white px-1 pt-1">
                <span className="text-[9px] font-medium leading-none text-[#FF5000]">直接打款</span>
                <div className="mt-0.5 flex items-baseline text-[#E83632]">
                  <span className="text-[28px] font-bold leading-none">1</span>
                  <span className="text-[11px] font-bold">元</span>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center bg-gradient-to-r from-[#FF4D4F] to-[#E83632] py-1.5">
                <span className="text-[9px] font-medium text-white">现金奖励</span>
                <svg className="mt-0.5 h-3.5 w-3.5 text-white" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                </svg>
              </div>
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 pt-0.5">
              <div className="text-[17px] font-semibold leading-snug tracking-wide text-[#1C1C1E]">
                {s.yuebao_page_promo_title_before}
                <span className="text-[#FF5000]">{s.yuebao_page_promo_title_highlight}</span>
                {s.yuebao_page_promo_title_after}
              </div>
              <div className="text-[13px] text-gray-500">{s.yuebao_page_promo_sub}</div>
            </div>
            <button
              type="button"
              className="flex-shrink-0 self-center rounded-full bg-gradient-to-r from-[#FF8C00] to-[#FF5000] px-3.5 py-2.5 text-[14px] font-medium text-white shadow-sm"
            >
              <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
                {s.yuebao_page_promo_btn}
                <IcNavForward size={13} strokeWidth={2.2} className="text-white/95" />
              </span>
            </button>
          </div>
        </div>

        {/* 稳健理财：对齐客户端白卡 + 浅灰内嵌条 + 右侧收益率 */}
        <div className="mt-3 overflow-hidden rounded-[16px] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between px-4 pt-4 pb-3">
            <span className="text-[16px] font-semibold tracking-wide text-[#1C1C1E]">{s.yuebao_page_steady}</span>
            <button
              type="button"
              className="inline-flex items-center gap-0.5 text-[12px] font-normal text-[#8B96A3] active:opacity-70"
            >
              {s.yuebao_page_steady_more}
              <IcNavForward size={11} strokeWidth={2.2} className="text-[#8B96A3] opacity-90" />
            </button>
          </div>
          <div className="mx-3 mb-3 flex items-center justify-between rounded-[10px] bg-[#F5F6F8] px-3.5 py-3">
            <span className="text-[15px] font-medium tracking-wide text-[#1C1C1E]">{s.yuebao_page_current_row}</span>
            <span className="text-[19px] font-bold tabular-nums leading-none text-[#E83632]">{s.yuebao_page_current_rate}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
