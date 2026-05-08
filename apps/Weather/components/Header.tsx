import React from 'react';
import { IcAdd, IcMoreVert, IcNavigation } from '../res/icons';
interface HeaderProps {
  locationName: string;
  currentIndex: number;  // 当前页面索引：0=定位，1+=城市
  cityCount: number;     // 已添加的城市数量（不含定位）
}

export const Header: React.FC<HeaderProps> = ({ locationName, currentIndex, cityCount }) => {
  const isLocationPage = currentIndex === 0;
  
  return (
    <div className="text-white px-4 pt-12 pb-2">
      {/* Top Bar: Icons only */}
      <div className="flex justify-end items-center gap-5 mb-6">
        <IcAdd size={28} strokeWidth={1.5} />
        <IcMoreVert size={28} strokeWidth={1.5} />
      </div>

      {/* Location Area */}
      <div className="flex flex-col items-start pl-1">
        <span className="text-2xl font-normal tracking-wide mb-1">{locationName}</span>
        <div className="flex items-center gap-1.5 opacity-80">
          {/* 定位箭头：当前是定位页面时白色，否则暗色 */}
          <IcNavigation 
            size={12} 
            fill="currentColor" 
            className={`rotate-45 transition-opacity ${isLocationPage ? 'opacity-100' : 'opacity-40'}`} 
          />
          {/* 城市圆点指示器 */}
          <div className="flex gap-1">
            {Array.from({ length: cityCount }).map((_, idx) => (
              <div 
                key={idx}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  currentIndex === idx + 1 ? 'bg-white' : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};