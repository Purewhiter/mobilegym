import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcNavBack, IcHeadphone, IcContact, IcExpand, IcUser } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { getRecentTransferContacts } from '../utils/transferContacts';
import { maskPhone } from '../utils/maskPhone';
import { DefaultAvatar } from '../components/DefaultAvatar';
export const TransferToAlipayPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const modal = searchParams.get('modal');
  const contacts = useAlipayStore(s => s.contacts);
  const transferRecords = useAlipayStore(s => s.transferRecords);
  const setTransferDraft = useAlipayStore(s => s.setTransferDraft);
  const { bindTap, bindBack } = useAlipayGestures();
  const s = useAlipayStrings();
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isContactModalOpen = modal === 'contacts';
  const isErrorModalOpen = modal === 'accountNotFound';
  const recentTransferContacts = React.useMemo(
    () => getRecentTransferContacts(contacts, transferRecords),
    [contacts, transferRecords],
  );
  const visibleRecentContacts = recentTransferContacts.length > 0 ? recentTransferContacts : contacts;

  const matchedContact = contacts.find(
    contact => {
      if (contact.phone === inputValue || contact.account === inputValue) return true;
      const displayName = contact.name.replace(/\([^)]*\)/g, '').trim();
      const innerName = contact.name.match(/\(([^)]+)\)/)?.[1]?.trim();
      const info = String(contact.info || '').trim();
      return (
        contact.name === inputValue ||
        displayName === inputValue ||
        (innerName != null && innerName === inputValue) ||
        (info.length > 0 && info === inputValue)
      );
    },
  );
  const confirmTapProps =
    matchedContact && inputValue
      ? bindTap<HTMLButtonElement>('transfer.amount.open', {
          params: { contactId: String(matchedContact.id) },
          beforeTrigger: () => setTransferDraft({ contact: matchedContact, inputValue }),
        })
      : bindTap<HTMLButtonElement>('transferToAccount.error.open');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 120);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="bg-app-bg h-full w-full flex flex-col relative overflow-x-hidden pt-10">
      {/* Status bar overlay to match header background */}
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-bg z-10 pointer-events-none"></div>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-app-bg px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
        <button {...bindBack<HTMLButtonElement>()} className="p-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <button className="p-1">
          <IcHeadphone size={24} className="text-gray-800" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-4 pt-8">
        <div className="text-center mb-8">
            <h1 className="text-xl font-bold text-gray-900 mb-2">{s.enter_payees_alipay_account}</h1>
            <p className="text-sm text-gray-500">{s.please_verify_account_info_funds_will_arrive}</p>
        </div>

        {/* Input Field Area */}
        <div className="bg-app-surface rounded-none border-b border-app-border flex items-center py-4 mb-4">
            <span className="text-base font-medium text-gray-900 mr-4 min-w-[4rem]">{s.payees_account}</span>
            <input 
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={s.phone_name_alipay_account}
                data-action="transferToAccount.account.input"
                data-action-type="input"
                data-action-params={JSON.stringify({ value: inputValue })}
                className="flex-1 text-lg bg-transparent border-none outline-none text-gray-900 placeholder-gray-300"
            />
            <button className="bg-app-primary p-1 rounded-sm">
                <IcUser size={16} className="text-white" />
            </button>
        </div>

        <div className="flex justify-center mb-8">
            <button
              className="text-gray-400 text-sm flex items-center"
              {...bindTap<HTMLButtonElement>('transferToAccount.recentContacts.open')}
            >
                {s.recent_contacts} <IcExpand size={14} className="ml-1" />
            </button>
        </div>

        <button 
 className={`w-full py-3 rounded-full text-white font-medium text-lg mb-4 ${inputValue ? 'bg-app-primary' : 'bg-app-primary/50 cursor-not-allowed'}`}
 style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
            disabled={!inputValue}
            {...(inputValue ? confirmTapProps : {})}
        >
            {s.confirm}
        </button>
        
        <div className="flex items-center justify-center text-app-primary text-sm mt-auto pb-8">
            <button>{s.transfer_without_account}</button>
            <span className="mx-4 text-gray-300">|</span>
            <button>{s.transfer_to_multiple}</button>
        </div>
      </div>

      {/* IcContact Selection Modal */}
      {isContactModalOpen && (
        <div className="absolute inset-0 z-50 flex items-end">
            <div
              {...bindBack<HTMLDivElement>({ stopPropagation: true })}
              className="absolute inset-0 bg-black/40"
            ></div>
            <div className="relative w-full bg-app-surface rounded-t-xl overflow-hidden animate-slide-up max-h-[70%] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-gray-100">
                    <span className="text-lg font-medium">{s.select_recent_contact}</span>
                    <button {...bindBack<HTMLButtonElement>({ stopPropagation: true })}>
                      <IcExpand size={24} className="text-gray-400" />
                    </button>
                </div>
                <div className="p-4 bg-gray-50 text-sm text-gray-500 font-medium">
                    {s.people_you_may_want_to_send}
                </div>
                <div className="flex-1 overflow-y-auto">
                    {visibleRecentContacts.map((contact) => (
                        <div 
                            key={contact.id} 
                            className="flex items-center p-4 border-b border-gray-50 active:bg-gray-50"
                            {...bindTap<HTMLDivElement>('transfer.amount.open', {
                              params: { contactId: String(contact.id) },
                              beforeTrigger: () => {
                                setTransferDraft({ contact, inputValue: contact.name });
                              },
                            })}
                        >
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center mr-3 text-sm overflow-hidden">
                                {contact.avatar ? <img src={contact.avatar} alt="" className="w-full h-full rounded-full object-cover" /> : <DefaultAvatar iconSize={20} />}
                            </div>
                            <div>
                                <div className="text-base font-medium text-gray-900">{contact.name}</div>
                                <div className="text-sm text-gray-400 mt-0.5">{maskPhone(contact.phone)}</div>
                            </div>
                        </div>
                    ))}
                    <div className="py-8 text-center text-gray-300 text-sm">{s.no_more_2}</div>
                </div>
            </div>
        </div>
      )}

      {/* Error Modal (Account Not Found) */}
      {isErrorModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center px-8">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="relative w-full bg-app-surface rounded-xl p-6 flex flex-col items-center">
                <div className="text-center text-base text-gray-800 mb-6 leading-relaxed">
                    {s.account_not_found_try_again}
                </div>
                <button 
                    className="w-full bg-app-primary text-white py-2.5 rounded-lg font-medium text-base"
                    {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
                >
                    {s.confirm_2}
                </button>
            </div>
        </div>
      )}
    </div>
  );
};
