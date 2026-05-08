
import React from 'react';
import { dimens } from '../res/dimens';
import { useWechatStrings } from '../hooks/useWechatStrings';
import { IcUserAdd, IcContacts, IcTag, IcFolder } from '../res/icons';
import { useWechatStore } from '../state';
import { useWechatGestures } from '../hooks/useWechatGestures';

const ContactItem: React.FC<{ 
  icon?: React.ReactNode; 
  name: string; 
  avatar?: string; 
  tapProps?: React.HTMLAttributes<HTMLDivElement>;
}> = ({ icon, name, avatar, tapProps }) => (
  <div
    {...tapProps}
    className={`flex items-center px-4 py-2.5 bg-app-surface active:bg-(--app-c-contacts-item-bg-active) border-b border-(--app-c-tw-border-gray-100) ${tapProps ? 'cursor-pointer' : ''}`}
  >
    <div className={`w-10 h-10 rounded-[4px] flex items-center justify-center ${!avatar ? 'bg-transparent' : ''}`}>
      {avatar ? (
         <img src={avatar} className="w-full h-full rounded-[4px] object-cover" alt="" loading="lazy" />
      ) : (
        icon
      )}
    </div>
    <span className="ml-3 text-(--app-settings-item-text-size)" style={{ color: 'var(--app-c-settings-item-text)' }}>{name}</span>
  </div>
);

const Contacts: React.FC = () => {
  const t = useWechatStrings();
  const { bindTap } = useWechatGestures();
  const contacts = useWechatStore(s => s.contacts);

  const alphabet = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  const { visibleContacts, groupedContacts, activeCategories } = React.useMemo(() => {
    const visible = contacts.filter(c => !c.isBlacklisted);
    const grouped = new Map<string, typeof visible>();

    for (const contact of visible) {
      const category = contact.category?.trim() || '#';
      const group = grouped.get(category);
      if (group) group.push(contact);
      else grouped.set(category, [contact]);
    }

    return {
      visibleContacts: visible,
      groupedContacts: grouped,
      activeCategories: Array.from(grouped.keys()).sort(),
    };
  }, [contacts]);

  return (
    <div className="relative h-full bg-app-bg">
      {/* 联系人列表负责自身滚动，索引栏作为覆盖层独立出来，避免跟随列表一起滚动 */}
      <div
        data-scroll-container="main"
        data-scroll-direction="vertical"
        className="h-full overflow-y-auto no-scrollbar pb-4"
      >
        <div className="mb-0">
          <ContactItem 
            icon={<div className="w-10 h-10 rounded-[4px] flex items-center justify-center" style={{ backgroundColor: 'var(--app-c-contacts-new-friend-icon-bg)' }}><IcUserAdd className="text-white" size={dimens.icSizeToolbar} /></div>}
            name={t.contacts_new_friend} 
            tapProps={bindTap<HTMLDivElement>('contacts.newFriends.open')}
          />
          <ContactItem 
              icon={<div className="w-10 h-10 bg-app-primary rounded-[4px] flex items-center justify-center"><IcContacts className="text-white" size={dimens.icSizeToolbar} fill="white" /></div>}
              name={t.contacts_group_chat}
              tapProps={bindTap<HTMLDivElement>('contacts.groups.open')}
          />
          <ContactItem 
              icon={<div className="w-10 h-10 rounded-[4px] flex items-center justify-center" style={{ backgroundColor: 'var(--app-c-contacts-tags-icon-bg)' }}><IcTag className="text-white" size={dimens.icSizeToolbar} fill="white" /></div>}
              name={t.contacts_tags}
              tapProps={bindTap<HTMLDivElement>('contacts.tags.open')}
          />
          <ContactItem
              icon={<div className="w-10 h-10 rounded-[4px] flex items-center justify-center" style={{ backgroundColor: 'var(--app-c-contacts-tags-icon-bg)' }}><IcFolder className="text-white" size={dimens.icSizeToolbar} fill="white" /></div>}
              name={t.contacts_official_accounts}
          />
        </div>

        {activeCategories.map(letter => {
           const group = groupedContacts.get(letter);
           if (!group || group.length === 0) return null;

           return (
            <div key={letter} id={`section-${letter}`}>
              <div className="px-4 py-1 text-xs text-(--app-c-tw-text-gray-500) bg-app-bg">{letter}</div>
              {group.map(contact => (
                <ContactItem 
                  key={contact.wxid} 
                  name={contact.name} 
                  avatar={contact.avatar} 
                  tapProps={bindTap<HTMLDivElement>('userProfile.open', { params: { id: contact.wxid } })}
                />
              ))}
            </div>
           )
        })}

        <div className="py-8 text-center text-(--app-c-tw-text-gray-400) text-base bg-app-surface border-t border-(--app-c-tw-border-gray-100)">
          {`${visibleContacts.length}${t.contacts_count_suffix}`}
        </div>
      </div>

      <div className="absolute right-0 top-10 bottom-20 flex flex-col justify-start items-center text-(--app-chat-list-item-time-size) font-semibold text-(--app-c-common-text-tertiary) w-6 z-10 pt-20">
        <span className="mb-1">↑</span>
        <span className="mb-0.5">☆</span>
        {alphabet.map(l => <span key={l} className="mb-0.5">{l}</span>)}
        <span>#</span>
      </div>
    </div>
  );
};

export default Contacts;
