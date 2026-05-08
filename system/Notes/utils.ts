import type { NotesFolder } from './types';
import { strings } from './res/strings';

export function getFolderDisplayName(
  folder: Pick<NotesFolder, 'id' | 'name' | 'system'>,
  s: typeof strings,
): string {
  if (!folder.system) return folder.name;

  switch (folder.id) {
    case 'all':
      return s.folder_all;
    case 'call':
      return s.folder_call;
    case 'unfiled':
      return s.folder_unfiled;
    default:
      return folder.name;
  }
}
