import React from 'react';
import { Header, TextIconRow } from '../../components/SettingsComponents';
import { useSpotifyStrings } from '../../hooks/useSpotifyStrings';

export const AboutPage: React.FC = () => {
  const s = useSpotifyStrings();

  return (
    <div className="flex flex-col h-full bg-app-surface text-white p-4 pt-0 font-sans overflow-y-auto no-scrollbar pb-40">
      <Header title={s.about_title} />

      <div className="space-y-1 mt-2">
        <TextIconRow title={s.about_version} value="9.1.14.864" icon={() => null} />
        <TextIconRow title={s.about_privacy_policy} linkIcon />
        <TextIconRow title={s.about_third_party} icon={() => null} />
        <TextIconRow title={s.about_terms} linkIcon />
        <TextIconRow title={s.about_platform_rules} linkIcon />
      </div>
    </div>
  );
};
