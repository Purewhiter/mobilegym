import React, { useMemo, useState } from 'react';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useWechatStore } from '../../state';
import { IcNavBack, IcSearch } from '../../res/icons';
import { dimens } from '../../res/dimens';

const StartGroupContactItem: React.FC<{
  name: string;
  avatar?: string;
  checked: boolean;
  onToggle: () => void;
}> = ({ name, avatar, checked, onToggle }) => (
  <div onClick={onToggle} className="flex items-center px-4 py-2.5 bg-app-surface active:bg-(--app-c-contacts-item-bg-active) border-b border-(--app-c-tw-border-gray-100) cursor-pointer">
    <div className={`w-[22px] h-[22px] rounded-full border ${checked ? 'border-(--app-c-wechat-primary) bg-(--app-c-wechat-primary)' : 'border-(--app-c-tw-border-gray-300)'} mr-4 flex items-center justify-center flex-shrink-0`}>
      {checked && (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-[14px] h-[14px] text-white" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
    <div className={`w-10 h-10 rounded-[4px] flex items-center justify-center ${!avatar ? 'bg-transparent' : ''}`}>
      {avatar && <img src={avatar} className="w-full h-full rounded-[4px] object-cover" alt="" loading="lazy" />}
    </div>
    <span className="ml-3 text-(--app-settings-item-text-size)" style={{ color: 'var(--app-c-settings-item-text)' }}>{name}</span>
  </div>
);

export const StartGroupPage: React.FC = () => {
  const t = useWechatStrings();
  const { bindBack, bindTap } = useWechatGestures();
  const contacts = useWechatStore(s => s.contacts);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleContact = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const alphabet = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
  const { visibleContacts, groupedContacts, activeCategories } = useMemo(() => {
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
    <div className="absolute inset-0 z-[100] bg-app-bg flex flex-col">
      {/* TopBar */}
      <div className="pt-10 h-(--app-item-height-88) flex items-center justify-between px-4 bg-(--app-c-misc-divider-light) relative shrink-0">
        <div className="flex-1 flex items-center z-10">
          <button
            {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
            className="flex items-center -ml-2 text-app-text active:opacity-60 cursor-pointer"
          >
            <IcNavBack size={dimens.icSizeNav} />
          </button>
        </div>
        <div className="absolute left-0 right-0 flex h-full min-w-0 items-center justify-center px-16 pointer-events-none">
          <div className="max-w-full truncate text-center font-medium text-(--app-settings-item-text-size) tracking-wide text-app-text">
            {t.contacts_start_group}
          </div>
        </div>
        <div className="flex-1 flex justify-end items-center gap-4 z-10">
          <button
            disabled={selectedIds.size === 0}
            className={`px-3 py-1.5 rounded-[4px] text-[15px] font-medium transition-colors ${
              selectedIds.size > 0 
                ? 'bg-(--app-c-wechat-primary) text-white active:bg-(--app-c-wechat-primary-pressed)' 
                : 'bg-(--app-c-tw-bg-gray-200) text-(--app-c-tw-text-gray-400)'
            }`}
          >
            {t.common_done || '完成'} {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>
        </div>
      </div>

      {/* Content */}
      <div
        data-scroll-container="main"
        data-scroll-direction="vertical"
        className="flex-1 overflow-y-auto no-scrollbar relative bg-app-surface"
      >
        {/* Search */}
        <div className="p-2 bg-(--app-c-misc-divider-light)">
          <div className="bg-app-surface rounded-[4px] h-[36px] flex items-center justify-center gap-1.5 text-(--app-c-tw-text-gray-400) cursor-pointer">
            <IcSearch size={18} />
            <span className="text-[15px]">{t.common_search}</span>
          </div>
        </div>

        {/* Action List */}
        <div className="bg-app-surface">
          <div className="px-4 py-3.5 active:bg-(--app-c-contacts-item-bg-active) cursor-pointer text-[16px] text-(--app-c-settings-item-text)">
            {t.contacts_start_group_pick_existing}
          </div>

          <div className="px-4 py-1 text-xs text-(--app-c-tw-text-gray-500) bg-app-bg">
            {t.contacts_start_group_create_new}
          </div>

          <div
            {...bindTap<HTMLDivElement>('startGroup.faceToFace.open')}
            className="px-4 py-3.5 border-b border-(--app-c-tw-border-gray-100) active:bg-(--app-c-contacts-item-bg-active) cursor-pointer text-[16px] text-(--app-c-settings-item-text)"
          >
            {t.contacts_start_group_face_to_face}
          </div>
          <div className="px-4 py-3.5 active:bg-(--app-c-contacts-item-bg-active) cursor-pointer text-[16px] text-(--app-c-settings-item-text)">
            {t.contacts_start_group_pick_from_group}
          </div>
        </div>

        {/* Contacts List */}
        <div className="bg-app-surface">
          {activeCategories.map(letter => {
            const group = groupedContacts.get(letter);
            if (!group || group.length === 0) return null;

            return (
              <div key={letter} id={`section-${letter}`}>
                <div className="px-4 py-1 text-xs text-(--app-c-tw-text-gray-500) bg-app-bg">{letter}</div>
                {group.map(contact => (
                  <StartGroupContactItem
                    key={contact.wxid}
                    name={contact.name}
                    avatar={contact.avatar}
                    checked={selectedIds.has(contact.wxid)}
                    onToggle={() => toggleContact(contact.wxid)}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Index Sidebar */}
      <div className="absolute right-0 top-32 bottom-20 flex flex-col justify-between items-center text-[10px] font-medium text-(--app-c-tw-text-gray-500) w-6 z-10 pt-20">
        {alphabet.map(l => <span key={l}>{l}</span>)}
        <span>#</span>
      </div>
    </div>
  );
};
