/**
 * Bottom Tab Bar Component
 */
import React from 'react';
import { useLocation } from 'react-router-dom';
import { IcClock, IcFolder, IcCloud } from '../res/icons';
import { useFileManagerGestures } from '../hooks/useFileManagerGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
export const TabBar: React.FC = () => {
  const location = useLocation();
  const { bindTap } = useFileManagerGestures();
  const s = useAppStrings(strings, stringsEn);
  
  const activeTab = location.pathname === '/recent' ? 'recent' 
    : location.pathname === '/cloud' ? 'cloud' 
    : 'browse';
  
  return (
    <div className="h-[72px] bg-app-surface border-t border-gray-100 flex items-center justify-around absolute bottom-0 left-0 right-0 z-10 px-2 pb-2">
      <button 
        {...bindTap('tab.recent')}
        className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'recent' ? 'text-blue-600' : 'text-gray-400'}`}
      >
        <div className={`w-10 h-8 flex items-center justify-center rounded-2xl ${activeTab === 'recent' ? 'bg-blue-50' : ''}`}>
          <IcClock size={24} strokeWidth={activeTab === 'recent' ? 2.5 : 1.5} />
        </div>
        <span className="text-[11px] font-medium">{s.tab_recent}</span>
      </button>

      <button
        {...bindTap('tab.browse')}
        className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'browse' ? 'text-blue-600' : 'text-gray-400'}`}
      >
        <div className={`w-10 h-8 flex items-center justify-center rounded-2xl ${activeTab === 'browse' ? 'bg-blue-50' : ''}`}>
          <IcFolder size={24} fill={activeTab === 'browse' ? 'currentColor' : 'none'} strokeWidth={activeTab === 'browse' ? 2.5 : 1.5} />
        </div>
        <span className="text-[11px] font-medium">{s.tab_browse}</span>
      </button>

      <button
        {...bindTap('tab.cloud')}
        className={`flex flex-col items-center gap-1 flex-1 ${activeTab === 'cloud' ? 'text-blue-600' : 'text-gray-400'}`}
      >
        <div className={`w-10 h-8 flex items-center justify-center rounded-2xl ${activeTab === 'cloud' ? 'bg-blue-50' : ''}`}>
          <IcCloud size={24} strokeWidth={activeTab === 'cloud' ? 2.5 : 1.5} />
        </div>
        <span className="text-[11px] font-medium">{s.tab_cloud}</span>
      </button>
    </div>
  );
};
