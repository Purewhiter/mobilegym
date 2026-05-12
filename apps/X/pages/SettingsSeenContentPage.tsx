import React from 'react';
import { useLocale } from '@/os/locale';
import { useXStore, selectUser } from '../state';
import { useXGestures } from '../hooks/useXGestures';
import { IcChevronRight } from '../res/icons';

export const SettingsSeenContentPage: React.FC = () => {
  const user = useXStore(selectUser);
  const { bindBack, go } = useXGestures();
  const isEnglish = useLocale() === 'en';

  return (
    <div className="flex min-h-full flex-col bg-app-bg pt-10 text-app-text">
      <div className="sticky top-0 z-10 relative flex items-center justify-center border-b border-gray-100 bg-app-bg px-4 py-3">
        <button className="absolute left-4 text-app-text" {...bindBack()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g></svg>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold leading-tight">{isEnglish ? 'Content you see' : '你看到的内容'}</span>
          <span className="text-sm text-gray-500">{`@${user.id}`}</span>
        </div>
      </div>
      <div className="px-4 py-3 text-[13px] text-gray-600">
        {isEnglish ? 'Decide what content you see on X based on preferences such as follows and interests.' : '根据你的偏好，例如关注和兴趣，决定你在 X 上看到的内容。'}
      </div>
      <div className="mt-1">
        <div className="flex cursor-pointer items-center px-4 py-4 transition-colors active:bg-gray-50">
          <div className="flex-1 text-[15px]">{isEnglish ? 'Follows' : '关注'}</div>
          <IcChevronRight size={18} className="text-gray-400" />
        </div>
        <div className="flex cursor-pointer items-center px-4 py-4 transition-colors active:bg-gray-50">
          <div className="flex-1 text-[15px]">{isEnglish ? 'Interests' : '兴趣'}</div>
          <IcChevronRight size={18} className="text-gray-400" />
        </div>
        <div className="flex cursor-pointer items-center px-4 py-4 transition-colors active:bg-gray-50" onClick={() => go('settings.seen.explore.open')}>
          <div className="flex-1 text-[15px]">{isEnglish ? 'Explore settings' : '探索设置'}</div>
          <IcChevronRight size={18} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
};
