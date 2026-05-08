import React from 'react';
import { IcCart, IcInfo, IcCamera, ICON_REGISTRY } from '../res/icons';
import { useEbayGestures } from '../navigation';
import TabBar from '../components/TabBar';
import { useEbayStrings } from '../hooks/useEbayStrings';

const SellPage: React.FC = () => {
  const { bindTap, bindAction } = useEbayGestures();
  const s = useEbayStrings();
  const sellingSteps = [
    { id: 'step1', icon: 'IcCamera', title: s.selling_step1_title, description: s.selling_step1_desc },
    { id: 'step2', icon: 'IcTag', title: s.selling_step2_title, description: s.selling_step2_desc },
    { id: 'step3', icon: 'IcReceipt', title: s.selling_step3_title, description: s.selling_step3_desc },
  ] as const;

  return (
    <div className="h-full bg-app-surface flex flex-col relative">
       {/* Scrollable Content */}
       <div className="flex-1 overflow-y-auto no-scrollbar pb-20" data-scroll-container="sell_content" data-scroll-direction="vertical">
           {/* Header */}
           <div className="px-4 py-2 flex items-center justify-between pt-10">
              <h1 className="text-2xl font-bold text-black">{s.sell_title}</h1>
              <div {...bindTap('cart.open', {})} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                 <IcCart size={20} className="text-app-text" />
              </div>
           </div>

           {/* IcInfo Row */}
           <div className="px-4 mt-6 flex items-center mb-8">
               <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center mr-3">
                   <IcInfo size={12} className="text-white" />
               </div>
               <span className="text-black text-base">{s.sell_info}</span>
           </div>

           {/* Auth Buttons */}
           <div className="px-4 mb-10 flex space-x-4">
               <button 
                   {...bindAction('sell.auth.register')}
                   className="flex-1 border border-blue-600 text-blue-600 rounded-full py-2.5 font-medium"
               >
                   {s.sell_register}
               </button>
               <button 
                   {...bindAction('sell.auth.login')}
                   className="flex-1 border border-blue-600 text-blue-600 rounded-full py-2.5 font-medium"
               >
                   {s.sell_login}
               </button>
           </div>

           {/* How it works */}
           <div className="px-4 pb-20">
               <h2 className="text-lg font-bold mb-6">{s.sell_how_it_works}</h2>
               
               <div className="space-y-8">
                   {sellingSteps.map(step => (
                       <StepItem key={step.id} step={step} />
                   ))}
               </div>
               
               <div className="flex justify-end mt-4">
                   <button 
                       {...bindAction('sell.info.learnMore')}
                       className="text-blue-600 text-base font-medium"
                   >
                       {s.sell_learn_more}
                   </button>
               </div>
           </div>
       </div>

       <TabBar />
    </div>
  );
};

const StepItem = ({ step }: any) => {
    const Icon = ICON_REGISTRY[step.icon] ?? IcCamera;

    return (
        <div className="flex items-start">
            <div className="w-12 h-12 flex items-center justify-center mr-4 flex-shrink-0">
                <Icon size={32} className="text-black" strokeWidth={1.5} />
            </div>
            <div>
                <h3 className="text-base font-bold text-black mb-1">{step.title}</h3>
                <p className="text-black text-sm leading-relaxed">{step.description}</p>
            </div>
        </div>
    );
}

export default SellPage;
