import type { LauncherLayout } from './types';

export function renameLauncherFolder(
  layout: LauncherLayout,
  folderId: string,
  name: string,
): LauncherLayout {
  const nextName = name.trim();
  const folder = layout.folders?.[folderId];
  if (!folder || !nextName || folder.name === nextName) return layout;

  return {
    ...layout,
    folders: {
      ...layout.folders,
      [folderId]: { ...folder, id: folderId, name: nextName },
    },
  };
}
