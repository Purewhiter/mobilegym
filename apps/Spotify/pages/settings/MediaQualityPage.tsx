import React from 'react';
import { Header, InfoText, RadioRow, SectionHeader } from '../../components/SettingsComponents';
import { useSpotifyGestures } from '../../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../../hooks/useSpotifyStrings';
import { useSpotifyStore } from '../../state';

export const MediaQualityPage: React.FC = () => {
  const { bindTap } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const mq = useSpotifyStore((state) => state.settings.mediaQuality);
  const updateSettings = useSpotifyStore((state) => state.updateSettings);

  const wifiQuality = mq.wifiQuality;
  const cellQuality = mq.cellQuality;
  const downloadQuality = mq.downloadQuality;

  const wifiOptions = [
    { value: 'Automatic', id: 'settings.quality.wifi.select.auto', label: s.media_quality_auto },
    { value: 'Low', id: 'settings.quality.wifi.select.low', label: s.media_quality_low },
    { value: 'Normal', id: 'settings.quality.wifi.select.normal', label: s.media_quality_normal },
    { value: 'High', id: 'settings.quality.wifi.select.high', label: s.media_quality_high },
  ];
  const cellOptions = [
    { value: 'Automatic', id: 'settings.quality.cellular.select.auto', label: s.media_quality_auto },
    { value: 'Low', id: 'settings.quality.cellular.select.low', label: s.media_quality_low },
    { value: 'Normal', id: 'settings.quality.cellular.select.normal', label: s.media_quality_normal },
    { value: 'High', id: 'settings.quality.cellular.select.high', label: s.media_quality_high },
  ];
  const downloadOptions = [
    { value: 'Low', id: 'settings.quality.download.select.low', label: s.media_quality_low },
    { value: 'Normal', id: 'settings.quality.download.select.normal', label: s.media_quality_normal },
    { value: 'High', id: 'settings.quality.download.select.high', label: s.media_quality_high },
  ];

  return (
    <div className="flex flex-col h-full bg-app-surface text-white p-4 pt-0 font-sans overflow-y-auto no-scrollbar pb-40">
      <Header title={s.media_quality_title} />

      <SectionHeader title={s.media_quality_audio_streaming} />
      <InfoText text={`ⓘ ${s.media_quality_streaming_info}`} />

      <div className="mt-4 mb-2 px-1 text-white text-base">{s.media_quality_wifi}</div>
      <div className="text-gray-400 text-xs px-1 mb-2">{s.media_quality_wifi_desc}</div>
      <div className="space-y-1 mb-6">
        {wifiOptions.map((option) => (
          <RadioRow
            key={option.id}
            label={option.label}
            selected={wifiQuality === option.value}
            tapProps={bindTap({ kind: 'action', id: option.id }, { onTrigger: () => updateSettings('mediaQuality', { wifiQuality: option.value }) })}
          />
        ))}
        <RadioRow
          label={s.media_quality_very_high}
          selected={wifiQuality === 'Very High'}
          tapProps={bindTap({ kind: 'action', id: 'settings.quality.wifi.select.veryHigh' }, { onTrigger: () => updateSettings('mediaQuality', { wifiQuality: 'Very High' }) })}
          showPremium
        />
        <RadioRow
          label={s.media_quality_lossless}
          selected={wifiQuality === 'Lossless'}
          tapProps={bindTap({ kind: 'action', id: 'settings.quality.wifi.select.lossless' }, { onTrigger: () => updateSettings('mediaQuality', { wifiQuality: 'Lossless' }) })}
          showPremium
        />
      </div>

      <div className="mt-4 mb-2 px-1 text-white text-base">{s.media_quality_cellular}</div>
      <div className="text-gray-400 text-xs px-1 mb-2">{s.media_quality_cellular_desc}</div>
      <div className="space-y-1">
        {cellOptions.map((option) => (
          <RadioRow
            key={option.id}
            label={option.label}
            selected={cellQuality === option.value}
            tapProps={bindTap({ kind: 'action', id: option.id }, { onTrigger: () => updateSettings('mediaQuality', { cellQuality: option.value }) })}
          />
        ))}
        <RadioRow
          label={s.media_quality_very_high}
          selected={cellQuality === 'Very High'}
          tapProps={bindTap({ kind: 'action', id: 'settings.quality.cellular.select.veryHigh' }, { onTrigger: () => updateSettings('mediaQuality', { cellQuality: 'Very High' }) })}
          showPremium
        />
      </div>

      <SectionHeader title={s.media_quality_download} />
      <div className="mt-4 mb-2 px-1 text-white text-base">{s.media_quality_download_quality}</div>
      <div className="space-y-1">
        {downloadOptions.map((option) => (
          <RadioRow
            key={option.id}
            label={option.label}
            selected={downloadQuality === option.value}
            tapProps={bindTap({ kind: 'action', id: option.id }, { onTrigger: () => updateSettings('mediaQuality', { downloadQuality: option.value }) })}
          />
        ))}
        <RadioRow
          label={s.media_quality_very_high}
          selected={downloadQuality === 'Very High'}
          tapProps={bindTap({ kind: 'action', id: 'settings.quality.download.select.veryHigh' }, { onTrigger: () => updateSettings('mediaQuality', { downloadQuality: 'Very High' }) })}
          showPremium
        />
      </div>
    </div>
  );
};
