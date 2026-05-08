import { useAlipayStrings } from '../hooks/useAlipayStrings';
import React from 'react';
import { IcNavBack, IcUser } from '../res/icons';
import { useAlipayStore } from '../state';
import { useAlipayGestures } from '../hooks/useAlipayGestures';
import { Slider } from '@/os/components/Slider';
export const FontSizeSettingsPage: React.FC = () => {
  const s = useAlipayStrings();
  const { bindBack } = useAlipayGestures();
  const settings = useAlipayStore(s => s.settings);
  const setSettings = useAlipayStore(s => s.setSettings);
  const value = settings.general.fontSizeLevel;
  const setValue = (next: number) =>
    setSettings((prev) => ({ ...prev, general: { ...prev.general, fontSizeLevel: Math.max(0, Math.min(4, Number.isFinite(next) ? next : prev.general.fontSizeLevel)) } }));
  const fontSize = React.useMemo(() => 14 + value * 2, [value]);

  return (
    <div className="bg-app-bg h-full w-full flex flex-col pt-10">
      <div className="fixed top-0 left-0 right-0 h-10 bg-app-surface z-10 pointer-events-none"></div>
      <div className="sticky top-0 z-20 bg-app-surface px-4 pt-4 pb-2 flex items-center justify-between border-b border-gray-100">
        <button {...bindBack<HTMLButtonElement>()} className="p-1 -ml-1">
          <IcNavBack size={24} className="text-gray-800" />
        </button>
        <span className="text-lg font-medium text-gray-800">{s.font_size}</span>
        <div className="w-6" />
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 px-4 pt-6">
          <div className="flex justify-end mb-4">
            <div className="bg-app-primary text-white px-4 py-2 rounded-2xl rounded-br-md" style={{ fontSize }}>
              {s.preview_font_size}
            </div>
            <div className="w-10 h-10 rounded bg-gray-200 ml-3 flex items-center justify-center">
              <IcUser size={20} className="text-gray-500" />
            </div>
          </div>

          <div className="flex items-start mb-4">
            <div className="w-12 h-12 rounded bg-app-primary flex items-center justify-center text-white font-bold mr-3 flex-shrink-0">
              {s.transferpage_pay}
            </div>
            <div className="bg-app-surface rounded-2xl rounded-tl-md px-4 py-3 shadow-sm" style={{ fontSize }}>
              {s.drag_slider_to_set_font_size}
            </div>
          </div>

          <div className="flex items-start">
            <div className="w-12 h-12 rounded bg-app-primary flex items-center justify-center text-white font-bold mr-3 flex-shrink-0">
              {s.transferpage_pay}
            </div>
            <div className="bg-app-surface rounded-2xl rounded-tl-md px-4 py-3 shadow-sm" style={{ fontSize }}>
              {s.font_size_change_description}
            </div>
          </div>
        </div>

        <div className="bg-app-surface border-t border-gray-100 px-4 py-6">
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-sm">A</span>
            <span className="text-xl">A</span>
          </div>
          <div className="relative">
            <div className="absolute -top-6 left-1/4 -translate-x-1/2 text-gray-500 text-sm">{s.standard_2}</div>
            <Slider
              min={0}
              max={4}
              step={1}
              value={value}
              onChange={setValue}
              data-action="fontSize.slider.input"
              data-action-type="input"
              data-action-params={JSON.stringify({ value })}
              className="w-full"
            />
            <div className="flex justify-between text-gray-300 text-xs mt-2 px-0.5">
              <span>|</span>
              <span>|</span>
              <span>|</span>
              <span>|</span>
              <span>|</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
