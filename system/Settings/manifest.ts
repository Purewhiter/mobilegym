import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';

export const manifest: AppManifest = {
  id: 'settings',
  packageName: 'com.android.settings',
  displayName: '设置',
  displayNameEn: 'Settings',
  version: '1.0.0',
  versionCode: 1,
  type: 'system',
  icon: IcLauncher,
  iconBackground: '#ffffff',
  iconForeground: '#6b7280',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#3482ff',
      primaryDark: '#2f6bff',
      background: '#f5f5f5',
      surface: '#ffffff',
      textPrimary: '#111827',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
  intentFilters: [
    {
      action: 'ACTION_SETTINGS',
      route: '/',
      description: '打开系统设置',
    },
  ],
  queries: [
    { action: 'ACTION_VIEW', type: 'inode/directory' },
  ],
};
