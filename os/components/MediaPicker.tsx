/**
 * System Media Picker
 * 
 * A system-level overlay for selecting photos and videos.
 * Used by apps when they need to pick media from the gallery.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { X, Check, ChevronDown, ChevronUp, Film, Image as ImageIcon } from 'lucide-react';
import * as MediaService from '../MediaService';
import { MediaItem, Album, MediaPickerOptions } from '../types';
import { AsyncFsImage } from './AsyncFsImage';

interface MediaPickerProps {
  visible: boolean;
  options: MediaPickerOptions;
}

export const MediaPicker: React.FC<MediaPickerProps> = ({ visible, options }) => {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [currentAlbumId, setCurrentAlbumId] = useState<string>('all');
  const [items, setItems] = useState<MediaItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAlbumList, setShowAlbumList] = useState(false);
  const [previewItem, setPreviewItem] = useState<MediaItem | null>(null);
  
  const maxSelect = options.multiple ? (options.maxSelect || 9) : 1;
  const currentAlbum = albums.find(a => a.id === currentAlbumId);
  
  // Load albums and items when visible
  useEffect(() => {
    if (visible) {
      const loadedAlbums = MediaService.getAlbums();
      setAlbums(loadedAlbums);
      
      const albumId = options.albumId || 'all';
      setCurrentAlbumId(albumId);
      
      const loadedItems = MediaService.getMediaItems({
        albumId,
        type: options.type,
      });
      loadedItems.sort((a, b) => b.createdAt - a.createdAt);
      setItems(loadedItems);
      setSelected(new Set());
      setShowAlbumList(false);
      setPreviewItem(null);
    }
  }, [visible, options]);
  
  // Update items when album changes
  useEffect(() => {
    if (visible && currentAlbumId) {
      const loadedItems = MediaService.getMediaItems({
        albumId: currentAlbumId,
        type: options.type,
      });
      loadedItems.sort((a, b) => b.createdAt - a.createdAt);
      setItems(loadedItems);
    }
  }, [currentAlbumId, visible, options.type]);
  
  const toggleSelect = (item: MediaItem) => {
    const newSelected = new Set(selected);
    
    if (newSelected.has(item.id)) {
      newSelected.delete(item.id);
    } else if (newSelected.size < maxSelect) {
      if (!options.multiple) {
        newSelected.clear();
      }
      newSelected.add(item.id);
    }
    
    setSelected(newSelected);
  };
  
  const handleConfirm = () => {
    const selectedItems = items.filter(i => selected.has(i.id));
    MediaService.completeSelection(selectedItems);
  };
  
  const handleCancel = () => {
    MediaService.cancelSelection();
  };
  
  const selectAlbum = (albumId: string) => {
    setCurrentAlbumId(albumId);
    setShowAlbumList(false);
  };
  
  // Selection order for display
  const selectionOrder = useMemo(() => {
    const order = new Map<string, number>();
    let idx = 1;
    items.forEach(item => {
      if (selected.has(item.id)) {
        order.set(item.id, idx++);
      }
    });
    return order;
  }, [selected, items]);
  
  if (!visible) return null;
  
  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      {/* Header */}
      <div 
        className="pt-10 px-4 pb-3 flex items-center justify-between bg-black/95"
        data-status-bar-foreground="light"
      >
        <button 
          onClick={handleCancel}
          className="w-10 h-10 flex items-center justify-center"
        >
          <X size={24} className="text-white" />
        </button>
        
        <button 
          onClick={() => setShowAlbumList(!showAlbumList)}
          className="flex items-center gap-1 text-white text-[17px] font-medium"
        >
          <span>{currentAlbum?.name || '全部'}</span>
          {showAlbumList ? (
            <ChevronUp size={20} className="text-white/70" />
          ) : (
            <ChevronDown size={20} className="text-white/70" />
          )}
        </button>
        
        <button 
          onClick={handleConfirm}
          disabled={selected.size === 0}
          className={`px-4 py-1.5 rounded-full text-[15px] font-medium transition-colors ${
            selected.size > 0 
              ? 'bg-[#07c160] text-white' 
              : 'bg-white/20 text-white/50'
          }`}
        >
          {selected.size > 0 ? `完成(${selected.size})` : '完成'}
        </button>
      </div>
      
      {/* Album dropdown */}
      {showAlbumList && (
        <div className="absolute top-[88px] left-0 right-0 bg-[#1a1a1a] z-10 max-h-[50vh] overflow-y-auto">
          {albums.map(album => (
            <button
              key={album.id}
              onClick={() => selectAlbum(album.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 active:bg-white/10 ${
                album.id === currentAlbumId ? 'bg-white/5' : ''
              }`}
            >
              {/* Album cover */}
              <div className="w-14 h-14 bg-gray-800 rounded-lg overflow-hidden flex-shrink-0">
                {album.coverPath ? (
                  <AsyncFsImage
                    path={album.coverPath}
                    fallbackSrc={album.coverUri}
                    className="w-full h-full object-cover"
                    alt=""
                  />
                ) : album.coverUri ? (
                  <img src={album.coverUri} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon size={24} className="text-gray-600" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 text-left">
                <div className="text-white text-[16px]">{album.name}</div>
                <div className="text-white/50 text-[13px]">{album.count} 项</div>
              </div>
              
              {album.id === currentAlbumId && (
                <Check size={20} className="text-[#07c160]" />
              )}
            </button>
          ))}
        </div>
      )}
      
      {/* Media Grid */}
      <div 
        className="flex-1 overflow-y-auto"
        onClick={() => showAlbumList && setShowAlbumList(false)}
      >
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-white/50">
            <ImageIcon size={48} className="mb-3" />
            <span>暂无内容</span>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-[2px] p-[2px]">
            {items.map(item => (
              <div
                key={item.id}
                className="aspect-square relative cursor-pointer"
                onClick={() => toggleSelect(item)}
              >
                {/* Thumbnail */}
                <AsyncFsImage
                  path={item.path}
                  fallbackSrc={item.thumbnailUri || item.uri}
                  className="w-full h-full object-cover"
                  alt={item.name}
                />
                
                {/* Video indicator */}
                {item.type === 'video' && (
                  <div className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/50 rounded px-1.5 py-0.5">
                    <Film size={12} className="text-white" />
                    {item.duration && (
                      <span className="text-white text-[11px]">
                        {Math.floor(item.duration / 60)}:{String(item.duration % 60).padStart(2, '0')}
                      </span>
                    )}
                  </div>
                )}
                
                {/* Selection indicator */}
                <div
                  className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full border-2 
                    flex items-center justify-center transition-all
                    ${selected.has(item.id)
                      ? 'bg-[#07c160] border-[#07c160]'
                      : 'border-white/80 bg-black/30'
                    }`}
                >
                  {selected.has(item.id) && (
                    options.multiple ? (
                      <span className="text-white text-[12px] font-medium">
                        {selectionOrder.get(item.id)}
                      </span>
                    ) : (
                      <Check size={14} className="text-white" />
                    )
                  )}
                </div>
                
                {/* Selection overlay */}
                {selected.has(item.id) && (
                  <div className="absolute inset-0 bg-black/20 pointer-events-none" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Bottom bar with info */}
      {selected.size > 0 && options.multiple && (
        <div className="bg-[#1a1a1a] px-4 py-3 flex items-center justify-between border-t border-white/10">
          <span className="text-white/70 text-[14px]">
            已选择 {selected.size} 项
            {maxSelect < 9 && ` (最多 ${maxSelect} 项)`}
          </span>
          <button
            onClick={() => setSelected(new Set())}
            className="text-[#07c160] text-[14px]"
          >
            清除选择
          </button>
        </div>
      )}
      
      {/* Preview overlay */}
      {previewItem && (
        <div 
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
          onClick={() => setPreviewItem(null)}
        >
          <AsyncFsImage
            path={previewItem.path}
            fallbackSrc={previewItem.uri}
            className="max-w-full max-h-full object-contain"
            alt={previewItem.name}
          />
        </div>
      )}
    </div>
  );
};

export default MediaPicker;
