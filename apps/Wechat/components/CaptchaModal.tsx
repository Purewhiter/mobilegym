import React, { useState, useEffect, useRef } from 'react';
import { IcAccessibility, IcClose, IcRotateCcw } from '../res/icons';

interface CaptchaModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CaptchaModal: React.FC<CaptchaModalProps> = ({ open, onClose, onSuccess }) => {
  const [sliderValue, setSliderValue] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [success, setSuccess] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [targetPct, setTargetPct] = useState(() => 35 + Math.random() * 35);
  const [trackWidth, setTrackWidth] = useState(0);
  const sliderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setSliderValue(0);
      setSuccess(false);
      setTargetPct(35 + Math.random() * 35);
      setRefreshKey(k => k + 1);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = sliderRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setTrackWidth(rect.width);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open, refreshKey]);

  if (!open) return null;

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !sliderRef.current) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const rect = sliderRef.current.getBoundingClientRect();
    const knobWidth = 54;
    const usableWidth = Math.max(1, rect.width - knobWidth);
    const x = Math.max(0, Math.min(clientX - rect.left, usableWidth));
    const percent = (x / usableWidth) * 100;
    setSliderValue(percent);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    const piecePos = Math.min(78, Math.max(0, sliderValue * 0.78));
    if (Math.abs(piecePos - targetPct) < 5) {
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 500);
    } else {
      setSliderValue(0);
    }
  };

  const handleRefresh = () => {
    setSliderValue(0);
    setSuccess(false);
    setTargetPct(35 + Math.random() * 35);
    setRefreshKey(k => k + 1);
  };

  const puzzleLeftPct = Math.min(72, Math.max(0, sliderValue * 0.78));
  const knobWidth = 54;
  const usableWidth = Math.max(1, trackWidth - knobWidth);
  const knobLeftPx = Math.max(0, Math.min((sliderValue / 100) * usableWidth, usableWidth));
  const progressWidthPx = Math.max(0, Math.min(knobLeftPx + knobWidth, trackWidth));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onMouseMove={handleDragMove} onTouchMove={handleDragMove} onMouseUp={handleDragEnd} onTouchEnd={handleDragEnd}>
      <div className="bg-white w-[340px] rounded-md overflow-hidden flex flex-col">
        <div className="bg-[#1b77ff] text-white px-4 pt-3 pb-3 relative">
          <button onClick={onClose} className="absolute right-2 top-2 p-2">
            <IcClose size={18} className="text-white" />
          </button>
          <div className="text-[14px] leading-5">安全验证</div>
          <div className="text-[18px] font-medium leading-6 mt-0.5">拖动下方滑块完成拼图</div>
        </div>

        <div className="px-4 pt-3 pb-4">
          <div className="relative w-full h-[156px] bg-gray-200 overflow-hidden">
            <div
              key={refreshKey}
              className="absolute inset-0"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.25), transparent 45%), radial-gradient(circle at 70% 20%, rgba(255,255,255,0.18), transparent 55%), linear-gradient(135deg, #4b93ff, #7dd3fc 45%, #60a5fa)',
              }}
            />
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute top-[40px] left-[18px] w-[54px] h-[54px] border border-white/60 bg-white/10" />
            <div className="absolute top-[40px] w-[54px] h-[54px] border border-white/60 bg-white/10" style={{ left: `${targetPct}%` }} />
            <div className="absolute top-[40px] w-[54px] h-[54px] bg-black/30 shadow-[inset_0_0_6px_rgba(0,0,0,0.5)]" style={{ left: `${targetPct}%` }} />
            <div
              className="absolute top-[40px] w-[54px] h-[54px] bg-white shadow-md z-10 border border-white"
              style={{
                left: `${puzzleLeftPct}%`,
                backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0.15))',
              }}
            />
            <div className="absolute right-2 bottom-2 text-white/80 text-[12px]">混元AI生成</div>
          </div>

          <div className="mt-3">
            <div
              ref={sliderRef}
              className="relative h-11 bg-[#e6e6e6] rounded-sm overflow-hidden"
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
            >
              <div className="absolute inset-0 flex items-center justify-center text-[12px] text-gray-500 select-none">
                {success ? '验证通过' : ''}
              </div>
              <div className={`absolute top-0 left-0 h-full ${success ? 'bg-[#07C160]' : 'bg-[#1b77ff]'}`} style={{ width: `${progressWidthPx}px` }} />
              <div
                className="absolute top-0 h-11 w-[54px] bg-[#1b77ff] rounded-sm shadow-sm flex items-center justify-center z-10"
                style={{ left: `${knobLeftPx}px` }}
              >
                <div className="text-white text-[18px] tracking-widest leading-none">|||</div>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between text-gray-500">
              <button className="flex items-center gap-2 text-[13px]" onClick={onClose}>
                <IcAccessibility size={16} className="text-gray-500" />
                我不会
              </button>
              <button className="p-2" onClick={handleRefresh}>
                <IcRotateCcw size={18} className="text-gray-500" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
