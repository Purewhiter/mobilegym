import React from 'react';
import { useLocale } from '@/os/locale';
import { AppRow, Header, SectionHeader, ToggleRow } from '../../components/SettingsComponents';
import { useSpotifyGestures } from '../../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../../hooks/useSpotifyStrings';
import { useSpotifyStore } from '../../state';

const GoogleMapIcon = 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Google_Maps_icon_%282020%29.svg/240px-Google_Maps_icon_%282020%29.svg.png';
const WazeIcon = 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Waze_logo_2020.svg/240px-Waze_logo_2020.svg.png';

export const AppsDevicesPage: React.FC = () => {
  const locale = useLocale();
  const isEnglish = locale === 'en';
  const { bindTap } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const ad = useSpotifyStore((state) => state.settings.appsDevices);
  const updateSettings = useSpotifyStore((state) => state.updateSettings);

  const voiceAssistant = ad.voiceAssistant;
  const connectControl = ad.connectControl;
  const localVisibility = ad.localVisibility;
  const localFiles = ad.localFiles;

  return (
    <div className="flex flex-col h-full bg-app-surface text-white p-4 pt-0 font-sans overflow-y-auto no-scrollbar pb-40">
      <Header title={s.apps_devices_title} />

      <SectionHeader title={s.apps_connected} />
      <div className="pr-4">
        <AppRow iconSrc={GoogleMapIcon} name={isEnglish ? 'Google Maps' : 'Google 地图'} />
        <div className="text-gray-400 text-xs mb-4 leading-normal">{s.apps_google_maps_desc}</div>

        <AppRow iconSrc={WazeIcon} name="Waze" />
        <div className="text-gray-400 text-xs mb-4 leading-normal">{s.apps_waze_desc}</div>
      </div>

      <div className="mt-4">
        <div className="text-white font-bold text-base mb-2">{s.apps_voice_suggestions}</div>
        <ToggleRow
          title={s.apps_voice_suggestions}
          desc={s.apps_voice_suggestions_desc}
          isOn={voiceAssistant}
          tapProps={bindTap(
            { kind: 'action', id: 'settings.apps.voiceAssistant.toggle' },
            {
              params: { to: !voiceAssistant },
              onTrigger: () => updateSettings('appsDevices', { voiceAssistant: !voiceAssistant }),
            },
          )}
        />
      </div>

      <SectionHeader title={s.apps_other_devices} />
      <ToggleRow
        title={s.apps_connect_control}
        desc={s.apps_connect_control_desc}
        isOn={connectControl}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.apps.connectControl.toggle' },
          {
            params: { to: !connectControl },
            onTrigger: () => updateSettings('appsDevices', { connectControl: !connectControl }),
          },
        )}
      />
      <ToggleRow
        title={s.apps_local_visibility}
        desc={s.apps_local_visibility_desc}
        isOn={localVisibility}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.apps.localVisibility.toggle' },
          {
            params: { to: !localVisibility },
            onTrigger: () => updateSettings('appsDevices', { localVisibility: !localVisibility }),
          },
        )}
      />
      <ToggleRow
        title={s.apps_local_files}
        desc={s.apps_local_files_desc}
        isOn={localFiles}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.apps.localFiles.toggle' },
          {
            params: { to: !localFiles },
            onTrigger: () => updateSettings('appsDevices', { localFiles: !localFiles }),
          },
        )}
      />
    </div>
  );
};
