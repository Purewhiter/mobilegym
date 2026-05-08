import React, { useState, useRef, useCallback, useEffect } from 'react';
import { IcPlayCircle, IcAdd, IcCheck } from '../res/icons';
import { useBilibiliStore } from '../state';
import { useBilibiliGestures } from '../hooks/useBilibiliGestures';
import { realNow } from '../../../os/TimeService';

interface FavToastProps {
  visible: boolean;
  onModify: () => void;
}

export const FavToast: React.FC<FavToastProps> = ({ visible, onModify }) => {
  return (
    <div
      className={`fixed bottom-16 left-0 right-0 z-[200] flex justify-center transition-all duration-300 pointer-events-none ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
    >
      <div className={`bg-[#323232] text-white rounded-lg px-4 py-2.5 mx-4 flex items-center justify-between w-full max-w-sm shadow-lg ${visible ? 'pointer-events-auto' : 'pointer-events-none'}`}>
        <div className="flex items-center gap-2">
          <IcCheck size={16} className="text-green-400" />
          <span className="text-[13px]">已加入"默认收藏夹"</span>
        </div>
        <button
          className="text-app-primary text-[13px] font-medium active:opacity-70"
          onClick={onModify}
        >
          修改收藏夹
        </button>
      </div>
    </div>
  );
};

type SnapPoint = 'closed' | 'half' | 'full';

interface FavSheetProps {
  visible: boolean;
  videoId: string;
  onClose: () => void;
  onCreateFolder: () => void;
  pendingNewFolderId?: string | null;
}

export const FavSheet: React.FC<FavSheetProps> = ({ visible, videoId, onClose, onCreateFolder, pendingNewFolderId }) => {
  const biliUser = useBilibiliStore(s => s.user);
  const setFavFolders = useBilibiliStore(s => s.setFavFolders);
  const folders = biliUser.favoritesFolders || [];

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!visible) return;
    if (pendingNewFolderId) {
      const s = new Set<string>();
      for (const f of folders) {
        if ((f.videoIds || []).includes(videoId)) s.add(f.id);
      }
      s.add(pendingNewFolderId);
      setSelectedIds(s);
    } else {
      setSelectedIds(new Set());
    }
  }, [visible, videoId, pendingNewFolderId]);

  const [snap, setSnap] = useState<SnapPoint>('half');
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ y: 0, snapY: 0, time: 0 });
  const sheetRef = useRef<HTMLDivElement>(null);

  const getSnapY = useCallback((s: SnapPoint): number => {
    const h = window.innerHeight;
    if (s === 'closed') return h;
    if (s === 'half') return h * 0.5;
    return 40;
  }, []);

  const currentY = isDragging ? dragY : getSnapY(snap);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    setIsDragging(true);
    dragStartRef.current = { y: e.clientY, snapY: getSnapY(snap), time: realNow() };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [snap, getSnapY]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const delta = e.clientY - dragStartRef.current.y;
    const newY = Math.max(40, dragStartRef.current.snapY + delta);
    setDragY(newY);
  }, [isDragging]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);

    const endY = dragY;
    const velocity = (e.clientY - dragStartRef.current.y) / Math.max(1, realNow() - dragStartRef.current.time);
    const h = window.innerHeight;

    if (velocity > 0.5 || endY > h * 0.75) {
      setSnap('closed');
      setTimeout(onClose, 300);
    } else if (velocity < -0.5 || endY < h * 0.3) {
      setSnap('full');
    } else {
      setSnap('half');
    }
  }, [isDragging, dragY, onClose]);

  const toggleFolder = (folderId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) next.delete(folderId);
      else next.add(folderId);
      return next;
    });
  };

  const handleDone = () => {
    setFavFolders(videoId, Array.from(selectedIds));
    onClose();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[300]">
      <div
        className="absolute inset-0 bg-black/40"
        style={{ transition: 'opacity 300ms' }}
        onClick={() => {
          setSnap('closed');
          setTimeout(onClose, 300);
        }}
      />
      <div
        ref={sheetRef}
        className="absolute left-0 right-0 bottom-0 bg-white rounded-t-2xl flex flex-col overflow-hidden"
        style={{
          top: `${currentY}px`,
          transition: isDragging ? 'none' : 'top 300ms cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'top',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* drag handle */}
        <div className="flex justify-center py-3 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* "添加到稍后再看" */}
        <div className="flex items-center gap-3 px-4 pb-3 border-b border-gray-100" data-no-drag>
          <IcPlayCircle size={20} className="text-gray-600" />
          <span className="text-[15px] text-gray-800">添加到稍后再看</span>
        </div>

        {/* header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2" data-no-drag>
          <span className="text-[15px] font-medium">选择收藏夹</span>
          <button
            className="flex items-center gap-1 text-[13px] text-gray-500 active:opacity-70"
            onClick={onCreateFolder}
          >
            <IcAdd size={14} />
            <span>新建收藏夹</span>
          </button>
        </div>

        {/* folder list */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4" data-no-drag>
          {folders.map((folder) => {
            const checked = selectedIds.has(folder.id);
            const count = (folder.videoIds || []).length;
            return (
              <div
                key={folder.id}
                className="flex items-center justify-between py-3.5 active:bg-gray-50 cursor-pointer"
                onClick={() => toggleFolder(folder.id)}
              >
                <div>
                  <div className="text-[15px] text-gray-800">{folder.title}</div>
                  <div className="text-[12px] text-gray-400 mt-0.5">
                    {count}个内容 · {folder.isPublic ? '公开' : '私密'}
                  </div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${checked ? 'bg-app-primary border-app-primary' : 'border-gray-300'}`}
                >
                  {checked && <IcCheck size={12} className="text-white" strokeWidth={3} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* done button */}
        <div className="px-4 py-3 pb-safe border-t border-gray-100" data-no-drag>
          <button
            className="w-full py-2.5 text-center text-[15px] font-medium text-gray-800 active:bg-gray-50 rounded-lg"
            onClick={handleDone}
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
