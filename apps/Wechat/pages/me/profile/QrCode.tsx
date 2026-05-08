
import React, { useState, useEffect } from 'react';
import { useWechatStrings } from '../../../hooks/useWechatStrings';
import { useWechatStore } from '../../../state';
import QRCode from 'qrcode';

export const MyQrCodePage = () => {
    const t = useWechatStrings();
    const user = useWechatStore(s => s.user);
    const [qrDataUrl, setQrDataUrl] = useState<string>('');

    // 二维码显示尺寸
    const qrSize = 200;

    useEffect(() => {
        // 本地生成二维码，消除网络延迟
        QRCode.toDataURL(user.wxid, { 
            margin: 0, 
            width: qrSize * 2, // 生成两倍大小以确保清晰度
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        }, (err, url) => {
            if (!err) setQrDataUrl(url);
        });
    }, [user.wxid]);

    return (
        <div className="min-h-full bg-app-surface flex flex-col items-center">
            {/* 主内容区域 */}
            <div className="flex flex-col items-start pt-16">
                
                {/* 用户信息头部 */}
                <div className="flex items-center mb-6" style={{ width: `${qrSize}px` }}>
                    <img 
                        src={user.avatar} 
                        className="w-(--app-chat-list-item-avatar-size) h-(--app-chat-list-item-avatar-size) rounded-[6px] mr-3 bg-(--app-c-me-avatar-bg) object-cover flex-shrink-0" 
                        alt="avatar" 
                    />
                    <div className="flex min-w-0 flex-col justify-center overflow-hidden">
                        <div className="min-w-0 text-(--app-title-text-size-18) font-bold text-(--app-c-common-text-primary) leading-none mb-1 truncate">
                            {user.name}
                        </div>
                        <div className="min-w-0 text-(--app-chat-time-label-text-size) text-(--app-c-settings-item-chevron) font-normal leading-none truncate">
                            {user.region}
                        </div>
                    </div>
                </div>

                {/* 二维码图片区域 */}
                <div className="relative mb-8" style={{ width: `${qrSize}px`, height: `${qrSize}px` }}>
                    {qrDataUrl ? (
                        <img 
                            src={qrDataUrl} 
                            alt="QR Code" 
                            className="w-full h-full" 
                        />
                    ) : (
                        <div className="w-full h-full bg-(--app-c-tw-bg-gray-50) animate-pulse"></div>
                    )}
                    
                    {/* 中间的微信 Logo */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black rounded-[5px] w-(--app-item-width-34) h-(--app-item-height-34) flex items-center justify-center border-[2px] border-white">
                         <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                            <path d="M8.5 13.5c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5zm7 0c-.828 0-1.5-.672-1.5-1.5s.672-1.5 1.5-1.5 1.5.672 1.5 1.5-.672 1.5-1.5 1.5zM12 2C6.477 2 2 5.582 2 10c0 1.954.858 3.733 2.305 5.09L3 19l4.5-1.424A9.873 9.873 0 0 0 12 18c5.523 0 10-3.582 10-8s-4.477-8-10-8zm-5 13a4.992 4.992 0 0 1-2.903-1.026C2.863 12.98 2 11.572 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7c-.524 0-1.034-.042-1.53-.122L5 18l1-3h1z" />
                         </svg>
                    </div>
                </div>

                {/* 底部引导文字 */}
                <div className="text-(--app-hint-text-size-10) text-(--app-c-settings-item-chevron) font-normal text-center mb-10 w-full px-6 leading-relaxed break-words [overflow-wrap:anywhere]">
                    {t.profile_qrcode_instruction}
                </div>
            </div>

            {/* 底部操作菜单 */}
            <div className="mt-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-(--app-c-address-link-text) text-(--app-chat-time-label-text-size) mb-12 px-6">
                <span className="active:opacity-60 cursor-pointer">{t.discover_scan}</span>
                <span className="text-(--app-c-tw-text-gray-200) font-light mx-[-2px]">|</span>
                <span className="active:opacity-60 cursor-pointer">{t.profile_qrcode_change_style}</span>
                <span className="text-(--app-c-tw-text-gray-200) font-light mx-[-2px]">|</span>
                <span className="active:opacity-60 cursor-pointer">{t.profile_qrcode_save_image}</span>
            </div>
        </div>
    );
};
