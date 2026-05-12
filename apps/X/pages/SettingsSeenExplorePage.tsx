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

export const SettingsSeenExplorePage: React.FC = () => {
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
          <span className="text-lg font-bold leading-tight">{isEnglish ? 'Explore settings' : '探索设置'}</span>
          <span className="text-sm text-gray-500">{`@${user.id}`}</span>
        </div>
      </div>
      <div className="px-4 py-2">
        <div className="mb-2 text-sm font-semibold text-gray-500">{isEnglish ? 'Location' : '位置'}</div>
        <div className="flex items-center justify-between py-3">
          <div className="text-[15px]">{isEnglish ? 'Show content in your current location' : '显示你当前所在位置的内容'}</div>
          <SwitchSlider value={settings.showLocalContent} onChange={v => updateSettings({ showLocalContent: v })} />
        </div>
        <div className="mb-3 text-[12px] text-gray-500">{isEnglish ? 'When enabled, you will see what is happening around you.' : '开启后，你将看到你周围正在发生的新鲜事。'}</div>
        <div className="flex items-center justify-between py-3 opacity-60">
          <div className="text-[15px]">{isEnglish ? 'Explore location' : '探索位置'}</div>
          <div className="text-[15px] text-gray-500">{isEnglish ? 'Select' : '选择'}</div>
        </div>
      </div>
      <div className="px-4 py-2">
        <div className="mb-2 text-sm font-semibold text-gray-500">{isEnglish ? 'Personalization' : '个性化设置'}</div>
        <div className="flex items-center justify-between py-3">
          <div className="text-[15px]">{isEnglish ? 'Your trends' : '你的趋势'}</div>
          <SwitchSlider value={settings.yourTrends} onChange={v => updateSettings({ yourTrends: v })} />
        </div>
        <div className="mb-3 text-[12px] text-gray-500">{isEnglish ? 'Personalize trends for you based on your location and the people you follow.' : '根据你的位置和关注的人，为你个性化推荐趋势。'}</div>
      </div>
    </div>
  );
};
