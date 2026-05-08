/*
 * @Author      : PureWhite
 * @Date        : 2026-02-22 19:43:35
 * @LastEditors : PureWhite
 * @LastEditTime: 2026-02-28 03:36:51
 * @Description : 
 */
import React, { useEffect, useMemo, useState } from 'react';
import { decodeNinePatchFromUrl, type NinePatchInsets } from './parseNinePatch';

type ResolvedNinePatch = {
  insets: NinePatchInsets;
  trimmedUrl: string;
};

export const NinePatch: React.FC<{
  src: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ src, className, style, children }) => {
  const [resolved, setResolved] = useState<ResolvedNinePatch | null>(null);

  useEffect(() => {
    let cancelled = false;
    let urlToRevoke: string | null = null;
    setResolved(null);
    decodeNinePatchFromUrl(src)
      .then((r) => {
        if (cancelled || !r) return;
        const url = URL.createObjectURL(r.trimmedBlob);
        urlToRevoke = url;
        setResolved({ insets: r.insets, trimmedUrl: url });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [src]);

  const mergedStyle = useMemo<React.CSSProperties>(() => {
    if (!resolved) return style || {};
    const { top, right, bottom, left } = resolved.insets;
    const borderWidth = `${top}px ${right}px ${bottom}px ${left}px`;
    const borderSlice = `${top} ${right} ${bottom} ${left} fill`;
    return {
      ...(style || {}),
      borderStyle: 'solid',
      borderWidth,
      borderImageSource: `url(${resolved.trimmedUrl})`,
      borderImageSlice: borderSlice as any,
      borderImageRepeat: 'stretch',
    };
  }, [resolved, style]);

  return (
    <div className={className} style={mergedStyle}>
      {children}
    </div>
  );
};

