/**
 * FileManager Zustand Store
 *
 * Clipboard state + actions for file copy/cut/paste operations.
 */
import { createAppStoreWithActions, memoSelector } from '../../os/createAppStore';
import { FSNode } from '../../os/types';
import * as FileSystem from '../../os/FileSystemService';

// ---- Types ----

interface FileManagerState {
  clipboardItems: FSNode[];
  clipboardOperation: 'copy' | 'cut' | null;
}

interface FileManagerActions {
  copy: (items: FSNode[]) => void;
  cut: (items: FSNode[]) => void;
  paste: (destPath: string) => Promise<boolean>;
  clearClipboard: () => void;
}

// ---- Initial state ----

const initialState: FileManagerState = {
  clipboardItems: [],
  clipboardOperation: null,
};

// ---- Store ----

export const useFileManagerStore = createAppStoreWithActions<FileManagerState, FileManagerActions>(
  'file_manager',
  initialState,
  (set, get) => ({
    copy(items: FSNode[]) {
      set({ clipboardItems: items, clipboardOperation: 'copy' });
    },

    cut(items: FSNode[]) {
      set({ clipboardItems: items, clipboardOperation: 'cut' });
    },

    async paste(destPath: string): Promise<boolean> {
      const { clipboardOperation, clipboardItems } = get();
      if (!clipboardOperation || clipboardItems.length === 0) return false;

      try {
        for (const item of clipboardItems) {
          const destFilePath = `${destPath}/${item.name}`;

          if (clipboardOperation === 'copy') {
            if (item.type === 'file') {
              await FileSystem.copyFile(item.path, destFilePath);
            } else {
              // For directories, simplified: create directory at destination
              await FileSystem.createDirectory(destFilePath);
            }
          } else if (clipboardOperation === 'cut') {
            await FileSystem.moveNode(item.path, destFilePath);
          }
        }

        // Clear clipboard after cut operation
        if (clipboardOperation === 'cut') {
          set({ clipboardItems: [], clipboardOperation: null });
        }

        return true;
      } catch (error) {
        console.error('[FileManager] Paste failed:', error);
        return false;
      }
    },

    clearClipboard() {
      set({ clipboardItems: [], clipboardOperation: null });
    },
  }),
);

// ---- Selectors ----

export const selectClipboardHasItems = memoSelector(
  (s: FileManagerState & FileManagerActions) => s.clipboardItems.length,
  (len) => len > 0,
);
