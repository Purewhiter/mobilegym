import React from 'react';
import { Cloud } from 'lucide-react';
import { useLocale } from '../locale';

interface HomeWeatherWidgetProps {
  onClick: () => void;
}

export const HomeWeatherWidget: React.FC<HomeWeatherWidgetProps> = ({ onClick }) => {
  const locale = useLocale();
  const isEnglish = locale === 'en';

  return (
    <button
      type="button"
      aria-label={isEnglish ? 'Tap to view weather details' : '点击查看天气详情'}
      className="w-full text-left bg-black/20 backdrop-blur-md rounded-3xl p-4 mb-6 flex flex-col gap-3 cursor-pointer active:scale-95 transition-transform border-0"
      onClick={onClick}
    >
      <div className="flex justify-between items-start">
        <div>
          <div className="text-gray-300 text-sm mb-1">{isEnglish ? 'Weather' : '天气'}</div>
          <div className="text-white text-3xl font-medium">
            --°
            <span className="text-lg font-light text-gray-300 ml-2">
              {isEnglish ? 'Tap to view' : '点击查看'}
            </span>
          </div>
        </div>
        <div className="text-gray-300">
          <Cloud size={40} />
        </div>
      </div>

      <div className="text-center text-[10px] text-gray-400 pt-2 border-t border-white/10">
        {isEnglish ? 'Tap to view weather details' : '点击查看天气详情'}
      </div>
    </button>
  );
};
