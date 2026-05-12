import React from 'react';
import { useLocale } from '@/os/locale';
import { useXStore, selectUser } from '../state';
import { useXGestures } from '../hooks/useXGestures';
import {
  IcUser,
  IcLock,
  IcShieldCheck,
  IcTabNotifications,
  IcEye,
  IcMore,
  IcChevronRight,
  IcTabSearch,
  IcLayoutList,
  XLogoIcon,
} from '../res/icons';

export const SettingsPage: React.FC = () => {
  const user = useXStore(selectUser);
  const { bindBack, go } = useXGestures();
  const locale = useLocale();
  const isEnglish = locale === 'en';

  const settingsItems = [
    {
      icon: <IcUser size={24} />,
      title: isEnglish ? 'Your account' : '你的账号',
      description: isEnglish
        ? 'See your account information, download an archive of your data, or learn about your deactivation options.'
        : '查看你的账号信息、下载数据存档，或了解停用账号的相关选项。',
      tapId: 'settings.account.open',
    },
    {
      icon: <IcLock size={24} />,
      title: isEnglish ? 'Security and account access' : '安全性和账号访问权限',
      description: isEnglish
        ? 'Manage your account security and track account usage, including apps connected to your account.'
        : '管理你的账号安全并追踪账号使用情况，包括与你的账号关联的应用。',
      tapId: null,
    },
    {
      icon: <div className="flex h-6 w-6 items-center justify-center"><XLogoIcon size={20} /></div>,
      title: 'Premium',
      description: isEnglish
        ? 'Manage your subscription features, including settings such as post undo time.'
        : '管理你的订阅功能，包括撤销帖子时间等设置。',
      tapId: null,
    },
    {
      icon: <IcLayoutList size={24} />,
      title: isEnglish ? 'Timeline' : '时间线',
      description: isEnglish ? 'Customize the look and interactions of your timeline.' : '配置你的时间线外观和互动方式。',
      tapId: 'settings.timeline.open',
    },
    {
      icon: <IcShieldCheck size={24} />,
      title: isEnglish ? 'Privacy and safety' : '隐私和安全',
      description: isEnglish ? 'Manage what you see and share on X.' : '管理你在 X 上看到和分享的信息。',
      tapId: 'settings.privacy.open',
    },
    {
      icon: <IcTabNotifications size={24} />,
      title: isEnglish ? 'Notifications' : '通知',
      description: isEnglish
        ? 'Select the types of notifications you receive about activity, interests, and recommendations.'
        : '选择你接收的关于动态、兴趣和推荐的通知类型。',
      tapId: 'settings.notifications.open',
    },
    {
      icon: <IcEye size={24} />,
      title: isEnglish ? 'Accessibility, display, and languages' : '辅助功能、显示和语言',
      description: isEnglish ? 'Manage how X appears to you.' : '管理 X 向你显示内容的方式。',
      tapId: null,
    },
    {
      icon: <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-current"><IcMore size={14} /></div>,
      title: isEnglish ? 'Additional resources' : '更多资源',
      description: isEnglish
        ? 'Explore useful information and learn more about X products and services.'
        : '查看更多有用信息，了解有关 X 产品和服务的内容。',
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
          <span className="text-lg font-bold leading-tight">{isEnglish ? 'Settings' : '设置'}</span>
          <span className="text-sm text-gray-500">{`@${user.id}`}</span>
        </div>
      </div>

      <div className="px-4 py-2">
        <div className="flex items-center rounded-full bg-gray-100 px-4 py-2.5 text-gray-500">
          <IcTabSearch size={18} className="mr-3" />
          <span className="text-base">{isEnglish ? 'Search settings' : '搜索设置'}</span>
        </div>
      </div>

      <div className="flex-1">
        {settingsItems.map((item, index) => (
          <div
            key={index}
            className={`flex items-start px-4 py-4 transition-colors ${item.tapId ? 'cursor-pointer active:bg-gray-50' : 'cursor-default'}`}
            onClick={() => {
              if (item.tapId) go(item.tapId as Parameters<typeof go>[0]);
            }}
          >
            <div className="mr-4 mt-0.5 shrink-0 text-gray-500">{item.icon}</div>
            <div className="mr-2 flex-1">
              <div className="mb-0.5 text-[15px] font-medium text-app-text">{item.title}</div>
              <div className="text-[13px] leading-tight text-gray-500">{item.description}</div>
            </div>
            {item.tapId && <div className="self-center text-gray-400"><IcChevronRight size={18} /></div>}
          </div>
        ))}
      </div>
    </div>
  );
};
