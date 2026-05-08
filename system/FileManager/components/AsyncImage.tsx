/**
 * Async Image Component
 * 
 * Handles IndexedDB files and async loading
 */
import React, { useState, useEffect } from 'react';
import { IcImage } from '../res/icons';
import * as FileSystem from '../../../os/FileSystemService';
export const AsyncImage: React.FC<{
  path: string;
  className?: string;
  alt?: string;
}> = ({ path, className, alt }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    let mounted = true;
    
    const loadImage = async () => {
      // First try sync version
      const syncUri = FileSystem.getFileUri(path);
      if (syncUri) {
        if (mounted) {
          setSrc(syncUri);
          setLoading(false);
        }
        return;
      }
      
      // Fall back to async version
      const asyncUri = await FileSystem.getFileUriAsync(path);
      if (mounted) {
        setSrc(asyncUri);
        setLoading(false);
      }
    };
    
    loadImage();
    
    return () => { mounted = false; };
  }, [path]);
  
  if (loading || !src) {
    return (
      <div className={`${className} bg-gray-200 flex items-center justify-center`}>
        <IcImage size={24} className="text-gray-400" />
      </div>
    );
  }
  
  return <img src={src} className={className} alt={alt} loading="lazy" />;
};
