import React from 'react';
import { Header, InfoText, RadioRow, SectionHeader, ToggleRow } from '../../components/SettingsComponents';
import { useSpotifyGestures } from '../../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../../hooks/useSpotifyStrings';
import { useSpotifyStore } from '../../state';

export const DataSaverPage: React.FC = () => {
  const { bindTap } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const ds = useSpotifyStore((state) => state.settings.dataSaver);
  const updateSettings = useSpotifyStore((state) => state.updateSettings);

  const saverMode = ds.saverMode;
  const downloadCellular = ds.downloadCellular;
  const downloadAudioOnly = ds.downloadAudioOnly;
  const streamAudioOnly = ds.streamAudioOnly;

  return (
    <div className="flex flex-col h-full bg-app-surface text-white p-4 pt-0 font-sans overflow-y-auto no-scrollbar pb-40">
      <Header title={s.data_saver_title} />

      <SectionHeader title={s.data_saver_section} />
      <div className="text-gray-400 text-xs mb-4 leading-normal">
        {s.data_saver_desc}
      </div>

      <div className="space-y-1">
        <RadioRow
          label={s.data_saver_always_on}
          selected={saverMode === 0}
          tapProps={bindTap(
            { kind: 'action', id: 'settings.dataSaver.mode.select.on' },
            { onTrigger: () => updateSettings('dataSaver', { saverMode: 0 }) },
          )}
        />
        <RadioRow
          label={s.data_saver_auto}
          selected={saverMode === 1}
          tapProps={bindTap(
            { kind: 'action', id: 'settings.dataSaver.mode.select.auto' },
            { onTrigger: () => updateSettings('dataSaver', { saverMode: 1 }) },
          )}
        />
        <div className="text-gray-400 text-xs px-1 -mt-2 mb-2">{s.data_saver_auto_desc}</div>
        <RadioRow
          label={s.data_saver_always_off}
          selected={saverMode === 2}
          tapProps={bindTap(
            { kind: 'action', id: 'settings.dataSaver.mode.select.off' },
            { onTrigger: () => updateSettings('dataSaver', { saverMode: 2 }) },
          )}
        />
      </div>

      <SectionHeader title={s.data_saver_download_streaming} />
      <ToggleRow
        title={s.data_saver_download_cellular}
        desc={s.data_saver_download_cellular_desc}
        isOn={downloadCellular}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.dataSaver.downloadCellular.toggle' },
          { params: { to: !downloadCellular }, onTrigger: () => updateSettings('dataSaver', { downloadCellular: !downloadCellular }) },
        )}
      />
      <ToggleRow
        title={s.data_saver_download_audio_only}
        desc={s.data_saver_download_audio_only_desc}
        isOn={downloadAudioOnly}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.dataSaver.downloadAudioOnly.toggle' },
          { params: { to: !downloadAudioOnly }, onTrigger: () => updateSettings('dataSaver', { downloadAudioOnly: !downloadAudioOnly }) },
        )}
      />
      <ToggleRow
        title={s.data_saver_stream_audio_only}
        desc={s.data_saver_stream_audio_only_desc}
        isOn={streamAudioOnly}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.dataSaver.streamAudioOnly.toggle' },
          { params: { to: !streamAudioOnly }, onTrigger: () => updateSettings('dataSaver', { streamAudioOnly: !streamAudioOnly }) },
        )}
      />
      <InfoText text={`ⓘ ${s.data_saver_bg_info}`} />

      <SectionHeader title={s.data_saver_storage} />
      <div className="px-1 py-2 text-white">
        <div className="flex justify-between text-sm mb-2">
          <span>{s.data_saver_other_apps}</span>
          <span>16.3 GB</span>
        </div>
        <div className="h-1 w-full bg-gray-700 rounded-full flex overflow-hidden">
          <div className="w-3/4 bg-gray-500" />
          <div className="w-1/12 bg-app-accent" />
          <div className="w-1/12 bg-gray-800" />
        </div>
        <div className="flex justify-between text-sm mt-2">
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-app-accent" /><span>Spotify</span></div>
          <span>428 MB</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-gray-800" /><span>{s.data_saver_free}</span></div>
          <span>5.2 GB</span>
        </div>
      </div>
    </div>
  );
};
