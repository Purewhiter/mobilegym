/**
 * Category Page
 * 
 * Shows files filtered by category (images, videos, audio, documents)
 */
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { IcNavBack, IcFile, IcVideo } from '../res/icons';
import { FSNode } from '../../../os/types';
import * as FileSystem from '../../../os/FileSystemService';
import { AsyncImage } from '../components/AsyncImage';
import { getFileIcon, getFileIconColor } from '../utils/fileUtils';
import { useFileManagerGestures } from '../hooks/useFileManagerGestures';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useAppStrings } from '@/os/useAppStrings';
export const CategoryPage: React.FC = () => {
  const { category } = useParams<{ category: string }>();
  const { bindBack } = useFileManagerGestures();
  const [items, setItems] = useState<FSNode[]>([]);
  const s = useAppStrings(strings, stringsEn);

  const categoryInfo = {
    images: { name: s.category_images, mimePrefix: 'image/' },
    videos: { name: s.category_videos, mimePrefix: 'video/' },
    audio: { name: s.category_audio_alt, mimePrefix: 'audio/' },
    documents: { name: s.category_documents, mimePrefix: 'application/' },
  }[category || ''] || { name: s.category_files, mimePrefix: '' };
  
  useEffect(() => {
    let files: FSNode[];
    
    if (category === 'images') {
      files = FileSystem.getMediaFiles('image');
    } else if (category === 'videos') {
      files = FileSystem.getMediaFiles('video');
    } else if (category === 'audio') {
      files = FileSystem.getMediaFiles('audio');
    } else {
      files = FileSystem.searchFiles('', { mimeType: categoryInfo.mimePrefix, type: 'file' });
    }
    
    setItems(files);
  }, [category, categoryInfo.mimePrefix]);
  
  return (
    <div className="h-full bg-app-surface flex flex-col">
      {/* Header */}
      <div className="pt-10 px-4 pb-3 flex items-center gap-3 border-b border-gray-100">
        <button 
          {...bindBack()}
          className="w-10 h-10 flex items-center justify-center -ml-2"
        >
          <IcNavBack size={28} className="text-app-text" />
        </button>
        <div className="flex-1">
          <h1 className="text-[18px] font-semibold text-app-text">{categoryInfo.name}</h1>
          <span className="text-[13px] text-gray-500">{items.length}{s.fm_file_count_suffix}</span>
        </div>
      </div>
      
      {/* File grid */}
      <div 
        className="flex-1 overflow-y-auto"
        data-scroll-container="main"
        data-scroll-direction="vertical"
      >
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <IcFile size={48} className="mb-3" />
            <span>{s.category_empty_prefix}{categoryInfo.name}</span>
          </div>
        ) : category === 'images' || category === 'videos' ? (
          // Grid view for media
          <div className="grid grid-cols-4 gap-(--app-grid-gap) p-[2px]">
            {items.map(item => {
              const isImage = item.mimeType?.startsWith('image/');
              return (
                <div
                  key={item.id}
                  className="aspect-square bg-gray-100 relative active:opacity-70"
                  onClick={() => {
                    if (isImage) {
                      window.__OS__?.startActivity?.({
                        action: 'ACTION_VIEW',
                        type: item.mimeType,
                        data: { stream: item.path },
                      });
                    }
                  }}
                  {...(isImage ? {
                    'data-action': 'file.image.open',
                    'data-action-type': 'open',
                    'data-action-params': JSON.stringify({ path: item.path }),
                  } : {})}
                >
                  <AsyncImage
                    path={item.path}
                    className="w-full h-full object-cover"
                    alt={item.name}
                  />
                  {item.mimeType?.startsWith('video/') && (
                    <div className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/50 rounded px-1.5 py-0.5">
                      <IcVideo size={12} className="text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // List view for other files
          <div className="divide-y divide-gray-100">
            {items.map(item => {
              const Icon = getFileIcon(item);
              const iconColor = getFileIconColor(item);
              
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-4 px-4 py-3"
                >
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                    <Icon size={24} className={iconColor} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] text-app-text truncate">{item.name}</div>
                    <div className="text-[12px] text-gray-500">
                      {FileSystem.formatFileSize(item.size)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryPage;
