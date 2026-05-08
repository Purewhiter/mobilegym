import React, { useEffect, useState } from 'react';
import { useTheme } from '../ThemeContext';
import type { AppManifest } from '../types/manifest';

export const AppIcon: React.FC<{
  manifest: AppManifest;
  size: number;
  radius?: number;
  showShadow?: boolean;
}> = ({ manifest, size, radius = 12, showShadow = true }) => {
  const { themeService, version } = useTheme();
  const themedIcon = themeService.getAppIcon(manifest.packageName);
  const iconSource = manifest.icon;
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [themedIcon, version, manifest.packageName, manifest.id]);

  if (themedIcon && !broken) {
    return (
      <img
        key={`${manifest.packageName || manifest.id}_${version}`}
        src={themedIcon}
        width={size}
        height={size}
        className="object-cover"
        style={{ borderRadius: radius, flexShrink: 0 }}
        alt={manifest.displayName}
        decoding="async"
        draggable={false}
        onError={() => setBroken(true)}
      />
    );
  }

  const iconSize = Math.round(size * 0.55);

  // manifest.icon 为图片 URL（PNG/WebP）时直接渲染 img
  if (typeof iconSource === 'string') {
    return (
      <img
        src={iconSource}
        width={size}
        height={size}
        className="object-cover"
        style={{ borderRadius: radius, flexShrink: 0 }}
        alt={manifest.displayName}
        draggable={false}
      />
    );
  }

  // manifest.icon 为 React 组件（lucide / 自定义 SVG）
  const Icon = iconSource;

  return (
    <div
      className={`${showShadow ? 'shadow-sm' : ''} flex items-center justify-center`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        overflow: 'hidden',
        background: manifest.iconBackground,
        color: manifest.iconForeground ?? 'currentColor',
      }}
      aria-hidden="true"
    >
      {Icon ? (
        <Icon size={iconSize} color={manifest.iconForeground ?? 'currentColor'} />
      ) : null}
    </div>
  );
};
