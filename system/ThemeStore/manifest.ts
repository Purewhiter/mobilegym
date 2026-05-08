import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';

export const manifest: AppManifest = {
  id: 'theme_store',
  packageName: 'com.android.thememanager',
  displayName: '主题商店',
  displayNameEn: 'Themes',
  version: '1.0.0',
  versionCode: 1,
  type: 'system',
  icon: IcLauncher,
  iconBackground: 'linear-gradient(to bottom right, #f472b6 0%, #a855f7 100%)',
  iconForeground: '#ffffff',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#a855f7',
      primaryDark: '#7c3aed',
      background: '#f5f5f5',
      surface: '#ffffff',
      textPrimary: '#111827',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
};

