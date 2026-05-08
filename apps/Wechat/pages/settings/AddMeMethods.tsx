
import React from 'react';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { SettingsToggle } from './Shared';
import { useWechatGestures } from '../../hooks/useWechatGestures';

export const AddMeMethodsPage: React.FC = () => {
  const t = useWechatStrings();
  const { settings, updateSettings } = useWechatStore(
    useShallow(s => ({
      settings: s.settings,
      updateSettings: s.updateSettings,
    })),
  );
  const { bindTap } = useWechatGestures();
  const { privacy } = settings;
  const methods = privacy.addMeMethods;

  const update = (key: keyof typeof methods, value: boolean) => {
    updateSettings({
      ...settings,
      privacy: {
        ...privacy,
        addMeMethods: { ...methods, [key]: value },
      },
    });
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <div className="px-5 py-2.5 text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-500) font-normal bg-app-bg">
      {title}
    </div>
  );

  return (
    <div className="bg-app-bg min-h-full">
      <SectionHeader title={t.add_me_search_header} />
      <div className="bg-app-surface">
        <SettingsToggle
          label={t.add_me_wechat_id}
          isOn={methods.searchByWxid}
          onToggle={() => update('searchByWxid', !methods.searchByWxid)}
          actionProps={bindTap<HTMLDivElement>(
            { kind: 'action', id: 'settings.privacy.addMe.searchByWxid.toggle' },
            { onTrigger: () => update('searchByWxid', !methods.searchByWxid) },
          )}
        />
        <SettingsToggle
          label={t.contacts_phone}
          isOn={methods.searchByPhone}
          onToggle={() => update('searchByPhone', !methods.searchByPhone)}
          actionProps={bindTap<HTMLDivElement>(
            { kind: 'action', id: 'settings.privacy.addMe.searchByPhone.toggle' },
            { onTrigger: () => update('searchByPhone', !methods.searchByPhone) },
          )}
          isLast
        />
      </div>

      <SectionHeader title={t.add_me_add_header} />
      <div className="bg-app-surface">
        <SettingsToggle
          label={t.contacts_group_chat}
          isOn={methods.addByGroup}
          onToggle={() => update('addByGroup', !methods.addByGroup)}
          actionProps={bindTap<HTMLDivElement>(
            { kind: 'action', id: 'settings.privacy.addMe.addByGroup.toggle' },
            { onTrigger: () => update('addByGroup', !methods.addByGroup) },
          )}
        />
        <SettingsToggle
          label={t.add_me_qr_code}
          isOn={methods.addByQrCode}
          onToggle={() => update('addByQrCode', !methods.addByQrCode)}
          actionProps={bindTap<HTMLDivElement>(
            { kind: 'action', id: 'settings.privacy.addMe.addByQrCode.toggle' },
            { onTrigger: () => update('addByQrCode', !methods.addByQrCode) },
          )}
        />
        <SettingsToggle
          label={t.chat_card}
          isOn={methods.addByCard}
          onToggle={() => update('addByCard', !methods.addByCard)}
          actionProps={bindTap<HTMLDivElement>(
            { kind: 'action', id: 'settings.privacy.addMe.addByCard.toggle' },
            { onTrigger: () => update('addByCard', !methods.addByCard) },
          )}
        />
        <SettingsToggle
          label={t.add_me_other}
          subLabel={t.add_me_other_hint}
          isOn={methods.addByOther}
          onToggle={() => update('addByOther', !methods.addByOther)}
          actionProps={bindTap<HTMLDivElement>(
            { kind: 'action', id: 'settings.privacy.addMe.addByOther.toggle' },
            { onTrigger: () => update('addByOther', !methods.addByOther) },
          )}
          isLast
        />
      </div>
    </div>
  );
};
