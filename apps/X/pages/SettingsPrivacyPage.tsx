import React from 'react';
import { useLocale } from '@/os/locale';
import { useXStore, selectUser } from '../state';
import { useXGestures } from '../hooks/useXGestures';
import {
  IcChevronRight,
  IcContacts,
  IcEye,
  IcFileText,
  IcInfo,
  IcLink,
  IcMessage,
  IcRadio,
  IcShieldOff,
} from '../res/icons';

export const SettingsPrivacyPage: React.FC = () => {
  const user = useXStore(selectUser);
  const { bindBack, go } = useXGestures();
  const isEnglish = useLocale() === 'en';

  const items = [
    { icon: <IcContacts size={22} />, title: isEnglish ? 'Audience and tagging' : '受众和圈人', description: isEnglish ? 'Manage what information you allow other people on X to see.' : '管理你允许其他人在 X 上看到的信息。', tapId: 'settings.privacy.audience.open' },
    { icon: <IcFileText size={22} />, title: isEnglish ? 'Your posts' : '你的帖子', description: isEnglish ? 'Manage information associated with your posts.' : '管理与你的帖子相关的信息。', tapId: 'settings.privacy.yourPosts.open' },
    { icon: <IcEye size={22} />, title: isEnglish ? 'Content you see' : '你看到的内容', description: isEnglish ? 'Decide what content you see on X based on your preferences.' : '根据你的偏好决定你在 X 上看到的内容。', tapId: 'settings.seen.open' },
    { icon: <IcShieldOff size={22} />, title: isEnglish ? 'Mute and block' : '隐藏和屏蔽', description: isEnglish ? 'Manage the accounts, words, and notifications you have muted or blocked.' : '管理你已隐藏或屏蔽的账号、词语和通知。', tapId: null },
    { icon: <IcMessage size={22} />, title: isEnglish ? 'Direct Messages' : '聊天', description: isEnglish ? 'Manage who can message you directly.' : '管理谁可以直接私信你。', tapId: 'settings.privacy.chat.open' },
    { icon: <IcRadio size={22} />, title: isEnglish ? 'Spaces' : '空间', description: isEnglish ? 'Manage your Spaces activity.' : '管理你的空间活动。', tapId: 'settings.privacy.space.open' },
    { icon: <IcLink size={22} />, title: isEnglish ? 'Discoverability and contacts' : '允许认识我的人找到我和联系人', description: isEnglish ? 'Control whether people who know you can find you, and manage imported contacts.' : '控制认识你的人是否能找到你，并管理已导入的联系人。', tapId: 'settings.privacy.findContacts.open' },
    { icon: <IcInfo size={22} />, title: isEnglish ? 'About your account' : '关于你的账号', description: isEnglish ? 'Manage location information related to your account.' : '管理与你的账号关联的位置信息。', tapId: 'settings.privacy.aboutAccount.open' },
  ];

  return (
    <div className="flex min-h-full flex-col bg-app-bg pt-10 text-app-text">
      <div className="sticky top-0 z-10 relative flex items-center justify-center border-b border-gray-100 bg-app-bg px-4 py-3">
        <button className="absolute left-4 text-app-text" {...bindBack()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g></svg>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold leading-tight">{isEnglish ? 'Privacy and safety' : '隐私和安全'}</span>
          <span className="text-sm text-gray-500">{`@${user.id}`}</span>
        </div>
      </div>

      <div className="px-4 py-3 text-[13px] text-gray-600">
        {isEnglish ? 'Manage what you see and share on X.' : '管理你在 X 上看到和分享的信息。'}
      </div>

      <div className="flex-1">
        {items.map((item, idx) => (
          <div
            key={idx}
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
