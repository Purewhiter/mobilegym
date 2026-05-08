import React from 'react';
import { dimens } from '../res/dimens';
import { useWechatStrings } from '../hooks/useWechatStrings';
import { IcScan, IcWallet } from '../res/icons';
import { getServicesData } from '../constants';
import { useWechatGestures } from '../hooks/useWechatGestures';

const Services: React.FC = () => {
  const t = useWechatStrings();
  const { bindTap } = useWechatGestures();
  const servicesData = getServicesData(t);

  return (
    <div className="bg-app-bg min-h-screen pb-4">
      {/* Top Green Card */}
      <div className="bg-[#07C160] p-0 m-2 rounded-lg text-white overflow-hidden relative">
        <div className="flex h-28">
           <div className="flex-1 flex flex-col items-center justify-center gap-2 active:bg-white/10">
              <IcScan size={28} strokeWidth={1.5} />
              <span className="text-[15px] font-medium">{t.me_pay}</span>
           </div>
           <div
             className="flex-1 flex flex-col items-center justify-center gap-2 active:bg-white/10 cursor-pointer"
             {...bindTap<HTMLDivElement>('wallet.open')}
           >
              <IcWallet size={28} strokeWidth={1.5} />
              <span className="text-[15px] font-medium">{t.service_wallet}</span>
           </div>
        </div>
      </div>

      {/* Grid Sections */}
      {servicesData.map((group, groupIdx) => (
        <div key={groupIdx} className="bg-app-surface mx-2 mb-2 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-(--app-c-tw-border-gray-50) text-(--app-search-filter-text-size) font-medium text-(--app-c-tw-text-gray-500)">
            {group.title}
          </div>
          <div className="grid grid-cols-4 gap-y-6 py-6">
            {group.items.map((item, idx) => (
              <div key={idx} className="flex flex-col items-center justify-center space-y-2 active:opacity-60">
                <item.icon size={dimens.icSizeService} className={item.color} strokeWidth={1.5} />
                <span className="text-xs text-(--app-c-tw-text-gray-700) mt-1">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Services;
