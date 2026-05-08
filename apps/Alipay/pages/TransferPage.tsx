import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcNavBack, IcNavForward, IcMore, IcSearch, IcScan, IcClock, IcCard, IcHeart, IcWallet, IcCalendar, IcContacts, IcFeature, IcEye, IcQrCode, IcTransfer } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { dimens } from '../res/dimens';
import { getRecentTransferContacts } from '../utils/transferContacts';
import { maskPhone } from '../utils/maskPhone';
import { useLocale } from '@/apps/Alipay/locale';
import { DefaultAvatar } from '../components/DefaultAvatar';

export const TransferPage: React.FC = () => {
  const contacts = useAlipayStore(s => s.contacts);
  const transferRecords = useAlipayStore(s => s.transferRecords);
  const setTransferDraft = useAlipayStore(s => s.setTransferDraft);
  const { bindTap, bindBack } = useAlipayGestures();
  const s = useAlipayStrings();
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const recentTransferContacts = React.useMemo(
    () => getRecentTransferContacts(contacts, transferRecords),
    [contacts, transferRecords],
  );
  const visibleContacts = recentTransferContacts.length > 0 ? recentTransferContacts : contacts;
  const brandMark = isEnglish ? 'A' : '支';

  return (
    <div className="bg-app-bg h-full w-full flex flex-col overflow-x-hidden pt-10">
      {/* Fixed Top Bar */}
      <div className="fixed top-10 left-0 right-0 z-30 bg-app-bg px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button {...bindBack<HTMLButtonElement>()} className="mr-2">
              <IcNavBack size={24} className="text-gray-800" />
            </button>
            <span className="text-lg font-medium text-gray-800">{s.transfer}</span>
          </div>
          <div className="flex items-center space-x-3">
             <button className="bg-gray-200 p-1 rounded-full"><IcMore size={20} className="text-gray-600" /></button>
             <button className="bg-gray-200 p-1 rounded-full"><IcClock size={20} className="text-gray-600" /></button>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto no-scrollbar px-4">
        {/* Spacer to avoid overlap with fixed header */}
        <div className="h-14"></div>
        {/* Protection Status */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
           <div className="flex items-center text-app-primary">
              <div className="w-3 h-3 bg-app-primary rounded-full flex items-center justify-center text-white mr-1">✓</div>
              {s.transfer_protection_off}
              <IcNavForward size={12} />
           </div>
           <div className="flex items-center">
              <span>{s.transfer_history}</span>
           </div>
        </div>

        {/* IcSearch Bar */}
        <div className="bg-app-surface rounded-full flex items-center px-4 py-2.5 mb-6">
           <IcSearch size={18} className="text-gray-400 mr-2" />
           <input 
             type="text" 
             placeholder={s.enter_phone_card_number_or_name_to_transfer} 
             className="w-full bg-transparent border-none outline-none text-sm"
           />
        </div>

        {/* Action Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
           <div 
             className="bg-app-primary rounded-lg p-3 text-white flex flex-col justify-between h-20"
             {...bindTap<HTMLDivElement>('transfer.toAccount.open')}
           >
              <div className="flex items-center space-x-1">
                 <span className="w-5 h-5 rounded bg-app-surface/20 flex items-center justify-center text-xs font-bold">{brandMark}</span>
                 <span className="font-medium text-sm whitespace-nowrap">{s.to_alipay}</span>
              </div>
              <span className="text-[10px] opacity-80">{s.no_fees}</span>
           </div>
           
           <div className="bg-[#FF7D00] rounded-lg p-3 text-white flex flex-col justify-between h-20">
              <div className="flex items-center space-x-1">
                 <IcCard size={18} className="text-white" />
                 <span className="font-medium text-sm whitespace-nowrap">{s.to_bank_card}</span>
              </div>
              <span className="text-[10px] opacity-80">{s.instant_arrival}</span>
           </div>

           <div className="bg-app-secondary rounded-lg p-3 text-white flex flex-col justify-between h-20 relative">
              <div className="flex items-center space-x-1">
                 <IcScan size={18} className="text-white" />
                 <span className="font-medium text-sm whitespace-nowrap">{s.qr_transfer}</span>
              </div>
              <div className="flex -space-x-2 mt-1">
                 <div className="w-5 h-5 rounded-full bg-app-surface/95 flex items-center justify-center border border-white shadow-sm">
                   <IcQrCode size={12} className="text-app-secondary" strokeWidth={dimens.icStrokeWidth} />
                 </div>
                 <div className="w-5 h-5 rounded-full bg-app-surface/95 flex items-center justify-center border border-white shadow-sm">
                   <IcTransfer size={12} className="text-app-primary" strokeWidth={dimens.icStrokeWidth} />
                 </div>
                 <div className="w-5 h-5 rounded-full bg-app-surface/95 flex items-center justify-center border border-white shadow-sm">
                   <span className="text-[10px] font-bold text-app-primary">{brandMark}</span>
                 </div>
              </div>
           </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="bg-app-surface rounded-lg p-4 grid grid-cols-5 gap-4 mb-6">
           {[
             { name: s.scheduled_transfer, Icon: IcCalendar },
             { name: s.transfer_to_multiple, Icon: IcContacts },
             { name: s.little_wallet, Icon: IcWallet },
             { name: s.dadada, Icon: IcFeature, badge: 'NEW' },
             { name: s.family_card, Icon: IcHeart },
           ].map((item, i) => (
              <div key={i} className="flex flex-col items-center relative">
                {item.badge && <span className="absolute -top-2 -right-1 bg-red-500 text-white text-[8px] px-1 rounded">{item.badge}</span>}
                <item.Icon size={22} className="text-gray-800 mb-1" strokeWidth={1.75} />
                <span className="text-xs text-gray-600 scale-90 whitespace-nowrap">{item.name}</span>
              </div>
            ))}
           <div className="col-span-5 flex justify-center mt-2">
              <div className="w-8 h-1 bg-gray-200 rounded-full"></div>
           </div>
        </div>

        {/* Contacts Section */}
        <div className="flex items-center space-x-6 mb-4 px-2">
           <div className="flex flex-col items-center border-b-2 border-app-primary pb-1">
              <span className="text-app-primary font-medium text-sm">{s.recent}</span>
           </div>
           <span className="text-gray-500 text-sm">{s.contacts}</span>
           <span className="text-gray-500 text-sm">{s.tabbar_me}</span>
           <div className="flex-1"></div>
           <IcEye size={18} className="text-gray-400" />
        </div>

        {/* IcContact List */}
        <div className="bg-app-surface rounded-t-xl min-h-[300px] p-4">
           {visibleContacts.map((contact) => (
             <div
               key={contact.id}
               className="flex items-center py-3 border-b border-gray-50 active:bg-gray-50"
               {...bindTap<HTMLDivElement>('transfer.amount.open', {
                 params: { contactId: String(contact.id) },
                 beforeTrigger: () => setTransferDraft({ contact, inputValue: contact.name }),
               })}
             >
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mr-3 overflow-hidden">
                   {contact.avatar ? (
                     <img src={contact.avatar} alt={contact.name} className="w-full h-full object-cover" />
                   ) : (
                     <DefaultAvatar iconSize={20} />
                   )}
                </div>
                <div>
                   <div className="text-sm font-medium text-gray-800">{contact.name}</div>
                   <div className="text-xs text-gray-400 mt-0.5">{maskPhone(contact.phone) || maskPhone(contact.account) || maskPhone(contact.info || '')}</div>
                </div>
             </div>
           ))}
        </div>
      </div>

    </div>
  );
};
