import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { IcNavBack } from '../res/icons';
import { SIMULATOR_CONFIG } from '@/os/data';
const { statusBarHeight, bottomGestureHeight } = SIMULATOR_CONFIG.framework;
import { useShallow } from 'zustand/react/shallow';
import { useNotesStore } from '../state';
import { colors } from '../res/colors';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { useNotesGestures } from '../hooks/useNotesGestures';

function useQueryParam(key: string): string | null {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get(key), [key, search]);
}

export const NotesSettingsPage: React.FC = () => {
  const { bindBack } = useNotesGestures();
  const tab = useQueryParam('tab');
  const { settings, updateSettings } = useNotesStore(
    useShallow(s => ({ settings: s.settings, updateSettings: s.updateSettings }))
  );
  const s = useAppStrings(strings, stringsEn);

  const topPad = statusBarHeight + 18;

  return (
    <div
      className="h-full w-full relative flex flex-col overflow-hidden"
      style={{ backgroundColor: colors.page_bg }}
    >
      {/* Header */}
      <div className="shrink-0" style={{ paddingTop: topPad, backgroundColor: colors.page_bg }}>
        <div className="px-4 pb-2 flex items-center">
          <button
            {...bindBack()}
            className="w-10 h-10 -ml-2 flex items-center justify-center active:opacity-70"
            aria-label={s.action_back}
          >
            <IcNavBack size={24} className="text-black" />
          </button>
          <div className="flex-1 text-[20px] font-medium text-black">{tab === 'todo' ? s.todo_settings : s.settings}</div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5" style={{ paddingBottom: bottomGestureHeight + 20 }}>
        <div className="pt-2">
          <div className="bg-app-surface rounded-[16px] px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
            <div className="text-[14px] font-medium text-black mb-3">{s.settings_section_notes}</div>

            <div className="flex items-center justify-between py-2">
              <div className="text-[15px] text-black">{s.settings_list_view}</div>
              <div className="flex items-center gap-2">
                <button
                  className="h-9 px-4 rounded-[14px] text-[14px] active:opacity-80"
                  style={{
                    backgroundColor: settings.notesViewMode === 'grid' ? '#ededed' : 'transparent',
                    color: settings.notesViewMode === 'grid' ? '#000' : colors.text_secondary,
                  }}
                  onClick={() => updateSettings({ notesViewMode: 'grid' })}
                >
                  {s.settings_grid_double}
                </button>
                <button
                  className="h-9 px-4 rounded-[14px] text-[14px] active:opacity-80"
                  style={{
                    backgroundColor: settings.notesViewMode === 'list' ? '#ededed' : 'transparent',
                    color: settings.notesViewMode === 'list' ? '#000' : colors.text_secondary,
                  }}
                  onClick={() => updateSettings({ notesViewMode: 'list' })}
                >
                  {s.settings_grid_single}
                </button>
              </div>
            </div>

            <div className="h-px bg-black/5 my-2" />

            <div className="flex items-center justify-between py-2">
              <div className="text-[15px] text-black">{s.settings_show_word_count}</div>
              <button
                className="w-12 h-7 rounded-full relative active:opacity-80"
                style={{ backgroundColor: settings.showWordCount ? colors.theme_main : '#d9d9d9' }}
                onClick={() => updateSettings({ showWordCount: !settings.showWordCount })}
                aria-label={s.settings_show_word_count}
              >
                <div
                  className="absolute top-0.5 w-6 h-6 bg-app-surface rounded-full shadow"
                  style={{ left: settings.showWordCount ? '24px' : '2px', transition: 'left 160ms ease' }}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotesSettingsPage;

