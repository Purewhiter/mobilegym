
import React from 'react';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useWechatStore } from '../../state';
import { SettingsItem, SettingsToggle } from './Shared';
import { useWechatGestures } from '../../hooks/useWechatGestures';

// --- Account Security ---
export const AccountSecurity: React.FC = () => {
  const t = useWechatStrings();
  const { bindTap } = useWechatGestures();

  return (
    <div className="bg-app-bg min-h-full pb-10 pt-2">
      <div className="bg-app-surface mb-2">
        <SettingsItem label={t.security_wechat_password} />
        <SettingsItem label={t.security_voiceprint} isLast />
      </div>

      <div className="bg-app-surface mb-2">
        <SettingsItem label={t.security_emergency_contacts} />
        <SettingsItem label={t.security_login_devices} />
        <SettingsItem label={t.security_more_settings} tapProps={bindTap('security.more.open')} isLast />
      </div>

      <div className="bg-app-surface mb-2">
        <SettingsItem
          label={t.security_wechat_center}
          tapProps={bindTap('securityCenter.open')}
          isLast
        />
      </div>

      <div className="px-4 py-2 text-(--app-c-tw-text-gray-400) text-xs">{t.security_center_hint}</div>
    </div>
  );
};

// --- Friend Permissions ---
export const FriendPermissions: React.FC = () => {
  const t = useWechatStrings();
  const { bindTap } = useWechatGestures();
  const settings = useWechatStore(s => s.settings);
  const updateSettings = useWechatStore(s => s.updateSettings);
  const { privacy } = settings;

  const update = (
    key: keyof Omit<typeof privacy, 'addMeMethods' | 'momentsStrangerTen' | 'momentsRange'>,
    value: boolean,
  ) => {
    updateSettings({
      ...settings,
      privacy: { ...privacy, [key]: value },
    });
  };

  return (
    <div className="bg-app-bg min-h-full pb-10 pt-2">
      <div className="bg-app-surface mb-2">
        <SettingsToggle
          label={t.privacy_require_friend_request}
          isOn={privacy.friendConfirmation}
          onToggle={() => update('friendConfirmation', !privacy.friendConfirmation)}
          actionProps={bindTap<HTMLDivElement>(
            { kind: 'action', id: 'settings.privacy.friendConfirmation.toggle' },
            { onTrigger: () => update('friendConfirmation', !privacy.friendConfirmation) },
          )}
          isLast
        />
      </div>

      <div className="bg-app-surface mb-2">
        <SettingsItem
          label={t.privacy_add_me_methods_label}
          tapProps={bindTap<HTMLDivElement>('settings.privacy.addMe.open')}
        />
        <SettingsToggle
          label={t.privacy_recommend_contacts}
          subLabel={t.privacy_recommend_contacts_hint}
          isOn={privacy.recommendAddressBook}
          onToggle={() => update('recommendAddressBook', !privacy.recommendAddressBook)}
          actionProps={bindTap<HTMLDivElement>(
            { kind: 'action', id: 'settings.privacy.recommendAddressBook.toggle' },
            { onTrigger: () => update('recommendAddressBook', !privacy.recommendAddressBook) },
          )}
          isLast
        />
      </div>

      <div className="px-4 py-2 text-(--app-c-tw-text-gray-500) text-sm">{t.discover_friend_permission}</div>
      <div className="bg-app-surface mb-2">
        <SettingsItem label={t.chat_only} />
        <SettingsItem
          label={t.discover_moments}
          tapProps={bindTap<HTMLDivElement>('settings.privacy.moments.open')}
        />
        <SettingsItem label={t.discover_channels} />
        <SettingsItem
          label={t.discover_watch}
          tapProps={bindTap<HTMLDivElement>('settings.privacy.topStories.open')}
        />
        <SettingsItem label={t.settings_wechat_sports} isLast />
      </div>

      <div className="bg-app-surface mb-2">
        <SettingsItem
          label={t.privacy_blacklist_contacts}
          tapProps={bindTap<HTMLDivElement>('settings.privacy.blacklist.open')}
          isLast
        />
      </div>
    </div>
  );
};

// --- Personal Info Permissions ---
export const PersonalInfoPermissions: React.FC = () => {
  const t = useWechatStrings();
  const { bindTap } = useWechatGestures();

  return (
    <div className="bg-app-bg min-h-full pb-10 pt-2">
      <div className="bg-app-surface mb-2">
        <SettingsItem label={t.privacy_system_permission_mgmt} />
        <SettingsItem
          label={t.privacy_authorization_mgmt}
          tapProps={bindTap<HTMLDivElement>('settings.privacy.authorization.open')}
          isLast
        />
      </div>

      <div className="bg-app-surface mb-2">
        <SettingsItem label={t.privacy_personalized_ads} isLast />
      </div>

      <div className="bg-app-surface mb-2">
        <SettingsItem label={t.privacy_personal_info_export} isLast />
      </div>

      <div className="mt-auto mt-10 px-4 text-center space-x-4">
        <span className="text-(--app-c-address-link-text) text-sm">{t.privacy_guide_summary}</span>
        <span className="text-(--app-c-address-link-text) text-sm">{t.privacy_guide_full}</span>
      </div>
    </div>
  );
};
