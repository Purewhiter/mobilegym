import React from 'react';
import { useContext } from 'react';
import { useSearchParams, UNSAFE_NavigationContext } from 'react-router-dom';
import { IcNavBack, IcBuilding, IcClose, IcCamera, IcHeadphone, IcSettings, IcSearch, IcSecureCheck } from '../res/icons';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useAlipayStore } from '../state';
import { BANK_OPTIONS, type BankOption } from '../constants';
import BackDispatcher from '../../../os/BackDispatcher';
import { popToAlipayBankCardsList } from '../utils/popToBankCardsList';
import { useLocale } from '@/apps/Alipay/locale';
import { localizeBankName } from '../utils/localizeBankName';

export const AddBankCardPage: React.FC = () => {
  const { go, back } = useAlipayGestures();
  const s = useAlipayStrings();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const [searchParams] = useSearchParams();
  const bankCards = useAlipayStore(s => s.bankCards);
  const returnTo = searchParams.get('returnTo');
  const [query, setQuery] = React.useState('');
  const [selectedBank, setSelectedBank] = React.useState<BankOption | null>(null);
  const [cardNumber, setCardNumber] = React.useState('');
  const [noCardDialog, setNoCardDialog] = React.useState(false);
  const [showExitDialog, setShowExitDialog] = React.useState(false);
  const getBankName = React.useCallback((name: string) => localizeBankName(name, isEnglish), [isEnglish]);
  const getPromo = React.useCallback((promo?: string) => {
    if (!promo || !isEnglish) return promo || '';
    const map: Record<string, string> = {
      '信用卡得10元红包': 'Get a ¥10 credit card bonus',
      '信用卡得15元红包': 'Get a ¥15 credit card bonus',
      '信用卡得8元红包': 'Get a ¥8 credit card bonus',
    };
    return map[promo] || promo;
  }, [isEnglish]);

  React.useEffect(() => {
    if (selectedBank) return;
    if (noCardDialog || showExitDialog) return;
    return BackDispatcher.register('addBankCard.exitIntercept', () => {
      setShowExitDialog(true);
      return true;
    }, 400);
  }, [selectedBank, noCardDialog, showExitDialog]);

  React.useEffect(() => {
    if (!selectedBank) return;
    return BackDispatcher.register('addBankCard.sheet', () => {
      setSelectedBank(null);
      return true;
    }, 500);
  }, [selectedBank]);

  React.useEffect(() => {
    if (!noCardDialog) return;
    return BackDispatcher.register('addBankCard.noCardDialog', () => true, 600);
  }, [noCardDialog]);

  React.useEffect(() => {
    if (!showExitDialog) return;
    return BackDispatcher.register('addBankCard.exitDialog', () => {
      setShowExitDialog(false);
      return true;
    }, 550);
  }, [showExitDialog]);

  const openVerify = (bank: BankOption) => {
    const hasCard = bankCards.some(c => (c as any).bankCode === bank.id && !c.bound);
    if (!hasCard) {
      setNoCardDialog(true);
      return;
    }
    const digits = String(cardNumber || '').replace(/\D/g, '');
    go('bankCards.add.verify.open', {
      bankName: bank.bankName,
      ...(digits.length >= 10 ? { cardNumber: digits } : {}),
      ...(returnTo ? { returnTo } : {}),
    });
  };

  const filtered = React.useMemo(() => {
    const q = query.trim();
    if (!q) return BANK_OPTIONS;
    const lower = q.toLowerCase();
    return BANK_OPTIONS.filter((b) => b.bankName.includes(q) || getBankName(b.bankName).toLowerCase().includes(lower));
  }, [getBankName, query]);

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-bg z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-app-bg px-4 pt-4 pb-3 flex items-center justify-between">
        <button onClick={() => setShowExitDialog(true)} className="p-1 -ml-1 active:opacity-70">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-900">{s.add_bank_card_title}</span>
        <div className="flex items-center gap-1">
          <button className="p-2 -mr-1 active:opacity-70" onClick={() => { }}>
            <IcHeadphone size={18} className="text-gray-700" />
          </button>
          <button className="p-2 -mr-2 active:opacity-70" onClick={() => { }}>
            <IcSettings size={18} className="text-gray-700" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto no-scrollbar px-4 pb-6">
        <div className="bg-app-surface rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <IcSecureCheck size={14} className="text-app-primary" />
            <span>{s.add_bank_card_secure_hint}</span>
          </div>

          <div className="mt-4 flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
            <IcSearch size={16} className="text-gray-300" />
            <input
              value={cardNumber || query}
              onChange={(e) => {
                const v = e.target.value;
                setCardNumber(v);
                setQuery(v);
              }}
              className="flex-1 bg-transparent outline-none text-sm text-gray-900 placeholder:text-gray-400"
              placeholder={s.add_bank_card_search_placeholder}
            />
            <button className="flex items-center gap-1 text-xs text-gray-400 active:opacity-70" onClick={() => { }}>
              <IcCamera size={16} className="text-gray-400" />
              <span>{s.add_bank_card_photo_add}</span>
            </button>
          </div>

          <div className="mt-4 bg-[#F6F7FB] rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-[128px] h-[78px] rounded-2xl bg-white flex items-center justify-center relative overflow-hidden">
                <div className="absolute left-5 top-2 w-[58px] h-[72px] rounded-xl bg-[#EAF2FF] border border-[#DDEBFF]" />
                <div className="absolute left-7 top-7 w-[54px] h-[40px] rounded-xl bg-gradient-to-br from-[#1F6BFF] to-[#0B2B6B] shadow-[0_10px_20px_rgba(0,0,0,0.18)]">
                  <div className="absolute left-3 top-3 w-7 h-7 rounded-full bg-white/15 flex items-center justify-center text-[10px] font-semibold text-white">
                    NFC
                  </div>
                </div>
                <div className="absolute right-4 top-6 w-6 h-6 rounded-full bg-[#EAF2FF] border border-[#DDEBFF]" />
                <div className="absolute right-7 top-9 w-3 h-3 rounded-full bg-[#EAF2FF] border border-[#DDEBFF]" />
                <div className="absolute right-2 bottom-2 text-[10px] text-gray-300">0000</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">{s.add_bank_card_tap_to_add}</div>
                <div className="text-xs text-gray-400 mt-1">{s.add_bank_card_tap_to_add_hint}</div>
              </div>
            </div>
            <button className="h-9 px-4 rounded-full bg-app-primary text-white text-sm font-medium active:bg-app-primary/90">
              {s.add_bank_card_try_now}
            </button>
          </div>
        </div>

        <div className="mt-4 bg-app-surface rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 text-sm font-medium text-gray-900">{s.add_bank_card_quick_add}</div>
          <div className="divide-y divide-gray-100">
            {filtered.map((b) => (
              <div key={b.bankName} className="px-4 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-[#EAF2FF] flex items-center justify-center">
                    <IcBuilding size={18} className="text-app-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{getBankName(b.bankName)}</div>
                    {b.promo ? <div className="text-[11px] text-[#FF7D00] mt-0.5 truncate">{getPromo(b.promo)}</div> : null}
                  </div>
                </div>
                <button
                  className="text-xs px-4 py-1.5 rounded-full bg-[#EAF2FF] text-app-primary active:bg-[#DDEBFF]"
                  onClick={() => setSelectedBank(b)}
                >
                  {s.add_bank_card_add}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="h-6" />
      </div>

      {selectedBank ? (
        <div className="fixed inset-0 z-30">
          <div className="absolute inset-0 bg-black/40" />
          <div className="absolute left-0 right-0 bottom-0 bg-app-surface rounded-t-2xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-[#EAF2FF] flex items-center justify-center">
                  <IcBuilding size={18} className="text-app-primary" />
                </div>
                <div className="min-w-0">
                  <div className="text-base font-medium text-gray-900 truncate">{s.add_bank_card_add_card_title.replace('{bankName}', getBankName(selectedBank.bankName))}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.add_bank_card_sms_verify}</div>
                </div>
              </div>
              <button className="p-2 -mr-2 active:opacity-70" onClick={() => setSelectedBank(null)}>
                <IcClose size={18} className="text-gray-600" />
              </button>
            </div>

            <button
              className="mt-4 w-full h-11 rounded-full bg-app-primary text-white font-medium active:bg-app-primary/90"
              onClick={() => openVerify(selectedBank)}
            >
              {s.add_bank_card_agree_and_add}
            </button>

            <div className="mt-3 text-[11px] text-gray-400 leading-relaxed">
              {s.add_bank_card_agreement_hint}
            </div>
          </div>
        </div>
      ) : null}

      {noCardDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-8">
          <div className="bg-white rounded-2xl w-full max-w-[300px] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 pt-6 pb-5">
              <div className="text-sm text-gray-900 leading-relaxed">{s.add_bank_card_no_card_hint}</div>
            </div>
            <button
              className="w-full py-3 border-t border-gray-100 text-base font-medium text-app-primary active:bg-blue-50"
              onClick={() => setNoCardDialog(false)}
            >
              {s.add_bank_card_confirm}
            </button>
          </div>
        </div>
      )}

      {showExitDialog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center">
          <div className="bg-white rounded-t-2xl w-full max-w-full pb-6 animate-slide-up">
            <div className="text-center text-base font-medium pt-5 pb-4">{s.add_bank_card_exit_title}</div>

            <div className="mx-4 bg-white rounded-xl divide-y divide-gray-100 border border-gray-100">
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="text-sm text-gray-900">{s.add_bank_card_forgot_number}</span>
                <span className="text-sm text-app-primary">{s.add_bank_card_go_add}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="text-sm text-gray-900">{s.add_bank_card_free_insurance}</span>
                <span className="text-sm text-app-primary">{s.add_bank_card_go_view}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="text-sm text-gray-900">{s.add_bank_card_other_issues}</span>
                <span className="text-sm text-app-primary">{s.add_bank_card_feedback}</span>
              </div>
            </div>

            <div className="flex gap-3 px-4 mt-5">
              <button
                className="flex-1 py-3 rounded-full border border-gray-200 text-sm font-medium text-gray-900 active:bg-gray-50"
                onClick={() => {
                  setShowExitDialog(false);
                  if (!popToAlipayBankCardsList(navigator)) {
                    back();
                  }
                }}
              >
                  {s.add_bank_card_quit}
              </button>
              <button
                className="flex-1 py-3 rounded-full bg-app-primary text-sm font-medium text-white active:opacity-90"
                onClick={() => setShowExitDialog(false)}
              >
                  {s.add_bank_card_continue}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
