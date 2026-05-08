
import React from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { IcNavForward, IcLightbulb } from '../../res/icons';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useWechatStore } from '../../state';
import { useAppNavigate } from '../../navigation';

export const SettingsPage: React.FC = () => {
  const t = useWechatStrings();
    const { bindTap } = useWechatGestures();
    const { go } = useAppNavigate();
    const updateSettings = useWechatStore(s => s.updateSettings);
    const logout = useWechatStore(s => s.logout);

    // Fix: Made children optional to resolve TypeScript "missing property" errors in JSX
    const SettingsGroup = ({ children, title }: { children?: React.ReactNode, title?: string }) => (
        <div className="mb-2">
            {title && (
                <div className="px-5 py-2 text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-500) font-normal">
                    {title}
                </div>
            )}
            <div className="bg-app-surface">
                {children}
            </div>
        </div>
    );

    const SettingsItem = ({
        label,
        tapProps,
        extra,
        isLast = false,
        rightElement,
        labelIcon,
    }: {
        label: string;
        tapProps?: React.HTMLAttributes<HTMLDivElement>;
        extra?: string;
        isLast?: boolean;
        rightElement?: React.ReactNode;
        labelIcon?: React.ReactNode;
    }) => (
         <div 
            {...(tapProps ?? {})}
            className={`flex justify-between items-stretch px-5 py-3 bg-app-surface active:bg-(--app-c-tw-bg-gray-100) ${!isLast ? 'border-b border-(--app-c-tw-border-gray-100)' : ''} min-h-(--app-settings-item-height) ${tapProps ? 'cursor-pointer' : ''}`}
         >
             <div className="flex min-w-0 flex-1 items-center pr-3">
                 <span className="text-(--app-settings-item-text-size) text-(--app-c-settings-item-text) font-normal leading-normal break-words [overflow-wrap:anywhere]">{label}</span>
                 {labelIcon && <div className="ml-1">{labelIcon}</div>}
             </div>
             <div className="ml-3 flex items-center self-center text-(--app-c-settings-item-extra-text)">
                {extra && <span className="mr-2 max-w-[8.5rem] text-(--app-settings-item-text-size) text-right leading-normal break-words [overflow-wrap:anywhere] whitespace-normal">{extra}</span>}
                {rightElement}
                <IcNavForward size={dimens.icSizeChevron} className="text-(--app-c-settings-item-chevron) ml-2" strokeWidth={dimens.icStrokeWidth} />
             </div>
         </div>
    );

    return (
        <div className="bg-app-bg min-h-full pb-10 overflow-y-auto no-scrollbar">
            
            {/* Group 1: Personal Info & Security */}
            <SettingsGroup>
                <SettingsItem label={t.settings_profile} tapProps={bindTap<HTMLDivElement>('profile.detail.open')} />
                <SettingsItem label={t.settings_account_security} tapProps={bindTap<HTMLDivElement>('settings.security.open')} isLast />
            </SettingsGroup>

            {/* Group 2: Modes */}
            <SettingsGroup>
                <SettingsItem label={t.settings_minor_mode} tapProps={bindTap<HTMLDivElement>('settings.minorMode.open')} />
                <SettingsItem label={t.settings_care_mode} tapProps={bindTap<HTMLDivElement>('settings.careMode.open')} isLast />
            </SettingsGroup>

            {/* Group 3: General App Settings */}
            <SettingsGroup>
                <SettingsItem label={t.settings_notifications} tapProps={bindTap<HTMLDivElement>('settings.notifications.open')} />
                <SettingsItem label={t.settings_chat} tapProps={bindTap<HTMLDivElement>('settings.chat.open')} />
                <SettingsItem label={t.settings_general} tapProps={bindTap<HTMLDivElement>('settings.general.open')} />
                <SettingsItem label={t.settings_subscriptions} tapProps={bindTap<HTMLDivElement>('settings.subscriptions.open')} isLast />
            </SettingsGroup>

            {/* Group 4: Privacy */}
            <SettingsGroup title={t.settings_privacy}>
                <SettingsItem label={t.discover_friend_permission} tapProps={bindTap<HTMLDivElement>('settings.privacy.friends.open')} />
                <SettingsItem label={t.settings_personal_info} tapProps={bindTap<HTMLDivElement>('settings.privacy.personal.open')} />
                <SettingsItem label={t.settings_personal_info_list} />
                <SettingsItem label={t.settings_third_party_list} tapProps={bindTap<HTMLDivElement>('settings.privacy.thirdParty.open')} isLast />
            </SettingsGroup>

            {/* Group 5: Plugins */}
            <SettingsGroup>
                <SettingsItem 
                    label={t.settings_plugins}
                    labelIcon={<IcLightbulb size={dimens.icSizeXs} className="text-(--app-c-tw-text-gray-400) stroke-[3]" />}
                    isLast 
                />
            </SettingsGroup>

            {/* Group 6: About */}
            <SettingsGroup>
                <SettingsItem label={t.settings_about} isLast />
            </SettingsGroup>

            {/* Footer Buttons */}
            <div
                className="mt-2 text-center h-(--app-settings-item-height) flex items-center justify-center bg-app-surface text-(--app-settings-item-text-size) font-normal active:bg-(--app-c-tw-bg-gray-100) cursor-pointer text-(--app-c-settings-item-text) border-b border-gray-100/50"
                onClick={() => go('settings.switchAccount')}
            >
                {t.settings_switch_account}
            </div>

            <div
                className="mt-2 text-center h-(--app-settings-item-height) flex items-center justify-center bg-app-surface text-(--app-settings-item-text-size) font-normal active:bg-(--app-c-tw-bg-gray-100) cursor-pointer text-(--app-c-settings-item-text)"
                onClick={() => { logout(); go('settings.switchAccount'); }}
            >
                {t.settings_logout}
            </div>
            
            <div className="h-10"></div>
        </div>
    );
};
