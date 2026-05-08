import React, { useState } from 'react';
import { IcNavBack } from '../res/icons';
import { useRailwayGestures } from '../hooks/useRailwayGestures';
import { useAppNavigate } from '../navigation';
import { useRailwayStore } from '../state';
import { Slider } from '@/os/components/Slider';

const FONT_SIZE_OPTIONS = ['small', 'medium', 'large'] as const;
const FONT_SIZE_INDEX: Record<string, number> = {
  small: 0,
  medium: 1,
  large: 2,
};

export const FontSizePage: React.FC = () => {
  const { bindBack } = useRailwayGestures();
  const { go } = useAppNavigate();
  const settings = useRailwayStore(s => s.settings);
  const updateSettings = useRailwayStore(s => s.updateSettings);
  const [fontSize, setFontSize] = useState(FONT_SIZE_INDEX[settings.fontSize] ?? 1); // 0=小, 1=标准, 2=大
  const [highContrast, setHighContrast] = useState(Boolean(settings.highContrast));
  const sizeLabels = ['小', '标准', '大'];

  return (
    <div className="min-h-full bg-app-bg">
      <div className="bg-app-primary pt-10 pb-3 px-4 flex items-center relative sticky top-0 z-20">
        <button className="absolute left-3" {...bindBack<HTMLButtonElement>()}>
          <IcNavBack size={24} className="text-white" />
        </button>
        <span className="flex-1 min-w-0 px-2 text-center text-lg font-medium text-white leading-tight">字体大小及对比度</span>
      </div>

      {/* 预览区域 */}
      <div className="bg-app-surface mx-4 mt-4 rounded-xl overflow-hidden shadow-sm">
        {/* 预览车票1 */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">07:17</span>
            <div className="text-center">
              <div className="text-xs text-gray-400 border border-gray-300 rounded px-2 py-0.5">车次号</div>
              <div className="text-xs text-gray-400 mt-1">5时46分 ▼</div>
            </div>
            <span className="text-2xl font-bold">13:03</span>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs"><span className="text-orange-500 bg-orange-50 rounded px-1">始</span> 始发站</span>
            <span className="text-xs"><span className="text-green-500 bg-green-50 rounded px-1">终</span> 到达站</span>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span>商务 3张</span>
            <span>一等 <span className="text-app-primary">候补</span> <span className="text-app-primary">⊕</span></span>
            <span>二等 无</span>
          </div>
        </div>

        {/* 预览车票2 */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">11:55</span>
            <div className="text-center">
              <div className="text-xs text-gray-400 border border-gray-300 rounded px-2 py-0.5">车次号</div>
              <div className="text-xs text-gray-400 mt-1">19时2分 ▼</div>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold">06:57</span>
              <span className="text-xs text-orange-500 ml-0.5">+1</span>
            </div>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs"><span className="text-orange-500 bg-orange-50 rounded px-1">始</span> 始发站</span>
            <span className="text-xs"><span className="text-green-500 bg-green-50 rounded px-1">终</span> 到达站</span>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            <span>商务 3张</span>
            <span>一等 <span className="text-app-primary">候补</span> <span className="text-app-primary">⊕</span></span>
            <span>二等 无</span>
          </div>
        </div>
      </div>

      {/* 滑动设置 */}
      <div className="bg-app-surface mx-4 mt-6 rounded-xl px-4 py-6">
        <p className="text-center text-sm text-gray-500 mb-4">左右滑动以设置字体大小</p>
        <div className="flex items-center justify-between mb-3">
          {sizeLabels.map((label, i) => (
            <span key={label} className={`text-sm ${i === fontSize ? 'text-app-primary font-medium' : 'text-gray-400'}`}>
              {label}
            </span>
          ))}
        </div>
        <Slider
          min={0}
          max={2}
          step={1}
          value={fontSize}
          onChange={setFontSize}
          className="w-full"
        />
      </div>

      {/* 高对比度 */}
      <div className="bg-app-surface mx-4 mt-4 rounded-xl px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="text-base font-medium">高对比度</span>
          <button
 className={`w-12 h-6 rounded-full flex items-center ${highContrast ? 'bg-app-primary' : 'bg-gray-300'}`}
 style={{ transition: 'color var(--app-duration-short) var(--app-easing-standard), background-color var(--app-duration-short) var(--app-easing-standard)' }}
            onClick={() => setHighContrast(!highContrast)}
          >
 <div className={`w-5 h-5 bg-app-surface rounded-full shadow ${highContrast ? 'translate-x-6' : 'translate-x-0.5'}`}
 style={{ transition: 'transform var(--app-duration-medium) var(--app-easing-standard)' }} />
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1">高强度色彩对比模式，内容更易读</p>
      </div>

      {/* 立即切换 */}
      <div className="px-6 mt-6">
        <button
          className="w-full py-3 bg-app-primary rounded-lg text-white text-base font-medium"
          data-trigger="fontSize.switchNow"
          data-trigger-type="tap"
          onClick={() => {
            updateSettings({
              fontSize: FONT_SIZE_OPTIONS[fontSize] ?? 'medium',
              highContrast,
            });
            go('fontSize.switchNow', {}, { popTo: '/my' });
          }}
        >
          立即切换
        </button>
      </div>
    </div>
  );
};
