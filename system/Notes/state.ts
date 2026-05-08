import { createAppStoreWithActions, memoSelector } from '../../os/createAppStore';
import { NOTES_CONFIG } from './data';
import * as TimeService from '../../os/TimeService';
import type {
  Note,
  NotesFolder,
  NotesSettings,
  NotesViewMode,
  NotesTodo,
} from './types';

// ---- Helper functions ----

function isTrashed(note: Note): boolean {
  return typeof note.trashedAt === 'number' && Number.isFinite(note.trashedAt);
}

function isPrivate(note: Note): boolean {
  return !!note.isPrivate;
}

function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    const ap = a.pinned ? 1 : 0;
    const bp = b.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return b.updatedAt - a.updatedAt;
  });
}

function sortTodos(todos: NotesTodo[]): NotesTodo[] {
  return [...todos].sort((a, b) => {
    const ac = a.completed ? 1 : 0;
    const bc = b.completed ? 1 : 0;
    if (ac !== bc) return ac - bc;
    return b.updatedAt - a.updatedAt;
  });
}

function sortTrashedNotes(notes: Note[]): Note[] {
  return [...notes]
    .filter(isTrashed)
    .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0));
}

// ---- Types ----

interface NotesState {
  notes: Note[];
  todos: NotesTodo[];
  folders: NotesFolder[];
  selectedFolderId: string;
  settings: NotesSettings;
}

interface NotesActions {
  setSelectedFolderId: (folderId: string) => void;
  addFolder: (name: string) => NotesFolder;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  updateSettings: (patch: Partial<NotesSettings>) => void;
  addNote: (input?: Partial<Pick<Note, 'title' | 'content' | 'folderId'>>) => Note;
  updateNote: (
    id: string,
    patch: Partial<
      Pick<Note, 'title' | 'content' | 'folderId' | 'pinned' | 'locked' | 'isPrivate' | 'trashedAt' | 'alarmAt'>
    >,
  ) => void;
  deleteNote: (id: string) => void;
  restoreNote: (id: string) => void;
  deleteNoteForever: (id: string) => void;
  hideNote: (id: string) => void;
  unhideNote: (id: string) => void;
  addTodo: (text: string) => NotesTodo;
  toggleTodo: (id: string) => void;
  updateTodoText: (id: string, text: string) => void;
  deleteTodo: (id: string) => void;
}

// ---- Store ----

const initialState: NotesState = {
  notes: NOTES_CONFIG.sampleNotes,
  todos: NOTES_CONFIG.sampleTodos,
  folders: [...NOTES_CONFIG.folders],
  selectedFolderId: NOTES_CONFIG.defaultFolderId as string,
  settings: { ...(NOTES_CONFIG.settings as NotesSettings) },
};

export const useNotesStore = createAppStoreWithActions<NotesState, NotesActions>(
  'notes',
  initialState,
  (set, get) => ({
    setSelectedFolderId: (folderId: string) => {
      const ok = get().folders.some(f => f.id === folderId);
      set({ selectedFolderId: ok ? folderId : NOTES_CONFIG.defaultFolderId });
    },

    addFolder: (name: string) => {
      const trimmed = name.trim();
      const newFolder: NotesFolder = {
        id: `xf_${Math.random().toString(36).slice(2, 10)}`,
        name: trimmed || '新建文件夹',
        system: false,
      };
      set(state => ({
        folders: [...state.folders, newFolder],
        selectedFolderId: newFolder.id,
      }));
      return newFolder;
    },

    renameFolder: (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      set(state => ({
        folders: state.folders.map(f => (f.id === id && !f.system ? { ...f, name: trimmed } : f)),
      }));
    },

    deleteFolder: (id: string) => {
      set(state => {
        const target = state.folders.find(f => f.id === id);
        if (!target || target.system) return {};
        return {
          folders: state.folders.filter(f => f.id !== id),
          notes: sortNotes(state.notes.map(n => (n.folderId === id ? { ...n, folderId: 'unfiled' } : n))),
          selectedFolderId: state.selectedFolderId === id ? 'all' : state.selectedFolderId,
        };
      });
    },

    updateSettings: (patch: Partial<NotesSettings>) => {
      set(state => ({ settings: { ...state.settings, ...patch } }));
    },

    addNote: (input?) => {
      const newNote: Note = {
        id: Math.random().toString(36).slice(2, 10),
        title: input?.title ?? '',
        content: input?.content ?? '',
        updatedAt: TimeService.now(),
        folderId: input?.folderId ?? 'unfiled',
      };
      set(state => ({ notes: sortNotes([newNote, ...state.notes]) }));
      return newNote;
    },

    updateNote: (id, patch) => {
      set(state => ({
        notes: sortNotes(state.notes.map(n => (n.id === id ? { ...n, ...patch, updatedAt: TimeService.now() } : n))),
      }));
    },

    deleteNote: (id: string) => {
      const now = TimeService.now();
      set(state => ({
        notes: sortNotes(state.notes.map(n => (n.id === id ? { ...n, trashedAt: now, updatedAt: now } : n))),
      }));
    },

    restoreNote: (id: string) => {
      const now = TimeService.now();
      set(state => ({
        notes: sortNotes(state.notes.map(n => (n.id === id ? { ...n, trashedAt: undefined, updatedAt: now } : n))),
      }));
    },

    deleteNoteForever: (id: string) => {
      set(state => ({ notes: state.notes.filter(n => n.id !== id) }));
    },

    hideNote: (id: string) => {
      const now = TimeService.now();
      set(state => ({
        notes: sortNotes(state.notes.map(n => (n.id === id ? { ...n, isPrivate: true, updatedAt: now } : n))),
      }));
    },

    unhideNote: (id: string) => {
      const now = TimeService.now();
      set(state => ({
        notes: sortNotes(state.notes.map(n => (n.id === id ? { ...n, isPrivate: false, updatedAt: now } : n))),
      }));
    },

    addTodo: (text: string) => {
      const trimmed = text.trim();
      const newTodo: NotesTodo = {
        id: Math.random().toString(36).slice(2, 10),
        text: trimmed,
        completed: false,
        updatedAt: TimeService.now(),
      };
      set(state => ({ todos: sortTodos([newTodo, ...state.todos]) }));
      return newTodo;
    },

    toggleTodo: (id: string) => {
      set(state => ({
        todos: sortTodos(
          state.todos.map(t =>
            t.id === id ? { ...t, completed: !t.completed, updatedAt: TimeService.now() } : t,
          ),
        ),
      }));
    },

    updateTodoText: (id: string, text: string) => {
      const trimmed = text.trim();
      set(state => ({
        todos: sortTodos(
          state.todos.map(t =>
            t.id === id ? { ...t, text: trimmed, updatedAt: TimeService.now() } : t,
          ),
        ),
      }));
    },

    deleteTodo: (id: string) => {
      set(state => ({ todos: state.todos.filter(t => t.id !== id) }));
    },
  }),
);

// ---- Memoized Selectors ----

type NotesStore = NotesState & NotesActions;

export const selectVisibleNotes = memoSelector(
  (s: NotesStore) => s.notes,
  notes => notes.filter(n => !isTrashed(n) && !isPrivate(n)),
);

export const selectPrivateNotes = memoSelector(
  (s: NotesStore) => s.notes,
  notes => notes.filter(n => !isTrashed(n) && isPrivate(n)),
);

export const selectTrashedNotes = memoSelector(
  (s: NotesStore) => s.notes,
  sortTrashedNotes,
);
