import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';

export const manifest: AppManifest = {
  id: 'clock',
  packageName: 'com.android.deskclock',
  displayName: '时钟',
  displayNameEn: 'Clock',
  version: '1.0.0',
  versionCode: 1,
  type: 'system',
  icon: IcLauncher,
  iconBackground: '#ffffff',
  iconForeground: '#000000',
  designViewportWidth: 412,
  theme: {
    colors: {
      primary: '#2f76ff',
      primaryDark: '#2458d6',
      background: '#f7f7f7',
      surface: '#ffffff',
      textPrimary: '#111827',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
};

