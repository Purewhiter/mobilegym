
import React from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { useParams } from 'react-router-dom';
import { IcBell, IcSquareUser, IcMail, IcMessage, IcWallet, IcSparkles } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useShallow } from 'zustand/react/shallow';
import { SettingsItem, SettingsToggle } from './Shared';
import { UserSettings } from '../../types';
import { useWechatGestures } from '../../hooks/useWechatGestures';

export const AccessibilityDetailPage: React.FC<{ featureId?: keyof UserSettings['accessibility'] }> = ({ featureId }) => {
    const t = useWechatStrings();
    // 支持两种来源：
    // - 静态路由：由外部传入 featureId（推荐，便于图/声明静态化）
    // - 兼容旧写法：从 params.id 读取（如果仍有旧路由存在）
    const params = useParams();
    const id = (featureId ?? (params.id as any)) as keyof UserSettings['accessibility'];
    const { bindTap } = useWechatGestures();
    const { settings: allSettings, updateSettings } = useWechatStore(useShallow(s => ({
        settings: s.settings,
        updateSettings: s.updateSettings,
    })));
    const accessibilitySettings = allSettings.accessibility;

    if (!id || !accessibilitySettings[id]) return null;

    const currentSetting = accessibilitySettings[id];
    const isEnabled = currentSetting.enabled;

    const configs = {
        tencentNews: { label: t.accessibility_tencent_news, icon: <IcBell size={dimens.icSizePlaceholder} className="text-white" fill="white" />, color: 'bg-(--app-c-me-icon-settings)', intro: t.accessibility_desc_tencent_news },
        broadcast: { label: t.accessibility_broadcast, icon: <IcSquareUser size={dimens.icSizePlaceholder} className="text-white" fill="white" />, color: 'bg-app-primary', intro: t.accessibility_desc_broadcast },
        qqMail: { label: t.accessibility_qq_mail, icon: <IcMail size={dimens.icSizePlaceholder} className="text-white" fill="white" />, color: 'bg-(--app-c-me-icon-settings)', intro: t.accessibility_desc_qq_mail },
        wechatSports: { label: t.settings_wechat_sports, icon: <IcMessage size={dimens.icSizePlaceholder} className="text-white" fill="white" />, color: 'bg-app-primary', intro: t.accessibility_desc_wechat_sports },
        wechatPay: { label: t.accessibility_wechat_pay, icon: <IcWallet size={dimens.icSizePlaceholder} className="text-white" fill="white" />, color: 'bg-app-primary', intro: t.accessibility_desc_wechat_pay },
        wechatGames: { label: t.accessibility_wechat_games, icon: <IcSparkles size={dimens.icSizePlaceholder} className="text-white" fill="white" />, color: 'bg-(--app-c-me-icon-stickers)', intro: t.accessibility_desc_wechat_games },
    }[id];

    const handleToggleState = (enabled: boolean) => {
        updateSettings({
                ...allSettings,
                accessibility: {
                    ...accessibilitySettings,
                    [id]: { ...currentSetting, enabled }
                }
        });
    };

    const updateField = (field: string, value: boolean) => {
        updateSettings({
                ...allSettings,
                accessibility: {
                    ...accessibilitySettings,
                    [id]: { ...currentSetting, [field]: value }
                }
        });
    };

    // 规范：避免动态拼接/变量传入 actionId，使用显式枚举（便于静态工具完全发现）。
    const enableActionProps = () => {
        switch (id) {
            case 'tencentNews':
                return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.accessibility.tencentNews.enable.submit' }, { onTrigger: () => handleToggleState(true) });
            case 'broadcast':
                return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.accessibility.broadcast.enable.submit' }, { onTrigger: () => handleToggleState(true) });
            case 'qqMail':
                return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.accessibility.qqMail.enable.submit' }, { onTrigger: () => handleToggleState(true) });
            case 'wechatSports':
                return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.accessibility.wechatSports.enable.submit' }, { onTrigger: () => handleToggleState(true) });
            case 'wechatPay':
                return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.accessibility.wechatPay.enable.submit' }, { onTrigger: () => handleToggleState(true) });
            case 'wechatGames':
                return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.accessibility.wechatGames.enable.submit' }, { onTrigger: () => handleToggleState(true) });
            default:
                return undefined;
        }
    };

    const disableActionProps = () => {
        switch (id) {
            case 'tencentNews':
                return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.accessibility.tencentNews.disable.submit' }, { onTrigger: () => handleToggleState(false) });
            case 'broadcast':
                return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.accessibility.broadcast.disable.submit' }, { onTrigger: () => handleToggleState(false) });
            case 'qqMail':
                return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.accessibility.qqMail.disable.submit' }, { onTrigger: () => handleToggleState(false) });
            case 'wechatSports':
                return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.accessibility.wechatSports.disable.submit' }, { onTrigger: () => handleToggleState(false) });
            case 'wechatPay':
                return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.accessibility.wechatPay.disable.submit' }, { onTrigger: () => handleToggleState(false) });
            case 'wechatGames':
                return bindTap<HTMLButtonElement>({ kind: 'action', id: 'settings.accessibility.wechatGames.disable.submit' }, { onTrigger: () => handleToggleState(false) });
            default:
                return undefined;
        }
    };

    const stickyToggleActionProps = () => {
        switch (id) {
            case 'tencentNews':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.accessibility.tencentNews.sticky.toggle' }, { onTrigger: () => updateField('sticky', !(currentSetting as any).sticky) });
            case 'broadcast':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.accessibility.broadcast.sticky.toggle' }, { onTrigger: () => updateField('sticky', !(currentSetting as any).sticky) });
            case 'wechatSports':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.accessibility.wechatSports.sticky.toggle' }, { onTrigger: () => updateField('sticky', !(currentSetting as any).sticky) });
            default:
                return undefined;
        }
    };

    const dndToggleActionProps = () => {
        switch (id) {
            case 'tencentNews':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.accessibility.tencentNews.dnd.toggle' }, { onTrigger: () => updateField('dnd', !(currentSetting as any).dnd) });
            case 'broadcast':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.accessibility.broadcast.dnd.toggle' }, { onTrigger: () => updateField('dnd', !(currentSetting as any).dnd) });
            case 'wechatSports':
                return bindTap<HTMLDivElement>({ kind: 'action', id: 'settings.accessibility.wechatSports.dnd.toggle' }, { onTrigger: () => updateField('dnd', !(currentSetting as any).dnd) });
            default:
                return undefined;
        }
    };

    return (
        <div className="bg-(--app-c-chat-input-bar-bg) min-h-full flex flex-col">
            {/* Header Area */}
            <div className="bg-app-surface flex items-center px-6 py-8">
                <div className={`${configs?.color} w-20 h-20 rounded-[12px] flex items-center justify-center mr-5`}>
                    {configs?.icon}
                </div>
                <div>
                    <h2 className="text-(--app-me-username-size) font-bold text-app-text mb-1">{configs?.label}</h2>
                    <p className={`text-(--app-search-filter-text-size) ${isEnabled ? 'text-app-primary' : 'text-(--app-c-tw-text-gray-400)'}`}>
                        {isEnabled ? t.accessibility_enabled : t.accessibility_disabled}
                    </p>
                </div>
            </div>

            <div className="h-2 bg-(--app-c-chat-input-bar-bg)"></div>

            {/* Content for NOT ENABLED */}
            {!isEnabled && (
                <>
                    <div className="bg-app-surface">
                        <div className="flex px-5 py-4 border-b border-(--app-c-tw-border-gray-100)">
                            <span className="text-(--app-settings-item-text-size) text-app-text w-24 flex-shrink-0">{t.accessibility_intro}</span>
                            <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-gray-500)">{configs?.intro}</span>
                        </div>
                        <SettingsItem label={t.accessibility_clear_history} isLast />
                    </div>
                    
                    <div className="mt-auto mb-20 flex justify-center w-full">
                        <button 
                            {...(enableActionProps() ?? {})}
                            className="text-app-primary font-bold text-(--app-settings-item-text-size) active:opacity-60"
                        >
                            {t.accessibility_enable}
                        </button>
                    </div>
                </>
            )}

            {/* Content for ENABLED */}
            {isEnabled && (
                <>
                    <div className="bg-app-surface">
                        <div className="flex px-5 py-4 border-b border-(--app-c-tw-border-gray-100)">
                            <span className="text-(--app-settings-item-text-size) text-app-text w-24 flex-shrink-0">{t.accessibility_intro}</span>
                            <span className="text-(--app-settings-item-text-size) text-(--app-c-tw-text-gray-500)">{configs?.intro}</span>
                        </div>
                        <SettingsItem 
                            label={`${t.accessibility_enter}${configs?.label}`} 
                            tapProps={id === 'wechatSports' ? bindTap<HTMLDivElement>('wechatSports.open') : undefined}
                        />
                        {id === 'wechatSports' && (
                            <>
                                <SettingsItem label={t.accessibility_enter_my_profile} tapProps={bindTap<HTMLDivElement>('wechatSports.profile.me.open')} />
                                <SettingsItem label={t.accessibility_invite_friend} />
                                <SettingsItem label={t.accessibility_faq} isLast />
                            </>
                        )}
                        {id !== 'wechatSports' && <div className="h-0 border-b border-(--app-c-tw-border-gray-100) ml-5"></div>}
                    </div>

                    <div className="h-2 bg-(--app-c-chat-input-bar-bg)"></div>

                    <div className="bg-app-surface">
                        <SettingsItem label={t.accessibility_data_source} />
                        <SettingsItem
                          label={t.topbar_privacy_settings}
                          isLast
                          tapProps={id === 'wechatSports' ? bindTap<HTMLDivElement>('wechatSports.privacy.open') : undefined}
                        />
                    </div>

                    <div className="h-2 bg-(--app-c-chat-input-bar-bg)"></div>

                    {/* Fix: Check for 'sticky' and 'dnd' properties availability in currentSetting union */}
                    <div className="bg-app-surface">
                        {'sticky' in currentSetting && (
                            <SettingsToggle 
                                label={t.accessibility_sticky} 
                                isOn={!!(currentSetting as any).sticky} 
                                onToggle={() => updateField('sticky', !(currentSetting as any).sticky)}
                                actionProps={stickyToggleActionProps()} 
                            />
                        )}
                        {'dnd' in currentSetting && (
                            <SettingsToggle 
                                label={t.accessibility_dnd} 
                                isOn={!!(currentSetting as any).dnd} 
                                onToggle={() => updateField('dnd', !(currentSetting as any).dnd)}
                                actionProps={dndToggleActionProps()} 
                                isLast
                            />
                        )}
                    </div>

                    <div className="h-2 bg-(--app-c-chat-input-bar-bg)"></div>

                    <div className="bg-app-surface">
                        <SettingsItem label={t.accessibility_clear_history} isLast />
                    </div>

                    <div className="mt-auto mb-20 flex justify-center w-full">
                        <button 
                            {...(disableActionProps() ?? {})}
                            className="text-(--app-c-common-red) font-bold text-(--app-settings-item-text-size) active:opacity-60"
                        >
                            {t.accessibility_disable}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};
