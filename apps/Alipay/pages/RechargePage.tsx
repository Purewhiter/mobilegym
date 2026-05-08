import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as TimeService from '../../../os/TimeService';
import { IcNavBack, IcBuilding, IcMore, IcNavForward, IcExpand, IcCollapse, IcClose, IcCheck, IcContacts, IcCard } from '../res/icons';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { RechargePaymentModal } from '../components/RechargePaymentModal';
import { MultiCardRechargeModal, type MultiRechargeRow } from '../components/MultiCardRechargeModal';
import { AmountKeyboard } from '../components/AmountKeyboard';
import { useLocale } from '@/apps/Alipay/locale';
import { localizeBankName } from '../utils/localizeBankName';

export const RechargePage: React.FC = () => {
  const { bankCards, recordTransfer } = useAlipayStore();
  const s = useAlipayStrings();
  const paymentPassword = useAlipayStore(s => s.userInfo.paymentPassword);
  const { bindBack, go, back } = useAlipayGestures();
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const [searchParams] = useSearchParams();
  const [amount, setAmount] = useState('');
  const [multiRows, setMultiRows] = React.useState<MultiRechargeRow[] | null>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const [isAmountInputActive, setIsAmountInputActive] = useState(false);
  const [moreExpanded, setMoreExpanded] = useState(false);
  const [cardSelectorOpen, setCardSelectorOpen] = useState(false);
  const getBankName = React.useCallback((name: string) => localizeBankName(name, isEnglish), [isEnglish]);

  const modal = searchParams.get('modal');
  const multiOpen = modal === 'multi' || modal === 'multiPay';
  const isPasswordVisible = modal === 'password';
  const isMultiPayVisible = modal === 'multiPay';

  useEffect(() => {
    const t = setTimeout(() => setIsAmountInputActive(true), 120);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (isAmountInputActive) {
      amountInputRef.current?.focus({ preventScroll: true });
      return;
    }
    amountInputRef.current?.blur();
  }, [isAmountInputActive]);

  const boundCards = bankCards.filter(c => c.bound);
  const [selectedCard, setSelectedCard] = useState<typeof bankCards[number] | null>(boundCards[0] || bankCards[0] || null);

  const openMulti = () => {
    go('recharge.multi.open');
  };

  const closeMulti = () => {
    setMultiRows(null);
    back();
  };

  const handleRecharge = () => {
    if (!amount || Number(amount) <= 0) return;
    if (!selectedCard) {
      go('balance.bankCards.open');
      return;
    }
    go('rechargePassword.open');
  };

  const onPasswordSuccess = () => {
    if (!selectedCard) return;
    const val = Number(amount);
    const batchId = `recharge_${TimeService.now()}_${Math.random().toString(16).slice(2, 8)}`;
    recordTransfer({
      counterpartyName: '充值',
      delta: val,
      kind: 'recharge',
      methodId: selectedCard.id,
      subject: '余额充值',
      displayTitle: '余额充值',
      detailTimeLabel: '创建时间',
      rechargeDescription: '普通充值',
      orderId: batchId,
    });
    go('balance.recharge.success.open');
  };

  const goAddCard = () => {
    go('bankCards.add.open', { returnTo: '/balance/recharge?modal=multi' });
  };

  const onMultiSubmit = (rows: MultiRechargeRow[]) => {
    setMultiRows(rows);
    go('rechargeMultiPay.open');
  };

  const onMultiPaySuccess = () => {
    const rows = multiRows || [];
    const byId = new Map(boundCards.map(c => [c.id, c]));
    const parsed = rows
      .map(r => ({ ...r, v: Math.max(0, Math.round(Number(r.amount) * 100) / 100) }))
      .filter(r => r.v > 0 && byId.has(r.cardId));

    setMultiRows(null);

    const batchId = `recharge_${TimeService.now()}_${Math.random().toString(16).slice(2, 8)}`;
    for (const r of parsed) {
      recordTransfer({
        counterpartyName: '充值',
        delta: r.v,
        kind: 'recharge',
        methodId: r.cardId,
        subject: '余额充值',
        displayTitle: '多卡充值',
        detailTimeLabel: '创建时间',
        productDescription: '多卡充值',
        orderId: batchId,
      });
    }

    go('balance.recharge.success.open');
  };

  const handleAmountKey = (key: string) => {
    setAmount(prev => {
      if (key === '.') {
        if (prev.includes('.')) return prev;
        return prev === '' ? '0.' : prev + '.';
      }
      if (prev === '0') return key;
      const next = prev + key;
      if (/^\d+\.\d{3,}$/.test(next)) return prev;
      return next;
    });
  };

  const handleAmountDelete = () => {
    setAmount(prev => prev.slice(0, -1));
  };

  return (
    <div className="bg-app-bg h-full flex flex-col pt-10 overflow-hidden">
      <div className="bg-app-surface px-4 py-3 flex items-center justify-between flex-shrink-0">
        <button {...bindBack<HTMLButtonElement>()}><IcNavBack size={24} /></button>
        <span className="text-lg font-medium">{s.recharge_page_title}</span>
        <button><IcMore size={24} /></button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        <div className="text-sm text-gray-500 px-1">{s.recharge_page_method}</div>

        {/* Card Selection */}
        <div className="bg-white p-4 rounded-xl flex items-center justify-between active:bg-gray-50" onClick={() => setCardSelectorOpen(true)}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <IcBuilding className="text-[#E60012]" size={20} />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-gray-900 truncate">
                {selectedCard ? `${getBankName(selectedCard.bankName)} (${selectedCard.last4})` : s.recharge_page_add_card}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{s.recharge_page_limit_hint}</div>
            </div>
          </div>
          <IcNavForward size={16} className="text-gray-400 flex-shrink-0" />
        </div>

        {/* Amount Input */}
        <div className="bg-white p-6 rounded-xl overflow-hidden">
          <div className="text-sm text-gray-900 mb-6">{s.recharge_page_amount}</div>
          <div
            className="flex items-end border-b border-gray-100 pb-2"
            onClick={() => setIsAmountInputActive(true)}
          >
            <span className="text-3xl font-bold mr-2 mb-1 flex-shrink-0">¥</span>
            <input
              ref={amountInputRef}
              inputMode="none"
              className="text-4xl font-bold bg-transparent outline-none w-full min-w-0 placeholder-gray-200 caret-[#1677FF] appearance-none"
              value={amount}
              onChange={e => {
                const v = e.target.value;
                if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setAmount(v);
              }}
              type="text"
              placeholder=""
            />
          </div>

          <div className="mt-4 flex items-center justify-between py-2 -mx-2 px-2">
            <span className="text-sm text-gray-900">{s.recharge_page_bank_fast_top_up} <span className="text-gray-400 ml-2">{s.recharge_page_bank_fast_hint}</span></span>
          </div>

          {moreExpanded && (
            <div className="flex items-center justify-between py-2 active:bg-gray-50 rounded-lg -mx-2 px-2" onClick={openMulti}>
              <span className="text-sm text-gray-900">{s.recharge_page_multi_card} <span className="text-gray-400 ml-2">{s.recharge_page_multi_card_hint}</span></span>
              <IcNavForward size={16} className="text-gray-400 flex-shrink-0" />
            </div>
          )}

          <button
            className="w-full flex items-center justify-center gap-1 py-2 text-xs text-gray-400 active:text-gray-500"
            onClick={() => setMoreExpanded(v => !v)}
          >
            <span>{moreExpanded ? s.recharge_page_collapse : s.recharge_page_expand}</span>
            {moreExpanded
              ? <IcCollapse size={14} className="text-gray-400" />
              : <IcExpand size={14} className="text-gray-400" />
            }
          </button>
        </div>

      </div>

      {!isAmountInputActive && (
        <div className="px-4 py-3 flex-shrink-0">
          <button
            className="w-full bg-app-primary text-white py-3 rounded-full font-medium text-lg disabled:opacity-50 shadow-lg shadow-blue-200 active:scale-[0.98] transition-transform"
            disabled={!amount || Number(amount) <= 0}
            onClick={handleRecharge}
          >
            {s.recharge_page_confirm}
          </button>
        </div>
      )}

      <AmountKeyboard
        onInput={handleAmountKey}
        onDelete={handleAmountDelete}
        confirmLabel={s.recharge_page_confirm}
        confirmEnabled={!!amount && Number(amount) > 0}
        onConfirm={handleRecharge}
        actionPrefix="recharge"
        open={isAmountInputActive}
        onToggle={setIsAmountInputActive}
      />

      <RechargePaymentModal
        visible={isPasswordVisible}
        amount={amount}
        card={selectedCard ?? undefined}
        expectedPassword={paymentPassword}
        actionVariant="single"
        onSuccess={onPasswordSuccess}
        onClose={() => back()}
      />

      <MultiCardRechargeModal
        visible={multiOpen}
        totalAmount={amount}
        boundCards={boundCards}
        onClose={closeMulti}
        onAddMoreCards={goAddCard}
        onSubmit={onMultiSubmit}
      />

      <RechargePaymentModal
        visible={isMultiPayVisible}
        amount={((multiRows || []).reduce((s, r) => s + (Number(r.amount) || 0), 0) || 0).toFixed(2)}
        expectedPassword={paymentPassword}
        actionVariant="multi"
        onSuccess={onMultiPaySuccess}
        onClose={() => back()}
      />

      {/* Card Selector Sheet */}
      {cardSelectorOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-end justify-center" onClick={() => setCardSelectorOpen(false)}>
          <div
            className="w-full max-w-[480px] bg-white rounded-t-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '70vh' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 pt-4 pb-3 flex items-center justify-between flex-shrink-0">
              <div className="w-6" />
              <div className="text-base font-medium text-gray-900">{s.recharge_page_select_method}</div>
              <button className="p-1 -mr-1 active:opacity-70" onClick={() => setCardSelectorOpen(false)}>
                <IcClose size={22} className="text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {boundCards.map(card => {
                const isSelected = selectedCard?.id === card.id;
                return (
                  <button
                    key={card.id}
                    className="w-full flex items-center px-4 py-4 border-b border-gray-100 active:bg-gray-50"
                    onClick={() => { setSelectedCard(card); setCardSelectorOpen(false); }}
                  >
                    <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mr-3">
                      <IcBuilding size={20} className="text-app-primary" />
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-medium text-gray-900 truncate">{getBankName(card.bankName)} ({card.last4})</div>
                      <div className="text-xs text-gray-400 mt-0.5">{s.recharge_page_bank_limit}</div>
                    </div>
                    {isSelected && <IcCheck size={20} className="text-app-primary flex-shrink-0 ml-3" />}
                  </button>
                );
              })}

              <button className="w-full flex items-center px-4 py-4 border-b border-gray-100 active:bg-gray-50">
                <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0 mr-3">
                  <IcContacts size={20} className="text-app-primary" />
                </div>
                <div className="flex-1 text-left text-sm text-gray-900">{s.recharge_page_ask_family}</div>
              </button>

              <button
                className="w-full flex items-center px-4 py-4 active:bg-gray-50"
                onClick={() => { setCardSelectorOpen(false); go('bankCards.add.open', { returnTo: '/balance/recharge' }); }}
              >
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mr-3">
                  <IcCard size={20} className="text-gray-500" />
                </div>
                <div className="flex-1 text-left text-sm text-gray-900">{s.recharge_page_add_debit_card}</div>
                <IcNavForward size={16} className="text-gray-400 flex-shrink-0" />
              </button>
            </div>

            <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} />
          </div>
        </div>
      )}
    </div>
  );
};
