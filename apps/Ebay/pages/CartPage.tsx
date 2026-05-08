import React from 'react';
import { IcNavBack, IcCart } from '../res/icons';
import { useEbayGestures } from '../navigation';
import { useEbayStrings } from '../hooks/useEbayStrings';

const CartPage: React.FC = () => {
  const { bindBack } = useEbayGestures();
  const s = useEbayStrings();

  return (
    <div className="h-full bg-app-surface flex flex-col">
       {/* Header */}
       <div className="px-4 py-3 pt-10 flex items-center border-b border-gray-100">
          <div {...bindBack()} className="p-1 cursor-pointer mr-4">
             <IcNavBack size={24} className="text-black" />
          </div>
          <h1 className="text-xl font-bold text-black">{s.cart_title}</h1>
       </div>

       {/* Empty State */}
       <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
           <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
               <IcCart size={40} className="text-gray-400" />
           </div>
           <h2 className="text-xl font-bold text-app-text mb-2">{s.cart_empty_title}</h2>
           <p className="text-app-text-muted mb-6">{s.cart_empty_desc}</p>
       </div>
    </div>
  );
};

export default CartPage;
