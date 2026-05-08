import React from 'react';
import { IcNavBack, IcNavForward } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useRailwayStrings } from '../hooks/useRailwayStrings';
import { useRailwayStore } from '../state';
export const SettingsPage: React.FC = () => {
  const { bindBack, bindTap } = useRailwayGestures();
  const settings = useRailwayStore(s => s.settings);
  const updateSettings = useRailwayStore(s => s.updateSettings);
  const s = useRailwayStrings();

  const sections = [
    {
      items: [
        { id: 'change_password', label: s.func_change_password, desc: s.settings_change_password_desc, route: 'settings.changePassword' as const },
        { id: 'payment_settings', label: s.settings_payment_settings, desc: s.settings_payment_settings_desc, route: 'settings.paymentPassword' as const },
        { id: 'notification_settings', label: s.notification_settings_title, desc: s.settings_notification_desc, route: 'settings.notificationSettings' as const },
      ],
    },
    {
      items: [
        { id: 'id_verify', label: s.func_id_verify, desc: s.settings_id_verify_desc, route: 'settings.idVerify' as const },
        { id: 'fingerprint', label: s.func_fingerprint, desc: s.settings_fingerprint_desc, route: 'settings.fingerprint' as const, badge: s.settings_badge_on },
      ],
    },
    {
      items: [
        { id: 'version_switch', label: s.version_switch_title, desc: s.settings_version_switch_desc, route: 'settings.versionSwitch' as const, isNew: true },
        { id: 'font_size', label: s.settings_font_size_contrast, desc: s.settings_font_size_contrast_desc, route: 'settings.fontSize' as const, isNew: true },
        { id: 'permissions', label: s.settings_permissions, desc: s.settings_permissions_desc },
      ],
    },
  ];
  const privacyLabels = [s.settings_personal_info_collection, s.settings_third_party_info_sharing];
  const versionText = s.settings_version_number.replace('{version}', '5.9.0.8');

  return (
    <div className="min-h-full bg-app-bg">
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center gap-3 relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">{s.settings_title}</span>
      </div>

      {sections.map((section, si) => (
        <div key={si} className="bg-app-surface mt-2">
          {section.items.map((item, ii) => (
            <div
              key={item.id}
              className="flex items-center px-4 py-4 border-b border-gray-50 last:border-b-0 active:bg-gray-50"
              {...(item.route ? bindTap<HTMLDivElement>(item.route as any) : {})}
            >
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center gap-2">
                <span className="text-base text-gray-900 break-words">{item.label}</span>
                  {(item as any).isNew && (
                    <span className="text-[10px] text-white bg-red-500 rounded-sm px-1.5 py-0.5">{s.common_new}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400 mt-0.5 break-words">{item.desc}</span>
              </div>
              {(item as any).badge && (
                <span className="text-xs text-app-primary border border-app-primary rounded-full px-2 py-0.5 mr-2">
                  {(item as any).badge}
                </span>
              )}
              <IcNavForward size={16} className="text-gray-300" />
            </div>
          ))}
        </div>
      ))}

      {/* 开关项 */}
      <div className="bg-app-surface mt-2">
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-50">
          <div className="min-w-0 pr-2">
            <span className="text-base text-gray-900 break-words">{s.settings_recent_purchase}</span>
            <p className="text-xs text-gray-400 mt-0.5">{s.settings_recent_purchase_desc}</p>
          </div>
          <button
 className={`w-12 h-7 rounded-full ${settings.recentRecommend ? 'bg-app-primary' : 'bg-gray-300'}`}
 style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
            onClick={() => updateSettings({ recentRecommend: !settings.recentRecommend })}
          >
 <div className={`w-5 h-5 bg-app-surface rounded-full shadow ${settings.recentRecommend ? 'translate-x-6' : 'translate-x-1'}`}
 style={{ transition: 'transform var(--app-duration-medium) var(--app-easing-standard)' }} />
          </button>
        </div>
        <div className="flex items-center justify-between px-4 py-4">
          <div className="min-w-0 pr-2">
            <span className="text-base text-gray-900 break-words">{s.settings_personalized_ad}</span>
            <p className="text-xs text-gray-400 mt-0.5">{s.settings_personalized_ad_desc}</p>
          </div>
          <button
 className={`w-12 h-7 rounded-full ${settings.adRecommend ? 'bg-app-primary' : 'bg-gray-300'}`}
 style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
            onClick={() => updateSettings({ adRecommend: !settings.adRecommend })}
          >
 <div className={`w-5 h-5 bg-app-surface rounded-full shadow ${settings.adRecommend ? 'translate-x-6' : 'translate-x-1'}`}
 style={{ transition: 'transform var(--app-duration-medium) var(--app-easing-standard)' }} />
          </button>
        </div>
      </div>

      {/* 隐私相关 */}
      <div className="bg-app-surface mt-2">
        {privacyLabels.map(label => (
          <div key={label} className="flex items-center justify-between px-4 py-4 border-b border-gray-50 last:border-b-0">
            <span className="text-base text-gray-900">{label}</span>
            <IcNavForward size={16} className="text-gray-300" />
          </div>
        ))}
      </div>

      {/* 注销 + 关于 */}
      <div className="bg-app-surface mt-2">
        <div
          className="flex items-center justify-between px-4 py-4 border-b border-gray-50 active:bg-gray-50"
          {...bindTap<HTMLDivElement>('settings.cancelAccount' as any)}
        >
          <span className="text-base text-gray-900">{s.settings_close_account}</span>
          <IcNavForward size={16} className="text-gray-300" />
        </div>
        <div className="flex items-center justify-between px-4 py-4">
          <span className="text-base text-gray-900">{s.info_about}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">{versionText}</span>
            <IcNavForward size={16} className="text-gray-300" />
          </div>
        </div>
      </div>

      {/* 退出登录 */}
      <div className="px-4 mt-6 pb-8">
        <button className="w-full py-3 bg-app-primary rounded-lg text-white text-base font-medium">
          {s.settings_sign_out}
        </button>
      </div>
    </div>
  );
};
