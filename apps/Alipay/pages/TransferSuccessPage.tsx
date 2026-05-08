import React from 'react';
import { useLocale } from '@/apps/Alipay/locale';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { IcCheckCircle, IcNavForward } from '../res/icons';
import { useAlipayStore } from '../state';
import { localizePaymentMethodLabel } from '../utils/localizeCatalog';
import { DefaultAvatar } from '../components/DefaultAvatar';

export const TransferSuccessPage: React.FC = () => {
  const transferReceipt = useAlipayStore(state => state.transferReceipt);
  const setTransferReceipt = useAlipayStore(state => state.setTransferReceipt);
  const setTransferDraft = useAlipayStore(state => state.setTransferDraft);
  const { bindTap, go } = useAlipayGestures();
  const s = useAlipayStrings();
  const isEnglish = useLocale() === 'en';
  const amount = transferReceipt?.amount || '0.00';
  const contact = transferReceipt?.contact || { name: s.unknown_user };

  const doneTapProps = bindTap<HTMLButtonElement>('transfer.success.done', {
    onTrigger: () => {
      setTransferReceipt(null);
      setTransferDraft(null);
      go('transfer.success.done', {}, { popTo: '/pay/transfer', popToInclusive: false });
    },
  });

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-app-bg pt-10" data-status-bar-foreground="light">
      <div className="absolute left-0 right-0 top-0 z-0 h-[300px] bg-app-primary" />

      <div className="relative z-10 flex h-full flex-col px-4">
        <div className="mb-4 flex items-center justify-between py-2 text-white">
          <div className="w-10" />
          <div className="flex items-center gap-1">
            <IcCheckCircle size={20} className="text-white" />
            <span className="text-lg font-medium">{s.transfer_successful}</span>
          </div>
          <button {...doneTapProps} className="px-2 text-base font-medium text-white">
            {s.transfersuccesspage_done}
          </button>
        </div>

        <div className="mb-10 text-center text-white">
          <div className="text-5xl font-bold">¥{amount}</div>
        </div>

        <div className="mb-6 flex justify-between px-2 text-sm text-white/90">
          <div className="text-left">
            <div className="mb-1 opacity-80">{s.payee}</div>
            <div className="font-medium">{contact.name}</div>
          </div>
          <div className="text-right">
            <div className="mb-1 opacity-80">{s.payment_method}</div>
            <div className="font-medium">{localizePaymentMethodLabel(transferReceipt?.paymentMethod || s.account_balance, isEnglish)}</div>
          </div>
        </div>

        <div className="mb-4 rounded-xl bg-app-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-medium text-gray-900">{s.notify_payee_now}</span>
            <div className="flex items-center text-sm text-gray-400">
              {s.scheduled_transfer} <IcNavForward size={16} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded bg-gray-200">
                {contact.avatar ? (
                  <img src={contact.avatar} alt={contact.name} className="h-full w-full object-cover" />
                ) : (
                  <DefaultAvatar iconSize={24} />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{contact.name}</span>
                  <span className="text-xs font-medium text-app-primary">{s.note}</span>
                </div>
                <div className="mt-0.5 text-xs text-gray-500">{s.accurate_info_easy_reconciliation}</div>
              </div>
            </div>
            <button className="rounded-full bg-app-primary px-4 py-1.5 text-sm font-medium text-white">
              {s.notify}
            </button>
          </div>
        </div>

        <div className="space-y-3 overflow-y-auto pb-6 no-scrollbar">
          {[
            {
              badge: 'BF',
              badgeColor: 'bg-[#8BC34A]',
              title: s.n_2000g_baba_farm_fertilizer,
              tag: s.baba_farm,
              subtitle: s.limited_double,
              action: s.check_it_out,
              actionStyle: 'bg-[#FF3B30]',
              actionTextClass: 'text-white',
            },
            {
              badge: 'RP',
              badgeColor: 'bg-[#FFD700]',
              title: s.n_7_day_online_payment_red_packet,
              tag: s.alipay,
              subtitle: s.save_0_28_day,
              action: `${isEnglish ? '' : ''}1.96${s.balancepage_cny}`,
              actionStyle: 'bg-transparent',
              actionTextClass: 'text-[#FF3B30] font-bold',
              secondaryAction: s.free,
            },
            {
              badge: 'LC',
              badgeColor: 'bg-purple-100 text-purple-500',
              title: s.n_1_lucky_card,
              tag: s.get_lucky,
              subtitle: s.up_to_100_credit_card_bonus,
              action: s.free,
              actionStyle: 'bg-[#FF3B30]',
              actionTextClass: 'text-white',
            },
          ].map(item => (
            <div key={item.title} className="flex items-center justify-between rounded-xl bg-app-surface p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold text-white ${item.badgeColor}`}>
                  {item.badge}
                </div>
                <div>
                  <div className="font-medium text-gray-900">{item.title}</div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <span className="rounded bg-[#FF6E30]/10 px-1 text-[10px] text-[#FF6E30]">{item.tag}</span>
                    <span className="text-xs text-gray-400">{item.subtitle}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <button className={`rounded-full px-3 py-1.5 text-xs font-medium ${item.actionStyle} ${item.actionTextClass}`}>
                  {item.action}
                </button>
                {item.secondaryAction ? (
                  <button className="mt-1 rounded-full bg-[#FF3B30] px-3 py-1 text-xs font-medium text-white">
                    {item.secondaryAction}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          <div className="h-10" />
        </div>

        <div className="mb-8 mt-auto w-full px-4">
          <button
            {...doneTapProps}
            className="w-full rounded-full border border-app-primary bg-app-surface py-3 font-medium text-app-primary active:bg-blue-50"
            style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
          >
            {s.transfersuccesspage_done}
          </button>
        </div>
      </div>
    </div>
  );
};
