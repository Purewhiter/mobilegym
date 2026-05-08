import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';

export const manifest: AppManifest = {
  id: 'calendar',
  packageName: 'com.android.calendar',
  displayName: '日历',
  displayNameEn: 'Calendar',
  version: '1.0.0',
  versionCode: 1,
  type: 'system',
  icon: IcLauncher,
  iconBackground: '#ffffff',
  iconForeground: '#e53935',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#4285f4',
      primaryDark: '#2563eb',
      background: '#f4f4f4',
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
      action: 'ACTION_VIEW',
      type: 'vnd.android.cursor.item/event',
      route: '/',
      description: '查看日程事件',
    },
  ],
};
