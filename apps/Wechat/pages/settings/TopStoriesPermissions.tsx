
import React from 'react';
import { SettingsItem } from './Shared';
import { useWechatStrings } from '../../hooks/useWechatStrings';

export const TopStoriesPermissionsPage: React.FC = () => {
  const t = useWechatStrings();

  return (
    <div className="bg-app-bg min-h-full">
      <div className="h-2"></div>
      <div className="bg-app-surface">
        <SettingsItem label={t.top_stories_hide_likes} />
        <SettingsItem label={t.top_stories_hide_my_likes} isLast />
      </div>
    </div>
  );
};
