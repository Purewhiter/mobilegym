import React, { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Toast } from '@/os/components/Toast';
import { useLocale } from '@/os/locale';
import { useAppStrings } from '@/os/useAppStrings';
import { SymbolIcon } from '../components/SymbolIcon';
import { CONTACTS_CONFIG } from '../data';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { deleteContact, recordLastContacted, toggleStarred, useContact } from '../state';
import { ChevronRightIcon, IcSymbolBack, IcSymbolDelete, IcSymbolFavorites, IcSymbolFavoritesFill, IcSymbolMessages, IcSymbolMore, IcSymbolPhone } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { localizeContactLabel } from '../utils/localizedText';

function normalizeNumber(value: string): string {
  return (value || '').replace(/\s+/g, '');
}

const CallTypeBadge: React.FC<{ type: 'incoming' | 'outgoing' | 'missed' | string }> = ({ type }) => {
  const color = type === 'missed' ? '#FF4D2D' : '#9CA3AF';
  const path = type === 'outgoing' ? 'M7 17l10-10M9 7h8v8' : 'M17 7L7 17M15 17H7V9';
  return (
    <span className="w-9 h-9 rounded-full bg-black/5 flex items-center justify-center flex-shrink-0" aria-hidden="true">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d={path} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
};

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="px-6 pt-4 pb-2 text-[12px] text-gray-400">{title}</div>
);

export const ContactDetailPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { contactId } = useParams<{ contactId: string }>();
  const { bindBack, go, back } = useContactsGestures();
  const s = useAppStrings(strings, stringsEn);
  const contact = useContact(contactId);

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const toastTimerRef = useRef<number | null>(null);
  const showToast = (message: string) => {
    setToast({ visible: true, message });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast({ visible: false, message: '' }), 1400);
  };

  if (!contact) {
    return (
      <div className="h-full w-full bg-app-surface">
        <div className="h-10" />
        <div className="px-4 h-12 flex items-center gap-2">
          <button
            type="button"
            {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
            aria-label={isEnglish ? 'Back' : '返回'}
          >
            <SymbolIcon name={IcSymbolBack} size={22} className="text-app-text" />
          </button>
          <div className="text-[16px] text-app-text font-semibold">{s.contactsList}</div>
        </div>
        <div className="px-6 py-10 text-[13px] text-gray-400">{s.contact_not_found}</div>
      </div>
    );
  }

  const avatarText = (contact.displayName?.trim()?.[0] ?? '#').toUpperCase();
  const primaryPhone = contact.phones?.find((phone) => phone.isPrimary)?.number ?? contact.phones?.[0]?.number ?? '';

  const relatedCallLogs = useMemo(() => {
    const numbers = (contact.phones || []).map((phone) => normalizeNumber(phone.number)).filter(Boolean);
    if (!numbers.length) return [];
    return CONTACTS_CONFIG.callLogs
      .filter((entry) => numbers.includes(normalizeNumber(entry.number)))
      .slice(0, 6);
  }, [contact.phones]);

  return (
    <div className="h-full w-full bg-app-bg flex flex-col">
      <Toast visible={toast.visible} message={toast.message} />

      <div className="sticky top-0 z-30 bg-app-bg">
        <div className="h-10" />
        <div className="px-3 h-12 flex items-center">
          <button
            type="button"
            {...bindBack<HTMLButtonElement>({ stopPropagation: true })}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
            aria-label={isEnglish ? 'Back' : '返回'}
          >
            <SymbolIcon name={IcSymbolBack} size={22} className="text-app-text" />
          </button>
          <div className="flex-1" />
          <button
            type="button"
            aria-label={isEnglish ? 'Favorite' : '收藏'}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
            onClick={() => toggleStarred(contact.id)}
          >
            <SymbolIcon
              name={contact.starred ? IcSymbolFavoritesFill : IcSymbolFavorites}
              size={20}
              className={contact.starred ? 'text-[#FF4D2D]' : 'text-gray-300'}
            />
          </button>
          <button
            type="button"
            aria-label={isEnglish ? 'More' : '更多'}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
            onClick={() => showToast(isEnglish ? 'More actions are not implemented yet' : '更多（未实现）')}
          >
            <SymbolIcon name={IcSymbolMore} size={20} className="text-gray-700" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10" data-scroll-container="main" data-scroll-direction="vertical">
        <div className="pt-3">
          <div className="flex flex-col items-center px-6">
            <div
              className="w-(--app-contact-detail-avatar-size) h-(--app-contact-detail-avatar-size) rounded-full flex items-center justify-center text-white text-[28px] font-semibold"
              style={{ backgroundColor: contact.avatarColor || '#9CA3AF' }}
            >
              {contact.avatarUri ? (
                <img
                  src={contact.avatarUri}
                  alt=""
                  className="w-full h-full rounded-full object-cover"
                  draggable={false}
                />
              ) : (
                avatarText
              )}
            </div>

            <div className="mt-3 text-center text-[22px] font-semibold text-app-text">{contact.displayName}</div>
            {contact.company || contact.title ? (
              <div className="mt-1 text-center text-[13px] text-gray-400">
                {[contact.company, contact.title].filter(Boolean).join(' / ')}
              </div>
            ) : null}
          </div>

          <div className="px-4 mt-4">
            <div className="bg-app-surface rounded-3xl overflow-hidden">
              <button
                type="button"
                className="w-full px-5 py-4 flex items-center justify-between active:bg-black/5 text-left"
                onClick={() => {
                  recordLastContacted(contact.id);
                  showToast(
                    primaryPhone
                      ? `${isEnglish ? 'Simulated call:' : '模拟拨号：'} ${primaryPhone}`
                      : (isEnglish ? 'This contact has no phone number' : '该联系人没有号码'),
                  );
                }}
              >
                <span className="text-[16px] font-semibold text-app-text">{s.action_call}</span>
                <span className="inline-flex items-center gap-2">
                  <SymbolIcon name={IcSymbolPhone} size={18} className="text-gray-700" />
                  <ChevronRightIcon />
                </span>
              </button>
              <div className="h-px bg-black/5 ml-5" />
              <button
                type="button"
                className="w-full px-5 py-4 flex items-center justify-between active:bg-black/5 text-left"
                onClick={() => {
                  recordLastContacted(contact.id);
                  showToast(
                    primaryPhone
                      ? `${isEnglish ? 'Simulated SMS:' : '模拟短信：'} ${primaryPhone}`
                      : (isEnglish ? 'This contact has no phone number' : '该联系人没有号码'),
                  );
                }}
              >
                <span className="text-[16px] font-semibold text-app-text">{s.action_sms}</span>
                <span className="inline-flex items-center gap-2">
                  <SymbolIcon name={IcSymbolMessages} size={18} className="text-gray-700" />
                  <ChevronRightIcon />
                </span>
              </button>
            </div>
          </div>
        </div>

        {contact.phones?.length ? (
          <div className="mt-2">
            <SectionHeader title={s.section_phones} />
            <div className="mx-4 bg-app-surface rounded-3xl overflow-hidden">
              {contact.phones.map((phone, index) => (
                <React.Fragment key={phone.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    className="w-full px-5 py-4 flex items-center justify-between active:bg-black/5 text-left"
                    onClick={() => showToast(isEnglish ? 'Phone item is not implemented yet' : '电话条目（未实现）')}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        showToast(isEnglish ? 'Phone item is not implemented yet' : '电话条目（未实现）');
                      }
                    }}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-[16px] text-app-text truncate">{phone.number}</div>
                      <div className="text-[12px] text-gray-400 mt-0.5">
                        {localizeContactLabel(phone.label || '手机', locale)}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        aria-label={isEnglish ? 'Call' : '拨打'}
                        className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
                        onClick={(event) => {
                          event.stopPropagation();
                          recordLastContacted(contact.id);
                          showToast(`${isEnglish ? 'Simulated call:' : '模拟拨号：'} ${phone.number}`);
                        }}
                      >
                        <SymbolIcon name={IcSymbolPhone} size={18} className="text-gray-700" />
                      </button>
                      <button
                        type="button"
                        aria-label={isEnglish ? 'SMS' : '短信'}
                        className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
                        onClick={(event) => {
                          event.stopPropagation();
                          recordLastContacted(contact.id);
                          showToast(`${isEnglish ? 'Simulated SMS:' : '模拟短信：'} ${phone.number}`);
                        }}
                      >
                        <SymbolIcon name={IcSymbolMessages} size={18} className="text-gray-700" />
                      </button>
                      <ChevronRightIcon />
                    </div>
                  </div>
                  {index < contact.phones.length - 1 ? <div className="h-px bg-black/5 ml-5" /> : null}
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : null}

        {(contact.emails ?? []).length ? (
          <div className="mt-2">
            <SectionHeader title={s.section_email} />
            <div className="mx-4 bg-app-surface rounded-3xl overflow-hidden">
              {(contact.emails ?? []).map((email, index) => (
                <React.Fragment key={email.id}>
                  <button
                    type="button"
                    className="w-full px-5 py-4 flex items-center justify-between active:bg-black/5 text-left"
                    onClick={() => showToast(isEnglish ? 'Email item is not implemented yet' : '邮件（未实现）')}
                  >
                    <div className="min-w-0 pr-3">
                      <div className="text-[16px] text-app-text truncate">{email.email}</div>
                      <div className="text-[12px] text-gray-400 mt-0.5">
                        {localizeContactLabel(email.label || '工作', locale)}
                      </div>
                    </div>
                    <ChevronRightIcon />
                  </button>
                  {index < (contact.emails ?? []).length - 1 ? <div className="h-px bg-black/5 ml-5" /> : null}
                </React.Fragment>
              ))}
            </div>
          </div>
        ) : null}

        {contact.notes ? (
          <div className="mt-2">
            <SectionHeader title={s.section_notes} />
            <div className="mx-4 bg-app-surface rounded-3xl overflow-hidden px-5 py-4 text-[14px] text-app-text whitespace-pre-wrap">
              {contact.notes}
            </div>
          </div>
        ) : null}

        <div className="mt-2">
          <SectionHeader title={s.section_call_logs} />
          <div className="mx-4 bg-app-surface rounded-3xl overflow-hidden">
            {relatedCallLogs.length ? (
              relatedCallLogs.map((entry, index) => (
                <div key={entry.id}>
                  <button
                    type="button"
                    className="w-full px-5 py-4 flex items-center justify-between active:bg-black/5 text-left"
                    onClick={() => go('call.open', { callLogId: entry.id })}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CallTypeBadge type={entry.type ?? 'incoming'} />
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold text-app-text truncate">{entry.dateText}</div>
                        <div className="text-[12px] text-gray-400 mt-0.5 truncate">
                          {entry.locationText || ({
                            incoming: s.call_type_incoming,
                            outgoing: s.call_type_outgoing,
                            missed: s.call_type_missed,
                          }[entry.type as string] ?? s.call_type_normal)}
                        </div>
                      </div>
                    </div>
                    <ChevronRightIcon />
                  </button>
                  {index < relatedCallLogs.length - 1 ? <div className="h-px bg-black/5 ml-5" /> : null}
                </div>
              ))
            ) : (
              <div className="px-5 py-4 text-[13px] text-gray-400">{s.contact_no_call_logs}</div>
            )}
          </div>
        </div>

        <div className="mx-4 mt-4">
          <button
            type="button"
            className="w-full h-12 rounded-2xl bg-app-surface text-red-500 font-semibold flex items-center justify-center gap-2 active:bg-black/5"
            onClick={() => {
              deleteContact(contact.id);
              showToast(s.contact_deleted_toast);
              window.setTimeout(() => back(1), 150);
            }}
          >
            <SymbolIcon name={IcSymbolDelete} size={18} className="text-red-500" />
            <span>{s.contact_delete_btn}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
