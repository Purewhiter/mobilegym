import React from 'react';
import { SIMULATOR_CONFIG } from '@/os/data';
const { bottomGestureHeight } = SIMULATOR_CONFIG.framework;
import { colors } from '../res/colors';
import { IcTabNotes } from '../res/icons';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useNotesGestures } from '../hooks/useNotesGestures';
export type NotesTab = 'notes' | 'todo';

export const BottomTabBar: React.FC<{ active: NotesTab }> = ({ active }) => {
  const { go } = useNotesGestures();
  const bottomPad = bottomGestureHeight;
  const s = useAppStrings(strings, stringsEn);

  const Tab: React.FC<{
    tab: NotesTab;
    label: string;
    onClick: () => void;
  }> = ({ tab, label, onClick }) => {
    const isActive = tab === active;
    const labelColor = isActive ? '#000' : colors.text_secondary;
    return (
      <button
        onClick={onClick}
        className="flex flex-col items-center justify-center gap-1 flex-1 h-full active:opacity-70"
        aria-current={isActive ? 'page' : undefined}
      >
        <IcTabNotes tab={tab} active={isActive} size={22} />
        <div className={['text-[12px]', isActive ? 'font-medium' : 'font-normal'].join(' ')} style={{ color: labelColor }}>
          {label}
        </div>
      </button>
    );
  };

  return (
    <div className="absolute left-0 right-0 bottom-0 z-40 bg-white/90 backdrop-blur-xl border-t border-black/5">
      <div className="flex items-center justify-around h-[64px]" style={{ paddingBottom: bottomPad }}>
        <Tab
          tab="notes"
          label={s.notes}
          onClick={() => go('tab.notes')}
        />
        <Tab
          tab="todo"
          label={s.todo}
          onClick={() => go('tab.todo')}
        />
      </div>
    </div>
  );
};

export default BottomTabBar;

