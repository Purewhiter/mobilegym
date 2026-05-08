import React from 'react';
import { useLocation } from 'react-router-dom';
import { useContactsGestures } from '../hooks/useContactsGestures';
import { SymbolIcon } from './SymbolIcon';
import { IcSymbolCarrier, IcSymbolContactsCircle, IcSymbolPhone } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';

type TabKey = 'calls' | 'contacts' | 'business';

function getActiveTab(pathname: string): TabKey {
  if (pathname.startsWith('/contacts')) return 'contacts';
  if (pathname.startsWith('/business')) return 'business';
  if (pathname.startsWith('/settings')) return 'calls'; // keep dialer selected in settings
  return 'calls';
}

export const BottomTabBar: React.FC = () => {
  const { bindTap } = useContactsGestures();
  const location = useLocation();
  const active = getActiveTab(location.pathname);
  const s = useAppStrings(strings, stringsEn);

  const items: Array<{
    key: TabKey;
    label: string;
    icon: React.ReactNode;
    tapProps: React.HTMLAttributes<HTMLButtonElement>;
  }> = [
    {
      key: 'calls',
      label: s.dialerIconLabel,
      icon: <SymbolIcon name={IcSymbolPhone} size={26} />,
      tapProps: bindTap('tab.calls'),
    },
    {
      key: 'contacts',
      label: s.contactsAllLabel,
      icon: <SymbolIcon name={IcSymbolContactsCircle} size={26} />,
      tapProps: bindTap('tab.contacts'),
    },
    {
      key: 'business',
      label: s.businessHallLabel,
      icon: <SymbolIcon name={IcSymbolCarrier} size={26} />,
      tapProps: bindTap('tab.business'),
    },
  ];

  return (
    <div className="absolute left-0 right-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-black/5">
      <div className="h-[72px] flex items-center justify-around px-6">
        {items.map((it) => {
          const isActive = active === it.key;
          const color = isActive ? 'text-black' : 'text-gray-400';
          return (
            <button
              key={it.key}
              type="button"
              aria-label={it.label}
              {...it.tapProps}
              className="flex flex-col items-center justify-center gap-[2px] active:opacity-70 select-none"
            >
              <div className={color}>{it.icon}</div>
              <div className={['text-[11px] font-medium', color].join(' ')}>{it.label}</div>
            </button>
          );
        })}
      </div>
      {/* extra safe area to mimic gesture inset */}
      <div className="h-[14px]" />
    </div>
  );
};

