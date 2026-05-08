import React from 'react';
import { AsyncFsImage } from '../../../os/components/AsyncFsImage';

/**
 * 微信内统一图片渲染：
 * - /sdcard/*：走系统文件系统（支持 IndexedDB 文件 -> Blob URL）
 * - 其他：按普通 <img> 处理（如 base64 dataUrl / 站内静态资源）
 */
export const WechatSmartImage: React.FC<{
  src: string;
  className?: string;
  alt?: string;
}> = ({ src, className, alt }) => {
  if (src.startsWith('/sdcard/')) {
    return <AsyncFsImage path={src} fallbackSrc={src} className={className} alt={alt} />;
  }
  return <img src={src} className={className} alt={alt} loading="lazy" />;
};

