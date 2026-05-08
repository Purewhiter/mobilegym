import React from 'react';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useWechatStore } from '../../state';
import { SettingsItem } from './Shared';

export const MoreSecurityPage: React.FC = () => {
  const t = useWechatStrings();
  const qqId = useWechatStore(s => s.user.qqId);

  return (
    <div className="bg-app-bg min-h-full pb-10 pt-2">
      <div className="bg-app-surface mb-2">
        <SettingsItem
          label={t.security_more_qq}
          rightContent={<span className="text-sm" style={{ color: 'var(--app-c-settings-item-extra-text)' }}>{qqId ?? t.security_more_email_unbound}</span>}
        />
        <SettingsItem
          label={t.security_more_email}
          rightContent={<span className="text-sm" style={{ color: 'var(--app-c-settings-item-extra-text)' }}>{t.security_more_email_unbound}</span>}
          isLast
        />
      </div>

      <div className="bg-app-surface">
        <SettingsItem label={t.security_more_phone_protection} isLast />
      </div>
    </div>
  );
};
