import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcNavBack, IcMoreHorizontal, IcNavForward, IcMessage, IcGift, IcTransfer, IcCheckCircle } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { maskPhone } from '../utils/maskPhone';
import { DefaultAvatar } from '../components/DefaultAvatar';
export const ContactProfilePage: React.FC = () => {
  const s = useAlipayStrings();
  const [searchParams] = useSearchParams();
  const contactId = searchParams.get('contactId');
  const contacts = useAlipayStore(s => s.contacts);
  const { bindTap, bindBack } = useAlipayGestures();

  const contact = contacts.find(c => String(c.id) === String(contactId));

  if (!contact) {
    // Fallback for demo: if no ID matched, try to show the first one or just a placeholder to avoid "Not Found" if possible
    // But better to just show debug info if really missing
    return (
      <div className="flex flex-col items-center justify-center h-screen text-gray-500 pt-20">
        <div>{s.contact_not_found}</div>
        <div className="text-xs mt-2">ID: {contactId || 'null'}</div>
      </div>
    );
  }

  // Parse name format "Display(Real)"
  const displayName = contact.name.split('(')[0];
  const realName = contact.name.includes('(') ? contact.name.split('(')[1].replace(')', '') : contact.info;

  return (
    <div className="bg-app-bg min-h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#DCEAFC] to-app-bg px-4 pt-12 pb-2">
        <div className="flex items-center justify-between mb-6">
          <button {...bindBack<HTMLButtonElement>()}>
            <IcNavBack size={24} className="text-gray-900" />
          </button>
          <div className="flex items-center space-x-3">
             <button className="px-3 py-1 bg-app-surface/50 rounded-full text-xs font-medium text-gray-700">{s.edit_note}</button>
             <button><IcMoreHorizontal size={24} className="text-gray-900" /></button>
          </div>
        </div>

        {/* Profile Card */}
        <div className="bg-app-surface rounded-xl p-6 shadow-sm flex items-start">
            <div className="w-16 h-16 rounded-lg bg-gray-200 overflow-hidden mr-4 flex-shrink-0">
                {contact.avatar ? (
                    <img src={contact.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                    <DefaultAvatar iconSize={30} />
                )}
            </div>
            <div className="flex-1">
                <div className="flex items-center mb-1">
                    <span className="text-xl font-bold text-gray-900 mr-2">{displayName}</span>
                </div>
                <div className="text-xs text-gray-500 mb-1">{s.alipay_account}: {maskPhone(contact.account)}</div>
                <div className="flex items-center text-xs text-gray-500">
                    <span className="mr-2">{s.real_name}: {realName}</span>
                    {contact.verified && (
                        <div className="flex items-center text-app-primary bg-blue-50 px-1 rounded">
                             <span className="mr-0.5">{s.verified}</span>
                        </div>
                    )}
                    {contact.gender === 'male' && <span className="ml-1 text-app-primary">♂</span>}
                </div>
            </div>
        </div>
      </div>

      {/* Menu List */}
      <div className="mt-2 bg-app-surface mx-4 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-50 active:bg-gray-50">
            <span className="text-base text-gray-900">{s.more_info}</span>
            <IcNavForward size={18} className="text-gray-300" />
        </div>
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-50 active:bg-gray-50">
            <span className="text-base text-gray-900">{s.posts}</span>
            <IcNavForward size={18} className="text-gray-300" />
        </div>
        <div className="flex items-center justify-between px-4 py-4 active:bg-gray-50">
            <span className="text-base text-gray-900">{s.transaction_history}</span>
            <IcNavForward size={18} className="text-gray-300" />
        </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="mt-auto px-4 py-2 flex items-center space-x-3">
        <button
          className="flex-1 flex items-center justify-center py-3 bg-white border border-gray-200 rounded-xl text-gray-800 font-medium active:bg-gray-50"
          {...bindTap('chat.open', { params: { id: `conv_p_${contact.id}`, type: 'person' } })}
        >
            <IcMessage size={20} className="mr-1.5 text-gray-500" />
            {s.send_message}
        </button>
        <button className="flex-1 flex items-center justify-center py-3 bg-white border border-gray-200 rounded-xl text-gray-800 font-medium active:bg-gray-50">
            <IcGift size={20} className="mr-1.5 text-gray-500" />
            {s.send_red_packet}
        </button>
        <button
            className="flex-1 flex items-center justify-center py-3 bg-app-primary rounded-xl text-white font-medium active:bg-blue-600"
            {...bindTap('transfer.amount.open', { params: { contactId: String(contact.id) } })}
        >
            <IcTransfer size={20} className="mr-1.5" />
            {s.go_transfer}
        </button>
      </div>
    </div>
  );
};
