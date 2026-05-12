import React from 'react';
import { useLocale } from '@/os/locale';
import { useXStore, selectUser } from '../state';
import { useXGestures } from '../hooks/useXGestures';

const SwitchSlider: React.FC<{ value: boolean; onChange: (v: boolean) => void }> = ({ value, onChange }) => {
  const [dragging, setDragging] = React.useState(false);
  const [pos, setPos] = React.useState(value ? 1 : 0);
  const startXRef = React.useRef(0);
  const startPosRef = React.useRef(pos);
  React.useEffect(() => { setPos(value ? 1 : 0); }, [value]);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => { setDragging(true); startXRef.current = e.clientX; startPosRef.current = pos; (e.target as Element).setPointerCapture?.((e as any).pointerId); };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => { if (!dragging) return; setPos(Math.max(0, Math.min(1, startPosRef.current + (e.clientX - startXRef.current) / 40))); };
  const onPointerUp = () => { if (!dragging) return; setDragging(false); const nextVal = pos > 0.5; setPos(nextVal ? 1 : 0); onChange(nextVal); };
  return (
    <div role="switch" aria-checked={value} className={`relative h-6 w-11 rounded-full ${value ? 'bg-green-500' : 'bg-gray-200'}`} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onClick={() => { if (dragging) return; const next = !value; setPos(next ? 1 : 0); onChange(next); }}>
      <div className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform" style={{ transform: `translateX(${pos * 22}px)` }} />
    </div>
  );
};

export const SettingsTimelineInteractionsPage: React.FC = () => {
  const user = useXStore(selectUser);
  const showInteractionCounts = useXStore(s => s.settings.showInteractionCounts);
  const updateSettings = useXStore(s => s.updateSettings);
  const enablePostSwipeGesture = useXStore(s => s.settings.enablePostSwipeGesture);
  const { bindBack } = useXGestures();
  const isEnglish = useLocale() === 'en';

  return (
    <div className="flex min-h-full flex-col bg-app-bg pt-10 text-app-text">
      <div className="sticky top-0 z-10 relative flex items-center justify-center border-b border-gray-100 bg-app-bg px-4 py-3">
        <button className="absolute left-4 text-app-text" {...bindBack()}>
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current"><g><path d="M7.414 13l5.043 5.04-1.414 1.42L3.586 12l7.457-7.46 1.414 1.42L7.414 11H21v2H7.414z" /></g></svg>
        </button>
        <div className="flex flex-col items-center">
          <span className="text-lg font-bold leading-tight">{isEnglish ? 'Post interactions' : '帖子互动'}</span>
          <span className="text-sm text-gray-500">{`@${user.id}`}</span>
        </div>
      </div>
      <div className="flex-1">
        <div className="px-4 py-3 text-[13px] text-gray-600">{isEnglish ? 'Show interaction buttons and counts on posts.' : '在帖子上显示互动按钮和次数。'}</div>
        <div className="px-4">
          <div className="flex items-center justify-between py-3">
            <div className="text-[15px]">{isEnglish ? 'Show interaction counts' : '显示互动量'}</div>
            <SwitchSlider value={showInteractionCounts} onChange={v => updateSettings({ showInteractionCounts: v })} />
          </div>
          <div className="mb-4 -mt-2 px-0.5 text-[12px] text-gray-500">{isEnglish ? 'Display interaction buttons and counts on posts.' : '在帖子上显示互动按钮和次数。'}</div>
          <div className="flex items-center justify-between py-3">
            <div className="text-[15px]">{isEnglish ? 'Enable post swipe gestures' : '启用帖子滑动手势'}</div>
            <SwitchSlider value={enablePostSwipeGesture} onChange={v => updateSettings({ enablePostSwipeGesture: v })} />
          </div>
          <div className="mb-4 -mt-2 px-0.5 text-[12px] text-gray-500">{isEnglish ? 'Add left and right swipe gestures for post interactions.' : '添加用于与帖子互动的左右滑动手势。'}</div>
        </div>
      </div>
    </div>
  );
};
