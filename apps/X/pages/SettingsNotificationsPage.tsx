import React from 'react';
import { useLocale } from '@/os/locale';
import { useXStore, selectUser } from '../state';
import { useXGestures } from '../hooks/useXGestures';
import { IcChevronRight, IcCog, IcSliders } from '../res/icons';

export const SettingsNotificationsPage: React.FC = () => {
  const user = useXStore(selectUser);
  const { bindBack, go } = useXGestures();
  const isEnglish = useLocale() === 'en';

  const items = [
    {
      icon: <IcSliders size={22} />,
      title: isEnglish ? 'Filters' : '过滤器',
      description: isEnglish ? 'Choose which notifications you want to see and which ones you want to hide.' : '选择你想看到和不想看到的通知。',
      tapId: 'settings.notifications.filter.open',
    },
    {
      icon: <IcCog size={22} />,
      title: isEnglish ? 'Preferences' : '偏好设置',
      description: isEnglish ? 'Choose your preferred notification delivery methods.' : '选择你偏好的通知接收方式。',
      tapId: 'settings.notifications.preferences.open',
    },
  ];

  return (
    <div className="flex min-h-full flex-col bg-app-bg pt-10 text-app-text">
      <div className="sticky top-0 z-10 relative flex items-center justify-center border-b border-gray-100 bg-app-bg px-4 py-3">
        <button className="absolute left-4 text-app-text" {...bindBack()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g></svg>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold leading-tight">{isEnglish ? 'Notifications' : '通知'}</span>
          <span className="text-sm text-gray-500">{`@${user.id}`}</span>
        </div>
      </div>

      <div className="px-4 py-3 text-[13px] text-gray-600">
        {isEnglish ? 'Select the types of notifications you receive about activity, interests, and recommendations.' : '选择你接收的关于动态、兴趣和推荐的通知类型。'}
      </div>

      <div className="flex-1">
        {items.map((item, idx) => (
          <div key={idx} className="flex cursor-pointer items-start px-4 py-4 transition-colors active:bg-gray-50" onClick={() => go(item.tapId as Parameters<typeof go>[0])}>
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
