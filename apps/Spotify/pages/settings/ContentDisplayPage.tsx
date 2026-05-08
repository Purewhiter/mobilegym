import React from 'react';
import { Header, InfoText, SectionHeader, ToggleRow } from '../../components/SettingsComponents';
import { useSpotifyGestures } from '../../hooks/useSpotifyGestures';
import { useSpotifyStrings } from '../../hooks/useSpotifyStrings';
import { useSpotifyStore } from '../../state';

export const ContentDisplayPage: React.FC = () => {
  const { bindTap } = useSpotifyGestures();
  const s = useSpotifyStrings();
  const cd = useSpotifyStore((state) => state.settings.contentDisplay);
  const updateSettings = useSpotifyStore((state) => state.updateSettings);

  const reduceMotion = cd.reduceMotion;
  const canvas = cd.canvas;
  const explicit = cd.explicit;
  const unavailable = cd.unavailable;
  const createBtn = cd.createBtn;

  return (
    <div className="flex flex-col h-full bg-app-surface text-white p-4 pt-0 font-sans overflow-y-auto no-scrollbar pb-40">
      <Header title={s.settings_content_display} />

      <SectionHeader title={s.content_preferences} />
      <ToggleRow
        title={s.content_reduce_motion}
        desc={s.content_reduce_motion_desc}
        isOn={reduceMotion}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.content.reduceMotion.toggle' },
          { params: { to: !reduceMotion }, onTrigger: () => updateSettings('contentDisplay', { reduceMotion: !reduceMotion }) },
        )}
      />
      <ToggleRow
        title={s.content_canvas}
        desc={s.content_canvas_desc}
        isOn={canvas}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.content.canvas.toggle' },
          { params: { to: !canvas }, onTrigger: () => updateSettings('contentDisplay', { canvas: !canvas }) },
        )}
      />
      <ToggleRow
        title={s.content_explicit}
        desc={s.content_explicit_desc}
        isOn={explicit}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.content.explicit.toggle' },
          { params: { to: !explicit }, onTrigger: () => updateSettings('contentDisplay', { explicit: !explicit }) },
        )}
      />
      <InfoText text={`ⓘ ${s.content_explicit_info}`} />

      <div className="mt-4">
        <ToggleRow
          title={s.content_unavailable}
          desc={s.content_unavailable_desc}
          isOn={unavailable}
          tapProps={bindTap(
            { kind: 'action', id: 'settings.content.unavailable.toggle' },
            { params: { to: !unavailable }, onTrigger: () => updateSettings('contentDisplay', { unavailable: !unavailable }) },
          )}
        />
      </div>

      <SectionHeader title={s.content_display_preferences} />
      <ToggleRow
        title={s.content_create_button}
        desc={s.content_create_button_desc}
        isOn={createBtn}
        tapProps={bindTap(
          { kind: 'action', id: 'settings.content.createButton.toggle' },
          { params: { to: !createBtn }, onTrigger: () => updateSettings('contentDisplay', { createBtn: !createBtn }) },
        )}
      />
    </div>
  );
};
