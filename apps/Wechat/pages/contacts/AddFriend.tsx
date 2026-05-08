
import React, { useState, useEffect } from 'react';
import { dimens } from '../../res/dimens';
import { useWechatStrings } from '../../hooks/useWechatStrings';
import { IcSearch, IcScan, IcSmartphone, IcContacts, IcNavForward, IcFile, IcShoppingBag, IcRadio, IcMessageSquare } from '../../res/icons';
import { useWechatStore } from '../../state';
import QRCode from 'qrcode';
import { useWechatGestures } from '../../hooks/useWechatGestures';
import { useLocale } from '../../../../os/locale';
export const AddFriendPage: React.FC = () => {
  const t = useWechatStrings();
  const locale = useLocale();
  const user = useWechatStore(s => s.user);
  const { bindTap } = useWechatGestures();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    // 本地即时生成二维码
    QRCode.toDataURL(user.wxid, { 
        margin: 1, 
        width: 350, 
        color: {
            dark: '#000000',
            light: '#ffffff'
        }
    }, (err, url) => {
        if (!err) setQrDataUrl(url);
    });
  }, [user.wxid]);

  const ListItem = ({ icon, title, subTitle, isLast = false, tapProps }: any) => (
    <div 
      {...tapProps}
      className={`flex items-center bg-app-surface active:bg-(--app-c-tw-bg-gray-50) pl-4 h-(--app-item-height-72) ${tapProps ? 'cursor-pointer' : ''}`}
    >
      <div className="mr-4 w-6 flex justify-center items-center">
        {icon}
      </div>
      <div className={`flex-1 h-full flex justify-between items-center pr-4 ${!isLast ? 'border-b border-(--app-c-tw-border-gray-100)' : ''}`}>
          <div className="flex flex-col justify-center">
            <div className="text-(--app-settings-item-text-size) text-app-text font-normal leading-tight">{title}</div>
            {subTitle && <div className="text-(--app-chat-system-msg-text-size) text-(--app-c-tw-text-gray-400) mt-1 leading-tight">{subTitle}</div>}
          </div>
          <IcNavForward size={dimens.icSizeChevronSm} className="text-(--app-c-tw-text-gray-300) ml-2" />
      </div>
    </div>
  );

  return (
    <div className="bg-app-surface min-h-full flex flex-col">
      {/* 搜索栏 */}
      <div className="px-3 py-2 bg-app-surface pb-0 mb-2">
        <div className="bg-(--app-c-search-result-divider) rounded-[6px] py-2 flex items-center justify-center text-(--app-c-settings-item-chevron) text-(--app-search-filter-text-size)">
          <IcSearch size={dimens.icSizeChevronSm} className="mr-1.5 opacity-80" />
          <span>{locale === 'en' ? 'Search ID / phone number' : '搜索 账号/手机号'}</span>
        </div>
      </div>

      {/* 功能列表 */}
      <div className="flex-1 flex flex-col">
        <ListItem 
            icon={<IcScan className="text-(--app-c-me-icon-settings)" size={dimens.icSizeListIcon} />} 
            title={t.discover_scan} 
            subTitle={locale === 'en' ? 'Scan a QR code card' : '扫描二维码名片'}
        />
        <ListItem 
            icon={<IcSmartphone className="text-app-primary" size={dimens.icSizeListIcon} />} 
            title={locale === 'en' ? 'Phone contacts' : '手机联系人'} 
            subTitle={locale === 'en' ? 'Add friends from your contacts' : '添加通讯录中的朋友'}
        />
        <ListItem 
            icon={<IcRadio className="text-(--app-c-me-icon-settings)" size={dimens.icSizeListIcon} />} 
            title={locale === 'en' ? 'Radar' : '雷达'} 
            subTitle={locale === 'en' ? 'Add nearby friends' : '添加身边的朋友'}
            tapProps={bindTap<HTMLDivElement>('addFriend.radar.open')}
        />
        <ListItem 
            icon={<IcMessageSquare className="text-(--app-c-me-icon-settings)" size={dimens.icSizeTab} />} 
            title={locale === 'en' ? 'WeCom contacts' : '企业微信联系人'} 
            subTitle={locale === 'en' ? 'Find WeCom users by phone number' : '通过手机号搜索企业微信用户'}
        />
        <ListItem 
            icon={<IcContacts className="text-app-primary" size={dimens.icSizeListIcon} />} 
            title={locale === 'en' ? 'Face-to-face group' : '面对面建群'} 
            subTitle={locale === 'en' ? 'Join the same group chat with nearby friends' : '与身边的朋友进入同一个群聊'}
            tapProps={bindTap<HTMLDivElement>('addFriend.faceToFace.open')}
        />
         <ListItem 
            icon={<IcFile className="text-(--app-c-me-icon-settings)" size={dimens.icSizeListIcon} />} 
            title={locale === 'en' ? 'Official Accounts' : '公众号'} 
            subTitle={locale === 'en' ? 'Get more news and updates' : '获取更多资讯'}
        />
        <ListItem 
            icon={<IcShoppingBag className="text-(--app-c-me-icon-collection)" size={dimens.icSizeListIcon} />} 
            title={locale === 'en' ? 'Service Accounts' : '服务号'} 
            subTitle={locale === 'en' ? 'Get shopping info and services' : '获取更多购物信息和服务'}
            isLast={true}
        />
      </div>
      
      {/* 底部二维码展示 */}
      <div className="flex flex-col items-center mt-8 mb-16">
          <div 
            className="mb-8 cursor-pointer active:opacity-60" 
            {...bindTap<HTMLDivElement>('me.qrcode.open', { stopPropagation: true })}
          >
             {qrDataUrl ? (
                <img src={qrDataUrl} alt="Large QR" className="w-(--app-contacts-add-friend-width-175) h-(--app-contacts-add-friend-height-175)" />
             ) : (
                <div className="w-(--app-contacts-add-friend-width-175) h-(--app-contacts-add-friend-height-175) bg-(--app-c-tw-bg-gray-50) animate-pulse"></div>
             )}
          </div>
          <div className="text-(--app-settings-group-title-size) text-(--app-c-tw-text-gray-500) font-normal tracking-wide">
             {locale === 'en' ? 'My WeChat ID:' : '我的微信号：'} {user.wxid}
          </div>
      </div>
    </div>
  );
};
