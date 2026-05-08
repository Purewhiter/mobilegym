import React from 'react';
import { dimens } from '../../res/dimens';
import { IcNavForward, IcSearch } from '../../res/icons';
import { useLocale } from '../../../../os/locale';
const asset = (r: unknown) => { const s = String(r ?? '').trim(); return (!s || s.startsWith('http')) ? s : `/@app-assets/Wechat/${s}`; };

export const NewFriends: React.FC = () => {
  const locale = useLocale();
  return (
  <div className="bg-app-bg min-h-screen">
     <div className="bg-app-bg px-2 py-2">
        <div className="bg-app-surface rounded text-center py-1.5 flex items-center justify-center text-(--app-c-tw-text-gray-400) text-sm">
          <IcSearch size={dimens.icSizeChevronSm} className="mr-1" /> {locale === 'en' ? 'Search ID / phone number' : '搜索 账号/手机号'}
        </div>
    </div>
    <div className="mt-2 bg-app-surface flex items-center px-4 py-3 active:bg-(--app-c-tw-bg-gray-100)">
      <div className="bg-green-500 p-1.5 rounded mr-3">
         <IcSearch className="text-white" size={dimens.icSizeCheck} />
      </div>
      <span className="text-(--app-chat-bubble-text-size)">{locale === 'en' ? 'Add phone contacts' : '添加手机联系人'}</span>
      <IcNavForward className="ml-auto text-(--app-c-tw-text-gray-400)" size={dimens.icSizeChevronSm} />
    </div>

    <div className="mt-4 px-4 text-xs text-(--app-c-tw-text-gray-500) mb-1">{locale === 'en' ? 'Last 3 days' : '近三天'}</div>
    <div className="bg-app-surface px-4 py-3 flex items-center border-b border-(--app-c-tw-border-gray-100)">
        <img src={asset('avatars/avatar_65.jpg')} className="w-10 h-10 rounded mr-3" alt="" />
        <div className="flex-1">
            <div className="text-(--app-chat-bubble-text-size) font-medium">blank.</div>
            <div className="text-xs text-(--app-c-tw-text-gray-400)">我是blank.</div>
        </div>
        <div className="text-xs text-(--app-c-tw-text-gray-400)">{locale === 'en' ? 'Added' : '已添加'}</div>
    </div>
  </div>
  );
};
