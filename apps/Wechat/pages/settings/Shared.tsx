
import React from 'react';
import { dimens } from '../../res/dimens';
import { IcNavForward } from '../../res/icons';

interface SettingsItemProps {
    label: string;
    onClick?: () => void;
    tapProps?: React.HTMLAttributes<HTMLDivElement>;
    icon?: React.ReactNode; // 新增：左侧图标
    rightContent?: React.ReactNode;
    isLast?: boolean;
    subLabel?: string;
}

export const SettingsItem: React.FC<SettingsItemProps> = ({
    label,
    onClick,
    tapProps,
    icon,
    rightContent,
    isLast = false,
    subLabel,
}) => (
    <div 
        {...(tapProps ?? (onClick ? { onClick } : {}))}
        className={`flex items-center px-5 bg-app-surface active:bg-(--app-c-tw-bg-gray-50) ${!isLast ? 'border-b border-(--app-c-tw-border-gray-100)' : ''} ${subLabel ? 'h-(--app-item-height-72)' : 'h-(--app-settings-item-height)'} ${(tapProps || onClick) ? 'cursor-pointer' : ''}`}
    >
        {icon && <div className="mr-4 flex-shrink-0 flex items-center justify-center w-6">{icon}</div>}
        <div className="flex-1 flex flex-col justify-center">
            <div className="text-(--app-settings-item-text-size) font-normal leading-tight" style={{ color: 'var(--app-c-settings-item-text)' }}>{label}</div>
            {subLabel && <div className="text-(--app-settings-group-title-size) mt-1.5 leading-tight" style={{ color: 'var(--app-c-settings-item-extra-text)' }}>{subLabel}</div>}
        </div>
        <div className="flex items-center">
            {rightContent}
            <IcNavForward size={dimens.icSizeChevron} className="ml-2" style={{ color: 'var(--app-c-settings-item-chevron)' }} strokeWidth={dimens.icStrokeWidth} />
        </div>
    </div>
);

interface SettingsToggleProps {
    label: string;
    isOn: boolean;
    onToggle: () => void;
    actionProps?: React.HTMLAttributes<HTMLDivElement>;
    isLast?: boolean;
    subLabel?: string;
}

export const SettingsToggle: React.FC<SettingsToggleProps> = ({
    label,
    isOn,
    onToggle,
    actionProps,
    isLast,
    subLabel,
}) => {
    const clickableProps = actionProps ?? { onClick: onToggle };
    // 避免外部传入 className 覆盖内部样式（只取 data-*/onClick 等）
    const { className: _ignoredClassName, ...restClickableProps } = clickableProps;

    return (
    <div className={`flex justify-between items-center px-5 bg-app-surface ${!isLast ? 'border-b border-(--app-c-tw-border-gray-100)' : ''} ${subLabel ? 'h-(--app-item-height-72)' : 'h-(--app-settings-item-height)'}`}>
        <div className="flex flex-col justify-center">
            <div className="text-(--app-settings-item-text-size) font-normal leading-tight" style={{ color: 'var(--app-c-settings-item-text)' }}>{label}</div>
            {subLabel && <div className="text-(--app-settings-group-title-size) mt-1.5 leading-tight" style={{ color: 'var(--app-c-settings-item-extra-text)' }}>{subLabel}</div>}
        </div>
        <div
            {...restClickableProps}
            className={`w-(--app-chat-list-item-avatar-size) h-(--app-item-height-28) rounded-full relative cursor-pointer ${isOn ? 'bg-app-primary' : 'bg-(--app-c-tw-bg-gray-200)'}`}
            style={{ transition: 'background-color var(--app-duration-short) var(--app-easing-standard)' }}
        >
            <div className={`absolute top-[2px] w-6 h-6 bg-app-surface rounded-full shadow-md ${isOn ? 'left-[22px]' : 'left-[2px]'}`} style={{ transition: 'left var(--app-duration-short) var(--app-easing-standard)' }}></div>
        </div>
    </div>
    );
};
