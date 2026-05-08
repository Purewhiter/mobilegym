import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { FSNode } from '@/os/types';
import * as FileSystem from '@/os/FileSystemService';
import { IcCheck, IcFolder, IcFolderAdd, IcNavBack, IcNavForward } from '../res/icons';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import type { TransferOperation } from '../utils/fileOperations';
import * as TimeService from '@/os/TimeService';
import { InputDialog } from './Dialog';

interface TransferSheetProps {
  open: boolean;
  operation: TransferOperation;
  selectedNodes: FSNode[];
  onClose: () => void;
  onConfirm: (destPath: string) => void;
  isCreateFolderOpen: boolean;
  onOpenCreateFolder: () => void;
  onCloseCreateFolder: () => void;
  onCreatedFolder?: () => void;
}

const ROOT_PATH = '/sdcard';
const DISMISS_THRESHOLD = 120;

export const TransferSheet: React.FC<TransferSheetProps> = ({
  open,
  operation,
  selectedNodes,
  onClose,
  onConfirm,
  isCreateFolderOpen,
  onOpenCreateFolder,
  onCloseCreateFolder,
  onCreatedFolder,
}) => {
  const s = useAppStrings(strings, stringsEn);
  const [currentPath, setCurrentPath] = useState(ROOT_PATH);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startY: 0 });
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setCurrentPath(ROOT_PATH);
    setDragOffset(0);
  }, [open]);

  const folders = useMemo(() => {
    if (!open) return [];
    const selectedPaths = selectedNodes
      .filter(node => node.type === 'directory')
      .map(node => node.path);

    return FileSystem.listDirectory(currentPath)
      .filter(item => item.type === 'directory')
      .filter(item => !selectedPaths.some(path => item.path === path || item.path.startsWith(`${path}/`)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [currentPath, open, selectedNodes]);

  const breadcrumbs = useMemo(() => {
    const parts = currentPath.split('/').filter(Boolean);
    const result: { name: string; path: string }[] = [{ name: s.internal_storage_device, path: ROOT_PATH }];
    let path = '';
    parts.forEach((part, index) => {
      if (part === 'sdcard') return;
      path += `/${part}`;
      result.push({ name: part, path: `${index === 0 ? '' : ROOT_PATH}${path}` });
    });
    return result;
  }, [currentPath, s.internal_storage_device]);

  const title = operation === 'copy' ? s.transfer_copy_title : s.transfer_move_title;

  const formatDate = (timestamp: number) => {
    const date = TimeService.fromTimestamp(timestamp);
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  };

  const handleBack = () => {
    if (currentPath === ROOT_PATH) {
      onClose();
      return;
    }
    const parentPath = currentPath.slice(0, currentPath.lastIndexOf('/')) || ROOT_PATH;
    setCurrentPath(parentPath === '' ? ROOT_PATH : parentPath);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    dragRef.current.startY = e.clientY;
    setIsDragging(true);
    barRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dy = e.clientY - dragRef.current.startY;
    const maxOffset = typeof window !== 'undefined' ? window.innerHeight : 1000;
    if (dy > 0) setDragOffset(Math.min(dy, maxOffset));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    barRef.current?.releasePointerCapture(e.pointerId);
    setIsDragging(false);
    if (dragOffset >= DISMISS_THRESHOLD) {
      onClose();
    } else {
      setDragOffset(0);
    }
  };

  const handleCreateFolder = async (name: string) => {
    if (!name) return;
    const path = `${currentPath}/${name}`;
    if (!FileSystem.exists(path)) {
      await FileSystem.createDirectory(path);
      onCreatedFolder?.();
    }
    onCloseCreateFolder();
  };

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="absolute top-10 left-0 right-0 bottom-0 bg-app-surface rounded-t-[24px] px-5 pt-4 pb-6 flex flex-col"
        style={{ transform: `translateY(${dragOffset}px)`, transition: !isDragging ? 'transform var(--app-duration-short) var(--app-easing-decelerate)' : undefined }}
        onPointerMove={handlePointerMove}
        onPointerLeave={e => e.buttons === 0 && handlePointerUp(e)}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          ref={barRef}
          className="flex justify-center pt-2 pb-3 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={handlePointerDown}
        >
          <div className="w-16 h-1 rounded-full bg-gray-300 -mt-1.5" aria-hidden />
        </div>

        <div className="flex items-center justify-between mb-4">
          <button className="w-10 h-10 flex items-center justify-center text-app-text shrink-0" onClick={handleBack}>
            <IcNavBack size={28} />
          </button>
          <span className="text-[24px] font-medium flex-1 text-center truncate px-2">{title}</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              className="w-10 h-10 flex items-center justify-center text-app-text"
              onClick={onOpenCreateFolder}
              aria-label={s.transfer_new_folder}
            >
              <IcFolderAdd size={28} />
            </button>
            <button
              className="w-10 h-10 flex items-center justify-center text-app-text"
              onClick={() => onConfirm(currentPath)}
              aria-label={s.dialog_confirm}
            >
              <IcCheck size={30} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap pb-3">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.path}>
              {index > 0 && <IcNavForward size={15} className="text-gray-300 shrink-0" />}
              <button
                onClick={() => setCurrentPath(crumb.path)}
                className={`px-4 py-2 rounded-full text-[14px] shrink-0 ${
                  index === breadcrumbs.length - 1 ? 'bg-amber-100 text-amber-600 font-medium' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pt-2" data-scroll-container="transfer" data-scroll-direction="vertical">
          {folders.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-300">
              <IcFolder size={64} strokeWidth={1} className="mb-4" />
              <span className="text-[15px]">{s.folder_empty}</span>
            </div>
          ) : (
            <div className="space-y-1">
              {folders.map(folder => (
                <button
                  key={folder.id}
                  onClick={() => setCurrentPath(folder.path)}
                  className="w-full flex items-center gap-4 px-1 py-4 active:bg-gray-50 rounded-xl transition-colors"
                >
                  <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center shrink-0">
                    <IcFolder size={34} className="text-amber-500" fill="currentColor" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="text-[18px] font-semibold text-app-text leading-tight mb-1 truncate">{folder.name}</div>
                    <div className="text-[14px] text-gray-400 flex items-center gap-2">
                      <span>{formatDate(folder.modifiedAt)}</span>
                      <span>|</span>
                      <span>{FileSystem.listDirectory(folder.path).length}{s.item_count_suffix}</span>
                    </div>
                  </div>
                  <IcNavForward size={22} className="text-gray-300 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <InputDialog
        open={isCreateFolderOpen}
        onClose={onCloseCreateFolder}
        title={s.new_folder_title}
        placeholder={s.new_folder_placeholder}
        onConfirm={handleCreateFolder}
        confirmText={s.new_folder_confirm}
      />
    </div>
  );
};
