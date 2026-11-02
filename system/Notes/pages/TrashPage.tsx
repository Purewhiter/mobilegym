import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcNavBack, IcReset, IcDelete } from '../res/icons';
import { SIMULATOR_CONFIG } from '@/os/data';
const { statusBarHeight, bottomGestureHeight } = SIMULATOR_CONFIG.framework;
import * as TimeService from '../../../os/TimeService';
import { useNotesStore, selectTrashedNotes } from '../state';
import { ActionSheet } from '../components/ActionSheet';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Toast } from '@/os/components/Toast';
import { colors } from '../res/colors';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import type { Note } from '../types';
import { useNotesGestures } from '../hooks/useNotesGestures';
import { routes } from '../routes';
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
  openBind: React.ButtonHTMLAttributes<HTMLButtonElement>;
  actionsBind: React.HTMLAttributes<HTMLElement>;
}> = ({ note, openBind, actionsBind }) => {
  const s = useAppStrings(strings, stringsEn);
  const title = note.title.trim() || s.untitled;
  const content = snippet(note.content);
  const trashed = typeof note.trashedAt === 'number' ? note.trashedAt : note.updatedAt;

  return (
    <div className="bg-app-surface rounded-[16px] px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] mb-3">
      <div className="flex items-start justify-between gap-3">
        <button className="flex-1 text-left active:opacity-80" {...openBind}>
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
          {...actionsBind}
          aria-label={s.action_more}
        >
          <IcDelete size={18} className="text-black/60" />
        </button>
      </div>
    </div>
  );
};

export const TrashPage: React.FC = () => {
  const { bindNav, bindBack, bindTap, back } = useNotesGestures();
  const trashedNotes = useNotesStore(selectTrashedNotes);
  const restoreNote = useNotesStore(s => s.restoreNote);
  const deleteNoteForever = useNotesStore(s => s.deleteNoteForever);
  const s = useAppStrings(strings, stringsEn);

  // The note's action sheet and the confirmations live in the URL
  // (?sheet=actions&noteId=, ?dialog=deleteForever&noteId=, ?dialog=restoreAll).
  const [searchParams] = useSearchParams();
  const sheet = searchParams.get('sheet');
  const dialog = searchParams.get('dialog');
  const active = trashedNotes.find(n => n.id === searchParams.get('noteId')) ?? null;
  const [toast, setToast] = useState({ message: '', visible: false });
  const showToast = (message: string) => {
    setToast({ message, visible: true });
    window.setTimeout(() => setToast({ message: '', visible: false }), 1200);
  };

  const topPad = statusBarHeight + 18;

  const items = active ? [
    {
      key: 'restore',
      label: s.action_restore,
      bind: bindTap({ kind: 'action', id: 'notes.trash.restore' }, {
        onTrigger: () => {
          restoreNote(active.id);
          back();
          showToast(s.toast_restored);
        },
      }),
    },
    {
      key: 'delete_forever',
      label: s.action_permanent_delete,
      danger: true,
      // The confirmation replaces the sheet: back from it returns to the list.
      bind: bindNav(routes.trash, { search: { dialog: 'deleteForever', noteId: active.id }, replace: true }),
    },
  ] : [];

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
            {...(trashedNotes.length ? bindNav(routes.trash, { search: { dialog: 'restoreAll' } }) : {})}
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
                openBind={bindNav(routes.note, { params: { id: n.id } })}
                actionsBind={bindNav(routes.trash, { search: { sheet: 'actions', noteId: n.id } })}
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
        visible={sheet === 'actions' && !!active}
        title={s.trash}
        cancelLabel={s.action_cancel}
        items={items}
        onClose={() => back()}
        closeBind={bindBack()}
      />

      {dialog === 'deleteForever' && active ? (
        <ConfirmDialog
          title={s.action_permanent_delete}
          message={s.confirm_permanent_delete}
          confirmLabel={s.action_delete}
          danger
          cancelBind={bindBack()}
          confirmBind={bindTap({ kind: 'action', id: 'notes.trash.deleteForever.confirm' }, {
            onTrigger: () => {
              deleteNoteForever(active.id);
              back();
              showToast(s.toast_permanent_deleted);
            },
          })}
        />
      ) : null}

      {dialog === 'restoreAll' ? (
        <ConfirmDialog
          title={s.action_restore_all}
          message={s.confirm_restore_all}
          confirmLabel={s.action_restore}
          cancelBind={bindBack()}
          confirmBind={bindTap({ kind: 'action', id: 'notes.trash.restoreAll.confirm' }, {
            onTrigger: () => {
              trashedNotes.forEach(n => restoreNote(n.id));
              back();
              showToast(s.toast_all_restored);
            },
          })}
        />
      ) : null}

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};

export default TrashPage;

