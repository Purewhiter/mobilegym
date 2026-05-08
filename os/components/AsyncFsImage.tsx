import React, { useEffect, useState } from 'react';
import * as FileSystem from '../FileSystemService';

export const AsyncFsImage: React.FC<{
  path: string;
  className?: string;
  alt?: string;
  fallbackSrc?: string;
}> = ({ path, className, alt, fallbackSrc }) => {
  const [src, setSrc] = useState<string | null>(fallbackSrc || null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const syncUri = FileSystem.getFileUri(path);
      if (syncUri) {
        if (mounted) setSrc(syncUri);
        return;
      }

      const asyncUri = await FileSystem.getFileUriAsync(path);
      if (mounted) setSrc(asyncUri || fallbackSrc || null);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [path, fallbackSrc]);

  if (!src) {
    // Keep layout stable; caller supplies background styles.
    return <div className={className} />;
  }

  return <img src={src} className={className} alt={alt} loading="lazy" />;
};

export default AsyncFsImage;

