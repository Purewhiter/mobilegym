import React, { useState } from 'react';
import { useLocale } from '@/os/locale';
import { useXStore, selectUser } from '../state';
import { useXGestures } from '../hooks/useXGestures';

const SwitchSlider: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => {
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState(value ? 1 : 0);
  const startXRef = React.useRef(0);
  const startPosRef = React.useRef(pos);
  React.useEffect(() => { setPos(value ? 1 : 0); }, [value]);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => { setDragging(true); startXRef.current = e.clientX; startPosRef.current = pos; (e.target as Element).setPointerCapture?.((e as any).pointerId); };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => { if (!dragging) return; const dx = e.clientX - startXRef.current; setPos(Math.max(0, Math.min(1, startPosRef.current + dx / 40))); };
  const onPointerUp = () => { if (!dragging) return; setDragging(false); const nextVal = pos > 0.5; setPos(nextVal ? 1 : 0); onChange(nextVal); };
  return (
    <div role="switch" aria-checked={value} className={`relative h-7 w-14 rounded-full ${value ? 'bg-green-500' : 'bg-gray-200'}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onClick={() => { if (dragging) return; const next = !value; setPos(next ? 1 : 0); onChange(next); }}>
      <div className="absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-white/70 transition-transform" style={{ transform: `translateX(${pos * 28}px)` }} />
    </div>
  );
};

export const SettingsPrivacyAudiencePage: React.FC = () => {
  const user = useXStore(selectUser);
  const settings = useXStore(s => s.settings);
  const updateSettings = useXStore(s => s.updateSettings);
  const { bindBack } = useXGestures();
  const isEnglish = useLocale() === 'en';

  return (
    <div className="flex min-h-full flex-col bg-app-bg pt-10 text-app-text">
      <div className="sticky top-0 z-10 relative flex items-center justify-center border-b border-gray-100 bg-app-bg px-4 py-3">
        <button className="absolute left-4 text-app-text" {...bindBack()} aria-label={isEnglish ? 'Back' : '返回'}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g></svg>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold leading-tight">{isEnglish ? 'Audience and tagging' : '受众和圈人'}</span>
          <span className="text-sm text-gray-500">{`@${user.id}`}</span>
        </div>
      </div>
      <div className="px-4 py-3 text-[13px] text-gray-600">{isEnglish ? 'Manage what information you allow other people on X to see.' : '管理你允许其他人在 X 上看到的信息。'}</div>
      <div className="px-4">
        <div className="flex items-start justify-between py-3">
          <div className="mr-4">
            <div className="text-[15px] font-medium">{isEnglish ? 'Protect your posts' : '将你的帖子设为私密'}</div>
            <div className="mt-1 text-[13px] text-gray-600">{isEnglish ? 'Your posts will only be visible to your followers. You will need to approve each new follower.' : '你的帖子只对关注你的人可见。开启后，你需要批准每一个新的关注者。'} <span className="text-blue-500">{isEnglish ? 'Learn more' : '了解更多'}</span></div>
          </div>
          <SwitchSlider value={settings.privatePosts} onChange={v => updateSettings({ privatePosts: v })} />
        </div>
        <div className="flex items-start justify-between py-3">
          <div className="mr-4">
            <div className="text-[15px] font-medium">{isEnglish ? 'Protect your videos' : '保护你的视频'}</div>
            <div className="mt-1 text-[13px] text-gray-600">{isEnglish ? 'If enabled, videos you post or send in Direct Messages cannot be downloaded by default.' : '如果启用，你发布或通过私信发送的视频默认不可下载。'} <span className="text-blue-500">{isEnglish ? 'Learn more' : '了解更多'}</span></div>
          </div>
          <SwitchSlider value={settings.protectVideos} onChange={v => updateSettings({ protectVideos: v })} />
        </div>
        <div className="flex cursor-pointer items-center justify-between py-3 transition-colors active:bg-gray-50" onClick={() => updateSettings({ photoTagging: !settings.photoTagging })}>
          <div className="text-[15px]">{isEnglish ? 'Photo tagging' : '照片圈人'}</div>
          <div className={`text-[15px] ${settings.photoTagging ? 'text-blue-500' : 'text-gray-500'}`}>{settings.photoTagging ? (isEnglish ? 'On' : '开启') : (isEnglish ? 'Off' : '关闭')}</div>
        </div>
      </div>
    </div>
  );
};
