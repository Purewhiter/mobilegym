import type { AppManifest } from '@/os/types/manifest';
import { PERMISSIONS } from '@/os/permissions';
import { RedditPngIcon } from './RedditPngIcon';

export const manifest: AppManifest = {
  id: 'reddit',
  packageName: 'com.reddit.frontpage',
  displayName: 'Reddit',
  displayNameEn: 'Reddit',
  version: '2026.01.0',
  versionCode: 1,
  type: 'plugin',
  icon: RedditPngIcon,
  iconBackground: '#ffffff',
  iconForeground: '#ff4500',
  designViewportWidth: 412,
  theme: {
    colors: {
      primary: '#ff4500',
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
    PERMISSIONS.CAMERA,
    PERMISSIONS.READ_EXTERNAL_STORAGE,
  ],
};
