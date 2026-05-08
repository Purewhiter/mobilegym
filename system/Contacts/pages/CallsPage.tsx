import React, { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Toast } from '@/os/components/Toast';
import { useLocale } from '@/os/locale';
import { useAppStrings } from '@/os/useAppStrings';
import { useTheme } from '../../../os/ThemeContext';
import { SymbolIcon } from '../components/SymbolIcon';
import { CONTACTS_CONFIG } from '../data';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { useSimProfiles } from '../hooks/useSimProfiles';
import type { CallLogEntry, SimProfile, SimSlot } from '../phoneTypes';
import { IcNavForward, IcSymbolClose2, IcSymbolExpandMore, IcSymbolPhone, IcSymbolSearch, IcSymbolSettings } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';

const DialpadFab: React.FC<{
  label: string;
  tapProps: React.HTMLAttributes<HTMLButtonElement>;
}> = ({ label, tapProps }) => (
  <button
    type="button"
    {...tapProps}
    style={{
      ...(tapProps.style || {}),
      backgroundColor: 'var(--app-c-fab-background)',
    }}
    className={[
      'absolute right-6 bottom-[92px] w-14 h-14 rounded-full shadow-[0_10px_24px_rgba(0,0,0,0.16)]',
      'flex items-center justify-center active:scale-95 transition-transform',
      tapProps.className ?? '',
    ].join(' ')}
    aria-label={label}
  >
    <div className="grid grid-cols-3 gap-[3px]">
      {Array.from({ length: 9 }).map((_, index) => (
        <span key={index} className="w-[4px] h-[4px] rounded-full bg-app-surface" />
      ))}
    </div>
  </button>
);

const CallLogItem: React.FC<{
  entry: CallLogEntry;
  showDivider: boolean;
  tapProps?: React.HTMLAttributes<HTMLButtonElement>;
}> = ({ entry, showDivider, tapProps }) => {
  const s = useAppStrings(strings, stringsEn);

  return (
    <div className="bg-app-surface">
      <button
        type="button"
        {...(tapProps || {})}
        className={[
          'w-full px-6 py-4 flex items-center justify-between active:bg-black/5 select-none text-left',
          tapProps?.className ?? '',
        ].join(' ')}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-[20px] font-semibold text-app-text truncate">{entry.displayName}</div>
            {entry.isOfficial ? (
              <span className="px-2 py-[2px] rounded-full bg-[#3B82F6] text-white text-[12px] font-semibold flex-shrink-0">
                {s.call_official_badge}
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[14px] text-gray-400 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-sm bg-black/5 inline-block" aria-hidden="true" />
              {entry.dateText}
            </span>
            {entry.locationText ? <span>{entry.locationText}</span> : null}
          </div>
        </div>
        <IcNavForward className="w-5 h-5 text-gray-300 ml-3 flex-shrink-0" />
      </button>
      {showDivider ? <div className="h-px bg-black/5 ml-6" /> : null}
    </div>
  );
};

const DialpadOverlay: React.FC<{
  sims: SimProfile[];
  onClose: () => void;
}> = ({ sims, onClose }) => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { themeService, version } = useTheme();
  const s = useAppStrings(strings, stringsEn);
  const [digits, setDigits] = useState('');

  const buttons = [
    { key: '1', sub: '' },
    { key: '2', sub: 'ABC' },
    { key: '3', sub: 'DEF' },
    { key: '4', sub: 'GHI' },
    { key: '5', sub: 'JKL' },
    { key: '6', sub: 'MNO' },
    { key: '7', sub: 'PQRS' },
    { key: '8', sub: 'TUV' },
    { key: '9', sub: 'WXYZ' },
    { key: '*', sub: '' },
    { key: '0', sub: '+' },
    { key: '#', sub: '' },
  ] as const;

  const call = (slot: SimSlot) => {
    window.dispatchEvent(
      new CustomEvent('phone:toast', {
        detail: {
          message: digits
            ? (isEnglish ? `Simulated call (SIM ${slot}): ${digits}` : `模拟拨号（卡${slot}）：${digits}`)
            : (isEnglish ? 'Please enter a number' : '请输入号码'),
        },
      }),
    );
  };

  const backspace = () => {
    setDigits((previous) => previous.slice(0, Math.max(0, previous.length - 1)));
  };

  return (
    <div className="absolute inset-0 z-30">
      <div className="absolute inset-0 bg-black/0" onClick={onClose} />

      <div className="absolute left-0 right-0 bottom-[86px] bg-app-surface rounded-t-[24px] shadow-[0_-12px_28px_rgba(0,0,0,0.10)] overflow-hidden">
        <div className="px-6 pt-5 pb-2">
          <div className="relative flex items-center justify-center min-h-[44px]">
            <div className="text-center text-[28px] font-semibold tracking-wider text-app-text min-h-[36px] px-10">
              {digits || '\u00A0'}
            </div>
            <button
              type="button"
              aria-label={isEnglish ? 'Delete' : '删除'}
              className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
              onClick={backspace}
            >
              <SymbolIcon name={IcSymbolClose2} size={18} className="text-gray-400" />
            </button>
          </div>
        </div>

        <div className="px-8 pb-4">
          <div className="grid grid-cols-3 gap-y-4 gap-x-8">
            {buttons.map((button) => (
              <button
                key={button.key}
                type="button"
                className="h-(--app-dialpad-key-height) rounded-full active:bg-black/5 flex flex-col items-center justify-center"
                onClick={() => setDigits((previous) => previous + button.key)}
              >
                {(() => {
                  const hint = `dialpad_${button.key}`;
                  const uri =
                    themeService.getAppAsset('contact', hint) ||
                    themeService.getAppAsset('contact', `key_${button.key}`) ||
                    themeService.getAppAsset('contact', button.key) ||
                    null;

                  if (!uri) {
                    return <div className="text-[28px] text-app-text font-medium leading-none">{button.key}</div>;
                  }

                  return <img key={`${version}_${button.key}`} src={uri} className="h-[28px] object-contain" alt={button.key} />;
                })()}
                <div className="text-[10px] text-gray-400 font-semibold leading-none mt-1">{button.sub}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pb-5 flex items-center justify-between gap-3">
          <button
            type="button"
            aria-label={isEnglish ? 'Menu' : '菜单'}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5 text-gray-700"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('phone:toast', {
                  detail: { message: isEnglish ? 'Dialer menu is not implemented yet' : '拨号菜单（未实现）' },
                }),
              )
            }
          >
            <div className="flex flex-col gap-[3px]">
              <span className="w-5 h-[2px] rounded-full bg-current" />
              <span className="w-5 h-[2px] rounded-full bg-current" />
              <span className="w-5 h-[2px] rounded-full bg-current" />
            </div>
          </button>

          <button
            type="button"
            style={{
              backgroundColor: 'var(--app-c-call-button-background)',
              ...(themeService.getAppAsset('contact', 'call_button')
                ? {
                    backgroundImage: `url(${themeService.getAppAsset('contact', 'call_button')})`,
                    backgroundSize: '100% 100%',
                  }
                : {}),
            }}
            className="flex-1 h-12 rounded-full text-white text-[16px] font-semibold active:opacity-80 bg-center bg-no-repeat"
            onClick={() => call((sims[0]?.slot ?? 1) as SimSlot)}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <SymbolIcon name={IcSymbolPhone} size={18} className="text-white" />
              {sims[0]?.label ?? s.sim_card_1}
            </span>
          </button>

          <button
            type="button"
            style={{
              backgroundColor: 'var(--app-c-call-button-background)',
              ...(themeService.getAppAsset('contact', 'call_button')
                ? {
                    backgroundImage: `url(${themeService.getAppAsset('contact', 'call_button')})`,
                    backgroundSize: '100% 100%',
                  }
                : {}),
            }}
            className="flex-1 h-12 rounded-full text-white text-[16px] font-semibold active:opacity-80 bg-center bg-no-repeat"
            onClick={() => call((sims[1]?.slot ?? 2) as SimSlot)}
          >
            <span className="inline-flex items-center justify-center gap-2">
              <SymbolIcon name={IcSymbolPhone} size={18} className="text-white" />
              {sims[1]?.label ?? s.sim_card_2}
            </span>
          </button>

          <button
            type="button"
            aria-label={isEnglish ? 'More' : '更多'}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('phone:toast', {
                  detail: { message: isEnglish ? 'More actions are not implemented yet' : '更多（未实现）' },
                }),
              )
            }
          >
            <div className="grid grid-cols-3 gap-[3px] text-gray-700">
              {Array.from({ length: 9 }).map((_, index) => (
                <span key={index} className="w-[3px] h-[3px] rounded-full bg-current" />
              ))}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export const CallsPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { bindTap, back } = useContactsGestures();
  const [searchParams] = useSearchParams();
  const dialpadOpen = searchParams.get('dialpad') === 'true';
  const list = useMemo(() => CONTACTS_CONFIG.callLogs, []);
  const s = useAppStrings(strings, stringsEn);
  const sims = useSimProfiles();

  const [toast, setToast] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (message: string) => {
    setToast({ visible: true, message });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast({ visible: false, message: '' }), 1300);
  };

  React.useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ message?: string }>;
      const message = customEvent.detail?.message;
      if (typeof message === 'string' && message) {
        showToast(message);
      }
    };

    window.addEventListener('phone:toast', handler);
    return () => window.removeEventListener('phone:toast', handler);
  }, []);

  return (
    <div className="h-full w-full bg-app-surface relative flex flex-col">
      <Toast visible={toast.visible} message={toast.message} />

      <div className="sticky top-0 z-20 bg-app-surface">
        <div className="h-10" />
        <div className="px-6 pt-2 pb-3 relative">
          <div className="text-[36px] font-semibold text-app-text">{s.dialerIconLabel}</div>

          <button
            type="button"
            aria-label={isEnglish ? 'Settings' : '设置'}
            {...bindTap('settings.open.calls')}
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

        <div className="px-6 pb-2">
          <button type="button" className="text-[16px] font-semibold text-[#9CA3AF] flex items-center gap-1 active:opacity-70">
            {s.callFilterAll}
            <SymbolIcon name={IcSymbolExpandMore} size={18} className="text-[#9CA3AF]" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-[110px]" data-scroll-container="main" data-scroll-direction="vertical">
        {list.map((entry, index) => (
          <CallLogItem
            key={entry.id}
            entry={entry}
            showDivider={index < list.length - 1}
            tapProps={bindTap('call.open', { params: { callLogId: entry.id } })}
          />
        ))}
      </div>

      {!dialpadOpen ? <DialpadFab label={isEnglish ? 'Open dial pad' : '打开拨号盘'} tapProps={bindTap('dialpad.open')} /> : null}

      {dialpadOpen ? (
        <DialpadOverlay
          sims={sims}
          onClose={() => {
            back(1);
          }}
        />
      ) : null}
    </div>
  );
};
