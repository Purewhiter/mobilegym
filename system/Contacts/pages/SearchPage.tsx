import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Toast } from '@/os/components/Toast';
import { useLocale } from '@/os/locale';
import { useAppStrings } from '@/os/useAppStrings';
import { SymbolIcon } from '../components/SymbolIcon';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { recordLastContacted, useContactsList, useContactsStore } from '../state';
import { ChevronRightIcon, IcSymbolBack, IcSymbolClose2, IcSymbolSearch } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

export const SearchPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { bindBack, go } = useContactsGestures();
  const contacts = useContactsList();
  const searchHistory = useContactsStore((state) => state.searchHistory);
  const addSearchHistory = useContactsStore((state) => state.addSearchHistory);
  const clearSearchHistory = useContactsStore((state) => state.clearSearchHistory);
  const removeSearchHistoryItem = useContactsStore((state) => state.removeSearchHistoryItem);
  const s = useAppStrings(strings, stringsEn);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (message: string) => {
    setToast({ visible: true, message });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast({ visible: false, message: '' }), 1400);
  };

  useEffect(() => () => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = window.setTimeout(() => setLoading(false), 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  const results = useMemo(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return [];

    const normalized = trimmedQuery.replace(/\s+/g, '').toLowerCase();
    const digits = normalized.replace(/[^\d+]/g, '');

    return contacts
      .filter((contact) => {
        const name = (contact.displayName || '').toLowerCase();
        if (name.includes(normalized)) return true;
        if (!digits) return false;
        return (contact.phones || []).some((phone) => (phone.number || '').replace(/\s+/g, '').includes(digits));
      })
      .slice(0, 50);
  }, [contacts, query]);

  const openContact = (contactId: string) => {
    const trimmedQuery = query.trim();
    if (trimmedQuery) addSearchHistory(trimmedQuery);
    recordLastContacted(contactId);
    go('contact.open', { contactId });
  };

  return (
    <div className="h-full w-full bg-app-surface">
      <Toast visible={toast.visible} message={toast.message} />

      <div className="sticky top-0 z-30 bg-app-surface">
        <div className="h-10" />
        <div className="px-4 py-2 flex items-center gap-3">
          <button
            type="button"
            aria-label={isEnglish ? 'Back' : '返回'}
            {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
          >
            <SymbolIcon name={IcSymbolBack} size={22} className="text-app-text" />
          </button>

          <div className="flex-1 h-11 rounded-full bg-black/5 flex items-center px-4 gap-2">
            <SymbolIcon name={IcSymbolSearch} size={18} className="text-gray-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={s.searchHint}
              className="flex-1 bg-transparent outline-none text-[16px] text-app-text placeholder:text-gray-400"
              autoFocus
            />
            {query.trim() ? (
              <button
                type="button"
                aria-label={isEnglish ? 'Clear' : '清空'}
                className="w-7 h-7 rounded-full flex items-center justify-center active:bg-black/5"
                onClick={() => setQuery('')}
              >
                <SymbolIcon name={IcSymbolClose2} size={18} className="text-gray-400" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-8" data-scroll-container="main" data-scroll-direction="vertical">
        {loading ? <div className="px-6 py-4 text-[14px] text-gray-400">{s.searchSearching}</div> : null}

        {!query.trim() ? (
          <div className="px-4 pt-2">
            <div className="bg-app-surface rounded-2xl overflow-hidden border border-black/5">
              {searchHistory.length ? (
                <>
                  {searchHistory.map((historyItem, index) => (
                    <div key={historyItem} className="bg-app-surface">
                      <button
                        type="button"
                        className="w-full px-4 py-4 flex items-center justify-between active:bg-black/5 text-left"
                        onClick={() => setQuery(historyItem)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] text-app-text truncate">{historyItem}</div>
                        </div>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={isEnglish ? 'Delete history item' : '删除记录'}
                          className="w-9 h-9 rounded-full flex items-center justify-center active:bg-black/5"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeSearchHistoryItem(historyItem);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              removeSearchHistoryItem(historyItem);
                            }
                          }}
                        >
                          <SymbolIcon name={IcSymbolClose2} size={18} className="text-gray-300" />
                        </div>
                      </button>
                      {index < searchHistory.length - 1 ? <div className="h-px bg-black/5 ml-4" /> : null}
                    </div>
                  ))}

                  <div className="h-px bg-black/5" />
                  <button
                    type="button"
                    className="w-full px-4 py-4 text-left text-[14px] font-semibold text-[#3482FF] active:bg-black/5"
                    onClick={() => clearSearchHistory()}
                  >
                    {s.clearSearchHistory}
                  </button>
                </>
              ) : (
                <div className="px-6 py-10 text-center text-[13px] text-gray-400">{s.search_no_history}</div>
              )}
            </div>
          </div>
        ) : null}

        {query.trim() && !loading ? (
          results.length ? (
            <div className="px-4 pt-2">
              <div className="px-2 py-2 text-[12px] text-gray-400">{s.search_contacts_header}</div>
              <div className="bg-app-surface rounded-2xl overflow-hidden border border-black/5">
                {results.map((contact, index) => {
                  const phone = contact.phones?.[0]?.number || '';
                  return (
                    <div key={contact.id}>
                      <button
                        type="button"
                        className="w-full px-4 py-4 flex items-center gap-3 active:bg-black/5 text-left"
                        onClick={() => openContact(contact.id)}
                      >
                        <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-[14px] font-semibold text-app-text-muted">
                            {(contact.displayName || '#').slice(0, 1)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[15px] font-semibold text-app-text truncate">{contact.displayName}</div>
                          <div className="text-[12px] text-gray-400 mt-0.5 truncate">{phone}</div>
                        </div>
                        <ChevronRightIcon />
                      </button>
                      {index < results.length - 1 ? <div className="h-px bg-black/5 ml-4" /> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="px-6 pt-10 text-center text-[14px] text-gray-400">{s.searchNoResults}</div>
          )
        ) : null}
      </div>
    </div>
  );
};
