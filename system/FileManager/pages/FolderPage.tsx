/**
 * Folder Browser Page
 * 
 * Full featured file browser with file operations and unified TopBar
 * Uses URL-based routing for modals and selection mode to support back gesture
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import {
  IcNavForward, IcFolder, IcClose, IcCheck, IcFolderAdd,
  IcFilter, IcList, IcShare, IcMove, IcDelete, IcMoreCircle, IcClipboard
} from '../res/icons';
import { FSNode } from '@/os/types';
import * as FileSystem from '@/os/FileSystemService';
import { useFileManagerStore, selectClipboardHasItems } from '../state';
import { getFileIcon, getFileIconColor, isPdfPreviewableFile, isTextPreviewableFile } from '../utils/fileUtils';
import { InputDialog, FileDetailsDialog, ConfirmDialog, ActionMenu } from '../components/Dialog';
import { TransferSheet } from '../components/TransferSheet';
import { Toast } from '@/os/components/Toast';
import { useFileManagerGestures } from '../hooks/useFileManagerGestures';
import { AsyncImage } from '../components/AsyncImage';
import { CollapsingToolbar, ToolbarIconButton, TOOLBAR_SPACER_HEIGHT } from '@/os/components/CollapsingToolbar';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
import * as TimeService from '@/os/TimeService';
import { transferNodesToDirectory, shareNodesAsImages, type TransferOperation } from '../utils/fileOperations';
export const FolderPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { go, back } = useFileManagerGestures();
  const clipboardItems = useFileManagerStore(s => s.clipboardItems);
  const clipboardOperation = useFileManagerStore(s => s.clipboardOperation);
  const paste = useFileManagerStore(s => s.paste);
  const clearClipboard = useFileManagerStore(s => s.clearClipboard);
  const hasItems = useFileManagerStore(selectClipboardHasItems);
  const s = useAppStrings(strings, stringsEn);
  
  // Parse URL state
  const urlSearchParams = new URLSearchParams(location.search);
  const isSelecting = urlSearchParams.get('mode') === 'select';
  const modal = urlSearchParams.get('modal') as 'delete' | 'more' | 'newFolder' | 'details' | 'rename' | 'transfer' | null;
  const modalItemId = urlSearchParams.get('itemId');
  const transferOperation: TransferOperation = urlSearchParams.get('operation') === 'move' ? 'move' : 'copy';
  const transferDialog = urlSearchParams.get('transferDialog');
  
  // Selection state (local state)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isLongPress = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPressTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Clear selection and reset long press flag when exiting select mode
  useEffect(() => {
    if (!isSelecting) {
      setSelectedIds(new Set());
      isLongPress.current = false;
    }
  }, [isSelecting]);

  const toggleSelect = (itemId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const selectAll = (allIds: string[]) => setSelectedIds(new Set(allIds));
  const clearSelection = () => setSelectedIds(new Set());

  const enterSelectMode = (initialItemId?: string) => {
    if (isSelecting) return;
    isLongPress.current = true;
    if (initialItemId) setSelectedIds(new Set([initialItemId]));
    go('folder.select.enter', {});
  };

  const exitSelectMode = () => {
    isLongPress.current = false;
    back();
  };

  const openModal = (type: 'delete' | 'more' | 'newFolder' | 'details' | 'rename', itemId?: string) => {
    if (type === 'delete') go('folder.modal.delete.open', {});
    else if (type === 'more') go('folder.modal.more.open', {});
    else if (type === 'newFolder') go('folder.modal.newFolder.open', {});
    else if (type === 'details') go('folder.modal.details.open', itemId ? { itemId } : {});
    else if (type === 'rename') go('folder.modal.rename.open', itemId ? { itemId } : {});
  };

  const closeModal = () => back();
  
  // Get path from URL
  const currentPath = searchParams.get('path') || '/sdcard';
  
  const [items, setItems] = useState<FSNode[]>([]);
  const [scrollTop, setScrollTop] = useState(0);
  const [toast, setToast] = useState({ message: '', visible: false });
  const [deleteTargetNodes, setDeleteTargetNodes] = useState<FSNode[]>([]);
  
  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 2000);
  };
  
  // Load directory contents
  const refreshItems = useCallback(() => {
    const contents = FileSystem.listDirectory(currentPath);
    setItems(contents);
  }, [currentPath]);
  
  useEffect(() => {
    refreshItems();
    setScrollTop(0);
  }, [refreshItems]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };
  
  const handleItemClick = (item: FSNode) => {
    if (isLongPress.current) {
      isLongPress.current = false;
      return;
    }
    if (isSelecting) {
      toggleSelect(item.id);
      return;
    }
    if (item.type === 'directory') go('folder.open', { path: item.path });
    else if (isTextPreviewableFile(item)) go('file.text.open', { path: item.path });
    else if (isPdfPreviewableFile(item)) go('file.pdf.open', { path: item.path });
    else if (item.mimeType?.startsWith('image/')) {
      window.__OS__?.startActivity?.({
        action: 'ACTION_VIEW',
        type: item.mimeType,
        data: { stream: item.path },
      });
    }
  };
  
  const handlePointerDown = (item: FSNode) => {
    isLongPress.current = false;
    clearLongPressTimer();
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      enterSelectMode(item.id);
    }, 500);
  };

  const handlePointerUp = () => {
    clearLongPressTimer();
  };
  
  const getSelectedNodes = (): FSNode[] => items.filter(i => selectedIds.has(i.id));

  const openTransferSheet = (operation: TransferOperation) => {
    if (selectedIds.size === 0) return;
    go('folder.modal.transfer.open', { operation }, { mode: modal === 'more' ? 'replace' : 'push' });
  };

  const openTransferCreateFolder = () => {
    go('folder.modal.transfer.newFolder.open');
  };
  
  const handlePaste = async () => {
    const success = await paste(currentPath);
    if (success) { showToast(s.toast_paste_success); refreshItems(); }
    else showToast(s.toast_paste_failed);
  };
  
  const handleDeleteClick = () => {
    const nodes = getSelectedNodes();
    if (nodes.length === 0) return;
    setDeleteTargetNodes(nodes);
    openModal('delete');
  };

  const doDelete = async () => {
    for (const node of deleteTargetNodes) await FileSystem.deleteNode(node.path);
    showToast(`${s.toast_deleted_prefix}${deleteTargetNodes.length}${s.toast_deleted_suffix}`);
    refreshItems();
    closeModal();
    exitSelectMode();
    setDeleteTargetNodes([]);
  };

  const deleteConfirmMessage = useMemo(() => {
    if (deleteTargetNodes.length === 0) return '';
    const hasDirectory = deleteTargetNodes.some(n => n.type === 'directory');
    return hasDirectory ? s.delete_confirm_folder : s.delete_confirm_file;
  }, [deleteTargetNodes, s.delete_confirm_folder, s.delete_confirm_file]);

  // Get target item for modals
  const modalTargetItem = useMemo(() => {
    if (modalItemId) {
      return items.find(i => i.id === modalItemId) || null;
    }
    if (selectedIds.size === 1) {
      const id = Array.from(selectedIds)[0];
      return items.find(i => i.id === id) || null;
    }
    return null;
  }, [modalItemId, selectedIds, items]);

  const handleShowDetails = () => {
    const nodes = getSelectedNodes();
    if (nodes.length !== 1) {
      showToast(s.select_single_item_required);
      return;
    }
    const id = nodes[0].id;
    // Back to base state first (2 steps: more menu + select mode), then open details
    back(2);
    setTimeout(() => go('folder.modal.details.open.fromBase', { itemId: id }), 50);
  };

  const handleRenameClick = () => {
    const nodes = getSelectedNodes();
    if (nodes.length !== 1) {
      showToast(s.select_single_item_required);
      return;
    }
    const id = nodes[0].id;
    // Back to base state first (2 steps: more menu + select mode), then open rename
    back(2);
    setTimeout(() => go('folder.modal.rename.open.fromBase', { itemId: id }), 50);
  };

  const doRename = async (newName: string) => {
    if (!modalTargetItem) return;
    const parentPath = modalTargetItem.path.substring(0, modalTargetItem.path.lastIndexOf('/'));
    const result = await FileSystem.moveNode(modalTargetItem.path, `${parentPath}/${newName}`);
    if (result) { showToast(s.toast_rename_success); refreshItems(); }
    else showToast(s.toast_rename_failed);
    closeModal();
  };

  const handleTransferConfirm = async (destPath: string) => {
    const success = await transferNodesToDirectory(getSelectedNodes(), destPath, transferOperation);
    if (success) {
      showToast(transferOperation === 'copy' ? s.transfer_copy_success : s.transfer_move_success);
      closeModal();
      exitSelectMode();
      refreshItems();
    } else {
      showToast(transferOperation === 'copy' ? s.transfer_copy_failed : s.transfer_move_failed);
    }
  };
  
  const handleNewFolder = async (name: string) => {
    const folderPath = `${currentPath}/${name}`;
    if (FileSystem.exists(folderPath)) { showToast(s.toast_folder_exists); return; }
    await FileSystem.createDirectory(folderPath);
    showToast(s.toast_folder_created);
    closeModal();
    refreshItems();
  };
  
  // Breadcrumbs logic
  const breadcrumbs = useMemo((): { name: string; path: string }[] => {
    const parts = currentPath.split('/').filter(Boolean);
    const result: { name: string; path: string }[] = [{ name: s.internal_storage_device, path: '/sdcard' }];
    let path = '';
    parts.forEach((part, index) => {
      if (part === 'sdcard') return;
      path += '/' + part;
      result.push({ name: part, path: (index === 0 ? '' : '/sdcard') + path });
    });
    return result;
  }, [currentPath, s.internal_storage_device]);

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      clearSelection();
    } else {
      selectAll(items.map(i => i.id));
    }
  };

  const isAllSelected = items.length > 0 && selectedIds.size === items.length;

  const folderName = useMemo(() => {
    const parts = currentPath.split('/').filter(Boolean);
    return parts[parts.length - 1] === 'sdcard' ? s.section_internal_storage : parts[parts.length - 1];
  }, [currentPath]);

  const formatDisplayDate = useCallback((timestamp: number) => {
    const date = TimeService.fromTimestamp(timestamp);
    return `${date.getFullYear()}${s.date_year_suffix}${date.getMonth() + 1}${s.date_month_suffix}${date.getDate()}${s.date_day_suffix}`;
  }, [s.date_day_suffix, s.date_month_suffix, s.date_year_suffix]);

  const handleBack = useCallback(() => {
    back();
  }, [back]);

  const selectionMoreOptions = [
    { label: s.menu_copy, onClick: () => openTransferSheet('copy') },
    { label: s.menu_set_private, onClick: () => { showToast(s.toast_set_private); closeModal(); } },
    { label: s.menu_favorite, onClick: () => { showToast(s.toast_added_to_favorites); closeModal(); } },
    { label: s.menu_rename, onClick: handleRenameClick },
    { label: s.menu_compress, onClick: () => { showToast(s.toast_compressing); closeModal(); } },
    { label: s.menu_add_to_widget, onClick: () => { showToast(s.toast_added); closeModal(); } },
    { label: s.menu_open_with_other_app, onClick: () => { showToast(s.toast_searching_apps); closeModal(); } },
    { label: s.menu_details, onClick: handleShowDetails },
  ];

  return (
    <div className="h-full bg-app-surface flex flex-col relative overflow-hidden">
      <CollapsingToolbar
        title={isSelecting ? (selectedIds.size > 0 ? `${s.selected_prefix}${selectedIds.size}${s.item_count_suffix}` : s.select_items_prompt) : ''}
        alwaysShowSmallTitle
        bgClass="bg-app-surface"
        showBack={!isSelecting}
        onBack={handleBack}
        leftContent={isSelecting ? (
          <button onClick={exitSelectMode} className="w-10 h-10 flex items-center justify-center -ml-2 active:opacity-60">
            <IcClose size={28} className="text-app-text" />
          </button>
        ) : undefined}
        rightContent={isSelecting ? (
          <button onClick={toggleSelectAll} className="w-10 h-10 flex items-center justify-center active:opacity-60">
            <IcList size={28} className={isAllSelected ? 'text-blue-500' : 'text-gray-400'} />
          </button>
        ) : (
          <>
            <ToolbarIconButton icon={IcFolderAdd} onClick={() => openModal('newFolder')} label={s.toolbar_new_folder} />
            <ToolbarIconButton icon={IcFilter} label={s.toolbar_filter} />
          </>
        )}
      />
      
      <div
        className="flex-1 overflow-y-auto no-scrollbar"
        style={{ paddingBottom: isSelecting ? 'var(--app-selection-action-bar-scroll-padding)' : undefined }}
        onScroll={handleScroll}
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        <div style={{ height: TOOLBAR_SPACER_HEIGHT }} />
        {/* Breadcrumbs */}
        <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar whitespace-nowrap">
          {breadcrumbs.map((crumb, index) => (
            <React.Fragment key={crumb.path}>
              {index > 0 && <IcNavForward size={14} className="text-gray-300 shrink-0" />}
              <button
                onClick={() => crumb.path !== currentPath && go('folder.open', { path: crumb.path }, { mode: 'replace' })}
                className={`px-4 py-1.5 rounded-full text-[13px] transition-colors shrink-0 ${
                  index === breadcrumbs.length - 1 ? 'bg-amber-100 text-amber-600 font-medium' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
        
        {/* Clipboard indicator */}
        {hasItems && !isSelecting && (
          <div className="mx-4 my-2 px-4 py-2 bg-blue-50 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] text-blue-700">
              <IcClipboard />
              <span>{clipboardOperation === 'copy' ? s.clipboard_copied : s.clipboard_cut} {clipboardItems.length}{s.item_count_suffix}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePaste} className="px-3 py-1 bg-blue-500 text-white rounded-lg text-[13px] font-medium">{s.clipboard_paste}</button>
              <button onClick={clearClipboard} className="w-7 h-7 flex items-center justify-center text-gray-500"><IcClose size={16} /></button>
            </div>
          </div>
        )}
        
        {/* File list */}
        <div className="mt-2">
          {items.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-gray-300">
              <IcFolder size={64} strokeWidth={1} className="mb-4" />
              <span className="text-[15px]">{s.folder_empty}</span>
            </div>
          ) : (
            <div className="space-y-1">
              {items.map(item => {
                const Icon = getFileIcon(item);
                const iconColor = getFileIconColor(item);
                const isSelected = selectedIds.has(item.id);
                const isCutting = clipboardOperation === 'cut' && clipboardItems.some(i => i.id === item.id);
                const isImage = item.mimeType?.startsWith('image/');
                const triggerId = item.type === 'directory'
                  ? 'folder.open'
                  : isTextPreviewableFile(item)
                    ? 'file.text.open'
                    : isPdfPreviewableFile(item)
                      ? 'file.pdf.open'
                      : undefined;
                const actionAttrs = !triggerId && isImage
                  ? {
                      'data-action': 'file.image.open',
                      'data-action-type': 'open',
                      'data-action-params': JSON.stringify({ path: item.path }),
                    }
                  : undefined;

                return (
                  <button key={item.id} onClick={() => handleItemClick(item)} onContextMenu={(e) => e.preventDefault()} onPointerDown={() => handlePointerDown(item)} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onPointerLeave={handlePointerUp}
                    {...(triggerId ? {
                      'data-trigger': triggerId,
                      'data-trigger-type': 'tap',
                      'data-trigger-params': JSON.stringify({ path: item.path }),
                    } : {})}
                    {...(actionAttrs ?? {})}
                    className={`w-full flex items-center gap-4 px-4 py-3 active:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''} ${isCutting ? 'opacity-50' : ''}`}>
                    <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center shrink-0 overflow-hidden">
                      {isImage ? <AsyncImage path={item.path} className="w-full h-full object-cover" /> : 
                        <Icon size={32} className={iconColor} strokeWidth={1.5} {...(item.type === 'directory' ? { fill: 'currentColor' } : {})} />}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-[16px] font-semibold text-app-text leading-tight mb-1 break-words">{item.name}</div>
                      <div className="text-[13px] text-gray-400 flex items-center gap-2 font-normal">
                        <span>{formatDisplayDate(item.modifiedAt)}</span>
                        <span>|</span>
                        <span>{item.type === 'directory' ? `${FileSystem.listDirectory(item.path).length}${s.item_count_suffix}` : FileSystem.formatFileSize(item.size)}</span>
                      </div>
                    </div>
                    {isSelecting && (
                      <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ml-2 ${isSelected ? 'bg-blue-500 border-blue-500' : 'border-app-border'}`}>
                        {isSelected && <IcCheck size={16} className="text-white" strokeWidth={3} />}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Bottom Action Bar */}
      {isSelecting && (() => {
        const hasSelection = selectedIds.size > 0;
        const actionBtn = `flex flex-col items-center gap-1.5 px-4 transition-opacity ${hasSelection ? 'active:opacity-60' : 'opacity-40'}`;
        return (
        <div
          className="absolute bottom-0 left-0 right-0 bg-app-surface flex items-center justify-around pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] z-40"
          style={{ minHeight: 'var(--app-selection-action-bar-height)' }}
        >
          <button
            disabled={!hasSelection}
            onClick={() => {
              const ok = shareNodesAsImages(getSelectedNodes());
              if (!ok) showToast(s.toast_send_no_image);
            }}
            data-action="folder.select.send"
            data-action-type="open"
            className={actionBtn}
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <IcShare />
            </div>
            <span className="text-[12px] text-app-text">{s.action_send}</span>
          </button>
          <button disabled={!hasSelection} onClick={() => openTransferSheet('move')} className={actionBtn}>
            <div className="w-6 h-6 flex items-center justify-center">
              <IcMove />
            </div>
            <span className="text-[12px] text-app-text">{s.action_move}</span>
          </button>
          <button disabled={!hasSelection} onClick={handleDeleteClick} className={actionBtn}>
            <div className="w-6 h-6 flex items-center justify-center">
              <IcDelete />
            </div>
            <span className="text-[12px] text-app-text">{s.action_delete}</span>
          </button>
          <button disabled={!hasSelection} onClick={() => openModal('more')} className={actionBtn}>
            <div className="w-6 h-6 flex items-center justify-center">
              <IcMoreCircle />
            </div>
            <span className="text-[12px] text-app-text">{s.action_more}</span>
          </button>
        </div>
        );
      })()}
      
      <InputDialog
        open={modal === 'newFolder'}
        onClose={closeModal}
        title={s.new_folder_title}
        placeholder={s.new_folder_placeholder}
        onConfirm={handleNewFolder}
        confirmText={s.new_folder_confirm}
      />

      <ConfirmDialog
        open={modal === 'delete'}
        onClose={() => { closeModal(); setDeleteTargetNodes([]); }}
        title={s.delete_title}
        message={deleteConfirmMessage}
        onConfirm={doDelete}
        confirmText={s.delete_title}
        isDestructive={true}
      />
      
      <ActionMenu 
        open={modal === 'more'} 
        onClose={closeModal} 
        options={selectionMoreOptions} 
      />

      <FileDetailsDialog 
        open={modal === 'details'} 
        onClose={closeModal} 
        file={modalTargetItem} 
      />

      <InputDialog
        open={modal === 'rename'}
        onClose={closeModal}
        title={s.rename_title}
        defaultValue={modalTargetItem?.name}
        onConfirm={doRename}
      />

      <TransferSheet
        open={modal === 'transfer'}
        operation={transferOperation}
        selectedNodes={getSelectedNodes()}
        onClose={closeModal}
        onConfirm={handleTransferConfirm}
        isCreateFolderOpen={transferDialog === 'newFolder'}
        onOpenCreateFolder={openTransferCreateFolder}
        onCloseCreateFolder={back}
        onCreatedFolder={refreshItems}
      />

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
};

export default FolderPage;
