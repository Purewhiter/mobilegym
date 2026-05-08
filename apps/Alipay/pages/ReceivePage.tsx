import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcNavBack, IcMore, IcCollapse, IcExpand, IcPay, IcUser, IcFile, IcBuilding, IcApp, IcGift } from '../res/icons';
import { useAlipayStore } from '../state';
import { RealisticQRCode } from '../components/RealisticQRCode';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
export const ReceivePage: React.FC = () => {
  const s = useAlipayStrings();
  const { bindBack } = useAlipayGestures();
  const userInfo = useAlipayStore(s => s.userInfo);

  // Extract last char of name for display (e.g. "**辰")
  const displayName = userInfo.name.length > 0 ? `**${userInfo.name.slice(-1)}` : '**';

  return (
    <div className="bg-[#FE8C32] h-full flex flex-col pb-safe pt-10">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 pt-4 pb-2 text-white bg-[#FE8C32]">
        <button {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} />
        </button>
        <span className="text-lg font-medium">{s.receive}</span>
        <button>
          <IcMore size={24} />
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto no-scrollbar">
      {/* Main Card */}
      <div className="mx-4 mt-4 bg-app-surface rounded-lg p-6 flex flex-col items-center shadow-lg min-h-[400px]">
         <div className="w-full flex justify-between items-center mb-6">
            <div className="flex items-center text-gray-800">
               <div className="w-6 h-6 rounded bg-app-surface border border-app-border flex items-center justify-center mr-2">
                 <IcPay size={16} className="text-gray-800" />
               </div>
               <span className="font-medium">{s.personal_receive}</span>
            </div>
            <IcCollapse size={20} className="text-gray-400" />
         </div>

         <div className="text-gray-500 text-sm mb-4">{displayName}</div>

         {/* QR Code */}
         <div className="relative mb-8">
            <div className="border-8 border-black p-2 bg-app-surface">
              <RealisticQRCode value={'alipay://receive/user'} size={224} />
            </div>
            {/* Center Avatar */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-app-surface rounded p-0.5 border-2 border-white shadow">
               <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded">
                 <IcUser size={22} className="text-gray-500" />
               </div>
               <div className="absolute -bottom-1 -right-1 bg-app-primary text-white text-[8px] px-1 py-0.5 rounded">
                 {s.transferpage_pay}
               </div>
            </div>
         </div>

         {/* Actions */}
         <div className="w-full flex justify-center space-x-12 text-app-primary text-sm">
            <button>{s.set_amount}</button>
            <div className="w-[1px] h-4 bg-gray-200"></div>
            <button>{s.save_image}</button>
         </div>

         <div className="mt-8 w-full border-t border-gray-100 pt-4 flex items-center justify-between text-gray-800">
            <div className="flex items-center">
               <IcFile size={18} className="text-gray-700 mr-2" />
               <span>{s.payment_records}</span>
            </div>
            <IcNavBack size={16} className="text-gray-400 rotate-180" />
         </div>
      </div>

      {/* Bottom Menu Items */}
      <div className="mx-4 mt-4 space-y-3">
         <div className="bg-app-surface rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center">
               <IcBuilding size={20} className="text-gray-800 mr-3" />
               <span className="font-medium text-gray-800">{s.business_receive}</span>
            </div>
            <div className="flex items-center">
               <span className="text-xs text-gray-400 mr-2">{s.supports_credit_card_huabei}</span>
               <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
               <IcExpand size={16} className="text-gray-400" />
            </div>
         </div>

         <div className="bg-app-surface rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center">
               <IcApp size={20} className="text-gray-800 mr-3" />
               <span className="font-medium text-gray-800">{s.enable_merchant_services}</span>
            </div>
            <div className="flex items-center">
               <span className="text-xs text-gray-400 mr-2">{s.free_withdrawal_benefits}</span>
               <IcNavBack size={16} className="text-gray-400 rotate-180" />
            </div>
         </div>

         {/* Ad Banner */}
         <div className="bg-app-surface rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center space-x-3">
               <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                 <IcGift size={18} className="text-app-primary" />
               </div>
               <div>
                  <div className="text-sm font-medium text-gray-800">{s.get_the_payment_ring_first}</div>
                  <div className="text-xs text-gray-500">{s.earn_up_to_140_via_tap_receive}</div>
               </div>
            </div>
            <button className="bg-app-primary text-white text-xs px-3 py-1.5 rounded">{s.go_now}</button>
         </div>
      </div>
      </div>
    </div>
  );
};
