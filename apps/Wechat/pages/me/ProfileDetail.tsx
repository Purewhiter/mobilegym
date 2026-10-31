
import React from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { IcNavForward, IcQrCode } from '../../res/icons';
import { useWechatStore } from '../../state';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { routes } from '../../routes';

export const ProfileDetail: React.FC = () => {
  const t = useWechatStrings();
    const { bindNav } = useWechatGestures();
    const user = useWechatStore(s => s.user);

    const Item = ({ 
        label, 
        value, 
        isAvatar = false, 
        isQr = false, 
        isLast = false, 
        tapProps,
    }: { 
        label: string, 
        value?: string, 
        isAvatar?: boolean, 
        isQr?: boolean, 
        isLast?: boolean, 
        tapProps?: React.HTMLAttributes<HTMLDivElement>,
    }) => (
        <div 
          {...(tapProps ?? {})}
          className={`flex items-center px-5 bg-app-surface active:bg-(--app-c-tw-bg-gray-50) cursor-pointer
             ${isAvatar ? 'h-(--app-item-height-72)' : 'h-(--app-settings-item-height)'}
          `}
          style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard), border-color var(--app-duration-short) var(--app-easing-standard)' }}
        >
            <div className={`flex-1 flex justify-between items-center h-full ${!isLast ? 'border-b border-gray-100/70' : ''}`}>
                <span className="text-(--app-settings-item-text-size) text-(--app-c-settings-item-text) font-normal">{label}</span>
                <div className="flex items-center">
                    {isAvatar && (
                        <div className="w-(--app-avatar-width-44) h-(--app-avatar-height-44) rounded-[6px] bg-(--app-c-me-avatar-bg) flex items-center justify-center mr-0.5 overflow-hidden">
                             <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" />
                        </div>
                    )}
                    
                    {isQr && (
                        <IcQrCode size={dimens.icSizeAction} className="text-(--app-c-settings-item-text) opacity-30 mr-0.5" />
                    )}

                    {!isAvatar && !isQr && value !== undefined && (
                        <span className="text-(--app-settings-item-text-size) text-(--app-c-settings-item-extra-text) mr-0.5 max-w-(--app-item-width-220) truncate text-right">
                            {value}
                        </span>
                    )}
                    
                    <IcNavForward size={dimens.icSizeChevron} className="text-(--app-c-settings-item-chevron) ml-1.5" strokeWidth={dimens.icStrokeWidth} />
                </div>
            </div>
        </div>
    );

    const Spacer = () => <div className="h-2 bg-app-bg"></div>;

    return (
        <div className="bg-app-bg min-h-full pb-10 w-full overflow-y-auto no-scrollbar">
            {/* Main Information Block: Grouped together without gaps as per screenshot */}
            <div className="bg-app-surface">
                <Item label={t.profile_avatar} isAvatar={true} />
                <Item label={t.profile_name} value={user.name} tapProps={bindNav(routes.meName)} />
                <Item label={t.profile_gender} value={user.gender || ''} tapProps={bindNav(routes.meGender)} />
                <Item label={t.profile_region} value={user.region} tapProps={bindNav(routes.meRegion)} />
                <Item label={t.contacts_phone} value={user.phone} tapProps={bindNav(routes.mePhone)} />
                <Item label={t.profile_wxid} value={user.wxid} tapProps={bindNav(routes.meWxid)} />
                <Item label={t.profile_qrcode} isQr={true} tapProps={bindNav(routes.meQrcode)} />
                <Item label={t.profile_pat} value={user.pat} tapProps={bindNav(routes.mePat)} />
                <Item label={t.profile_signature} value={user.signature || t.profile_not_set} isLast={true} tapProps={bindNav(routes.meSignature)} />
            </div>

            <Spacer />

            {/* Block 2: Ringtone */}
            <div className="bg-app-surface">
                <Item label={t.profile_ringtone} isLast={true} />
            </div>

            <Spacer />

            {/* Block 3: Address and Invoice */}
            <div className="bg-app-surface">
                <Item label={t.profile_address} tapProps={bindNav(routes.meAddress)} />
                <Item label={t.profile_invoice} isLast={true} tapProps={bindNav(routes.meInvoice)} />
            </div>

            <Spacer />

            {/* Block 4: Beans */}
            <div className="bg-app-surface">
                <Item label={t.settings_wechat_beans} isLast={true} tapProps={bindNav(routes.meBeans)} />
            </div>
        </div>
    );
};
