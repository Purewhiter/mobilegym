import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import * as TimeService from '../../../../os/TimeService';
import { IcNavForward } from '../../res/icons';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useWechatStore } from '../../state';
import { useLocale } from '@/os/locale';
import { useWechatStrings } from '../../hooks/useWechatStrings';

export const SubscriptionDetailPage: React.FC = () => {
  const t = useWechatStrings();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { bindTap, bindBack, back } = useWechatGestures();
  const locale = useLocale();

  const subs = useWechatStore(store => store.subscriptions);
  const updateSubscription = useWechatStore(store => store.updateSubscription);
  const sub = subs.find(item => item.id === id);
  const showDialog = searchParams.get('modal') === 'cancel_confirm';

  if (!sub) {
    return (
      <div className="bg-app-bg min-h-full flex items-center justify-center px-6 py-10 text-sm text-gray-500">
        {t.subscription_detail_not_found}
      </div>
    );
  }

  const serviceDescriptionText = t.subscription_service_description_template
    .replace(/\{\{price\}\}/g, String(sub.price))
    .replace(/\{\{cycle\}\}/g, sub.billingCycle);

  const handleConfirmClose = () => {
    updateSubscription(id!, { autoRenew: false });
    back();
  };

  const ListItem = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between py-4 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="text-black max-w-[60%] text-right">{value}</span>
    </div>
  );

  return (
    <div className="bg-app-bg min-h-full flex flex-col">
      <div className="flex flex-col items-center pt-8 pb-6 bg-white mb-2">
        <div className="w-16 h-16 rounded-full bg-[#FB7299] flex items-center justify-center text-white font-bold text-2xl mb-4">
          {sub.source.slice(0, 1)}
        </div>
        <div className="text-xl font-bold text-black mb-2">
          {`${sub.membershipType}${t.subscription_membership_line_separator}${t.subscription_yearly_auto_renew}`}
        </div>
        <div className="text-sm text-gray-500">{sub.source}</div>
      </div>

      <div className="bg-white px-6 mb-2">
        <ListItem
          label={t.subscription_detail_current_status}
          value={sub.autoRenew ? t.subscription_detail_status_active : t.subscription_detail_status_disabled}
        />
        <ListItem
          label={t.subscription_detail_activated_at}
          value={TimeService.fromTimestamp(sub.createdAt).toLocaleString(locale === 'en' ? 'en-US' : undefined)}
        />
        <ListItem label={t.subscription_detail_account} value="1079284754" />
        <ListItem label={t.subscription_detail_service_intro} value={serviceDescriptionText} />
      </div>

      <div className="bg-white px-6 flex justify-between items-center py-4 mb-2">
        <span className="text-sm text-gray-500">{t.subscription_detail_payment_method}</span>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-[#F6C02C] flex items-center justify-center text-white text-[10px]">
            ¥
          </div>
          <span className="text-sm text-black">{t.subscription_detail_balance}</span>
          <IcNavForward size={16} className="text-gray-300" />
        </div>
      </div>

      <div className="bg-white px-6 flex justify-between items-center py-4 mb-8">
        <span className="text-sm text-black">{t.subscription_detail_billing_history}</span>
        <IcNavForward size={16} className="text-gray-300" />
      </div>

      {sub.autoRenew && (
        <div className="mt-auto pb-10 px-4">
          <button
            className="w-full py-3 text-[#576B95] text-[17px] bg-[#F2F2F2] rounded-lg active:bg-gray-200"
            {...bindTap<HTMLButtonElement>('subscription.cancel', { params: { id: id! } })}
          >
            {t.subscription_detail_stop_billing}
          </button>
        </div>
      )}

      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white w-[300px] rounded-xl overflow-hidden">
            <div className="p-6 text-center">
              <div className="text-lg font-bold mb-2">{t.subscription_cancel_confirm_title}</div>
              <div className="text-sm text-gray-500">{t.subscription_cancel_confirm_body}</div>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                className="flex-1 py-4 text-black text-[17px] active:bg-gray-50 border-r border-gray-100"
                {...bindBack<HTMLButtonElement>()}
              >
                {t.subscription_cancel_think_again}
              </button>
              <button
                className="flex-1 py-4 text-[#FA5151] text-[17px] font-medium active:bg-gray-50"
                {...bindTap<HTMLButtonElement>(
                  { kind: 'action', id: 'subscription.cancel.confirm' },
                  { onTrigger: handleConfirmClose },
                )}
              >
                {t.subscription_cancel_still_close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
