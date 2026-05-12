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
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => { if (!dragging) return; setPos(Math.max(0, Math.min(1, startPosRef.current + (e.clientX - startXRef.current) / 40))); };
  const onPointerUp = () => { if (!dragging) return; setDragging(false); const nextVal = pos > 0.5; setPos(nextVal ? 1 : 0); onChange(nextVal); };
  return (
    <div role="switch" aria-checked={value} className={`relative h-6 w-11 rounded-full ${value ? 'bg-green-500' : 'bg-gray-200'}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onClick={() => { if (dragging) return; const next = !value; setPos(next ? 1 : 0); onChange(next); }}>
      <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm ring-1 ring-white/70 transition-transform" style={{ transform: `translateX(${pos * 22}px)` }} />
    </div>
  );
};

export const SettingsNotificationPushPage: React.FC = () => {
  const user = useXStore(selectUser);
  const settings = useXStore(s => s.settings);
  const updateSettings = useXStore(s => s.updateSettings);
  const { bindBack } = useXGestures();
  const isEnglish = useLocale() === 'en';

  const section1 = [
    { label: isEnglish ? 'Recommendations' : '推荐', key: 'prefRecommend' as const },
    { label: isEnglish ? 'Follows' : '关注', key: 'prefFollow' as const },
    { label: isEnglish ? 'Live and Spaces' : '直播和空间', key: 'prefLiveSpace' as const },
    { label: isEnglish ? 'News / Sports' : '新闻 / 体育', key: 'prefNewsSports' as const },
  ];
  const section2 = [
    { label: isEnglish ? 'Follows' : '关注', key: 'fromXFollow' as const },
    { label: isEnglish ? 'News / Sports' : '新闻 / 体育', key: 'fromXNewsSports' as const },
    { label: isEnglish ? 'Recommendations' : '推荐', key: 'fromXRecommend' as const },
    { label: isEnglish ? 'Moments' : '瞬间', key: 'fromXMoments' as const },
    { label: isEnglish ? 'Live and Spaces' : '直播和空间', key: 'fromXLiveSpace' as const },
    { label: isEnglish ? 'Other live broadcasts' : '其他直播播客', key: 'fromXOtherLive' as const },
    { label: isEnglish ? 'Crisis and emergency alerts' : '危机和紧急警报', key: 'fromXAlert' as const },
    { label: isEnglish ? 'New feature previews' : '新功能抢先体验', key: 'fromXNewFeatures' as const },
  ];

  return (
    <div className="flex min-h-full flex-col bg-app-bg pt-10 text-app-text">
      <div className="sticky top-0 z-10 relative flex items-center justify-center border-b border-gray-100 bg-app-bg px-4 py-3">
        <button className="absolute left-4 text-app-text" {...bindBack()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g></svg>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold leading-tight">{isEnglish ? 'Push notifications' : '推送通知'}</span>
          <span className="text-sm text-gray-500">{`@${user.id}`}</span>
        </div>
      </div>
      <div className="px-4 py-2">
        {section1.map(item => (
          <div key={item.key} className="flex items-center justify-between py-3">
            <div className="text-[15px]">{item.label}</div>
            <SwitchSlider value={settings[item.key]} onChange={v => updateSettings({ [item.key]: v })} />
          </div>
        ))}
      </div>
      <div className="px-4 py-2">
        <div className="mb-2 text-sm font-semibold text-gray-500">{isEnglish ? 'From X' : '来自 X'}</div>
        {section2.map(item => (
          <div key={item.key} className="flex items-center justify-between py-3">
            <div className="text-[15px]">{item.label}</div>
            <SwitchSlider value={settings[item.key]} onChange={v => updateSettings({ [item.key]: v })} />
          </div>
        ))}
      </div>
      <div className="px-4 py-2">
        <div className="mb-2 text-sm font-semibold text-gray-500">{isEnglish ? 'X Pro' : 'X 专业版'}</div>
        <div className="flex items-center justify-between py-3">
          <div className="text-[15px]">{isEnglish ? 'Pro notifications' : '专业版通知'}</div>
          <SwitchSlider value={settings.proNotify} onChange={v => updateSettings({ proNotify: v })} />
        </div>
      </div>
    </div>
  );
};
