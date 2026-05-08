
import React from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { IcNavForward } from '../../res/icons';
import { useParams } from 'react-router-dom';
import { useWechatStore } from '../../state';
import { useWechatGestures } from '../../hooks/useWechatGestures';

export const FriendInfoPage: React.FC = () => {
  const t = useWechatStrings();
    const { id } = useParams<{ id: string }>();
    const { bindTap } = useWechatGestures();
    const contacts = useWechatStore(s => s.contacts);

    const contact = contacts.find(c => c.wxid === id);

    if (!contact) return <div className="p-10 text-center text-(--app-c-tw-text-gray-400)">{t.friend_not_found}</div>;

    const InfoItem = ({
        label,
        value,
        isLast = false,
        tapProps,
    }: {
        label: string;
        value?: string;
        isLast?: boolean;
        tapProps?: React.HTMLAttributes<HTMLDivElement>;
    }) => (
        <div 
            {...tapProps}
            className={`flex items-center px-4 bg-app-surface active:bg-(--app-c-tw-bg-gray-50) h-(--app-settings-item-height)${tapProps ? ' cursor-pointer' : ''}`} style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
        >
            <div className={`flex-1 h-full flex justify-between items-center pr-4 ${!isLast ? 'border-b border-(--app-c-tw-border-gray-100)' : ''}`}>
                <span className="text-(--app-settings-item-text-size) text-app-text w-32 flex-shrink-0 whitespace-nowrap">{label}</span>
                <div className="flex items-center flex-1 min-w-0 justify-end text-right" style={{ color: 'var(--app-c-settings-item-extra-text)' }}>
                    {value && <span className="text-(--app-settings-item-text-size) truncate">{value}</span>}
                    <IcNavForward size={dimens.icSizeChevron} className="ml-2 flex-shrink-0" style={{ color: 'var(--app-c-me-chevron-color)' }} strokeWidth={dimens.icStrokeWidth} />
                </div>
            </div>
        </div>
    );

    const SectionHeader = ({ title }: { title: string }) => (
        <div className="px-4 py-2 text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-500) bg-app-bg font-normal">{title}</div>
    );

    const permissionText = contact.permissionMode === 'chatOnly' 
        ? t.chat_only 
        : t.friend_permission_chat_all;

    return (
        <div className="bg-app-bg min-h-full pb-10">
            <SectionHeader title={t.friend_remark} />
            <div className="bg-app-surface">
                <div className="flex items-center px-4 bg-app-surface active:bg-(--app-c-tw-bg-gray-50) h-(--app-settings-item-height) cursor-pointer" style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}>
                    <div className="flex-1 h-full flex justify-between items-center pr-4 border-b border-(--app-c-tw-border-gray-100)">
                        <span className="text-(--app-settings-item-text-size) text-app-text w-24 flex-shrink-0">{t.friend_remark_name}</span>
                        <div className="flex items-center flex-1 min-w-0 justify-end text-right" style={{ color: 'var(--app-c-settings-item-extra-text)' }}>
                            <span className="text-(--app-settings-item-text-size) truncate text-(--app-c-tw-text-gray-300)">{contact.alias || contact.name}</span>
                            <IcNavForward size={dimens.icSizeChevron} className="ml-2 flex-shrink-0" style={{ color: 'var(--app-c-me-chevron-color)' }} strokeWidth={dimens.icStrokeWidth} />
                        </div>
                    </div>
                </div>
                <InfoItem label={t.friend_phone} />
                <InfoItem label={t.contacts_tags} />
                <InfoItem label={t.friend_memo} />
                <InfoItem label={t.friend_photos} isLast />
            </div>

            <SectionHeader title={t.discover_friend_permission} />
            <div className="bg-app-surface">
                <InfoItem 
                    label={t.friend_permission}
                    value={permissionText} 
                    isLast 
                    tapProps={bindTap<HTMLDivElement>('friendPermissionsDetail.open', { params: { id: contact.wxid } })}
                />
            </div>

            <SectionHeader title={t.friend_more_info} />
            <div className="bg-app-surface">
                <InfoItem label={t.friend_common_groups} value={`${contact.commonGroups || 0}${t.friend_groups_count}`} />
                <InfoItem label={t.friend_signature} value={contact.signature || t.friend_default_signature} />
                <InfoItem label={t.friend_source} value={contact.source || t.friend_default_source} />
                <InfoItem label={t.friend_added_time} value={contact.addedTime || '2025-12'} isLast />
            </div>
        </div>
    );
};
