import { IcLauncher } from './res/icons';
import type { AppManifest } from '@/os/types/manifest';
import { PERMISSIONS } from '@/os/permissions';

export const manifest: AppManifest = {
  id: 'gallery',
  packageName: 'com.miui.gallery',
  displayName: '相册',
  displayNameEn: 'Gallery',
  version: '1.0.0',
  versionCode: 1,
  type: 'system',
  icon: IcLauncher,
  iconBackground: 'linear-gradient(to bottom right, #f472b6 0%, #c084fc 50%, #60a5fa 100%)',
  iconForeground: '#ffffff',
  designViewportWidth: 360,
  theme: {
    colors: {
      primary: '#60a5fa',
      primaryDark: '#2563eb',
      background: '#f3f4f6',
      surface: '#ffffff',
      textPrimary: '#111827',
      textSecondary: '#6b7280',
      border: '#e5e7eb',
      statusBarForeground: 'dark',
      navigationBarForeground: 'dark',
    },
  },
  permissions: [
    PERMISSIONS.READ_EXTERNAL_STORAGE,
    PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    PERMISSIONS.CAMERA,
  ],
  intentFilters: [
    {
      action: 'ACTION_SEND',
      type: 'image/*',
      route: '/',
      description: '接收图片分享',
    },
    {
      action: 'ACTION_VIEW',
      type: 'image/*',
      route: '/intent/view',
      description: '查看单张图片（来自文件管理器等）',
    },
  ],
  queries: [
    { action: 'ACTION_SEND', type: 'image/*' },
  ],
};
