import React from 'react';
import { IcCompass, IcBookmark, IcAddSquare } from '../res/icons';
import { useLocation } from 'react-router-dom';
import { useMapGestures } from '../hooks/useMapGestures';
import { useMapStrings } from '../hooks/useMapStrings';
export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { bindTap } = useMapGestures();
  const s = useMapStrings();
  
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;

  return (
    <div className="flex items-center justify-around h-14 bg-app-surface border-t border-app-border pb-safe">
      <button
        className={`flex flex-col items-center justify-center w-full h-full ${isActive('/') ? 'text-blue-600' : 'text-app-text-muted'}`}
        {...bindTap('tab.explore')}
      >
        <IcCompass size={24} fill={isActive('/') ? 'currentColor' : 'none'} />
        <span className="text-xs mt-1">{s.tab_explore}</span>
      </button>
      
      <button
        className={`flex flex-col items-center justify-center w-full h-full ${isActive('/me') ? 'text-blue-600' : 'text-app-text-muted'}`}
        {...bindTap('tab.me')}
      >
        <IcBookmark size={24} fill={isActive('/me') ? 'currentColor' : 'none'} />
        <span className="text-xs mt-1">{s.tab_me}</span>
      </button>

      <button
        className={`flex flex-col items-center justify-center w-full h-full ${isActive('/contribute') ? 'text-blue-600' : 'text-app-text-muted'}`}
        {...bindTap('tab.contribute')}
      >
        <IcAddSquare size={24} fill={isActive('/contribute') ? 'currentColor' : 'none'} />
        <span className="text-xs mt-1">{s.tab_contribute}</span>
      </button>
    </div>
  );
};
