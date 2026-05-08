import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcNavBack, IcNavForward, IcUser, IcWallet, IcBell, IcCog, IcInfo, IcEducation, IcHeart, IcTheme, IcFeature, IcSecureCheck, IcEdit } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
export const SettingsPage: React.FC = () => {
  const { bindTap, bindBack } = useAlipayGestures();
  const settings = useAlipayStore(s => s.settings);
  const setSettings = useAlipayStore(s => s.setSettings);
  const s = useAlipayStrings();
  const visualRefreshEnabled = settings.visualRefreshEnabled;

  const groups = [
    [
      { icon: IcUser, bg: '#FFB74D', label: s.account_and_security },
      { icon: IcWallet, bg: '#4B9FFF', label: s.payment_settings },
    ],
    [
      { icon: IcHeart, bg: '#4B9FFF', label: s.elder_mode },
      { icon: IcEducation, bg: '#1677FF', label: s.student_mode },
    ],
    [
      { icon: IcBell, bg: '#FF6E30', label: s.notifications_2 },
      { icon: IcTheme, bg: '#FFB74D', label: s.skin_center },
      { icon: IcFeature, bg: '#4B9FFF', label: s.visual_refresh, type: 'switch' as const },
    ],
    [
      { icon: IcSecureCheck, bg: '#4B9FFF', label: s.protection_center, extra: s.privacy_security_etc },
      { icon: IcCog, bg: '#FF6E30', label: s.general },
    ],
    [
      { icon: IcEdit, bg: '#FFB74D', label: s.feedback_and_complaints },
      { icon: IcInfo, bg: '#4B9FFF', label: s.about, extra: s.version_10_8_20 },
    ],
  ];

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      {/* Status bar overlay */}
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-bg z-10 pointer-events-none"></div>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-app-bg px-4 pt-4 pb-2 flex items-center justify-between">
        <button {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-800">{s.settings_2}</span>
        <div className="w-6" />
      </div>
      {/* List (scrollable) */}
      <div className="flex-1 overflow-auto no-scrollbar px-4 space-y-3">
        {groups.map((group, gi) => (
          <div key={gi} className="bg-app-surface rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100">
            {group.map((item, idx) => {
              const Icon = item.icon;
              const isSwitch = (item as any).type === 'switch';
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between p-4 active:bg-gray-50"
                  {...(item.label === s.general
                    ? bindTap<HTMLDivElement>('settings.general.open')
                    : item.label === s.payment_settings
                      ? bindTap<HTMLDivElement>('settings.payment.open')
                      : item.label === s.notifications_2
                        ? bindTap<HTMLDivElement>('settings.notifications.open')
                        : {})}
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center mr-3" style={{ backgroundColor: item.bg }}>
                      <Icon size={18} className="text-white" strokeWidth={2} />
                    </div>
                    <span className="text-sm font-medium text-gray-800">{item.label}</span>
                  </div>
                  {isSwitch ? (
                    <button
                      {...bindTap<HTMLButtonElement>(
                        { kind: 'action', id: 'settings.visualRefresh.toggle' },
                        {
                          onTrigger: () => setSettings((prev) => ({ ...prev, visualRefreshEnabled: !prev.visualRefreshEnabled })),
                          stopPropagation: true,
                        },
                      )}
 className={`w-12 h-7 rounded-full flex items-center p-1 ${visualRefreshEnabled ? 'bg-app-primary justify-end' : 'bg-gray-300 justify-start'}`}
 style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
                    >
                      <div className="w-5 h-5 bg-app-surface rounded-full shadow" />
                    </button>
                  ) : (
                    <div className="flex items-center text-xs text-gray-400">
                      {'extra' in item && item.extra && <span className="mr-2">{item.extra}</span>}
                      <IcNavForward size={16} className="text-gray-300" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        <div className="pt-2 space-y-3">
          <button className="w-full bg-app-surface text-gray-800 py-3 rounded-xl text-sm shadow-sm">{s.log_in_with_another_account}</button>
          <button className="w-full bg-app-surface text-gray-800 py-3 rounded-xl text-sm shadow-sm">{s.log_out}</button>
        </div>

        <div className="text-center text-xs text-app-primary mt-4">
          <button className="text-app-primary">{s.personal_info_sharing_list}</button>
          <span className="mx-2 text-app-primary"> </span>
          <button className="text-app-primary">{s.personal_info_collected_list}</button>
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
};
