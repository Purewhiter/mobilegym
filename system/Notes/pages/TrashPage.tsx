import React, { useMemo, useState } from 'react';
import { IcNavBack, IcReset, IcDelete } from '../res/icons';
import { SIMULATOR_CONFIG } from '@/os/data';
const { statusBarHeight, bottomGestureHeight } = SIMULATOR_CONFIG.framework;
import * as TimeService from '../../../os/TimeService';
import { useNotesStore, selectTrashedNotes } from '../state';
import { ActionSheet } from '../components/ActionSheet';
import { Toast } from '@/os/components/Toast';
import { colors } from '../res/colors';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import type { Note } from '../types';
import { useNotesGestures } from '../hooks/useNotesGestures';
function formatTime(ts: number) {
  const d = TimeService.fromTimestamp(ts);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${y}-${m.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hh}:${mm}`;
}

function snippet(text: string) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

const TrashCard: React.FC<{
  note: Note;
  onOpen: () => void;
  onActions: () => void;
}> = ({ note, onOpen, onActions }) => {
  const s = useAppStrings(strings, stringsEn);
  const title = note.title.trim() || s.untitled;
  const content = snippet(note.content);
  const trashed = typeof note.trashedAt === 'number' ? note.trashedAt : note.updatedAt;

  return (
    <div className="bg-app-surface rounded-[16px] px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] mb-3">
      <div className="flex items-start justify-between gap-3">
        <button className="flex-1 text-left active:opacity-80" onClick={onOpen}>
          <div className="text-[16px] font-medium text-black truncate">{title}</div>
          <div className="mt-2 text-[13px] truncate" style={{ color: colors.text_secondary }}>
            {content || s.no_content}
          </div>
          <div className="mt-3 text-[12px]" style={{ color: colors.text_secondary }}>
            {s.trash_time_prefix}{formatTime(trashed)}
          </div>
        </button>
        <button
          className="w-10 h-10 rounded-full flex items-center justify-center active:bg-black/5"
          onClick={onActions}
          aria-label={s.action_more}
        >
          <IcDelete size={18} className="text-black/60" />
        </button>
      </div>
    </div>
  );
};

export const TrashPage: React.FC = () => {
  const { go, bindBack } = useNotesGestures();
  const trashedNotes = useNotesStore(selectTrashedNotes);
  const restoreNote = useNotesStore(s => s.restoreNote);
  const deleteNoteForever = useNotesStore(s => s.deleteNoteForever);
  const s = useAppStrings(strings, stringsEn);

  const [active, setActive] = useState<Note | null>(null);
  const [toast, setToast] = useState({ message: '', visible: false });

  const topPad = statusBarHeight + 18;

  const items = useMemo(() => {
    if (!active) return [];
    return [
      {
        key: 'restore',
        label: s.action_restore,
        onClick: () => {
          restoreNote(active.id);
          setActive(null);
          setToast({ message: s.toast_restored, visible: true });
          window.setTimeout(() => setToast({ message: '', visible: false }), 1200);
        },
      },
      {
        key: 'delete_forever',
        label: s.action_permanent_delete,
        danger: true,
        onClick: () => {
          const ok = window.confirm(s.confirm_permanent_delete);
          if (!ok) return;
          deleteNoteForever(active.id);
          setActive(null);
          setToast({ message: s.toast_permanent_deleted, visible: true });
          window.setTimeout(() => setToast({ message: '', visible: false }), 1200);
        },
      },
    ];
  }, [active, deleteNoteForever, restoreNote, s]);

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
          <div className="flex-1 text-[20px] font-medium text-black">{s.trash}</div>
          <button
            onClick={() => {
              // Quick action: restore all (best-effort)
              if (!trashedNotes.length) return;
              const ok = window.confirm(s.confirm_restore_all);
              if (!ok) return;
              trashedNotes.forEach(n => restoreNote(n.id));
              setToast({ message: s.toast_all_restored, visible: true });
              window.setTimeout(() => setToast({ message: '', visible: false }), 1200);
            }}
            className="w-10 h-10 flex items-center justify-center active:opacity-70"
            aria-label={s.action_restore_all}
          >
            <IcReset size={22} className="text-black" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5" style={{ paddingBottom: bottomGestureHeight + 20 }}>
        <div className="pt-2">
          {trashedNotes.length ? (
            trashedNotes.map(n => (
              <TrashCard
                key={n.id}
                note={n}
                onOpen={() => go('note.open', { id: n.id })}
                onActions={() => setActive(n)}
              />
            ))
          ) : (
            <div className="h-[60vh] flex items-center justify-center text-[14px]" style={{ color: colors.text_secondary }}>
              {s.empty_trash}
            </div>
          )}
        </div>
      </div>

      <ActionSheet
        visible={!!active}
        title={s.trash}
        cancelLabel={s.action_cancel}
        items={items}
        onClose={() => setActive(null)}
      />

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};

export default TrashPage;

