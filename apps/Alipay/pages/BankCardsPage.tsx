import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcNavBack, IcBuilding, IcAdd, IcClose, IcMore, IcNavForward, IcEye } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useLocale } from '@/apps/Alipay/locale';
import { localizeBankName } from '../utils/localizeBankName';

export const BankCardsPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { bindBack, bindTap } = useAlipayGestures();
  const s = useAlipayStrings();
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const bankCards = useAlipayStore(state => state.bankCards);
  const toast = searchParams.get('toast');
  const showToast = toast === 'card_added';

  const cards = Array.isArray(bankCards) ? bankCards : [];
  const disabledCount = cards.filter((c) => !c.bound).length;
  const primary = cards.find((c) => c.bound) || cards[0];
  const cardCount = cards.length;

  const shortBankName = (name: string) => {
    const localized = localizeBankName(name, isEnglish);
    return localized
      .replace('China ', '')
      .replace('Industrial and Commercial Bank of ', 'ICBC ')
      .replace('Agricultural Bank of ', 'ABC ')
      .replace('Debit Card', '')
      .replace('Credit Card', '')
      .replace('Bank Card', '')
      .replace('中国', '')
      .replace('储蓄卡', '')
      .replace('信用卡', '')
      .trim() || s.bank_cards_page_bank_card_fallback;
  };

  const primaryBank = primary ? shortBankName(primary.bankName) : s.bank_cards_page_bank_card_fallback;
  const primaryLast4 = primary?.last4 ? String(primary.last4) : '0000';

  return (
    <div className="bg-[#F2F3F5] h-full w-full flex flex-col pt-10 relative">
      <div className="absolute left-0 right-0 top-0 h-[420px] bg-gradient-to-br from-[#050B1F] via-[#0B2B6B] to-[#0A4AA6]" />
      <div className="absolute left-0 right-0 top-0 h-[420px] bg-[radial-gradient(circle_at_15%_20%,rgba(255,255,255,0.16),transparent_55%),radial-gradient(circle_at_75%_35%,rgba(255,255,255,0.10),transparent_60%)]" />
      <div className="fixed top-0 left-0 right-0 h-10 bg-transparent z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-transparent px-4 pt-4 pb-3 flex items-center justify-between">
        <button {...bindBack()} className="p-1 -ml-1 active:opacity-70">
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="text-lg font-medium text-white">{s.bank_cards}</span>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 text-sm text-white active:opacity-70" {...bindTap<HTMLButtonElement>('bankCards.add.open')}>
            <IcAdd size={18} className="text-white" />
            <span>{s.bank_cards_page_add_card}</span>
          </button>
          <button className="p-2 -mr-2 active:opacity-70" onClick={() => {}}>
            <IcMore size={18} className="text-white" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar px-4 pb-8 space-y-4 relative z-10">
        <div className="pt-1">
          <div className="text-sm text-white/80 px-1">{s.bank_cards_page_featured_banks}</div>
          <div className="mt-3 flex items-center gap-3">
            <button className="flex-1 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-between px-4 active:bg-white/15">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                  <IcBuilding size={18} className="text-white" />
                </div>
                <span className="text-sm font-medium text-white">{localizeBankName('建设银行', isEnglish)}</span>
              </div>
              <IcNavForward size={16} className="text-white/60" />
            </button>
            <button className="flex-1 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-between px-4 active:bg-white/15">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center">
                  <IcBuilding size={18} className="text-white" />
                </div>
                <span className="text-sm font-medium text-white">{localizeBankName('工商银行', isEnglish)}</span>
              </div>
              <IcNavForward size={16} className="text-white/60" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl overflow-hidden shadow-[0_18px_60px_rgba(0,0,0,0.35)] bg-gradient-to-br from-[#0B2B6B] via-[#0C3E8C] to-[#0B2B6B] text-white">
          <div className="px-5 pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div className="text-4xl font-semibold">{cardCount}</div>
              <div className="text-sm opacity-80">{s.bank_cards_page_cards}</div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm opacity-90">
              <span>{s.bank_cards_page_debit_balance}</span>
              <button className="px-2 py-0.5 rounded-full bg-white/10 active:bg-white/15 text-xs" onClick={() => {}}>
                {s.bank_cards_page_view}
              </button>
            </div>

            <div className="mt-4 rounded-2xl overflow-hidden">
              <div className="bg-white/10 rounded-2xl px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{primaryBank}（{primaryLast4}）</div>
                  <div className="text-xs opacity-80 mt-0.5">{s.bank_cards_page_spending}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs opacity-80">02-26</div>
                  <IcEye size={16} className="text-white/70" />
                </div>
              </div>
              <div className="mt-3 rounded-2xl overflow-hidden bg-gradient-to-br from-[#0EA5E9]/35 to-[#1D4ED8]/25 border border-white/10 relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.18),transparent_55%),radial-gradient(circle_at_80%_60%,rgba(255,255,255,0.10),transparent_60%)]" />
                <div className="relative px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                        <IcBuilding size={18} className="text-white" />
                      </div>
                    <div className="text-base font-semibold">{localizeBankName(primary?.bankName || s.bank_cards_page_bank_card_fallback, isEnglish)}</div>
                    </div>
                    <div className="text-sm font-medium">{s.bank_cards_page_debit_card_label.replace('{last4}', primaryLast4)}</div>
                  </div>
                </div>
                <div className="relative bg-white/10 px-2 py-2 flex items-center">
                  <button className="flex-1 h-10 rounded-xl active:bg-white/10 text-sm" onClick={() => {}}>
                    {s.bank_cards_page_view_balance}
                  </button>
                  <div className="w-px h-6 bg-white/15" />
                  <button className="flex-1 h-10 rounded-xl active:bg-white/10 text-sm" onClick={() => {}}>
                    {s.bank_cards_page_view_number}
                  </button>
                  <div className="w-px h-6 bg-white/15" />
                  <button className="flex-1 h-10 rounded-xl active:bg-white/10 text-sm" onClick={() => {}}>
                    {s.bank_cards_page_view_bill}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <button className="w-full bg-white/5 px-5 py-4 flex items-center justify-between active:bg-white/10">
            <span className="text-sm opacity-90">{s.bank_cards_page_disabled_cards}</span>
            <div className="flex items-center gap-2 text-sm opacity-80">
              <span>{disabledCount}{s.bank_cards_page_disabled_count_suffix}</span>
              <IcNavForward size={16} className="text-white/60" />
            </div>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="h-24 bg-gradient-to-r from-[#FFEFD1] to-[#FFF7E8] flex items-center justify-between px-4">
            <div>
              <div className="text-base font-medium text-gray-900">{s.bank_cards_page_lottery}</div>
              <div className="text-xs text-gray-500 mt-1">{s.bank_cards_page_lottery_hint}</div>
            </div>
            <button className="h-9 px-4 rounded-full bg-[#D29A3A] text-white text-sm font-medium active:bg-[#C58E2F]">
              {s.bank_cards_page_go_draw}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
          <button className="px-4 py-4 flex items-center justify-between active:bg-gray-50">
            <div>
              <div className="text-sm font-medium text-gray-900">{s.bank_cards_page_discount}</div>
              <div className="text-xs text-gray-400 mt-1">{s.bank_cards_page_discount_hint}</div>
            </div>
            <IcNavForward size={16} className="text-gray-300" />
          </button>
        </div>
      </div>

      {showToast ? (
        <div className="fixed left-0 right-0 bottom-8 flex justify-center px-4 pointer-events-none">
          <div className="bg-black/70 text-white text-sm px-4 py-2 rounded-full flex items-center gap-2 pointer-events-auto">
            <span>{s.bank_cards_page_success_toast}</span>
            <button
              className="p-1 -mr-1 active:opacity-70"
              onClick={() => {
                const next = new URLSearchParams(searchParams);
                next.delete('toast');
                setSearchParams(next, { replace: true });
              }}
            >
              <IcClose size={16} className="text-white" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
