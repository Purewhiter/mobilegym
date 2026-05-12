import React from 'react';
import { useLocale } from '@/os/locale';
import { useXStore, selectUser } from '../state';
import { useXGestures } from '../hooks/useXGestures';
import { IcChevronRight } from '../res/icons';

export const SettingsNotificationPreferencesPage: React.FC = () => {
  const user = useXStore(selectUser);
  const { bindBack, bindTap } = useXGestures();
  const isEnglish = useLocale() === 'en';

  const items = [
    { title: isEnglish ? 'Push notifications' : '推送通知', tapId: 'settings.notifications.preferences.push.open' },
    { title: isEnglish ? 'SMS notifications' : '短信通知', tapId: null },
    { title: isEnglish ? 'Email notifications' : '电子邮件通知', tapId: null },
  ];

  return (
    <div className="flex min-h-full flex-col bg-app-bg pt-10 text-app-text">
      <div className="sticky top-0 z-10 relative flex items-center justify-center border-b border-gray-100 bg-app-bg px-4 py-3">
        <button className="absolute left-4 text-app-text" {...bindBack()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g></svg>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold leading-tight">{isEnglish ? 'Preferences' : '偏好设置'}</span>
          <span className="text-sm text-gray-500">{`@${user.id}`}</span>
        </div>
      </div>
      <div className="px-4 py-3 text-[13px] text-gray-600">
        {isEnglish ? 'Choose your preferred notification delivery methods.' : '选择你偏好的通知接收方式。'} <span className="text-blue-500">{isEnglish ? 'Learn more' : '了解更多'}</span>
      </div>
      <div className="flex-1">
        {items.map((item, idx) => (
          <div key={idx} className="flex cursor-pointer items-center px-4 py-4 transition-colors active:bg-gray-50" {...(item.tapId ? bindTap(item.tapId) : {})}>
            <div className="flex-1 text-[15px] font-medium">{item.title}</div>
            <IcChevronRight size={18} className="text-gray-400" />
          </div>
        ))}
      </div>
    </div>
  );
};
