import React from 'react';
import { useLocale } from '@/os/locale';
import { useXStore, selectUser } from '../state';
import { useXGestures } from '../hooks/useXGestures';

export const SettingsTimelineHomeTagsPage: React.FC = () => {
  const user = useXStore(selectUser);
  const { bindBack } = useXGestures();
  const isEnglish = useLocale() === 'en';

  return (
    <div className="flex min-h-full flex-col bg-app-bg pt-10 text-app-text">
      <div className="sticky top-0 z-10 relative flex items-center justify-center border-b border-gray-100 bg-app-bg px-4 py-3">
        <button className="absolute left-4 text-app-text" {...bindBack()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g></svg>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold leading-tight">{isEnglish ? '"Home" tabs' : '"主页"标签'}</span>
          <span className="text-sm text-gray-500">{`@${user.id}`}</span>
        </div>
      </div>
      <div className="px-6 py-10">
        <div className="mb-2 text-2xl font-bold">{isEnglish ? 'Nothing here yet' : '这里空空如也'}</div>
        <div className="text-[15px] text-gray-600">{isEnglish ? 'Try pinning lists or communities to make it easier to access the content you like.' : '尝试将列表或社区置顶，以便更轻松地访问你喜欢的内容。'}</div>
      </div>
    </div>
  );
};
