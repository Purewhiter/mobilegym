import React from 'react';
import { Header, InfoText, SectionHeader, ToggleRow } from '../../components/SettingsComponents';
import { useSpotifyGestures } from '../../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../../hooks/useSpotifyStrings';
import { useSpotifyStore } from '../../state';

export const PrivacyPage: React.FC = () => {
  const { bindTap } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const priv = useSpotifyStore((state) => state.settings.privacy);
  const updateSettings = useSpotifyStore((state) => state.updateSettings);

  const privateSession = priv.privateSession;
  const listeningActivity = priv.shareActivity;
  const recentArtists = priv.recentArtists;
  const publicPlaylists = priv.publicPlaylists;
  const profilePlaylists = priv.profilePlaylists;

  return (
    <div className="flex flex-col h-full bg-app-surface text-white p-4 pt-0 font-sans overflow-y-auto no-scrollbar pb-40">
      <Header title={s.privacy_title} />

      <SectionHeader title={s.privacy_listening_activity} />
      <ToggleRow
        title={s.privacy_private_session}
        desc={s.privacy_private_session_desc}
        isOn={privateSession}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.privacy.privateSession.toggle' },
          {
            params: { to: !privateSession },
            onTrigger: () => updateSettings('privacy', { privateSession: !privateSession }),
          },
        )}
      />
      <InfoText text={`ⓘ ${s.privacy_private_session_info}`} />

      <div className="mt-4">
        <ToggleRow
          title={s.privacy_listening_activity_toggle}
          desc={s.privacy_listening_activity_desc}
          isOn={listeningActivity}
          tapProps={bindTap(
            { kind: 'action', id: 'settings.privacy.listeningActivity.toggle' },
            {
              params: { to: !listeningActivity },
              onTrigger: () => updateSettings('privacy', { shareActivity: !listeningActivity }),
            },
          )}
        />
      </div>

      <ToggleRow
        title={s.privacy_recent_artists}
        desc={s.privacy_recent_artists_desc}
        isOn={recentArtists}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.privacy.recentArtists.toggle' },
          {
            params: { to: !recentArtists },
            onTrigger: () => updateSettings('privacy', { recentArtists: !recentArtists }),
          },
        )}
      />

      <SectionHeader title={s.privacy_playlist_visibility} />
      <ToggleRow
        title={s.privacy_public_playlists}
        desc={s.privacy_public_playlists_desc}
        isOn={publicPlaylists}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.privacy.publicPlaylists.toggle' },
          {
            params: { to: !publicPlaylists },
            onTrigger: () => updateSettings('privacy', { publicPlaylists: !publicPlaylists }),
          },
        )}
      />
      <InfoText text={`ⓘ ${s.privacy_public_playlists_info}`} />

      <div className="mt-4">
        <ToggleRow
          title={s.privacy_profile_playlists}
          desc={s.privacy_profile_playlists_desc}
          isOn={profilePlaylists}
          tapProps={bindTap(
            { kind: 'action', id: 'settings.privacy.profilePlaylists.toggle' },
            {
              params: { to: !profilePlaylists },
              onTrigger: () => updateSettings('privacy', { profilePlaylists: !profilePlaylists }),
            },
          )}
        />
      </div>
      <InfoText text={`ⓘ ${s.privacy_public_playlists_info}`} />
    </div>
  );
};
