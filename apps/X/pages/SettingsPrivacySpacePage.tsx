import React, { useState } from 'react';
import { useLocale } from '@/os/locale';
import { useXStore, selectUser } from '../state';
import { useXGestures } from '../hooks/useXGestures';
import { IcChevronRight } from '../res/icons';

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

export const SettingsPrivacySpacePage: React.FC = () => {
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
          <span className="text-lg font-bold leading-tight">{isEnglish ? 'Spaces' : '空间'}</span>
          <span className="text-sm text-gray-500">{`@${user.id}`}</span>
        </div>
      </div>
      <div className="px-4 py-3 text-[13px] text-gray-600">{isEnglish ? 'Manage your Spaces activity.' : '管理你的空间活动。'}</div>
      <div className="px-4 py-3 flex items-start justify-between">
        <div className="mr-4">
          <div className="text-[15px] font-medium">{isEnglish ? 'Let followers see which Spaces you are listening to' : '让关注者看到你在收听哪个空间'}</div>
          <div className="mt-1 text-[13px] leading-snug text-gray-600">{isEnglish ? 'Even if this is off, people can still see you when you are in a Space. Your followers can always see when you are hosting, co-hosting, or speaking.' : '即使关闭此设置，当你在空间中时，其他人也可能看到你。你的关注者始终可以看到你是否正在主持、共同主持或发言。'} <span className="text-blue-500">{isEnglish ? 'Learn more' : '了解更多'}</span></div>
        </div>
        <SwitchSlider value={settings.showListening} onChange={v => updateSettings({ showListening: v })} />
      </div>
      <div className="mt-2">
        <div className="flex cursor-pointer items-center px-4 py-4 transition-colors active:bg-gray-50">
          <div className="flex-1">
            <div className="text-[15px] font-medium">{isEnglish ? 'Manage your recorded Spaces history' : '管理你的空间录制历史'}</div>
            <div className="text-[13px] text-gray-500">{isEnglish ? 'Share, listen to, or delete your past recordings.' : '分享、收听或删除你过去的录音。'}</div>
          </div>
          <IcChevronRight size={18} className="text-gray-400" />
        </div>
        <div className="flex cursor-pointer items-center px-4 py-4 transition-colors active:bg-gray-50">
          <div className="flex-1">
            <div className="text-[15px] font-medium">{isEnglish ? 'Manage your scheduled Spaces' : '管理你的预排期空间'}</div>
            <div className="text-[13px] text-gray-500">{isEnglish ? 'Share, edit, or cancel your scheduled Spaces.' : '分享、编辑或取消你的预排期空间。'}</div>
          </div>
          <IcChevronRight size={18} className="text-gray-400" />
        </div>
      </div>
    </div>
  );
};
