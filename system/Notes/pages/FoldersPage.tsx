import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IcNavBack, IcAdd, IcDelete, IcEdit, IcLock, IcTrash } from '../res/icons';
import { SIMULATOR_CONFIG } from '@/os/data';
const { statusBarHeight, bottomGestureHeight } = SIMULATOR_CONFIG.framework;
import { useShallow } from 'zustand/react/shallow';
import { useNotesStore, selectVisibleNotes, selectPrivateNotes, selectTrashedNotes } from '../state';
import { InputDialog } from '../components/InputDialog';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { colors } from '../res/colors';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import { useNotesGestures } from '../hooks/useNotesGestures';
import { getFolderDisplayName } from '../utils';
import { routes } from '../routes';
const FolderRow: React.FC<{
  name: string;
  count: number;
  active: boolean;
  system?: boolean;
  selectBind: React.HTMLAttributes<HTMLElement>;
  renameBind?: React.HTMLAttributes<HTMLElement>;
  deleteBind?: React.HTMLAttributes<HTMLElement>;
}> = ({ name, count, active, system, selectBind, renameBind, deleteBind }) => {
  const s = useAppStrings(strings, stringsEn);
  return (
    <div
      className="bg-app-surface rounded-[16px] px-5 py-4 shadow-[0_1px_0_rgba(0,0,0,0.04)] mb-3"
      role="group"
    >
      <div className="w-full text-left active:opacity-80" {...selectBind}>
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
              {renameBind ? (
                <button
                  className="w-9 h-9 rounded-full flex items-center justify-center active:bg-black/5"
                  {...renameBind}
                  aria-label={s.action_rename}
                >
                  <IcEdit size={18} className="text-black/60" />
                </button>
              ) : null}
              {deleteBind ? (
                <button
                  className="w-9 h-9 rounded-full flex items-center justify-center active:bg-black/5"
                  {...deleteBind}
                  aria-label={s.action_delete}
                >
                  <IcDelete size={18} className="text-black/60" />
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export const FoldersPage: React.FC = () => {
  const { back, bindNav, bindBack, bindTap } = useNotesGestures();
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

  // Dialogs live in the URL (?dialog=add|rename|delete&folderId=): system back closes them.
  const [searchParams] = useSearchParams();
  const dialog = searchParams.get('dialog');
  const dialogFolder = folders.find(f => f.id === searchParams.get('folderId'));

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
            {...bindNav(routes.folders, { search: { dialog: 'add' } })}
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
              {...bindNav(routes.private)}
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
              {...bindNav(routes.trash)}
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
              selectBind={bindTap({ kind: 'action', id: 'notes.folders.select' }, {
                params: { folderId: f.id },
                onTrigger: () => {
                  setSelectedFolderId(f.id);
                  back();
                },
              })}
              renameBind={f.system ? undefined : bindNav(routes.folders, {
                search: { dialog: 'rename', folderId: f.id }, stopPropagation: true,
              })}
              deleteBind={f.system ? undefined : bindNav(routes.folders, {
                search: { dialog: 'delete', folderId: f.id }, stopPropagation: true,
              })}
            />
          ))}
        </div>
      </div>

      {dialog === 'add' || (dialog === 'rename' && dialogFolder) ? (
        <InputDialog
          key={dialog}
          title={dialog === 'add' ? s.action_new_folder : s.action_rename_folder}
          placeholder={s.confirm_folder_placeholder}
          initialValue={dialog === 'rename' ? dialogFolder?.name ?? '' : ''}
          onCancel={() => back()}
          onConfirm={(value) => {
            if (dialog === 'add') addFolder(value);
            else if (dialogFolder) renameFolder(dialogFolder.id, value);
            back();
          }}
          cancelBind={bindBack()}
          bindConfirm={(value) => dialog === 'add'
            ? bindTap({ kind: 'action', id: 'notes.folders.add.confirm' }, { onTrigger: () => { addFolder(value); back(); } })
            : bindTap({ kind: 'action', id: 'notes.folders.rename.confirm' }, {
              onTrigger: () => { if (dialogFolder) renameFolder(dialogFolder.id, value); back(); },
            })}
        />
      ) : null}

      {dialog === 'delete' && dialogFolder ? (
        <ConfirmDialog
          title={s.dialog_delete_folder_title}
          message={s.confirm_delete_folder_pre + dialogFolder.name + s.confirm_delete_folder_post}
          confirmLabel={s.action_delete}
          danger
          cancelBind={bindBack()}
          confirmBind={bindTap({ kind: 'action', id: 'notes.folders.delete.confirm' }, {
            onTrigger: () => {
              deleteFolder(dialogFolder.id);
              back();
            },
          })}
        />
      ) : null}
    </div>
  );
};

export default FoldersPage;

