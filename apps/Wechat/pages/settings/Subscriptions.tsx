import React from 'react';
import * as TimeService from '../../../../os/TimeService';
import { IcNavForward } from '../../res/icons';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useWechatStore } from '../../state';
import { useAppNavigate } from '../../navigation';
import { useLocale } from '@/os/locale';
import { useWechatStrings } from '../../hooks/useWechatStrings';

export const SubscriptionsPage: React.FC = () => {
  const t = useWechatStrings();
  const { go } = useAppNavigate();
  const { bindTap } = useWechatGestures();
  const locale = useLocale();
  const subs = useWechatStore(s => s.subscriptions);
  const formatActivatedAt = (timestamp: number) => {
    const date = TimeService.fromTimestamp(timestamp);
    if (locale === 'en') {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${t.subscription_activated_on} ${year}-${month}-${day}`;
    }
    return `${t.subscription_activated_on}${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  return (
    <div className="bg-app-bg min-h-full pb-10 flex flex-col">
      <div className="px-6 py-4 text-sm text-gray-500">
          {t.subscription_intro}
      </div>

      <div className="bg-white">
        {subs.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">{t.subscription_empty}</div>
        ) : (
          subs.map(s => (
            <div
                key={s.id}
                className="flex items-center p-4 active:bg-gray-50 border-b border-gray-50 last:border-none cursor-pointer"
                {...bindTap<HTMLDivElement>(
                  'subscription.detail.open',
                  { onTrigger: () => go('subscription.detail.open', { id: s.id }) },
                )}
            >
              <div className="w-10 h-10 rounded-full bg-[#FB7299] flex items-center justify-center text-white font-bold text-xs mr-3 flex-shrink-0">
                  {s.source.slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[16px] font-medium text-black mb-1 truncate">
                  {`${s.membershipType}${t.subscription_membership_line_separator}${t.subscription_yearly_auto_renew}`}
                </div>
                <div className="text-sm text-gray-500">{s.source}</div>
                <div className="text-xs text-gray-400 mt-1">{formatActivatedAt(s.createdAt)}</div>
              </div>
              <IcNavForward size={16} className="text-gray-300 ml-2" />
            </div>
          ))
        )}
      </div>

      <div className="mt-auto py-8 flex justify-center">
          <button className="text-[#576B95] text-sm">{t.subscription_service_center}</button>
      </div>
    </div>
  );
};

