import React from 'react';
import { IcNavForward } from '../res/icons';
import { isToggle } from '../types';
import type { SettingsToggle, SettingsNavItem } from '../types';
import { useSmsGestures } from '../hooks/useSmsGestures';

interface SettingsItemProps {
    item: SettingsToggle | SettingsNavItem;
    value?: boolean;
    onValueChange?: (value: boolean) => void;
    showDivider?: boolean;
}

/** MIUI-style toggle switch */
const ToggleSwitch: React.FC<{
    enabled: boolean;
    onChange: (value: boolean) => void;
}> = ({ enabled, onChange }) => (
    <button
        className={`w-[52px] h-[32px] rounded-full p-1 transition-colors ${enabled ? 'bg-[#3482FF]' : 'bg-gray-300'
            }`}
        onClick={() => onChange(!enabled)}
    >
        <div
            className={`w-6 h-6 bg-app-surface rounded-full shadow-sm transform transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'
                }`}
        />
    </button>
);

export const SettingsItem: React.FC<SettingsItemProps> = ({
    item,
    value,
    onValueChange,
    showDivider = true,
}) => {
    const { go } = useSmsGestures();

    const handleClick = () => {
        if (!isToggle(item) && item.targetPage) {
            if (item.targetPage === '/settings/free-network-sms') {
                go('settings.free-network.open');
                return;
            }
            if (item.targetPage === '/settings/advanced') {
                go('settings.advanced.open');
                return;
            }
            if (item.targetPage === '/settings/5g-message') {
                go('settings.5g.open');
                return;
            }
            if (item.targetPage.startsWith('/settings/')) {
                go('settings.placeholder.open');
                return;
            }
        }
    };

    const isToggleItem = isToggle(item);
    const currentValue = value ?? false;

    return (
        <div>
            <div
                className={`flex items-center px-5 py-3.5 ${!isToggleItem ? 'active:bg-gray-50' : ''}`}
                onClick={!isToggleItem ? handleClick : undefined}
            >
                <div className="flex-1 min-w-0">
                    <div className="text-[16px] text-app-text">{item.title}</div>
                    {item.summary && (
                        <div className="text-[13px] text-gray-400 mt-0.5 leading-snug">
                            {item.summary}
                        </div>
                    )}
                </div>

                <div className="flex-shrink-0 ml-3">
                    {isToggleItem ? (
                        <ToggleSwitch
                            enabled={currentValue}
                            onChange={(val) => onValueChange?.(val)}
                        />
                    ) : (
                        <IcNavForward size={18} className="text-gray-300" />
                    )}
                </div>
            </div>
            {showDivider && <div className="h-px bg-gray-100 ml-5" />}
        </div>
    );
};

interface SettingsCategoryProps {
    title?: string;
    children: React.ReactNode;
}

export const SettingsCategory: React.FC<SettingsCategoryProps> = ({
    title,
    children,
}) => (
    <div className="mb-4">
        {title && (
            <div className="px-6 py-2 text-[14px] text-blue-500 font-medium">
                {title}
            </div>
        )}
        <div className="bg-app-surface rounded-2xl mx-4 overflow-hidden">
            {children}
        </div>
    </div>
);
