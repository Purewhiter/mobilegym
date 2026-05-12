import React from 'react';
import { useLocale } from '@/os/locale';
import { useXStore, selectUser } from '../state';
import { useXGestures } from '../hooks/useXGestures';

export const SettingsPrivacyAboutAccountPage: React.FC = () => {
  const user = useXStore(selectUser);
  const settings = useXStore(s => s.settings);
  const updateSettings = useXStore(s => s.updateSettings);
  const { bindBack } = useXGestures();
  const isEnglish = useLocale() === 'en';

  return (
    <div className="flex min-h-full flex-col bg-app-bg pt-10 text-app-text">
      <div className="sticky top-0 z-10 relative flex items-center justify-center border-b border-gray-100 bg-app-bg px-4 py-3">
        <button className="absolute left-4 text-app-text" {...bindBack()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g></svg>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold leading-tight">{isEnglish ? 'About your account' : '关于你的账号'}</span>
          <span className="text-sm text-gray-500">{`@${user.id}`}</span>
        </div>
      </div>
      <div className="px-4 py-3 text-[13px] text-gray-600">{isEnglish ? 'Privacy settings' : '隐私设置'}</div>
      <div className="px-4">
        <label className="flex items-center justify-between py-3">
          <div className="text-[15px]">{isEnglish ? 'Use region / continent' : '使用地区 / 大洲'}</div>
          <input type="radio" name="locationType" checked={settings.useRegion} onChange={() => updateSettings({ useRegion: true })} className="h-4 w-4 accent-blue-600" />
        </label>
        <label className="flex items-center justify-between py-3">
          <div className="text-[15px]">{isEnglish ? 'Use country' : '使用国家'}</div>
          <input type="radio" name="locationType" checked={!settings.useRegion} onChange={() => updateSettings({ useRegion: false })} className="h-4 w-4 accent-blue-600" />
        </label>
      </div>
    </div>
  );
};
