export interface NotesFolder {
  id: string;
  name: string;
  /** Built-in folders (cannot be renamed/deleted) */
  system?: boolean;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  updatedAt: number;

  // Lightweight metadata for list rendering
  folderId: string;
  pinned?: boolean;
  locked?: boolean;
  hasVoice?: boolean;
  hasChecklist?: boolean;
  hasImage?: boolean;

  /** “设为私密/解除私密” */
  isPrivate?: boolean;
  /** Soft-delete (回收站) */
  trashedAt?: number;
  /** Reminder time (设置提醒) */
  alarmAt?: number;
}

export interface NotesTodo {
  id: string;
  text: string;
  completed: boolean;
  updatedAt: number;
}

export type NotesViewMode = 'grid' | 'list';

export interface NotesSettings {
  notesViewMode: NotesViewMode;
  showWordCount: boolean;
}
