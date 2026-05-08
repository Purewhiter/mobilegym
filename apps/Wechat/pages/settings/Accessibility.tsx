
import React from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { IcBell, IcSquareUser, IcMail, IcMessage, IcWallet, IcSparkles } from '../../res/icons';
import { useWechatStore } from '../../state';
import { SettingsItem } from './Shared';
import { UserSettings } from '../../types';
import { useWechatGestures } from '../../hooks/useWechatGestures';

export const AccessibilityPage: React.FC = () => {
    const t = useWechatStrings();
    const { bindTap } = useWechatGestures();
    const settings = useWechatStore(s => s.settings.accessibility);

    // 规范：避免 bindTap(变量) / 动态拼接 ID，确保静态工具可完全发现入口。
    const tapPropsOf = (id: string) => {
        switch (id) {
            case 'tencentNews':
                return bindTap<HTMLDivElement>('settings.accessibility.tencentNews.open');
            case 'broadcast':
                return bindTap<HTMLDivElement>('settings.accessibility.broadcast.open');
            case 'qqMail':
                return bindTap<HTMLDivElement>('settings.accessibility.qqMail.open');
            case 'wechatSports':
                return bindTap<HTMLDivElement>('settings.accessibility.wechatSports.open');
            case 'wechatPay':
                return bindTap<HTMLDivElement>('settings.accessibility.wechatPay.open');
            case 'wechatGames':
                return bindTap<HTMLDivElement>('settings.accessibility.wechatGames.open');
            default:
                return undefined;
        }
    };

    const allItems = [
        { id: 'tencentNews', label: '腾讯新闻', icon: <div className="bg-(--app-c-me-icon-settings) p-1 rounded-sm"><IcBell size={dimens.icSizeAction} className="text-white" fill="white" /></div> },
        { id: 'broadcast', label: '群发助手', icon: <div className="bg-app-primary p-1 rounded-sm"><IcSquareUser size={dimens.icSizeAction} className="text-white" fill="white" /></div> },
        { id: 'qqMail', label: 'QQ邮箱提醒', icon: <div className="bg-(--app-c-me-icon-settings) p-1 rounded-sm"><IcMail size={dimens.icSizeAction} className="text-white" fill="white" /></div> },
        { id: 'wechatSports', label: t.settings_wechat_sports, icon: <div className="bg-app-primary p-1 rounded-sm"><IcMessage size={dimens.icSizeAction} className="text-white" fill="white" /></div> },
        { id: 'wechatPay', label: '微信支付', icon: <div className="bg-app-primary p-1 rounded-sm"><IcWallet size={dimens.icSizeAction} className="text-white" fill="white" /></div> },
        { id: 'wechatGames', label: '微信游戏', icon: <div className="bg-(--app-c-me-icon-stickers) p-1 rounded-sm"><IcSparkles size={dimens.icSizeAction} className="text-white" fill="white" /></div> },
    ];

    const enabledItems = allItems.filter(item => settings[item.id as keyof typeof settings].enabled);
    const disabledItems = allItems.filter(item => !settings[item.id as keyof typeof settings].enabled);

    return (
        <div className="bg-app-bg min-h-full pb-10">
            {/* Header: Enabled */}
            <div className="px-5 py-3 flex items-center gap-2">
                <div className="flex items-center gap-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-(--app-c-me-icon-stickers)"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-app-primary"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-(--app-c-common-red)"></div>
                </div>
                <span className="text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-500) font-normal">已启用的功能</span>
            </div>
            <div className="bg-app-surface">
                {enabledItems.map((item, idx) => (
                    <SettingsItem 
                        key={item.id}
                        label={item.label}
                        icon={item.icon}
                        tapProps={tapPropsOf(item.id)}
                        isLast={idx === enabledItems.length - 1}
                    />
                ))}
            </div>

            {/* Header: Disabled */}
            <div className="px-5 py-3 flex items-center gap-2 mt-4">
                <div className="flex items-center gap-0.5 opacity-40">
                    <div className="w-1.5 h-1.5 rounded-full bg-(--app-c-tw-bg-gray-400)"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-(--app-c-tw-bg-gray-400)"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-(--app-c-tw-bg-gray-400)"></div>
                </div>
                <span className="text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-500) font-normal">未启用的功能</span>
            </div>
            <div className="bg-app-surface">
                {disabledItems.map((item, idx) => (
                    <SettingsItem 
                        key={item.id}
                        label={item.label}
                        icon={item.icon}
                        tapProps={tapPropsOf(item.id)}
                        isLast={idx === disabledItems.length - 1}
                    />
                ))}
            </div>
        </div>
    );
};
