import React from 'react';
import { useLocale } from '@/os/locale';
import { useXStore, selectUser } from '../state';
import { useXGestures } from '../hooks/useXGestures';
import { IcChevronRight, IcDownload, IcHeartCrack, IcKey, IcUser } from '../res/icons';

export const SettingsAccountPage: React.FC = () => {
  const user = useXStore(selectUser);
  const { bindBack, go } = useXGestures();
  const isEnglish = useLocale() === 'en';

  const menuItems = [
    {
      icon: <IcUser size={24} />,
      title: isEnglish ? 'Account information' : '账号信息',
      description: isEnglish ? 'See your account information such as your phone number and email address.' : '查看你的账号信息，例如手机号和邮箱地址。',
      tapId: 'settings.account.info.open',
    },
    {
      icon: <IcKey size={24} />,
      title: isEnglish ? 'Change your password' : '更改你的密码',
      description: isEnglish ? 'Change your password at any time.' : '随时更改你的密码。',
      tapId: null,
    },
    {
      icon: <IcDownload size={24} />,
      title: isEnglish ? 'Download an archive of your data' : '下载你的数据存档',
      description: isEnglish ? 'Get deeper insight into the types of information stored for your account.' : '深入了解为你的账号存储的信息类型。',
      tapId: null,
    },
    {
      icon: <IcHeartCrack size={24} />,
      title: isEnglish ? 'Deactivate your account' : '停用你的账号',
      description: isEnglish ? 'Learn how to deactivate your account.' : '了解如何停用账号。',
      tapId: null,
    },
  ];

  return (
    <div className="flex min-h-full flex-col bg-app-bg pt-10 text-app-text">
      <div className="sticky top-0 z-10 relative flex items-center justify-center border-b border-gray-100 bg-app-bg px-4 py-3">
        <button className="absolute left-4 text-app-text" {...bindBack()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g></svg>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold leading-tight">{isEnglish ? 'Your account' : '你的账号'}</span>
          <span className="text-sm text-gray-500">{`@${user.id}`}</span>
        </div>
      </div>

      <div className="px-4 py-4 text-[15px] leading-snug text-gray-500">
        {isEnglish
          ? 'See your account information, download an archive of your data, or learn about your deactivation options.'
          : '查看你的账号信息、下载数据存档，或了解停用账号的相关选项。'}
      </div>

      <div className="flex-1">
        {menuItems.map((item, index) => (
          <div
            key={index}
            className="flex cursor-pointer items-start px-4 py-4 transition-colors active:bg-gray-50"
            onClick={() => {
              if (item.tapId) go(item.tapId as Parameters<typeof go>[0]);
            }}
          >
            <div className="mr-4 mt-0.5 shrink-0 text-gray-500">{item.icon}</div>
            <div className="mr-2 flex-1">
              <div className="mb-0.5 text-[15px] font-medium text-app-text">{item.title}</div>
              <div className="text-[13px] leading-tight text-gray-500">{item.description}</div>
            </div>
            <div className="self-center text-gray-400"><IcChevronRight size={18} /></div>
          </div>
        ))}
      </div>
    </div>
  );
};
