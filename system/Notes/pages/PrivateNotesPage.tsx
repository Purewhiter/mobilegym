import React, { useMemo, useState } from 'react';
import { IcNavBack, IcLock, IcMoreVert } from '../res/icons';
import { SIMULATOR_CONFIG } from '@/os/data';
const { statusBarHeight, bottomGestureHeight } = SIMULATOR_CONFIG.framework;
import * as TimeService from '../../../os/TimeService';
import { useNotesStore, selectPrivateNotes } from '../state';
import { ActionSheet } from '../components/ActionSheet';
import { Toast } from '@/os/components/Toast';
import { colors } from '../res/colors';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import type { Note } from '../types';
import { useNotesGestures } from '../hooks/useNotesGestures';

function formatListTime(timestamp: number, s: typeof strings) {
  const d = TimeService.fromTimestamp(timestamp);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const now = TimeService.getDate();

  if (y !== now.getFullYear()) return `${y}${s.date_suffix_year}${m}${s.date_suffix_month}${day}${s.date_suffix_day}`;
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${m}${s.date_suffix_month}${day}${s.date_suffix_day} ${hh}:${mm}`;
}

function snippet(text: string) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

const PrivateCard: React.FC<{
  note: Note;
  onOpen: () => void;
  onActions: () => void;
}> = ({ note, onOpen, onActions }) => {
  const s = useAppStrings(strings, stringsEn);
  const title = note.title.trim() || s.untitled;
  const content = snippet(note.content);

  return (
    <div className="bg-app-surface rounded-[16px] px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] mb-3 break-inside-avoid">
      <div className="flex items-start justify-between gap-3">
        <button className="flex-1 text-left active:opacity-80" onClick={onOpen}>
          <div className="flex items-center gap-2">
            <div className="text-[16px] font-medium text-black truncate">{title}</div>
            <IcLock size={14} className="text-black/40" />
          </div>
          <div className="mt-2 text-[13px] truncate" style={{ color: colors.text_secondary }}>
            {content || s.no_content}
          </div>
          <div className="mt-4 text-[12px]" style={{ color: colors.text_secondary }}>
            {formatListTime(note.updatedAt, s)}
          </div>
        </button>
        <button
          className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
          onClick={onActions}
          aria-label={s.action_more}
        >
          <IcMoreVert size={18} className="text-black/60" />
        </button>
      </div>
    </div>
  );
};

export const PrivateNotesPage: React.FC = () => {
  const { go, bindBack } = useNotesGestures();
  const privateNotes = useNotesStore(selectPrivateNotes);
  const unhideNote = useNotesStore(s => s.unhideNote);
  const deleteNote = useNotesStore(s => s.deleteNote);
  const s = useAppStrings(strings, stringsEn);

  const [active, setActive] = useState<Note | null>(null);
  const [toast, setToast] = useState({ message: '', visible: false });

  const topPad = statusBarHeight + 18;

  const items = useMemo(() => {
    if (!active) return [];
    return [
      {
        key: 'unhide',
        label: s.action_unset_private,
        onClick: () => {
          unhideNote(active.id);
          setActive(null);
          setToast({ message: s.toast_unset_private, visible: true });
          window.setTimeout(() => setToast({ message: '', visible: false }), 1200);
        },
      },
      {
        key: 'delete',
        label: s.action_delete,
        danger: true,
        onClick: () => {
          deleteNote(active.id);
          setActive(null);
          setToast({ message: s.toast_moved_to_trash, visible: true });
          window.setTimeout(() => setToast({ message: '', visible: false }), 1200);
        },
      },
    ];
  }, [active, deleteNote, unhideNote, s]);

  return (
    <div className="h-full w-full relative flex flex-col overflow-hidden" style={{ backgroundColor: colors.page_bg }}>
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
          <div className="flex-1 text-[20px] font-medium text-black">{s.private_notes}</div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5" style={{ paddingBottom: bottomGestureHeight + 20 }}>
        <div className="pt-2">
          {privateNotes.length ? (
            privateNotes.map(n => (
              <PrivateCard
                key={n.id}
                note={n}
                onOpen={() => go('note.open', { id: n.id })}
                onActions={() => setActive(n)}
              />
            ))
          ) : (
            <div className="h-[60vh] flex items-center justify-center text-[14px]" style={{ color: colors.text_secondary }}>
              {s.empty_private}
            </div>
          )}
        </div>
      </div>

      <ActionSheet visible={!!active} title={s.private_notes_title} cancelLabel={s.action_cancel} items={items} onClose={() => setActive(null)} />
      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};

export default PrivateNotesPage;

