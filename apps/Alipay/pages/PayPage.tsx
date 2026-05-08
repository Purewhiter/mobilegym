import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcNavBack, IcMore, IcScan, IcPiggyBank, IcPay, IcFastPay, IcTransfer } from '../res/icons';
import { RealisticQRCode } from '../components/RealisticQRCode';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
export const PayPage: React.FC = () => {
  const s = useAlipayStrings();
  const { bindTap, bindBack } = useAlipayGestures();

  return (
    <div className="bg-app-primary h-full flex flex-col pt-10" data-status-bar-foreground="light">
      {/* Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between px-4 pt-4 pb-2 text-white bg-app-primary">
        <button {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} />
        </button>
        <div className="flex bg-app-surface/20 rounded-full p-1">
          <button className="px-4 py-1 bg-app-surface text-app-primary rounded-full text-sm font-medium">
            {s.pay_and_receive}
          </button>
          <button className="px-4 py-1 text-white text-sm font-medium">
            {s.payment_rewards}
          </button>
        </div>
        <button>
          <IcMore size={24} />
        </button>
      </div>

      {/* Main Card Area */}
      <div className="flex-1 px-4 mt-4 overflow-auto no-scrollbar">
        {/* Membership Bar */}
        <div className="bg-[#4B9FFF] rounded-t-lg py-1 px-3 flex justify-center items-center">
            <span className="text-white text-xs flex items-center">
              <span className="w-4 h-4 rounded-full bg-app-surface/20 mr-1 flex items-center justify-center text-[10px] font-bold">V</span>
              {s.standard}
            </span>
        </div>

        {/* White Payment Card */}
        <div className="bg-app-surface rounded-b-lg rounded-t-sm p-4 shadow-lg flex flex-col items-center">
          <div className="w-full flex items-center mb-4">
             <IcScan size={20} className="text-gray-600 mr-2" />
             <span className="text-gray-800 font-medium">{s.pay_merchant}</span>
          </div>

          {/* Barcode Placeholder */}
          <div className="w-full h-24 flex items-center justify-center space-x-1 mb-2">
             {Array.from({ length: 40 }).map((_, i) => (
               <div key={i} className="h-16 bg-black" style={{ width: Math.random() * 4 + 1 }}></div>
             ))}
          </div>
          <div className="text-xs text-gray-400 mb-6">{s.tap_to_view_payment_code}</div>

          {/* QR Code */}
          <div className="relative mb-8">
            <div className="border-4 border-gray-800 rounded-lg p-2 bg-app-surface">
              <RealisticQRCode value={'alipay://pay/code/example'} size={192} />
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-app-surface p-1 rounded shadow">
              <div className="text-app-primary font-bold">{s.transferpage_pay}</div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="w-full border-t border-gray-100 pt-3 flex items-center justify-between">
             <div className="flex items-center">
                <IcPiggyBank size={18} className="text-orange-500 mr-2" />
                <div>
                   <div className="text-sm font-medium text-gray-800">{s.yue_bao}</div>
                   <div className="text-xs text-gray-400">{s.prefer_this_payment_method}</div>
                </div>
             </div>
             <IcNavBack size={16} className="text-gray-400 rotate-180" />
          </div>
        </div>
        {/* Bottom Actions */}
        <div className="mt-4 mx-4 bg-[#4B9FFF]/20 rounded-xl overflow-hidden mb-8">
         <button
           className="w-full flex items-center justify-between p-4 bg-app-primary border-b border-white/10 hover:bg-app-primary/90"
           {...bindTap<HTMLButtonElement>('receive.open')}
         >
            <div className="flex items-center text-white">
               <div className="w-8 h-8 rounded-full bg-app-surface/20 flex items-center justify-center mr-3">
                 <IcPay size={18} className="text-white" />
               </div>
               <span className="font-medium">{s.receive}</span>
            </div>
            <IcNavBack size={20} className="text-white/70 rotate-180" />
         </button>

         <button className="w-full flex items-center justify-between p-4 bg-app-primary border-b border-white/10">
            <div className="flex items-center text-white">
               <div className="w-8 h-8 rounded-full bg-app-surface/20 flex items-center justify-center mr-3">
                 <IcFastPay size={18} className="text-white" />
               </div>
               <span className="font-medium">{s.tap_to_pay}</span>
            </div>
            <div className="flex items-center">
               <span className="text-xs text-white/80 mr-2">{s.n_0_68_red_packet_expires_in_10h}</span>
               <span className="w-2 h-2 bg-red-500 rounded-full mr-2"></span>
               <IcNavBack size={20} className="text-white/70 rotate-180" />
            </div>
         </button>

         <button
           className="w-full flex items-center justify-between p-4 bg-app-primary"
           {...bindTap<HTMLButtonElement>('transfer.open')}
         >
            <div className="flex items-center text-white">
               <div className="w-8 h-8 rounded-full bg-app-surface/20 flex items-center justify-center mr-3">
                 <IcTransfer size={18} className="text-white" />
               </div>
               <span className="font-medium">{s.transfer}</span>
            </div>
            <IcNavBack size={20} className="text-white/70 rotate-180" />
         </button>
        </div>
      </div>
    </div>
  );
};
