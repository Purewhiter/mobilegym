import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcSearch, IcNavBack, IcUserAdd, IcContacts, IcMessageSquare, IcWallet, IcLocation, IcTag, IcHeadphone } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { sortContactsByName } from '../utils/transferContacts';
import { maskPhone } from '../utils/maskPhone';
import { DefaultAvatar } from '../components/DefaultAvatar';
export const ContactsPage: React.FC = () => {
  const s = useAlipayStrings();
  const contacts = useAlipayStore(s => s.contacts);
  const { bindTap, bindBack } = useAlipayGestures();

  const [query, setQuery] = React.useState('');

  const filteredContacts = React.useMemo(() => {
    if (!query) return contacts;
    return contacts.filter((c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (c.info && c.info.toLowerCase().includes(query.toLowerCase())) ||
      String(c.phone || '').toLowerCase().includes(query.toLowerCase()) ||
      String(c.account || '').toLowerCase().includes(query.toLowerCase())
    );
  }, [contacts, query]);
  const visibleContacts = React.useMemo(() => sortContactsByName(filteredContacts), [filteredContacts]);

  const functionalItems = [
    { id: 'new_friends', name: s.new_friends, icon: IcUserAdd, color: 'bg-app-primary' },
    { id: 'group_chat', name: s.group_chats, icon: IcContacts, color: 'bg-app-primary' },
    { id: 'life_account', name: s.lifestyle, icon: IcMessageSquare, color: 'bg-app-primary' },
    { id: 'recent_transfer', name: s.recent_transfer_contacts, icon: IcWallet, color: 'bg-[#FF7D00]' },
    { id: 'smart_service', name: s.smart_services, icon: IcLocation, color: 'bg-app-primary' }, // Using IcLocation as placeholder for AI icon
    { id: 'tags', name: s.tags, icon: IcTag, color: 'bg-app-secondary' },
    { id: 'service', name: s.dedicated_support, icon: IcHeadphone, color: 'bg-app-primary' },
  ];

  return (
    <div className="bg-app-surface min-h-screen flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-app-bg z-10 pt-10">
        <div className="flex items-center justify-between px-4 py-3">
          <button {...bindBack<HTMLButtonElement>()} className="flex items-center">
            <IcNavBack size={24} className="text-gray-900" />
            <span className="text-lg font-bold text-gray-900 ml-1">{s.contacts_2}</span>
          </button>
          <button className="text-base text-gray-900 font-medium">{s.add_contacts}</button>
        </div>

        {/* IcSearch */}
        <div className="px-4 pb-3">
          <div className="bg-app-surface rounded-lg flex items-center px-3 py-2">
            <IcSearch size={18} className="text-gray-400 mr-2" />
            <input
              type="text"
              placeholder={s.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-base"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        {/* Functional List */}
        <div className="py-2">
          {functionalItems.map((item) => (
            <div key={item.id} className="flex items-center px-4 py-3 active:bg-gray-50">
              <div className={`w-10 h-10 rounded-lg ${item.color} flex items-center justify-center mr-3 text-white`}>
                <item.icon size={20} />
              </div>
              <span className="text-base font-medium text-gray-900">{item.name}</span>
            </div>
          ))}
        </div>

        {/* Contacts List */}
        <div>
          <div className="px-4 py-1 bg-gray-50 text-xs text-gray-500 font-medium">{s.contacts_2}</div>
          {visibleContacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center px-4 py-3 border-b border-gray-100 last:border-none active:bg-gray-50"
              {...bindTap('contacts.profile.open', { params: { contactId: String(contact.id) } })}
            >
              <div className="w-10 h-10 rounded-lg bg-gray-200 overflow-hidden mr-3">
                {contact.avatar ? (
                  <img src={contact.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <DefaultAvatar iconSize={20} />
                )}
              </div>
              <div>
                <div className="text-base font-medium text-gray-900">
                  {contact.name.split('(')[0]}
                </div>
                {(contact.info || contact.phone || contact.account) && (
                  <div className="text-xs text-gray-500">{maskPhone(contact.info || '') || maskPhone(contact.phone) || maskPhone(contact.account)}</div>
                )}
              </div>
            </div>
          ))}
          {visibleContacts.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">{s.no_more_2}</div>
          )}
        </div>

        {/* Footer */}
        <div className="py-8 text-center">
          <div className="text-gray-400 text-sm mb-2">{contacts.length}{s.friends_count_suffix}</div>
          <div className="text-app-primary text-sm">{s.help}</div>
        </div>
      </div>
    </div>
  );
};
