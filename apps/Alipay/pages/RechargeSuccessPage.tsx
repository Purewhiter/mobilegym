import React from 'react';
import { IcNavBack, IcBuilding, IcCheckCircle } from '../res/icons';
import { memoSelector } from '../../../os/createAppStore';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { useAlipayStore } from '../state';
import { useLocale } from '@/apps/Alipay/locale';
import { localizeBankName } from '../utils/localizeBankName';

const selectRecentRecharges = memoSelector(
  (state: any) => state.transferRecords,
  (recs) => {
    const first = recs.find((r: any) => r.kind === 'recharge');
    if (!first) return [];
    const batchId = (first as any).orderId;
    if (!batchId) return [first];
    return recs.filter((r: any) => r.kind === 'recharge' && r.orderId === batchId);
  },
);

export const RechargeSuccessPage: React.FC = () => {
  const { go, back, bindBack } = useAlipayGestures();
  const s = useAlipayStrings();
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const recentRecharges = useAlipayStore(selectRecentRecharges);
  const amount = recentRecharges.reduce((sum: number, record: any) => sum + Math.abs(record.delta ?? 0), 0);
  const bankCards = useAlipayStore(s => s.bankCards);
  const isMulti = recentRecharges.length > 1;

  if (isMulti) {
    return (
      <div className="bg-white h-full flex flex-col pt-10">
        <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button {...bindBack<HTMLButtonElement>()}>
            <IcNavBack size={24} className="text-gray-800" />
          </button>
          <span className="text-lg font-medium text-gray-900">{s.recharge_success_transfer_result}</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center py-8">
            <div className="w-16 h-16 rounded-full bg-app-primary flex items-center justify-center mb-3">
              <IcCheckCircle size={40} className="text-white" />
            </div>
            <div className="text-base text-gray-900 mb-1">{s.recharge_success_success}</div>
            <div className="text-2xl font-bold text-gray-900">{amount.toFixed(2)}</div>
          </div>

          <div className="px-4">
            {recentRecharges.map((record: any, idx: number) => {
              const card = bankCards.find((c: any) => c.id === record.methodId);
              const cardName = card ? `${localizeBankName(card.bankName, isEnglish)}(${card.last4})` : s.recharge_success_bank_card;
              const recordAmount = Math.abs(record.delta ?? 0);
              return (
                <div key={record.id || idx} className="flex items-center py-4 border-b border-gray-100 last:border-b-0">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 mr-3">
                    <IcBuilding size={20} className="text-app-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{cardName}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{s.recharge_success_success}</div>
                  </div>
                  <div className="text-base font-medium text-gray-900 flex-shrink-0 ml-3">
                    {recordAmount.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="px-6 pb-8 pt-4 flex-shrink-0">
          <button
            className="w-full bg-app-primary text-white font-medium py-3 rounded-full active:opacity-90"
            onClick={() => back()}
          >
            {s.recharge_success_done}
          </button>
        </div>
      </div>
    );
  }

  const cardLabel = (() => {
    const methodId = (recentRecharges[0] as any)?.methodId;
    const card = bankCards.find(c => c.id === methodId);
    return card ? `${localizeBankName(card.bankName, isEnglish)} (${card.last4})` : s.recharge_success_bank_card;
  })();

  return (
    <div className="bg-app-primary h-full flex flex-col text-white pt-10">
      <div className="px-4 py-3 flex items-center justify-between">
        <div />
        <span className="text-lg font-medium">{s.recharge_success_title}</span>
        <button onClick={() => go('recharge.success.toHome')} className="text-sm text-white">{s.recharge_success_home}</button>
      </div>

      <div className="flex flex-col items-center mt-8 mb-10">
        <div className="text-5xl font-bold mb-2">¥{Number(amount).toFixed(2)}</div>
      </div>

      <div className="px-6 flex items-center justify-between text-white/80 text-sm mb-10">
        <span>{s.recharge_success_payment_method}</span>
        <span>{cardLabel}</span>
      </div>

      <div className="flex-1 bg-[#F5F5F5] rounded-t-2xl p-4 space-y-3 overflow-auto">
        <div className="bg-white p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 text-xl">
              🎁
            </div>
            <div>
              <div className="font-medium text-gray-900 text-sm">{s.recharge_success_coupon}</div>
              <div className="text-xs text-orange-500 bg-orange-50 px-1 py-0.5 rounded inline-block mt-1">{s.recharge_success_coupon_hint}</div>
            </div>
          </div>
          <button className="bg-[#FF4D4F] text-white text-xs px-3 py-1.5 rounded-full font-medium">{s.recharge_success_free_claim}</button>
        </div>

        <div className="bg-white p-4 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-xl">
              🛍️
            </div>
            <div>
              <div className="font-medium text-gray-900 text-sm">{s.recharge_success_shopping_coupon}</div>
              <div className="text-xs text-orange-500 bg-orange-50 px-1 py-0.5 rounded inline-block mt-1">{s.recharge_success_shopping_hint}</div>
            </div>
          </div>
          <button className="bg-[#FF4D4F] text-white text-xs px-3 py-1.5 rounded-full font-medium">{s.recharge_success_explore}</button>
        </div>
      </div>

      <div className="px-6 pb-8 pt-4 flex-shrink-0">
        <button
          className="w-full bg-white text-app-primary font-medium py-3 rounded-full shadow-lg active:bg-gray-50"
          onClick={() => go('recharge.success.done', {}, { popTo: '/balance' })}
        >
          {s.recharge_success_done}
        </button>
      </div>
    </div>
  );
};
