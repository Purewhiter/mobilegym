import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';
import { PERMISSIONS } from '@/os/permissions';

export const manifest: AppManifest = {
  id: 'browser',
  packageName: 'com.miui.browser',
  displayName: '浏览器',
  displayNameEn: 'Browser',
  version: '1.0.0',
  versionCode: 1,
  type: 'system',
  icon: IcLauncher,
  iconBackground: '#ffffff',
  iconForeground: '#60a5fa',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#60a5fa',
      primaryDark: '#2563eb',
      background: '#ffffff',
      surface: '#ffffff',
      textPrimary: '#111827',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
  permissions: [
    PERMISSIONS.ACCESS_FINE_LOCATION,
    PERMISSIONS.CAMERA,
  ],
  intentFilters: [
    {
      action: 'ACTION_VIEW',
      scheme: 'http',
      route: '/view',
      description: '打开 http 链接',
    },
    {
      action: 'ACTION_VIEW',
      scheme: 'https',
      route: '/view',
      description: '打开 https 链接',
    },
  ],
};
