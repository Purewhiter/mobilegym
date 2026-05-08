import React, { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Toast } from '@/os/components/Toast';
import { useLocale } from '@/os/locale';
import { useAppStrings } from '@/os/useAppStrings';
import { SymbolIcon } from '../components/SymbolIcon';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { recordLastContacted, useContactsList } from '../state';
import type { Contact } from '../types';
import { colors } from '../res/colors';
import { IcNavForward, IcSymbolAdd, IcSymbolExpandMore, IcSymbolFavorites, IcSymbolFavoritesFill, IcSymbolSearch, IcSymbolSettings } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

function deriveSectionKey(contact: Contact): string {
  const explicit = (contact.sectionKey ?? '').trim();
  if (explicit && /^[A-Z#]$/.test(explicit)) return explicit;
  const ch = (contact.displayName ?? '').trim()[0] ?? '#';
  if (/^[A-Za-z]$/.test(ch)) return ch.toUpperCase();
  return '#';
}

function contactSortKey(contact: Contact): string {
  return (contact.sortKey ?? contact.displayName ?? '').trim() || '#';
}

const ContactRow: React.FC<{
  name: string;
  showDivider?: boolean;
  onClick?: () => void;
}> = ({ name, showDivider = true, onClick }) => (
  <div className="bg-app-surface">
    <button
      type="button"
      className="w-full px-6 py-4 flex items-center justify-between active:bg-black/5 text-left"
      onClick={onClick}
    >
      <span className="text-[18px] text-app-text">{name}</span>
      <IcNavForward className="w-5 h-5 text-gray-300" />
    </button>
    {showDivider ? <div className="h-px bg-black/5 ml-6" /> : null}
  </div>
);

const ContactsFab: React.FC<{
  label: string;
  tapProps: React.HTMLAttributes<HTMLButtonElement>;
}> = ({ label, tapProps }) => (
  <button
    type="button"
    {...tapProps}
    style={{
      ...(tapProps.style || {}),
      backgroundColor: colors.fab_background,
    }}
    className={[
      'absolute right-6 bottom-[92px] w-16 h-16 rounded-full shadow-[0_10px_24px_rgba(0,0,0,0.16)]',
      'flex items-center justify-center active:scale-95 transition-transform',
      tapProps.className ?? '',
    ].join(' ')}
    aria-label={label}
  >
    <SymbolIcon name={IcSymbolAdd} size={32} className="text-white" />
  </button>
);

const AlphabetIndex: React.FC<{
  keys: string[];
  onPick: (k: string) => void;
}> = ({ keys, onPick }) => {
  if (!keys.length) return null;

  return (
    <div className="absolute right-1 top-[184px] bottom-[130px] flex items-center">
      <div className="w-6 h-full rounded-full bg-black/0 flex flex-col items-center justify-center gap-2 select-none">
        {keys.map((key, index) => {
          if (key === '__separator__') {
            return <span key={`sep-${index}`} className="w-[4px] h-[4px] rounded-full bg-gray-300" />;
          }

          return (
            <button
              key={`${key}-${index}`}
              type="button"
              className="w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-semibold text-gray-400 active:bg-black/5"
              onClick={(event) => {
                event.stopPropagation();
                onPick(key);
              }}
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export const ContactsPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const contacts = useContactsList();
  const { bindTap, go } = useContactsGestures();
  const [searchParams] = useSearchParams();
  const favOnly = searchParams.get('fav') === 'true';
  const s = useAppStrings(strings, stringsEn);

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const toastTimerRef = useRef<number | null>(null);
  const showToast = (message: string) => {
    setToast({ visible: true, message });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast({ visible: false, message: '' }), 1400);
  };

  const collator = useMemo(
    () => new Intl.Collator('zh-Hans-CN-u-co-pinyin', { numeric: true, sensitivity: 'base' }),
    [],
  );

  const displayContacts = useMemo(() => {
    const list = contacts.slice();
    const filtered = favOnly ? list.filter((contact) => Boolean(contact.starred)) : list;
    return filtered.sort((left, right) => collator.compare(contactSortKey(left), contactSortKey(right)));
  }, [contacts, favOnly, collator]);

  const grouped = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const contact of displayContacts) {
      const key = deriveSectionKey(contact);
      const entries = map.get(key) ?? [];
      entries.push(contact);
      map.set(key, entries);
    }
    return map;
  }, [displayContacts]);

  const sectionKeys = useMemo(() => {
    const keys = Array.from(grouped.keys());
    keys.sort((left, right) => {
      if (left === '#') return 1;
      if (right === '#') return -1;
      return left.localeCompare(right);
    });

    const indexKeys: string[] = [];
    const letterKeys = keys.filter((key) => key !== '#');
    for (let index = 0; index < letterKeys.length; index++) {
      indexKeys.push(letterKeys[index]);
      if (index === 0 || index === 4 || index === 8) {
        indexKeys.push('__separator__');
      }
    }
    if (keys.includes('#')) indexKeys.push('#');

    return { listKeys: keys, indexKeys: indexKeys.filter(Boolean) };
  }, [grouped]);

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const scrollTo = (key: string) => {
    if (key === '__separator__') return;
    sectionRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const favoriteToggleProps = favOnly ? bindTap('contacts.favorites.off') : bindTap('contacts.favorites.on');

  return (
    <div className="h-full w-full bg-app-surface relative flex flex-col">
      <Toast visible={toast.visible} message={toast.message} />

      <div className="sticky top-0 z-20 bg-app-surface">
        <div className="h-10" />
        <div className="px-6 pt-2 pb-3 relative">
          <div className="text-[36px] font-semibold text-app-text">{s.contactsAllLabel}</div>
          <button
            type="button"
            aria-label={isEnglish ? 'Settings' : '设置'}
            {...bindTap('settings.open.contacts')}
            className="absolute right-5 top-2 w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
          >
            <SymbolIcon name={IcSymbolSettings} size={24} className="text-gray-700" />
          </button>
        </div>

        <div className="px-6 pb-2">
          <button
            type="button"
            {...bindTap('search.open')}
            className="w-full h-11 rounded-full bg-black/5 flex items-center px-4 text-[16px] text-gray-400 active:bg-black/10 text-left"
          >
            <SymbolIcon name={IcSymbolSearch} size={18} className="text-gray-400 mr-2" />
            {s.searchHint}
          </button>
        </div>

        <div className="px-6 pb-2 flex items-center justify-between">
          <button type="button" className="text-[16px] font-semibold text-[#9CA3AF] flex items-center gap-1 active:opacity-70">
            {s.contactsFilterAll}
            <SymbolIcon name={IcSymbolExpandMore} size={18} className="text-[#9CA3AF]" />
          </button>
          <button
            type="button"
            aria-label={isEnglish ? 'Favorites' : '收藏'}
            {...favoriteToggleProps}
            className="w-9 h-9 rounded-full flex items-center justify-center active:bg-black/5"
          >
            <SymbolIcon
              name={favOnly ? IcSymbolFavoritesFill : IcSymbolFavorites}
              size={18}
              className={favOnly ? 'text-[#FF4D2D]' : 'text-gray-300'}
            />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-[118px]" data-scroll-container="main" data-scroll-direction="vertical">
        <div className="bg-app-surface">
          <ContactRow
            name={s.bluetoothChat}
            onClick={() => showToast(isEnglish ? 'Offline Chat is not implemented yet' : '无网通（未实现）')}
          />
          <ContactRow
            name={s.myCard}
            onClick={() => showToast(isEnglish ? 'My Profile is not implemented yet' : '我的名片（未实现）')}
          />
          <ContactRow
            name={s.myGroups}
            showDivider={false}
            onClick={() => showToast(isEnglish ? 'My Groups is not implemented yet' : '我的群组（未实现）')}
          />
        </div>

        {sectionKeys.listKeys.map((key) => {
          const list = grouped.get(key) ?? [];
          if (!list.length) return null;

          return (
            <div key={key}>
              <div
                ref={(element) => {
                  sectionRefs.current[key] = element;
                }}
                className="px-6 py-3 text-[18px] text-gray-300 font-semibold"
                style={{ scrollMarginTop: 210 }}
              >
                {key}
              </div>
              {list.map((contact, index) => (
                <ContactRow
                  key={contact.id}
                  name={contact.displayName}
                  showDivider={index < list.length - 1}
                  onClick={() => {
                    recordLastContacted(contact.id);
                    go('contact.open', { contactId: contact.id });
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>

      <AlphabetIndex keys={sectionKeys.indexKeys} onPick={scrollTo} />

      <ContactsFab label={isEnglish ? 'Create contact' : '新建联系人'} tapProps={bindTap('contact.new.open')} />
    </div>
  );
};
