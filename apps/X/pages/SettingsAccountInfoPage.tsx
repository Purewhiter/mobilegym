import React from 'react';
import { useLocale } from '@/os/locale';
import { useXStore, selectUser } from '../state';
import { useXGestures } from '../hooks/useXGestures';
import { IcChevronRight } from '../res/icons';

export const SettingsAccountInfoPage: React.FC = () => {
  const user = useXStore(selectUser);
  const { bindBack } = useXGestures();
  const isEnglish = useLocale() === 'en';

  const infoItems = [
    { label: isEnglish ? 'Username' : '用户名', value: `@${user.id}` },
    { label: isEnglish ? 'Phone' : '手机', value: isEnglish ? 'Add' : '添加', valueColor: 'text-gray-500' },
    { label: isEnglish ? 'Email' : '邮箱地址', value: 'example@gmail.com' },
    { label: isEnglish ? 'Country / Region' : '国家 / 地区', value: isEnglish ? 'Hong Kong, China' : '香港（中国）', valueColor: 'text-gray-500' },
  ];

  const automationItems = [
    { label: isEnglish ? 'Automation' : '自动化', description: isEnglish ? 'Manage your automated account.' : '管理你的自动化账号。' },
    { label: isEnglish ? 'Parody, commentary, and fan accounts' : '戏仿、评论和粉丝账号', description: isEnglish ? 'Manage your parody, commentary, and fan account labels.' : '管理你的戏仿、评论和粉丝账号标签。' },
  ];

  return (
    <div className="flex min-h-full flex-col bg-app-bg pt-10 text-app-text">
      <div className="sticky top-0 z-10 relative flex items-center justify-center border-b border-gray-100 bg-app-bg px-4 py-3">
        <button className="absolute left-4 text-app-text" {...bindBack()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g></svg>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold leading-tight">{isEnglish ? 'Account information' : '账号信息'}</span>
          <span className="text-sm text-gray-500">{`@${user.id}`}</span>
        </div>
      </div>

      <div className="flex-1">
        {infoItems.map((item, index) => (
          <div key={index} className="flex cursor-pointer items-center justify-between px-4 py-4 transition-colors active:bg-gray-50">
            <div className="text-[15px] font-medium text-app-text">{item.label}</div>
            <div className="flex items-center gap-2">
              <span className={`text-[15px] ${item.valueColor || 'text-gray-500'}`}>{item.value}</span>
              <IcChevronRight size={18} className="text-gray-400" />
            </div>
          </div>
        ))}

        <div className="mb-6 px-4 py-1 text-[13px] text-gray-500">
          {isEnglish ? 'Choose the country where you live.' : '选择你居住的国家。'} <span className="text-blue-500">{isEnglish ? 'Learn more' : '了解更多'}</span>
        </div>

        {automationItems.map((item, index) => (
          <div key={index} className="flex cursor-pointer items-start justify-between px-4 py-4 transition-colors active:bg-gray-50">
            <div className="flex flex-col gap-0.5">
              <div className="text-[15px] font-medium text-app-text">{item.label}</div>
              <div className="text-[13px] text-gray-500">{item.description}</div>
            </div>
            <IcChevronRight size={18} className="self-center text-gray-400" />
          </div>
        ))}

        <div className="mt-8 flex justify-center px-4">
          <button className="rounded-full px-4 py-2 text-[15px] font-medium text-red-500 transition-colors active:bg-red-50">
            {isEnglish ? 'Log out' : '退出登录'}
          </button>
        </div>
      </div>
    </div>
  );
};
