import React, { useMemo, useState } from 'react';
import { IcNavBack, IcAdd, IcDelete, IcEdit, IcLock, IcTrash } from '../res/icons';
import { SIMULATOR_CONFIG } from '@/os/data';
const { statusBarHeight, bottomGestureHeight } = SIMULATOR_CONFIG.framework;
import { useShallow } from 'zustand/react/shallow';
import { useNotesStore, selectVisibleNotes, selectPrivateNotes, selectTrashedNotes } from '../state';
import { InputDialog } from '../components/InputDialog';
import { colors } from '../res/colors';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { useNotesGestures } from '../hooks/useNotesGestures';
import { getFolderDisplayName } from '../utils';
const FolderRow: React.FC<{
  name: string;
  count: number;
  active: boolean;
  system?: boolean;
  onSelect: () => void;
  onRename?: () => void;
  onDelete?: () => void;
}> = ({ name, count, active, system, onSelect, onRename, onDelete }) => {
  const s = useAppStrings(strings, stringsEn);
  return (
    <div
      className="bg-app-surface rounded-[16px] px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] mb-3"
      role="group"
    >
      <button className="w-full text-left active:opacity-80" onClick={onSelect}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[16px] font-medium text-black truncate">
              {name}
              {active ? <span className="ml-2 text-[12px]" style={{ color: colors.theme_main }}>{s.current_folder}</span> : null}
            </div>
            <div className="mt-1 text-[12px]" style={{ color: colors.text_secondary }}>
              {count} {s.note_count_suffix}
            </div>
          </div>

          {!system ? (
            <div className="shrink-0 flex items-center gap-2">
              {onRename ? (
                <button
                  className="w-9 h-9 rounded-full flex items-center justify-center active:bg-black/5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRename();
                  }}
                  aria-label={s.action_rename}
                >
                  <IcEdit size={18} className="text-black/60" />
                </button>
              ) : null}
              {onDelete ? (
                <button
                  className="w-9 h-9 rounded-full flex items-center justify-center active:bg-black/5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  aria-label={s.action_delete}
                >
                  <IcDelete size={18} className="text-black/60" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </button>
    </div>
  );
};

export const FoldersPage: React.FC = () => {
  const { back, go, bindBack } = useNotesGestures();
  const notes = useNotesStore(selectVisibleNotes);
  const privateNotes = useNotesStore(selectPrivateNotes);
  const trashedNotes = useNotesStore(selectTrashedNotes);
  const {
    folders,
    selectedFolderId,
    setSelectedFolderId,
    addFolder,
    renameFolder,
    deleteFolder,
  } = useNotesStore(
    useShallow(s => ({
      folders: s.folders,
      selectedFolderId: s.selectedFolderId,
      setSelectedFolderId: s.setSelectedFolderId,
      addFolder: s.addFolder,
      renameFolder: s.renameFolder,
      deleteFolder: s.deleteFolder,
    }))
  );
  const s = useAppStrings(strings, stringsEn);

  const [dialog, setDialog] = useState<null | { mode: 'add' | 'rename'; folderId?: string; initial?: string }>(null);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of folders) map.set(f.id, 0);
    map.set('all', notes.length);
    for (const n of notes) map.set(n.folderId, (map.get(n.folderId) ?? 0) + 1);
    return map;
  }, [folders, notes]);

  const topPad = statusBarHeight + 18;

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
          <div className="flex-1 text-[20px] font-medium text-black">{s.folders}</div>
          <button
            onClick={() => setDialog({ mode: 'add' })}
            className="w-10 h-10 flex items-center justify-center active:opacity-70"
            aria-label={s.action_new_folder}
          >
            <IcAdd size={22} className="text-black" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5" style={{ paddingBottom: bottomGestureHeight + 20 }}>
        <div className="pt-2">
          <div className="bg-app-surface rounded-[16px] px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] mb-3">
            <button
              className="w-full flex items-center justify-between active:opacity-80"
              onClick={() => go('private.open')}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-black/5 flex items-center justify-center">
                  <IcLock size={18} className="text-black/60" />
                </div>
                <div className="text-[15px] text-black">{s.label_private}</div>
              </div>
              <div className="text-[12px]" style={{ color: colors.text_secondary }}>
                {privateNotes.length}
              </div>
            </button>
            <div className="h-px bg-black/5 my-3" />
            <button
              className="w-full flex items-center justify-between active:opacity-80"
              onClick={() => go('trash.open')}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-black/5 flex items-center justify-center">
                  <IcTrash size={18} className="text-black/60" />
                </div>
                <div className="text-[15px] text-black">{s.trash}</div>
              </div>
              <div className="text-[12px]" style={{ color: colors.text_secondary }}>
                {trashedNotes.length}
              </div>
            </button>
          </div>

          {folders.map((f) => (
            <FolderRow
              key={f.id}
              name={getFolderDisplayName(f, s)}
              count={counts.get(f.id) ?? 0}
              active={selectedFolderId === f.id}
              system={f.system}
              onSelect={() => {
                setSelectedFolderId(f.id);
                back();
              }}
              onRename={
                f.system
                  ? undefined
                  : () => setDialog({ mode: 'rename', folderId: f.id, initial: f.name })
              }
              onDelete={
                f.system
                  ? undefined
                  : () => {
                      const ok = window.confirm(s.confirm_delete_folder_pre + f.name + s.confirm_delete_folder_post);
                      if (!ok) return;
                      deleteFolder(f.id);
                    }
              }
            />
          ))}
        </div>
      </div>

      {dialog ? (
        <InputDialog
          title={dialog.mode === 'add' ? s.action_new_folder : s.action_rename_folder}
          placeholder={s.confirm_folder_placeholder}
          initialValue={dialog.initial ?? ''}
          onCancel={() => setDialog(null)}
          onConfirm={(value) => {
            if (dialog.mode === 'add') {
              addFolder(value);
              setDialog(null);
              return;
            }
            if (dialog.mode === 'rename' && dialog.folderId) {
              renameFolder(dialog.folderId, value);
              setDialog(null);
            }
          }}
        />
      ) : null}
    </div>
  );
};

export default FoldersPage;

