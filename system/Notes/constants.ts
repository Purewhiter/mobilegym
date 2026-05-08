import type { NotesFolder } from './types';

export const NOTES_CONSTANTS = {
  storageKey: 'notes',
  autoSaveDelayMs: 800,
  defaultFolderId: 'all',

  folders: [
    { id: 'all', name: '全部', system: true },
    { id: 'call', name: '通话笔记', system: true },
    { id: 'unfiled', name: '未分类', system: true },
  ] as NotesFolder[],

} as const;

