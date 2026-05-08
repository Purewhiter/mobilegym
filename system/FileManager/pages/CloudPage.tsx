/**
 * Cloud Page
 * 
 * Placeholder for cloud storage integration
 */
import React from 'react';
import { IcCloud } from '../res/icons';
import { dimens } from '../res/dimens';
import { TabBar } from '../components/TabBar';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';

export const CloudPage: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  return (
    <div className="h-full flex flex-col bg-app-surface relative">
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <div className="flex flex-col items-center gap-2">
          <IcCloud size={48} />
          <span>{s.cloud_not_connected}</span>
        </div>
      </div>
      <TabBar />
    </div>
  );
};

export default CloudPage;
