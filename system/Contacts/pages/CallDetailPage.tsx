import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Toast } from '@/os/components/Toast';
import { useLocale } from '@/os/locale';
import { useAppStrings } from '@/os/useAppStrings';
import { SymbolIcon } from '../components/SymbolIcon';
import { CONTACTS_CONFIG } from '../data';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { useSimProfiles } from '../hooks/useSimProfiles';
import { useContactsList } from '../state';
import { IcSymbolBack, IcSymbolMessages, IcSymbolPhone, IcSymbolPlay } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

function normalizeNumber(value: string): string {
  return (value || '').replace(/\s+/g, '');
}

const CallTypeIcon: React.FC<{ type: 'incoming' | 'outgoing' | 'missed' | string }> = ({ type }) => {
  const color = type === 'missed' ? '#FF4D2D' : '#9CA3AF';
  const path = type === 'outgoing' ? 'M7 17l10-10M9 7h8v8' : 'M17 7L7 17M15 17H7V9';
  return (
    <span className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center flex-shrink-0" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d={path} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
};

export const CallDetailPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { callLogId } = useParams<{ callLogId: string }>();
  const { bindBack } = useContactsGestures();
  const contacts = useContactsList();
  const sims = useSimProfiles();
  const s = useAppStrings(strings, stringsEn);

  const entry = useMemo(
    () => CONTACTS_CONFIG.callLogs.find((item) => item.id === callLogId),
    [callLogId],
  );

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

  const number = entry?.number || '';
  const normalizedNumber = normalizeNumber(number);

  const related = useMemo(() => {
    if (!entry) return [];
    if (!normalizedNumber) return [entry];
    return CONTACTS_CONFIG.callLogs.filter((item) => normalizeNumber(item.number) === normalizedNumber);
  }, [entry, normalizedNumber]);

  const contact = useMemo(() => {
    if (!normalizedNumber) return undefined;
    return contacts.find((item) =>
      (item.phones || []).some((phone) => normalizeNumber(phone.number) === normalizedNumber),
    );
  }, [contacts, normalizedNumber]);

  const title = contact?.displayName || entry?.displayName || entry?.number || s.call_detail_title;
  const subtitle = entry?.locationText || '';

  if (!entry) {
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
          <div className="text-[16px] text-app-text font-semibold">{s.call_detail_title}</div>
        </div>
        <div className="px-6 py-10 text-[13px] text-gray-400">{s.call_log_not_found}</div>
      </div>
    );
  }

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
          <div className="flex-1 px-2 truncate text-center text-[16px] font-semibold text-app-text">
            {s.call_detail_title}
          </div>
          <div className="w-10" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-10" data-scroll-container="main" data-scroll-direction="vertical">
        <div className="px-4 mt-2">
          <div className="bg-app-surface rounded-3xl overflow-hidden">
            <div className="px-6 pt-6 pb-5 text-center">
              <div className="text-[22px] font-semibold text-app-text truncate">{title}</div>
              {subtitle ? <div className="mt-1 text-[13px] text-gray-400">{subtitle}</div> : null}
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  style={{ backgroundColor: 'var(--app-c-call-button-background)' }}
                  className="h-11 px-6 rounded-full text-white text-[15px] font-semibold active:opacity-80 inline-flex items-center gap-2"
                  onClick={() => showToast(number ? `${isEnglish ? 'Simulated call:' : '模拟拨号：'} ${number}` : (isEnglish ? 'No phone number' : '无号码'))}
                >
                  <SymbolIcon name={IcSymbolPhone} size={18} className="text-white" />
                  {s.action_call}
                </button>
                <button
                  type="button"
                  className="h-11 px-6 rounded-full bg-black/5 text-app-text text-[15px] font-semibold active:bg-black/10 inline-flex items-center gap-2"
                  onClick={() => showToast(number ? `${isEnglish ? 'Simulated SMS:' : '模拟短信：'} ${number}` : (isEnglish ? 'No phone number' : '无号码'))}
                >
                  <SymbolIcon name={IcSymbolMessages} size={18} className="text-gray-700" />
                  {s.action_sms}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 mt-3">
          <div className="bg-app-surface rounded-3xl overflow-hidden">
            {related.map((item, index) => {
              const simLabel = item.sim ? sims.find((sim) => sim.slot === item.sim)?.label : '';
              return (
                <div key={item.id}>
                  <div className="px-5 py-4 flex items-center gap-4">
                    <CallTypeIcon type={item.type ?? 'incoming'} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-semibold text-app-text truncate">
                        {({
                          incoming: s.call_type_incoming,
                          outgoing: s.call_type_outgoing,
                          missed: s.call_type_missed,
                        }[item.type as string] ?? s.call_type_normal)}
                        {simLabel ? <span className="text-gray-400 font-medium">{` / ${simLabel}`}</span> : null}
                      </div>
                      <div className="mt-1 text-[13px] text-gray-400 truncate">
                        {item.dateText}
                        {item.locationText ? <span>{` / ${item.locationText}`}</span> : null}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={isEnglish ? 'Play recording' : '播放'}
                      className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
                      onClick={() => showToast(isEnglish ? 'Recording playback is not implemented yet' : '录音/播放（未实现）')}
                    >
                      <SymbolIcon name={IcSymbolPlay} size={18} className="text-app-text-muted" />
                    </button>
                  </div>
                  {index < related.length - 1 ? <div className="h-px bg-black/5 ml-5" /> : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
