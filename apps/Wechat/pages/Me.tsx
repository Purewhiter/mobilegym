
import React from 'react';
import { useWechatStrings } from '../hooks/useWechatStrings';
import { IcNavForward, IcQrCode, IcAdd, IcRotateCw, IcMessageCode, IcBox, IcImage, IcSmile, IcSettings } from '../res/icons';
import { useWechatStore } from '../state';
import { useWechatGestures } from '../hooks/useWechatGestures';
import { dimens } from '../res/dimens';

const Me: React.FC = () => {
  const t = useWechatStrings();
  const { bindTap } = useWechatGestures();
  const user = useWechatStore(s => s.user);

  const MenuItem: React.FC<{ 
    icon: React.ReactNode; 
    label: string; 
    isLast?: boolean; 
    tapProps?: React.HTMLAttributes<HTMLDivElement>;
  }> = ({ icon, label, isLast = false, tapProps }) => (
    <div
      {...tapProps}
      className={`flex items-center bg-app-surface active:bg-(--app-c-tw-bg-gray-100) pl-4 h-(--app-settings-item-height) ${tapProps ? 'cursor-pointer' : ''}`}
    >
      <div className="mr-4 w-6 flex justify-center">
        {icon}
      </div>
      <div className={`flex-1 h-full flex justify-between items-center pr-4 ${!isLast ? 'border-b border-gray-100/60' : ''}`}>
        <span className="text-(--app-settings-item-text-size) font-normal" style={{ color: 'var(--app-c-settings-item-text)' }}>{label}</span>
        <IcNavForward size={dimens.icSizeChevron} style={{ color: 'var(--app-c-me-chevron-color)' }} strokeWidth={dimens.icStrokeWidth} />
      </div>
    </div>
  );

  return (
    <div className="bg-app-bg min-h-full pb-16">
      {/* Header Profile Card - Pure White */}
      <div 
        {...bindTap<HTMLDivElement>('profile.detail.open')}
        className="bg-app-surface px-6 pt-20 pb-8 flex relative active:bg-(--app-c-tw-bg-gray-50) cursor-pointer" 
      >
        {/* Actual User Avatar */}
        <div className="w-(--app-item-width-56) h-(--app-settings-item-height) rounded-[8px] flex-shrink-0 overflow-hidden" style={{ backgroundColor: 'var(--app-c-me-avatar-bg)' }}>
             <img src={user.avatar} className="w-full h-full object-cover" alt="avatar" />
        </div>
        
        {/* User Info Content */}
        <div className="flex-1 ml-5 flex flex-col justify-start">
            <h2 className="text-(--app-me-username-size) font-semibold text-app-text leading-tight mb-1">{user.name}</h2>
            
            {/* WxID and Chevron Alignment Row - Chevron is aligned with WxID text */}
            <div className="flex items-center justify-between w-full mb-6">
                <div className="text-(--app-settings-group-title-size) font-normal" style={{ color: 'var(--app-c-me-wxid-text)' }}>{t.me_wxid_label}{user.wxid}</div>
                <IcNavForward size={dimens.icSizeChevronLg} className="mr-[-6px]" style={{ color: 'var(--app-c-me-chevron-color)' }} strokeWidth={dimens.icStrokeWidth} />
            </div>
            
            {/* Buttons Row - Status and Refresh */}
            <div className="flex items-center gap-2">
                 {/* Status Pill */}
                 <div className="inline-flex items-center border border-(--app-c-tw-border-gray-100) rounded-full px-2.5 py-(--app-item-padding-y-3) bg-app-surface">
                    <IcAdd size={dimens.icSizeWxidAdd} className="mr-1" style={{ color: 'var(--app-c-me-wxid-text)' }} strokeWidth={2.5} />
                    <span className="text-(--app-chat-time-label-text-size) font-normal" style={{ color: 'var(--app-c-settings-item-text)' }}>{t.me_status}</span>
                 </div>

                 {/* Refresh Circle */}
                 <div className="w-(--app-item-width-24) h-(--app-item-height-24) rounded-full border border-(--app-c-tw-border-gray-100) flex items-center justify-center bg-app-surface">
                     <IcRotateCw size={dimens.icSizeTiny} style={{ color: 'var(--app-c-me-wxid-text)' }} strokeWidth={2.5} />
                 </div>
            </div>
        </div>

        {/* QR Code icon - Top Right corner, clickable */}
        <div 
            className="absolute right-6 top-[72px] p-2 -mr-2 -mt-2 active:opacity-60 z-10"
            {...bindTap<HTMLDivElement>('me.qrcode.open', { stopPropagation: true })}
        >
            <IcQrCode size={dimens.icSizeAction} className="opacity-30" style={{ color: 'var(--app-c-settings-item-text)' }} />
        </div>
      </div>

      {/* Spacer */}
      <div className="h-2 bg-app-bg"></div>

      {/* Group 1: Services */}
      <div className="bg-app-surface">
        <MenuItem 
          icon={<div className="text-app-primary"><IcMessageCode size={dimens.me_menu_icon_size} strokeWidth={1.5} /></div>}
          label={t.me_services} 
          isLast={true}
          tapProps={bindTap<HTMLDivElement>('me.services.open')}
        />
      </div>

      <div className="h-2 bg-app-bg"></div>

      {/* Group 2: Collection, Moments, Stickers */}
      <div className="bg-app-surface">
        <MenuItem 
            icon={<IcBox size={dimens.me_menu_icon_size} style={{ color: 'var(--app-c-me-icon-collection)' }} strokeWidth={1.5} />}
            label={t.me_favorites} 
        />
        <MenuItem 
            icon={<IcImage size={dimens.me_menu_icon_size} style={{ color: 'var(--app-c-me-icon-moments)' }} strokeWidth={1.5} />}
            label={t.discover_moments}
            tapProps={bindTap<HTMLDivElement>('me.moments.open')}
        />
        <MenuItem 
            icon={<IcSmile size={dimens.me_menu_icon_size} style={{ color: 'var(--app-c-me-icon-stickers)' }} strokeWidth={1.5} />}
            label={t.me_stickers} 
            isLast={true} 
        />
      </div>

      <div className="h-2 bg-app-bg"></div>

      {/* Group 3: Settings */}
      <div className="bg-app-surface">
        <MenuItem 
          icon={<IcSettings size={dimens.me_menu_icon_size} style={{ color: 'var(--app-c-me-icon-settings)' }} strokeWidth={1.5} />} 
          label={t.settings_title} 
          isLast={true}
          tapProps={bindTap<HTMLDivElement>('me.settings.open')}
        />
      </div>
    </div>
  );
};

export default Me;
