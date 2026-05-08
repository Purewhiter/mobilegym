import React, { useEffect, useMemo, useRef, useState } from 'react';
import { IcNavBack, IcCheck, IcFile, IcFolder, IcPhone, IcSearch, IcSettings } from '../res/icons';
import { SIMULATOR_CONFIG } from '@/os/data';
const { statusBarHeight, bottomGestureHeight } = SIMULATOR_CONFIG.framework;
import * as TimeService from '../../../os/TimeService';
import { useShallow } from 'zustand/react/shallow';
import { useNotesStore, selectVisibleNotes } from '../state';
import { BottomTabBar } from '../components/BottomTabBar';
import {
  IcDataItemAudio,
  IcDataItemClock,
  IcDataItemMindOutline,
  IcDataItemStick,
  IcNoteLock,
  IcFab,
} from '../res/icons';
import { ActionSheet } from '../components/ActionSheet';
import { Toast } from '@/os/components/Toast';
import { colors } from '../res/colors';
import { dimens } from '../res/dimens';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '../../../os/useAppStrings';
import type { Note } from '../types';
import { useNotesGestures } from '../hooks/useNotesGestures';
import { getFolderDisplayName } from '../utils';

const NOTE_LONG_PRESS_MS = 520;
const NOTE_LONG_PRESS_MOVE_CANCEL_PX = 12;

function formatListTime(timestamp: number, s: typeof strings) {
  const d = TimeService.fromTimestamp(timestamp);
  const now = TimeService.getDate();

  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();

  if (y !== now.getFullYear()) return `${y}${s.date_suffix_year}${m}${s.date_suffix_month}${day}${s.date_suffix_day}`;

  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  return `${m}${s.date_suffix_month}${day}${s.date_suffix_day} ${hh}:${mm}`;
}

function snippet(text: string) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

const NoteCard: React.FC<{
  note: Note;
  selectionMode: boolean;
  selected: boolean;
  onOpen: () => void;
  onToggleSelected: () => void;
  onLongPress: () => void;
}> = ({ note, selectionMode, selected, onOpen, onToggleSelected, onLongPress }) => {
  const s = useAppStrings(strings, stringsEn);
  const title = note.title.trim() || s.untitled;
  const content = snippet(note.content);
  const isCall = note.folderId === 'call';

  const longPressTimerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const didLongPressRef = useRef(false);

  const clearLongPress = () => {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  useEffect(() => {
    return () => clearLongPress();

  }, []);

  return (
    <div
      className={[
        'relative inline-block w-full bg-app-surface rounded-[16px] px-5 py-4 mb-3 shadow-[0_1px_0_rgba(0,0,0,0.04)] break-inside-avoid',
        selected ? 'outline outline-2' : '',
      ].join(' ')}
      style={selected ? { outlineColor: colors.theme_main } : undefined}
    >
      {selectionMode ? (
        <div className="absolute right-2 top-2 z-10">
          <button
            className="w-9 h-9 rounded-full flex items-center justify-center active:bg-black/5"
            aria-label={selected ? s.action_cancel_select : s.action_select}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelected();
            }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center"
              style={{
                border: `1px solid ${selected ? colors.theme_main : 'rgba(0,0,0,0.18)'}`,
                backgroundColor: selected ? colors.theme_main : '#fff',
              }}
            >
              {selected ? <IcCheck size={14} className="text-white" /> : null}
            </div>
          </button>
        </div>
      ) : null}

      <button
        onClick={(e) => {
          if (didLongPressRef.current) {
            didLongPressRef.current = false;
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (selectionMode) onToggleSelected();
          else onOpen();
        }}
        className="w-full text-left active:scale-[0.99] transition-transform"
        onContextMenu={(e) => {
          // Allow OS/browser context menu elsewhere; this is only for right-click usage.
          e.preventDefault();
        }}
        onPointerDown={(e) => {
          if (selectionMode) return;
          // Only primary mouse button triggers long press
          // (Touch/pen have button=0 typically)
          if (e.pointerType === 'mouse' && e.button !== 0) return;

          didLongPressRef.current = false;
          startPosRef.current = { x: e.clientX, y: e.clientY };
          clearLongPress();
          longPressTimerRef.current = window.setTimeout(() => {
            didLongPressRef.current = true;
            onLongPress();
          }, NOTE_LONG_PRESS_MS);
        }}
        onPointerMove={(e) => {
          if (!startPosRef.current || !longPressTimerRef.current) return;
          const dx = e.clientX - startPosRef.current.x;
          const dy = e.clientY - startPosRef.current.y;
          if (Math.hypot(dx, dy) > NOTE_LONG_PRESS_MOVE_CANCEL_PX) {
            clearLongPress();
          }
        }}
        onPointerUp={() => {
          startPosRef.current = null;
          clearLongPress();
        }}
        onPointerCancel={() => {
          startPosRef.current = null;
          clearLongPress();
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[18px] font-semibold text-black truncate">{title}</div>
            <div className="mt-2 text-[14px] truncate" style={{ color: 'rgba(0,0,0,0.35)' }}>
            {content || s.no_content}
            </div>

            <div className="mt-4 flex items-center gap-2 text-[12px]" style={{ color: colors.text_secondary }}>
              <div className="flex-1 truncate">{formatListTime(note.updatedAt, s)}</div>
              {note.pinned ? <IcDataItemStick size={14} /> : null}
              {note.hasVoice ? <IcDataItemAudio size={14} /> : null}
              {note.hasChecklist ? <IcDataItemMindOutline size={14} /> : null}
              {typeof note.alarmAt === 'number' ? <IcDataItemClock size={14} /> : null}
              {note.locked ? <IcNoteLock size={14} color={colors.text_secondary} /> : null}
            </div>
          </div>

          {isCall ? (
            <div className="shrink-0 text-[#d2d2d2] mt-1">
              <IcPhone size={16} />
            </div>
          ) : null}
        </div>
      </button>
    </div>
  );
};

export const NotesListPage: React.FC = () => {
  const { go } = useNotesGestures();
  const notes = useNotesStore(selectVisibleNotes);
  const { folders, selectedFolderId, setSelectedFolderId, settings, updateNote, deleteNote, hideNote } =
    useNotesStore(
      useShallow(s => ({
        folders: s.folders,
        selectedFolderId: s.selectedFolderId,
        setSelectedFolderId: s.setSelectedFolderId,
        settings: s.settings,
        updateNote: s.updateNote,
        deleteNote: s.deleteNote,
        hideNote: s.hideNote,
      }))
    );
  const s = useAppStrings(strings, stringsEn);
  const [query, setQuery] = useState('');
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [moveNote, setMoveNote] = useState<Note | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(() => new Set());
  const [batchMoveIds, setBatchMoveIds] = useState<string[] | null>(null);
  const [toast, setToast] = useState({ message: '', visible: false });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter(n => {
      const folderOk = selectedFolderId === 'all' || n.folderId === selectedFolderId;
      if (!folderOk) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
      );
    });
  }, [notes, query, selectedFolderId]);

  const noteById = useMemo(() => new Map(notes.map(n => [n.id, n] as const)), [notes]);
  const selectedNotes = useMemo(() => {
    const out: Note[] = [];
    selectedNoteIds.forEach((id) => {
      const n = noteById.get(id);
      if (n) out.push(n);
    });
    return out;
  }, [noteById, selectedNoteIds]);

  const selectedCount = selectedNoteIds.size;
  const allPinned = selectedNotes.length > 0 && selectedNotes.every(n => !!n.pinned);
  const allFilteredSelected = filtered.length > 0 && filtered.every(n => selectedNoteIds.has(n.id));

  useEffect(() => {
    if (selectionMode && selectedNoteIds.size === 0) setSelectionMode(false);
  }, [selectionMode, selectedNoteIds]);

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedNoteIds(new Set());
    setBatchMoveIds(null);
  };

  const startSelection = (noteId: string) => {
    setSelectionMode(true);
    setSelectedNoteIds(new Set([noteId]));
    setActiveNote(null);
    setMoveNote(null);
  };

  const toggleSelected = (noteId: string) => {
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  };

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    window.setTimeout(() => setToast({ message: '', visible: false }), 1200);
  };

  const handleBatchStick = () => {
    if (!selectedNotes.length) return;
    const nextPinned = !allPinned;
    selectedNotes.forEach((n) => updateNote(n.id, { pinned: nextPinned }));
    showToast(nextPinned ? s.toast_pinned : s.toast_unpinned);
    cancelSelection();
  };

  const handleBatchHide = () => {
    if (!selectedNotes.length) return;
    selectedNotes.forEach((n) => hideNote(n.id));
    showToast(s.toast_set_private);
    cancelSelection();
  };

  const handleBatchDelete = () => {
    if (!selectedNotes.length) return;
    selectedNotes.forEach((n) => deleteNote(n.id));
    showToast(s.toast_moved_to_trash);
    cancelSelection();
  };

  const topPad = statusBarHeight + 18;
  const tabBarHeight = 64 + bottomGestureHeight;
  const fabBottom = tabBarHeight + dimens.fab_margin;

  return (
    <div
      className="h-full w-full relative flex flex-col overflow-hidden"
      style={{ backgroundColor: colors.page_bg }}
    >
      {/* Header */}
      <div className="shrink-0" style={{ paddingTop: topPad, backgroundColor: colors.page_bg }}>
        <div className="px-5">
          {selectionMode ? (
            <div className="flex items-center justify-between">
              <button
                className="w-10 h-10 -ml-2 flex items-center justify-center active:opacity-70"
                onClick={cancelSelection}
                aria-label={s.action_cancel}
              >
                <IcNavBack size={24} className="text-black" />
              </button>
              <div className="text-[16px] font-medium text-black">{s.selected_count_prefix}{selectedCount}{s.selected_count_suffix}</div>
              <button
                className="h-10 px-2 -mr-2 text-[14px] font-medium active:opacity-70"
                style={{ color: colors.theme_main }}
                onClick={() => {
                  if (allFilteredSelected) setSelectedNoteIds(new Set());
                  else {
                    setSelectionMode(true);
                    setSelectedNoteIds(new Set(filtered.map(n => n.id)));
                  }
                }}
              >
                {allFilteredSelected ? s.action_deselect_all : s.action_select_all}
              </button>
            </div>
          ) : (
            <>
              <div className="flex justify-end items-center gap-3">
                <button
                  className="w-10 h-10 flex items-center justify-center active:opacity-70"
                  onClick={() => {
                    go('folders.open');
                  }}
                  aria-label={s.folders}
                >
                  <IcFolder size={22} className="text-black" />
                </button>
                <button
                  className="w-10 h-10 flex items-center justify-center active:opacity-70"
                  onClick={() => {
                    go('settings.open');
                  }}
                  aria-label={s.settings}
                >
                  <IcSettings size={22} className="text-black" />
                </button>
              </div>
              <div className="mt-3 text-[36px] leading-none font-medium text-black tracking-tight">{s.notes}</div>

              <div className="mt-4 relative">
                <IcSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#bdbdbd]" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={s.search_placeholder}
                  className="w-full h-10 bg-[#ededed] rounded-[14px] pl-11 pr-4 text-[15px] text-black placeholder:text-[#bdbdbd] outline-none"
                />
              </div>

              <div className="mt-3 flex gap-3 overflow-x-auto no-scrollbar pb-2">
                {folders.map(f => {
                  const active = f.id === selectedFolderId;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setSelectedFolderId(f.id)}
                      className={[
                        'shrink-0 px-4 h-9 rounded-[14px] text-[14px] transition-colors',
                        active ? 'bg-[#ededed] text-black font-medium' : 'bg-app-surface text-app-text-muted',
                      ].join(' ')}
                    >
                      {getFolderDisplayName(f, s)}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-5" style={{ paddingBottom: tabBarHeight + 28 }}>
        {filtered.length ? (
          settings.notesViewMode === 'grid' ? (
            <div className="pt-2 columns-2 gap-3">
              {filtered.map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  selectionMode={selectionMode}
                  selected={selectedNoteIds.has(note.id)}
                  onOpen={() => go('note.open', { id: note.id })}
                  onToggleSelected={() => toggleSelected(note.id)}
                  onLongPress={() => startSelection(note.id)}
                />
              ))}
            </div>
          ) : (
            <div className="pt-2">
              {filtered.map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  selectionMode={selectionMode}
                  selected={selectedNoteIds.has(note.id)}
                  onOpen={() => go('note.open', { id: note.id })}
                  onToggleSelected={() => toggleSelected(note.id)}
                  onLongPress={() => startSelection(note.id)}
                />
              ))}
            </div>
          )
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-[#bdbdbd] pt-10">
            <IcFile size={52} strokeWidth={1.4} className="mb-3 opacity-60" />
            <div className="text-[14px]">{s.empty_notes}</div>
          </div>
        )}
      </div>

      {/* Floating action button */}
      {!selectionMode ? (
        <button
          onClick={() => go('note.new', { id: 'new' })}
          className="absolute rounded-full text-white shadow-2xl flex items-center justify-center active:scale-95 transition-transform"
          style={{
            bottom: fabBottom,
            right: dimens.fab_margin,
            width: dimens.fab_size,
            height: dimens.fab_size,
            backgroundColor: colors.theme_main,
          }}
          aria-label={s.action_new_note}
        >
          <IcFab size={30} />
        </button>
      ) : null}

      {selectionMode ? (
        <div className="absolute left-0 right-0 bottom-0 z-40 bg-white/90 backdrop-blur-xl border-t border-black/5">
          <div className="flex items-center justify-around h-[64px]" style={{ paddingBottom: bottomGestureHeight }}>
            <button
              disabled={!selectedCount}
              onClick={handleBatchStick}
              className="flex-1 h-full flex flex-col items-center justify-center gap-1 text-[12px] font-medium disabled:opacity-35 active:opacity-70"
              style={{ color: colors.text_secondary_strong }}
            >
              {allPinned ? s.action_unpin : s.action_pin}
            </button>
            <button
              disabled={!selectedCount}
              onClick={() => setBatchMoveIds(Array.from(selectedNoteIds))}
              className="flex-1 h-full flex flex-col items-center justify-center gap-1 text-[12px] font-medium disabled:opacity-35 active:opacity-70"
              style={{ color: colors.text_secondary_strong }}
            >
              {s.action_move_to}
            </button>
            <button
              disabled={!selectedCount}
              onClick={handleBatchHide}
              className="flex-1 h-full flex flex-col items-center justify-center gap-1 text-[12px] font-medium disabled:opacity-35 active:opacity-70"
              style={{ color: colors.text_secondary_strong }}
            >
              {s.action_set_private}
            </button>
            <button
              disabled={!selectedCount}
              onClick={handleBatchDelete}
              className="flex-1 h-full flex flex-col items-center justify-center gap-1 text-[12px] font-medium disabled:opacity-35 active:opacity-70"
              style={{ color: '#ff3b30' }}
            >
              {s.action_delete}
            </button>
          </div>
        </div>
      ) : (
        <BottomTabBar active="notes" />
      )}

      {!selectionMode ? (
        <ActionSheet
          visible={!!activeNote}
          title={s.notes}
          cancelLabel={s.action_cancel}
          items={
            activeNote
              ? [
                  {
                    key: 'pin',
                    label: activeNote.pinned ? s.action_unpin : s.action_pin,
                    onClick: () => {
                      updateNote(activeNote.id, { pinned: !activeNote.pinned });
                      setActiveNote(null);
                      showToast(activeNote.pinned ? s.toast_unpinned : s.toast_pinned);
                    },
                  },
                  {
                    key: 'move',
                    label: s.action_move_to,
                    onClick: () => {
                      setMoveNote(activeNote);
                      setActiveNote(null);
                    },
                  },
                  {
                    key: 'hide',
                    label: s.action_set_private,
                    onClick: () => {
                      hideNote(activeNote.id);
                      setActiveNote(null);
                      showToast(s.toast_set_private);
                    },
                  },
                  {
                    key: 'delete',
                    label: s.action_delete,
                    danger: true,
                    onClick: () => {
                      deleteNote(activeNote.id);
                      setActiveNote(null);
                      showToast(s.toast_moved_to_trash);
                    },
                  },
                ]
              : []
          }
          onClose={() => setActiveNote(null)}
        />
      ) : null}

      {/* Move to folder sheet */}
      {!selectionMode && moveNote ? (
        <div className="fixed inset-0 z-[80]">
          <button
            className="absolute inset-0 bg-black/35"
            onClick={() => setMoveNote(null)}
            aria-label={s.action_close}
          />
          <div className="absolute left-0 right-0 bottom-0 bg-app-surface rounded-t-[24px] overflow-hidden">
            <div className="px-5 py-4 text-[14px] font-medium text-black">{s.action_move_to}</div>
            <div className="px-3 pb-3">
              {folders
                .filter(f => f.id !== 'all')
                .map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      updateNote(moveNote.id, { folderId: f.id });
                      setMoveNote(null);
                      setToast({ message: s.toast_moved_to_prefix + getFolderDisplayName(f, s) + s.toast_moved_to_suffix, visible: true });
                      window.setTimeout(() => setToast({ message: '', visible: false }), 1200);
                    }}
                    className="w-full flex items-center justify-between px-3 h-12 rounded-[14px] active:bg-black/5"
                  >
                    <div className="text-[15px] text-black">{getFolderDisplayName(f, s)}</div>
                    <div className="w-5 h-5" />
                  </button>
                ))}
              <div className="h-2" />
              <button
                className="w-full h-12 rounded-[14px] bg-[#f3f3f3] text-[15px] active:opacity-80"
                style={{ color: colors.text_secondary_strong }}
                onClick={() => setMoveNote(null)}
              >
                {s.action_cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Batch move sheet */}
      {batchMoveIds ? (
        <div className="fixed inset-0 z-[80]">
          <button
            className="absolute inset-0 bg-black/35"
            onClick={() => setBatchMoveIds(null)}
            aria-label={s.action_close}
          />
          <div className="absolute left-0 right-0 bottom-0 bg-app-surface rounded-t-[24px] overflow-hidden">
            <div className="px-5 py-4 text-[14px] font-medium text-black">{s.action_move_to}</div>
            <div className="px-3 pb-3">
              {folders
                .filter(f => f.id !== 'all')
                .map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      batchMoveIds.forEach((id) => updateNote(id, { folderId: f.id }));
                      setBatchMoveIds(null);
                      showToast(s.toast_moved_to_prefix + getFolderDisplayName(f, s) + s.toast_moved_to_suffix);
                      cancelSelection();
                    }}
                    className="w-full flex items-center justify-between px-3 h-12 rounded-[14px] active:bg-black/5"
                  >
                    <div className="text-[15px] text-black">{getFolderDisplayName(f, s)}</div>
                    <div className="w-5 h-5" />
                  </button>
                ))}
              <div className="h-2" />
              <button
                className="w-full h-12 rounded-[14px] bg-[#f3f3f3] text-[15px] active:opacity-80"
                style={{ color: colors.text_secondary_strong }}
                onClick={() => setBatchMoveIds(null)}
              >
                {s.action_cancel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};

export default NotesListPage;

