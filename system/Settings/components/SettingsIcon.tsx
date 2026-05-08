import React, { useEffect, useState } from 'react';
import { useTheme } from '../../../os/ThemeContext';
import { useSettingsStore, selectPagesData } from '../state';

/** Standard rounded-rect background shared by most icons */
const STD_BG_PATH =
  'M-0.001,11.952C-0.001,7.768 -0.001,5.677 0.813,4.079C1.529,2.673 2.672,1.53 4.078,0.814C5.676,0 7.767,0 11.951,0H16.047C20.231,0 22.322,0 23.92,0.814C25.326,1.53 26.469,2.673 27.185,4.079C27.999,5.677 27.999,7.768 27.999,11.952V16.048C27.999,20.232 27.999,22.323 27.185,23.921C26.469,25.327 25.326,26.47 23.92,27.186C22.322,28 20.231,28 16.047,28H11.951C7.767,28 5.676,28 4.078,27.186C2.672,26.47 1.529,25.327 0.813,23.921C-0.001,22.323 -0.001,20.232 -0.001,16.048V11.952Z';

/** Icons with white/light backgrounds that use their own outline-style background path */
const OUTLINE_ICONS = new Set([
  'ic_hyper_ai',
  'ic_interconnection',
  'onedrive_account',
  'xiaoai',
  'xiaomi_account',
  'ic_account_avatar',
]);

interface SettingsIconProps {
  /** Key into SETTINGS_ICONS */
  name: string;
  /** Size in pixels (default 28) */
  size?: number;
  className?: string;
}

/** Renders a Settings icon from extracted Android vector drawable SVG paths */
export const SettingsIcon: React.FC<SettingsIconProps> = ({ name, size = 28, className = '' }) => {
  const { themeService, version } = useTheme();
  const [themedUri, setThemedUri] = useState<string | null>(null);
  const data = useSettingsStore(selectPagesData);

  useEffect(() => {
    let cancelled = false;
    setThemedUri(themeService.getAppAsset('com.android.settings', name));
    themeService
      .getAppAssetAsync('com.android.settings', name)
      .then((uri) => {
        if (!cancelled) setThemedUri(uri);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [name, themeService, version]);

  if (themedUri) {
    return (
      <img
        src={themedUri}
        width={size}
        height={size}
        className={className}
        style={{ flexShrink: 0 }}
        alt=""
        decoding="async"
        onError={() => setThemedUri(null)}
      />
    );
  }

  const iconData = data?.icons?.[name];
  if (!iconData) {
    // Fallback: gray circle
    return (
      <div
        className={`rounded-lg bg-gray-200 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // Outline icons: first path IS the background, rest are foreground with varied colors
  if (OUTLINE_ICONS.has(name)) {
    return (
      <svg
        viewBox="0 0 28 28"
        width={size}
        height={size}
        className={className}
        style={{ flexShrink: 0 }}
      >
        {/* Use the actual first path data from the icon as background */}
        <path d={STD_BG_PATH} fill={iconData.bg} />
        {iconData.paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            fill={i === 0 && iconData.bg === '#ffffff' ? '#333' : (iconData.bg === '#ffffff' ? '#555' : '#ffffff')}
            fillRule={p.fillRule === 'evenodd' ? 'evenodd' : undefined}
          />
        ))}
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 28 28"
      width={size}
      height={size}
      className={className}
      style={{ flexShrink: 0 }}
    >
      {/* Background rounded rectangle */}
      <path d={STD_BG_PATH} fill={iconData.bg} />
      {/* Foreground icon paths */}
      {iconData.paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill="#ffffff"
          fillRule={p.fillRule === 'evenodd' ? 'evenodd' : undefined}
        />
      ))}
    </svg>
  );
};
