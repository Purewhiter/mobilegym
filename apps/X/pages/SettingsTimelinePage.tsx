import React from 'react';
import { useLocale } from '@/os/locale';
import { useXStore, selectUser } from '../state';
import { useXGestures } from '../hooks/useXGestures';
import { IcChevronRight } from '../res/icons';

export const SettingsTimelinePage: React.FC = () => {
  const user = useXStore(selectUser);
  const { bindBack, go } = useXGestures();
  const isEnglish = useLocale() === 'en';

  const items = [
    {
      title: isEnglish ? 'Post interactions' : '帖子互动',
      desc: isEnglish ? 'Customize how you interact with posts.' : '自定义与你和帖子互动的方式。',
      tapId: 'settings.timeline.interactions.open',
    },
    {
      title: isEnglish ? '"Home" tabs' : '"主页"标签',
      desc: isEnglish ? 'Reorder lists and community tabs that appear on your Home screen.' : '重新排列主页上显示的列表和社区标签顺序。',
      tapId: 'settings.timeline.homeTags.open',
    },
  ];

  return (
    <div className="flex min-h-full flex-col bg-app-bg pt-10 text-app-text">
      <div className="sticky top-0 z-10 relative flex items-center justify-center border-b border-gray-100 bg-app-bg px-4 py-3">
        <button className="absolute left-4 text-app-text" {...bindBack()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g></svg>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold leading-tight">{isEnglish ? 'Timeline' : '时间线'}</span>
          <span className="text-sm text-gray-500">{`@${user.id}`}</span>
        </div>
      </div>
      <div className="px-4 py-3 text-[13px] text-gray-600">
        {isEnglish ? 'Customize the look and interactions of your timeline.' : '配置你的时间线外观和互动方式。'}
      </div>
      <div className="flex-1">
        {items.map((item, idx) => (
          <div key={idx} className="flex cursor-pointer items-start px-4 py-4 transition-colors active:bg-gray-50" onClick={() => go(item.tapId as Parameters<typeof go>[0])}>
            <div className="mr-2 flex-1">
              <div className="mb-0.5 text-[15px] font-medium text-app-text">{item.title}</div>
              <div className="text-[13px] leading-tight text-gray-500">{item.desc}</div>
            </div>
            <div className="self-center text-gray-400"><IcChevronRight size={18} /></div>
          </div>
        ))}
      </div>
    </div>
  );
};
