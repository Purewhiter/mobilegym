import React from 'react';
import { Header, SectionHeader, ToggleRow } from '../../components/SettingsComponents';
import { useSpotifyGestures } from '../../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../../hooks/useSpotifyStrings';
import { useSpotifyStore } from '../../state';
import { Slider } from '@/os/components/Slider';

export const PlaybackPage: React.FC = () => {
  const { bindTap } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const pb = useSpotifyStore((state) => state.settings.playback);
  const updateSettings = useSpotifyStore((state) => state.updateSettings);

  const gapless = pb.gapless;
  const automix = pb.automix;
  const crossfade = pb.crossfade;
  const autoplay = pb.autoplay;
  const mono = pb.monoAudio;
  const broadcast = pb.broadcast;

  return (
    <div className="flex flex-col h-full bg-app-surface text-white p-4 pt-0 font-sans overflow-y-auto no-scrollbar pb-40">
      <Header title={s.playback_title} />

      <SectionHeader title={s.playback_transition} />
      <ToggleRow
        title={s.playback_gapless}
        desc={s.playback_gapless_desc}
        isOn={gapless}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.playback.gapless.toggle' },
          { params: { to: !gapless }, onTrigger: () => updateSettings('playback', { gapless: !gapless }) },
        )}
      />
      <ToggleRow
        title={s.playback_automix}
        desc={s.playback_automix_desc}
        isOn={automix}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.playback.automix.toggle' },
          { params: { to: !automix }, onTrigger: () => updateSettings('playback', { automix: !automix }) },
        )}
      />

      <div className="py-3">
        <div className="text-base text-white mb-2">{s.playback_crossfade}</div>
        <div className="text-gray-400 text-xs mb-3">{s.playback_crossfade_desc}</div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-400 w-8">0{s.playback_crossfade_unit}</span>
          <Slider
            min={0}
            max={12}
            step={1}
            value={crossfade}
            onChange={(v) => updateSettings('playback', { crossfade: v })}
            className="flex-1"
            trackClassName="bg-gray-600"
            fillClassName="bg-white"
            thumbClassName="bg-white shadow-md"
          />
          <span className="text-xs text-gray-400 w-8 text-right">12{s.playback_crossfade_unit}</span>
        </div>
      </div>

      <SectionHeader title={s.playback_listening_control} />
      <ToggleRow
        title={s.playback_autoplay}
        desc={s.playback_autoplay_desc}
        isOn={autoplay}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.playback.autoplay.toggle' },
          { params: { to: !autoplay }, onTrigger: () => updateSettings('playback', { autoplay: !autoplay }) },
        )}
      />
      <ToggleRow
        title={s.playback_mono}
        desc={s.playback_mono_desc}
        isOn={mono}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.playback.mono.toggle' },
          { params: { to: !mono }, onTrigger: () => updateSettings('playback', { monoAudio: !mono }) },
        )}
      />
      <ToggleRow
        title={s.playback_broadcast}
        desc={s.playback_broadcast_desc}
        isOn={broadcast}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.playback.broadcast.toggle' },
          { params: { to: !broadcast }, onTrigger: () => updateSettings('playback', { broadcast: !broadcast }) },
        )}
      />

      <SectionHeader title={s.playback_equalizer} />
      <div className="py-3 cursor-pointer">
        <div className="text-base text-white">{s.playback_equalizer}</div>
        <div className="text-gray-400 text-xs mt-1">{s.playback_equalizer_desc}</div>
      </div>
    </div>
  );
};
